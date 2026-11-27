import { createRequire } from 'node:module';
import * as candidate from '@hello-pangea/dnd';
import Context, { DragDropContext, Draggable, Droppable } from '../../../components/drag-drop-context';

// Type-check the source exports against the candidate's own declarations.
const source: Pick<typeof candidate, 'DragDropContext' | 'Draggable' | 'Droppable'> = { DragDropContext, Draggable, Droppable };

test('the source entry shares the isolated candidate and its React peers', () => {
  const entry = require.resolve('@hello-pangea/dnd');
  const fromCandidate = createRequire(entry);
  expect(require.resolve('react-beautiful-dnd')).toBe(entry);
  expect(fromCandidate('../package.json').version).toBe('18.0.1');
  for (const peer of ['react', 'react-dom']) {
    expect(fromCandidate.resolve(peer)).toBe(require.resolve(peer));
  }
  expect(Context).toBe(candidate.DragDropContext);
  expect(source.DragDropContext).toBe(candidate.DragDropContext);
  expect(source.Draggable).toBe(candidate.Draggable);
  expect(source.Droppable).toBe(candidate.Droppable);
});
