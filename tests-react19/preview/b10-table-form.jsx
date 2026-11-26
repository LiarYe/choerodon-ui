import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, create } from 'mini-store';
import TableRow from '../../components/rc-components/table/TableRow';
import createBodyRow from '../../components/table/createBodyRow';
import createDOMForm from '../../components/rc-components/form/createDOMForm';

const store = create({ selectedRowKeys: [], expandedRowsHeight: {}, fixedColumnsBodyRowsHeight: {} });
const BodyRow = createBodyRow(React.forwardRef(({ children, style }, ref) => <tr ref={ref} style={style}>{children}</tr>));
const rules = [{ required: true }];
function Fields({ form }) {
  const box = React.useRef(null);
  return <><div id="box" ref={box} style={{ height: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
    {['later', 'hidden', 'first'].map((name, index) => <div key={name} style={{ order: 2 - index, paddingTop: 200 }}>
      <input id={name} type={name === 'hidden' ? 'hidden' : 'text'} {...form.getFieldProps(name, { rules })} />
    </div>)}
  </div><button type="button" onClick={() => form.validateFieldsAndScroll({ container: box.current })}>Validate</button></>;
}
const Form = createDOMForm()(Fields);
function App() {
  const [height, setHeight] = React.useState(32);
  const [measured, setMeasured] = React.useState(0);
  React.useLayoutEffect(() => {
    const read = () => setMeasured(store.getState().fixedColumnsBodyRowsHeight.a);
    read();
    return store.subscribe(read);
  }, []);
  return <><p>React {React.version}</p><Provider store={store}><table><tbody><TableRow
    components={{ body: { row: BodyRow, cell: 'td' } }} columns={[{ dataIndex: 'value' }]} record={{ value: 'row' }}
    ancestorKeys={[]} rowKey="a" isAnyColumnsFixed onRow={() => ({ store, style: { height } })}
  /></tbody></table></Provider><output>{measured}</output><button type="button" onClick={() => setHeight(76)}>Resize</button><Form /></>;
}
createRoot(document.getElementById('root')).render(<App />);
