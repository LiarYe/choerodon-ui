import React, { useState } from 'react';
import Tree from '../../components/tree';
import Menu, { Item } from '../../components/rc-components/menu';
import '../../components/tree/style';
import '../../components/menu/style';

const keys = Array.from({ length: 200 }, (_, i) => String(i + 1));
const treeData = [{ key: 'root', title: '长树', children: keys.map(key => ({ key, title: `节点 ${key}` })) }];

export default function B5Demo() {
  const [height, setHeight] = useState(120);
  const [selected, setSelected] = useState('');
  const tree = React.useRef(/** @type {Tree | null} */ (null));
  const menu = React.useRef(/** @type {Menu | null} */ (null));
  function jump(key) {
    tree.current?.tree.scrollTo({ key });
    menu.current?.scrollToKey(key === 'root' ? '1' : key);
  }
  return (
    <section id="b5">
      <button type="button" onClick={() => setHeight(height === 120 ? 240 : 120)}>切换高度（{height}px）</button>
      <button type="button" onClick={() => jump('200')}>远端</button>
      <button type="button" onClick={() => jump('root')}>返回首行</button>
      <Tree ref={tree} treeData={treeData} defaultExpandAll height={height} />
      <Menu ref={menu} virtual height={height} prefixCls="c7n-menu" mode="inline" onSelect={({ key }) => setSelected(key)}>
        {keys.map(key => <Item key={key}>菜单 {key}</Item>)}
      </Menu>
      <output>菜单选中：{selected}</output>
    </section>
  );
}
