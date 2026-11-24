import React, { useRef, useState } from 'react';
import DOMWrapImpl from '../../../../components/rc-components/menu/DOMWrap';
import { MenuItem } from '../../../../components/rc-components/menu/MenuItem';

interface WrapProps extends React.HTMLAttributes<HTMLElement> {
  tag: 'ul' | 'ol';
  level?: number;
  prefixCls?: string;
  mode?: 'horizontal';
}

interface WrapInstance extends React.Component<WrapProps> {
  scrollToKey(key: string): void;
}

const DOMWrap: new (props: WrapProps) => WrapInstance = DOMWrapImpl;

// Only the connected overflow submenu needs the legacy mini-store context (B3).
class PreviewWrap extends DOMWrap {
  getOverflowedSubMenuItem = (key: string, items: React.ReactNode[], placeholder?: boolean) => (
    <li key={`${key}-${placeholder ? 'measure' : 'more'}`} className="demo-overflowed-submenu"
      style={placeholder ? { position: 'absolute', visibility: 'hidden' } : { display: items.length ? 'inline-block' : 'none' }}>
      更多 ({items.length})
    </li>
  );
}

export default function MenuDemo() {
  const [narrow, setNarrow] = useState(false);
  const [top, setTop] = useState(0);
  const list = useRef<WrapInstance>(null);
  return (
    <section>
      <style>{'.demo-root > .demo-item { display: inline-block; width: 90px; }'}</style>
      <h2>DOMWrap 容器验证</h2>
      <button type="button" onClick={() => setNarrow(!narrow)}>{narrow ? '展开' : '收窄'}</button>
      <div style={{ width: narrow ? 220 : 560, maxWidth: '100%' }}>
        <PreviewWrap tag="ul" level={1} className="demo-root" prefixCls="demo" mode="horizontal"
          style={{ whiteSpace: 'nowrap', padding: 0, overflow: 'hidden' }}>
          {['首页', '订单', '客户', '报表', '设置'].map(label => (
            <MenuItem key={label} eventKey={label} rootPrefixCls="demo" rippleDisabled disabled>{label}</MenuItem>
          ))}
        </PreviewWrap>
      </div>
      <button type="button" onClick={() => list.current?.scrollToKey('20')}>滚到第 20 项</button>
      <button type="button" onClick={() => list.current?.scrollToKey('1')}>回到首项</button>
      <p>容器 scrollTop：{top}</p>
      <DOMWrap ref={list} tag="ol" onScroll={(e: React.UIEvent<HTMLElement>) => setTop(e.currentTarget.scrollTop)}
        style={{ height: 120, overflowY: 'auto', border: '1px solid', paddingLeft: 40 }}>
        {Array.from({ length: 20 }, (_, i) => <li key={i + 1} data-menu-key={i + 1} style={{ height: 32 }}>菜单项 {i + 1}</li>)}
      </DOMWrap>
    </section>
  );
}
