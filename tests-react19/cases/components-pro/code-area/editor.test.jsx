import React from 'react';
import * as ReactDOM from 'react-dom';
import CodeArea from 'choerodon-ui/pro/lib/code-area';

const legacy = React.version.startsWith('16.');
const act = legacy ? require('react-dom/test-utils').act : React.act;
const createRoot = legacy ? undefined : require('react-dom/client').createRoot;

let container;
let root;

function render(element) {
  act(() => {
    if (legacy) ReactDOM.render(element, container);
    else root.render(element);
  });
}

function unmount() {
  act(() => {
    if (legacy) ReactDOM.unmountComponentAtNode(container);
    else root.unmount();
  });
}

// jsdom does not lay out editor text. Only supply missing Range measurements;
// these tests exercise DOM input/key events, not visual layout, IME or scrolling.
const missing = [];
beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const rect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  for (const [name, value] of Object.entries({ getBoundingClientRect: () => rect, getClientRects: () => [] })) {
    if (!Range.prototype[name]) {
      Object.defineProperty(Range.prototype, name, { value, configurable: true });
      missing.push(name);
    }
  }
});
afterAll(() => missing.forEach(name => { delete Range.prototype[name]; }));

beforeEach(() => {
  jest.useFakeTimers();
  container = document.body.appendChild(document.createElement('div'));
  if (!legacy) root = createRoot(container);
});
afterEach(() => {
  if (container.firstChild) unmount();
  container.remove();
  jest.useRealTimers();
});

function type(input, text) {
  act(() => {
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('publishes the mounted editor, initial value and callable configure continuation', () => {
  const mounted = jest.fn();
  const configured = jest.fn();
  render(<CodeArea value="initial" editorDidMount={mounted} editorDidConfigure={configured} />);
  expect(mounted).toHaveBeenCalledTimes(1);
  const [editor, value, next] = mounted.mock.calls[0];
  expect(editor.getWrapperElement()).toBe(container.querySelector('.CodeMirror'));
  expect(value).toBe('initial');
  expect(editor.getValue()).toBe(value);
  expect(configured).not.toHaveBeenCalled();
  next();
  expect(configured).toHaveBeenCalledWith(editor);
});

test('commits real input and accepts external controlled values on the same editor', () => {
  const mounted = jest.fn();
  const changed = jest.fn();
  const view = value => <CodeArea value={value} editorDidMount={mounted} onChange={changed} valueChangeAction="input" wait={30} />;
  render(view('a'));
  const editor = mounted.mock.calls[0][0];
  editor.setCursor(0, 1);
  type(editor.getInputField(), 'b');
  expect(editor.getValue()).toBe('ab');
  act(() => { jest.advanceTimersByTime(30); });
  expect(changed.mock.calls.map(([value]) => value)).toEqual(['ab']);
  render(view('external'));
  expect(editor.getValue()).toBe('external');
  expect(mounted).toHaveBeenCalledTimes(1);
});

test('commits on blur by default, not while typing', () => {
  const mounted = jest.fn();
  const changed = jest.fn();
  render(<CodeArea defaultValue="" editorDidMount={mounted} onChange={changed} />);
  const input = mounted.mock.calls[0][0].getInputField();
  type(input, 'edited');
  expect(changed).not.toHaveBeenCalled();
  act(() => { input.blur(); jest.advanceTimersByTime(100); });
  expect(changed.mock.calls.map(([value]) => value)).toEqual(['edited']);
});

test('does not commit pending input or refresh after unmounting a focused editor', () => {
  const mounted = jest.fn();
  const changed = jest.fn();
  render(<CodeArea value="" editorDidMount={mounted} onChange={changed} valueChangeAction="input" wait={30} />);
  const editor = mounted.mock.calls[0][0];
  type(editor.getInputField(), '!');
  expect(editor.getValue()).toBe('!');
  expect(changed).not.toHaveBeenCalled();
  unmount();
  // Removing a focused editor may synchronously commit on blur; no delayed
  // input or refresh is allowed to run against the detached editor afterwards.
  const callsAtUnmount = changed.mock.calls.length;
  const refresh = jest.spyOn(editor, 'refresh');
  act(() => { jest.advanceTimersByTime(1100); });
  expect(container.contains(editor.getWrapperElement())).toBe(false);
  expect(changed).toHaveBeenCalledTimes(callsAtUnmount);
  expect(refresh).not.toHaveBeenCalled();
});

test('dispatches Tab and formatter shortcuts through the editor input', () => {
  const mounted = jest.fn();
  const formatter = { getFormatted: value => value.toUpperCase(), getRaw: value => value.toLowerCase() };
  render(<CodeArea defaultValue="abc" options={{ indentUnit: 3 }} formatter={formatter} editorDidMount={mounted} />);
  const editor = mounted.mock.calls[0][0];
  act(() => { editor.getInputField().focus(); });
  editor.setCursor(0, 3);
  const key = (keyCode, altKey = false) => act(() => {
    editor.getInputField().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode, altKey }));
  });
  key(9);
  expect(editor.getValue()).toBe('ABC   ');
  key(82, true);
  expect(editor.getValue()).toBe('abc   ');
  key(70, true);
  expect(editor.getValue()).toBe('ABC   ');
});
