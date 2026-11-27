import React, { useMemo, useState } from 'react';
import Board from '../../components-pro/board';
import { ViewMode } from '../../components-pro/board/enum';
import DataSet from '../../components-pro/data-set';
import Attachment from '../../components-pro/attachment';
import Upload from '../../components/upload';
import Tabs from '../../components/tabs';
import type { DropResult } from '../../components/drag-drop-context';
import '../../components-pro/board/style/index.less';
import '../../components-pro/attachment/style/index.less';
import '../../components-pro/modal/style/index.less';
import '../../components/upload/style/index.less';
import '../../components/tabs/style/index.less';

const names = ['A', 'B', 'C'];

function BoardExample() {
  const [proof, setProof] = useState('');
  const dataSet = useMemo(() => new DataSet({ paging: false, fields: [
    { name: 'title', label: '卡片' },
    { name: 'stage', options: new DataSet({ paging: false, data: [{ value: 'todo', meaning: '待办' }, { value: 'done', meaning: '完成' }] }) },
  ] }), []);
  const kanbanProps = useMemo(() => {
    const drops = new Map<string, DataSet>();
    const drags = new WeakSet<DataSet>();
    function column(args: { dataSet: DataSet; columnDS: DataSet }) {
      if (args.dataSet !== dataSet || !(args.columnDS instanceof DataSet)) throw new Error('Board 列工厂参数错误');
      return args.columnDS;
    }
    return {
      isDragDropDisabled: false,
      allDsProps: { data: [{ stage: 'todo', rows: [{ title: '任务 A' }, { title: '任务 B' }] }, { stage: 'done', rows: [] }] },
      columnDsProps: { dataKey: 'rows' },
      droppableProps(args) {
        const ds = column(args);
        const stage = ds.getQueryParameter('stage');
        drops.set(stage === 'null' ? '_empty' : stage, ds);
        return { type: 'TASK' };
      },
      draggableProps(args) {
        const ds = column(args);
        drags.add(ds);
        return { isDragDisabled: false };
      },
      dragDropContext({ kanbanDS, dataSet: original }) {
        if (original !== dataSet || !(kanbanDS instanceof DataSet) || kanbanDS === original) throw new Error('Board 上下文工厂参数错误');
        return { onDragEnd({ source, destination, draggableId, type }: DropResult) {
          if (!destination) return;
          const from = drops.get(source.droppableId);
          const to = drops.get(destination.droppableId);
          const record = from?.get(source.index);
          const stageOf = (id: string) => id === '_empty' ? undefined : id;
          const sourceGroup = kanbanDS.find(r => r.get('stage') === stageOf(source.droppableId));
          if (type !== 'TASK' || !from || !to || !drags.has(from) || !record || String(record.id) !== draggableId || !sourceGroup) throw new Error('Board 工厂参数与实际拖拽不一致');
          const sourceRows = sourceGroup.get('rows').slice();
          const [card] = sourceRows.splice(source.index, 1);
          if (from === to) {
            sourceRows.splice(destination.index, 0, card);
            sourceGroup.set('rows', sourceRows);
          } else {
            const stage = stageOf(destination.droppableId);
            const targetGroup = kanbanDS.find(r => r.get('stage') === stage);
            const targetRows = targetGroup ? targetGroup.get('rows').slice() : [];
            targetRows.splice(destination.index, 0, { ...card, stage });
            sourceGroup.set('rows', sourceRows);
            if (targetGroup) targetGroup.set('rows', targetRows);
            else kanbanDS.create({ stage, rows: targetRows });
          }
          setProof(`${record.get('title')}: ${source.droppableId} → ${destination.droppableId}`);
        } };
      },
    };
  }, [dataSet]);
  return <section id="p2-board"><h3>Board 跨列</h3>
    <Board dataSet={dataSet} customizedCode="p2-board-drag" customizable autoQuery={false} viewVisible={false}
      defaultViewMode={ViewMode.kanban} defaultViewProps={{ kanban: { groupField: 'stage', cardWidth: 8, viewHeight: 240 } }}
      tableProps={{ dataSet, columns: [{ name: 'title' }] }} kanbanProps={kanbanProps} />
    <output>{proof}</output>
  </section>;
}

export default function P2ListDrag() {
  const uploads = useMemo(() => names.map((name, uid) => ({ uid, name: `上传 ${name}.txt`, type: 'text/plain', size: 1, status: 'done' as const })), []);
  const attachments = useMemo(() => names.map(name => ({ uid: name, name: `附件 ${name}.txt`, type: 'text/plain', size: 1 })), []);
  const [scenario, select] = useState('Upload');
  return <article id="p2-list-drag">
    <h2>列表拖拽 · React {React.version}</h2><p>用鼠标将 Board 卡片拖到另一列，或拖动 Tabs 手柄上下排序。键盘操作：聚焦手柄，按空格拿起，方向键移动，再按空格放下。Tabs 定制需保存。</p>
    <label>列表场景 <select value={scenario} onChange={e => select(e.target.value)}>{['Board', 'Upload', 'Tabs', 'Attachment'].map(s => <option key={s}>{s}</option>)}</select></label>
    {scenario === 'Board' && <BoardExample />}
    {scenario === 'Upload' && <section id="p2-upload"><h3>Upload 排序</h3><Upload dragUploadList defaultFileList={uploads} /></section>}
    {scenario === 'Tabs' && <section id="p2-tabs"><h3>Tabs 定制</h3><Tabs customizable customizedCode="p2-list-drag-tabs" tabDraggable>
      {names.map(name => <Tabs.TabPane key={name} tab={`页签 ${name}`}>内容 {name}</Tabs.TabPane>)}
    </Tabs></section>}
    {scenario === 'Attachment' && <section id="p2-attachment"><h3>Attachment 排序</h3><Attachment sortable defaultValue="p2-attachments" attachments={attachments} /></section>}
  </article>;
}
