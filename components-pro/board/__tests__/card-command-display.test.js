import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { observable, runInAction } from 'mobx';
import CardCommand from '../CardCommand';
import DataSet from '../../data-set';
import Button from '../../button';
import Dropdown from '../../dropdown';
import { ViewMode } from '../enum';

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

describe('CardCommand display lifecycle', () => {
  let wrapper;
  const mountCommand = async props => {
    const dataSet = new DataSet({ data: [{ name: 'first' }, { name: 'second' }] });
    await act(async () => {
      wrapper = mount(<CardCommand prefixCls="card" buttonDisplay="limit" dataSet={dataSet} record={dataSet.get(0)} {...props} />);
    });
    wrapper.update();
    return dataSet;
  };
  afterEach(() => {
    if (wrapper) wrapper.unmount();
    wrapper = undefined;
  });

  it('updates visible commands after observable record and render props change', async () => {
    const command = ({ record }) => [{ children: record.get('name') }];
    const dataSet = await mountCommand({ command });
    expect(wrapper.text()).toContain('first');
    await act(async () => { runInAction(() => dataSet.get(0).set('name', 'edited')); });
    wrapper.update();
    expect(wrapper.text()).toContain('edited');
    await act(async () => { wrapper.setProps({ record: dataSet.get(1), prefixCls: 'updated' }); });
    wrapper.update();
    expect(wrapper.text()).toContain('second');
    expect(wrapper.find('button.updated-command')).toHaveLength(1);
    await act(async () => { wrapper.setProps({ command: undefined }); });
    wrapper.update();
    expect(wrapper.find(Button)).toHaveLength(0);
  });

  it.each(['limit', 'more'])('handles missing and async undefined commands in %s mode', async buttonDisplay => {
    await mountCommand({ buttonDisplay });
    expect(wrapper.find(Button)).toHaveLength(0);
    const pending = deferred();
    await act(async () => { wrapper.setProps({ renderCommand: () => pending.promise }); });
    expect(wrapper.find(Button)).toHaveLength(0);
    await act(async () => { pending.resolve(undefined); });
    wrapper.update();
    expect(wrapper.find(Button)).toHaveLength(0);
    await act(async () => { wrapper.setProps({ renderCommand: () => [{ children: 'restored' }] }); });
    wrapper.update();
    expect(wrapper.find(Button).length).toBeGreaterThan(0);
    await act(async () => { wrapper.setProps({ renderCommand: () => undefined }); });
    wrapper.update();
    expect(wrapper.find(Button)).toHaveLength(0);
  });

  it('renders the latest viewMode result rather than only recomputing it', async () => {
    const renderCommand = ({ viewMode }) => [{ children: viewMode }];
    await mountCommand({ command: [], renderCommand, viewMode: ViewMode.card });
    expect(wrapper.text()).toContain(ViewMode.card);
    await act(async () => { wrapper.setProps({ viewMode: ViewMode.kanban }); });
    wrapper.update();
    expect(wrapper.text()).toContain(ViewMode.kanban);
  });

  it.each(['array', 'function', 'renderCommand'])('tracks push and splice on the same %s observable result', async kind => {
    const commands = observable([{ children: 'one' }]);
    const props = kind === 'renderCommand' ? { renderCommand: () => commands } : {
      command: kind === 'function' ? () => commands : commands,
    };
    await mountCommand({ ...props, commandsLimit: 3 });
    expect(wrapper.find('button.card-command').map(button => button.text())).toEqual(['one']);
    await act(async () => { runInAction(() => commands.push({ children: 'two' })); });
    wrapper.update();
    expect(wrapper.find('button.card-command').map(button => button.text())).toEqual(['one', 'two']);
    await act(async () => { runInAction(() => commands.splice(0, 1, { children: 'replacement' })); });
    wrapper.update();
    expect(wrapper.find('button.card-command').map(button => button.text())).toEqual(['replacement', 'two']);
    await act(async () => { runInAction(() => commands.splice(0)); });
    wrapper.update();
    expect(wrapper.find('button')).toHaveLength(0);
  });

  it.each(['object', 'tuple'])('tracks disabled changes on the same observable %s button', async kind => {
    const buttonProps = observable({ children: 'action', disabled: false });
    const commands = observable([kind === 'tuple' ? ['delete', buttonProps] : buttonProps]);
    await mountCommand({ command: commands });
    expect(wrapper.find('button.card-command').prop('disabled')).toBe(false);
    await act(async () => { runInAction(() => { buttonProps.disabled = true; }); });
    wrapper.update();
    expect(wrapper.find('button.card-command').prop('disabled')).toBe(true);
    await act(async () => { runInAction(() => { buttonProps.disabled = false; }); });
    wrapper.update();
    expect(wrapper.find('button.card-command').prop('disabled')).toBe(false);
  });

  it('tracks observable async result contents without resolving the promise again', async () => {
    const pending = deferred();
    const commands = observable([{ children: 'resolved', disabled: false }]);
    const renderCommand = jest.fn(() => pending.promise);
    await mountCommand({ renderCommand, commandsLimit: 3 });
    await act(async () => { pending.resolve(commands); });
    wrapper.update();
    expect(wrapper.find('button.card-command').text()).toBe('resolved');
    await act(async () => {
      runInAction(() => {
        commands[0].children = 'edited';
        commands[0].disabled = true;
        commands.push({ children: 'added' });
      });
    });
    wrapper.update();
    expect(wrapper.find('button.card-command').map(button => button.text())).toEqual(['edited', 'added']);
    expect(wrapper.find('button.card-command').at(0).prop('disabled')).toBe(true);
    await act(async () => { runInAction(() => commands.splice(0, 1)); });
    wrapper.update();
    expect(wrapper.find('button.card-command').map(button => button.text())).toEqual(['added']);
    expect(renderCommand).toHaveBeenCalledTimes(1);
  });

  it.each(['limit', 'more'])('hides resolved commands while the next record promise is pending in %s mode', async buttonDisplay => {
    const first = deferred();
    const second = deferred();
    const command = jest.fn(({ record }) => [{ children: record.get('name') }]);
    const renderCommand = jest.fn(({ record }) => (
      record.get('name') === 'first' ? first.promise : second.promise
    ));
    const dataSet = await mountCommand({ buttonDisplay, command, renderCommand });
    await act(async () => { first.resolve([{ children: 'first action' }]); });
    wrapper.update();
    if (buttonDisplay === 'limit') {
      expect(wrapper.find('button.card-command').text()).toBe('first action');
    } else {
      expect(wrapper.find(Dropdown).prop('overlay')().props.children[0].props.children.props.children).toBe('first action');
    }
    await act(async () => { wrapper.setProps({ record: dataSet.get(1) }); });
    wrapper.update();
    expect(command).toHaveBeenLastCalledWith({ dataSet, record: dataSet.get(1) });
    expect(renderCommand).toHaveBeenLastCalledWith({
      command: [{ children: 'second' }], dataSet, record: dataSet.get(1), viewMode: undefined,
    });
    expect(wrapper.find(Button)).toHaveLength(0);
    expect(wrapper.find(Dropdown)).toHaveLength(0);
    await act(async () => { second.resolve([{ children: 'second action' }]); });
    wrapper.update();
    if (buttonDisplay === 'limit') {
      expect(wrapper.find('button.card-command').text()).toBe('second action');
    } else {
      expect(wrapper.find(Dropdown).prop('overlay')().props.children[0].props.children.props.children).toBe('second action');
    }
    expect(wrapper.text()).not.toContain('first action');
  });

  it('does not let an older async result overwrite newer commands', async () => {
    const older = deferred();
    const newer = deferred();
    await mountCommand({ renderCommand: () => older.promise });
    await act(async () => { wrapper.setProps({ renderCommand: () => newer.promise }); });
    await act(async () => { newer.resolve([{ children: 'newer' }]); });
    wrapper.update();
    expect(wrapper.text()).toContain('newer');
    await act(async () => { older.resolve([{ children: 'older' }]); });
    wrapper.update();
    expect(wrapper.text()).toContain('newer');
    expect(wrapper.text()).not.toContain('older');
  });

  it('ignores a pending result after unmount', async () => {
    const pending = deferred();
    await mountCommand({ renderCommand: () => pending.promise });
    wrapper.unmount();
    wrapper = undefined;
    const error = jest.spyOn(console, 'error');
    try {
      await act(async () => { pending.resolve([{ children: 'late' }]); });
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('deletes the current record from the current DataSet after props change', async () => {
    const first = await mountCommand({ command: ['delete'] });
    const second = new DataSet({ data: [{ name: 'replacement' }] });
    const deleteFirst = jest.spyOn(first, 'delete').mockResolvedValue(true);
    const deleteSecond = jest.spyOn(second, 'delete').mockResolvedValue(true);
    await act(async () => { wrapper.setProps({ dataSet: second, record: second.get(0) }); });
    wrapper.update();
    wrapper.find('button').simulate('click');
    expect(deleteSecond).toHaveBeenCalledWith(second.get(0));
    expect(deleteFirst).not.toHaveBeenCalled();
  });

  it('updates overflow commands when display mode changes with the same items', async () => {
    const command = [{ children: 'one' }, { children: 'two' }];
    const renderCommand = ({ command: commands }) => commands;
    await mountCommand({ command, renderCommand });
    expect(wrapper.find(Dropdown).prop('overlay')().props.children).toHaveLength(1);
    await act(async () => { wrapper.setProps({ buttonDisplay: 'more' }); });
    wrapper.update();
    expect(wrapper.find(Dropdown).prop('overlay')().props.children).toHaveLength(2);
  });
});
