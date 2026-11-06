import { spy } from 'mobx';

export default function observeAction(instance, method) {
  const listener = jest.fn();
  const dispose = spy(event => {
    if (event.type === 'action' && event.object === instance && event.name === method) {
      listener(...event.arguments);
    }
  });
  listener.mockRestore = dispose;
  return listener;
}
