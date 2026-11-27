---
order: 0
title:
  zh-CN: 基本使用
  en-US: Basic usage
---

## zh-CN

拖动一行到新位置，松开后表格直接显示新顺序。`onDragEnd` 的第三个参数是排序后的数据。

## en-US

Drag a row to a new position and release it. The table shows the new order immediately and passes the reordered data as the third argument to `onDragEnd`.

````jsx
import '../../../components-pro/performance-table/style/index.less';
import fakeLargeData from '../../../site/theme/mock/performance-data/fakeLargeData.json';
import { Button, PerformanceTable } from 'choerodon-ui/pro';

const { Column, HeaderCell, Cell } = PerformanceTable;

const Table = () => {
  const tableRef = React.createRef();
  const [selectedRowKeys, setSelectedRowKeys] = React.useState([0]);
  const [disabledItem, setDisabledItem] = React.useState('Osbaldo');  

  const columns = [
    {
      title: 'Id',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      resizable: true,
      fixed: true,
    },
    {
      title: '姓',
      dataIndex: 'lastName',
      key: 'lastName',
      width: 150,
    },
    {
      title: '名',
      dataIndex: 'firstName',
      key: 'firstName',
      width: 350,
    },
    {
      title: '城市',
      dataIndex: 'city',
      key: 'city',
      width: 300,
    },
    {
      title: '街道',
      dataIndex: 'street',
      key: 'street',
      width: 300,
    },
    {
      title: '公司',
      dataIndex: 'companyName',
      key: 'companyName',
      width: 500,
    },
  ];

    const rowSelection = {
    selectedRowKeys,
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedRowKeys(selectedRowKeys);
      console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
    },
    getCheckboxProps: rowData => ({
      disabled: rowData.firstName === disabledItem, // Column configuration not to be checked
      name: rowData.firstName,
    }),
    onCell: (rowData) => ({
      disabled: rowData.firstName === disabledItem, // Column 
    }),
    // columnIndex: 99,
    // fixed: false,
  };

  return (
    <div>
      <PerformanceTable
        useMouseBatchChoose
        virtualized
        rowDraggable
        rowKey="id"
        rowSelection={rowSelection}
        shouldUpdateScroll={false}
        customizable
        customizedCode="pre-customized-p"
        columnDraggable
        columnTitleEditable
        columns={columns}
        height={400}
        data={fakeLargeData.slice(0, 50)}
        onDragEnd={(result, _provided, data) => console.log('onDragEnd', result, data)}
        ref={tableRef}
        onRowClick={(data) => {
          console.log(data);
        }}
      />
      <br />
      <Button
        onClick={() => {
          tableRef.current.scrollTop(0);
          setDisabledItem('Fletcher')
        }}
      >
        Scroll top
      </Button>
    </div>
  );
};

ReactDOM.render(<Table />,
  mountNode
);
````
