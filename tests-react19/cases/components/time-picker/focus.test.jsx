import React from 'react';
import * as ReactDOM from 'react-dom';
import moment from 'moment';
import Panel from 'choerodon-ui/lib/rc-components/time-picker/Panel';

const createRoot = React.version.startsWith('16.') ? null : require('react-dom/client').createRoot;

test('focuses and selects the formatted panel input on the next frame', async () => {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot && createRoot(container);
  try {
    const panel = <Panel focusOnOpen format="HH:mm:ss" value={moment('12:34:56', 'HH:mm:ss')} />;
    ReactDOM.flushSync(() => (root ? root.render(panel) : ReactDOM.render(panel, container)));
    const input = container.querySelector('input');
    expect(input.value).toBe('12:34:56');
    expect(document.activeElement).not.toBe(input);
    await new Promise(resolve => { (window.requestAnimationFrame || window.setTimeout)(resolve); });
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
  } finally {
    if (root) root.unmount();
    else ReactDOM.unmountComponentAtNode(container);
    container.remove();
  }
});
