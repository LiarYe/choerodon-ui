// @ts-nocheck
import * as React from 'react';
import classNames from 'classnames';
import { DraggableProvided, DraggableStateSnapshot } from 'choerodon-ui/lib/drag-drop-context';
import { defaultClassPrefix, getUnhandledProps, prefix } from './utils';
import TableContext, { LiftedRowContext } from './TableContext';
import { StandardProps } from './common';

export interface RowProps extends StandardProps {
  width?: number;
  height?: number;
  headerHeight?: number;
  top?: number;
  isHeaderRow?: boolean;
  isFooterRow?: boolean;
  rowDraggable?: boolean;
  rowRef?: React.Ref<any>;
  provided?: DraggableProvided;
  snapshot?: DraggableStateSnapshot;
}

const propTypeKeys = [
  'width',
  'height',
  'headerHeight',
  'top',
  'isHeaderRow',
  'rowDraggable',
  'rowRef',
  'className',
  'classPrefix',
  'style',
  'provided',
  'snapshot',
];

class Row extends React.PureComponent<RowProps> {
  static contextType = LiftedRowContext;

  static defaultProps = {
    classPrefix: defaultClassPrefix('performance-table-row'),
    height: 46,
    headerHeight: 40,
  };

  render() {
    const {
      // todo
      // dragColumnAlign,
      className,
      width,
      height,
      top,
      style,
      isHeaderRow,
      isFooterRow,
      headerHeight,
      rowRef,
      classPrefix,
      children,
      rowDraggable,
      provided,
      snapshot,
      ...rest
    } = this.props;

    const addPrefix = prefix(classPrefix);
    const classes = classNames(classPrefix, className, {
      [addPrefix('header')]: isHeaderRow,
      [addPrefix('footer')]: isFooterRow,
    });

    let styles = {
      minWidth: width,
      height: isHeaderRow ? headerHeight : height,
      ...style,
    };

    const unhandledProps = getUnhandledProps(propTypeKeys, rest);

    return (
      <TableContext.Consumer>
        {({ translateDOMPositionXY }) => {
          const providedProps = {};
          if (rowDraggable && provided) {
            const { isDragging } = snapshot;
            const { transform, transition } = provided.draggableProps.style;
            Object.assign(providedProps, provided.draggableProps, provided.dragHandleProps);
            // DnD assumes rows below the source have already moved up in normal flow.
            // Remove that slot from their absolute layout before applying DnD's transform.
            const lifted = this.context;
            const afterSource = lifted && rest['data-rowindex'] > lifted.index;
            styles = {
              ...styles,
              top: afterSource ? top - lifted.height : top,
              cursor: 'move',
              transform,
              transition,
              zIndex: isDragging ? 999 : styles.zIndex,
            };
          } else if (top !== undefined && !rowDraggable) {
            styles.top = top;
          } else if (translateDOMPositionXY) {
            translateDOMPositionXY(styles, 0, top);
          }
          return <div {...providedProps} role="row" {...unhandledProps} ref={rowRef} className={classes} style={styles}>
            {children}
          </div>;
        }}
      </TableContext.Consumer>
    );
  }
}

export default Row;
