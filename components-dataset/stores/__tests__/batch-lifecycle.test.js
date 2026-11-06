import { runInAction } from 'mobx';
import { LookupCodeStore } from '../LookupCodeStore';
import { LovCodeStore } from '../LovCodeStore';
import { AttachmentStore } from '../AttachmentStore';
import { getConfig, overwriteDefaultConfig } from '../../configure';

describe('Store batch lifecycle compatibility', () => {
  let stores;
  let attachment;

  beforeEach(() => {
    jest.useFakeTimers();
    stores = [];
    attachment = getConfig('attachment');
  });

  afterEach(() => {
    stores.forEach(store => store.merger.dispose());
    overwriteDefaultConfig({ attachment });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each(['Lookup', 'Lov'])('%s sends different URLs and retains default code cache identity', async kind => {
    const store = kind === 'Lookup' ? new LookupCodeStore() : new LovCodeStore();
    stores.push(store);
    const axios = jest.fn(config => Promise.resolve(Object.fromEntries(config.codes.map(code => [code, [config.url]]))));
    store.getAxios = () => axios;
    const fetch = (code, url) => {
      const config = codes => ({ url, codes });
      return kind === 'Lookup' ? store.fetchLookupDataInBatch(code, config) : store.fetchDefineInBatch(code, config);
    };
    const first = fetch('a', '/A?lang=zh');
    const second = fetch('b', '/B');
    jest.advanceTimersByTime(200);
    await expect(Promise.all([first, second])).resolves.toEqual([['/A?lang=zh'], ['/B']]);
    await expect(fetch('a', '/other')).resolves.toEqual(['/A?lang=zh']);
    expect(axios).toHaveBeenCalledTimes(2);
    expect(store.merger.promiseMap.size).toBe(0);
  });

  it('preserves Lov selective, empty-list and full clearCache behavior', async () => {
    const store = new LovCodeStore();
    stores.push(store);
    const axios = jest.fn(config => Promise.resolve(Object.fromEntries(config.codes.map(code => [code, { code }]))));
    store.getAxios = () => axios;
    const fetch = code => store.fetchDefineInBatch(code, codes => ({ url: '/lov', codes }));
    const initial = Promise.all([fetch('a'), fetch('b')]);
    jest.advanceTimersByTime(200);
    await initial;
    runInAction(() => {
      store.lovCodes.set('a', { code: 'a' });
      store.lovCodes.set('b', { code: 'b' });
    });
    store.clearCache([]);
    expect(store.merger.cache.get('a')).toEqual({ code: 'a' });
    store.clearCache(['a']);
    expect(store.getConfig('a')).toBeUndefined();
    expect(store.getConfig('b')).toEqual({ code: 'b' });
    expect(store.merger.cache.get('a')).toBeUndefined();
    await expect(fetch('b')).resolves.toEqual({ code: 'b' });
    const retry = fetch('a');
    jest.advanceTimersByTime(200);
    await retry;
    expect(axios).toHaveBeenCalledTimes(2);
    store.clearCache();
    expect(store.lovCodes.size).toBe(0);
    expect(store.merger.cache.get('a')).toBeUndefined();
    expect(store.merger.cache.get('b')).toBeUndefined();
  });

  it('sends real Attachment public/private and different loader groups concurrently', async () => {
    const store = new AttachmentStore();
    stores.push(store);
    const firstLoader = jest.fn(uuids => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, 7]))));
    const secondLoader = jest.fn(uuids => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, 2]))));
    overwriteDefaultConfig({ attachment: { ...attachment, batchFetchCount: firstLoader } });
    const first = store.fetchCountInBatch({ attachmentUUID: 'public', isPublic: true });
    const second = store.fetchCountInBatch({ attachmentUUID: 'private', isPublic: false });
    overwriteDefaultConfig({ attachment: { ...attachment, batchFetchCount: secondLoader } });
    const third = store.fetchCountInBatch({ attachmentUUID: 'other', isPublic: true });
    jest.advanceTimersByTime(200);
    await expect(Promise.all([first, second, third])).resolves.toEqual([7, 7, 2]);
    expect(firstLoader).toHaveBeenCalledTimes(2);
    expect(secondLoader).toHaveBeenCalledTimes(1);
    expect(firstLoader).toHaveBeenCalledWith(['public'], { isPublic: true, items: [{ attachmentUUID: 'public', isPublic: true }] });
    expect(store.merger.promiseMap.size).toBe(0);
  });
});
