import React from 'react';
import * as ReactDOM from 'react-dom';
import Trigger from 'choerodon-ui/lib/rc-components/trigger';
import Animate from 'choerodon-ui/lib/animate';
import AnimateChild from 'choerodon-ui/lib/animate/AnimateChild';

const legacy = React.version.startsWith('16.');
const createRoot = legacy ? null : require('react-dom/client').createRoot;

let container;
let root;
beforeEach(() => {
  container = document.body.appendChild(document.createElement('div'));
  root = createRoot && createRoot(container);
});
afterEach(() => {
  if (root) root.unmount();
  else ReactDOM.unmountComponentAtNode(container);
  container.remove();
});
function render(view) {
  ReactDOM.flushSync(() => { if (root) root.render(view); else ReactDOM.render(view, container); });
}
function fire(node, type) {
  ReactDOM.flushSync(() => node.dispatchEvent(new MouseEvent(type, { bubbles: true })));
}

test.each([true, false])('popup and mask use distinct hosts, destroy=%s', destroy => {
  const trigger = React.createRef();
  const button = React.createRef();
  const mount = jest.fn(() => container);
  const align = jest.fn();
  render(<Trigger ref={trigger} action={['click']} mask destroyPopupOnHide={destroy}
    getPopupContainer={mount} popup={<span>content</span>} popupAlign={{ points: ['tl', 'bl'], overflow: {} }} onPopupAlign={align}>
    <button type="button" ref={button}>open</button>
  </Trigger>);
  fire(button.current, 'click');
  const popup = trigger.current.getPopupDomNode();
  const mask = container.querySelector('.rc-trigger-popup-mask');
  expect(mount).toHaveBeenCalledWith(button.current);
  expect(trigger.current.getRootDomNode()).toBe(button.current);
  expect(popup.previousElementSibling).toBe(mask);
  expect(popup.textContent).toBe('content');
  [popup, button.current].forEach(node => Object.defineProperty(node, 'offsetParent', { value: container }));
  trigger.current.forcePopupAlign();
  expect(align.mock.calls[0][0]).toBe(popup);
  fire(popup.firstChild, 'mousedown');
  fire(button.current, 'mousedown');
  expect(trigger.current.state.popupVisible).toBe(true);
  fire(mask, 'mousedown');
  expect(trigger.current.state.popupVisible).toBe(false);
  expect(trigger.current.getPopupDomNode()).toBe(destroy ? null : popup);
});

const Anchor = React.forwardRef((props, ref) => <button type="button" {...props} ref={ref} />);

test.each([Anchor, React.memo(Anchor)])('forwarded anchor is the popup container target and keeps its ref', Child => {
  const trigger = React.createRef();
  const cleanup = jest.fn();
  const ref = jest.fn(() => (legacy ? undefined : cleanup));
  const mount = jest.fn(() => container);
  render(<Trigger ref={trigger} action={['click']} getPopupContainer={mount} popup={<span>content</span>}>
    <Child ref={ref}>open</Child>
  </Trigger>);
  const button = container.querySelector('button');
  expect(trigger.current.getRootDomNode()).toBe(button);
  fire(button, 'click');
  expect(mount).toHaveBeenCalledWith(button);
  render(null);
  expect(ref.mock.calls).toEqual(legacy ? [[button], [null]] : [[button]]);
  expect(cleanup).toHaveBeenCalledTimes(legacy ? 0 : 1);
});

test('opaque class keeps its instance ref and legacy DOM fallback', () => {
  // The fallback requires a class instance rather than a function component.
  // eslint-disable-next-line react/prefer-stateless-function
  class AnchorClass extends React.Component {
    render() { return <button type="button" />; }
  }
  const trigger = React.createRef();
  const ref = React.createRef();
  render(<Trigger ref={trigger} popup={<span />}><AnchorClass ref={ref} /></Trigger>);
  expect(ref.current).toBeInstanceOf(AnchorClass);
  expect(trigger.current.getRootDomNode()).toBe(legacy ? container.querySelector('button') : null);
});

test('appear attaches separate transition classes to the mask and popup roots', () => {
  const trigger = React.createRef();
  render(<Trigger ref={trigger} mask defaultPopupVisible maskTransitionName="mask-motion"
    popupTransitionName="popup-motion" popup={<span>content</span>} getPopupContainer={() => container}>
    <button type="button">anchor</button>
  </Trigger>);
  const popup = trigger.current.getPopupDomNode();
  expect(popup.classList.contains('popup-motion-appear')).toBe(true);
  expect(popup.previousElementSibling.classList.contains('mask-motion-appear')).toBe(true);
});

test('keyed transitions receive their own elements and finish with AnimateChild instances', () => {
  const appear = jest.fn((node, end) => { end(); });
  const done = jest.fn();
  const ref = jest.fn();
  const cleanup = jest.fn();
  const itemRef = node => { ref(node); return legacy ? undefined : cleanup; };
  render(<Animate component="section" transitionAppear animation={{ appear }} onEnd={done}>
    <i key="a" ref={itemRef} /><b key="b" />
  </Animate>);
  const [a, b] = container.firstChild.children;
  expect(appear.mock.calls.map(([node]) => node)).toEqual([a, b]);
  expect(ref).toHaveBeenCalledWith(a);
  expect(done.mock.calls).toEqual([['a', true, expect.any(AnimateChild)], ['b', true, expect.any(AnimateChild)]]);
  expect(done.mock.calls[0][2]).not.toBe(done.mock.calls[1][2]);
  render(null);
  if (legacy) expect(ref).toHaveBeenCalledWith(null);
  else expect(cleanup).toHaveBeenCalledTimes(1);
});
