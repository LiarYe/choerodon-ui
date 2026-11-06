import React from 'react';
import { mount } from 'enzyme';
import Upload from '../../upload/Upload';
import Table from '../../table/Table';
import DataSet from '../../data-set';
import FormContext from '../../form/FormContext';

describe('Upload and Table lifecycle regressions', () => {
  it('updates Upload props, context and form registration while preserving file list semantics', () => {
    const context = FormContext._currentValue;
    const firstForm = { addField: jest.fn(), removeField: jest.fn() };
    const nextForm = { addField: jest.fn(), removeField: jest.fn() };
    const makeContext = (prefix, formNode) => ({ ...context, formNode, getProPrefixCls: (suffix, custom) => custom || `${prefix}-${suffix}` });
    const initial = [{ uid: 'initial', name: 'initial.txt' }];
    const upload = <Upload defaultFileList={initial} accept={['.txt']} action="/first" showUploadList={false}>First</Upload>;
    const wrapper = mount(<FormContext.Provider value={makeContext('first', firstForm)}>{upload}</FormContext.Provider>);
    const instance = wrapper.find(Upload).instance();
    try {
      expect(firstForm.addField).toHaveBeenCalledWith(instance);
      expect(wrapper.find('input').prop('accept')).toBe('.txt');
      const files = [{ uid: 'next', name: 'next.txt' }, { uid: 'next', name: 'duplicate.txt' }];
      const updated = React.cloneElement(upload, { accept: ['.pdf'], action: '/next', multiple: true, disabled: true, uploadFileList: files }, 'Next');
      wrapper.setProps({ children: updated });
      expect(wrapper.find('input').prop('accept')).toBe('.pdf');
      expect(wrapper.find('input').prop('action')).toBe('/next');
      expect(wrapper.find('input').prop('multiple')).toBe(true);
      expect(wrapper.find('button').first().prop('disabled')).toBe(true);
      expect(wrapper.text()).toContain('Next');
      expect(instance.fileList.map(file => file.name)).toEqual(['next.txt']);
      wrapper.setProps({ value: makeContext('second', nextForm) });
      expect(wrapper.find('div.second-upload').exists()).toBe(true);
      expect(firstForm.removeField).toHaveBeenCalledWith(instance);
      expect(nextForm.addField).toHaveBeenCalledWith(instance);
      wrapper.setProps({ children: upload });
      expect(wrapper.find('input').prop('accept')).toBe('.txt');
      expect(wrapper.find('input').prop('multiple')).toBe(false);
      expect(wrapper.find('button').first().prop('disabled')).toBe(false);
      expect(instance.fileList.map(file => file.name)).toEqual(['next.txt']);
      wrapper.setProps({ children: React.cloneElement(upload, { uploadFileList: [] }) });
      expect(instance.fileList).toHaveLength(0);
      nextForm.removeField.mockClear();
      wrapper.unmount();
      expect(nextForm.removeField).toHaveBeenCalledTimes(1);
      expect(nextForm.removeField).toHaveBeenCalledWith(instance);
    } finally {
      if (wrapper.exists()) wrapper.unmount();
    }
  });

  it.each([
    [true, false, false],
    [true, false, true],
    [false, true, false],
    [false, true, true],
    [true, true, true],
  ])('rebinds create listeners from expanded=%s to %s with dataset replacement=%s', (initialExpanded, nextExpanded, replace) => {
    const first = new DataSet({ paging: false });
    const next = replace ? new DataSet({ paging: false }) : first;
    const wrapper = mount(<Table dataSet={first} columns={[]} queryBar="none" pagination={false} defaultRowExpanded={initialExpanded} />);
    const instance = wrapper.instance();
    const handler = instance.handleDataSetCreate;
    const listeners = dataSet => (dataSet.events.create || []).filter(([fn]) => fn === handler);
    const expanded = jest.spyOn(instance, 'initDefaultExpandedRows');
    try {
      expect(listeners(first)).toHaveLength(initialExpanded ? 1 : 0);
      wrapper.setProps({ dataSet: next, defaultRowExpanded: nextExpanded });
      expect(listeners(next)).toHaveLength(nextExpanded ? 1 : 0);
      if (replace) expect(listeners(first)).toHaveLength(0);
      expanded.mockClear();
      if (replace) {
        first.create({});
        expect(expanded).not.toHaveBeenCalled();
      }
      const record = next.create({});
      expect(expanded).toHaveBeenCalledTimes(nextExpanded ? 1 : 0);
      if (nextExpanded) expect(expanded).toHaveBeenCalledWith(record);
      wrapper.setProps({ className: 'updated' });
      expect(listeners(next)).toHaveLength(nextExpanded ? 1 : 0);
      wrapper.unmount();
      expect(listeners(first)).toHaveLength(0);
      expect(listeners(next)).toHaveLength(0);
      expanded.mockClear();
      first.create({});
      if (replace) next.create({});
      expect(expanded).not.toHaveBeenCalled();
    } finally {
      if (wrapper.exists()) wrapper.unmount();
      expanded.mockRestore();
    }
  });

  it.each([{ editMode: 'inline' }, { clipboard: { copy: true } }])('preserves independent create subscription for %j', props => {
    const dataSet = new DataSet({ paging: false });
    const wrapper = mount(<Table {...props} dataSet={dataSet} columns={[]} queryBar="none" pagination={false} defaultRowExpanded />);
    const handler = wrapper.instance().handleDataSetCreate;
    const listeners = () => (dataSet.events.create || []).filter(([fn]) => fn === handler);
    try {
      wrapper.setProps({ defaultRowExpanded: false });
      expect(listeners()).toHaveLength(1);
      wrapper.unmount();
      expect(listeners()).toHaveLength(0);
    } finally {
      if (wrapper.exists()) wrapper.unmount();
    }
  });
});
