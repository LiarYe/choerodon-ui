import React from 'react';
import { mount } from 'enzyme';
import { runInAction } from 'mobx';
import Table from '../Table';
import TableEditor from '../TableEditor';
import DataSet from '../../data-set';
import TextField from '../../text-field';

describe('TableEditor render commits', () => {
  it('preserves a mounted editor and resets an absent non-inline editor only after commit', () => {
    const dataSet = new DataSet({ fields: [{ name: 'name', type: 'string' }], data: [{ name: 'first' }] });
    const wrapper = mount(<Table dataSet={dataSet} columns={[{ name: 'name', editor: () => <TextField /> }]} queryBar="none" pagination={false} />);
    try {
      const editor = wrapper.find(TableEditor).instance();
      runInAction(() => { editor.rendered = true; });
      wrapper.update();
      expect(editor.rendered).toBe(true);
      expect(editor.wrap).not.toBeNull();
      expect(wrapper.find('input').length).toBeGreaterThan(0);
      const originalProps = editor.props;
      editor.props = { ...originalProps, column: { name: 'name', editor: false } };
      expect(editor.render()).toBeNull();
      expect(editor.rendered).toBe(true);
      editor.props = originalProps;
      wrapper.setProps({ pristine: true });
      expect(editor.rendered).toBe(false);
      expect(editor.wrap).toBeNull();
      wrapper.setProps({ pristine: false });
      runInAction(() => { editor.rendered = true; });
      wrapper.update();
      expect(editor.rendered).toBe(true);
      expect(editor.wrap).not.toBeNull();
    } finally {
      wrapper.unmount();
    }
  });

  it('keeps the rendered flag for inline editing when no editor is output', () => {
    const dataSet = new DataSet({ fields: [{ name: 'name' }], data: [{ name: 'first' }] });
    const wrapper = mount(<Table dataSet={dataSet} editMode="inline" columns={[{ name: 'name', editor: () => <TextField /> }]} queryBar="none" pagination={false} />);
    try {
      const editor = wrapper.find(TableEditor).instance();
      runInAction(() => { editor.rendered = true; });
      wrapper.setProps({ pristine: true });
      expect(editor.rendered).toBe(true);
      expect(editor.wrap).toBeNull();
    } finally {
      wrapper.unmount();
    }
  });
});
