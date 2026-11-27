import React, { cloneElement, isValidElement, ReactNode, Ref, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ResizeObserver from 'resize-observer-polyfill';
import acceptsHostRef from './acceptsHostRef';
import useMergedRef, { elementRef } from './useMergedRef';

interface ResizeObserverProps {
  children?: ReactNode;
  /** Resolve the DOM node after commit for children that do not forward a host ref. */
  getTarget?: () => Element | null | undefined;
  disabled?: boolean;
  onResize?: (width: number, height: number, target: Element | null) => void;
  resizeProp?: 'width' | 'height' | 'both';
  immediately?: boolean;
  boxSize?: 'borderBox' | 'contentBox';
}

const useLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function ReactResizeObserver(props: ResizeObserverProps) {
  const { children, getTarget, disabled, immediately, onResize, resizeProp = 'both', boxSize = 'borderBox' } = props;
  const [node, setNode] = useState<Element | null>(null);
  const child = !getTarget && isValidElement<{ ref?: Ref<Element> }>(children) && acceptsHostRef(children.type) ? children : null;
  const original = child && elementRef(child);
  const ref = useMergedRef<Element>(setNode, original);
  const latest = useRef({ onResize, resizeProp, boxSize });
  const active = useRef<{ target: Element; observer: ResizeObserver }>();

  useLayout(() => {
    latest.current = { onResize, resizeProp, boxSize };
    const target = !disabled && (getTarget ? getTarget() : node);
    if (active.current && active.current.target !== target) {
      active.current.observer.disconnect();
      active.current = undefined;
    }
    if (!active.current && target && target.nodeType === 1) {
      let width = 0;
      let height = 0;
      const observer = new ResizeObserver(([entry]) => {
        if (active.current?.observer !== observer || entry?.target !== target) return;
        const { onResize: notify, resizeProp: dimension, boxSize: box } = latest.current;
        const border = entry.borderBoxSize?.[0];
        const rect = box === 'contentBox' ? entry.contentRect : border || target.getBoundingClientRect();
        const w = Math.round('inlineSize' in rect ? rect.inlineSize : rect.width);
        const h = Math.round('blockSize' in rect ? rect.blockSize : rect.height);
        if ((dimension !== 'height' && width !== w) || (dimension !== 'width' && height !== h)) {
          width = w;
          height = h;
          notify?.(w, h, target);
        }
      });
      active.current = { target, observer };
      observer.observe(target);
      if (immediately && onResize) {
        const element = target as HTMLElement;
        onResize(element.offsetWidth, element.offsetHeight, target);
      }
    }
  });

  useLayout(() => () => {
    active.current?.observer.disconnect();
    active.current = undefined;
  }, []);

  return child && typeof original !== 'string' ? cloneElement(child, { ref }) : <>{children}</>;
}
