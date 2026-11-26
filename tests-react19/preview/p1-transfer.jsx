import React from 'react';
import { createRoot } from 'react-dom/client';
import { TransferList as List } from './components/transfer';

createRoot(document.getElementById('root')).render(<main>
  <output>{React.version}</output>
  <List id="near" />
  <div style={{ height: '200vh' }} />
  <List id="far" />
</main>);
