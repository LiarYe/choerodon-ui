import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { DragDropContext } from 'react-beautiful-dnd';
import Column from '../../components-pro/board/Column';
import KanbanColumn from '../../components-pro/board/KanbanColumn';
import BoardContext from '../../components-pro/board/BoardContext';
import DataSet from '../../components-pro/data-set';
import '../../components-pro/board/style/index.less';

const fields = [{ name: 'title', type: 'string', label: 'Title' }];
const context = {
  displayFields: fields,
  dataSet: new DataSet({ fields, paging: false }),
  customizedDS: new DataSet({ data: [{ dataJson: { displayFields: ['title'], viewHeight: 240 } }] }),
};
const kanbanDS = new DataSet();
const quotes = Array.from({ length: 100 }, (_, i) => ({ title: `Card ${i + 1}` }));
const emptyQuotes = [];
const prefixCls = 'c7n-pro-board';
const kanbanProps = { prefixCls, groupingBy: 'status', kanbanDS, kanbanProps: {}, style: { width: '40vw', flexShrink: 0 } };

function B7() {
  const [result, setResult] = useState('');
  return (
    <BoardContext.Provider value={context}>
      <p>React {React.version}</p>
      <DragDropContext onDragEnd={({ source, destination }) => setResult(`${source.droppableId} → ${destination?.droppableId}`)}>
        <div style={{ display: 'flex' }}>
          <KanbanColumn {...kanbanProps} className="full" columnId="full" header="full" quotes={quotes} />
          <Column className="empty-column" columnId="empty-column" header="empty-column" prefixCls={prefixCls} quotes={emptyQuotes} />
          <KanbanColumn {...kanbanProps} className="empty" columnId="empty" header="empty" quotes={emptyQuotes} />
        </div>
      </DragDropContext>
      <output>{result}</output>
    </BoardContext.Provider>
  );
}

ReactDOM.render(<B7 />, document.getElementById('root'));
