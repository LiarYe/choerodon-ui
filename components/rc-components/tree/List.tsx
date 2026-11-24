import React, {
  cloneElement,
  CSSProperties,
  forwardRef,
  Key,
  memo,
  PropsWithoutRef,
  ReactElement,
  RefAttributes,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { FlattenNode, ScrollTo } from './interface';
import { MotionTreeNodeProps } from './MotionTreeNode';

export interface ListProps {
  data: FlattenNode[];
  prefixCls: string;
  children: (item: FlattenNode) => ReactElement<MotionTreeNodeProps>;
  height?: number;
  itemKey: (item: FlattenNode) => Key;
}

export type ListRef = { scrollTo: ScrollTo };

const List: React.ForwardRefExoticComponent<PropsWithoutRef<ListProps> & RefAttributes<ListRef>> = forwardRef<ListRef, ListProps>(({
  data,
  prefixCls,
  children,
  height,
  itemKey,
}, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const innerStyle = useMemo(() => {
    const style: CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
    };
    if (height) {
      style.height = height;
      style.overflow = 'hidden auto';
    }
    return style;
  }, [height]);
  const renderChild = useCallback(child => cloneElement<MotionTreeNodeProps>(children(child), { key: itemKey(child) }), [children, itemKey]);
  const scrollTo = useCallback<ScrollTo>(scroll => {
    const holder = containerRef.current;
    if (!holder || scroll == null) return;
    if (typeof scroll === 'number') {
      holder.scrollTop = scroll;
    } else if ('index' in scroll || 'key' in scroll) {
      const index = 'index' in scroll ? scroll.index : data.findIndex(item => itemKey(item) === scroll.key);
      const row = holder.children[index];
      if (!row) return;
      const { align = 'auto', offset = 0 } = scroll;
      const bounds = row.getBoundingClientRect();
      const holderBounds = holder.getBoundingClientRect();
      // Convert visual distances to the layout pixels used by scrollTop.
      const scaleY = holderBounds.height && holder.offsetHeight ? holderBounds.height / holder.offsetHeight : 1;
      const top = (bounds.top - holderBounds.top) / scaleY - holder.clientTop;
      const bottom = (bounds.bottom - holderBounds.top) / scaleY - holder.clientTop - holder.clientHeight;
      if (align === 'top' || (align === 'auto' && top < 0)) {
        holder.scrollTop += top - offset;
      } else if (align === 'bottom' || (align === 'auto' && bottom > 0)) {
        holder.scrollTop += bottom + offset;
      }
    } else {
      if (scroll.top !== undefined) holder.scrollTop = scroll.top;
      if (scroll.left !== undefined) holder.scrollLeft = scroll.left;
    }
  }, [data, itemKey]);

  useImperativeHandle(ref, () => ({
    scrollTo,
  }), [scrollTo]);

  return (
    <div className={`${prefixCls}-holder`}>
      <div className={`${prefixCls}-holder-inner`} style={innerStyle} ref={containerRef}>
        {data.map(renderChild)}
      </div>
    </div>
  );
});

export default memo(List);
