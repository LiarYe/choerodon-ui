import React from 'react';
import ReactDOM from 'react-dom';
import { create, Provider } from 'mini-store';
import ResizeObserver from 'resize-observer-polyfill';
import scrollIntoView from 'dom-scroll-into-view';
import TableRow from 'choerodon-ui/lib/rc-components/table/TableRow';
import createBodyRow from 'choerodon-ui/lib/table/createBodyRow';
import createDOMForm from 'choerodon-ui/lib/rc-components/form/createDOMForm';

jest.mock('dom-scroll-into-view', () => jest.fn());
jest.mock('resize-observer-polyfill', () => jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })));
const modern = parseInt(React.version, 10) >= 19;
// React 16 has no react-dom/client entry point.
// eslint-disable-next-line global-require
const createRoot = modern && require('react-dom/client').createRoot;

function mount(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = modern && createRoot(host);
  const render = value => ReactDOM.flushSync(() => {
    if (root) root.render(value);
    else ReactDOM.render(value, host);
  });
  render(element);
  return { host, render, unmount() {
    if (root) root.unmount();
    else ReactDOM.unmountComponentAtNode(host);
    host.remove();
  } };
}

test('measures the same tr it observes and releases replaced and unmounted rows', () => {
  const store = create({ expandedRowKeys: [], expandedRowsHeight: {}, fixedColumnsBodyRowsHeight: {}, selectedRowKeys: [] });
  const ref = React.createRef();
  class Custom extends React.Component {
    render() {
      const { rowNodeRef, children } = this.props;
      return <tr ref={rowNodeRef}>{children}</tr>;
    }
  }
  const Default = createBodyRow();
  const view = Row => <Provider store={store}><table><tbody><TableRow components={{ body: { row: Row, cell: 'td' } }}
    ancestorKeys={['parent']} expandedRow rowKey="key" columns={[]} isAnyColumnsFixed onRow={() => ({ store, ref })}
  /></tbody></table></Provider>;
  const page = mount(view(Default));
  expect(page.host.querySelector('tr')).toBeNull();
  ReactDOM.flushSync(() => store.setState({ expandedRowKeys: ['parent'] }));
  const observer = () => ResizeObserver.mock.results.slice(-1)[0].value;
  const first = observer();
  expect(first.observe).toHaveBeenCalledWith(page.host.querySelector('tr'));
  page.render(view(Custom));
  expect(ref.current).toBeInstanceOf(Custom);
  expect(first.disconnect).toHaveBeenCalledTimes(1);
  const tr = page.host.querySelector('tr');
  expect(observer().observe).toHaveBeenCalledWith(tr);
  tr.getBoundingClientRect = () => ({ height: 59 });
  ResizeObserver.mock.calls.slice(-1)[0][0]();
  expect(store.getState().expandedRowsHeight.key).toBe(59);
  expect(store.getState().fixedColumnsBodyRowsHeight.key).toBe(59);
  page.unmount();
  expect(observer().disconnect).toHaveBeenCalledTimes(1);
  expect(ref.current).toBeNull();
});

const ForwardRow = React.forwardRef(({ children }, ref) => <tr ref={ref}>{children}</tr>);
const MemoRow = React.memo(ForwardRow);
test.each([ForwardRow, MemoRow, createBodyRow(MemoRow)])('observes the forwarded tr and preserves the public row ref', Row => {
  const store = create({ expandedRowKeys: [], expandedRowsHeight: {}, fixedColumnsBodyRowsHeight: {}, selectedRowKeys: [] });
  const cleanup = jest.fn();
  const ref = jest.fn(() => (modern ? cleanup : undefined));
  const page = mount(<Provider store={store}><table><tbody><TableRow components={{ body: { row: Row, cell: 'td' } }}
    ancestorKeys={[]} rowKey="key" columns={[]} onRow={() => ({ store, ref })}
  /></tbody></table></Provider>);
  const tr = page.host.querySelector('tr');
  const observer = ResizeObserver.mock.results.slice(-1)[0].value;
  expect(observer.observe).toHaveBeenCalledWith(tr);
  const publicValue = ref.mock.calls[0][0];
  if (Row === ForwardRow || Row === MemoRow) expect(publicValue).toBe(tr);
  else expect(publicValue).toBeInstanceOf(Row);
  page.unmount();
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
  expect(ref.mock.calls).toEqual(modern ? [[publicValue]] : [[publicValue], [null]]);
  expect(cleanup).toHaveBeenCalledTimes(modern ? 1 : 0);
});

test('keeps wrapped and decorated instances while scrolling to the upper visible error', () => {
  const outer = React.createRef();
  const original = React.createRef();
  const lowerRef = React.createRef();
  const cleanup = jest.fn();
  const nextRef = jest.fn(() => cleanup);
  class Field extends React.PureComponent {
    render() { return <input />; }
  }
  // In React 16 deliberately supply no explicit DOM access at all.
  if (modern) Field.prototype.getRootDomNode = () => document.querySelector('section input');
  class Fields extends React.PureComponent {
    render() {
      const { form, fieldRef } = this.props;
      const rules = [{ required: true }];
      return <section>{form.getFieldDecorator('upper', { rules })(<Field ref={fieldRef} />)}
        <input {...form.getFieldProps('lower', { rules, ref: lowerRef })} /><input type="hidden" {...form.getFieldProps('hidden', { rules })} />
      </section>;
    }
  }
  const Form = createDOMForm({ withRef: true })(Fields);
  const page = mount(<Form ref={outer} fieldRef={original} />);
  const wrapper = outer.current;
  expect(wrapper.refs.wrappedComponent).toBeInstanceOf(Fields);
  const { form } = wrapper.refs.wrappedComponent.props;
  expect(form.getFieldInstance('upper')).toBe(original.current);
  page.render(<Form ref={outer} fieldRef={nextRef} />);
  expect(original.current).toBeNull();
  expect(nextRef).toHaveBeenCalledWith(form.getFieldInstance('upper'));
  const [upper, lower, hidden] = page.host.querySelectorAll('input');
  expect(lowerRef.current).toBe(lower);
  [upper, lower, hidden].forEach((node, i) => { node.getBoundingClientRect = () => ({ top: [10, 80, 0][i] }); });
  const done = jest.fn();
  ReactDOM.flushSync(() => form.validateFieldsAndScroll({ container: page.host }, done));
  expect(scrollIntoView).toHaveBeenCalledWith(upper, page.host, { onlyScrollIfNeeded: true });
  expect(done.mock.calls[0][0]).toHaveProperty('upper');
  page.unmount();
  expect(wrapper.refs.wrappedComponent).toBeUndefined();
  expect(lowerRef.current).toBeNull();
  if (modern) expect(cleanup).toHaveBeenCalledTimes(1);
  else expect(nextRef).toHaveBeenLastCalledWith(null);
});

test('includes the recovered field in sibling normalization when its input is replaced', () => {
  const normalize = jest.fn((value, previous, allValues) => allValues.A);
  const Fields = ({ form, inputKey }) => (
    <section>
      <input key={inputKey} {...form.getFieldProps('A', { initialValue: 'restored' })} />
      <input {...form.getFieldProps('B', { normalize })} />
    </section>
  );
  const Form = createDOMForm()(Fields);
  const page = mount(<Form inputKey="first" />);
  try {
    normalize.mockClear();
    page.render(<Form inputKey="second" />);
    expect(normalize).toHaveBeenCalledWith(undefined, undefined, expect.objectContaining({ A: 'restored' }));
  } finally {
    page.unmount();
  }
});
