import React from 'react';
import * as ReactDOM from 'react-dom';

import { act as legacyAct } from 'react-dom/test-utils';

export const act = React.act || legacyAct;
const client = ReactDOM.render ? null : require('react-dom/client');

// Exercise the installed observer package; only the browser API is simulated.
export default function intersectionHarness() {
  const original = window.IntersectionObserver;
  const environment = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const observers = [];
  window.IntersectionObserver = class {
    constructor(callback, options) {
      Object.assign(this, options);
      this.observe = jest.fn();
      this.unobserve = jest.fn();
      this.disconnect = jest.fn();
      this.notify = (target, isIntersecting, height = 0) => act(() => callback([{
        target, isIntersecting, intersectionRatio: Number(isIntersecting), boundingClientRect: { height },
      }]));
      observers.push(this);
    }
  };
  const container = document.createElement('div');
  const root = client && client.createRoot(container);
  return {
    container, observers,
    render: element => act(() => {
      if (root) root.render(element);
      else ReactDOM.render(element, container);
    }),
    cleanup: () => {
      act(() => {
        if (root) root.unmount();
        else ReactDOM.unmountComponentAtNode(container);
      });
      window.IntersectionObserver = original;
      global.IS_REACT_ACT_ENVIRONMENT = environment;
    },
  };
}
