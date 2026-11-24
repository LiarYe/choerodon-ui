import React from 'react';
import * as ReactDOM from 'react-dom';

// jsdom does not run CSS transitions. Enable rc-motion's feature detection before
// loading Tree, then dispatch the native end event on the actual animated node.
if (!window.AnimationEvent) window.AnimationEvent = window.Event;
if (!window.TransitionEvent) window.TransitionEvent = window.Event;
const NodeList = require('choerodon-ui/lib/rc-components/tree/NodeList').default;
const { TreeContext } = require('choerodon-ui/lib/rc-components/tree/contextTypes');
const { flattenTreeData, convertDataToEntities } = require('choerodon-ui/lib/rc-components/tree/utils/treeUtil');

const legacy = React.version.startsWith('16.');
const act = legacy ? require('react-dom/test-utils').act : React.act;
const createRoot = legacy ? null : require('react-dom/client').createRoot;

const data = [{ key: 'p', title: 'Parent', children: [{ key: 'c', title: 'Child' }] }];

function listFor(expandedKeys, rows = data) {
  const { keyEntities } = convertDataToEntities(rows);
  return { expandedKeys, data: flattenTreeData(rows, expandedKeys), context: { prefixCls: 'rc-tree', keyEntities } };
}
const collapsed = listFor([]);
const expanded = listFor(['p']);

let cleanup;
afterEach(() => cleanup());

function setup({ strict = false } = {}) {
  const container = document.body.appendChild(document.createElement('div'));
  const previousActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const root = legacy ? null : createRoot(container);
  const onEnd = jest.fn();
  const props = { prefixCls: 'rc-tree', selectedKeys: [], checkedKeys: [], halfCheckedKeys: [],
    loadedKeys: [], loadingKeys: [], dragging: false, onListChangeStart: jest.fn(), onListChangeEnd: onEnd };
  const motion = { motionName: 'b4', onAppearActive: jest.fn(), onEnterActive: jest.fn(), onLeaveActive: jest.fn() };
  const render = (list, extra) => act(() => {
    const tree = (
      <TreeContext.Provider value={list.context}>
        <NodeList {...props} {...list.context} data={list.data} expandedKeys={list.expandedKeys} virtual={false} motion={motion} {...extra} />
      </TreeContext.Provider>
    );
    const element = strict ? <React.StrictMode>{tree}</React.StrictMode> : tree;
    if (legacy) ReactDOM.render(element, container);
    else root.render(element);
  });
  const wrapper = () => container.querySelector('.rc-tree-treenode-motion');
  const titles = () => Array.from(container.querySelectorAll('.rc-tree-title'), node => node.textContent);
  const active = async callback => {
    for (let i = 0; i < 30 && !callback.mock.calls.length; i += 1) {
      // Each motion step needs a committed render before the next frame.
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { await new Promise(resolve => { requestAnimationFrame(resolve); }); });
    }
    expect(wrapper()).toBeInstanceOf(HTMLDivElement);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBe(wrapper());
    return wrapper();
  };
  const end = node => act(() => { node.dispatchEvent(new Event('transitionend', { bubbles: true })); });
  cleanup = () => {
    act(() => {
      if (legacy) ReactDOM.unmountComponentAtNode(container);
      else root.unmount();
    });
    global.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    container.remove();
  };
  return { render, container, wrapper, titles, active, motion, end, onEnd };
}

it.each([
  ['normal expansion', 'appear'],
  ['collapse during expansion', 'leave'],
  ['expand during collapse', 'enter'],
])('%s finishes on the motion DOM node', async (_, phase) => {
  const { render, wrapper, titles, active, motion, end, onEnd } = setup();
  render(phase === 'enter' ? expanded : collapsed);
  expect(titles()).toEqual(phase === 'enter' ? ['Parent', 'Child'] : ['Parent']);
  onEnd.mockClear(); // Ignore initial list synchronization.
  render(phase === 'enter' ? collapsed : expanded);
  let node = await active(phase === 'enter' ? motion.onLeaveActive : motion.onAppearActive);
  expect(node.textContent).toContain('Child');
  if (phase !== 'appear') {
    render(phase === 'enter' ? expanded : collapsed);
    node = await active(phase === 'enter' ? motion.onEnterActive : motion.onLeaveActive);
    expect(node.textContent).toContain('Child');
  }
  expect(onEnd).not.toHaveBeenCalled();
  end(node.firstElementChild);
  expect(onEnd).not.toHaveBeenCalled();
  end(node);
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(wrapper()).toBeNull();
  expect(titles()).toEqual(phase === 'leave' ? ['Parent'] : ['Parent', 'Child']);
});

it.each([
  ['expansion', collapsed, expanded, 'onAppearActive', ['Parent'], ['Parent', 'Child']],
  ['collapse', expanded, collapsed, 'onLeaveActive', ['Parent', 'Child'], ['Parent']],
])('root StrictMode %s finishes once', async (_, from, to, phase, before, after) => {
  const { render, wrapper, titles, active, motion, end, onEnd } = setup({ strict: true });
  render(from);
  expect(wrapper()).toBeNull();
  expect(titles()).toEqual(before);
  onEnd.mockClear();
  render(to);
  const node = await active(motion[phase]);
  expect(node.textContent).toContain('Child');
  expect(onEnd).not.toHaveBeenCalled();
  end(node);
  expect(motion[phase]).toHaveBeenCalledTimes(1);
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(wrapper()).toBeNull();
  expect(titles()).toEqual(after);
});

it('keeps the replacement list when an active expansion is discarded', async () => {
  const { render, wrapper, titles, active, motion, end, onEnd } = setup();
  render(collapsed);
  onEnd.mockClear();
  render(expanded);
  const oldNode = await active(motion.onAppearActive);
  await act(async () => {
    render(listFor(expanded.expandedKeys, [{ key: 'new', title: 'Replacement' }]));
  });
  expect(wrapper()).toBeNull();
  expect(titles()).toEqual(['Replacement']);
  expect(onEnd).toHaveBeenCalledTimes(1);
  end(oldNode);
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(titles()).toEqual(['Replacement']);
});

it('updates the focus announcement without rendering non-virtual rows again', () => {
  const { render, container } = setup();
  const title = jest.fn(node => node.key);
  const list = listFor([], [{ key: 'a', title }, { key: 'b', title }]);
  const activeItem = list.data[0];
  render(list, { activeItem, focused: false });
  expect(title).toHaveBeenCalled();
  title.mockClear();
  render(list, { activeItem, focused: true });
  expect(container.querySelector('[aria-live="assertive"]').textContent).toBe('a');
  expect(title).not.toHaveBeenCalled();
});
