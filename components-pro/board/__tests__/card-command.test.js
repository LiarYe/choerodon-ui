import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import CardCommand from '../CardCommand';
import { ViewMode } from '../enum';

it.each(['array', 'function'])('recomputes %s commands when only viewMode changes', async kind => {
  const commands = [];
  const command = kind === 'function' ? jest.fn(() => commands) : commands;
  const dataSet = {};
  const record = { id: 1 };
  const renderCommand = jest.fn(() => commands);
  let wrapper;
  await act(async () => {
    wrapper = mount(<CardCommand
      prefixCls="card"
      buttonDisplay="limit"
      record={record}
      dataSet={dataSet}
      command={command}
      renderCommand={renderCommand}
      viewMode={ViewMode.card}
    />);
  });
  try {
    expect(renderCommand).toHaveBeenLastCalledWith({ command: commands, dataSet, record, viewMode: ViewMode.card });
    renderCommand.mockClear();
    await act(async () => {
      wrapper.setProps({ viewMode: ViewMode.kanban });
    });
    expect(renderCommand).toHaveBeenCalledTimes(1);
    expect(renderCommand).toHaveBeenLastCalledWith({ command: commands, dataSet, record, viewMode: ViewMode.kanban });
  } finally {
    wrapper.unmount();
  }
});
