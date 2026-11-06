import React, { Children, CSSProperties, isValidElement, Key, ReactNode } from 'react';
import { action, computed, get, IReactionDisposer, observable, ObservableMap, reaction, runInAction, set, makeObservable } from 'mobx';
import classNames from 'classnames';
import { DragUpdate } from 'react-beautiful-dnd';
import sortBy from 'lodash/sortBy';
import debounce from 'lodash/debounce';
import isNil from 'lodash/isNil';
import isObject from 'lodash/isObject';
import isPlainObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import lodashGet from 'lodash/get';
import defaultTo from 'lodash/defaultTo';
import Group from 'choerodon-ui/dataset/data-set/Group';
import { warning } from 'choerodon-ui/dataset/utils';
import measureScrollbar from 'choerodon-ui/lib/_util/measureScrollbar';
import { isCalcSize, pxToRem, scaleSize, toPx } from 'choerodon-ui/lib/_util/UnitConvertor';
import { Config, ConfigKeys, DefaultConfig } from 'choerodon-ui/lib/configure';
import { DuplicateKeyConfig } from 'choerodon-ui/lib/configure/interface';
import { ConfigContextValue } from 'choerodon-ui/lib/config-provider/ConfigContext';
import Icon from 'choerodon-ui/lib/icon';
import isFunction from 'lodash/isFunction';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import noop from 'lodash/noop';
import { isMoment } from 'moment';
import { CHILDREN_PAGE_INFO, QUERY_CANCELABLE, TABLE_SHOW_REMOVED_ROW } from 'choerodon-ui/dataset/data-set/DataSet';
import Column, { ColumnDefaultProps, ColumnProps, defaultAggregationRenderer } from './Column';
import CustomizationSettings from './customization-settings/CustomizationSettings';
import isFragment from '../_util/isFragment';
import observableColumn from '../_util/observableColumn';
import DataSet from '../data-set/DataSet';
import Record from '../data-set/Record';
import ObserverCheckBox, { CheckBoxProps } from '../check-box/CheckBox';
import ObserverRadio from '../radio/Radio';
import { DataSetSelection, FieldType, RecordCachedType } from '../data-set/enum';
import {
  ColumnAlign,
  ColumnLock,
  DragColumnAlign,
  GroupType,
  RowBoxPlacement,
  ScrollPosition,
  SelectionMode,
  SortRangeOption,
  TableAutoHeightType,
  TableBoxSizing,
  TableColumnResizeTriggerType,
  TableColumnTooltip,
  TableEditMode,
  TableHeightType,
  TableMode,
  TableQueryBarType,
} from './enum';
import { stopPropagation } from '../_util/EventManager';
import { getCachedSelectableCounts, getCachedSelectableRecords, getColumnKey, getCurrentSelectableCounts, getHeader, isDisabledRow } from './utils';
import getReactNodeText from '../_util/getReactNodeText';
import ColumnGroups from './ColumnGroups';
import autobind from '../_util/autobind';
import Table, {
  expandIconProps,
  TableCustomized,
  TableGroup,
  TablePaginationConfig,
  TableProps,
  TableQueryBarHook,
  Clipboard,
  ArrangeValue,
  CombineSortConfig,
} from './Table';
import { Size } from '../core/enum';
import { $l } from '../locale-context';
import CustomizationColumnHeader from './customization-settings/CustomizationColumnHeader';
import ComboCustomizationSettings from './combo-customization-settings';
import TableEditor from './TableEditor';
import Dropdown from '../dropdown/Dropdown';
import Menu from '../menu';
import Modal, { ModalProps } from '../modal/Modal';
import { treeMap, treeSome } from '../_util/treeUtils';
import { HighlightRenderer, TagRendererProps } from '../field/FormField';
import { getIf, mergeGroupStates, normalizeGroups } from '../data-set/utils';
import VirtualRowMetaData from './VirtualRowMetaData';
import BatchRunner from '../_util/BatchRunner';
import { LabelLayout } from '../form/enum';
import ColumnGroup from './ColumnGroup';
import { getTdElementByTarget } from './TableCell';
import {
  getDateFormatByField,
} from '../field/utils';

export const SELECTION_KEY = '__selection-column__'; // TODO:Symbol

export const COMBOBAR_KEY = '__combo-column__'; // TODO:Symbol

export const ROW_NUMBER_KEY = '__row-number-column__'; // TODO:Symbol

export const DRAG_KEY = '__drag-column__'; // TODO:Symbol

export const EXPAND_KEY = '__expand-column__'; // TODO:Symbol

export const CUSTOMIZED_KEY = '__customized-column__'; // TODO:Symbol

export const AGGREGATION_EXPAND_CELL_KEY = '__aggregation-expand-cell__'; // TODO:Symbol

export const BODY_EXPANDED = '__body_expanded__'; // TODO:Symbol

export const VIRTUAL_ROOT_MARGIN = 50;

export type HeaderText = { name: string; label: string };

function columnFilter(column: ColumnProps | undefined): column is ColumnProps {
  return Boolean(column);
}

function getOverScanCount(tableStore: TableStore, index: number, next?: boolean) {
  const { rowMetaData } = tableStore;
  if (rowMetaData) {
    let count = 0;
    let height = 0;
    while (height < VIRTUAL_ROOT_MARGIN) {
      index += next ? 1 : -1;
      if (index < 0 || index >= rowMetaData.length) {
        return count;
      }
      const metaData = rowMetaData[index];
      if (!metaData) {
        return count;
      }
      height += metaData.height;
      count++;
    }
    return count;
  }
  return Math.ceil(VIRTUAL_ROOT_MARGIN / tableStore.virtualRowHeight);
}

function getItemMetadata(
  rowMetaData: VirtualRowMetaData[],
  index: number,
  tableStore: TableStore,
): VirtualRowMetaData {
  const { lastMeasuredIndex } = tableStore;

  if (index > lastMeasuredIndex) {
    tableStore.lastMeasuredIndex = index;
  }
  return rowMetaData[index];
}

function findNearestItemBinarySearch(
  rowMetaData: VirtualRowMetaData[],
  tableStore: TableStore,
  high: number,
  low: number,
  offset: number,
): number {
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const item = getItemMetadata(rowMetaData, middle, tableStore);
    if (!item) {
      return 0;
    }
    const currentOffset = item.offset;

    if (currentOffset === offset) {
      return middle;
    }
    if (currentOffset < offset) {
      low = middle + 1;
    }
    if (currentOffset > offset) {
      high = middle - 1;
    }
  }

  if (low > 0) {
    return low - 1;
  }
  return 0;
}

function overOffset(
  rowMetaData: VirtualRowMetaData[],
  tableStore: TableStore,
  index: number,
  offset: number,
): boolean {
  const item = getItemMetadata(rowMetaData, index, tableStore);
  if (item) {
    return item.offset < offset;
  }
  return false;
}

function findNearestItemExponentialSearch(
  rowMetaData: VirtualRowMetaData[],
  tableStore: TableStore,
  index: number,
  offset: number,
): number {
  const { virtualEstimatedRows } = tableStore;
  let interval = 1;

  while (index < virtualEstimatedRows && overOffset(rowMetaData, tableStore, index, offset)) {
    index += interval;
    interval *= 2;
  }

  return findNearestItemBinarySearch(
    rowMetaData,
    tableStore,
    Math.min(index, virtualEstimatedRows - 1),
    Math.floor(index / 2),
    offset,
  );
}

function getVisibleStartIndex(tableStore: TableStore, getLastScrollTop = () => tableStore.lastScrollTop): number {
  const { height, virtualEstimatedRows } = tableStore;
  if (height === undefined || !virtualEstimatedRows) {
    return 0;
  }
  const lastScrollTop = getLastScrollTop();
  const { virtualRowHeight, rowMetaData } = tableStore;
  if (rowMetaData) {
    if (!rowMetaData.length) {
      return 0;
    }
    const { lastMeasuredIndex } = tableStore;
    const lastRowMetaData = lastMeasuredIndex > 0 ? rowMetaData[lastMeasuredIndex] : undefined;
    const lastMeasuredItemOffset = lastRowMetaData ? lastRowMetaData.offset : 0;
    if (lastMeasuredItemOffset >= lastScrollTop) {
      return findNearestItemBinarySearch(
        rowMetaData,
        tableStore,
        lastMeasuredIndex,
        0,
        lastScrollTop,
      );
    }
    return findNearestItemExponentialSearch(
      rowMetaData,
      tableStore,
      Math.max(0, lastMeasuredIndex),
      lastScrollTop,
    );
  }
  return Math.max(
    0,
    Math.min(
      virtualEstimatedRows, Math.floor(lastScrollTop / virtualRowHeight),
    ),
  );
}

function getVisibleEndIndex(tableStore: TableStore, getVirtualVisibleStartIndex = () => tableStore.virtualVisibleStartIndex, getLastScrollTop = () => tableStore.lastScrollTop) {
  const { height, virtualEstimatedRows } = tableStore;
  if (height === undefined) {
    return virtualEstimatedRows;
  }
  const virtualVisibleStartIndex = getVirtualVisibleStartIndex();
  const { virtualRowHeight, rowMetaData } = tableStore;
  if (rowMetaData) {
    if (!rowMetaData.length) {
      return 0;
    }
    const itemMetadata = getItemMetadata(rowMetaData, virtualVisibleStartIndex, tableStore);
    if (!itemMetadata) {
      return 0;
    }
    const maxOffset = getLastScrollTop() + height;

    let offset = itemMetadata.offset + itemMetadata.height;
    let stopIndex = virtualVisibleStartIndex;

    while (stopIndex < virtualEstimatedRows - 1 && offset < maxOffset) {
      stopIndex++;
      const item = getItemMetadata(rowMetaData, stopIndex, tableStore);
      if (item) {
        offset += item.height;
      }
    }

    return Math.max(0, Math.min(virtualEstimatedRows, stopIndex + 1));
  }
  const numVisibleItems = Math.ceil(
    height / virtualRowHeight,
  );
  return Math.max(
    0,
    Math.min(
      virtualEstimatedRows,
      virtualVisibleStartIndex + numVisibleItems,
    ),
  );
}

function getStartIndex(tableStore: TableStore, getVirtualVisibleStartIndex = () => tableStore.virtualVisibleStartIndex): number {
  const virtualVisibleStartIndex = getVirtualVisibleStartIndex();
  return Math.max(0, virtualVisibleStartIndex - getOverScanCount(tableStore, virtualVisibleStartIndex));
}

function getEndIndex(tableStore: TableStore, getVirtualVisibleEndIndex = () => tableStore.virtualVisibleEndIndex): number {
  const virtualVisibleEndIndex = getVirtualVisibleEndIndex();
  const { virtualEstimatedRows } = tableStore;
  return Math.min(virtualEstimatedRows, virtualVisibleEndIndex + getOverScanCount(tableStore, virtualVisibleEndIndex, true));
}

export function getIdList(store: TableStore) {
  const { mouseBatchChooseStartId, mouseBatchChooseEndId, node: { element }, prefixCls } = store;
  const rows = Array.from<HTMLTableRowElement>(element.querySelectorAll(`.${prefixCls}-row`));
  let endId;
  const idList: number[] = [];
  rows.some((row) => {
    const index = Number(row.dataset.index);
    if (!endId) {
      if (mouseBatchChooseStartId === index) {
        endId = mouseBatchChooseEndId;
      } else if (mouseBatchChooseEndId === index) {
        endId = mouseBatchChooseStartId;
      }
    }
    if (endId) {
      idList.push(index);
    }
    return endId === index;
  });
  return idList;
}

function getRowNumbers(record?: Record | null, dataSet?: DataSet | null, isTree?: boolean, showRemovedRow?: boolean): number[] {
  if (record && dataSet) {
    if (record.isCached) {
      return [];
    }
    const { paging, currentPage, pageSize } = dataSet;
    const pageIndex = (isTree ? paging === 'server' : paging) ? (currentPage - 1) * pageSize : 0;
    if (isTree) {
      return record.path.map((r, index) => r.indexInParent + 1 + (index === 0 ? pageIndex : 0));
    }
    const index = showRemovedRow ? dataSet.records.indexOf(record) : record.index;
    return [index + 1 + pageIndex];
  }
  return [0];
}

function hasCheckField({ editor, name, hidden }: ColumnProps, checkField: string): boolean {
  return !hidden && !!editor && checkField === name;
}

function renderSelectionBox({ record, store }: { record: any; store: TableStore }): ReactNode {
  const { dataSet } = record;
  if (dataSet) {
    const { selection } = dataSet;
    const selectionDisabled = !record.selectable || (store.duplicateKeyConfig.disable && store.isDuplicatePrimaryKeyRecord(record));
    const handleChange = value => {
      if (store.props.selectionMode === SelectionMode.mousedown) {
        // 将处理逻辑交给 mousedown 的处理逻辑 不然会两次触发导致不被勾选上
        return;
      }
      if (value) {
        dataSet.select(record);
      } else {
        dataSet.unSelect(record);
      }
    };

    const handleClick = e => {
      stopPropagation(e);
      if (selection === DataSetSelection.multiple) {
        const { lastSelected } = store;
        if (lastSelected) {
          const nativeEvent = e.nativeEvent;
          let startIndex = -1;
          let endIndex = -1;
          if (nativeEvent.shiftKey) {
            const pointKeys = new Set([lastSelected.key, record.key]);
            dataSet.some((pointRecord, index) => {
              if (pointKeys.has(pointRecord.key)) {
                if (startIndex === -1) {
                  startIndex = index;
                } else {
                  endIndex = index;
                  return true;
                }
              }
              return false;
            });
          }
          if (endIndex !== -1 && startIndex !== endIndex) {
            // Batch update selections
            const rangeRecords = dataSet.slice(startIndex, endIndex + 1)
              .filter(rangeRecord => !store.duplicateKeyConfig.disable || !store.isDuplicatePrimaryKeyRecord(rangeRecord));
            const changedRecords: Record[] = [];
            const selectedKeys = new Set(dataSet.selected.map(selected => selected.key));
            if (record.isSelected) {
              rangeRecords.forEach(rangeRecord => {
                if (selectedKeys.has(rangeRecord.key)) {
                  changedRecords.push(rangeRecord);
                }
              });
              dataSet.batchUnSelect(changedRecords);
            } else {
              rangeRecords.forEach(rangeRecord => {
                if (!selectedKeys.has(rangeRecord.key)) {
                  changedRecords.push(rangeRecord);
                }
              });
              dataSet.batchSelect(changedRecords);
            }

          }
        }
        store.lastSelected = record;

      } else if (record.isSelected) {
        dataSet.unSelect(record);
      }
    };

    if (selection === DataSetSelection.multiple) {
      const batchSelectProps: CheckBoxProps = {};
      const handleDragMouseUp = action(() => {
        const { mouseBatchChooseIdList } = store;
        if (store.mouseBatchChooseState) {
          store.mouseBatchChooseState = false;
          store.changeMouseBatchChooseIdList([]);
          const { mouseBatchChooseStartId, mouseBatchChooseEndId } = store;
          if (mouseBatchChooseStartId === mouseBatchChooseEndId) {
            return;
          }
          const startRecord = dataSet.findRecordById(mouseBatchChooseStartId);
          const { isSelected } = startRecord || {};
          if (isSelected) {
            dataSet.batchUnSelect(mouseBatchChooseIdList);
          } else {
            dataSet.batchSelect(mouseBatchChooseIdList);
          }
        }
        document.removeEventListener('pointerup', handleDragMouseUp);
      });
      if (store.useMouseBatchChoose) {
        batchSelectProps.onMouseDown = action(() => {
          store.mouseBatchChooseStartId = record.id;
          store.mouseBatchChooseEndId = record.id;
          store.mouseBatchChooseState = true;
          // 为什么使用 pointerup
          // 因为需要对disabled的元素进行特殊处理
          // 因为状态的改变依赖 mouseup 而在disabled的元素上 无法触发mouseup事件
          // 导致状态无法进行修正
          // 以下两种方案通过 pointer-events:none 进行处理
          // https://stackoverflow.com/questions/322378/javascript-check-if-mouse-button-down
          // https://stackoverflow.com/questions/62081666/the-event-of-the-document-is-not-triggered-when-it-is-on-a-disabled-element
          // 而使用指针事件可以突破disabled的限制
          // https://stackoverflow.com/questions/62126515/how-to-get-the-state-of-the-mouse-through-javascript/62127845#62127845
          document.addEventListener('pointerup', handleDragMouseUp);
        });
        batchSelectProps.onMouseEnter = () => {
          if (store.mouseBatchChooseState) {
            store.mouseBatchChooseEndId = record.id;
            store.changeMouseBatchChooseIdList(getIdList(store));
          }
        };
      }
      return (
        <ObserverCheckBox
          {...batchSelectProps}
          checked={record.isSelected}
          onChange={handleChange}
          onClick={handleClick}
          disabled={selectionDisabled}
          data-selection-key={SELECTION_KEY}
          labelLayout={LabelLayout.none}
          value
        />
      );
    }
    if (selection === DataSetSelection.single) {
      return (
        <ObserverRadio
          checked={record.isSelected}
          onChange={handleChange}
          onClick={handleClick}
          disabled={selectionDisabled}
          data-selection-key={SELECTION_KEY}
          value
        />
      );
    }
  }
}

function getCustomizedColumnByKey(key: string, customizedColumns): ColumnProps | undefined {
  if (customizedColumns) {
    return customizedColumns[key];
  }
}

function getCustomizedColumn(column: ColumnProps, customizedColumns?: { [key: string]: ColumnProps }): ColumnProps | undefined {
  if (customizedColumns) {
    return getCustomizedColumnByKey(getColumnKey(column).toString(), customizedColumns);
  }
}

function mergeColumnLock(column: ColumnProps, parent?: ColumnProps | null, customizedColumn?: ColumnProps) {
  if (parent) {
    column.lock = parent.lock;
  } else if (customizedColumn && 'lock' in customizedColumn) {
    column.lock = customizedColumn.lock;
  }
}

function mergeCustomizedColumn(column: ColumnProps, tableStore: TableStore, customizedColumn?: ColumnProps, isChildrenHideDisabled?: boolean) {
  if (isChildrenHideDisabled) {
    column.hideable = false;
  } else {
    const field = tableStore.dataSet.getField(column.name);
    if (field) {
      const dynamicProps = field.get('dynamicProps');
      const computedProps = field.get('computedProps');
      if ((dynamicProps && dynamicProps.required) || (computedProps && computedProps.required) || field.get('required')) {
        column.hideable = false;
      }
    }
  }
  if (customizedColumn) {
    if (column.hideable === false || !tableStore.columnHideable) {
      delete customizedColumn.hidden;
    }
    if (column.resizable === false || !tableStore.columnResizable) {
      delete customizedColumn.width;
    }
    if (column.titleEditable === false || !tableStore.columnTitleEditable) {
      delete customizedColumn.title;
    }
    if (!tableStore.columnDraggable) {
      delete customizedColumn.sort;
    }
    Object.assign(column, customizedColumn);
  }
}

function findAndMergeCustomizedColumn(column: ColumnProps, tableStore: TableStore, customizedColumns?: { [key: string]: ColumnProps }, isChildrenHideDisabled?: boolean): void {
  const customizedColumn = getCustomizedColumn(column, customizedColumns);
  mergeCustomizedColumn(column, tableStore, customizedColumn, isChildrenHideDisabled);
}

type ChildrenInfo = {
  hasAggregationColumn: boolean;
  isHideDisabled: boolean;
}

function mergeDefaultProps(
  tableStore: TableStore,
  originalColumns: ColumnProps[],
  tableAggregation?: boolean,
  customizedColumns?: { [key: string]: ColumnProps },
  parent: ColumnProps | null = null,
  defaultKey: number[] = [0],
  columnSort = {
    left: 0,
    center: 0,
    right: 0,
  },
): [ColumnProps[], ColumnProps[], ColumnProps[], ChildrenInfo] {
  const columns: ColumnProps[] = [];
  const leftColumns: ColumnProps[] = [];
  const rightColumns: ColumnProps[] = [];
  let hasAggregationColumn = false;
  let isHideDisabled = false;
  originalColumns.forEach((column) => {
    if (isPlainObject(column)) {
      const newColumn: ColumnProps = { ...ColumnDefaultProps, ...column };
      if (isNil(getColumnKey(newColumn))) {
        newColumn.key = `anonymous-${defaultKey[0]++}`;
      }
      const { children, aggregation } = newColumn;
      if (!hasAggregationColumn && aggregation) {
        hasAggregationColumn = true;
      }
      if (tableAggregation || !aggregation) {
        const customizedColumn = getCustomizedColumn(newColumn, customizedColumns);
        mergeColumnLock(newColumn, parent, customizedColumn);
        if (children) {
          const [, childrenColumns, , {
            hasAggregationColumn: childrenHasAggregationColumn, isHideDisabled: childrenIsHideDisabled,
          }] = mergeDefaultProps(tableStore, children, tableAggregation, customizedColumns, newColumn, defaultKey);
          newColumn.children = childrenColumns;
          if (!hasAggregationColumn && childrenHasAggregationColumn) {
            hasAggregationColumn = true;
          }
          if (!isHideDisabled && childrenIsHideDisabled) {
            isHideDisabled = true;
          }
          mergeCustomizedColumn(newColumn, tableStore, customizedColumn, childrenIsHideDisabled);
        } else {
          mergeCustomizedColumn(newColumn, tableStore, customizedColumn);
        }
        if (!isHideDisabled && newColumn.hideable === false) {
          isHideDisabled = true;
        }
        if (parent || !newColumn.lock) {
          if (newColumn.sort === undefined) {
            newColumn.sort = columnSort.center;
          }
          columnSort.center++;
          columns.push(newColumn);
        } else if (newColumn.lock === true || newColumn.lock === ColumnLock.left) {
          if (newColumn.sort === undefined) {
            newColumn.sort = columnSort.left;
          }
          columnSort.left++;
          leftColumns.push(newColumn);
        } else {
          if (newColumn.sort === undefined) {
            newColumn.sort = columnSort.right;
          }
          columnSort.right++;
          rightColumns.push(newColumn);
        }
      } else if (children) {
        const [leftNodes, nodes, rightNodes, {
          hasAggregationColumn: childrenHasAggregationColumn, isHideDisabled: childrenIsHideDisabled,
        }] = mergeDefaultProps(tableStore, children, tableAggregation, customizedColumns, parent, defaultKey, parent ? undefined : columnSort);
        if (!hasAggregationColumn && childrenHasAggregationColumn) {
          hasAggregationColumn = true;
        }
        if (!isHideDisabled && childrenIsHideDisabled) {
          newColumn.hideable = false;
          isHideDisabled = true;
        }
        if (parent) {
          parent.children = [...leftNodes, ...nodes, ...rightNodes];
        } else {
          leftColumns.push(...leftNodes);
          columns.push(...nodes);
          rightColumns.push(...rightNodes);
        }
      }
    }
  }, []);
  if (parent) {
    return [[], sortBy(columns, ({ sort }) => sort), [], { hasAggregationColumn, isHideDisabled }];
  }
  return [
    sortBy(leftColumns, ({ sort }) => sort),
    sortBy(columns, ({ sort }) => sort),
    sortBy(rightColumns, ({ sort }) => sort),
    { hasAggregationColumn, isHideDisabled },
  ];
}

function normalizeColumns(
  tableStore: TableStore,
  elements: ReactNode,
  tableAggregation?: boolean,
  customizedColumns?: { [key: string]: ColumnProps },
  parent: ColumnProps | null = null,
  defaultKey: number[] = [0],
  columnSort = {
    left: 0,
    center: 0,
    right: 0,
  },
): [ColumnProps[], ColumnProps[], ColumnProps[], ChildrenInfo] {
  const columns: ColumnProps[] = [];
  const leftColumns: ColumnProps[] = [];
  const rightColumns: ColumnProps[] = [];
  let hasAggregationColumn = false;
  let isHideDisabled = false;
  const normalizeColumn = (element) => {
    if (isValidElement<any>(element)) {
      const { props, key, type } = element;
      if (isFragment(element)) {
        const { children } = props;
        if (children) {
          Children.forEach(children, normalizeColumn);
        }
      } else if ((type as typeof Column).__PRO_TABLE_COLUMN) {
        const column: any = {
          ...props,
        };
        if (key) {
          column.key = key;
        } else if (isNil(getColumnKey(column))) {
          column.key = `anonymous-${defaultKey[0]++}`;
        }
        const { children, aggregation } = column;
        if (!hasAggregationColumn && aggregation) {
          hasAggregationColumn = true;
        }
        if (tableAggregation || !aggregation) {
          const customizedColumn = getCustomizedColumn(column, customizedColumns);
          mergeColumnLock(column, parent, customizedColumn);
          const [, childrenColumns, , {
            hasAggregationColumn: childrenHasAggregationColumn, isHideDisabled: childrenIsHideDisabled,
          }] = normalizeColumns(tableStore, children, tableAggregation, customizedColumns, column, defaultKey);
          column.children = childrenColumns;
          if (!hasAggregationColumn && childrenHasAggregationColumn) {
            hasAggregationColumn = childrenHasAggregationColumn;
          }
          if (!isHideDisabled && childrenIsHideDisabled) {
            isHideDisabled = true;
          }
          mergeCustomizedColumn(column, tableStore, customizedColumn, childrenIsHideDisabled);
          if (!isHideDisabled && column.hideable === false) {
            isHideDisabled = true;
          }
          if (parent || !column.lock) {
            if (column.sort === undefined) {
              column.sort = columnSort.center;
            }
            columnSort.center++;
            columns.push(column);
          } else if (column.lock === true || column.lock === ColumnLock.left) {
            if (column.sort === undefined) {
              column.sort = columnSort.left;
            }
            columnSort.left++;
            leftColumns.push(column);
          } else {
            if (column.sort === undefined) {
              column.sort = columnSort.right;
            }
            columnSort.right++;
            rightColumns.push(column);
          }
        } else {
          const [leftNodes, nodes, rightNodes, {
            hasAggregationColumn: childrenHasAggregationColumn, isHideDisabled: childrenIsHideDisabled,
          }] = normalizeColumns(tableStore, children, tableAggregation, customizedColumns, parent, defaultKey, parent ? undefined : columnSort);
          if (!hasAggregationColumn && childrenHasAggregationColumn) {
            hasAggregationColumn = childrenHasAggregationColumn;
          }
          if (!isHideDisabled && childrenIsHideDisabled) {
            column.hideable = false;
            isHideDisabled = true;
          }
          if (parent) {
            parent.children = [...leftNodes, ...nodes, ...rightNodes];
          } else {
            leftColumns.push(...leftNodes);
            columns.push(...nodes);
            rightColumns.push(...rightNodes);
          }
        }
      }
    }
  };
  Children.forEach(elements, normalizeColumn);
  if (parent) {
    return [[], sortBy(columns, ({ sort }) => sort), [], { hasAggregationColumn, isHideDisabled }];
  }
  return [
    sortBy(leftColumns, ({ sort }) => sort),
    sortBy(columns, ({ sort }) => sort),
    sortBy(rightColumns, ({ sort }) => sort),
    { hasAggregationColumn, isHideDisabled },
  ];
}


function getColumnGroupedColumns(tableStore: TableStore, groups: TableGroup[], customizedColumns?: { [key: string]: ColumnProps }): [ColumnProps[], ColumnProps[], ColumnProps[], boolean] {
  const leftGroupedColumns: ColumnProps[] = [];
  const groupedColumns: ColumnProps[] = [];
  const rightGroupedColumns: ColumnProps[] = [];
  let hasAggregation = false;
  groups.forEach((group) => {
    const { name, type, columnProps } = group;
    if (type === GroupType.column) {
      const column: ColumnProps = {
        ...ColumnDefaultProps,
        lock: ColumnLock.left,
        ...columnProps,
        draggable: false,
        hideable: false,
        key: `__group-${name}`,
        name,
        __tableGroup: group,
      };
      column.children = columnProps && columnProps.children ? treeMap(columnProps.children, ((col, index, parentNode) => {
        const newCol = { ...col, __tableGroup: group, lock: column.lock };
        if (!getColumnKey(col)) {
          newCol.key = parentNode ? `${parentNode.key}-${index}` : `__group-${name}-${index}`;
        }
        findAndMergeCustomizedColumn(newCol, tableStore, customizedColumns);
        return newCol;
      }), ({ sort = Infinity }, { sort: sort2 = Infinity }) => sort - sort2) : undefined;
      findAndMergeCustomizedColumn(column, tableStore, customizedColumns);
      if (!column.lock) {
        groupedColumns.push(column);
      } else if (column.lock === true || column.lock === ColumnLock.left) {
        leftGroupedColumns.push(column);
      } else {
        rightGroupedColumns.push(column);
      }
      if (columnProps && !hasAggregation && columnProps.aggregation) {
        hasAggregation = true;
      }
    }
  });
  return [leftGroupedColumns, groupedColumns, rightGroupedColumns, hasAggregation];
}

function getHeaderGroupedColumns(tableStore: TableStore, groups: Group[], tableGroups: TableGroup[], columns: ColumnProps[], dataSet: DataSet, groupedColumns: ColumnProps[], customizedColumns?: { [key: string]: ColumnProps }, parentKey?: any): ColumnProps[] {
  const generatedColumns: Set<ColumnProps> = new Set();
  let headerUsed = false;
  groups.forEach((group) => {
    const { name, subGroups, value } = group;
    const key = parentKey ? `${parentKey}-${value}` : value;
    const subColumns = subGroups.length ? getHeaderGroupedColumns(tableStore, subGroups, tableGroups, columns, dataSet, groupedColumns, customizedColumns, key) : columns;
    const tableGroup = tableGroups.find(($tableGroup) => name === $tableGroup.name);
    if (tableGroup) {
      const { columnProps, name: groupName, hidden } = tableGroup;
      if (hidden) {
        subColumns.forEach(col => {
          const __originalKey = getColumnKey(col);
          const colKey = `${key}-${__originalKey}`;
          const newCol = {
            ...col,
            key: colKey,
            __tableGroup: tableGroup,
            __group: group,
            __groups: groups,
            __originalKey,
          };
          findAndMergeCustomizedColumn(newCol, tableStore, customizedColumns);
          newCol.lock = false;
          generatedColumns.add(newCol);
        });
      } else {
        const { length } = groupedColumns;
        if (length && !headerUsed) {
          headerUsed = true;
          const header = getHeader({
            ...columnProps,
            name: groupName,
            dataSet,
            group,
            groups,
          });
          if (header) {
            const oldColumn: ColumnProps = groupedColumns[length - 1];
            const newKey = `${key}-${getColumnKey(oldColumn)}`;
            const newColumn: ColumnProps = {
              ...columnProps,
              lock: oldColumn.lock,
              titleEditable: false,
              draggable: false,
              hideable: false,
              key: newKey,
              header,
              children: [oldColumn],
              __tableGroup: tableGroup,
            };
            const customizedColumn = getCustomizedColumnByKey(newKey, customizedColumns);
            mergeCustomizedColumn(newColumn, tableStore, customizedColumn);
            groupedColumns[length - 1] = newColumn;
          }
        }
        const renderer = columnProps && columnProps.renderer || defaultAggregationRenderer;
        const column = {
          ...columnProps,
          titleEditable: false,
          key,
          headerStyle: columnProps && columnProps.style,
          header: () => renderer({ dataSet, record: group.totalRecords[0], name: groupName, text: value, value, headerGroup: group }),
          children: treeMap(subColumns, (col => {
            const __originalKey = getColumnKey(col);
            const colKey = `${key}-${__originalKey}`;
            const newCol = { ...col, key: colKey, __originalKey };
            if (customizedColumns) {
              Object.assign(newCol, customizedColumns[__originalKey], customizedColumns[colKey]);
            }
            newCol.lock = false;
            return newCol;
          }), ({ sort = Infinity }, { sort: sort2 = Infinity }) => sort - sort2),
          __tableGroup: tableGroup,
          __group: group,
          __groups: groups,
        };
        findAndMergeCustomizedColumn(column, tableStore, customizedColumns);
        generatedColumns.add(column);
      }
    } else if (subColumns.length) {
      subColumns.forEach(column => generatedColumns.add(column));
    }
  });
  return [...generatedColumns];
}

export function normalizeGroupColumns(
  tableStore: TableStore,
  columns: ColumnProps[] | undefined,
  children: ReactNode,
  aggregation?: boolean,
  customizedColumns?: { [key: string]: ColumnProps },
): [ColumnProps[], ColumnProps[], ColumnProps[], boolean] {
  const { headerTableGroups, groups, dataSet } = tableStore;
  const hasHeaderGroup = headerTableGroups.length > 0;
  const generatedColumns = columns
    ? mergeDefaultProps(tableStore, columns, aggregation, customizedColumns)
    : normalizeColumns(tableStore, children, aggregation, customizedColumns);
  const [leftOriginalColumns, originalColumns, rightOriginalColumns, { hasAggregationColumn }] = generatedColumns;
  const [leftColumnGroupedColumns, columnGroupedColumns, rightColumnGroupedColumns, hasAggregationColumnGroup] = groups.length ?
    getColumnGroupedColumns(tableStore, groups, customizedColumns) :
    [[], [], [], false];
  if (hasHeaderGroup) {
    const groupedColumns = [...leftColumnGroupedColumns, ...columnGroupedColumns];
    const headerGroupedColumns = getHeaderGroupedColumns(tableStore, tableStore.groupedDataWithHeader, headerTableGroups!, [...leftOriginalColumns, ...originalColumns, ...rightOriginalColumns], dataSet, groupedColumns, customizedColumns);
    return [
      groupedColumns.map(observableColumn),
      headerGroupedColumns.map(observableColumn),
      rightColumnGroupedColumns.map(observableColumn),
      hasAggregationColumnGroup || hasAggregationColumn,
    ];
  }
  return [
    [...leftColumnGroupedColumns, ...leftOriginalColumns].map(observableColumn),
    [...columnGroupedColumns, ...originalColumns].map(observableColumn),
    [...rightOriginalColumns, ...rightColumnGroupedColumns].map(observableColumn),
    hasAggregationColumnGroup || hasAggregationColumn,
  ];
}

async function getHeaderTexts(
  dataSet: DataSet,
  columns: ColumnProps[],
  aggregation: boolean | undefined,
  headers: HeaderText[] = [],
): Promise<HeaderText[]> {
  const column = columns.shift();
  if (column) {
    headers.push({ name: column.name!, label: await getReactNodeText(getHeader({ ...column, dataSet, aggregation })) });
  }
  if (columns.length) {
    await getHeaderTexts(dataSet, columns, aggregation, headers);
  }
  return headers;
}

function autoHeightToStyle(autoHeight: { type: TableAutoHeightType, diff: number }, parentPaddingTop = 0): CSSProperties {
  const { type, diff } = autoHeight;
  const height = `calc(100% - ${diff + parentPaddingTop}px)`;
  if (type === TableAutoHeightType.minHeight) {
    return {
      height,
    };
  }
  return {
    maxHeight: height,
  };
}

export default class TableStore {
  configContext: ConfigContextValue;

  node: Table;

  editors: Map<string, TableEditor> = new Map();

  customizedLoaded?: boolean;

  props: TableProps;

  customized: TableCustomized;

  tempCustomized: TableCustomized;

  loading?: boolean;

  leftOriginalColumns: ColumnProps[];

  originalColumns: ColumnProps[];

  rightOriginalColumns: ColumnProps[];

  hasAggregationColumn?: boolean;

  calcBodyHeight: number | undefined;

  width?: number;

  lastScrollTop: number;

  lastScrollLeft: number;

  lockColumnsBodyRowsHeight: any;

  lockColumnsFootRowsHeight: any;

  lockColumnsHeadRowsHeight: any;

  expandedRows: (string | number)[];

  hoverRow?: Record;

  rowClicked?: boolean;

  currentEditorName?: string;

  styledHidden?: boolean;

  customizedActiveKey: string[];

  mouseBatchChooseStartId = 0;

  mouseBatchChooseEndId = 0;

  mouseBatchChooseState: boolean;

  mouseBatchChooseIdList: number[];

  columnResizing?: boolean;

  scrollPosition: ScrollPosition;

  inBatchExpansion = false;

  performanceOn = false;

  comboBarStatus: boolean;

  lastSelected?: Record;

  activeEmptyCell?: HTMLTableCellElement;

  timing: {
    renderStart: number;
    renderEnd: number;
  } = { renderStart: 0, renderEnd: 0 };

  siblingHeihgt?: { before?: number; after?: number };

  parentHeight?: number | undefined;

  parentPaddingTop?: number | undefined;

  screenHeight: number;

  headerHeight: number;

  footerHeight: number;

  headerFilter?: { fieldName?: string; filterText?: any; filter?: boolean | ((props: { record: Record; filterText?: string }) => boolean) }[];

  nextRenderColIndex?: [number, number];

  prevRenderColIndex?: [number, number];

  startChooseCell: { rowIndex: number; colIndex: number; target: HTMLElement } | null;

  endChooseCell: { rowIndex: number; colIndex: number; target: HTMLElement } | null;

  isFinishChooseCell: boolean;

  isCopyPristine: boolean;

  shiftKey: boolean;

  autoScrollRAF: number | null;

  copyChooseCleanup?: () => void;

  renderedCellText: WeakMap<Record, Map<Key, string>> = new WeakMap();

  renderedCellNode: WeakMap<Record, Map<Key, HTMLTableCellElement>> = new WeakMap();

  arrangeValue: ArrangeValue;

  dragCorner: boolean;

  dragCornerPosition: { x: number; y: number };

  batchExpandRowNumber: number;

  selectedDragRows: Record[];

  dragUpdateState?: DragUpdate;

  get styleHeight(): string | number | undefined {
    const { autoHeight, props: { style }, parentPaddingTop } = this;
    return autoHeight ? autoHeightToStyle(autoHeight, parentPaddingTop).height : style && style.height;
  }

  get styleMaxHeight(): string | number | undefined {
    const { autoHeight, props: { style }, parentPaddingTop } = this;
    return autoHeight ? autoHeightToStyle(autoHeight, parentPaddingTop).maxHeight : style && style.maxHeight;
  }

  get styleMinHeight(): string | number | undefined {
    const { props: { style } } = this;
    return style && toPx(style.minHeight, this.getRelationSize);
  }

  get computedHeight(): number | undefined {
    if (this.heightChangeable) {
      const {
        customized: { heightType, height, heightDiff },
        tempCustomized,
      } = this;
      const tempHeightType = get(tempCustomized, 'heightType');
      if (tempHeightType) {
        if (tempHeightType === TableHeightType.fixed) {
          return get(tempCustomized, 'height');
        }
        if (tempHeightType === TableHeightType.flex) {
          return this.screenHeight - (get(tempCustomized, 'heightDiff') || 0);
        }
        return undefined;
      }
      if (heightType) {
        if (heightType === TableHeightType.fixed) {
          return height;
        }
        if (heightType === TableHeightType.flex) {
          return this.screenHeight - (heightDiff || 0);
        }
        return undefined;
      }
    }
    return toPx(this.styleHeight, this.getRelationSize);
  }

  get otherHeight() {
    const { footerHeight, props: { boxSizing } } = this;
    const footerTotalHeight = footerHeight && this.overflowX ? measureScrollbar() + footerHeight : footerHeight;
    const otherHeight = this.headerHeight + footerTotalHeight;
    if (boxSizing === TableBoxSizing.wrapper) {
      const { before = 0, after = 0 } = this.siblingHeihgt || {};
      return otherHeight + before + after;
    }
    return otherHeight;
  }

  get height(): number | undefined {
    if (!this.isBodyExpanded) {
      return undefined;
    }
    const { computedHeight } = this;
    const maxHeight = toPx(this.styleMaxHeight, this.getRelationSize);
    const minHeight = toPx(this.styleMinHeight, this.getRelationSize);
    const isComputedHeight = isNumber(computedHeight);
    if (isComputedHeight || isNumber(minHeight) || isNumber(maxHeight)) {
      const { rowHeight, otherHeight } = this;
      const rowMinHeight = (isNumber(rowHeight) ? rowHeight : 30) + otherHeight;
      const minTotalHeight = minHeight ? Math.max(
        rowMinHeight,
        minHeight,
      ) : rowMinHeight;
      const height = defaultTo(computedHeight, this.bodyHeight + otherHeight);
      const totalHeight = Math.max(minTotalHeight, maxHeight ? Math.min(maxHeight, height) : height);
      return isComputedHeight || totalHeight !== height ? totalHeight - otherHeight : undefined;
    }
  }

  get totalHeight(): number {
    const { height, bodyHeight, otherHeight } = this;
    return defaultTo(height, bodyHeight) + otherHeight;
  }

  get bodyHeight(): number {
    if (this.propVirtual) {
      const { virtualHeight } = this;
      if (virtualHeight > 0) {
        return virtualHeight;
      }
    }
    return this.calcBodyHeight || 0;
  }

  get stickyLeft(): boolean {
    return [ScrollPosition.right, ScrollPosition.middle].includes(this.scrollPosition);
  }

  get stickyRight(): boolean {
    return [ScrollPosition.left, ScrollPosition.middle].includes(this.scrollPosition);
  }

  get performanceEnabled(): boolean {
    const performanceEnabled = this.getConfig('performanceEnabled');
    return performanceEnabled && performanceEnabled.Table;
  }

  get dataSet(): DataSet {
    return this.props.dataSet;
  }

  get duplicateKeyConfig(): DuplicateKeyConfig {
    const config: any = this.props.duplicateKey || this.getConfig('duplicateKey');
    const resolvedConfig = typeof config === 'function' ? config('Table') : config;
    return resolvedConfig || {};
  }

  get duplicatePrimaryKeyInfo(): { duplicateKeys: string[]; duplicateRecords: Set<Record> } {
    const duplicateKeyConfig = this.duplicateKeyConfig;
    if (!duplicateKeyConfig.disable && !duplicateKeyConfig.showWarning) {
      return { duplicateKeys: [], duplicateRecords: new Set() };
    }
    const { dataSet } = this;
    const { primaryKey } = dataSet.props;
    const recordsByKey = new Map<string, Record[]>();
    if (primaryKey) {
      dataSet.records.forEach(record => {
        const value = record.get(primaryKey);
        if (typeof value === 'string' || typeof value === 'number') {
          const key = String(value);
          const records = recordsByKey.get(key);
          if (records) {
            records.push(record);
          } else {
            recordsByKey.set(key, [record]);
          }
        }
      });
    }
    const duplicateKeys: string[] = [];
    const duplicateRecords = new Set<Record>();
    recordsByKey.forEach((records, key) => {
      if (records.length > 1) {
        duplicateKeys.push(key);
        records.forEach(record => duplicateRecords.add(record));
      }
    });
    return { duplicateKeys, duplicateRecords };
  }

  get prefixCls() {
    return this.node.prefixCls;
  }

  get customizable(): boolean | undefined {
    const { customizedCode } = this.props;
    const { props: { queryBarProps } } = this;
    const isSimpleMode = queryBarProps && queryBarProps.simpleMode;
    if (customizedCode || (this.queryBar === TableQueryBarType.comboBar && !isSimpleMode)) {
      if ('customizable' in this.props) {
        return this.props.customizable;
      }
      return this.getConfig('tableCustomizable') || this.node.reactiveContext.getCustomizable('Table');
    }
    return false;
  }

  /**
   * board 组件个性化按钮 in buttons
   */
  get customizedBtn(): boolean | undefined {
    const { customizedCode, boardCustomized } = this.props;
    if (customizedCode && boardCustomized) {
      return boardCustomized.customizedBtn;
    }
    return false;
  }

  get aggregation(): boolean | undefined {
    const { aggregation } = this.customized;
    if (aggregation !== undefined) {
      return aggregation;
    }
    const { aggregation: propAggregation } = this.props;
    return propAggregation;
  }

  get aggregationExpandType(): 'cell' | 'row' | 'column' {
    return this.customized.aggregationExpandType || 'cell';
  }

  get autoHeight(): { type: TableAutoHeightType; diff: number } | undefined {
    const { autoHeight } = this.props;
    if (autoHeight) {
      const defaultAutoHeight = {
        type: TableAutoHeightType.minHeight,
        diff: this.getConfig('tableAutoHeightDiff') || 80,
      };
      if (isObject(autoHeight)) {
        return {
          ...defaultAutoHeight,
          ...autoHeight,
        };
      }
      return defaultAutoHeight;
    }
    return undefined;
  }

  get heightType(): TableHeightType {
    if (this.heightChangeable) {
      const tempHeightType = get(this.tempCustomized, 'heightType');
      if (tempHeightType !== undefined) {
        return tempHeightType;
      }
      const { heightType } = this.customized;
      if (heightType !== undefined) {
        return heightType;
      }
    }
    return this.originalHeightType;
  }

  get originalHeightType(): TableHeightType {
    const { styleHeight } = this;
    if (styleHeight) {
      if (isString(styleHeight) && isCalcSize(styleHeight)) {
        return TableHeightType.flex;
      }
      if (isNumber(toPx(styleHeight))) {
        return TableHeightType.fixed;
      }
    }
    return TableHeightType.auto;
  }

  get virtualCell(): boolean | undefined {
    if ('virtualCell' in this.props) {
      return this.props.virtualCell!;
    }
    return this.getConfig('tableVirtualCell');
  }

  get isFixedRowHeight(): boolean {
    if (!this.aggregation || !this.hasAggregationColumn) {
      return isNumber(this.rowHeight);
    }
    return false;
  }

  get propVirtual(): boolean | undefined {
    if (this.isTree && this.rowDraggable) {
      return true;
    }
    if ('virtual' in this.props) {
      return this.props.virtual;
    }
    const configTableVirtual: boolean | Function | undefined = this.getConfig('tableVirtual');
    if (typeof configTableVirtual === 'function') {
      return configTableVirtual(this.currentData.length, this.columnGroups.leafs.length);
    }

    return configTableVirtual;
  }

  get virtual(): boolean | undefined {
    if (this.height !== undefined) {
      return this.propVirtual;
    }
    return false;
  }

  get columnBuffer(): number {
    const { columnBuffer } = this.props;
    if ('columnBuffer' in this.props && typeof columnBuffer === 'number' && columnBuffer >= 0) {
      return columnBuffer!;
    }
    const bufferConfig = this.getConfig('tableVirtualBuffer');
    if (bufferConfig && 'columnBuffer' in bufferConfig && typeof bufferConfig.columnBuffer === 'number' && bufferConfig.columnBuffer >= 0) {
      return bufferConfig.columnBuffer;
    }
    return 3;
  }

  get columnThreshold(): number {
    const { columnThreshold } = this.props;
    if ('columnThreshold' in this.props && typeof columnThreshold === 'number' && columnThreshold >= 0) {
      return columnThreshold!;
    }
    const bufferConfig = this.getConfig('tableVirtualBuffer');
    if (bufferConfig && 'columnThreshold' in bufferConfig && typeof bufferConfig.columnThreshold === 'number' && bufferConfig.columnThreshold >= 0) {
      return bufferConfig.columnThreshold;
    }
    return 3;
  }

  updateRenderZonePosition(): [number, number] {
    // 获取表格坐标显示范围
    if (!this.width) {
      return [0, 0];
    }
    const { columnGroups: { leafs, leftLeafs, rightLeafs, leftLeafColumnsWidth, rightLeafColumnsWidth }, columnThreshold, nextRenderColIndex } = this;
    const scrollLeft = this.lastScrollLeft || 0;

    let visibleColumnWidth = 0;
    let firstIndex = -1;
    let lastIndex = -1;
    const centerLeafsLength = leafs.length - rightLeafs.length;
    for (let i = leftLeafs.length; i < centerLeafsLength; i++) {
      const { width } = leafs[i];
      visibleColumnWidth += width;
      if (firstIndex === -1 && visibleColumnWidth > scrollLeft) {
        firstIndex = i;
      }
      if (
        (lastIndex === -1 && i === centerLeafsLength - 1) ||
        (this.width && visibleColumnWidth >= scrollLeft + this.width - leftLeafColumnsWidth - rightLeafColumnsWidth - (this.overflowY ? measureScrollbar() : 0))
      ) {
        lastIndex = i;
      }
      if (lastIndex !== -1 && firstIndex !== -1) {
        break;
      }
    }

    if (!nextRenderColIndex || (nextRenderColIndex && nextRenderColIndex.includes(lastIndex)) || (firstIndex < nextRenderColIndex[0] || lastIndex > nextRenderColIndex[1])) {
      this.nextRenderColIndex = [lastIndex - columnThreshold, Math.min(lastIndex + columnThreshold, leafs.length)];
      this.prevRenderColIndex = [firstIndex, lastIndex];
      return [firstIndex, lastIndex];
    }

    return this.prevRenderColIndex || [0, 0];

  }

  get virtualColumnRange(): {
    left?: [number, number];
    center: [number, number];
    right?: [number, number];
    } {
    const { columnGroups: { leafs, leftLeafs, rightLeafs }, columnBuffer } = this;
    if (!this.propVirtual || !this.overflowX) {
      return { center: [0, leafs.length] };
    }
    const rangeThreshold: {
      left?: [number, number];
      center: [number, number];
      right?: [number, number];
    } = { center: [0, 0] }

    // 左右固定列的坐标范围
    const leftColLength = leftLeafs.length;
    const rightColLength = rightLeafs.length;

    if (leftColLength) {
      rangeThreshold.left = [0, leftColLength];
    }
    if (rightColLength) {
      rangeThreshold.right = [leafs.length - rightColLength, leafs.length];
    }
    if (leftColLength + rightColLength === leafs.length) {
      rangeThreshold.center = [leftColLength, leftColLength];
      return rangeThreshold;
    }

    const [start, end] = this.updateRenderZonePosition();

    const first = Math.max(leftColLength, start - columnBuffer);
    const last = Math.min(leafs.length - rightColLength, end + columnBuffer + 1);

    rangeThreshold.center = [first, last];
    return rangeThreshold;
  }

  @autobind
  isRenderRange(index: number, isGroup?: boolean): boolean {
    const { virtualColumnRange, propVirtual } = this;
    if (!propVirtual || isGroup) {
      return true;
    }
    if (virtualColumnRange.left && (index >= virtualColumnRange.left[0] && index < virtualColumnRange.left[1])) {
      return true;
    }
    if (index >= virtualColumnRange.center[0] && index < virtualColumnRange.center[1]) {
      return true;
    }
    if (virtualColumnRange.right && index >= virtualColumnRange.right[0] && index <= virtualColumnRange.right[1]) {
      return true;
    }

    return false;
  }

  get blankVirtualCell() {
    const { virtualColumnRange } = this;
    const { left, center, right } = virtualColumnRange;
    return {
      left: [...Array(center[0] - (left ? left[1] : 0)).keys()].map((key) => <td key={`empty-left-${key}`} />),
      right: right ? [...Array(right[0] - center[1]).keys()].map((key) => <td key={`empty-right-${key}`} />) : [],
    }
  }

  get tableColumnResizeTransition(): boolean | undefined {
    return this.getConfig('tableColumnResizeTransition');
  }

  actualRows: number | undefined;

  rowMetaData?: VirtualRowMetaData[] | undefined;

  lastMeasuredIndex = 0;

  scrolling: boolean | undefined;

  cellVerticalSize: number | undefined;

  get virtualRowHeight(): number {
    const { rowHeight, cellVerticalSize = 3 } = this;
    const normalRowHeight = scaleSize(isNumber(rowHeight) ? rowHeight + cellVerticalSize : 30 + cellVerticalSize);
    return this.aggregation && this.hasAggregationColumn ? normalRowHeight * 4 : normalRowHeight;
  }

  get virtualEstimatedRows() {
    const { rowMetaData } = this;
    if (rowMetaData) {
      return rowMetaData.length;
    }
    const { actualRows } = this;
    if (actualRows !== undefined) {
      return actualRows;
    }
    return this.data.length;
  }

  get virtualHeight(): number {
    const { virtualRowHeight, virtualEstimatedRows } = this;
    if (!virtualEstimatedRows) {
      return 0;
    }
    const { rowMetaData } = this;
    if (rowMetaData) {
      let { lastMeasuredIndex } = this;
      let totalSizeOfMeasuredItems = 0;

      if (lastMeasuredIndex >= virtualEstimatedRows) {
        lastMeasuredIndex = virtualEstimatedRows - 1;
      }

      if (lastMeasuredIndex >= 0) {
        const itemMetadata = rowMetaData[lastMeasuredIndex];
        if (itemMetadata) {
          totalSizeOfMeasuredItems = itemMetadata.offset + itemMetadata.height;
        }
      }

      const numUnmeasuredItems = virtualEstimatedRows - lastMeasuredIndex - 1;
      const totalSizeOfUnmeasuredItems = numUnmeasuredItems * virtualRowHeight;

      return totalSizeOfMeasuredItems + totalSizeOfUnmeasuredItems;
    }
    return Math.round(virtualEstimatedRows * virtualRowHeight);
  }

  get virtualVisibleStartIndex(): number {
    return getVisibleStartIndex(this);
  }

  get virtualVisibleEndIndex(): number {
    return getVisibleEndIndex(this);
  }

  get virtualStartIndex(): number {
    return getStartIndex(this);
  }

  get virtualEndIndex(): number {
    return getEndIndex(this);
  }

  get virtualTop(): number {
    const { virtualRowHeight, virtualStartIndex } = this;
    const { rowMetaData } = this;
    if (rowMetaData && rowMetaData.length) {
      return rowMetaData[virtualStartIndex].offset;
    }
    return virtualStartIndex * virtualRowHeight;
  }

  get hidden(): boolean | undefined {
    return this.styledHidden || this.props.hidden;
  }

  get alwaysShowRowBox(): boolean {
    if ('alwaysShowRowBox' in this.props) {
      return this.props.alwaysShowRowBox!;
    }
    const alwaysShowRowBox = this.getConfig('tableAlwaysShowRowBox');
    if (typeof alwaysShowRowBox !== 'undefined') {
      return alwaysShowRowBox;
    }
    return false;
  }

  get keyboard(): boolean {
    if ('keyboard' in this.props) {
      return this.props.keyboard!;
    }
    const keyboard = this.getConfig('tableKeyboard');
    if (typeof keyboard !== 'undefined') {
      return keyboard;
    }
    return false;
  }

  get columnResizable(): boolean {
    if (this.currentEditRecord) {
      return false;
    }
    if ('columnResizable' in this.props) {
      return this.props.columnResizable !== false;
    }
    return this.getConfig('tableColumnResizable') !== false;
  }

  /**
   * 自定义样式对表格的横向缩放倍数，用于矫正列宽拖拽的计算
   */
  get xZoom(): number {
    const { columnResizable = this.getConfig('tableColumnResizable') } = this.props;
    if (typeof columnResizable === 'boolean') {
      return 1;
    }
    const { xZoom = 1 } = columnResizable || {};
    return xZoom;
  }

  get columnHideable(): boolean {
    if ('columnHideable' in this.props) {
      return this.props.columnHideable!;
    }
    return this.getConfig('tableColumnHideable') !== false;
  }

  /**
   * 表头支持编辑
   */
  get columnTitleEditable(): boolean {
    if ('columnTitleEditable' in this.props) {
      return this.props.columnTitleEditable!;
    }
    return this.getConfig('tableColumnTitleEditable') === true;
  }

  get heightChangeable(): boolean {
    if ('heightChangeable' in this.props) {
      return this.props.heightChangeable!;
    }
    return this.getConfig('tableHeightChangeable') === true;
  }

  get pagination(): TablePaginationConfig | false | undefined {
    if ('pagination' in this.props) {
      return this.props.pagination;
    }
    return this.getConfig('pagination');
  }

  get pageSizeChangeable(): boolean {
    if ('pageSizeChangeable' in this.props) {
      return this.props.pageSizeChangeable!;
    }
    return this.getConfig('tablePageSizeChangeable') === true;
  }

  get dragColumnAlign(): DragColumnAlign | undefined {
    if ('dragColumnAlign' in this.props) {
      return this.props.dragColumnAlign;
    }
    return this.getConfig('tableDragColumnAlign');
  }

  get columnDraggable(): boolean {
    if ('columnDraggable' in this.props) {
      return this.props.columnDraggable!;
    }
    if ('dragColumn' in this.props) {
      return this.props.dragColumn!;
    }
    if (this.getConfig('tableColumnDraggable') === true) {
      return true;
    }
    return this.getConfig('tableDragColumn') === true;
  }

  get rowDraggable(): boolean | 'multiDrag' {
    if (this.groups.length) {
      return false;
    }
    if ('rowDraggable' in this.props) {
      return this.props.rowDraggable!;
    }
    if ('dragRow' in this.props) {
      return this.props.dragRow!;
    }
    const tableRowDraggable = this.getConfig('tableRowDraggable') as boolean | 'multiDrag' | undefined;
    if (tableRowDraggable === true || tableRowDraggable === 'multiDrag') {
      return tableRowDraggable;
    }
    return this.getConfig('tableDragRow') === true;
  }

  get customDragDropContenxt(): boolean {
    if ('customDragDropContenxt' in this.props) {
      return this.rowDraggable && this.props.customDragDropContenxt!;
    }
    return false;
  }

  get size(): Size {
    const { size } = this.customized;
    const tableSize = this.getConfig('tableSize');
    if (size !== undefined) {
      return size;
    }
    return this.props.size || tableSize || Size.default;
  }

  get rowHeight(): 'auto' | number {
    const { rowHeight = defaultTo(this.getConfig('tableRowHeight'), 30) } = this.props;
    const { size } = this;
    if (typeof rowHeight === 'function') {
      return rowHeight({ size });
    }
    if (isNumber(rowHeight)) {
      switch (size) {
        case Size.large:
          return rowHeight + 2;
        case Size.small:
          return rowHeight - 2;
        default:
      }
    }
    return rowHeight;
  }

  get headerRowHeight(): 'auto' | number {
    const { headerRowHeight = this.getConfig('tableHeaderRowHeight') } = this.props;
    if (headerRowHeight === undefined) {
      return this.rowHeight;
    }
    const { size } = this;
    if (typeof headerRowHeight === 'function') {
      return headerRowHeight({ size });
    }
    if (isNumber(headerRowHeight)) {
      switch (size) {
        case Size.large:
          return headerRowHeight + 2;
        case Size.small:
          return headerRowHeight - 2;
        default:
      }
    }
    return headerRowHeight;
  }

  get footerRowHeight(): 'auto' | number {
    const { footerRowHeight = this.getConfig('tableFooterRowHeight') } = this.props;
    if (footerRowHeight === undefined) {
      return this.rowHeight;
    }
    const { size } = this;
    if (typeof footerRowHeight === 'function') {
      return footerRowHeight({ size });
    }
    if (isNumber(footerRowHeight)) {
      switch (size) {
        case Size.large:
          return footerRowHeight + 2;
        case Size.small:
          return footerRowHeight - 2;
        default:
      }
    }
    return footerRowHeight;
  }

  get autoFootHeight(): boolean {
    if ('autoFootHeight' in this.props) {
      return this.props.autoFootHeight!;
    }
    return false;
  }

  get emptyText(): ReactNode {
    const { renderEmpty } = this.props;
    if (renderEmpty) {
      return renderEmpty();
    }
    return this.getConfig('renderEmpty')('Table');
  }

  get highLightRow(): boolean | string {
    if ('highLightRow' in this.props) {
      return this.props.highLightRow!;
    }
    return this.getConfig('tableHighLightRow');
  }

  get parityRow(): boolean {
    const { parityRow } = this.customized;
    if (parityRow !== undefined) {
      return parityRow;
    }
    if ('parityRow' in this.props) {
      return this.props.parityRow!;
    }
    return this.getConfig('tableParityRow') === true;
  }

  get showRemovedRow(): boolean {
    if ('showRemovedRow' in this.props) {
      return this.props.showRemovedRow!;
    }
    return this.getConfig('tableShowRemovedRow') === true;
  }

  get autoFocus(): boolean {
    if ('autoFocus' in this.props) {
      return this.props.autoFocus!;
    }
    return this.getConfig('tableAutoFocus') !== false;
  }

  get selectedHighLightRow(): boolean {
    if ('selectedHighLightRow' in this.props) {
      return this.props.selectedHighLightRow!;
    }
    return this.getConfig('tableSelectedHighLightRow') !== false;
  }

  get editorNextKeyEnterDown(): boolean {
    if ('editorNextKeyEnterDown' in this.props) {
      return this.props.editorNextKeyEnterDown!;
    }
    return this.getConfig('tableEditorNextKeyEnterDown') !== false;
  }

  get border(): boolean {
    if ('border' in this.props) {
      return this.props.border!;
    }
    return this.getConfig('tableBorder') !== false;
  }

  get columnEditorBorder(): boolean {
    if ('columnEditorBorder' in this.props) {
      return this.props.columnEditorBorder!;
    }
    const tableColumnEditorBorder = this.getConfig('tableColumnEditorBorder');
    if (tableColumnEditorBorder !== undefined) {
      return tableColumnEditorBorder;
    }
    return this.border;
  }

  get queryBar(): TableQueryBarType | TableQueryBarHook | undefined {
    return this.props.queryBar || this.getConfig('queryBar');
  }

  get expandIcon(): ((props: expandIconProps) => ReactNode) | undefined {
    return this.props.expandIcon || this.getConfig('tableExpandIcon');
  }

  get tableColumnResizeTrigger(): TableColumnResizeTriggerType {
    return this.getConfig('tableColumnResizeTrigger');
  }

  // get pristine(): boolean | undefined {
  //   return this.props.pristine;
  // }

  get currentEditRecord(): Record | undefined {
    return this.dataSet.find(record => record.editing === true);
  }

  set currentEditRecord(record: Record | undefined) {
    runInAction(() => {
      const { currentEditRecord, dataSet } = this;
      if (currentEditRecord) {
        if (currentEditRecord.isNew) {
          dataSet.remove(currentEditRecord);
        } else {
          currentEditRecord.reset();
          currentEditRecord.editing = false;
        }
      }
      if (record) {
        record.editing = true;
      }
    });
  }

  showCachedSelection?: boolean;

  defaultRecordCachedType?: RecordCachedType;

  recordCachedType?: RecordCachedType;

  get computedRecordCachedType(): RecordCachedType | undefined {
    return this.recordCachedType || this.defaultRecordCachedType;
  }

  get isTree(): boolean {
    return this.props.mode === TableMode.tree;
  }

  get editing(): boolean {
    return this.currentEditorName !== undefined || this.currentEditRecord !== undefined;
  }

  get hasRowBox(): boolean {
    const { dataSet, selectionMode } = this.props;
    const { alwaysShowRowBox } = this;
    if (dataSet) {
      const { selection } = dataSet;
      return selection && ((selectionMode && [SelectionMode.rowbox, SelectionMode.dblclick].includes(selectionMode)) || alwaysShowRowBox);
    }
    return false;
  }

  get useMouseBatchChoose(): boolean {
    const { useMouseBatchChoose } = this.props;
    if (useMouseBatchChoose !== undefined) {
      return useMouseBatchChoose;
    }
    return this.getConfig('tableUseMouseBatchChoose');
  }

  get showCachedTips(): boolean {
    const { showCachedTips } = this.props;
    if (showCachedTips !== undefined) {
      return showCachedTips;
    }
    const tableShowCachedTips = this.getConfig('tableShowCachedTips');
    if (tableShowCachedTips !== undefined) {
      return tableShowCachedTips;
    }
    return false;
  }

  get showSelectionTips(): boolean {
    const { showSelectionTips } = this.props;
    if (showSelectionTips !== undefined) {
      return showSelectionTips;
    }
    const tableShowSelectionTips = this.getConfig('tableShowSelectionTips');
    if (tableShowSelectionTips !== undefined) {
      return tableShowSelectionTips;
    }
    return false;
  }

  get overflowX(): boolean {
    const { width } = this;
    if (width !== undefined) {
      return this.columnGroups.width > width;
    }
    return false;
  }

  get overflowY(): boolean {
    const { bodyHeight, height } = this;
    return (
      bodyHeight !== undefined &&
      height !== undefined &&
      height < bodyHeight + (!this.hasFooter && this.overflowX ? measureScrollbar() : 0)
    );
  }

  get hasRowGroups(): boolean {
    if (this.cachedData.length) {
      return true;
    }
    const { groups } = this;
    if (groups) {
      return groups.some(({ type }) => type === GroupType.row);
    }
    return false;
  }

  get headerTableGroups(): TableGroup[] {
    const { groups } = this;
    return groups ? groups.filter(({ type }) => type === GroupType.header) : [];
  }

  @autobind
  customizedColumnHeader() {
    if (this.queryBar === TableQueryBarType.comboBar) {
      return <ComboCustomizationSettings />;
    }
    return <CustomizationColumnHeader customizedBtn={this.customizedBtn} onHeaderClick={this.openCustomizationModal} />;
  }

  get customizedColumn(): ColumnProps | undefined {
    if (this.customizable && !this.customizedBtn && (!this.rowDraggable || this.dragColumnAlign !== DragColumnAlign.right)) {
      const { customizedColumnProps = {} } = this.props;
      const defaultProps = {
        key: CUSTOMIZED_KEY,
        resizable: false,
        titleEditable: false,
        align: ColumnAlign.center,
        width: scaleSize(30),
        lock: ColumnLock.right,
        header: this.customizedColumnHeader,
        headerClassName: `${this.prefixCls}-customized-column`,
      };
      return isFunction(customizedColumnProps)
        ? { ...defaultProps, ...customizedColumnProps(defaultProps) }
        : { ...defaultProps, ...customizedColumnProps };
    }
    return undefined;
  }

  get expandColumn(): ColumnProps | undefined {
    if (this.expandIconAsCell) {
      return {
        key: EXPAND_KEY,
        resizable: false,
        titleEditable: false,
        align: ColumnAlign.center,
        width: scaleSize(50),
        lock: true,
      };
    }
    return undefined;
  }

  get rowNumberColumn(): ColumnProps | undefined {
    const { rowNumber, rowNumberColumnProps = {} } = this.props;
    if (rowNumber) {
      const defaultProps = {
        key: ROW_NUMBER_KEY,
        resizable: true,
        titleEditable: false,
        headerClassName: `${this.prefixCls}-row-number-column`,
        renderer: this.renderRowNumber,
        tooltip: TableColumnTooltip.overflow,
        align: ColumnAlign.center,
        width: scaleSize(50),
        lock: true,
      };
      return isFunction(rowNumberColumnProps)
        ? { ...defaultProps, ...rowNumberColumnProps(defaultProps) }
        : { ...defaultProps, ...rowNumberColumnProps };
    }
    return undefined;
  }

  get selectionColumn(): ColumnProps | undefined {
    if (this.hasRowBox) {
      const { dataSet, prefixCls } = this;
      const { rowBoxPlacement, selectionColumnProps = {} } = this.props;
      const { lock: sLock, className, headerClassName, footerClassName, ...rest } = selectionColumnProps;
      const sClassName = `${prefixCls}-selection-column`;

      let lock: ColumnLock | boolean = sLock || ColumnLock.left;
      if (rowBoxPlacement === RowBoxPlacement.start) {
        lock = ColumnLock.left;
      } else if (rowBoxPlacement === RowBoxPlacement.end) {
        lock = ColumnLock.right;
      } else {
        lock = false;
      }

      const selectionColumn: ColumnProps = {
        key: SELECTION_KEY,
        resizable: false,
        titleEditable: false,
        renderer: this.renderSelectionBox,
        align: ColumnAlign.center,
        width: scaleSize(50),
        headerClassName: classNames(sClassName, headerClassName),
        className: classNames(sClassName, className),
        footerClassName: classNames(sClassName, footerClassName),
        lock,
        ...rest,
      };
      if (dataSet && dataSet.selection === DataSetSelection.multiple) {
        selectionColumn.header = 'header' in rest ? rest.header : this.multipleSelectionRenderer;
        selectionColumn.footer = 'footer' in rest ? rest.footer : this.multipleSelectionRenderer;
      }
      return selectionColumn;
    }
    return undefined;
  }

  get comboQueryColumn(): ColumnProps | undefined {
    if (this.queryBar === TableQueryBarType.comboBar) {
      const { prefixCls, props: { queryBarProps } } = this;
      const showInlineSearch = queryBarProps && queryBarProps.inlineSearch;
      const showInlineSearchRender = queryBarProps && queryBarProps.inlineSearchRender;
      const className = `${prefixCls}-inline-query`;

      const lock: ColumnLock | boolean = ColumnLock.left;

      const queryColumn: ColumnProps = {
        key: COMBOBAR_KEY,
        header: (
          showInlineSearch && (
            <Icon
              type="manage_search"
              className={className}
              onClick={action(
                () => {
                  this.comboBarStatus = !this.comboBarStatus;
                  this.node.handleHeightTypeChange();
                })}
            />
          )
        ),
        resizable: false,
        titleEditable: false,
        headerClassName: className,
        className,
        footerClassName: className,
        renderer: () => queryBarProps && queryBarProps.inlineSearchRender,
        align: ColumnAlign.center,
        width: scaleSize(50),
        lock,
      };
      return showInlineSearch === true || showInlineSearchRender ? queryColumn : undefined;
    }
    return undefined;
  }

  get draggableColumn(): ColumnProps | undefined {
    const { dragColumnAlign, rowDraggable, prefixCls } = this;
    if (dragColumnAlign && rowDraggable) {
      const draggableColumn: ColumnProps = {
        key: DRAG_KEY,
        resizable: false,
        titleEditable: false,
        className: `${prefixCls}-drag-column`,
        renderer: this.renderDragBox,
        align: ColumnAlign.center,
        width: scaleSize(50),
      };
      if (dragColumnAlign === DragColumnAlign.left) {
        draggableColumn.lock = ColumnLock.left;
      }

      if (dragColumnAlign === DragColumnAlign.right) {
        draggableColumn.lock = ColumnLock.right;
        draggableColumn.header = this.customizable && this.customizedColumnHeader;
      }
      return draggableColumn;
    }
    return undefined;
  }

  get leftColumns(): ColumnProps[] {
    const { dragColumnAlign, leftOriginalColumns, expandColumn, expandIconColumnIndex, draggableColumn, rowNumberColumn, selectionColumn, comboQueryColumn } = this;
    const rowSelectCols = rowNumberColumn && (rowNumberColumn.rowNumberIndex || 0) > 0 ? [
      selectionColumn && selectionColumn.lock === ColumnLock.left ? selectionColumn : undefined,
      rowNumberColumn,
    ] : [
      rowNumberColumn,
      selectionColumn && selectionColumn.lock === ColumnLock.left ? selectionColumn : undefined,
    ];
    return observable.array([
      expandIconColumnIndex ? undefined : expandColumn,
      dragColumnAlign === DragColumnAlign.left ? draggableColumn : undefined,
      ...rowSelectCols,
      comboQueryColumn,
      ...leftOriginalColumns,
    ].filter<ColumnProps>(columnFilter).map(observableColumn));
  }

  get rightColumns(): ColumnProps[] {
    const { dragColumnAlign, rightOriginalColumns, draggableColumn, customizedColumn, selectionColumn } = this;
    return observable.array([
      ...rightOriginalColumns,
      dragColumnAlign === DragColumnAlign.right ? draggableColumn : undefined,
      selectionColumn && selectionColumn.lock === ColumnLock.right ? selectionColumn : undefined,
      customizedColumn,
    ].filter<ColumnProps>(columnFilter).map(observableColumn));
  }

  get columns(): ColumnProps[] {
    const { leftColumns, rightColumns, selectionColumn, expandColumn, expandIconColumnIndex, props: { rowBoxPlacement } } = this;
    const originalColumns = this.originalColumns.slice();
    if (isNumber(rowBoxPlacement) && selectionColumn) {
      originalColumns.splice(rowBoxPlacement as number, 0, selectionColumn);
    }
    const allColumns = Array.from([
      ...leftColumns,
      ...originalColumns,
      ...rightColumns,
    ]);
    if (expandIconColumnIndex && expandColumn) {
      let lock: boolean | ColumnLock = true;
      if (expandIconColumnIndex > leftColumns.length && expandIconColumnIndex <= leftColumns.length + originalColumns.length) {
        lock = false;
      } else if (expandIconColumnIndex > leftColumns.length + originalColumns.length) {
        lock = ColumnLock.right;
      }
      allColumns.splice(expandIconColumnIndex, 0, { ...expandColumn, lock });
    }
    return observable.array(allColumns.map(observableColumn));
  }

  get columnGroups(): ColumnGroups {
    return new ColumnGroups(this.columns, this);
  }

  get leftColumnGroups(): ColumnGroups {
    return new ColumnGroups(this.leftColumns, this);
  }

  get rightColumnGroups(): ColumnGroups {
    return new ColumnGroups(this.rightColumns, this);
  }

  get leafNamedColumns(): ColumnProps[] {
    return this.columnGroups.allLeafs.reduce<ColumnProps[]>((list, { column }) => column.name ? list.concat(column) : list, []);
  }

  get hasEmptyWidthColumn(): boolean {
    return this.columnGroups.leafs.some(({ column }) => isNil(get(column, 'width')));
  }

  get getLastEmptyWidthColumn(): ColumnProps | undefined {
    const emptyWidthColumns = this.columnGroups.leafs.filter(({ column }) => isNil(get(column, 'width')));
    return emptyWidthColumns.length ? emptyWidthColumns[emptyWidthColumns.length - 1].column : undefined;
  }

  get hasCheckFieldColumn(): boolean {
    const { checkField } = this.dataSet.props;
    if (checkField) {
      const { aggregation } = this;
      return this.columnGroups.leafs.some(({ column }) => aggregation
        ? treeSome<ColumnProps>([column], (c) => hasCheckField(c, checkField))
        : hasCheckField(column, checkField),
      );
    }
    return false;
  }

  get hasFooter(): boolean {
    return this.columnGroups.leafs.some(({ column }) => !!column.footer && column.key !== SELECTION_KEY);
  }

  get isAnyColumnsLeftLock(): boolean {
    return this.leftColumns.length > 0;
  }

  get isAnyColumnsRightLock(): boolean {
    return this.rightColumns.length > 0;
  }

  get isAnyColumnsLock(): boolean {
    return this.isAnyColumnsLeftLock || this.isAnyColumnsRightLock;
  }

  get isCombinedColumn(): boolean {
    const columns = this.columns;
    const combinedColumn = columns.find(column => !column.aggregation && column.children && column.children.length > 0);
    return !isNil(combinedColumn);
  }

  groups: TableGroup[];

  groupedData: Group[];

  groupedDataWithHeader: Group[];

  get cachedDataInType(): Record[] {
    const { dataSet, showCachedSelection, computedRecordCachedType = RecordCachedType.selected } = this;
    if (showCachedSelection) {
      switch (computedRecordCachedType) {
        case RecordCachedType.selected:
          return dataSet.cachedSelected;
        case RecordCachedType.add:
          return dataSet.cachedCreated;
        case RecordCachedType.update:
          return dataSet.cachedUpdated;
        case RecordCachedType.delete:
          return dataSet.cachedDestroyed;
        default:
      }
    }
    return [];
  }

  get cachedData(): Record[] {
    const { dataSet, showCachedSelection } = this;
    if (showCachedSelection) {
      return dataSet.cachedRecords;
    }
    return [];
  }

  get currentData(): Record[] {
    const { pristine, filter: recordFilter, treeFilter } = this.props;
    const { dataSet, isTree, headerFilter: headerFilterArr } = this;
    const filter = (
      isTree
        ? typeof treeFilter === 'function' ? treeFilter : recordFilter
        : recordFilter
    );
    let data = isTree ? dataSet.treeRecords : dataSet.records;
    if (typeof filter === 'function') {
      data = data.filter(filter);
    }
    if (pristine) {
      data = data.filter(record => !record.isNew);
    }
    if (headerFilterArr && headerFilterArr.length) {
      headerFilterArr.forEach(headerFilter => {
        const { filter, filterText } = headerFilter;
        if (typeof filter === 'function') {
          data = data.filter(record => filter({ record, filterText }));
        } else {
          const field = dataSet.getField(headerFilter.fieldName);
          const type = field && field.get('type');
          const multiple = field && field.get('multiple');
          let isLookUp = false;
          if (field &&
            (
              field.get('lookupCode') ||
              isString(field.get('lookupUrl')) ||
              (type !== FieldType.object && (field.get('lovCode') || field.getLookup() || field.get('options'))) ||
              field.get('lovCode')
            )
          ) {
            isLookUp = true;
          }
          data = data.filter(record => {
            let recordText: string;
            const fieldValue = record.get(headerFilter.fieldName);
            if (multiple) {
              if (isLookUp) {
                recordText = fieldValue.map(value => field!.getText(value)).join('');
              } else {
                recordText = fieldValue.map(value => {
                  return isMoment(value) ? value.format(getDateFormatByField(field, undefined, record)) : value;
                }).join('');
              }
            } else {
              recordText = isLookUp
                ? String(field!.getText(fieldValue))
                : String(isMoment(fieldValue) ? fieldValue.format(getDateFormatByField(field, undefined, record)) : fieldValue);
            }
            return recordText.toLocaleLowerCase().includes(String(headerFilter.filterText).toLocaleLowerCase())
          });
        }
      });
    }
    return data;
  }

  get treeFilter(): ((record: Record) => boolean) | undefined {
    const { props: { treeFilter } } = this;
    return treeFilter;
  }

  get data(): Record[] {
    return [...this.cachedData, ...this.currentData];
  }

  get selectionFilter(): (record: Record) => boolean {
    const { filter } = this.props;
    const { duplicateRecords } = this.duplicatePrimaryKeyInfo;
    return record => (!filter || filter(record)) &&
      (!this.duplicateKeyConfig.disable || !duplicateRecords.has(record));
  }

  get cachedIndeterminate(): boolean {
    const { dataSet, showCachedSelection, selectionFilter } = this;
    if (dataSet) {
      const [cachedSelectedLength, cachedRecordsLength] = showCachedSelection ?
        getCachedSelectableCounts(dataSet, this.computedRecordCachedType, this.showCachedTips, selectionFilter) : [0, 0];
      if (cachedSelectedLength) {
        return cachedSelectedLength !== cachedRecordsLength;
      }
    }
    return false;
  }

  get allCachedChecked(): boolean {
    const { dataSet, showCachedSelection, selectionFilter } = this;
    if (dataSet) {
      const [cachedSelectedLength, cachedRecordsLength] = showCachedSelection ?
        getCachedSelectableCounts(dataSet, this.computedRecordCachedType, this.showCachedTips, selectionFilter) : [0, 0];
      if (cachedSelectedLength) {
        return cachedSelectedLength === cachedRecordsLength;
      }
    }
    return false;
  }

  get currentIndeterminate(): boolean {
    const { dataSet, selectionFilter } = this;
    if (dataSet) {
      const [selectedLength, currentLength] = getCurrentSelectableCounts(dataSet, selectionFilter);
      if (selectedLength) {
        return selectedLength !== currentLength;
      }
    }
    return false;
  }

  get allCurrentChecked(): boolean {
    const { dataSet, selectionFilter } = this;
    if (dataSet) {
      const [selectedLength, currentLength] = getCurrentSelectableCounts(dataSet, selectionFilter);
      if (selectedLength) {
        return selectedLength === currentLength;
      }
    }
    return false;
  }

  get indeterminate(): boolean {
    const { showCachedSelection } = this;
    if (showCachedSelection) {
      const { dataSet, selectionFilter } = this;
      const [cachedSelectedLength, cachedRecordsLength] =
        getCachedSelectableCounts(dataSet, this.computedRecordCachedType, this.showCachedTips, selectionFilter);
      const [currentSelectedLength, currentRecordsLength] = getCurrentSelectableCounts(dataSet, selectionFilter);
      const allLength = cachedSelectedLength + currentSelectedLength;
      return !!allLength && allLength !== (cachedRecordsLength + currentRecordsLength);
    }
    return this.currentIndeterminate;
  }

  get allChecked(): boolean {
    const { showCachedSelection } = this;
    if (showCachedSelection) {
      const { dataSet, selectionFilter } = this;
      const [cachedSelectedLength, cachedRecordsLength] =
        getCachedSelectableCounts(dataSet, this.computedRecordCachedType, this.showCachedTips, selectionFilter);
      const [currentSelectedLength, currentRecordsLength] = getCurrentSelectableCounts(dataSet, selectionFilter);
      const allLength = cachedSelectedLength + currentSelectedLength;
      return !!allLength && allLength === (cachedRecordsLength + currentRecordsLength);
    }
    return this.allCurrentChecked;
  }

  get expandIconAsCell(): boolean {
    const { expandedRowRenderer, expandIconAsCell } = this.props;
    if (expandIconAsCell !== undefined) {
      return expandIconAsCell;
    }
    return !!expandedRowRenderer && !this.isTree;
  }

  get expandIconColumnIndex(): number {
    const {
      dragColumnAlign,
      rowDraggable,
      props: { expandIconColumnIndex = 0, rowNumber, rowBoxPlacement },
    } = this;
    if ((!expandIconColumnIndex || typeof expandIconColumnIndex !== 'number') && !this.isTree) {
      return 0;
    }
    const index = expandIconColumnIndex + [rowNumber, dragColumnAlign && rowDraggable, !!this.comboQueryColumn].filter(Boolean).length;
    return this.hasRowBox && !isNumber(rowBoxPlacement) && rowBoxPlacement !== RowBoxPlacement.end ? index + 1 : index;
  }

  get inlineEdit() {
    return this.props.editMode === TableEditMode.inline;
  }

  get clipboard(): Clipboard | undefined {
    if ('clipboard' in this.props) {
      return this.props.clipboard;
    }
    return undefined;
  }

  get combineSortConfig(): CombineSortConfig | undefined {
    const { combineSortConfig } = this.props;
    // 如果存在 showSortOption，走历史逻辑
    if (combineSortConfig && combineSortConfig.showSortOption) {
      return combineSortConfig;
    }
    if (combineSortConfig) {
      const { 
        currentDataSort,
        allDataSort,
      } = combineSortConfig;
      const processConfig: CombineSortConfig = {
        showSortOption: SortRangeOption.allDataSort,
      };

      // 兼容 currentDataSort
      if (typeof currentDataSort === 'object' && currentDataSort.enable === false) {
        processConfig.currentDataSort = false;
      } else if (typeof currentDataSort === 'object') {
        processConfig.currentDataSort = true;
      }
      if (typeof currentDataSort === 'object' && typeof currentDataSort.customFn  ==='function') {
        processConfig.currentDataSort = currentDataSort.customFn;
      }


      // 兼容 allDataSort
      if (typeof allDataSort === 'object' && allDataSort.enable !== false) {
        processConfig.allDataSort = true;
      } else {
        processConfig.allDataSort = false;
      }
      // 兼容 showSortOption, allDataSort 优先级更高
      if (typeof currentDataSort === 'object' && currentDataSort.show) {
        processConfig.showSortOption = SortRangeOption.currentDataSort;
      }
      if (typeof allDataSort === 'object' && allDataSort.show) {
        processConfig.showSortOption = SortRangeOption.allDataSort;
      }
      return processConfig;
    }
    return undefined;
  }

  get addNewButton(): boolean | undefined {
    const { addNewButton, pristine } = this.props;
    return addNewButton && !pristine;
  }

  checkAllCurrent() {
    const { dataSet, selectionFilter } = this;
    dataSet.selectAll(selectionFilter);
  }

  unCheckAllCurrent() {
    const { dataSet, selectionFilter } = this;
    dataSet.unSelectAll(selectionFilter);
  }

  checkAllCached() {
    if (this.showCachedSelection) {
      const { dataSet, selectionFilter } = this;
      dataSet.batchSelect(
        getCachedSelectableRecords(dataSet, this.computedRecordCachedType, this.showCachedTips, selectionFilter),
      );
    }
  }

  unCheckAllCached() {
    if (this.showCachedSelection) {
      const { dataSet, selectionFilter } = this;
      dataSet.batchUnSelect(
        getCachedSelectableRecords(dataSet, this.computedRecordCachedType, this.showCachedTips, selectionFilter),
      );
    }
  }

  private handleSelectAllChange = action(() => {
    if (this.allChecked) {
      this.unCheckAllCurrent();
      this.unCheckAllCached();
    } else {
      this.checkAllCurrent();
      this.checkAllCached();
    }
  });

  constructor(node: Table) {
    if (!Object.prototype.hasOwnProperty.call(this, 'props')) Object.assign(this, { props: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'customized')) Object.assign(this, { customized: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'tempCustomized')) Object.assign(this, { tempCustomized: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'loading')) this.loading = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'leftOriginalColumns')) Object.assign(this, { leftOriginalColumns: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'originalColumns')) Object.assign(this, { originalColumns: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'rightOriginalColumns')) Object.assign(this, { rightOriginalColumns: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'hasAggregationColumn')) this.hasAggregationColumn = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'calcBodyHeight')) this.calcBodyHeight = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'width')) this.width = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'lastScrollTop')) Object.assign(this, { lastScrollTop: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'lastScrollLeft')) Object.assign(this, { lastScrollLeft: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'lockColumnsBodyRowsHeight')) this.lockColumnsBodyRowsHeight = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'lockColumnsFootRowsHeight')) this.lockColumnsFootRowsHeight = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'lockColumnsHeadRowsHeight')) this.lockColumnsHeadRowsHeight = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'expandedRows')) Object.assign(this, { expandedRows: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'hoverRow')) this.hoverRow = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'rowClicked')) this.rowClicked = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'currentEditorName')) this.currentEditorName = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'styledHidden')) this.styledHidden = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'customizedActiveKey')) Object.assign(this, { customizedActiveKey: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'mouseBatchChooseState')) Object.assign(this, { mouseBatchChooseState: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'mouseBatchChooseIdList')) Object.assign(this, { mouseBatchChooseIdList: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'columnResizing')) this.columnResizing = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'scrollPosition')) Object.assign(this, { scrollPosition: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'comboBarStatus')) Object.assign(this, { comboBarStatus: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'siblingHeihgt')) this.siblingHeihgt = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'parentHeight')) this.parentHeight = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'parentPaddingTop')) this.parentPaddingTop = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'screenHeight')) Object.assign(this, { screenHeight: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'headerHeight')) Object.assign(this, { headerHeight: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'footerHeight')) Object.assign(this, { footerHeight: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'headerFilter')) this.headerFilter = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'startChooseCell')) Object.assign(this, { startChooseCell: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'endChooseCell')) Object.assign(this, { endChooseCell: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'isFinishChooseCell')) Object.assign(this, { isFinishChooseCell: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'isCopyPristine')) Object.assign(this, { isCopyPristine: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'shiftKey')) Object.assign(this, { shiftKey: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'autoScrollRAF')) Object.assign(this, { autoScrollRAF: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'arrangeValue')) Object.assign(this, { arrangeValue: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'dragCorner')) Object.assign(this, { dragCorner: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'dragCornerPosition')) Object.assign(this, { dragCornerPosition: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'batchExpandRowNumber')) Object.assign(this, { batchExpandRowNumber: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'selectedDragRows')) Object.assign(this, { selectedDragRows: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'dragUpdateState')) this.dragUpdateState = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'actualRows')) this.actualRows = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'rowMetaData')) this.rowMetaData = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'scrolling')) this.scrolling = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'cellVerticalSize')) this.cellVerticalSize = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'showCachedSelection')) this.showCachedSelection = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'defaultRecordCachedType')) this.defaultRecordCachedType = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'recordCachedType')) this.recordCachedType = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'groups')) Object.assign(this, { groups: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'groupedData')) Object.assign(this, { groupedData: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'groupedDataWithHeader')) Object.assign(this, { groupedDataWithHeader: undefined });
    makeObservable(this, {
      props: observable.ref,
      customized: observable,
      tempCustomized: observable,
      loading: observable,
      leftOriginalColumns: observable,
      originalColumns: observable,
      rightOriginalColumns: observable,
      hasAggregationColumn: observable,
      calcBodyHeight: observable,
      width: observable,
      lastScrollTop: observable,
      lastScrollLeft: observable,
      lockColumnsBodyRowsHeight: observable,
      lockColumnsFootRowsHeight: observable,
      lockColumnsHeadRowsHeight: observable,
      expandedRows: observable,
      hoverRow: observable,
      rowClicked: observable,
      currentEditorName: observable,
      styledHidden: observable,
      customizedActiveKey: observable,
      mouseBatchChooseState: observable,
      mouseBatchChooseIdList: observable,
      columnResizing: observable,
      scrollPosition: observable,
      comboBarStatus: observable,
      siblingHeihgt: observable,
      parentHeight: observable,
      parentPaddingTop: observable,
      screenHeight: observable,
      headerHeight: observable,
      footerHeight: observable,
      headerFilter: observable,
      startChooseCell: observable,
      endChooseCell: observable,
      isFinishChooseCell: observable,
      isCopyPristine: observable,
      shiftKey: observable,
      autoScrollRAF: observable,
      arrangeValue: observable,
      dragCorner: observable,
      dragCornerPosition: observable,
      batchExpandRowNumber: observable,
      selectedDragRows: observable,
      dragUpdateState: observable,
      computedHeight: computed,
      height: computed,
      duplicatePrimaryKeyInfo: computed,
      autoHeight: computed,
      virtualColumnRange: computed,
      actualRows: observable,
      rowMetaData: observable,
      scrolling: observable,
      cellVerticalSize: observable,
      virtualRowHeight: computed,
      virtualVisibleStartIndex: computed,
      virtualVisibleEndIndex: computed,
      virtualStartIndex: computed,
      virtualEndIndex: computed,
      currentEditRecord: computed,
      showCachedSelection: observable,
      defaultRecordCachedType: observable,
      recordCachedType: observable,
      overflowX: computed,
      overflowY: computed,
      hasRowGroups: computed,
      headerTableGroups: computed,
      customizedColumn: computed,
      expandColumn: computed,
      rowNumberColumn: computed,
      selectionColumn: computed,
      comboQueryColumn: computed,
      draggableColumn: computed,
      leftColumns: computed,
      rightColumns: computed,
      columns: computed,
      columnGroups: computed,
      leftColumnGroups: computed,
      rightColumnGroups: computed,
      leafNamedColumns: computed,
      hasEmptyWidthColumn: computed,
      getLastEmptyWidthColumn: computed,
      hasCheckFieldColumn: computed,
      isCombinedColumn: computed,
      groups: observable,
      groupedData: observable,
      groupedDataWithHeader: observable,
      currentData: computed,
      data: computed,
      cachedIndeterminate: computed,
      allCachedChecked: computed,
      currentIndeterminate: computed,
      allCurrentChecked: computed,
      indeterminate: computed,
      allChecked: computed,
      showEditor: action,
      setLastScrollTop: action,
      setLastScrollLeft: action,
      hideEditor: action.bound,
      changeMouseBatchChooseIdList: action,
      setProps: action,
      updateProps: action,
      watchGroups: action,
      initGroups: action,
      initColumns: action,
      setAggregationCellExpanded: action,
      setRowExpanded: action,
      setRowPending: action,
      setRowLoaded: action,
      cellHighlightRenderer: computed,
      setRowHover: action,
      expandAll: action,
      collapseAll: action,
      batchSetCellValue: action,
      changeCustomizedColumnValue: action,
      saveCustomized: action,
      openCustomizationModal: action.bound,
      handleAllPageSelectionMenuClick: action.bound,
      startScroll: action,
      clearArrangeValue: action,
      calcArrangeValue: action,
    });
    runInAction(() => {
      this.scrollPosition = ScrollPosition.left;
      this.mouseBatchChooseIdList = [];
      this.mouseBatchChooseState = false;
      this.showCachedSelection = false;
      this.lockColumnsHeadRowsHeight = {};
      this.lockColumnsBodyRowsHeight = {};
      this.lockColumnsFootRowsHeight = {};
      this.node = node;
      this.expandedRows = [];
      this.screenHeight = typeof window === 'undefined' ? 0 : document.documentElement.clientHeight;
      this.headerHeight = 0;
      this.footerHeight = 0;
      this.lastScrollTop = 0;
      this.lastScrollLeft = 0;
      this.customizedActiveKey = ['columns'];
      this.leftOriginalColumns = [];
      this.originalColumns = [];
      this.rightOriginalColumns = [];
      this.tempCustomized = { columns: {} };
      this.customized = { columns: {} };
      this.isCopyPristine = false;
      this.setProps(node.props);
      if (this.customizable) {
        this.loadCustomized();
      } else {
        this.initColumns();
      }
      this.selectedDragRows = [];
    });
    const { mode, treeAsync, dataSet } = node.props;
    if (mode === TableMode.tree && treeAsync && dataSet) {
      dataSet.setState(QUERY_CANCELABLE, false);
    }
    if (this.showRemovedRow) {
      dataSet.setState(TABLE_SHOW_REMOVED_ROW, true);
    }
  }

  isDuplicatePrimaryKeyRecord(record: Record): boolean {
    return this.duplicatePrimaryKeyInfo.duplicateRecords.has(record);
  }

  isBuiltInColumn({ key }: ColumnProps) {
    if (isString(key)) {
      return [DRAG_KEY, SELECTION_KEY, ROW_NUMBER_KEY, CUSTOMIZED_KEY, EXPAND_KEY, COMBOBAR_KEY].includes(key);
    }
  }

  getColumnTooltip(column: ColumnProps): TableColumnTooltip | undefined {
    const { tooltip } = column;
    if (tooltip) {
      return tooltip;
    }
    return this.node.reactiveContext.getTooltip('table-cell');
  }

  getColumnHeaders(): Promise<HeaderText[]> {
    const { leafNamedColumns, dataSet } = this;
    return getHeaderTexts(dataSet, leafNamedColumns.slice(), this.aggregation);
  }

  getColumnTagRenderer(column: ColumnProps): ((props: TagRendererProps) => ReactNode) | undefined {
    const { tagRenderer } = column;
    return tagRenderer;
  }

  showEditor(name: string) {
    this.currentEditorName = name;
  }

  setLastScrollTop(lastScrollTop: number) {
    this.lastScrollTop = lastScrollTop;
    this.startScroll();
  }

  setLastScrollLeft(lastScrollLeft: number) {
    this.lastScrollLeft = lastScrollLeft;
    this.startScroll();
    if (this.clipboard && this.clipboard.copy && this.startChooseCell && this.endChooseCell) {
      const { fixLeftLength, fixRightLength } = this.calcDrawBorderFixColumn(this.startChooseCell.target, this.endChooseCell.target);
      if (fixLeftLength || fixRightLength) {
        this.drawCopyBorder();
      }
    }
  }

  hideEditor() {
    this.currentEditorName = undefined;
  }

  changeMouseBatchChooseIdList(idList: number[]) {
    this.mouseBatchChooseIdList = idList;
  }

  showNextEditor(name: string, reserve: boolean): boolean {
    const { dataSet } = this;
    const { currentIndex, pageSize, currentPage } = dataSet;
    const indexOfCurrentPage = currentIndex - (currentPage - 1) * pageSize;
    const record = dataSet.get(reserve ? indexOfCurrentPage - 1 : indexOfCurrentPage + 1);
    if (record && !isDisabledRow(record, this)) {
      dataSet.current = record;
      this.showEditor(name);
      return true;
    }
    return false;
  }

  setProps(props) {
    if (this.props && (this.props.dataSet !== props.dataSet || this.props.customizedCode !== props.customizedCode ||
      Boolean(this.props.boardCustomized) !== Boolean(props.boardCustomized) ||
      this.props.boardCustomized?.customizedDS !== props.boardCustomized?.customizedDS ||
      this.props.boardCustomized?.customizedBtn !== props.boardCustomized?.customizedBtn)) {
      this.customizedRequest += 1;
      this.saveCustomizedDebounce.cancel();
      this.loading = false;
    }
    this.props = props;
    this.watchGroups();
    const { showCachedSelection } = props;
    if (showCachedSelection !== undefined) {
      this.showCachedSelection = showCachedSelection;
    }
  }

  updateProps(props) {
    const { customizedCode, aggregation: oldAggregation } = this.props;
    const copyEnabled = Boolean(this.clipboard && this.clipboard.copy);
    this.setProps(props);
    if (copyEnabled && !(this.clipboard && this.clipboard.copy)) {
      if (this.copyChooseCleanup) {
        this.copyChooseCleanup();
      } else if (this.autoScrollRAF) {
        cancelAnimationFrame(this.autoScrollRAF);
        this.autoScrollRAF = null;
      }
      this.startChooseCell = null;
      this.endChooseCell = null;
      this.isFinishChooseCell = true;
      this.shiftKey = false;
      this.dragCorner = false;
      this.clearArrangeValue();
    }
    if (this.customizable) {
      if (customizedCode !== props.customizedCode) {
        this.loadCustomized();
        return;
      }
      const { aggregation } = props;
      if (oldAggregation !== aggregation) {
        const { customized } = this;
        if (!isNil(aggregation) && aggregation !== customized.aggregation) {
          customized.aggregation = aggregation;
          this.saveCustomized();
        }
      }
    }
    this.initColumns();
    this.dataSet.setState(TABLE_SHOW_REMOVED_ROW, this.showRemovedRow);
  }

  groupReaction?: IReactionDisposer;

  disposeGroupReaction() {
    const { groupReaction } = this;
    if (groupReaction) {
      groupReaction();
      this.groupReaction = undefined;
    }
  }

  dispose() {
    this.disposed = true;
    this.customizedRequest += 1;
    this.saveCustomizedDebounce.cancel();
    runInAction(() => { this.loading = false; });
    this.disposeGroupReaction();
    if (this.copyChooseCleanup) {
      this.copyChooseCleanup();
    } else if (this.autoScrollRAF) {
      cancelAnimationFrame(this.autoScrollRAF);
      this.autoScrollRAF = null;
    }
  }

  watchGroups() {
    this.disposeGroupReaction();
    if (this.disposed) return;
    this.initGroups();
    this.groupReaction = reaction(() => {
      const { groups = [] } = this.props;
      if (!groups.length) return [];
      const names = groups.filter(group => group.type !== GroupType.none)
        .reduce<string[]>((fields, group) => fields.concat(group.name, group.parentField || []), []);
      return [groups, ...this.currentData.map(record => [record, ...names.map(name => record.get(name))])];
    }, () => {
      this.initGroups();
      if (this.headerTableGroups.length) {
        this.initColumns();
      }
    });
  }

  initGroups() {
    const { groups = [] } = this.props;
    if (groups.length) {
      const headerGroupNames: string[] = [];
      const rowGroupNames: string[] = [];
      const groupNames: string[] = [];
      const parentFields: Map<string | symbol, string> = new Map();
      const header: TableGroup[] = [];
      const row: TableGroup[] = [];
      const column: TableGroup[] = [];
      groups.forEach((group) => {
        const { type, name, parentField } = group;
        switch (type) {
          case GroupType.header:
            header.push(group);
            headerGroupNames.push(name);
            break;
          case GroupType.row:
            row.push(group);
            rowGroupNames.push(name);
            break;
          case GroupType.none:
            break;
          default: {
            column.push(group);
            groupNames.push(name);
          }
        }
        if (parentField) {
          parentFields.set(name, parentField);
        }
      });

      this.groupedData = mergeGroupStates(normalizeGroups(rowGroupNames.concat(groupNames), headerGroupNames, this.currentData, parentFields), this.groupedData);
      this.groupedDataWithHeader = mergeGroupStates(normalizeGroups(headerGroupNames.concat(rowGroupNames, groupNames), [], this.currentData), this.groupedDataWithHeader);
      this.groups = [...header, ...row, ...column];
    } else {
      this.groups = [];
      this.groupedData = [];
      this.groupedDataWithHeader = [];
    }
  }

  initColumns() {
    const { customized, customizable, aggregation, dataSet } = this;
    const { columns, children } = this.props;
    const customizedColumns = customizable ? customized.columns : undefined;
    dataSet.setState('__CUSCOLUMNS__', customized);
    const [leftOriginalColumns, originalColumns, rightOriginalColumns, hasAggregationColumn] =
      normalizeGroupColumns(this, columns, children, aggregation, customizedColumns);
    this.leftOriginalColumns = leftOriginalColumns;
    this.originalColumns = originalColumns;
    this.rightOriginalColumns = rightOriginalColumns;
    this.hasAggregationColumn = hasAggregationColumn;
  }

  isAggregationCellExpanded(record: Record, key: Key): boolean | undefined {
    const expandedKeys: ObservableMap<Key, boolean> | undefined = record.getState(AGGREGATION_EXPAND_CELL_KEY) as ObservableMap<Key, boolean>;
    if (expandedKeys) {
      return expandedKeys.get(key);
    }
  }

  setAggregationCellExpanded(record: Record, key: Key, expanded: boolean) {
    const expandedKeys: ObservableMap<Key, boolean> = record.getState(AGGREGATION_EXPAND_CELL_KEY) || observable.map();
    expandedKeys.set(key, expanded);
    record.setState(AGGREGATION_EXPAND_CELL_KEY, expandedKeys);
  }

  get isBodyExpanded(): boolean {
    if (!this.props.bodyExpandable) {
      return true;
    }
    const { bodyExpanded } = this.props;
    if (bodyExpanded !== undefined) {
      return bodyExpanded;
    }
    const isBodyExpanded = this.dataSet.getState(BODY_EXPANDED);
    if (isBodyExpanded !== undefined) {
      return isBodyExpanded;
    }
    return defaultTo(this.props.defaultBodyExpanded, true);
  }

  setBodyExpanded(isBodyExpanded: boolean) {
    const { bodyExpanded, onBodyExpand = noop } = this.props;
    if (bodyExpanded === undefined) {
      this.dataSet.setState(BODY_EXPANDED, isBodyExpanded);
    }
    onBodyExpand(isBodyExpanded);
  }

  isGroupExpanded(group: Group): boolean {
    return group.isExpanded && (!group.parent || this.isGroupExpanded(group.parent));
  }

  setGroupExpanded(group: Group, isExpanded: boolean) {
    group.isExpanded = isExpanded;
  }

  isRowExpanded(record: Record): boolean {
    const { isExpanded = this.expandedRows.indexOf(record.key) !== -1 } = record;
    return isExpanded && (!this.isTree || !record.parent || this.isRowExpanded(record.parent));
  }

  /**
   *
   * @param record 想修改的record
   * @param expanded 设置是否展开
   * @param disHandler 设置是否需要触发展开事件
   */
  setRowExpanded(record: Record, expanded: boolean, disHandler?: boolean) {
    record.isExpanded = expanded;
    if (!this.inBatchExpansion) {
      const index = this.expandedRows.indexOf(record.key);
      if (expanded) {
        if (index === -1) {
          this.expandedRows.push(record.key);
        }
      } else if (index !== -1) {
        this.expandedRows.splice(index, 1);
      }
    }
    const { onExpand } = this.props;
    if (onExpand && !disHandler) {
      onExpand(expanded, record);
    }
    if (expanded && this.canTreeLoadData) {
      this.onTreeNodeLoad({ record });
    }
  }

  isRowPending(record: Record): boolean {
    return record.pending === true;
  }

  setRowPending(record: Record, pending: boolean) {
    record.pending = pending;
  }

  isRowLoaded(record: Record): boolean {
    return record.childrenLoaded === true;
  }

  setRowLoaded(record: Record, loaded: boolean) {
    record.childrenLoaded = loaded;
  }

  isRowHover(record: Record): boolean {
    return this.hoverRow === record;
  }

  get canTreeLoadData(): boolean {
    const { treeLoadData, treeAsync } = this.props;
    return treeAsync || !!treeLoadData;
  }

  get cellHighlightRenderer(): HighlightRenderer {
    const { cellHighlightRenderer = this.getConfig('highlightRenderer') } = this.props;
    return cellHighlightRenderer;
  }

  setRowHover(record: Record, hover: boolean) {
    this.hoverRow = hover ? record : undefined;
  }

  expandAll() {
    this.inBatchExpansion = true;
    this.expandedRows = this.dataSet.records.map(record => {
      this.setRowExpanded(record, true);
      return record.key;
    });
    this.inBatchExpansion = false;
  }

  collapseAll() {
    this.inBatchExpansion = true;
    this.dataSet.records.forEach(record => this.setRowExpanded(record, false));
    this.expandedRows = [];
    this.inBatchExpansion = false;
  }

  @autobind
  async onTreeNodeLoad({ record }: { record: Record }): Promise<any> {
    const { dataSet, treeLoadData, treeAsync, selectionMode } = this.props;
    const promises: Promise<any>[] = [];
    this.setRowPending(record, true);
    if (treeAsync && dataSet) {
      if (dataSet.paging) {
        const { currentPage = 1 } = (record.getState(CHILDREN_PAGE_INFO) || {})
        promises.push(dataSet.queryMoreChild(record, currentPage));
      } else {
        promises.push(dataSet.queryMoreChild(record));
      }
    }
    if (treeLoadData) {
      promises.push(treeLoadData({ record, dataSet }));
    }
    // 由子选父
    const parentSelect = (parent: Record) => {
      if (!parent.isSelected &&
        parent.children &&
        parent.children.length > 0 &&
        parent.children.every(child => child.isSelected)) {
        dataSet.select(parent);
        if (parent.parent) {
          parentSelect(parent.parent);
        }
      }
    }
    try {
      await Promise.all(promises);
      if (selectionMode === SelectionMode.treebox) {
        // 由父选子
        if (record.isSelected) {
          if (!record.parentSelectToChildrenSynced) {
            defaultTo(record.children, []).forEach(child => {
              if (!child.isSelected) {
                dataSet.select(child);
              }
            });
          }
        }
        else {
          parentSelect(record);
        }
        record.parentSelectToChildrenSynced = true;
      }
      this.setRowLoaded(record, true);
    } finally {
      this.setRowLoaded(record, true);
      this.setRowPending(record, false);
    }
  }

  @autobind
  renderSelectionBox({ record }): ReactNode {
    const { selectionBoxRenderer } = this.props;
    if (selectionBoxRenderer && isFunction(selectionBoxRenderer)) {
      const element = renderSelectionBox({ record, store: this });
      return selectionBoxRenderer({ record, element });
    }
    return renderSelectionBox({ record, store: this });
  }


  @autobind
  renderRowNumber({ record, dataSet, rowIndex }: { record: Record; dataSet: DataSet; rowIndex?: number }): ReactNode {
    const { isTree, props: { rowNumber }, groups } = this;
    const numbers = groups.length > 0 && rowIndex !== undefined ? [rowIndex + 1] : getRowNumbers(record, dataSet, isTree, this.showRemovedRow);
    const number = numbers.join('-');
    if (typeof rowNumber === 'function') {
      return rowNumber({ record, dataSet, text: number, pathNumbers: numbers });
    }
    return number;
  }

  @autobind
  renderDragBox({ record }) {
    const { rowDragRender } = this.props;
    if (rowDragRender && isFunction(rowDragRender.renderIcon)) {
      return rowDragRender.renderIcon({ record });
    }
    return <Icon type="baseline-drag_indicator" />;
  }

  findColumnGroup(indexOrKeyOrName: number | string): ColumnGroup | undefined {
    const { allLeafs } = this.columnGroups;
    return isNumber(indexOrKeyOrName) ? allLeafs[indexOrKeyOrName] : allLeafs.find(({ key }) => String(key) === indexOrKeyOrName);
  }

  setColumnWidth(columnGroup: ColumnGroup, width: number, saveToCustomization = true) {
    const { column } = columnGroup;
    if (width !== column.width) {
      this.changeCustomizedColumnValue(column, {
        width,
      }, saveToCustomization);
      const { onColumnResize } = this.props;
      if (onColumnResize) {
        const index = this.columnGroups.allLeafs.indexOf(columnGroup);
        /**
         * onColumnResize 事件回调
         * 回调参数：
         * @param column
         * @param width
         */
        onColumnResize({ column, width, index });
      }
    }
  }

  calcDrawBorderFixColumn(startTarget, endTarget) {
    const startAndTargetClassValues = `${startTarget.classList.value} ${endTarget.classList.value}`.split(" ");
    const fixLeftClassname = `${this.prefixCls}-cell-fix-left`;
    const fixRightClassname = `${this.prefixCls}-cell-fix-right`;
    const fixLeftLength = startAndTargetClassValues.filter(x => x === fixLeftClassname).length; // 选中左固定列的数量  0 ~ 2
    const fixRightLength = startAndTargetClassValues.filter(x => x === fixRightClassname).length; // 选中右固定列的数量 0 ～ 2
    return { fixLeftClassname, fixRightClassname, fixLeftLength, fixRightLength };
  }

  // 动态改变固定列层级
  changeFixIndex(classname, zIndex = "") {
    const { node: { tableContentWrap, tableBodyWrap } } = this;
    const positionWrapper = tableBodyWrap || tableContentWrap;
    if (positionWrapper) {
      const fixElements = positionWrapper.querySelectorAll(`td.${classname}`);
      const choosedRows = Array.from(fixElements);
      choosedRows.forEach((element: HTMLElement) => {
        element.style.zIndex = zIndex;
      });
    }
  }

  @autobind
  drawCopyBorder(sTarget?: HTMLElement, eTarget?: HTMLElement) {
    const {
      node: {
        rangeBorder,
        tableContentWrap,
        tableBodyWrap,
        fixedColumnsBodyLeft,
        fixedColumnsBodyRight,
      },
      startChooseCell,
      endChooseCell,
      lastScrollLeft,
      columnGroups,
      leftColumnGroups,
      customizable,
    } = this;

    let startTarget = sTarget || (startChooseCell && startChooseCell.target);
    let endTarget = eTarget || (endChooseCell && endChooseCell.target);
    const positionWrapper = tableBodyWrap || tableContentWrap;
    const maxScrollLeft = positionWrapper!.scrollWidth - positionWrapper!.clientWidth;

    if (positionWrapper && startChooseCell && endChooseCell) {
      const minRowIndex = Math.min(startChooseCell.rowIndex, endChooseCell.rowIndex);
      const maxRowIndex = Math.max(startChooseCell.rowIndex, endChooseCell.rowIndex);
      const resolveVisibleTarget = (target: HTMLElement | null | undefined, rowIndex: number, colIndex: number): HTMLElement | null => {
        const column = columnGroups.leafs[colIndex];
        if (!column) {
          return target || null;
        }
        const columnKey = String(column.key);
        if (
          target &&
          target.isConnected &&
          Number(target.dataset.rowIndex) === rowIndex &&
          target.dataset.index === columnKey
        ) {
          return target;
        }

        const lock = column.column.lock;
        const wrappers = [
          lock === ColumnLock.left || lock === true ? fixedColumnsBodyLeft : undefined,
          !lock ? positionWrapper : undefined,
          lock === ColumnLock.right ? fixedColumnsBodyRight : undefined,
          positionWrapper,
        ].filter((wrapper): wrapper is HTMLDivElement => Boolean(wrapper));

        return wrappers.reduce<HTMLElement | null>((result, wrapper) => {
          if (result) {
            return result;
          }
          const wrapperRect = wrapper.getBoundingClientRect();
          const footerTop = wrapper.querySelector('tfoot')?.getBoundingClientRect().top;
          const visibleBottom = footerTop === undefined
            ? wrapperRect.bottom
            : Math.min(wrapperRect.bottom, footerTop);
          return Array.from(wrapper.querySelectorAll<HTMLElement>('td[data-row-index]'))
            .filter((cell) => {
              const cellRowIndex = Number(cell.dataset.rowIndex);
              const { top, bottom } = cell.getBoundingClientRect();
              return cell.dataset.index === columnKey &&
                cellRowIndex >= minRowIndex &&
                cellRowIndex <= maxRowIndex &&
                top < visibleBottom &&
                bottom > wrapperRect.top;
            })
            .reduce<HTMLElement | null>(
              (nearest, cell) => (!nearest || Math.abs(Number(cell.dataset.rowIndex) - rowIndex) < Math.abs(Number(nearest.dataset.rowIndex) - rowIndex) ? cell : nearest),
              null,
            );
        }, null);
      };
      startTarget = resolveVisibleTarget(startTarget, startChooseCell.rowIndex, startChooseCell.colIndex);
      endTarget = resolveVisibleTarget(endTarget, endChooseCell.rowIndex, endChooseCell.colIndex);
    }

    if (rangeBorder && startTarget && endTarget) {
      const { fixLeftClassname, fixRightClassname, fixLeftLength, fixRightLength } = this.calcDrawBorderFixColumn(startTarget, endTarget);

      const rectStart = startTarget.getBoundingClientRect();
      const rectEnd = endTarget.getBoundingClientRect();
      const minX = Math.min(rectStart.left, rectEnd.left);
      const maxX = Math.max(rectStart.right, rectEnd.right);
      const minY = Math.min(rectStart.top, rectEnd.top);
      const maxY = Math.max(rectStart.bottom, rectEnd.bottom);
      const left = Math.min(startTarget.offsetLeft, endTarget.offsetLeft);
      const top = Math.min(startTarget.offsetTop, endTarget.offsetTop);
      const width = maxX - minX;
      const height = maxY - minY;
      rangeBorder.style.top = pxToRem(top)!;
      rangeBorder.style.height = pxToRem(height)!;
      rangeBorder.style.display = 'block';

      if ((!fixLeftLength && !fixRightLength) || (fixLeftLength && fixRightLength) || (fixLeftLength > 1) || (fixRightLength > 1) || !this.overflowX) {
        // 一般选框处理
        rangeBorder.style.width = pxToRem(width)!;
        rangeBorder.style.left = pxToRem(left)!;
      } else {
        // 动态选框处理
        let extraDistance = 0;
        let fixChoosedWidth = 0;

        // 获取框选的固定列的宽度
        if (startChooseCell && endChooseCell) {
          const [firstColIndex, lastColIndex] = [startChooseCell.colIndex, endChooseCell.colIndex].sort((a, b) => a - b);

          const { leafs } = columnGroups;
          let totalWidth = leafs.slice(firstColIndex, lastColIndex + 1).reduce((total, col) => total + (col.width || 0), 0);
          // 存在自定义列的情况
          const lastLeafs = leafs[lastColIndex + 1];
          if (customizable && lastLeafs && lastLeafs.key === CUSTOMIZED_KEY) {
            totalWidth += (leafs[lastColIndex + 1].width || 0);
          }

          if (fixLeftLength) {
            extraDistance = ((lastScrollLeft > (endTarget.offsetLeft)) ? lastScrollLeft - (endTarget.offsetLeft - leftColumnGroups.width + endTarget.offsetWidth) : 0)
            let fixChoosedLeft = 0;

            for (let i = firstColIndex; i <= lastColIndex; i++) {
              const col = leafs[i];
              if (col.column.lock === ColumnLock.left || col.column.lock === true) {
                fixChoosedWidth += col.width || 0;
                if (i === firstColIndex) {
                  const fixedLeftTarget = [startTarget, endTarget]
                    .find(target => target.classList.contains(fixLeftClassname));
                  fixChoosedLeft = fixedLeftTarget ? fixedLeftTarget.offsetLeft : 0;
                }
              }
            }

            rangeBorder.style.left = pxToRem(fixChoosedLeft)!;
            rangeBorder.style.width = pxToRem(Math.max(fixChoosedWidth, totalWidth - lastScrollLeft))!;
          } else if (fixRightLength) {
            let unFixedWidth = 0;
            let minLeft = 0;

            for (let i = lastColIndex; i >= firstColIndex; i--) {
              const col = leafs[i];
              if (col.column.lock === ColumnLock.right) {
                fixChoosedWidth += col.width || 0;
                if (lastColIndex === i && customizable && lastColIndex === columnGroups.leafs.length - 2) {
                  fixChoosedWidth += (leafs[i + 1].width || 0);
                }
              } else if (!col.column.lock) {
                unFixedWidth += col.width || 0
                minLeft = col.left;
              }
            }

            extraDistance = (maxScrollLeft - lastScrollLeft) > unFixedWidth ? (maxScrollLeft - lastScrollLeft) - unFixedWidth : 0
            rangeBorder.style.left = pxToRem(minLeft - extraDistance)!;
            rangeBorder.style.width = pxToRem(Math.max(fixChoosedWidth, totalWidth - (maxScrollLeft - lastScrollLeft)))!;
          }
        }
      }

      // 动态改变固定列层级
      if (fixLeftLength && fixRightLength) {
        rangeBorder.style.zIndex = "2";
        this.changeFixIndex(fixLeftClassname);
        this.changeFixIndex(fixRightClassname);
      } else if (fixLeftLength) {
        rangeBorder.style.zIndex = "2";
        if (fixLeftLength === 1) {
          this.changeFixIndex(fixRightClassname, "3");
        }
        this.changeFixIndex(fixLeftClassname);
      } else if (fixRightLength) {
        rangeBorder.style.zIndex = "2";
        if (fixRightLength === 1) {
          this.changeFixIndex(fixLeftClassname, "3");
        }
        this.changeFixIndex(fixRightClassname);
      } else {
        rangeBorder.style.zIndex = "1";
      }
    }
  }

  @autobind
  drawExpandArea(event) {
    // 说明有起点 & 终点
    const { node: { rangeBorder, expandBorder }, startChooseCell, endChooseCell } = this;
    const sTarget = startChooseCell && startChooseCell.target;
    const eTarget = endChooseCell && endChooseCell.target;
    const pointTarget = getTdElementByTarget(event.target);

    const targetTop = pointTarget.offsetTop + pointTarget.offsetHeight;
    // 分析对比两点的位置，第一个点是 右下角。第二个点是 左上角
    // 计算右下角的位置

    if (rangeBorder) {
      const cornerTop = rangeBorder.offsetTop + rangeBorder.offsetHeight;

      if (targetTop > cornerTop && sTarget && eTarget) {
        // 往下绘制扩展区域
        // 起点
        const LT = {
          x: Math.min(sTarget.offsetLeft, eTarget.offsetLeft),
          y: Math.max(sTarget.offsetTop + sTarget.offsetHeight, eTarget.offsetTop + eTarget.offsetHeight),
        }
        // 终点
        const RB = {
          x: Math.max(sTarget.offsetLeft + sTarget.offsetWidth, eTarget.offsetLeft + eTarget.offsetWidth),
          y: pointTarget.offsetTop + pointTarget.offsetHeight,
        }

        if (expandBorder) {
          expandBorder.style.left = pxToRem(rangeBorder.offsetLeft)!;
          expandBorder.style.top = pxToRem(LT.y)!;
          expandBorder.style.width = pxToRem(rangeBorder.offsetWidth)!;
          expandBorder.style.height = pxToRem(RB.y - LT.y)!;
          expandBorder.style.borderTop = "none";
          expandBorder.style.display = "block";

          expandBorder.style.zIndex = rangeBorder.style.zIndex;

        }

        const rows = (RB.y - LT.y + 1) / pointTarget.offsetHeight;
        this.batchExpandRowNumber = Math.floor(rows);
      } else {
        this.batchExpandRowNumber = 0;
        if (expandBorder) {
          expandBorder.style.display = "none";
        }
      }
    }
  }

  // 批量赋值款选单元格的值
  batchSetCellValue() {
    const { node: { tableBodyWrap, expandBorder }, dataSet } = this;
    if (!this.batchExpandRowNumber) return;
    // 记录初始框选的值
    const { colIndex: startColIndex, rowIndex: startRowIndex, target: sTarget } = this.startChooseCell!;
    const { colIndex: endColIndex, rowIndex: endRowIndex, target: eTarget } = this.endChooseCell!;

    const minRowIndex = Math.min(startRowIndex, endRowIndex);
    const minColIndex = Math.min(startColIndex, endColIndex);
    const maxRowIndex = Math.max(startRowIndex, endRowIndex);
    const maxColIndex = Math.max(startColIndex, endColIndex);

    const data = this.currentData.map(x => x.toData());
    const cols = this.columns.filter(x => !x.hidden);

    let i = minRowIndex;
    for (let k = 1; k <= this.batchExpandRowNumber; k++) {
      for (let j = minColIndex; j <= maxColIndex; j++) {
        const cField = cols[j].name;
        const cValue = data[i][cField!];
        const record = this.currentData[maxRowIndex + k];
        const field = dataSet.fields.get(cField!);

        let colEditor = cols[j].editor;
        if (typeof colEditor === 'function') {
          colEditor = colEditor(record, cField!);
        }

        if (colEditor && field && !field.get('readOnly', record) && !field.get('disabled', record)) {
          record.set(cField!, cValue);
        }
      }
      if (i < maxRowIndex && (k % (maxRowIndex - minRowIndex + 1) !== 0)) {
        i++;
      } else {
        i = minRowIndex;
      }
    }
    // 新起点
    const newSTarget: HTMLElement = startRowIndex > endRowIndex ? eTarget : sTarget;
    // 新终点
    const trs = tableBodyWrap?.querySelectorAll('.c7n-pro-table-tbody tr');
    if (trs) {
      const dataIndex = (startRowIndex > endRowIndex ? sTarget : eTarget).getAttribute('data-index');
      const newETarget: HTMLElement | null = trs[(startRowIndex > endRowIndex ? startRowIndex : endRowIndex) + this.batchExpandRowNumber].querySelector(`td[data-index="${dataIndex}"]`);
      if (newETarget) {
        this.drawCopyBorder(newSTarget, newETarget);
      }
      // 更新起始点
      this.startChooseCell = {
        rowIndex: startRowIndex > endRowIndex ? endRowIndex : startRowIndex,
        colIndex: startRowIndex > endRowIndex ? endColIndex : startColIndex,
        target: newSTarget,
      }
      this.endChooseCell = {
        rowIndex: (startRowIndex > endRowIndex ? startRowIndex : endRowIndex) + this.batchExpandRowNumber,
        colIndex: startRowIndex > endRowIndex ? startColIndex : endColIndex,
        target: newETarget!,
      }
    }
    if (expandBorder) {
      expandBorder.style.display = "none";
    }
    if (this.clipboard && this.clipboard.copy) {
      this.calcArrangeValue()
    }
  }

  changeCustomizedColumnValue(column: ColumnProps, value: object, saveToCustomization = true) {
    const { customized: { columns } } = this;
    set(column, value);
    const columnKey = getColumnKey(column).toString();
    const oldCustomized = get(columns, columnKey) || lodashGet(columns, columnKey);
    set(columns, columnKey, {
      ...oldCustomized,
      ...value,
    });
    if (saveToCustomization) {
      this.saveCustomizedDebounce();
    }
  }

  private disposed = false;

  private customizedRequest = 0;

  private handleCustomizedResult(promise: Promise<void>): Promise<void> {
    promise.catch(error => warning(false, error instanceof Error ? error.message : String(error)));
    return promise;
  }

  saveCustomized(customized?: TableCustomized | null, otherInfo?: { columnDataSet: DataSet, params?: any }) {
    return this.handleCustomizedResult(this.saveCustomizedAsync(customized, otherInfo));
  }

  private async saveCustomizedAsync(customized?: TableCustomized | null, otherInfo?: { columnDataSet: DataSet, params?: any }) {
    if (!this.disposed && this.customizable && this.customizedLoaded) {
      const { customizedCode, boardCustomized } = this.props;
      const { dataSet } = this;
      const request = ++this.customizedRequest;
      const currentRecord = boardCustomized && boardCustomized.customizedDS && boardCustomized.customizedDS.current;
      const isCurrent = () => !this.disposed && request === this.customizedRequest &&
        dataSet === this.dataSet && customizedCode === this.props.customizedCode &&
        (!boardCustomized || currentRecord === boardCustomized.customizedDS?.current);
      if (customized) {
        this.customized = customized;
      }
      if (customizedCode) {
        const tableCustomizedSave = this.getConfig('tableCustomizedSave') || this.getConfig('customizedSave');
        const tableCustomizedLoad = this.getConfig('tableCustomizedLoad') || this.getConfig('customizedLoad');
        // board 组件列表视图配置保存
        if (this.customizedBtn && boardCustomized && boardCustomized.customizedDS) {
          // @ts-ignore
          await tableCustomizedSave(customizedCode,
            {
              dataJson: JSON.stringify(omit(this.customized, ['dataJson', 'creationDate', 'createdBy', 'lastUpdateDate', 'lastUpdatedBy', '_token', 'userId', 'tenantId', 'id'])),
              ...omit(this.customized, ['dataJson']), defaultFlag: 1, viewType: 'table', id: currentRecord.get('id'), objectVersionNumber: currentRecord.get('objectVersionNumber'),
            },
            this.customizedBtn ? 'Board' : 'Table', otherInfo);

          if (isCurrent()) {
            const res = await tableCustomizedLoad(customizedCode, 'Board', {
              type: 'detail',
              id: currentRecord.get('id'),
            });
            if (isCurrent()) {
              const dataJson = res.dataJson ? pick(JSON.parse(res.dataJson), ['size', 'parityRow', 'pageSize', 'columns', 'combineSort', 'defaultFlag', 'height', 'heightDiff', 'viewName']) : {};
              runInAction(() => {
                this.customized = { columns: {}, ...omit(res, 'dataJson'), ...dataJson };
                currentRecord.set({ objectVersionNumber: res.objectVersionNumber, dataJson, viewName: res.viewName });
                dataSet.setState('__CUSTOMIZED__', this.customized);
              });
            }
          }
        } else {
          await tableCustomizedSave(customizedCode, this.customized, 'Table', otherInfo);
          if (!isCurrent()) return;
          runInAction(() => { dataSet.setState('__CUSTOMIZED__', this.customized); });
          if (otherInfo && otherInfo.params) {
            // 需要重新加载, 获取个性化记录的名称和id等等
            await this.loadCustomized();
          }
        }
      }
    }
  }

  saveCustomizedDebounce = debounce((...args: Parameters<TableStore['saveCustomized']>) => this.saveCustomized(...args), 1000);

  openCustomizationModal(context) {
    const { customizedCode } = this.props;
    const modalProps: ModalProps = {
      key: 'TABLE_CUSTOMIZATION_MODAL',
      drawer: true,
      size: Size.small,
      title: this.customizedBtn ? '表格视图配置' : $l('Table', 'customization_settings'),
      children: <CustomizationSettings context={context} />,
      bodyStyle: {
        overflow: 'hidden auto',
        padding: 0,
      },
    };
    if (customizedCode) {
      modalProps.okText = $l('Table', 'save_button');
    }
    Modal.open(modalProps);
  }

  @autobind
  loadCustomized(customizedProps?: TableCustomized, forceLoad?: boolean) {
    return this.handleCustomizedResult(this.loadCustomizedAsync(customizedProps, forceLoad));
  }

  private async loadCustomizedAsync(customizedProps?: TableCustomized, forceLoad?: boolean) {
    if (this.disposed) return;
    const { customizedCode, boardCustomized, onCustomizedLoad = noop, dataSet } = this.props;
    const { props: { queryBarProps } } = this;
    const showSimpleMode = queryBarProps && queryBarProps.simpleMode;
    if (((forceLoad || this.customizable) && customizedCode) || (this.queryBar === TableQueryBarType.comboBar && !showSimpleMode)) {
      const request = ++this.customizedRequest;
      const currentRecord = boardCustomized && boardCustomized.customizedDS && boardCustomized.customizedDS.current;
      const isCurrent = () => !this.disposed && request === this.customizedRequest &&
        dataSet === this.dataSet && customizedCode === this.props.customizedCode &&
        (!boardCustomized || currentRecord === boardCustomized.customizedDS?.current);
      const tableCustomizedLoad = this.getConfig('tableCustomizedLoad') || this.getConfig('customizedLoad');
      runInAction(() => {
        delete this.customizedLoaded;
        this.tempCustomized = { columns: {} };
        this.loading = true;
      });
      try {
        let recordValues;
        let customized: TableCustomized | undefined | null = customizedProps;
        if (customizedCode && !boardCustomized && !customized) {
          customized = await tableCustomizedLoad(customizedCode, 'Table');
        }
        if (customizedCode && boardCustomized && boardCustomized.customizedDS && !customized) {
          const res = await tableCustomizedLoad(customizedCode, 'Board', {
            type: 'detail',
            id: currentRecord.get('id'),
          });
          if (isCurrent()) {
            const dataJson = res.dataJson ? pick(JSON.parse(res.dataJson), ['size', 'parityRow', 'pageSize', 'columns', 'combineSort', 'defaultFlag', 'height', 'heightDiff', 'viewName']) : {};
            recordValues = { objectVersionNumber: res.objectVersionNumber, dataJson, viewName: res.viewName };
            // @ts-ignore
            customized = { ...omit(res, 'dataJson'), ...dataJson };
          }
        }
        if (!isCurrent()) return;
        const newCustomized: TableCustomized = { columns: {}, ...customized };
        let query;
        runInAction(() => {
          if (recordValues) currentRecord.set(recordValues);
          this.customized = newCustomized;
          dataSet.setState('__CUSTOMIZED__', newCustomized);
          this.initColumns();
          // autoQuery：fasle 且分页参数与个性化不一致时进行修改
          if (newCustomized.pageSize && dataSet.pageSize !== Number(newCustomized.pageSize) && !dataSet.props.autoQuery) {
            dataSet.pageSize = Number(newCustomized.pageSize);
            // 手动加载个性化时, 重新查询
            if (customizedProps) {
              dataSet.currentPage = 1;
              query = dataSet.query(1, undefined, true);
            }
          }
        });
        if (query) await query;
        if (!isCurrent()) return;
        await onCustomizedLoad(newCustomized);
        if (!isCurrent()) return;
        const { aggregation: customAggregation } = newCustomized;
        if (customAggregation !== undefined) {
          const { onAggregationChange, aggregation } = this.props;
          if (onAggregationChange && customAggregation !== aggregation) {
            await onAggregationChange(customAggregation);
          }
        }
      } finally {
        if (!this.disposed && request === this.customizedRequest) {
          this.customizedLoaded = true;
          runInAction(() => {
            this.loading = false;
          });
        }
      }
    }
  }

  handleAllPageSelectionMenuClick({ key }) {
    const { dataSet } = this;
    const { isAllPageSelection } = dataSet;
    switch (key) {
      case 'current': {
        if (this.allChecked) {
          this.unCheckAllCurrent();
          this.unCheckAllCached();
        } else {
          this.checkAllCurrent();
          this.checkAllCached();
        }
        break;
      }
      case 'all':
        dataSet.setAllPageSelection(!isAllPageSelection);
        break;
      default:
    }
  }

  @autobind
  renderAllPageSelectionMenu() {
    const { dataSet: { isAllPageSelection }, allChecked, prefixCls } = this;
    return (
      <Menu prefixCls={`${prefixCls}-dropdown-menu`} onClick={this.handleAllPageSelectionMenuClick}>
        <Menu.Item key="current">
          {$l('Table', allChecked ? 'unselect_current_page' : 'select_current_page')}
        </Menu.Item>
        <Menu.Item key="all">
          {$l('Table', isAllPageSelection ? 'unselect_all_page' : 'select_all_page')}
        </Menu.Item>
      </Menu>
    );
  }

  @autobind
  getConfig<T extends ConfigKeys>(key: T): T extends keyof DefaultConfig ? DefaultConfig[T] : Config[T] {
    return this.node.getContextConfig(key);
  }

  @autobind
  getProPrefixCls(suffixCls: string, customizePrefixCls?: string): string {
    return this.node.getContextProPrefixCls(suffixCls, customizePrefixCls);
  }

  @autobind
  private multipleSelectionRenderer() {
    const buttons = [
      <ObserverCheckBox
        key="selectAll"
        checked={this.allChecked}
        indeterminate={this.indeterminate}
        onChange={this.handleSelectAllChange}
        labelLayout={LabelLayout.none}
        value
      />,
    ];
    if (this.props.showAllPageSelectionButton) {
      buttons.push(
        <Dropdown key="selectAllPage" overlay={this.renderAllPageSelectionMenu}>
          <Icon type="baseline-arrow_drop_down" className={`${this.prefixCls}-page-all-select`} />
        </Dropdown>,
      );
    }
    return buttons;
  }

  @autobind
  private getRelationSize(type: 'vh' | 'vw' | '%' | 'em'): number | undefined {
    if (type === '%') {
      return this.parentHeight;
    }
    return this.screenHeight;
  }

  startScroll() {
    this.scrolling = true;
    this.stopScroll();
  }

  stopScroll = debounce(action(() => {
    this.scrolling = false;
  }), 300);

  batchRunner?: BatchRunner;

  batchSetRowHeight(key: Key, callback: Function) {
    const batchRunner = getIf(this, 'batchRunner', () => new BatchRunner());
    batchRunner.addTask(key, callback);
  }

  isRowInView(index: number): boolean {
    const { propVirtual } = this;
    if (propVirtual) {
      return true;
    }
    if (this.height === undefined) {
      return index <= 10;
    }
    const { node: { tableBodyWrap } } = this;
    const scrollTop = tableBodyWrap ? tableBodyWrap.scrollTop : 0;
    const visibleStartIndex = getVisibleStartIndex(this, () => scrollTop);
    return index >= getStartIndex(this, () => visibleStartIndex) &&
      index <= getEndIndex(this, () => getVisibleEndIndex(this, () => visibleStartIndex, () => scrollTop));
  }

  alignEditor() {
    const { currentEditorName } = this;
    if (currentEditorName) {
      const currentEditor = this.editors.get(currentEditorName);
      if (currentEditor) {
        currentEditor.alignEditor();
      }
    }
  }

  blurEditor() {
    const { currentEditorName } = this;
    if (currentEditorName) {
      const currentEditor = this.editors.get(currentEditorName);
      if (currentEditor) {
        currentEditor.blur();
      }
    }
  }

  clearArrangeValue() {
    this.arrangeValue = {
      avg: 0,
      sum: 0,
      max: 0,
      min: 0,
      count: 0,
    }
  }

  calcArrangeValue() {
    this.dragCorner = false;
    // 选择过程中触发滚动导致取消选择后，startChooseCell 和 endChooseCell 为 null
    if (!this.startChooseCell || !this.endChooseCell) {
      return;
    }
    const { colIndex: startColIndex, rowIndex: startRowIndex } = this.startChooseCell;
    const { colIndex: endColIndex, rowIndex: endRowIndex } = this.endChooseCell;

    const data = this.currentData.map(x => x.toData());
    const cols = this.columns.filter(x => !x.hidden);

    let sum = 0;
    let avg = 0;
    let count = 0;
    let max = 0;
    let min = 0;
    let cellCount = 0;
    const arrayValue: number[] = []

    const minRowIndex = Math.min(startRowIndex, endRowIndex);
    const minColIndex = Math.min(startColIndex, endColIndex);
    const maxRowIndex = Math.max(startRowIndex, endRowIndex);
    const maxColIndex = Math.max(startColIndex, endColIndex);

    for (let i = minRowIndex; i <= maxRowIndex; i++) {
      for (let j = minColIndex; j <= maxColIndex; j++) {
        const field = cols[j].name;
        const value: any = data[i][field!];
        if (!isNaN(parseFloat(value)) && isFinite(value)) {
          sum += Number(value);
          arrayValue.push(Number(value));
          count++;
        }
        cellCount++;
      }
    }

    avg = count ? Number((sum / count).toFixed(3)) : 0;
    max = arrayValue.length ? Math.max(...arrayValue) : 0;
    min = arrayValue.length ? Math.min(...arrayValue) : 0;

    this.arrangeValue = {
      avg,
      sum,
      max,
      min,
      count: cellCount,
    }
  }
}
