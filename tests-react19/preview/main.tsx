import React from 'react';
import { createRoot } from 'react-dom/client';
import AvatarDemo from './components/avatar';
import IconDemo from './components/icon';

import MenuDemo from './components/menu';

import B5Demo from './b5';

import B6Demo from './b6';

const pages = [
  { hash: '#/b6', title: 'B6 Carousel 轮播', Demo: B6Demo },
  { hash: '#/b5', title: 'B5 Tree / Menu 虚拟布局', Demo: B5Demo },
  { hash: '#/components/menu', title: 'Menu 容器', Demo: MenuDemo },
  { hash: '#/components/avatar', title: 'Avatar 头像', Demo: AvatarDemo },
  { hash: '#/components/icon', title: 'Icon 图标', Demo: IconDemo },
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
      {page ? <page.Demo /> : hash && hash !== '#/' ? <p>未找到该示例。</p> : null}
    </main>
  );
}

const root = createRoot(document.getElementById('root')!);
function render() {
  root.render(<Preview hash={window.location.hash} />);
}
window.addEventListener('hashchange', render);
render();
