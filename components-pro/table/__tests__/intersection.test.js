import React from 'react';
import { defaultFallbackInView } from 'react-intersection-observer';
import { pxToRem } from 'choerodon-ui/lib/_util/UnitConvertor';
import TableContext from '../TableContext';
import TableVirtualRow from '../TableVirtualRow';
import TableVirtualCell from '../TableVirtualCell';
import TableVirtualHeaderCell from '../TableVirtualHeaderCell';
import intersectionHarness from './intersectionHarness';

jest.mock('mobx-react-lite', () => ({ observer: component => component }));
jest.mock('../TableContext', () => jest.requireActual('react').createContext(null));
jest.mock('../TableStore', () => ({ VIRTUAL_ROOT_MARGIN: 50 }));
function mockTarget({ intersectionRef, id, inView, virtualHeight }) {
  return <div key={id} ref={intersectionRef} data-visible={inView} data-height={virtualHeight} />;
}
jest.mock('../TableRow', () => props => mockTarget(props));
jest.mock('../TableCell', () => props => mockTarget(props));
jest.mock('../TableHeaderCell', () => props => mockTarget(props));

it.each([
  ['row', TableVirtualRow], ['cell', TableVirtualCell], ['header', TableVirtualHeaderCell],
])('%s handles first false, replacement, re-entry and unmount', (kind, Component) => {
  const { render, observers, container, cleanup } = intersectionHarness();
  const body = document.createElement('div');
  const wrapper = document.createElement('div');
  const tableStore = { node: { tableBodyWrap: body, wrapper }, overflowY: true, isRowInView: () => false, columnGroups: { inView: true } };
  const columnGroup = { setInView(value) { this.inView = value; } };
  const mount = id => render(<TableContext.Provider value={{ tableStore }}><Component id={id} index={0} columnGroup={columnGroup} /></TableContext.Provider>);
  const visible = () => kind === 'header' ? columnGroup.inView : container.firstChild.dataset.visible === 'true';
  try {
    mount('first');
    const [first] = observers;
    expect(first.root).toBe(kind === 'header' ? wrapper : body);
    expect(first.rootMargin).toBe(kind === 'header' ? '100px' : '50px');
    expect(visible()).toBe(kind !== 'row');
    const previous = container.firstChild;
    Object.defineProperty(previous, 'offsetParent', { value: body });
    first.notify(previous, false, 39);
    expect(visible()).toBe(false);
    if (kind !== 'header') expect(previous.dataset.height).toBe(String(pxToRem(39, true)));
    expect(first.unobserve).not.toHaveBeenCalled();
    mount('next');
    expect(first.unobserve).toHaveBeenCalledWith(previous);
    const target = container.firstChild;
    const [, next] = observers;
    expect(next.observe).toHaveBeenCalledWith(target);
    expect(target.dataset.height).toBeUndefined();
    next.notify(target, true);
    expect(visible()).toBe(true);
    if (kind === 'row') {
      expect(next.unobserve).toHaveBeenCalledWith(target);
    } else {
      expect(next.unobserve).not.toHaveBeenCalled();
      next.notify(target, false);
      expect(visible()).toBe(false);
    }
    render(null);
    expect(next.unobserve).toHaveBeenCalledTimes(1);
    expect(next.disconnect).toHaveBeenCalledTimes(1);
    if (kind === 'header') expect(columnGroup.inView).toBeUndefined();
  } finally {
    cleanup();
  }
});

it('mounts and unmounts a virtual row with the synchronous observer fallback', () => {
  const { render, container, cleanup } = intersectionHarness();
  const tableStore = { node: {}, isRowInView: () => false, columnGroups: { inView: true } };
  try {
    window.IntersectionObserver = undefined;
    defaultFallbackInView(true);
    render(
      <TableContext.Provider value={{ tableStore }}>
        <TableVirtualRow id="fallback" index={0} />
      </TableContext.Provider>,
    );
    expect(container.firstChild.dataset.visible).toBe('true');

    render(null);
    expect(container.firstChild).toBeNull();
  } finally {
    defaultFallbackInView(undefined);
    cleanup();
  }
});
