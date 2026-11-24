import { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import Trigger from '../../../../components/trigger/Trigger';

import { Action } from '../../../../components/trigger/enum';

test('resolves nested fragments in DOM order after reorder, removal and empty render', () => {
  const ref = createRef<Trigger>();
  const view = (keys: string[]) => (
    <Trigger ref={ref}><>{keys.map(key => <button key={key} type="button">{key}</button>)}</></Trigger>
  );
  const { container, rerender } = render(view(['a', 'b']));
  const [a, b] = Array.from(container.querySelectorAll('button'));
  expect(ref.current?.getRootDomNode()).toBe(a);
  expect(ref.current?.containsTrigger(b)).toBe(true);
  rerender(view(['b', 'a']));
  expect(ref.current?.getRootDomNode()).toBe(b);
  rerender(view(['a']));
  expect(ref.current?.containsTrigger(b)).toBe(false);
  rerender(view([]));
  expect(ref.current?.getRootDomNode()).toBeNull();
});

test('tracks the returned render-prop root, not just its nested caller', () => {
  const ref = createRef<Trigger>();
  const { container, rerender } = render(
    <Trigger ref={ref}>{caller => <section>{caller(<button type="button" />)}</section>}</Trigger>,
  );
  expect(ref.current?.getRootDomNode()).toBe(container.querySelector('section'));
  rerender(<Trigger ref={ref}>{caller => <>{caller(<button type="button" />)}</>}</Trigger>);
  expect(ref.current?.getRootDomNode()).toBe(container.querySelector('button'));
  const anchor = document.createElement('aside');
  rerender(<Trigger ref={ref} getRootDomNode={() => anchor} />);
  expect(ref.current?.getRootDomNode()).toBeNull();
  expect(ref.current?.containsTrigger(anchor)).toBe(false);
});

test('initial popup uses the native host and closes only on outside mousedown', () => {
  const trigger = createRef<Trigger>();
  const mountPopup = jest.fn(() => document.body);
  const change = jest.fn();
  const mount = () => render(
    <Trigger ref={trigger} action={[Action.click]} defaultPopupHidden={false} getPopupContainer={mountPopup}
      popupContent={<span>popup</span>} onPopupHiddenChange={change}>
      <button type="button">trigger</button>
    </Trigger>,
  );
  const { getByRole, getByText } = (() => {
    try { return mount(); } catch (error) { throw (error as any).errors?.[0] || error; }
  })();
  const host = getByRole('button');
  expect(mountPopup).toHaveBeenCalledWith(host);
  [host, getByText('popup'), document.body].forEach(node => {
    fireEvent.mouseDown(node);
    act(() => { trigger.current?.handleDocumentMouseDown.flush(); });
    if (node !== document.body) expect(change).not.toHaveBeenCalled();
  });
  expect(change).toHaveBeenCalledWith(true);
});
