import PromiseMerger from '../index';

const flush = () => Array.from({ length: 8 }).reduce(chain => chain.then(() => undefined), Promise.resolve());

describe('PromiseMerger lifecycle', () => {
  let merger;

  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    merger.dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('schedules different groups independently with isolated data and parameters', async () => {
    const callback = jest.fn((codes, args, data, params) => Promise.resolve({ [codes[0]]: { args, data, params } }));
    merger = new PromiseMerger(callback, { max: 10 }, 20);
    const values = [];
    merger.add('same', () => 'A', 'A', { id: 'A' }, { lang: 'A' }).then(value => values.push(value));
    merger.add('same', () => 'B', 'B', { id: 'B' }, { lang: 'B' }).then(value => values.push(value));
    jest.advanceTimersByTime(20);
    await flush();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(values).toEqual([
      { args: 'A', data: [{ id: 'A' }], params: { same: { lang: 'A' } } },
      { args: 'B', data: [{ id: 'B' }], params: { same: { lang: 'B' } } },
    ]);
  });

  it('only debounces the group receiving a new code', async () => {
    const callback = jest.fn().mockResolvedValue({ a: 1, b: 2, c: 3 });
    merger = new PromiseMerger(callback, {}, 20);
    const promises = [merger.add('a', () => 'A', 'A'), merger.add('b', () => 'B', 'B')];
    jest.advanceTimersByTime(10);
    promises.push(merger.add('c', () => 'B', 'B'));
    jest.advanceTimersByTime(10);
    await flush();
    expect(callback.mock.calls.map(call => call[0])).toEqual([['a']]);
    jest.advanceTimersByTime(10);
    await expect(Promise.all(promises)).resolves.toEqual([1, 2, 3]);
    expect(callback.mock.calls.map(call => call[0])).toEqual([['a'], ['b', 'c']]);
  });

  it('freezes flight data, joins duplicate callers and does not resend flying codes', async () => {
    let complete;
    const callback = jest.fn().mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
      .mockResolvedValueOnce({ b: 2 });
    merger = new PromiseMerger(callback, {}, 20);
    const first = merger.add('a', undefined, 'first', { id: 1 }, { lang: 'old' });
    jest.advanceTimersByTime(20);
    await flush();
    const duplicate = merger.add('a', undefined, 'later', { id: 9 }, { lang: 'new' });
    const next = merger.add('b', undefined, 'next', { id: 2 }, { lang: 'next' });
    complete({ a: 1 });
    await expect(Promise.all([first, duplicate])).resolves.toEqual([1, 1]);
    jest.advanceTimersByTime(20);
    await expect(next).resolves.toBe(2);
    expect(callback.mock.calls).toEqual([
      [['a'], 'first', [{ id: 1 }], { a: { lang: 'old' } }],
      [['b'], 'next', [{ id: 2 }], { b: { lang: 'next' } }],
    ]);
    expect(merger.promiseMap.size).toBe(0);
  });

  it.each(['throw', 'reject'])('settles all callers after %s and retries without stale data', async mode => {
    const error = new Error(mode);
    const callback = jest.fn().mockImplementationOnce(() => {
      if (mode === 'throw') throw error;
      return Promise.reject(error);
    }).mockResolvedValue({ a: 1, b: 2 });
    merger = new PromiseMerger(callback, {}, 20);
    const results = [];
    merger.add('a', () => 'A', {}, { old: true }).catch(reason => results.push(reason));
    merger.add('a', () => 'A', {}).catch(reason => results.push(reason));
    const other = merger.add('b', () => 'B', {}).catch(reason => reason);
    expect(() => jest.advanceTimersByTime(20)).not.toThrow();
    await flush();
    expect(results).toEqual([error, error]);
    await expect(other).resolves.toBe(2);
    const retry = merger.add('a', () => 'A', {});
    jest.advanceTimersByTime(20);
    await expect(retry).resolves.toBe(1);
    expect(callback.mock.calls[2][2]).toEqual([]);
    expect(merger.promiseMap.size).toBe(0);
  });

  it('releases unique request metadata after completion and cache eviction', async () => {
    merger = new PromiseMerger(codes => Promise.resolve({ [codes[0]]: 1 }), { max: 1 }, 20);
    await Array.from({ length: 30 }).reduce((chain, _, i) => chain.then(() => {
      const result = merger.add(String(i), undefined, {}, { id: i }, { id: i });
      jest.advanceTimersByTime(20);
      return result;
    }), Promise.resolve());
    merger.cache.reset();
    expect(merger.dataMap ? merger.dataMap.size : 0).toBe(0);
    expect(merger.promiseMap.size).toBe(0);
  });

  it('keeps overlapping flights independent when later codes finish first', async () => {
    let complete;
    const callback = jest.fn().mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
      .mockResolvedValueOnce({ b: 2 });
    merger = new PromiseMerger(callback, {}, 20);
    const first = merger.add('a', undefined, {}, { id: 1 });
    jest.advanceTimersByTime(20);
    await flush();
    const second = merger.add('b', undefined, {}, { id: 2 });
    jest.advanceTimersByTime(20);
    await expect(second).resolves.toBe(2);
    expect(callback.mock.calls[1][0]).toEqual(['b']);
    expect(merger.promiseMap.size).toBe(1);
    complete({ a: 1 });
    await expect(first).resolves.toBe(1);
    expect(merger.promiseMap.size).toBe(0);
    expect(merger.waitIDs.size).toBe(0);
  });

  it('accepts stable symbol cache identities without changing legacy code cache access', async () => {
    const publicKey = Symbol('scope');
    const privateKey = Symbol('scope');
    const callback = jest.fn((codes, value) => Promise.resolve({ [codes[0]]: value }));
    merger = new PromiseMerger(callback, { max: 2 }, 20);
    const first = merger.add('same', () => publicKey, 7, undefined, undefined, publicKey);
    const second = merger.add('same', () => privateKey, 2, undefined, undefined, privateKey);
    jest.advanceTimersByTime(20);
    await expect(Promise.all([first, second])).resolves.toEqual([7, 2]);
    await expect(merger.add('same', () => publicKey, 9, undefined, undefined, publicKey)).resolves.toBe(7);
    merger.cache.set(publicKey, 8);
    await expect(merger.add('same', () => publicKey, 9, undefined, undefined, publicKey)).resolves.toBe(8);
    merger.cache.del(publicKey);
    merger.cache.set('legacy', 0);
    await expect(merger.add('legacy', undefined, 9)).resolves.toBe(0);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(merger.cache.get(privateKey)).toBe(2);
    merger.cache.reset();
    expect(merger.cache.get(privateKey)).toBeUndefined();
  });

  it('settles callers directly even when a result exceeds cache capacity', async () => {
    merger = new PromiseMerger(() => Promise.resolve({ a: 1, b: 2 }), { max: 1 }, 20);
    const results = [merger.add('a', undefined, {}), merger.add('b', undefined, {})];
    jest.advanceTimersByTime(20);
    await expect(Promise.all(results)).resolves.toEqual([1, 2]);
    expect(merger.cache.get('a')).toBeUndefined();
    expect(merger.cache.get('b')).toBe(2);
  });

  it('disposes queued and flying callers, blocks late cache writes and rejects later adds', async () => {
    let complete;
    const callback = jest.fn(() => new Promise(resolve => { complete = resolve; }));
    merger = new PromiseMerger(callback, {}, 20);
    const errors = [];
    merger.add('a', undefined, {}, { id: 1 }).catch(error => errors.push(error));
    jest.advanceTimersByTime(20);
    await flush();
    merger.add('b', undefined, {}, { id: 2 }).catch(error => errors.push(error));
    merger.dispose();
    merger.dispose();
    complete({ a: 1 });
    jest.advanceTimersByTime(20);
    await flush();
    expect(errors).toHaveLength(2);
    errors.forEach(error => expect(error.message).toBe('PromiseMerger disposed'));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(merger.cache.get('a')).toBeUndefined();
    expect(merger.promiseMap.size).toBe(0);
    await expect(merger.add('c', undefined, {})).rejects.toThrow('PromiseMerger disposed');
  });
});
