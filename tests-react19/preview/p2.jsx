import React, { useState } from 'react';
import DataSet from '../../components-pro/data-set';
import Table from '../../components-pro/table';
import PerformanceTable from '../../components-pro/performance-table';
import { DragDropContext } from '../../components/drag-drop-context';
import '../../components-pro/table/style';
import '../../components-pro/performance-table/style';
import P2ListDrag from './P2ListDrag';

const fields = [{ name: 'name', label: '姓名' }, { name: 'team', label: '团队' }, { name: 'status', label: '状态' }];
const rows = names => names.map((name, index) => ({ id: name, name, team: ['研发', '产品', '设计'][index % 3], status: index % 2 ? '进行中' : '待办' }));
const makeSet = (names, tree) => new DataSet({
  primaryKey: 'id', paging: false, selection: false,
  ...(tree && { idField: 'id', parentField: 'parentId' }),
  fields, data: rows(names),
});
const columns = fields.map(({ name, label }) => ({ title: label, key: name, dataIndex: name, width: 92 }));
const sides = ['source', 'target'];

function TableScenario({ scenario }) {
  const performance = scenario.startsWith('perf');
  const pair = scenario.endsWith('pair');
  const virtual = scenario === 'virtual' || scenario === 'virtual-default';
  const tree = scenario === 'tree';
  const [sets] = useState(() => ({ source: makeSet(virtual ? Array.from({ length: 100 }, (_, i) => `行${i}`) : ['A', 'B', 'C'], tree), target: makeSet(['D', 'E']) }));
  const [data, setData] = useState(() => ({ source: rows(['A', 'B', 'C']), target: rows(['D', 'E']) }));
  const [message, report] = useState('就绪');
  const endPair = ({ source, destination, reason, draggableId }) => {
    report(reason);
    if (!destination) return;
    const from = source.droppableId;
    const to = destination.droppableId;
    if (performance) {
      setData(previous => {
        const next = { source: [...previous.source], target: [...previous.target] };
        next[to].splice(destination.index, 0, next[from].splice(source.index, 1)[0]);
        return next;
      });
    } else if (from === to) {
      sets[from].move(source.index, destination.index);
    } else {
      const record = sets[from].find(r => String(r.key) === draggableId);
      const value = record.toData();
      sets[from].remove(record, true);
      sets[to].create(value, destination.index);
    }
  };
  const tables = <div style={{ display: 'flex', gap: 12 }}>{(pair ? sides : ['source']).map(id => (
    <div key={id} data-side={id} style={{ width: pair ? '48%' : '100%' }}>
      {performance ? <PerformanceTable id={id} rowKey="id" rowDraggable columns={columns} data={data[id]} height={230} customDragDropContenxt={pair} /> :
        <Table id={id} dataSet={sets[id]} rowDraggable customDragDropContenxt={pair}
          mode={tree ? 'tree' : 'list'} virtual={virtual || tree} style={virtual || tree ? { height: 220 } : undefined}
          rowDragRender={scenario === 'virtual' ? { renderClone: ({ key, ...props }) => <Table.TableRow key={key} {...props} className="dragging-row p2-custom-clone" /> } : undefined}
          onDragEndBefore={(_ds, _columns, result) => {
            if (scenario === 'veto') { report(`否决 ${result.destination?.index}`); return false; }
            if (scenario === 'rewrite' && result.destination) return { ...result, destination: { ...result.destination, index: 2 } };
            return undefined;
          }}
          onDragEnd={(ds, _columns, result) => report(tree ? `父节点 ${ds.find(r => r.get('id') === 'A').get('parentId')}` : `${result.reason} ${result.destination?.index}`)}>
          {fields.map(({ name }) => <Table.Column key={name} name={name} width={pair ? 92 : undefined} />)}
        </Table>}
    </div>
  ))}</div>;
  return <>{pair ? <DragDropContext onDragEnd={endPair}>{tables}</DragDropContext> : tables}<output id="p2-result">{message}</output></>;
}

const scenarios = { pro: 'Pro 单表', 'pro-pair': 'Pro 跨表', perf: 'Performance 单表', 'perf-pair': 'Performance 跨表', veto: 'Pro 否决', rewrite: 'Pro 改写', virtual: 'Pro 虚拟行自定义 clone', 'virtual-default': 'Pro 虚拟行默认 clone', tree: 'Pro 树合并' };
export default function P2Demo() {
  const params = new URLSearchParams(window.location.search);
  const [scenario, setScenario] = useState(params.get('scenario') || 'lists');
  return <section id="p2"><h2>P2 拖拽</h2>
    <label>表格场景 <select value={scenario} onChange={e => setScenario(e.target.value)}><option value="lists">列表拖拽</option>{Object.entries(scenarios).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    {scenario === 'lists' ? <P2ListDrag /> : <TableScenario key={scenario} scenario={scenario} />}
  </section>;
}
