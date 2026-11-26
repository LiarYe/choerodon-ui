import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Upload from '../../components/rc-components/upload/Upload';
import ColumnResizeHandler from '../../components-pro/performance-table/ColumnResizeHandler';
import PerformanceTable from '../../components-pro/performance-table';
import '../../components-pro/performance-table/style/index.less';

const columns = [{ title: 'Name', dataIndex: 'name', key: 'name', width: 160, resizable: true }];
const data = [{ key: 1, name: 'Sample' }];

// Isolate the handle when the full PerformanceTable cannot mount in the host runtime.
function ResizeFixture() {
  const [width, setWidth] = useState(160);
  return (
    <table style={{ borderSpacing: 0 }}>
      <thead><tr><th style={{ width, position: 'relative' }} scope="col">Name
        <ColumnResizeHandler defaultColumnWidth={width} height={20} onColumnResizeEnd={setWidth}
          style={{ position: 'absolute', top: 0, width: 6 }} />
      </th></tr></thead>
      <tbody><tr><td role="gridcell">Sample</td></tr></tbody>
    </table>
  );
}

const innerStyle = { position: 'relative', width: 41, height: 17 };
const NestedTag = React.forwardRef(({ children, ...props }, ref) => (
  <section {...props} ref={ref}><div style={innerStyle}>{children}</div></section>
));
function OpaqueTag({ children, ...props }) {
  return <section {...props}><div style={innerStyle}>{children}</div></section>;
}

function Preview() {
  const [large, setLarge] = useState(false);
  return (
    <main>
      <p>React {React.version}</p>
      {[NestedTag, OpaqueTag].map((Tag, index) => (
        <Upload key={index === 0 ? 'forwarded' : 'opaque'} component={Tag} style={{
          boxSizing: 'border-box', padding: 3, border: '2px solid', width: large ? 252 : 164, height: large ? 58 : 32,
        }}>Upload</Upload>
      ))}
      <button type="button" onClick={() => setLarge(!large)}>Resize upload</button>
      {window.location.search === '?isolated' ? <ResizeFixture /> : (
        <PerformanceTable columns={columns} data={data} width={500} height={180} />
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Preview />);
