import { useState } from 'react';
import Icon from '../../../../components/icon';
import '../../../../components/icon/style';

export default function IconDemo() {
  const [type, setType] = useState('person');
  return (
    <section aria-labelledby="icon-title">
      <h2 id="icon-title">Icon 图标</h2>
      <Icon type={type} style={{ fontSize: 48 }} />
      <p role="status">当前图标：{type}</p>
      <button type="button" onClick={() => setType(type === 'person' ? 'search' : 'person')}>
        切换图标
      </button>
    </section>
  );
}
