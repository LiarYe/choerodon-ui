import DataSet from '../../data-set/DataSet';
import { AttachmentStore } from '../AttachmentStore';
import { getConfig, overwriteDefaultConfig } from '../../configure';

describe('Attachment count cache scope', () => {
  let store;
  let attachment;
  const loader = count => jest.fn(uuids => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, count]))));
  const fieldFor = batchFetchCount => new DataSet({
    fields: [{ name: 'files', type: 'attachment' }],
  }, { getConfig: key => key === 'attachment' ? { batchFetchCount } : getConfig(key) }).getField('files');
  const settle = async promises => {
    jest.advanceTimersByTime(200);
    return Promise.all(promises);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    store = new AttachmentStore();
    attachment = getConfig('attachment');
  });

  afterEach(() => {
    store.merger.dispose();
    overwriteDefaultConfig({ attachment });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('isolates real DataSet loaders for the same UUID and reuses each scope', async () => {
    const first = loader(7);
    const second = loader(2);
    const a = fieldFor(first);
    const b = fieldFor(second);
    const options = { attachmentUUID: 'same' };
    expect(await settle([store.fetchCountInBatch(options, a)])).toEqual([7]);
    expect(await settle([store.fetchCountInBatch(options, b)])).toEqual([2]);
    await expect(store.fetchCountInBatch(options, a)).resolves.toBe(7);
    await expect(store.fetchCountInBatch(options, b)).resolves.toBe(2);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('isolates public/private and storage coordinates concurrently and updates only the matching scope', async () => {
    const batchFetchCount = jest.fn((uuids, { items }) => Promise.resolve(Object.fromEntries(items.map(item => [item.attachmentUUID, item.isPublic ? 7 : 2]))));
    const field = fieldFor(batchFetchCount);
    const scopes = [
      { attachmentUUID: 'same', isPublic: true, bucketName: 'a', bucketDirectory: 'dir', storageCode: 's' },
      { attachmentUUID: 'same', isPublic: false, bucketName: 'a', bucketDirectory: 'dir', storageCode: 's' },
      { attachmentUUID: 'same', isPublic: true, bucketName: 'b', bucketDirectory: 'dir', storageCode: 's' },
      { attachmentUUID: 'same', isPublic: true, bucketName: 'a', bucketDirectory: 'other', storageCode: 's' },
      { attachmentUUID: 'same', isPublic: true, bucketName: 'a', bucketDirectory: 'dir', storageCode: 'other' },
    ];
    expect(await settle(scopes.map(options => store.fetchCountInBatch(options, field)))).toEqual([7, 2, 7, 7, 7]);
    expect(batchFetchCount).toHaveBeenCalledTimes(5);
    store.updateCacheCount(scopes[0], 0, field);
    expect(await settle(scopes.map(options => store.fetchCountInBatch(options, field)))).toEqual([0, 2, 7, 7, 7]);
    expect(batchFetchCount).toHaveBeenCalledTimes(5);
    store.merger.cache.reset();
    expect(await settle([store.fetchCountInBatch(scopes[0], field)])).toEqual([7]);
    expect(batchFetchCount).toHaveBeenCalledTimes(6);
  });

  it('preserves global string updates and gives an explicit loader priority over Field and global', async () => {
    const global = loader(9);
    const local = loader(2);
    const explicit = loader(7);
    overwriteDefaultConfig({ attachment: { ...attachment, batchFetchCount: global } });
    const field = fieldFor(local);
    const options = { attachmentUUID: 'same' };
    expect(await settle([store.fetchCountInBatch(options), store.fetchCountInBatch(options, field), store.fetchCountInBatch(options, field, explicit)])).toEqual([9, 2, 7]);
    store.updateCacheCount('same', 0);
    store.updateCacheCount(options, 4, field, explicit);
    expect(await settle([store.fetchCountInBatch(options), store.fetchCountInBatch(options, field), store.fetchCountInBatch(options, field, explicit)])).toEqual([0, 2, 4]);
    expect(global).toHaveBeenCalledTimes(1);
    expect(local).toHaveBeenCalledTimes(1);
    expect(explicit).toHaveBeenCalledTimes(1);
  });

  it.each(['throw', 'reject'])('retains the original %s reason and retries within its scope', async kind => {
    const error = new Error(kind);
    const batchFetchCount = jest.fn(() => {
      if (kind === 'throw') throw error;
      return Promise.reject(error);
    });
    const field = fieldFor(batchFetchCount);
    const options = { attachmentUUID: 'failure' };
    const failure = store.fetchCountInBatch(options, field).catch(reason => reason);
    expect(await settle([failure])).toEqual([error]);
    batchFetchCount.mockImplementation(uuids => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, 3]))));
    expect(await settle([store.fetchCountInBatch(options, field)])).toEqual([3]);
    expect(batchFetchCount).toHaveBeenCalledTimes(2);
  });

  it('retains cache expiry and bounded eviction without a separate UUID identity table', async () => {
    const batchFetchCount = loader(7);
    const field = fieldFor(batchFetchCount);
    store.merger.cache.max = 1;
    const a = { attachmentUUID: 'a' };
    const b = { attachmentUUID: 'b' };
    await settle([store.fetchCountInBatch(a, field)]);
    await settle([store.fetchCountInBatch(b, field)]);
    await settle([store.fetchCountInBatch(a, field)]);
    expect(batchFetchCount).toHaveBeenCalledTimes(3);
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 60001);
    await settle([store.fetchCountInBatch(a, field)]);
    clock.mockRestore();
    expect(batchFetchCount).toHaveBeenCalledTimes(4);
  });
});
