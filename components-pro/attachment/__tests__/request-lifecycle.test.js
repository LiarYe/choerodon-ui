import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import Attachment from '../Attachment';
import ConfigProvider from '../../../components/config-provider';
import DataSet from '../../data-set';
import AttachmentFile from '../../data-set/AttachmentFile';
import attachmentStore from '../../stores/AttachmentStore';
import * as attachmentWarning from '../../../components/_util/warning';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const files = name => [{ uid: name, name: `${name}.txt` }];
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

describe('Attachment request ownership', () => {
  let wrapper;
  let requests;
  let fetchList;
  let fetchCount;
  let onAttachmentsChange;
  let config;

  const render = props => (
    <ConfigProvider attachment={config}>
      <Attachment value="A" readOnly sortable={false} onAttachmentsChange={onAttachmentsChange} {...props} />
    </ConfigProvider>
  );
  const start = async props => {
    act(() => { wrapper = mount(render(props)); });
    await flush();
    return wrapper.find(Attachment).instance();
  };
  const update = async props => {
    act(() => { wrapper.setProps({ children: render(props).props.children }); });
    await flush();
    wrapper.update();
  };
  const settle = async (index, value, reject = false) => {
    await act(async () => {
      requests[index][reject ? 'reject' : 'resolve'](value);
      await Promise.resolve();
    });
    if (wrapper) wrapper.update();
  };

  beforeEach(() => {
    requests = [];
    const request = () => { const task = deferred(); requests.push(task); return task.promise; };
    fetchList = jest.fn(request);
    fetchCount = jest.spyOn(attachmentStore, 'fetchCountInBatch').mockImplementation(request);
    onAttachmentsChange = jest.fn();
    config = { fetchList, batchFetchCount: jest.fn() };
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
    wrapper = undefined;
    jest.restoreAllMocks();
  });

  it('keeps B visible and emits only B when A resolves late', async () => {
    await start();
    await update({ value: 'B' });
    expect(fetchList.mock.calls.map(([p]) => p.attachmentUUID)).toEqual(['A', 'B']);
    await settle(1, files('B'));
    expect(wrapper.text()).toContain('B.txt');
    await settle(0, files('A'));
    expect(wrapper.text()).toContain('B.txt');
    expect(wrapper.text()).not.toContain('A.txt');
    expect(onAttachmentsChange.mock.calls.map(([items]) => items.map(item => item.name))).toEqual([['B.txt']]);
  });

  it('clears a loaded list while the next UUID is pending', async () => {
    await start();
    await settle(0, files('A'));
    await update({ value: 'B' });
    expect(wrapper.text()).not.toContain('A.txt');
    await settle(1, files('B'));
    expect(wrapper.text()).toContain('B.txt');
  });

  it('fetches B count after A count has loaded', async () => {
    await start({ viewMode: 'popup' });
    await settle(0, 7);
    expect(wrapper.text()).toContain('7');
    await update({ value: 'B', viewMode: 'popup' });
    expect(fetchCount.mock.calls.map(([p]) => p.attachmentUUID)).toEqual(['A', 'B']);
    expect(wrapper.text()).not.toContain('7');
    await settle(1, 2);
    expect(wrapper.text()).toContain('2');
    expect(onAttachmentsChange).not.toHaveBeenCalled();
  });

  it('ignores late counts after UUID changes', async () => {
    await start({ viewMode: 'popup' });
    await update({ value: 'B', viewMode: 'popup' });
    await settle(requests.length - 1, 2);
    await settle(0, 7);
    expect(wrapper.text()).toContain('2');
    expect(wrapper.text()).not.toContain('7');
  });

  it.each(['list', 'popup'])('does not write pending %s into a new record or field', async viewMode => {
    const instance = await start({ viewMode });
    const ds = new DataSet({
      fields: [{ name: 'files', type: 'attachment' }, { name: 'other', type: 'attachment' }],
      data: [{ files: 'B', other: 'C' }, { files: 'D', other: 'E' }],
    });
    const record = ds.get(1);
    const field = ds.getField('other');
    field.setAttachments(files('E').map(file => new AttachmentFile(file)), record);
    const nextChange = jest.fn();
    await update({ dataSet: ds, record, name: 'other', value: undefined, viewMode, onAttachmentsChange: nextChange });
    await settle(0, viewMode === 'list' ? files('A') : 7);
    expect(instance.attachments.map(file => file.name)).toEqual(['E.txt']);
    expect(instance.count).toBe(1);
    expect(instance.observableProps.count).not.toBe(7);
    expect(nextChange).not.toHaveBeenCalled();
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    expect(ds.get(0).attachmentCaches).toBeUndefined();
    if (viewMode === 'list') expect(wrapper.text()).toContain('E.txt');
    else expect(wrapper.text()).toContain('1');
  });

  it.each(['list', 'popup'])('rejects an earlier A generation after A to B to A', async viewMode => {
    await start({ viewMode });
    await update({ value: 'B', viewMode });
    await update({ value: 'A', viewMode });
    await settle(2, viewMode === 'list' ? files('latest') : 2);
    await settle(0, viewMode === 'list' ? files('old') : 7);
    await settle(1, viewMode === 'list' ? files('B') : 8);
    expect(wrapper.text()).toContain(viewMode === 'list' ? 'latest.txt' : '2');
    expect(wrapper.text()).not.toContain(viewMode === 'list' ? 'old.txt' : '7');
    expect(onAttachmentsChange).toHaveBeenCalledTimes(viewMode === 'list' ? 1 : 0);
  });

  it.each(['record', 'field'])('invalidates a standalone request on same UUID %s changes', async binding => {
    const ds = new DataSet({
      fields: [{ name: 'files', type: 'attachment' }],
      data: [{ files: 'A' }, { files: 'A' }],
    });
    const initial = { record: ds.get(0), viewMode: 'list' };
    await start(initial);
    const next = binding === 'record' ? { ...initial, record: ds.get(1) } : { ...initial, name: 'files' };
    await update(next);
    await settle(0, files('old'));
    expect(wrapper.text()).not.toContain('old.txt');
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    expect(ds.getField('files').getAttachments(ds.get(0))).toBeUndefined();
    expect(ds.getField('files').getAttachments(ds.get(1))).toBeUndefined();
  });

  it('keeps only the latest list request for the same UUID', async () => {
    const instance = await start();
    act(() => { instance.handleFetchAttachment({ attachmentUUID: 'A' }); });
    await flush();
    await settle(1, files('latest'));
    await settle(0, files('old'));
    expect(wrapper.text()).toContain('latest.txt');
    expect(wrapper.text()).not.toContain('old.txt');
    expect(onAttachmentsChange).toHaveBeenCalledTimes(1);
  });

  it.each(['list', 'popup'])('ignores %s resolution after unmount', async viewMode => {
    const instance = await start({ viewMode });
    const before = instance.observableProps.count;
    wrapper.unmount();
    wrapper = undefined;
    await settle(0, viewMode === 'list' ? files('A') : 7);
    expect(instance.observableProps.attachments).toBeUndefined();
    expect(instance.observableProps.count).toBe(before);
    expect(onAttachmentsChange).not.toHaveBeenCalled();
  });

  it('preserves controlled attachments across UUID changes and pending responses', async () => {
    await start();
    await update({ value: 'B', attachments: files('controlled') });
    onAttachmentsChange.mockClear();
    await settle(0, files('A'));
    expect(wrapper.text()).toContain('controlled.txt');
    expect(wrapper.text()).not.toContain('A.txt');
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    expect(fetchList).toHaveBeenCalledTimes(1);
  });

  it('preserves controlled zero count over a pending response', async () => {
    const instance = await start({ viewMode: 'popup' });
    await update({ value: 'B', viewMode: 'popup', count: 0 });
    await settle(0, 7);
    expect(instance.count).toBe(0);
    expect(wrapper.text()).not.toContain('7');
    expect(fetchCount).toHaveBeenCalledTimes(1);
  });

  it('does not emit a change just for receiving controlled attachments', async () => {
    await start({ attachments: files('controlled') });
    expect(wrapper.text()).toContain('controlled.txt');
    expect(fetchList).not.toHaveBeenCalled();
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    await update({ value: 'B', attachments: [] });
    expect(wrapper.text()).not.toContain('controlled.txt');
    expect(onAttachmentsChange).not.toHaveBeenCalled();
  });

  it.each(['list', 'popup'])('reports internal %s rejection without turning it into success', async viewMode => {
    const errors = jest.spyOn(console, 'error');
    const instance = await start({ viewMode });
    const message = `attachment ${viewMode} diagnostic`;
    await settle(0, new Error(message), true);
    expect(errors.mock.calls.some(args => args.some(value => String(value).includes(message)))).toBe(true);
    expect(instance.count).toBeUndefined();
    expect(instance.attachments).toBeUndefined();
    expect(onAttachmentsChange).not.toHaveBeenCalled();
  });

  it.each(['list', 'popup'])('preserves Field %s rejection after the component consumes it', async viewMode => {
    const ds = new DataSet({ fields: [{ name: 'files', type: 'attachment' }], data: [{ files: 'A' }] });
    const getConfig = ds.getConfig.bind(ds);
    jest.spyOn(ds, 'getConfig').mockImplementation(key => key === 'attachment' ? config : getConfig(key));
    const errors = jest.spyOn(console, 'error');
    await start({ dataSet: ds, name: 'files', value: undefined, viewMode });
    const field = ds.getField('files');
    const promise = viewMode === 'list' ? field.fetchingList : field.fetchingCount;
    const failure = new Error(`bound ${viewMode} failure`);
    const rejected = promise.catch(error => error);
    await settle(0, failure, true);
    expect(await rejected).toBe(failure);
    expect(errors.mock.calls.some(args => args.some(value => String(value).includes(failure.message)))).toBe(true);
    expect(field.getAttachments(ds.current)).toBeUndefined();
    expect(field.getAttachmentCount(ds.current)).toBeUndefined();
    expect(onAttachmentsChange).not.toHaveBeenCalled();
  });

  it('preserves a synchronous Field list loader throw as a rejected promise', async () => {
    const ds = new DataSet({ fields: [{ name: 'files', type: 'attachment' }], data: [{ files: 'A' }] });
    const failure = new Error('sync field list failure');
    const getConfig = ds.getConfig.bind(ds);
    jest.spyOn(ds, 'getConfig').mockImplementation(key => key === 'attachment'
      ? { ...config, fetchList: () => { throw failure; } }
      : getConfig(key));
    await start({ dataSet: ds, name: 'files', value: undefined, viewMode: 'list' });
    const field = ds.getField('files');
    expect(field.fetchingList).toBeDefined();
    await expect(field.fetchingList).rejects.toBe(failure);
    expect(wrapper.find(Attachment).instance().attachments).toBeUndefined();
  });

  it.each(['standalone', 'Field'].reduce((rows, binding) => rows.concat(
    ['list', 'popup'].reduce((modes, viewMode) => modes.concat(
      ['Error', 'string', 'null', 'undefined'].map(kind => [binding, viewMode, kind]),
    ), []),
  ), []))('Q03 preserves %s %s %s rejection across current, stale and unmounted requests', async (binding, viewMode, kind) => {
    const reason = { Error: new Error('Q03 failure'), string: 'Q03 failure', null: null, undefined }[kind];
    const diagnosticWarning = jest.spyOn(attachmentWarning, 'default');
    const originalThen = Promise.prototype.then;
    const diagnosticPromises = new WeakSet();
    const handlerFailures = [];
    const originals = [];
    jest.spyOn(Promise.prototype, 'then').mockImplementation(function observe(onFulfilled, onRejected) {
      const diagnostic = onRejected && onRejected.name === 'reportAttachmentError';
      const next = originalThen.call(this, onFulfilled, onRejected);
      if (diagnostic) {
        originals.push({ promise: this, outcome: originalThen.call(this,
          value => ({ status: 'fulfilled', value }),
          value => ({ status: 'rejected', value })) });
      }
      if (diagnostic || diagnosticPromises.has(this)) {
        diagnosticPromises.add(next);
        originalThen.call(next, undefined, error => { handlerFailures.push(error); });
      }
      return next;
    });
    const ds = binding === 'Field' ? new DataSet({
      fields: [{ name: 'files', type: 'attachment' }], data: [{ files: 'A' }],
    }) : undefined;
    if (ds) {
      const getConfig = ds.getConfig.bind(ds);
      jest.spyOn(ds, 'getConfig').mockImplementation(key => key === 'attachment' ? config : getConfig(key));
    }
    const props = value => ({ viewMode, ...(ds ? { dataSet: ds, name: 'files', value: undefined } : { value }) });
    const settleRange = (from, to, value, reject = false) => requests.slice(from, to).reduce(
      (previous, task, index) => previous.then(() => settle(from + index, value, reject)), Promise.resolve(),
    );
    const change = async value => {
      if (ds) {
        act(() => { ds.current.init('files', value); });
        await flush();
        wrapper.update();
      } else await update(props(value));
    };
    const instance = await start(props('A'));
    const field = ds && ds.getField('files');
    const fieldPromise = field && field[viewMode === 'list' ? 'fetchingList' : 'fetchingCount'];
    const rejected = fieldPromise && originalThen.call(fieldPromise,
      value => ({ status: 'fulfilled', value }), value => ({ status: 'rejected', value }));
    await settle(0, reason, true);
    expect(instance.attachments).toBeUndefined();
    expect(instance.count).toBeUndefined();
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    if (field) {
      expect(await rejected).toEqual({ status: 'rejected', value: reason });
      expect(field[viewMode === 'list' ? 'fetchingList' : 'fetchingCount']).toBe(fieldPromise);
    }
    const retry = requests.length;
    act(() => {
      if (viewMode === 'list') instance.handleFetchAttachment({ attachmentUUID: 'A' });
      else instance.fetchCount();
    });
    await flush();
    expect(requests.length).toBe(retry + 1);
    await settle(retry, viewMode === 'list' ? files('A') : 1);
    expect(instance.count).toBe(1);
    const stale = requests.length;
    await change('B');
    const current = requests.length;
    await change('C');
    const end = requests.length;
    expect(current).toBeGreaterThan(stale);
    expect(end).toBeGreaterThan(current);
    const currentRequest = instance.countRequest;
    await settleRange(stale, current, reason, true);
    expect(instance.countRequest).toBe(currentRequest);
    await settleRange(current, end, viewMode === 'list' ? [...files('C'), ...files('C2'), ...files('C3')] : 3);
    expect(instance.count).toBe(3);
    expect(wrapper.text()).toContain(viewMode === 'list' ? 'C.txt' : '3');
    const last = requests.length;
    await change('D');
    expect(requests.length).toBeGreaterThan(last);
    wrapper.unmount();
    wrapper = undefined;
    const before = [instance.observableProps.attachments, instance.observableProps.count];
    const changes = onAttachmentsChange.mock.calls.length;
    await settleRange(last, requests.length, reason, true);
    expect([instance.observableProps.attachments, instance.observableProps.count]).toEqual(before);
    expect(onAttachmentsChange).toHaveBeenCalledTimes(changes);
    if (field) {
      expect(field.getAttachments(ds.current)).toBeUndefined();
      expect(field.getAttachmentCount(ds.current)).toBeUndefined();
    }
    const outcomes = await Promise.all(originals.map(item => item.outcome));
    expect(outcomes.filter(item => item.status === 'rejected').length).toBeGreaterThanOrEqual(3);
    outcomes.filter(item => item.status === 'rejected').forEach(item => { expect(item.value).toBe(reason); });
    expect(handlerFailures).toEqual([]);
    const message = reason instanceof Error ? reason.message : String(reason);
    expect(diagnosticWarning).toHaveBeenCalledWith(false, message);
    expect(instance.countRequest).toBeUndefined();
  });

  it.each(['list', 'popup'])('handles current, stale and unmounted %s rejections', async viewMode => {
    await start({ viewMode });
    await settle(0, new Error('current failure'), true);
    await update({ value: 'B', viewMode });
    const stale = requests.length - 1;
    await update({ value: 'C', viewMode });
    const current = requests.length - 1;
    await settle(stale, new Error('stale failure'), true);
    await settle(current, viewMode === 'list' ? files('C') : 3);
    expect(wrapper.text()).toContain(viewMode === 'list' ? 'C.txt' : '3');
    await update({ value: 'D', viewMode });
    const last = requests.length - 1;
    wrapper.unmount();
    wrapper = undefined;
    await settle(last, new Error('unmounted failure'), true);
    expect(onAttachmentsChange).toHaveBeenCalledTimes(viewMode === 'list' ? 1 : 0);
  });
});
