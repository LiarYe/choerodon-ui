---
order: 12
title:
  zh-CN: 多表拖拽
  en-US: MultiTableDrag
---

## zh-CN

使用 `choerodon-ui` 导出的同一个 `DragDropContext` 包裹两个表格。为每个表格开启 `rowDraggable` 和 `customDragDropContenxt`，并设置不同的 `id` 以区分拖放区域。

## en-US

Wrap both tables in one `DragDropContext` from `choerodon-ui`. Enable `rowDraggable` and `customDragDropContenxt` on each table and give each a distinct `id` to identify its drop area.

````jsx
import '../../../components-pro/performance-table/style/index.less';
import fakeLargeData from '../../../site/theme/mock/performance-data/fakeLargeData.json';
import { Button, PerformanceTable } from 'choerodon-ui/pro';
import { DragDropContext } from 'choerodon-ui';

const { Column, HeaderCell, Cell } = PerformanceTable;

const Table = () => {
  const [sourceData, setSourceData] = React.useState(fakeLargeData.slice(0, 20));
  const [targetData, setTargetData] = React.useState(fakeLargeData.slice(20, 40));

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

  const handleDragEnd = React.useCallback((result) => {
    if (!result.destination) {
      return;
    }
    const { source: { index: sIndex, droppableId: sDroppableId }, destination: { index: dIndex, droppableId: dDroppableId } } = result;
    if (sDroppableId === dDroppableId) {
      let setData;
      if (sDroppableId === 'source') {
        setData = setSourceData;
      }
      if (sDroppableId === 'target') {
        setData = setTargetData;
      }
      setData(data => {
        const temp = [...data];
        const dragData = temp.splice(sIndex, 1)[0];
        temp.splice(dIndex, 0, dragData);
        return temp;
      });
    } else if (sDroppableId === 'source') {
      const tempSourceData = [...sourceData];
      const tempTargetData = [...targetData];
      const dragData = tempSourceData.splice(sIndex, 1)[0];
      tempTargetData.splice(dIndex, 0, dragData);
      setSourceData(tempSourceData);
      setTargetData(tempTargetData);
    } else {
      const tempSourceData = [...sourceData];
      const tempTargetData = [...targetData];
      const dragData = tempTargetData.splice(sIndex, 1)[0];
      tempSourceData.splice(dIndex, 0, dragData);
      setSourceData(tempSourceData);
      setTargetData(tempTargetData);
    }
  }, [sourceData, targetData, setSourceData, setTargetData]);

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <div style={{width: '49%'}}>
            <PerformanceTable
              shouldUpdateScroll={false}
              rowDraggable
              rowKey="id"
              columns={columns}
              height={400}
              data={sourceData}
              customDragDropContenxt
              id="source"
            />
          </div>
          <div style={{width: '49%'}}>
            <PerformanceTable
              shouldUpdateScroll={false}
              rowDraggable
              rowKey="id"
              columns={columns}
              height={400}
              data={targetData}
              customDragDropContenxt
              id="target"
            />
          </div>
        </div>
      </DragDropContext>
    </>
  );
};

ReactDOM.render(<Table />,
  mountNode
);
````
