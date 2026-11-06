import { autorun, isAction, isObservableProp, observable, runInAction } from 'mobx';
import AttachmentFile from '../AttachmentFile';
import AttachmentFileChunk from '../AttachmentFileChunk';
import isArrayLike from '../../mobx-helper/isArrayLike';
import { LocaleContext } from '../../locale-context/LocaleContext';
import { Lang } from '../../locale-context/enum';
import DataSet from '../DataSet';
import mapToObject from '../../mobx-helper/mapToObject';

describe('MobX 6 initialization', () => {
  it('tracks record changes, selection, creation and reset', () => {
    const dataSet = new DataSet({ fields: [{ name: 'name' }], data: [{ name: 'before' }] });
    const record = dataSet.get(0);
    const values = [];
    const dispose = autorun(() => values.push([dataSet.length, record.get('name'), record.dirty]));
    record.set('name', 'after');
    record.reset();
    dataSet.create({ name: 'second' });
    dispose();
    expect(values).toEqual([[1, 'before', false], [1, 'after', true], [1, 'before', false], [2, 'before', false]]);
    expect(isAction(dataSet.fireEvent)).toBe(true);
    expect(isObservableProp(dataSet, 'records')).toBe(true);
    expect(isObservableProp(record, 'data')).toBe(true);
    expect(isObservableProp(dataSet.getField('name'), 'props')).toBe(true);
  });

  it('preserves shallow map values and special keys', () => {
    const value = {};
    const result = mapToObject(new Map([['value', value], ['__proto__', value]]));
    expect(result.value).toBe(value);
    expect(Object.getOwnPropertyDescriptor(result, '__proto__').value).toBe(value);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it('tracks indexed records and selection after array mutations', () => {
    const dataSet = new DataSet({ data: [{ name: 'first' }, { name: 'second' }] });
    const values = [];
    const dispose = autorun(() => values.push([
      dataSet.records[0].get('name'), dataSet.selected.length,
    ]));
    try {
      dataSet.select(0);
      dataSet.unSelect(0);
      dataSet.reverse();
      expect(values).toEqual([['first', 0], ['first', 1], ['first', 0], ['second', 0]]);
    } finally {
      dispose();
    }
  });

  it('tracks field properties and restores pristine properties', () => {
    const dataSet = new DataSet({ fields: [{ name: 'name', required: false }] });
    const field = dataSet.getField('name');
    const values = [];
    const dispose = autorun(() => values.push(field.get('required')));
    try {
      field.set('required', true);
      expect(field.pristineProps.required).toBe(false);
      field.reset();
      expect(values).toEqual([false, true, false]);
    } finally {
      dispose();
    }
  });

  it.each([false, true])('refreshes computedProps caches after replacement (record: %s)', withRecord => {
    const original = jest.fn();
    const replacement = jest.fn();
    const dataSet = new DataSet({
      fields: [{ name: 'name', label: 'fallback', computedProps: { label: () => {
        original();
        return 'original';
      } } }],
      data: [{ name: 'first' }, { name: 'second' }],
    });
    const field = dataSet.getField('name');
    const records = withRecord ? dataSet.records : [undefined];
    const values = [];
    const dispose = autorun(() => values.push(records.map(record => field.get('label', record))));
    try {
      records.forEach(record => expect(field.get('label', record)).toBe('original'));
      expect(original).toHaveBeenCalledTimes(records.length);
      field.set('computedProps', { label: () => {
        replacement();
        return 'replacement';
      } });
      expect(values[values.length - 1]).toEqual(records.map(() => 'replacement'));
      records.forEach(record => expect(field.get('label', record)).toBe('replacement'));
      expect(replacement).toHaveBeenCalledTimes(records.length);
      field.set('computedProps', {});
      expect(values[values.length - 1]).toEqual(records.map(() => 'fallback'));
      field.set('computedProps', undefined);
      expect(records.map(record => field.get('label', record))).toEqual(records.map(() => 'fallback'));
      field.reset();
      expect(values[values.length - 1]).toEqual(records.map(() => 'original'));
    } finally {
      dispose();
    }
  });

  it('preserves nested tree references and observes child selection', () => {
    const children = [{ id: 2 }];
    const dataSet = new DataSet({
      childrenField: 'children',
      data: [{ id: 1, children }],
    });
    const parent = dataSet.getFromTree(0);
    expect(parent.get('children')).toBe(children);
    expect(parent.children[0].parent).toBe(parent);
    const values = [];
    const dispose = autorun(() => values.push(parent.children[0].isSelected));
    try {
      dataSet.treeSelect(parent);
      dataSet.treeUnSelect(parent);
      expect(values).toEqual([false, true, false]);
    } finally {
      dispose();
    }
  });

  it('clears validation errors after correcting a required field', async () => {
    const dataSet = new DataSet({ fields: [{ name: 'name', required: true }] });
    const record = dataSet.create();
    expect(await record.validate(true, true)).toBe(false);
    expect(record.getValidationErrors()).toHaveLength(1);
    record.set('name', 'valid');
    expect(await record.validate(true, true)).toBe(true);
    expect(record.getValidationErrors()).toHaveLength(0);
  });

  it('preserves attachment defaults and observes optional fields', () => {
    const file = new AttachmentFile({ name: 'Report.PDF', size: 10, uid: 12 });
    expect(file.filename).toBe('Report');
    expect(file.ext).toBe('pdf');
    expect(file.uid).toBe('12');
    expect(new AttachmentFile({}).ext).toBeUndefined();
    ['name', 'size', 'url', 'filename', 'ext', 'status', 'aborted', '$percent', 'error', 'errorMessage', 'invalid'].forEach(key => {
      expect(isObservableProp(file, key)).toBe(true);
    });
    expect(isAction(file.load)).toBe(true);
    const values = [];
    const dispose = autorun(() => values.push([file.percent, file.status]));
    file.percent = 25;
    runInAction(() => { file.status = 'success'; });
    dispose();
    file.percent = 100;
    expect(values).toEqual([[undefined, undefined], [25, undefined], [25, 'success']]);
  });

  it('observes chunk progress without losing constructor values', () => {
    const file = new AttachmentFile({ size: 10 });
    const chunk = new AttachmentFileChunk({ file, start: 0, end: 10, percent: 20 });
    file.chunks = [chunk];
    const values = [];
    const dispose = autorun(() => values.push(file.percent));
    runInAction(() => { chunk.percent = 80; });
    dispose();
    expect(values).toEqual([20, 80]);
    expect(isObservableProp(chunk, 'aborted')).toBe(true);
  });

  it('observes chunks assigned and replaced after subscribing to progress', () => {
    const file = new AttachmentFile({ size: 10 });
    const first = new AttachmentFileChunk({ file, start: 0, end: 10, percent: 20 });
    const second = new AttachmentFileChunk({ file, start: 0, end: 10, percent: 40 });
    const values = [];
    const dispose = autorun(() => values.push(file.percent));
    try {
      file.percent = 10;
      runInAction(() => { file.chunks = [first]; });
      expect(values).toEqual([undefined, 10, 20]);
      runInAction(() => { first.percent = 80; });
      runInAction(() => { file.chunks = [second]; });
      runInAction(() => { first.percent = 90; });
      runInAction(() => { second.percent = 60; });
      runInAction(() => { file.chunks = undefined; });
      expect(values).toEqual([undefined, 10, 20, 80, 40, 60, 10]);
      expect(isObservableProp(file, 'chunks')).toBe(true);
    } finally {
      dispose();
    }
  });

  it('observes locale changes through actions', () => {
    const locale = new LocaleContext();
    const values = [];
    const dispose = autorun(() => values.push(locale.numberFormatLanguage));
    locale.setNumberFormatLanguage(Lang.en_US);
    dispose();
    expect(values).toEqual([undefined, Lang.en_US]);
    expect(isAction(locale.setNumberFormatLanguage)).toBe(true);
  });

  it('recognizes both proxy and legacy observable arrays only', () => {
    expect(isArrayLike([])).toBe(true);
    expect(isArrayLike(observable.array([]))).toBe(true);
    expect(isArrayLike(observable.array([], { proxy: false }))).toBe(true);
    [null, undefined, 'text', { length: 0 }].forEach(value => expect(isArrayLike(value)).toBe(false));
  });
});
