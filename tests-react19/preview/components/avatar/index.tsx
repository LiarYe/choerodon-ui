import { useState } from 'react';
import Avatar from '../../../../components/avatar';
import '../../../../components/avatar/style';

export default function AvatarDemo() {
  const [shape, setShape] = useState<'circle' | 'square'>('circle');
  const isCircle = shape === 'circle';

  return (
    <section aria-labelledby="avatar-title">
      <h2 id="avatar-title">Avatar 头像</h2>
      <p>切换头像形状，观察内部的人像图标是否保持显示。</p>
      <Avatar icon="person" size={64} shape={shape} />
      <p role="status">当前形状：{isCircle ? '圆形' : '方形'}</p>
      <button type="button" onClick={() => setShape(isCircle ? 'square' : 'circle')}>
        {isCircle ? '切换为方形' : '切换为圆形'}
      </button>
    </section>
  );
}
