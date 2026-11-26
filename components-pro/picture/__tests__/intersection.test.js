import React from 'react';
import Picture from '../Picture';
import intersectionHarness, { act } from '../../table/__tests__/intersectionHarness';

jest.mock('../../icon', () => () => null);
jest.mock('../../spin', () => () => null);
jest.mock('../../modal/preview', () => jest.fn());

it('loads a lazy Picture only after entering view and releases the observer after load', () => {
  const { container, observers, render, cleanup } = intersectionHarness();
  const image = document.createElement('img');
  const preload = jest.spyOn(window, 'Image').mockImplementation(() => image);
  try {
    render(<Picture lazy src="/lazy.png" />);
    const observer = observers[observers.length - 1];
    const target = container.firstChild;
    expect(observer.observe).toHaveBeenCalledWith(target);
    observer.notify(target, false);
    expect(preload).not.toHaveBeenCalled();
    observer.notify(target, true);
    expect(image.getAttribute('src')).toBe('/lazy.png');
    act(() => { image.dispatchEvent(new Event('load')); });
    expect(container.querySelector('img').getAttribute('src')).toBe('/lazy.png');
    expect(observer.unobserve).toHaveBeenCalledWith(target);
  } finally {
    cleanup();
    preload.mockRestore();
  }
});
