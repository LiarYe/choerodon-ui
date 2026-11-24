import React, { useRef, useState } from 'react';
import MenuImpl, { Item } from '../../../../components/rc-components/menu';

interface MenuProps extends React.HTMLAttributes<HTMLUListElement> {
  mode?: 'horizontal' | 'vertical';
  prefixCls?: string;
  overflowedIndicator?: React.ReactNode;
}

interface MenuInstance extends React.Component<MenuProps> {
  scrollToKey(key: string): void;
}

const Menu: new (props: MenuProps) => MenuInstance = MenuImpl;

export default function MenuDemo() {
  const [narrow, setNarrow] = useState(false);
  const [top, setTop] = useState(0);
  const list = useRef<MenuInstance>(null);
  return (
    <section>
      <style>{'.demo-root > .demo-item { display: inline-block; width: 90px; } .demo-root > .demo-overflowed-submenu { display: inline-block; }'}</style>
      <h2>Menu 容器验证</h2>
      <button type="button" onClick={() => setNarrow(!narrow)}>{narrow ? '展开' : '收窄'}</button>
      <div style={{ width: narrow ? 220 : 560, maxWidth: '100%' }}>
        <Menu className="demo-root" prefixCls="demo" mode="horizontal" overflowedIndicator="更多"
          style={{ whiteSpace: 'nowrap', padding: 0, overflow: 'hidden' }}>
          {['首页', '订单', '客户', '报表', '设置'].map(label => (
            <Item key={label} rippleDisabled>{label}</Item>
          ))}
        </Menu>
      </div>
      <button type="button" onClick={() => list.current?.scrollToKey('20')}>滚到第 20 项</button>
      <button type="button" onClick={() => list.current?.scrollToKey('1')}>回到首项</button>
      <p>容器 scrollTop：{top}</p>
      <Menu ref={list} onScroll={e => setTop(e.currentTarget.scrollTop)}
        style={{ height: 120, overflowY: 'auto', border: '1px solid', paddingLeft: 40 }}>
        {Array.from({ length: 20 }, (_, i) => (
          <Item key={i + 1} style={{ height: 32 }} rippleDisabled>菜单项 {i + 1}</Item>
        ))}
      </Menu>
    </section>
  );
}
