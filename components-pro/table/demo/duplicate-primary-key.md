---
order: 31
title:
  zh-CN: 重复主键复现
  en-US: Duplicate Primary Key Reproduction
---

## zh-CN

同一当前页包含两条 `primaryKey='id'` 相同的不同记录。重复记录默认禁用，并在首个非内置列显示提示，同时控制台输出警告。本示例刻意保留原始主键和重复数据，仅用于复现。

## en-US

The current page contains two different records with the same `primaryKey='id'`. Duplicate records are disabled by default, with a hint shown in the first non-built-in column and a warning output to the console. The original keys and duplicate data are intentionally preserved for reproduction only.

```jsx
import { DataSet, Table } from 'choerodon-ui/pro';

const { Column } = Table;

const dataSet = new DataSet({
  primaryKey: 'id',
  paging: false,
  data: [
    { id: 'duplicate-id', name: 'Current page record A', source: 'current-page-a' },
    { id: 'duplicate-id', name: 'Current page record B', source: 'current-page-b' },
    { id: 'unique-id', name: 'Current page record C', source: 'current-page-c' },
  ],
  fields: [
    { name: 'id', type: 'string', label: 'ID' },
    { name: 'name', type: 'string', label: 'Name' },
    { name: 'source', type: 'string', label: 'Source' },
  ],
});

function App() {
  return (
    <Table dataSet={dataSet}>
      <Column name="id" />
      <Column name="name" />
      <Column name="source" />
    </Table>
  );
}

ReactDOM.render(<App />, mountNode);
```
