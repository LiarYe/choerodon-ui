import { isAction } from 'mobx';
import PromiseMerger from '../index';

describe('PromiseMerger action', () => {
  let merger;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    merger.dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('activates add and preserves batching, duplicate callers, parameters and cache hits', async () => {
    const callback = jest.fn().mockResolvedValue({ a: ['A'], b: ['B'] });
    merger = new PromiseMerger(callback, { max: 10 }, 20);
    expect(isAction(merger.add)).toBe(true);
    const args = { url: '/lookup' };
    const first = merger.add('a', undefined, args, { id: 1 }, { language: 'zh' });
    const duplicate = merger.add('a', undefined, args);
    const second = merger.add('b', undefined, args, { id: 2 });
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(20);
    await expect(Promise.all([first, duplicate, second])).resolves.toEqual([['A'], ['A'], ['B']]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(['a', 'b'], args, [{ id: 1 }, { id: 2 }], { a: { language: 'zh' } });
    expect(merger.promiseMap.size).toBe(0);
    await expect(merger.add('a', undefined, args)).resolves.toEqual(['A']);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate callers and allows retry after failure', async () => {
    const error = new Error('request failed');
    const callback = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce({ a: ['A'] });
    merger = new PromiseMerger(callback, { max: 10 }, 20);
    const first = merger.add('a', undefined, {}, undefined, { language: 'zh' });
    const duplicate = merger.add('a', undefined, {});
    const failures = Promise.all([first, duplicate].map(promise => promise.catch(reason => reason)));
    jest.advanceTimersByTime(20);
    await expect(failures).resolves.toEqual([error, error]);
    expect(merger.promiseMap.size).toBe(0);
    const retry = merger.add('a', undefined, {});
    jest.advanceTimersByTime(20);
    await expect(retry).resolves.toEqual(['A']);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
