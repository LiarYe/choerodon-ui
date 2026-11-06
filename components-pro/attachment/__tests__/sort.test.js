import React from 'react';
import { mount } from 'enzyme';
import { computed, observable, observe, runInAction } from 'mobx';
import Attachment from '../Attachment';
import AttachmentList from '../AttachmentList';
import AttachmentFile from '../../data-set/AttachmentFile';
import { sortAttachments } from '../utils';

const createFiles = () => [
  new AttachmentFile({ uid: 'b', name: 'b.txt', creationDate: new Date(2000), rank: 2 }),
  new AttachmentFile({ uid: 'a', name: 'a.txt', creationDate: new Date(1000), rank: 1 }),
  new AttachmentFile({ uid: 'c', name: 'c.txt', creationDate: new Date(3000), rank: 3 }),
];

const cases = [
  [{ type: 'name', order: 'asc' }, undefined, ['a', 'b', 'c']],
  [{ type: 'name', order: 'desc' }, undefined, ['c', 'b', 'a']],
  [{ type: 'time', order: 'asc' }, undefined, ['a', 'b', 'c']],
  [{ type: 'time', order: 'desc' }, undefined, ['c', 'b', 'a']],
  [{ type: 'custom', custom: true, order: 'asc' }, 'rank', ['a', 'b', 'c']],
  [{ type: 'custom', custom: true, order: 'desc' }, 'rank', ['c', 'b', 'a']],
];

describe('Attachment derived sorting', () => {
  describe.each(['plain', 'observable'])('%s arrays', kind => {
    it.each(cases)('sorts %j without modifying the source', (sort, orderField, expected) => {
      const files = createFiles();
      const source = kind === 'observable' ? observable.array(files) : files;
      const changes = jest.fn();
      const dispose = kind === 'observable' ? observe(source, changes) : () => {};
      try {
        const result = computed(() => sortAttachments(source, sort, orderField), { keepAlive: true }).get();
        expect(result.map(file => file.uid)).toEqual(expected);
        expect(result).not.toBe(source);
        expect(source.slice()).toEqual(files);
        files.forEach((file, index) => expect(source[index]).toBe(file));
        result.forEach(file => expect(files).toContain(file));
        expect(changes).not.toHaveBeenCalled();
      } finally {
        dispose();
      }
    });

    it('preserves identity when custom sorting has no order field', () => {
      const files = createFiles();
      const source = kind === 'observable' ? observable.array(files) : files;
      ['asc', 'desc'].forEach(order => {
        expect(sortAttachments(source, { type: 'custom', custom: true, order })).toBe(source);
      });
      expect(source.slice()).toEqual(files);
    });
  });

  it.each(cases)('handles empty and missing arrays for %j', (sort, orderField) => {
    expect(sortAttachments(undefined, sort, orderField)).toBeUndefined();
    const source = observable.array([]);
    expect(computed(() => sortAttachments(source, sort, orderField), { keepAlive: true }).get()).toEqual([]);
  });

  it.each(cases)('keeps ties stable for %j', (sort, orderField) => {
    const files = [0, 1, 2].map(uid => new AttachmentFile({
      uid: String(uid), name: 'same.txt', creationDate: new Date(1000), rank: 1,
    }));
    expect(sortAttachments(observable.array(files), sort, orderField)).toEqual(files);
  });

  it('renders and updates observable attachments without reordering their source', () => {
    const files = createFiles();
    const onAttachmentsChange = jest.fn();
    const wrapper = mount(<Attachment value="files" attachments={files} readOnly sortable={false} onAttachmentsChange={onAttachmentsChange} />);
    try {
      const instance = wrapper.instance();
      instance.attachments = observable.array(files);
      onAttachmentsChange.mockClear();
      const source = instance.attachments;
      instance.handleSort({ type: 'name', order: 'asc' });
      wrapper.update();
      expect(wrapper.find(AttachmentList).prop('attachments').map(file => file.uid)).toEqual(['a', 'b', 'c']);
      expect(instance.attachments).toBe(source);
      expect(source.slice()).toEqual(files);
      runInAction(() => { files[0].name = 'z.txt'; });
      wrapper.update();
      expect(wrapper.find(AttachmentList).prop('attachments').map(file => file.uid)).toEqual(['a', 'c', 'b']);
      expect(instance.attachments).toBe(source);
      expect(source.slice()).toEqual(files);
      expect(onAttachmentsChange).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });
});
