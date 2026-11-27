---
category: Components
subtitle: 拖拽上下文
cols: 1
type: Other
title: DragDropContext
---

单表行排序只需开启 `rowDraggable`。需要在两个 Pro Table 或两个 PerformanceTable 之间移动行时，用同一个 `DragDropContext` 包裹两张表，使两边的行和放置区域属于同一次拖拽。请从 `choerodon-ui` 导入，不要与底层拖拽库的 Provider 混用。

## 使用

```jsx
import { DragDropContext } from 'choerodon-ui';
import { Table } from 'choerodon-ui/pro';

const LinkedTables = ({ leftProps, rightProps, onDragEnd }) => (
  <DragDropContext onDragEnd={onDragEnd}>
    <Table {...leftProps} id="left" rowDraggable customDragDropContenxt />
    <Table {...rightProps} id="right" rowDraggable customDragDropContenxt />
  </DragDropContext>
);
```

两张表的 `id` 必须不同。`onDragEnd` 根据 `source` 和 `destination` 中的 `droppableId` 与 `index` 更新对应表的数据；取消拖拽或未命中目标时不移动记录。完整示例见 [Pro Table 多表拖拽](/components-pro/table/#components-pro-table-demo-multi-table-drag) 和 [PerformanceTable 多表拖拽](/components-pro/performance-table/#components-pro-performance-table-demo-multi-table-drag)。

## API

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| children | 参与同一次拖拽的组件 | ReactNode | - |
| onDragStart | 开始拖拽时调用 | (start: DragStart, provided: ResponderProvided) => void | - |
| onDragUpdate | 拖拽目标或位置变化时调用 | (update: DragUpdate, provided: ResponderProvided) => void | - |
| onDragEnd | 拖拽结束或取消时调用，必填 | (result: DropResult, provided: ResponderProvided) => void | - |
