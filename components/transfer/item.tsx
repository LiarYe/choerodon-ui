import React, { Component, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { ForwardRef, Memo } from 'react-is';
import { observe } from 'react-intersection-observer';
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
import Checkbox from '../checkbox';
import PureRenderMixin from '../rc-components/util/PureRenderMixin';

function getScrollRoot(node: HTMLElement) {
  let parent = node.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const { overflow, overflowX, overflowY } = getComputedStyle(parent);
    if (/auto|scroll/.test(overflow + overflowX + overflowY)) return parent;
    parent = parent.parentElement;
  }
  return null;
}

type VisibilityListener = (visible: boolean) => void;
interface RootSubscription {
  visible?: boolean;
  listeners: Set<VisibilityListener>;
  stop: () => void;
}
const roots = new WeakMap<HTMLElement, Map<string, RootSubscription>>();

// observe() does not replay the current intersection for a new listener on an
// already observed target. Keep one subscription per root/margin and replay it.
function observeRoot(root: HTMLElement, rootMargin: string, listener: VisibilityListener) {
  const margins = roots.get(root) || new Map<string, RootSubscription>();
  roots.set(root, margins);
  let group = margins.get(rootMargin);
  if (!group) {
    const state: Omit<RootSubscription, 'stop'> = { listeners: new Set() };
    const stop = observe(root, visible => {
      state.visible = visible;
      state.listeners.forEach(notify => notify(visible));
    }, { rootMargin }, true);
    group = Object.assign(state, { stop });
    margins.set(rootMargin, group);
  }
  group.listeners.add(listener);
  if (group.visible !== undefined) listener(group.visible);
  return () => {
    group.listeners.delete(listener);
    if (!group.listeners.size) {
      group.stop();
      margins.delete(rootMargin);
    }
  };
}

// Ordinary function/class wrappers have no portable DOM ref across React versions.
function acceptsDOMRef(type: any): boolean {
  if (type.$$typeof === Memo) return acceptsDOMRef(type.type);
  return typeof type === 'string' || type.$$typeof === ForwardRef;
}

function LazyRow({ lazy, children }: { lazy: any; children: React.ReactElement }) {
  const { elementType: Wrapper = 'div', height = '0.32rem', width, className,
    offset = 500, threshold, offsetVertical, offsetHorizontal, offsetTop, offsetRight,
    offsetBottom, offsetLeft, throttle: wait, debounce: trailing, onContentVisible } = lazy;
  const vertical = offsetVertical || threshold || offset;
  const horizontal = offsetHorizontal || threshold || offset;
  const rootMargin = `${offsetTop || vertical}px ${offsetRight || horizontal}px ${offsetBottom || vertical}px ${offsetLeft || horizontal}px`;
  const ref = useRef<HTMLElement>(null);
  const canObserve = acceptsDOMRef(Wrapper);
  const [revealed, setRevealed] = useState(!canObserve);
  const visible = revealed || !canObserve;
  useEffect(() => {
    if (revealed) return undefined;
    const node = ref.current;
    // A forwardRef can still omit the ref or expose an imperative handle.
    if (!(node instanceof Element)) {
      setRevealed(true);
      return undefined;
    }
    const root = getScrollRoot(node);
    let rootVisible = root ? undefined : true;
    let rowVisible: boolean | undefined;
    let initiallyVisible = true;
    const reveal = () => {
      if (rootVisible && rowVisible) setRevealed(true);
    };
    const scheduled = wait > 0 ? (trailing ? debounce : throttle)(reveal, wait) : undefined;
    const check = () => {
      // Only a real negative result ends the immediate initial visibility check.
      if (rootVisible === false || rowVisible === false) initiallyVisible = false;
      if (initiallyVisible || !scheduled) reveal();
      else scheduled();
    };
    const stopRoot = root && observeRoot(root, rootMargin, inView => {
      rootVisible = inView;
      check();
    });
    const stopRow = observe(node, inView => {
      rowVisible = inView;
      check();
    }, { root, rootMargin }, true);
    return () => {
      if (scheduled) scheduled.cancel();
      if (stopRoot) stopRoot();
      stopRow();
    };
  }, [revealed, rootMargin, wait, trailing, Wrapper]);

  const notified = useRef(false);
  useEffect(() => {
    if (visible && !notified.current) {
      notified.current = true;
      if (onContentVisible) onContentVisible();
    }
  }, [visible, onContentVisible]);

  return (
    <Wrapper ref={canObserve ? ref : undefined} className={classNames('LazyLoad', { 'is-visible': visible }, className)} style={{ height, width }}>
      {visible && children}
    </Wrapper>
  );
}

export default class Item extends Component<any, any> {
  shouldComponentUpdate(...args: any[]) {
    return PureRenderMixin.shouldComponentUpdate.apply(this, args);
  }

  render() {
    const {
      renderedText,
      renderedEl,
      item,
      lazy,
      checked,
      isHighlight,
      prefixCls,
      onClick,
      checkboxPrefixCls,
    } = this.props;

    const className = classNames({
      [`${prefixCls}-content-item`]: true,
      [`${prefixCls}-content-item-disabled`]: item.disabled,
      [`${prefixCls}-content-item-highlight`]: isHighlight,
    });

    const listItem = (
      <li
        className={className}
        title={renderedText}
        onClick={item.disabled ? undefined : () => onClick(item)}
      >
        <Checkbox prefixCls={checkboxPrefixCls} checked={checked} disabled={item.disabled} />
        <span>{renderedEl}</span>
      </li>
    );
    return lazy ? <LazyRow lazy={lazy}>{listItem}</LazyRow> : listItem;
  }
}
