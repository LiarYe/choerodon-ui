import React from 'react';
import { createRoot } from 'react-dom/client';
import B5Demo from './b5';
import B6Demo from './b6';

type DemoModule = { default: React.ComponentType; title?: string };
declare const require: { context(dir: string, recursive: boolean, pattern: RegExp): {
  keys(): string[];
  (key: string): DemoModule;
} };
const demos = require.context('./components', true, /^\.\/[^/]+\/index\.[jt]sx$/);
const titles: Record<string, string> = { menu: 'Menu 容器', avatar: 'Avatar 头像', icon: 'Icon 图标' };

const P2Demo = React.lazy(() => import('./p2'));
const pages = [
  { hash: '#/p2', title: 'P2 拖拽', Demo: P2Demo },
  { hash: '#/b6', title: 'B6 Carousel 轮播', Demo: B6Demo },
  { hash: '#/b5', title: 'B5 Tree / Menu 虚拟布局', Demo: B5Demo },
  ...demos.keys().sort().map(key => {
    const slug = key.split('/')[1];
    const { default: Demo, title } = demos(key);
    return { hash: `#/components/${slug}`, title: title || titles[slug] || slug, Demo };
  }),
];

function Preview({ hash }: { hash: string }) {
  const page = pages.find(item => item.hash === hash);
  return (
    <main style={{ maxWidth: 640, margin: '32px auto', padding: '0 16px' }}>
      <h1>组件迁移手测</h1>
      <p>React 运行版本：{React.version}</p>
      <nav aria-label="预览导航">
        <a href="#/">首页</a>
        <ul>
          {pages.map(({ hash: href, title }) => (
            <li key={href}><a href={href} aria-current={href === hash ? 'page' : undefined}>{title}</a></li>
          ))}
        </ul>
      </nav>
      {page ? <React.Suspense fallback="加载中…"><page.Demo /></React.Suspense> : hash && hash !== '#/' ? <p>未找到该示例。</p> : null}
    </main>
  );
}

const root = createRoot(document.getElementById('root')!);
function render() {
  root.render(<Preview hash={window.location.hash} />);
}
window.addEventListener('hashchange', render);
render();
