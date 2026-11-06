import DataSet from '../DataSet';
import AttachmentFile from '../AttachmentFile';
import attachmentStore from '../../stores/AttachmentStore';

function deferred() {
  let resolve;
  const promise = new Promise(resolvePromise => { resolve = resolvePromise; });
  return { promise, resolve };
}

describe('Field attachment responses', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setup() {
    const dataSet = new DataSet({
      fields: [{ name: 'files', type: 'attachment' }],
      data: [{ files: 'old' }, { files: 'other' }],
    });
    const field = dataSet.getField('files');
    const record = dataSet.get(0);
    const old = deferred();
    const current = deferred();
    const fetchList = jest.fn(({ attachmentUUID }) => (attachmentUUID === 'old' ? old : current).promise);
    const getConfig = dataSet.getConfig.bind(dataSet);
    jest.spyOn(dataSet, 'getConfig').mockImplementation(key => (
      key === 'attachment' ? { fetchList, batchFetchCount: jest.fn() } : getConfig(key)
    ));
    jest.spyOn(attachmentStore, 'fetchCountInBatch').mockImplementation(({ attachmentUUID }) => (
      attachmentUUID === 'old' ? old : current
    ).promise);
    return { dataSet, field, record, old, current };
  }

  it.each(['list', 'count'])('keeps out-of-order %s responses in their requested UUID caches', async kind => {
    const { dataSet, field, record, old, current } = setup();
    const fetch = uuid => {
      if (kind === 'list') {
        field.fetchAttachments({ attachmentUUID: uuid }, record);
        return field.fetchingList;
      }
      field.fetchAttachmentCount(uuid, false, record);
      return field.fetchingCount;
    };
    const oldRequest = fetch('old');
    record.set('files', 'current');
    const currentRequest = fetch('current');
    current.resolve(kind === 'list' ? [{ uid: 'current', name: 'current.txt' }] : 2);
    await currentRequest;
    dataSet.current = dataSet.get(1);
    old.resolve(kind === 'list' ? [{ uid: 'old', name: 'old.txt' }] : 7);
    await oldRequest;
    if (kind === 'list') {
      expect(field.getAttachments(record).map(file => file.uid)).toEqual(['current']);
      expect(field.getAttachments(record, 'old')[0]).toBeInstanceOf(AttachmentFile);
      expect(field.getAttachments(record, 'old').map(file => file.uid)).toEqual(['old']);
    } else {
      expect(field.getAttachmentCount(record)).toBe(2);
      expect(record.attachmentCaches.get('old').count).toBe(7);
    }
    expect(record.pendingAttachmentUUIDs && record.pendingAttachmentUUIDs.get('files')).toBeUndefined();
    expect(dataSet.get(1).attachmentCaches).toBeUndefined();
  });

  it.each(['old', 'current', undefined])('preserves pending UUID when a list response arrives with record value %s', async value => {
    const { field, record, old } = setup();
    field.fetchAttachments({ attachmentUUID: 'old' }, record);
    const request = field.fetchingList;
    record.set('files', value);
    const pending = new AttachmentFile({ uid: 'pending', name: 'pending.txt' });
    field.setAttachments([pending], record, 'pending');
    old.resolve([{ uid: 'old', name: 'old.txt' }]);
    await request;
    expect(record.pendingAttachmentUUIDs.get('files')).toBe('pending');
    expect(field.getAttachments(record, 'pending')).toEqual([pending]);
    expect(field.getAttachments(record, 'old').map(file => file.uid)).toEqual(['old']);
    if (!value) {
      expect(field.getAttachments(record)).toEqual([pending]);
    }
  });

  it('caches a late count after clearing the value without replacing the pending UUID', async () => {
    const { field, record, old } = setup();
    field.fetchAttachmentCount('old', false, record);
    const request = field.fetchingCount;
    record.set('files', undefined);
    field.setAttachments([new AttachmentFile({ uid: 'pending' })], record, 'pending');
    old.resolve(7);
    await request;
    expect(record.attachmentCaches.get('old').count).toBe(7);
    expect(record.pendingAttachmentUUIDs.get('files')).toBe('pending');
    expect(field.getAttachmentCount(record)).toBe(1);
  });

  it('preserves direct setter pending UUID transitions and count defaults', () => {
    const { field, record } = setup();
    field.setAttachments([], record, 'pending');
    expect(record.pendingAttachmentUUIDs.get('files')).toBe('pending');
    field.setAttachments([], record);
    expect(record.pendingAttachmentUUIDs.has('files')).toBe(false);
    field.setAttachmentCount(3, record);
    expect(record.attachmentCaches.get('old').count).toBe(3);
    field.setAttachments([], undefined);
    field.setAttachmentCount(4, undefined);
    expect(field.attachments).toEqual([]);
    expect(field.get('attachmentCount')).toBe(4);
  });

  it('ignores extra arguments to public setters', () => {
    const { field, record } = setup();
    field.setAttachments([], record, 'pending', false);
    expect(record.pendingAttachmentUUIDs.get('files')).toBe('pending');
    field.setAttachments(undefined, record, undefined, false);
    expect(record.pendingAttachmentUUIDs.has('files')).toBe(false);
    expect(field.getAttachments(record)).toBeUndefined();
    field.setAttachmentCount(3, record, 'pending');
    expect(record.attachmentCaches.get('old').count).toBe(3);
    expect(record.attachmentCaches.get('pending').count).toBeUndefined();
  });

  it('uses the bound record and preserves clearing and empty-value behavior', () => {
    const { record } = setup();
    const field = record.getField('files');
    field.setAttachments([], undefined, 'pending');
    expect(record.pendingAttachmentUUIDs.get('files')).toBe('pending');
    field.setAttachments(undefined);
    expect(record.pendingAttachmentUUIDs.has('files')).toBe(false);
    expect(field.getAttachments()).toBeUndefined();
    field.setAttachmentCount(3);
    expect(field.getAttachmentCount()).toBe(3);
    field.setAttachmentCount(undefined);
    expect(field.getAttachmentCount()).toBeUndefined();
    record.set('files', undefined);
    field.setAttachments([], undefined, 'pending');
    field.setAttachmentCount(4);
    field.setAttachments(undefined);
    expect(record.pendingAttachmentUUIDs.get('files')).toBe('pending');
    expect(record.attachmentCaches.get('pending').count).toBeUndefined();
    expect(field.getAttachments()).toEqual([]);
  });
});
