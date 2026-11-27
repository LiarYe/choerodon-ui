import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import List from 'choerodon-ui/lib/list';
import { DragDropContext } from 'choerodon-ui/lib/drag-drop-context';
import DataSet from '../../data-set';
import BoardContext from '../BoardContext';
import CardContent from '../CardContent';
import KanbanContent from '../KanbanContent';

jest.mock('choerodon-ui/lib/list', () => Object.assign(() => null, { Item: 'div' }));
jest.mock('choerodon-ui/lib/drag-drop-context', () => ({ DragDropContext: () => null }));
jest.mock('../../table/query-bar/TableDynamicFilterBar', () => () => null);
jest.mock('../../table/utils', () => ({}));
jest.mock('../../table/interface', () => ({}));
jest.mock('../../output', () => () => null);
jest.mock('../../typography', () => ({}));
jest.mock('../CardCommand', () => () => null);
jest.mock('../KanbanColumn', () => () => null);
jest.mock('../kanban-customization-settings', () => () => null);
jest.mock('../BoardWithContext', () => ({ processFieldProps: () => [] }));

function setup(Content, props) {
  const dataSet = new DataSet();
  const customizedDS = new DataSet({ data: [{ dataJson: {}, cardWidth: 6 }] });
  const context = { dataSet, customizedDS, getConfig: () => ({}) };
  const Host = childProps => (
    <BoardContext.Provider value={context}>
      <Content tableBtns={[]} dataSet={dataSet} {...childProps} />
    </BoardContext.Provider>
  );
  return { wrapper: mount(<Host {...props} />), dataSet };
}

it('shares each measurement with the current card callback without shrinking minHeight', () => {
  const first = jest.fn();
  const next = jest.fn();
  const { wrapper } = setup(CardContent, { cardProps: { onHeightChange: first } });
  const card = () => wrapper.find(List).prop('renderItem')({ record: { id: 1 } }).props.children.props;
  const target = document.createElement('div');
  act(() => { card().onHeightChange(200, 80, target); });
  wrapper.update();
  expect(card().style.minHeight).toBe(81);
  wrapper.setProps({ cardProps: { onHeightChange: next } });
  act(() => { card().onHeightChange(180, 60, target); });
  expect(card().style.minHeight).toBe(81);
  expect(first.mock.calls).toEqual([[200, 80, target]]);
  expect(next.mock.calls).toEqual([[180, 60, target]]);
  wrapper.unmount();
});

it('resolves replacement drag context props against the current datasets', () => {
  const first = jest.fn();
  const next = jest.fn();
  const { wrapper, dataSet } = setup(KanbanContent, { kanbanProps: { dragDropContext: { onDragEnd: first } } });
  expect(wrapper.find(DragDropContext).prop('onDragEnd')).toBe(first);
  const factory = jest.fn(() => ({ onDragEnd: next }));
  wrapper.setProps({ kanbanProps: { dragDropContext: factory } });
  expect(factory).toHaveBeenCalledWith({ kanbanDS: expect.any(DataSet), dataSet });
  expect(wrapper.find(DragDropContext).prop('onDragEnd')).toBe(next);
  wrapper.unmount();
});
