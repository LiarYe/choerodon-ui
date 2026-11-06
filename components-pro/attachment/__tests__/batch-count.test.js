import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { runInAction } from 'mobx';
import Attachment from '../Attachment';
import configure, { getConfig } from '../../../components-dataset/configure';
import attachmentStore from '../../stores/AttachmentStore';
import ConfigProvider from '../../../components/config-provider';
import DataSet from '../../data-set';
import AttachmentFile from '../../data-set/AttachmentFile';

describe('Attachment real batch counts', () => {
  let wrapper;
  let original;
  let batchFetchCount;
  let requests;

  const flush = async () => {
    await act(async () => { await Promise.resolve(); });
    if (wrapper) wrapper.update();
  };
  const batch = async () => {
    act(() => { jest.advanceTimersByTime(200); });
    await flush();
  };
  const start = async value => {
    act(() => { wrapper = mount(<Attachment value={value} readOnly viewMode="popup" sortable={false} />); });
    await batch();
  };
  const update = async props => {
    act(() => { wrapper.setProps(props); });
    await batch();
  };
  const settle = async (index, value, reject = false) => {
    await act(async () => { requests[index][reject ? 'reject' : 'resolve'](value); });
    await flush();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    original = getConfig('attachment');
    attachmentStore.merger.cache.reset();
    requests = [];
    batchFetchCount = jest.fn(() => new Promise((resolve, reject) => { requests.push({ resolve, reject }); }));
    configure({ attachment: { ...original, batchFetchCount } }, null);
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
    wrapper = undefined;
    configure({ attachment: original }, null);
    attachmentStore.merger.cache.reset();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('Q07 synchronizes controlled value changes once without querying or mirroring oldValue', async () => {
    await start('sync-A');
    await settle(0, { 'sync-A': 7 });
    const instance = wrapper.find(Attachment).instance();
    const sync = jest.spyOn(instance, 'fetchCount');
    await update({ value: 'sync-B', count: 0 });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(instance.count).toBe(0);
    expect(batchFetchCount).toHaveBeenCalledTimes(1);
    expect(Object.prototype.hasOwnProperty.call(instance, 'oldValue')).toBe(false);
  });

  it.each(['record.set', 'current', 'record', 'name', 'field', 'load'])('Q07 preserves %s binding synchronization through the real store', async change => {
    const dataSet = new DataSet({
      fields: [{ name: 'files', type: 'attachment' }, { name: 'other', type: 'attachment' }],
      data: [{ files: 'bound-A', other: 'bound-B' }, { files: 'bound-B' }],
    });
    act(() => {
      wrapper = mount(<Attachment dataSet={dataSet} name="files" readOnly viewMode="popup" sortable={false} />);
    });
    await batch();
    await settle(0, { 'bound-A': 7 });
    const instance = wrapper.find(Attachment).instance();
    const sync = jest.spyOn(instance, 'fetchCount');
    act(() => {
      if (change === 'record.set') dataSet.current.set('files', 'bound-B');
      if (change === 'current') dataSet.current = dataSet.get(1);
      if (change === 'record') wrapper.setProps({ record: dataSet.get(1) });
      if (change === 'name') wrapper.setProps({ name: 'other' });
      if (change === 'field') {
        const next = new DataSet({ fields: [{ name: 'files', type: 'attachment' }], data: [{ files: 'bound-B' }] });
        wrapper.setProps({ dataSet: next });
      }
      if (change === 'load') dataSet.loadData([{ files: 'bound-B' }]);
    });
    await batch();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(batchFetchCount.mock.calls.map(([uuids]) => uuids)).toEqual([['bound-A'], ['bound-B']]);
    await settle(1, { 'bound-B': 2 });
    expect(instance.count).toBe(2);
    expect(instance.field.getAttachmentCount(instance.record)).toBe(2);
    expect(wrapper.text()).not.toContain('7');
    sync.mockClear();
    wrapper.unmount();
    wrapper = undefined;
    act(() => { dataSet.loadData([{ files: 'after-unmount' }]); });
    await batch();
    expect(sync).not.toHaveBeenCalled();
    expect(batchFetchCount).toHaveBeenCalledTimes(2);
  });

  it('Q07 synchronizes temp UUID commit and viewMode changes without duplicate effects', async () => {
    act(() => { wrapper = mount(<Attachment sortable={false} />); });
    const instance = wrapper.find(Attachment).instance();
    const sync = jest.spyOn(instance, 'fetchCount');
    act(() => { runInAction(() => { instance.tempAttachmentUUID = 'temporary'; }); });
    await flush();
    expect(sync).toHaveBeenCalledTimes(1);
    sync.mockClear();
    act(() => {
      runInAction(() => {
        instance.setValue('temporary');
        instance.tempAttachmentUUID = undefined;
      });
    });
    await flush();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(instance.getValue()).toBe('temporary');
    sync.mockClear();
    await update({ viewMode: 'popup', count: undefined });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(batchFetchCount.mock.calls.map(([uuids]) => uuids)).toEqual([['temporary']]);
    wrapper.unmount();
    wrapper = undefined;
    await settle(0, { temporary: 9 });
    expect(instance.observableProps.count).toBeUndefined();
    sync.mockClear();
    act(() => { runInAction(() => { instance.tempAttachmentUUID = 'unmounted'; }); });
    await batch();
    expect(sync).not.toHaveBeenCalled();
    expect(batchFetchCount).toHaveBeenCalledTimes(1);
  });

  it('Q07 handles empty and same UUID reloads without retaining the previous record count', async () => {
    const dataSet = new DataSet({ fields: [{ name: 'files', type: 'attachment' }], data: [{ files: 'reload' }] });
    act(() => {
      wrapper = mount(<Attachment dataSet={dataSet} name="files" readOnly viewMode="popup" sortable={false} />);
    });
    await batch();
    await settle(0, { reload: 7 });
    const instance = wrapper.find(Attachment).instance();
    const sync = jest.spyOn(instance, 'fetchCount');
    attachmentStore.merger.cache.reset();
    act(() => { dataSet.loadData([]); });
    await batch();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(instance.count).toBeUndefined();
    expect(batchFetchCount).toHaveBeenCalledTimes(1);
    sync.mockClear();
    act(() => { dataSet.loadData([{ files: 'reload' }]); });
    await batch();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(batchFetchCount).toHaveBeenCalledTimes(2);
    await settle(1, { reload: 2 });
    expect(instance.count).toBe(2);
  });

  it('queries B after loaded A through the real store and merger', async () => {
    await start('batch-A');
    await settle(0, { 'batch-A': 7 });
    expect(wrapper.text()).toContain('7');
    await update({ value: 'batch-B' });
    expect(batchFetchCount.mock.calls.map(([uuids]) => uuids)).toEqual([['batch-A'], ['batch-B']]);
    expect(wrapper.text()).not.toContain('7');
    await settle(1, { 'batch-B': 2 });
    expect(wrapper.find(Attachment).instance().count).toBe(2);
    expect(wrapper.text()).toContain('2');
  });

  it('keeps B visible after late A and leaves UUID caches separate', async () => {
    await start('late-A');
    await update({ value: 'late-B' });
    await settle(1, { 'late-B': 2 });
    await settle(0, { 'late-A': 7 });
    expect(wrapper.text()).toContain('2');
    expect(wrapper.text()).not.toContain('7');
    await expect(attachmentStore.fetchCountInBatch({ attachmentUUID: 'late-A' })).resolves.toBe(7);
    await expect(attachmentStore.fetchCountInBatch({ attachmentUUID: 'late-B' })).resolves.toBe(2);
  });

  it('preserves controlled zero while a real batch is pending', async () => {
    await start('controlled-A');
    await update({ count: 0 });
    await settle(0, { 'controlled-A': 7 });
    expect(wrapper.find(Attachment).instance().count).toBe(0);
    expect(wrapper.text()).not.toContain('7');
    expect(batchFetchCount).toHaveBeenCalledTimes(1);
  });

  it('keeps rejection observable at the store and allows a fresh retry', async () => {
    const failure = new Error('real batch failure');
    const promise = attachmentStore.fetchCountInBatch({ attachmentUUID: 'retry-A' });
    const rejected = promise.catch(error => error);
    await batch();
    await settle(0, failure, true);
    expect(await rejected).toBe(failure);
    await start('retry-A');
    expect(batchFetchCount).toHaveBeenCalledTimes(2);
    await settle(1, { 'retry-A': 3 });
    expect(wrapper.text()).toContain('3');
  });

  it.each([false, true])('routes standalone local loaders with global configured=%s', async global => {
    const local = jest.fn(uuids => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, 7]))));
    configure({ attachment: { ...original, batchFetchCount: global ? batchFetchCount : undefined } }, null);
    act(() => {
      wrapper = mount(<ConfigProvider attachment={{ batchFetchCount: local }}><Attachment value="local" readOnly viewMode="popup" sortable={false} /></ConfigProvider>);
    });
    await batch();
    expect(local).toHaveBeenCalledTimes(1);
    expect(batchFetchCount).not.toHaveBeenCalled();
    expect(wrapper.find(Attachment).instance().count).toBe(7);
  });

  it('keeps simultaneous Providers and public/private caches and delete updates separate', async () => {
    const first = jest.fn((uuids, { isPublic }) => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, isPublic ? 7 : 2]))));
    const second = jest.fn(uuids => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, 4]))));
    const render = () => <div>
      <ConfigProvider attachment={{ batchFetchCount: first }}>
        <Attachment value="same" isPublic readOnly viewMode="popup" sortable={false} />
        <Attachment value="same" isPublic={false} readOnly viewMode="popup" sortable={false} />
      </ConfigProvider>
      <ConfigProvider attachment={{ batchFetchCount: second }}><Attachment value="same" isPublic readOnly viewMode="popup" sortable={false} /></ConfigProvider>
    </div>;
    act(() => { wrapper = mount(render()); });
    await batch();
    const instances = wrapper.find(Attachment).map(node => node.instance());
    expect(instances.map(instance => instance.count)).toEqual([7, 2, 4]);
    act(() => {
      instances[0].attachments = [new AttachmentFile({ uid: 'a' }), new AttachmentFile({ uid: 'b' })];
      instances[0].removeAttachment(instances[0].attachments[0]);
    });
    wrapper.unmount();
    act(() => { wrapper = mount(render()); });
    await batch();
    expect(wrapper.find(Attachment).map(node => node.instance().count)).toEqual([1, 2, 4]);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
    expect(batchFetchCount).not.toHaveBeenCalled();
  });

  it('preserves Field DataSet routing over surrounding Provider and scopes component updates to that Field', async () => {
    const local = jest.fn(uuids => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, 7]))));
    const provider = jest.fn(uuids => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, 2]))));
    const dataSet = new DataSet({ fields: [{ name: 'files', type: 'attachment' }], data: [{ files: 'field' }] }, {
      getConfig: key => key === 'attachment' ? { ...original, batchFetchCount: local } : getConfig(key),
    });
    act(() => {
      wrapper = mount(<ConfigProvider attachment={{ batchFetchCount: provider }}><Attachment dataSet={dataSet} name="files" readOnly viewMode="popup" sortable={false} /></ConfigProvider>);
    });
    await batch();
    const instance = wrapper.find(Attachment).instance();
    expect(instance.count).toBe(7);
    act(() => {
      instance.attachments = [new AttachmentFile({ uid: 'a' })];
      instance.updateCacheCount();
    });
    await expect(attachmentStore.fetchCountInBatch({ attachmentUUID: 'field' }, dataSet.getField('files'))).resolves.toBe(1);
    expect(local).toHaveBeenCalledTimes(1);
    expect(provider).not.toHaveBeenCalled();
    expect(batchFetchCount).not.toHaveBeenCalled();
  });

  it('updates the local temporary UUID scope through the upload success path before committing its value', async () => {
    const local = jest.fn(uuids => Promise.resolve(Object.fromEntries(uuids.map(uuid => [uuid, 7]))));
    act(() => {
      wrapper = mount(<ConfigProvider attachment={{ batchFetchCount: local }}><Attachment viewMode="popup" sortable={false} /></ConfigProvider>);
    });
    const instance = wrapper.find(Attachment).instance();
    const file = new AttachmentFile({ uid: 'uploaded', status: 'success' });
    act(() => {
      instance.tempAttachmentUUID = 'new-uuid';
      instance.attachments = [file];
      instance.uploader = { setProps: jest.fn(), upload: jest.fn(() => Promise.resolve(true)) };
    });
    await act(async () => { await instance.upload(file); });
    expect(instance.getValue()).toBe('new-uuid');
    expect(instance.tempAttachmentUUID).toBeUndefined();
    await expect(attachmentStore.fetchCountInBatch({ attachmentUUID: 'new-uuid' }, undefined, local)).resolves.toBe(1);
    expect(local).not.toHaveBeenCalled();
    expect(batchFetchCount).not.toHaveBeenCalled();
  });

  it('does not invoke any Provider loader for controlled zero', async () => {
    const local = jest.fn();
    act(() => {
      wrapper = mount(<ConfigProvider attachment={{ batchFetchCount: local }}><Attachment value="zero" count={0} readOnly viewMode="popup" sortable={false} /></ConfigProvider>);
    });
    await batch();
    expect(wrapper.find(Attachment).instance().count).toBe(0);
    expect(local).not.toHaveBeenCalled();
    expect(batchFetchCount).not.toHaveBeenCalled();
  });
});
