import React from 'react';
import { action, computed, get, observable, runInAction, set, makeObservable } from 'mobx';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';
import isUndefined from 'lodash/isUndefined';
import sortBy from 'lodash/sortBy';
import debounce from 'lodash/debounce';
import isNil from 'lodash/isNil';
import isPlainObject from 'lodash/isPlainObject';
import { math } from 'choerodon-ui/dataset';
import { Config, ConfigKeys, DefaultConfig } from 'choerodon-ui/lib/configure';
import { Size } from 'choerodon-ui/lib/_util/enum';
import warning from 'choerodon-ui/lib/_util/warning';
import { isCalcSize, toPx } from 'choerodon-ui/lib/_util/UnitConvertor';
import CustomizationColumnHeader from './customization-settings/CustomizationColumnHeader';
import CustomizationSettings from './customization-settings';
import DataSet from '../data-set';
import { getColumnKey } from './utils';
import PerformanceTable, { PerformanceTableCustomized, TableProps, TableQueryBarProps, TableRowSelection } from './Table';
import Column, { ColumnProps } from './Column';
import autobind from '../_util/autobind';
import observableColumn from '../_util/observableColumn';
import { ModalProps } from '../modal/Modal';
import { $l } from '../locale-context';
import { ColumnLock, TableAutoHeightType, TableColumnResizeTriggerType, TableHeightType } from '../table/enum';

export function getRowSelection(props: TableProps): TableRowSelection {
  return props.rowSelection || {};
}

function isColumnCustomizationLocked(column: ColumnProps): boolean {
  return column.customizable === false || column.customizable === 'left' || column.customizable === 'right';
}

function getColumnCustomizationPosition(column: ColumnProps): 'left' | 'right' | undefined {
  if (column.customizable === 'right') {
    return 'right';
  }
  if (column.customizable === false || column.customizable === 'left') {
    return 'left';
  }
  return undefined;
}

function sortColumnsByCustomizable(columns: ColumnProps[]): ColumnProps[] {
  const leftColumns: ColumnProps[] = [];
  const centerColumns: ColumnProps[] = [];
  const rightColumns: ColumnProps[] = [];
  sortBy(columns, ({ sort }) => sort).forEach((column) => {
    const customizationPosition = getColumnCustomizationPosition(column);
    if (customizationPosition === 'left') {
      leftColumns.push(column);
    } else if (customizationPosition === 'right') {
      rightColumns.push(column);
    } else {
      centerColumns.push(column);
    }
  });
  return [...leftColumns, ...centerColumns, ...rightColumns].map((column, index) => {
    column.sort = index;
    return column;
  });
}

export function mergeDefaultProps(
  originalColumns: ColumnProps[],
  customizedColumns?: object,
  parent: ColumnProps | null = null,
  defaultKey: number[] = [0],
  columnSort = {
    left: 0,
    center: 0,
    right: 0,
  },
): any[] {
  const columns: any[] = [];
  const leftColumns: any[] = [];
  const rightColumns: any[] = [];
  originalColumns.forEach((column) => {
    if (isPlainObject(column)) {
      const newColumn: ColumnProps = { ...Column.defaultProps, ...column };
      if (isNil(getColumnKey(newColumn))) {
        newColumn.key = `anonymous-${defaultKey[0]++}`;
      }
      const { children } = newColumn;
      if (customizedColumns) {
        const customized = customizedColumns[getColumnKey(newColumn).toString()];
        if (customized) {
          const { width } = customized;
          if (width && math.isBigNumber(width)) {
            customized.width = width.toNumber();
          }
          const mergedCustomized = { ...customized };
          if (isColumnCustomizationLocked(newColumn)) {
            delete mergedCustomized.fixed;
            delete mergedCustomized.hidden;
            delete mergedCustomized.sort;
            delete mergedCustomized.title;
          }
          Object.assign(newColumn, mergedCustomized);
        }
      }
      if (parent) {
        newColumn.fixed = parent.fixed;
      }
      if (children) {
        // @ts-ignore
        const childrenColumns = mergeDefaultProps(children, customizedColumns, newColumn, defaultKey);
        newColumn.children = childrenColumns;
        newColumn.width = childrenColumns.reduce((prev, current) => prev + current.width, 0);
      }
      if (parent || !newColumn.fixed) {
        if (newColumn.sort === undefined) {
          newColumn.sort = columnSort.center;
        }
        columnSort.center++;
        columns.push(newColumn);
      } else if (newColumn.fixed === true || newColumn.fixed === ColumnLock.left) {
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
    }
  }, []);
  if (parent) {
    return sortColumnsByCustomizable(columns).map(observableColumn);
  }
  return [
    ...sortColumnsByCustomizable(leftColumns),
    ...sortColumnsByCustomizable(columns),
    ...sortColumnsByCustomizable(rightColumns),
  ].map(observableColumn);
}

// export interface CheckboxPropsCache {
//   [key: string]: any;
// }

export default class TableStore {
  node: PerformanceTable;

  searchText: string;

  highlightRowIndexs: number[] = [];

  originalChildren: any[];

  // checkboxPropsCache: CheckboxPropsCache = {};

  selectionDirty?: boolean;

  props: PerformanceTable['props'];

  context: PerformanceTable['context'];

  originalColumns: ColumnProps[];

  customizedActiveKey: string[];

  tempCustomized: PerformanceTableCustomized;

  customized: PerformanceTableCustomized;

  totalHeight?: number;

  height?: number;

  loading?: boolean;

  rowZIndex?: number[];

  selectedRowKeys: string[] | number[];

  mouseBatchChooseStartId = 0;

  mouseBatchChooseEndId = 0;

  mouseBatchChooseState: boolean;

  mouseBatchChooseIdList: number[];

  get queryBar(): TableQueryBarProps | false | undefined {
    return this.props.queryBar;
  }

  /**
   * 表头支持编辑
   */
  get columnTitleEditable(): boolean {
    if ('columnTitleEditable' in this.props) {
      return this.props.columnTitleEditable!;
    }
    return this.getConfig('performanceTableColumnTitleEditable') === true;
  }

  get useMouseBatchChoose(): boolean {
    if ('useMouseBatchChoose' in this.props) {
      return this.props.useMouseBatchChoose!;
    }
    return this.getConfig('performanceTableUseMouseBatchChoose') === true;
  }


  get dataSet(): DataSet | undefined {
    const { queryBar } = this;
    if (queryBar) {
      return queryBar.dataSet;
    }
  }

  get tableColumnResizeTrigger(): TableColumnResizeTriggerType {
    return this.getConfig('tableColumnResizeTrigger');
  }

  // @computed
  // get selectedRowKeys(): string[] {
  //   const { queryBar } = this.props;
  //   return queryBar && queryBar.dataSet;
  // }

  private disposed = false;

  private customizedRequest = 0;

  private customizedIdentity?: any[];

  private getCustomizedIdentity() {
    return [this.props.customizedCode, !!this.customizable, this.props.columns, this.props.children,
      this.getConfig('tableCustomizedLoad') || this.getConfig('customizedLoad'), this.dataSet];
  }

  private handleCustomizedResult<T>(promise: Promise<T>): Promise<T> {
    promise.catch(error => warning(false, error instanceof Error ? error.message : String(error)));
    return promise;
  }

  loadCustomized() {
    return this.handleCustomizedResult(this.loadCustomizedAsync());
  }

  private async loadCustomizedAsync() {
    const { customizedCode } = this.props;
    if (!this.disposed && this.customizable && customizedCode) {
      const request = ++this.customizedRequest;
      const identity = this.getCustomizedIdentity();
      this.customizedIdentity = identity;
      const isCurrent = () => !this.disposed && request === this.customizedRequest &&
        identity.every((value, index) => value === this.getCustomizedIdentity()[index]);
      const tableCustomizedLoad = this.getConfig('tableCustomizedLoad') || this.getConfig('customizedLoad');
      runInAction(() => {
        this.loading = true;
      });
      try {
        const customized: PerformanceTableCustomized | undefined | null = await tableCustomizedLoad(customizedCode, 'PerformanceTable');
        runInAction(() => {
          if (isCurrent()) {
            this.customized = { columns: {}, ...customized };
            this.handleLoadCustomized();
          }
        });
      } finally {
        runInAction(() => {
          if (isCurrent()) this.loading = false;
        });
      }
    }
  }

  syncProps(props, context) {
    this.props = props;
    this.context = context;
  }

  syncCustomized() {
    if (this.disposed) return;
    const identity = this.getCustomizedIdentity();
    if (!this.customizedIdentity || identity.some((value, index) => value !== this.customizedIdentity![index])) {
      this.customizedIdentity = identity;
      this.customizedRequest++;
      this.loading = false;
      this.saveCustomizedDebounce.cancel();
      if (this.customizable) {
        this.loadCustomized();
      } else {
        this.initColumns();
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.customizedRequest++;
    this.loading = false;
    this.saveCustomizedDebounce.cancel();
  }

  updateProps(props, node) {
    this.node = node;
    this.syncProps(props, node.context);
    this.originalColumns = props.columns && mergeDefaultProps(props.columns, this.customizable ? this.customized.columns : undefined);
    this.originalChildren = props.children;
  }

  get prefixCls() {
    const { classPrefix } = this.props;
    return classPrefix;
  }

  get proPrefixCls() {
    return this.context.getProPrefixCls('table');
  }

  get columnHideable(): boolean {
    if ('columnHideable' in this.props) {
      return this.props.columnHideable;
    }
    return this.getConfig('performanceTableColumnHideable') !== false;
  }

  get customizable(): boolean | undefined {
    const { customizedCode } = this.props;
    if (customizedCode && (this.columnTitleEditable || this.columnDraggable || this.columnHideable)) {
      if ('customizable' in this.props) {
        return this.props.customizable;
      }
      return this.getConfig('performanceTableCustomizable') || this.context.getCustomizable('PerformanceTable');
    }
    return false;
  }

  get autoHeight(): boolean | { type: TableAutoHeightType; diff: number } {
    const { autoHeight } = this.props;
    if (isUndefined(autoHeight)) {
      const config: any = this.getConfig('performanceTableAutoHeight');
      if (isObject(config)) {
        return {
          type: TableAutoHeightType.minHeight,
          diff: 0,
          ...config,
        };
      }
      return !!config
    }
    if (isObject(autoHeight)) {
      return {
        type: autoHeight.type || TableAutoHeightType.minHeight,
        diff: autoHeight.diff || 0,
      };
    }
    return !!autoHeight

  }

  get heightType(): TableHeightType {
    const tempHeightType = get(this.tempCustomized, 'heightType');
    if (tempHeightType !== undefined) {
      return tempHeightType;
    }
    const { heightType } = this.customized;
    if (heightType !== undefined) {
      return heightType;
    }
    return this.originalHeightType;
  }

  get originalHeightType(): TableHeightType {
    const { height, autoHeight } = this.props;
    if (autoHeight) {
      return TableHeightType.flex;
    }
    if (height) {
      if (isString(height) && isCalcSize(height)) {
        return TableHeightType.flex;
      }
      if (isNumber(toPx(height))) {
        return TableHeightType.fixed;
      }
    }
    return TableHeightType.auto;
  }

  openCustomizationModal(modal) {
    const { customizedCode } = this.props;
    const modalProps: ModalProps = {
      drawer: true,
      size: Size.small,
      title: $l('Table', 'customization_settings'),
      children: <CustomizationSettings />,
      bodyStyle: {
        overflow: 'hidden auto',
        padding: 0,
      },
    };
    if (customizedCode) {
      modalProps.okText = $l('Table', 'save_button');
    }
    modal.open(modalProps);
  }

  @autobind
  customizedColumnHeader() {
    return <CustomizationColumnHeader onHeaderClick={this.openCustomizationModal} />;
  }

  initColumns() {
    if (this.disposed) return;
    const { customized, customizable } = this;
    const { columns = [] } = this.props;
    const customizedColumns = customizable ? customized.columns : undefined;
    this.originalColumns = mergeDefaultProps(columns, customizedColumns);
    this.node.setSelectionColumn(this.props);
    this.node._cacheCells = null;
    this.node.forceUpdate();
  }

  handleLoadCustomized() {
    this.initColumns();
  }

  changeCustomizedColumnValue(columnKey: string, value: object) {
    const { customized: { columns } } = this;
    const oldCustomized = get(columns, columnKey);
    set(columns, columnKey, {
      ...oldCustomized,
      ...value,
    });
    this.saveCustomizedDebounce();
  }

  saveCustomized(customized?: PerformanceTableCustomized | null, otherInfo?: { columnDataSet?: DataSet }) {
    try {
      return this.handleCustomizedResult(Promise.resolve(this.saveCustomizedSync(customized, otherInfo)));
    } catch (error) {
      return this.handleCustomizedResult(Promise.reject(error));
    }
  }

  private saveCustomizedSync(customized?: PerformanceTableCustomized | null, otherInfo?: { columnDataSet?: DataSet }) {
    if (!this.disposed && this.customizable) {
      const { customizedCode } = this.props;
      if (customized) {
        this.customized = customized;
      }
      this.node.forceUpdate();
      if (customizedCode) {
        const tableCustomizedSave = this.getConfig('tableCustomizedSave') || this.getConfig('customizedSave');
        return tableCustomizedSave(customizedCode, this.customized, 'PerformanceTable', otherInfo);
      }
    }
  };

  saveCustomizedDebounce: ReturnType<typeof debounce>;

  get columnDraggable(): boolean {
    if ('columnDraggable' in this.props) {
      return this.props.columnDraggable!;
    }
    return this.getConfig('performanceTableColumnDraggable') === true;
  }

  @autobind
  getConfig<T extends ConfigKeys>(key: T): T extends keyof DefaultConfig ? DefaultConfig[T] : Config[T] {
    return this.context.getConfig(key);
  }

  changeMouseBatchChooseIdList(idList: number[]) {
    this.mouseBatchChooseIdList = idList;
  }

  constructor(node: PerformanceTable) {
    this.context = node.context;
    if (!Object.prototype.hasOwnProperty.call(this, 'props')) Object.assign(this, { props: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'originalColumns')) Object.assign(this, { originalColumns: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'customizedActiveKey')) Object.assign(this, { customizedActiveKey: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'tempCustomized')) Object.assign(this, { tempCustomized: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'customized')) Object.assign(this, { customized: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'totalHeight')) this.totalHeight = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'height')) this.height = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'loading')) this.loading = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'rowZIndex')) this.rowZIndex = undefined;
    if (!Object.prototype.hasOwnProperty.call(this, 'selectedRowKeys')) Object.assign(this, { selectedRowKeys: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'mouseBatchChooseState')) Object.assign(this, { mouseBatchChooseState: undefined });
    if (!Object.prototype.hasOwnProperty.call(this, 'mouseBatchChooseIdList')) Object.assign(this, { mouseBatchChooseIdList: undefined });
    makeObservable<this, 'saveCustomizedSync'>(this, {
      props: observable.ref,
      context: observable.ref,
      syncProps: action,
      syncCustomized: action,
      dispose: action,
      originalColumns: observable,
      customizedActiveKey: observable,
      tempCustomized: observable,
      customized: observable,
      totalHeight: observable,
      height: observable,
      loading: observable,
      rowZIndex: observable,
      selectedRowKeys: observable,
      mouseBatchChooseState: observable,
      mouseBatchChooseIdList: observable,
      columnTitleEditable: computed,
      updateProps: action,
      prefixCls: computed,
      proPrefixCls: computed,
      columnHideable: computed,
      customizable: computed,
      autoHeight: computed,
      heightType: computed,
      originalHeightType: computed,
      openCustomizationModal: action.bound,
      initColumns: action,
      handleLoadCustomized: action.bound,
      changeCustomizedColumnValue: action,
      saveCustomized: action,
      saveCustomizedSync: action,
      columnDraggable: computed,
      changeMouseBatchChooseIdList: action,
    });
    this.saveCustomizedDebounce = debounce(this.saveCustomized, 1000);
    runInAction(() => {
      this.node = node;
      this.props = node.props;
      this.rowZIndex = [];
      this.customizedActiveKey = ['columns'];
      this.tempCustomized = { columns: {} };
      this.customized = { columns: {} };
      this.selectedRowKeys = getRowSelection(this.props).selectedRowKeys || [];
      this.selectionDirty = false;
      this.customizedIdentity = this.getCustomizedIdentity();
      if (this.customizable) this.loadCustomized();
    });
  }
}
