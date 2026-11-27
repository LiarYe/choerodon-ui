---
category: Pro Components
type: Data Display
title: Board
subtitle: 看板
---

多视图切换查看。

## 何时使用


基于表格默认视图，结合后端接口实现多视图切换查看。

## API

### Board

| 参数                  | 说明                                                                                                                                                                                                                           | 类型                                                                                                   | 默认值   | 版本   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------- | ----- |
| viewVisible | 控制组件视图渲染, 对应视图 false 视图新建和切换被隐藏 | \{ card: boolean, kanban: boolean, table: boolean\} \| boolean | true | 1.6.1 |
| renderCommand | 渲染操作按钮 | ({ command, viewMode, record, dataSet }) => command |  | 1.6.1 |
| onConfigChange | 配置切换事件 | (props) => void |  | 1.6.1 |
| cardProps | 卡片配置 |  |  | 1.6.1 |
| tableProps | 表格配置 |  |  | 1.6.1 |
| kanbanProps | Kanban view options. See the drag-and-drop options below. | KanbanProps | | 1.6.1 |

### kanbanProps

| Property | Description | Type |
| --- | --- | --- |
| droppableProps | Configure a column's drop area. | `Partial<DroppableProps> \| ((args: { columnDS: DataSet; dataSet: DataSet }) => Partial<DroppableProps>)` |
| draggableProps | Configure the draggable cards in a column. | `Partial<DraggableProps> \| ((args: { columnDS: DataSet; dataSet: DataSet }) => Partial<DraggableProps>)` |
| dragDropContext | Configure the Kanban drag context. Board supplies its children. | `Omit<DragDropContextProps, 'children'> \| ((args: { kanbanDS: DataSet; dataSet: DataSet }) => Omit<DragDropContextProps, 'children'>)` |

更多属性请参考 [Table](/zh/procmp/data-display/table#API)。
更多个性化存储实例请参考 [Table#用户个性化](/zh/procmp/data-display/table#用户个性化)。
