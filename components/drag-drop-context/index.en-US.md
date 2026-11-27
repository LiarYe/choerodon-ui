---
category: Components
cols: 1
type: Other
title: DragDropContext
---

For sorting rows within one table, enable `rowDraggable` on the table itself. To move rows between two Pro Tables or two PerformanceTables, wrap both in one `DragDropContext` so their rows and drop areas participate in the same drag. Import it from `choerodon-ui`; do not mix it with a provider from the underlying drag-and-drop library.

## Usage

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

Give each table a distinct `id`. In `onDragEnd`, use the `droppableId` and `index` in `source` and `destination` to update the corresponding table data. Leave the data unchanged if the drag was cancelled or there was no destination. See the cross-table examples for [Pro Table](/components-pro/table/#components-pro-table-demo-multi-table-drag) and [PerformanceTable](/components-pro/performance-table/#components-pro-performance-table-demo-multi-table-drag).

## API

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| children | Components that participate in the same drag | ReactNode | - |
| onDragStart | Called when a drag starts | (start: DragStart, provided: ResponderProvided) => void | - |
| onDragUpdate | Called when the drag target or position changes | (update: DragUpdate, provided: ResponderProvided) => void | - |
| onDragEnd | Called when a drag ends or is cancelled. Required. | (result: DropResult, provided: ResponderProvided) => void | - |
