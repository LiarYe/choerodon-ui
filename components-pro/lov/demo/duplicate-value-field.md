---
order: 7
title:
  zh-CN: 重复值复现
  en-US: Duplicate Value Reproduction
---

## zh-CN

打开多选 LOV，第一页包含两条 `code` 同为 `DUPLICATE` 的记录。重复记录默认禁用，并在首个非内置列显示提示，同时控制台输出警告。本示例仅用于复现，不建议业务数据使用重复值。

## en-US

Open the multiple LOV to see two records whose `code` is `DUPLICATE` on the first page. Duplicate records are disabled by default, with a hint shown in the first non-built-in column and a warning output to the console. This demo is only for reproduction; duplicate values are not recommended in business data.

```jsx
import { DataSet, Lov } from 'choerodon-ui/pro';

const dataSet = new DataSet({
  autoCreate: true,
  fields: [
    {
      name: 'duplicateValue',
      type: 'object',
      label: 'Duplicate value',
      lovCode: 'LOV_DUPLICATE_VALUE',
      multiple: true,
      lovQueryAxiosConfig: (_code, _lovConfig, props) => {
        const { page = 1, pagesize = 2 } = props.params || {};
        return {
          url: `/common/lov/dataset/LOV_DUPLICATE_VALUE/${pagesize}/${page}`,
        };
      },
    },
  ],
});

function App() {
  return (
    [<Lov
      dataSet={dataSet}
      name="duplicateValue"
      viewMode="modal"
      placeholder="Open to see duplicate values on page 1"
    />,
    <Lov
      dataSet={dataSet}
      name="duplicateValue"
      viewMode="modal"
      placeholder="Open to see duplicate values on page 1"
      viewMode="popup"
    />]
  );
}

ReactDOM.render(<App />, mountNode);
```
