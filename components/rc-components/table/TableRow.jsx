import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'mini-store';
import ResizeObserver from 'resize-observer-polyfill';
import acceptsHostRef from '../../_util/acceptsHostRef';
import useMergedRef from '../../_util/useMergedRef';
import TableCell from './TableCell';
import warning from '../../_util/warning';
import TableRowContext, { InnerRowCtx } from './TableRowContext';

function RowHost({ component: Row, register, publicRef, ...props }) {
  const nativeRef = useMergedRef(register, publicRef);
  return acceptsHostRef(Row)
    ? <Row {...props} ref={nativeRef} />
    : <Row {...props} ref={publicRef} rowNodeRef={register} />;
}

class TableRow extends Component {
  static defaultProps = {
    onRow() {
    },
    expandIconColumnIndex: 0,
    expandRowByClick: false,
    onHover() {
    },
    hasExpandIcon() {
    },
    renderExpandIcon() {
    },
    renderExpandIconCell() {
    },
  };

  constructor(props) {
    super(props);

    this.shouldRender = props.visible;
    this.resizeObserver = null;
    this.state = {};
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (prevState.visible || (!prevState.visible && nextProps.visible)) {
      return {
        shouldRender: true,
        visible: nextProps.visible,
      };
    }
    return {
      visible: nextProps.visible,
    };
  }

  componentDidMount() {
    this.syncLegacyRow();
  }

  shouldComponentUpdate(nextProps) {
    const { visible } = this.props;
    return !!(visible || nextProps.visible);
  }

  componentDidUpdate() {
    this.syncLegacyRow();
  }

  componentWillUnmount() {
    this.setRowNode(null);
  }

  onRowClick = (event) => {
    const { record, index, onRowClick } = this.props;
    if (onRowClick) {
      onRowClick(record, index, event);
    }
  };

  onRowDoubleClick = (event) => {
    const { record, index, onRowDoubleClick } = this.props;
    if (onRowDoubleClick) {
      onRowDoubleClick(record, index, event);
    }
  };

  onContextMenu = (event) => {
    const { record, index, onRowContextMenu } = this.props;
    if (onRowContextMenu) {
      onRowContextMenu(record, index, event);
    }
  };

  onMouseEnter = (event) => {
    const { record, index, onRowMouseEnter, onHover, rowKey } = this.props;
    onHover(true, rowKey);
    if (onRowMouseEnter) {
      onRowMouseEnter(record, index, event);
    }
  };

  onMouseLeave = (event) => {
    const { record, index, onRowMouseLeave, onHover, rowKey } = this.props;
    onHover(false, rowKey);
    if (onRowMouseLeave) {
      onRowMouseLeave(record, index, event);
    }
  };

  setExpanedRowHeight() {
    const { store, rowKey } = this.props;
    let { expandedRowsHeight } = store.getState();
    const height = this.rowRef.getBoundingClientRect().height;
    const oldHeight = expandedRowsHeight && expandedRowsHeight[rowKey];
    if (height && oldHeight !== height) {
      expandedRowsHeight = {
        ...expandedRowsHeight,
        [rowKey]: height,
      };
      store.setState({ expandedRowsHeight });
    }
  }

  setRowHeight() {
    const { store, rowKey } = this.props;
    const { fixedColumnsBodyRowsHeight } = store.getState();
    const height = this.rowRef.getBoundingClientRect().height;
    const oldHeight = fixedColumnsBodyRowsHeight && fixedColumnsBodyRowsHeight[rowKey];
    if (height && oldHeight !== height) {
      store.setState({
        fixedColumnsBodyRowsHeight: {
          ...fixedColumnsBodyRowsHeight,
          [rowKey]: height,
        },
      });
    }
  }

  getStyle() {
    const { height, visible } = this.props;

    if (height && height !== this.style.height) {
      this.style = { ...this.style, height };
    }

    if (!visible && !this.style.display) {
      this.style = { ...this.style, display: 'none' };
    }

    return this.style;
  }

  syncLegacyRow() {
    // Opaque React 16 rows predate the explicit rowNodeRef contract.
    if (!this.explicitNode && ReactDOM.findDOMNode) this.setRowNode(ReactDOM.findDOMNode(this));
  }

  registerRow = node => {
    this.explicitNode = node && node.nodeType === 1 ? node : null;
    this.setRowNode(this.explicitNode);
  };

  setRowNode(node) {
    if (node === this.rowRef) return;
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.resizeObserver = null;
    this.rowRef = node;
    if (node) {
      this.resizeObserver = new ResizeObserver(this.syncRowHeight);
      this.resizeObserver.observe(node);
      this.syncRowHeight();
    }
  }

  syncRowHeight = () => {
    const { isAnyColumnsFixed, fixed, expandedRow, ancestorKeys } = this.props;

    if (!this.rowRef || !isAnyColumnsFixed) {
      return;
    }

    if (!fixed && expandedRow) {
      this.setExpanedRowHeight();
    }

    if (!fixed && ancestorKeys.length >= 0) {
      this.setRowHeight();
    }
  };

  render() {
    const { shouldRender } = this.state;
    if (!shouldRender) {
      return null;
    }

    const {
      prefixCls,
      columns,
      record,
      rowKey,
      index,
      onRow,
      indent,
      indentSize,
      hovered,
      height,
      visible,
      fixed,
      components,
      hasExpandIcon,
      renderExpandIcon,
      renderExpandIconCell,
    } = this.props;

    const BodyRow = components.body.row;
    const BodyCell = components.body.cell;

    let { className } = this.props;

    if (hovered) {
      className += ` ${prefixCls}-hover`;
    }

    const cells = [];

    renderExpandIconCell(cells);

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i];

      warning(
        column.onCellClick === undefined,
        'column[onCellClick] is deprecated, please use column[onCell] instead.',
      );

      cells.push(
        <TableRowContext.Consumer key={column.key || column.dataIndex}>
          {(form) => (
            <TableCell
              prefixCls={prefixCls}
              record={record}
              indentSize={indentSize}
              indent={indent}
              form={form}
              index={index}
              column={column}
              key={column.key || column.dataIndex}
              expandIcon={hasExpandIcon(i) && renderExpandIcon()}
              component={BodyCell}
            />
          )}
        </TableRowContext.Consumer>,
      );
    }

    const rowClassName =
      `${prefixCls} ${className} ${prefixCls}-level-${indent}`.trim();

    const { ref: publicRef, ...rowProps } = onRow(record, index) || {};
    const customStyle = rowProps ? rowProps.style : {};
    let style = { height };

    if (!visible) {
      style.display = 'none';
    }

    style = { ...style, ...customStyle };

    return (
      <InnerRowCtx.Provider value={{ syncRowHeight: this.syncRowHeight }}>
        <RowHost
          onClick={this.onRowClick}
          onDoubleClick={this.onRowDoubleClick}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
          onContextMenu={this.onContextMenu}
          className={rowClassName}
          fixed={fixed}
          record={record}
          {...rowProps}
          component={BodyRow}
          register={this.registerRow}
          publicRef={publicRef}
          style={style}
          data-row-key={rowKey}
        >
          {cells}
        </RowHost>
      </InnerRowCtx.Provider>
    );
  }
}

function getRowHeight(state, props) {
  const { expandedRowsHeight, fixedColumnsBodyRowsHeight } = state;
  const { fixed, rowKey } = props;

  if (!fixed) {
    return null;
  }

  if (expandedRowsHeight[rowKey]) {
    return expandedRowsHeight[rowKey];
  }

  if (fixedColumnsBodyRowsHeight[rowKey]) {
    return fixedColumnsBodyRowsHeight[rowKey];
  }

  return null;
}

export default connect((state, props) => {
  const { currentHoverKey, expandedRowKeys } = state;
  const { rowKey, ancestorKeys } = props;
  const visible = ancestorKeys.length === 0 || ancestorKeys.every(k => expandedRowKeys.indexOf(k) !== -1);

  return {
    visible,
    hovered: currentHoverKey === rowKey,
    height: getRowHeight(state, props),
  };
})(TableRow);
