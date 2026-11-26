import React, { useState } from 'react';
import Transfer from '../../../../components/transfer';
import '../../../../components/transfer/style';

export const title = 'Transfer 穿梭框';
const data = Array.from({ length: 120 }, (_, i) => ({ key: String(i + 1), title: `行 ${i + 1}` }));

export function TransferList({ id }) {
  const [targetKeys, setTargetKeys] = useState([]);
  return (
    <section id={id}>
      <Transfer dataSource={data} targetKeys={targetKeys} onChange={setTargetKeys}
        showSearch operations={['右移', '左移']} render={item => item.title}
        listStyle={{ width: 240, height: 240 }} />
    </section>
  );
}

export default function TransferDemo() {
  return <><h2>{title}</h2><TransferList id="transfer-demo" /></>;
}
