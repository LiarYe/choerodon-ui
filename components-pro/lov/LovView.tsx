import React, { Component, Key, ReactNode } from 'react';
import classNames from 'classnames';
import { action, toJS } from 'mobx';
import isPromise from 'is-promise';
import noop from 'lodash/noop';
import debounce from 'lodash/debounce';
import isNil from 'lodash/isNil';
import KeyCode from 'choerodon-ui/lib/_util/KeyCode';
import { math } from 'choerodon-ui/dataset';
import ConfigContext from 'choerodon-ui/lib/config-provider/ConfigContext';
import Alert from 'choerodon-ui/lib/alert';
import DataSet from '../data-set/DataSet';
import Record from '../data-set/Record';
import Table, { onColumnResizeProps, TableProps, TableQueryBarHookCustomProps } from '../table/Table';
import TableProfessionalBar from '../table/query-bar/TableProfessionalBar';
import { SelectionMode, TableMode, TableQueryBarType } from '../table/enum';
import { DataSetEvents, DataSetSelection, DataSetStatus } from '../data-set/enum';
import { ColumnProps } from '../table/Column';
import { ModalChildrenProps } from '../modal/interface';
import autobind from '../_util/autobind';
import { getColumnKey } from '../table/utils';
import SelectionList, { SelectionsPosition } from './SelectionList';
import { LovConfig, ViewRenderer, SelectionProps } from './Lov';
import { FormContextValue } from '../form/FormContext';
import { TriggerViewMode } from '../trigger-field/TriggerField';
import Picture from '../picture';
import ObserverNumberField from '../number-field';
import { $l } from '../locale-context';
import { Lang } from '../locale-context/enum';
import { processFieldValue } from '../field/utils';

export interface LovViewProps {
  dataSet: DataSet;
  config: LovConfig;
  context: FormContextValue;
  tableProps?: Partial<TableProps>;
  multiple: boolean;
  values: any[];
  viewMode?: TriggerViewMode;
  onSelect: (records: Record | Record[]) => void;
  onBeforeSelect?: (records: Record | Record[]) => boolean | Promise<boolean | undefined> | undefined;
  modal?: ModalChildrenProps;
  popupHidden?: boolean;
  valueField?: string;
  textField?: string;
  viewRenderer?: ViewRenderer;
  showSelectedInView?: boolean;
  getSelectionProps?: () => SelectionProps,
  showDetailWhenReadonly?: boolean;
  lang?: Lang;
}

interface LovViewState {
  dataSetLoaded: boolean;
}

export default class LovView extends Component<LovViewProps, LovViewState> {
  static get contextType(): typeof ConfigContext {
    return ConfigContext;
  }

  selection: DataSetSelection | false;

  selectionMode: SelectionMode | undefined;

  resizedColumns: Map<Key, number> = new Map<Key, number>();

  constructor(props: LovViewProps) {
    super(props);
    const {
      dataSet,
      showDetailWhenReadonly,
    } = props;
    if (showDetailWhenReadonly) {
      dataSet.addEventListener(DataSetEvents.load, this.handleDataSetLoad);
    }
    this.state = {
      dataSetLoaded: dataSet.status === DataSetStatus.ready,
    };
  }

  @action
  componentWillMount() {
    const {
      dataSet,
      dataSet: { selection },
      multiple,
      viewMode,
    } = this.props;
    this.selection = selection;
    dataSet.selection = multiple ? DataSetSelection.multiple : DataSetSelection.single;
    if (viewMode === TriggerViewMode.popup && multiple) {
      dataSet.addEventListener(DataSetEvents.batchSelect, this.handleSelect);
      dataSet.addEventListener(DataSetEvents.batchUnSelect, this.handleSelect);
    }
  }

  @action
  componentWillUnmount() {
    const { dataSet, multiple, viewMode, showDetailWhenReadonly } = this.props;
    dataSet.selection = this.selection;
    if (viewMode === TriggerViewMode.popup && multiple) {
      dataSet.removeEventListener(DataSetEvents.batchSelect, this.handleSelect);
      dataSet.removeEventListener(DataSetEvents.batchUnSelect, this.handleSelect);
    }
    if (showDetailWhenReadonly) {
      dataSet.removeEventListener(DataSetEvents.load, this.handleDataSetLoad);
    }
  }

  @action
  componentWillReceiveProps(nextProps: LovViewProps) {
    const { dataSet: beforeDataSet, showDetailWhenReadonly } = this.props;
    if (beforeDataSet !== nextProps.dataSet) {
      const {
        dataSet,
        dataSet: { selection },
        multiple,
        viewMode,
      } = nextProps;
      this.selection = selection;
      dataSet.selection = multiple ? DataSetSelection.multiple : DataSetSelection.single;
      if (viewMode === TriggerViewMode.popup && multiple) {
        dataSet.addEventListener(DataSetEvents.batchSelect, this.handleSelect);
        dataSet.addEventListener(DataSetEvents.batchUnSelect, this.handleSelect);
      }
      if (showDetailWhenReadonly) {
        dataSet.addEventListener(DataSetEvents.load, this.handleDataSetLoad);
      }
    }
  }

  shouldComponentUpdate(nextProps: Readonly<LovViewProps>): boolean {
    const { viewMode } = this.props;
    if (viewMode === TriggerViewMode.popup && nextProps.popupHidden) {
      return false;
    }
    return true;
  }

  /* istanbul ignore next */
  getColumns(): ColumnProps[] | undefined {
    const {
      config: { lovItems },
      tableProps,
      viewMode,
      context,
      lang,
    } = this.props;
    const { getConfig } = context;
    return lovItems
      ? lovItems
        .filter(({ gridField }) => gridField === 'Y')
        .sort(({ gridFieldSequence: seq1 }, { gridFieldSequence: seq2 }) => seq1 - seq2)
        .map<ColumnProps>(({ display, gridFieldName, gridFieldWidth, gridFieldAlign, gridFieldType }) => {
          let column: ColumnProps | undefined = {};
          if (tableProps && tableProps.columns) {
            column = tableProps.columns.find(c => c.name === gridFieldName);
          }
          // 渲染 lov 中的 超链接 和 图片类型字段
          column = column || {};
          if (gridFieldType && gridFieldType.toLowerCase() === 'href') {
            column.renderer = ({ value }) => (
              value ? (
                <a
                  href={value}
                  title={value}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {value}
                </a>
              ) : undefined
            );
          }
          else if (gridFieldType && gridFieldType.toLowerCase() === 'picture') {
            column.renderer = ({ value }) => (
              value ? <Picture src={value} objectFit="contain" height={"inherit" as any} block={false} /> : undefined
            );
          } else if (gridFieldType && gridFieldType.toLowerCase() === 'percent') {
            column.renderer = ({ value, name, record, dataSet }) => {
              if (isNil(value)) {
                return value;
              }
              const percentValue = math.multipliedBy(value, 100);
              if (dataSet) {
                const field = dataSet.getField(name);
                const processValue = processFieldValue(percentValue, field, {
                  getProp: (propName) => field && field.get(propName, record!),
                  lang,
                }, true, record!, getConfig);
                return `${processValue}%`;
              }
              return `${percentValue}%`;
            };
          }
          return {
            ...column,
            key: gridFieldName,
            header: display,
            name: gridFieldName,
            width: viewMode === TriggerViewMode.popup ? gridFieldName ? this.resizedColumns.get(gridFieldName) : undefined : gridFieldWidth,
            align: gridFieldAlign,
            editor: false,
          };
        })
      : undefined;
  }

  handleDataSetLoad = () => {
    const { showDetailWhenReadonly } = this.props;
    if (showDetailWhenReadonly) {
      this.setState({
        dataSetLoaded: true,
      });
    }
  }

  closeModal(record: Record | Record[] | undefined, closeModal?: boolean) {
    if (record) {
      const { onSelect, modal } = this.props;
      if (modal && closeModal) {
        modal.close();
      }
      onSelect(record);
    }
  }

  handleSelect = (event?: React.MouseEvent) => {
    const { type: eventType } = event || {};
    const { selectionMode } = this;
    const {
      onBeforeSelect = noop,
      multiple,
      dataSet,
      tableProps,
    } = this.props;
    let records: Record[] = selectionMode === SelectionMode.treebox ?
      dataSet.treeSelected : (selectionMode === SelectionMode.rowbox || selectionMode === SelectionMode.dblclick || multiple) ?
        dataSet.selected : dataSet.current ? [dataSet.current] : [];
    // 满足单选模式下，双击和勾选框选中均支持
    if (tableProps && tableProps.alwaysShowRowBox && !event) {
      records = dataSet.selected;
    }
    const record: Record | Record[] | undefined = multiple ? records : records[0];
    const beforeSelect = onBeforeSelect(record);
    if (isPromise(beforeSelect)) {
      return beforeSelect.then(result => {
        if (result !== false) {
          this.closeModal(record, eventType === 'dblclick');
        }
        return result;
      });
    }
    if (beforeSelect !== false) {
      this.closeModal(record, eventType === 'dblclick');
      return beforeSelect;
    }
    return false;
  }

  handleDelaySelect = debounce(this.handleSelect, 300);

  /* istanbul ignore next */
  @autobind
  handleKeyDown(e) {
    if (e.keyCode === KeyCode.ENTER) {
      this.handleSelect();
    }
  }

  handleDoubleClickSelect = (e: React.MouseEvent) => {
    e.persist();
    this.handleSelect(e);
  }

  /**
   * 单选 onRow 处理
   * @param props
   */
  @autobind
  handleRow(props) {
    const { tableProps } = this.props;
    const { record: { disabled, selectable } } = props;
    const isDisabled = disabled || !selectable;
    if (tableProps) {
      const { onRow } = tableProps;
      if (onRow) {
        return {
          onDoubleClick: !isDisabled ? this.handleDoubleClickSelect : noop,
          ...onRow(props),
        };
      }
    }
    return {
      onDoubleClick: !isDisabled ? this.handleDoubleClickSelect : noop ,
    };
  }

  @autobind
  handleSingleRow(props) {
    const { tableProps } = this.props;
    const isDisabled = (props.record as Record).disabled;
    if (tableProps) {
      const { onRow } = tableProps;
      if (onRow) {
        return {
          onClick: !isDisabled ? this.handleDelaySelect : noop,
          ...onRow(props),
        };
      }
    }
    return {
      onClick: !isDisabled ? this.handleDelaySelect : noop,
    };
  }

  @autobind
  handleColumnResize(props: onColumnResizeProps) {
    const { width, column } = props;
    this.resizedColumns.set(getColumnKey(column), width);
  }

  renderTable() {
    const {
      dataSet,
      config: { queryBar, height, treeFlag, delayLoad, expandFlag, queryColumns, tableProps: configTableProps = {}, lovItems },
      multiple,
      tableProps,
      viewMode,
      context,
      showSelectedInView,
      showDetailWhenReadonly,
      values,
    } = this.props;
    const { dataSetLoaded } = this.state;
    const { getConfig } = context;
    const columns = this.getColumns();
    const popup = viewMode === TriggerViewMode.popup;
    const modal = viewMode === TriggerViewMode.modal;
    const drawer = viewMode === TriggerViewMode.drawer;

    const percentItems = {};
    if (lovItems) {
      lovItems.filter(x => x.gridFieldType && x.gridFieldType.toLowerCase() === 'percent' && x.conditionField === 'Y').forEach(x => {
        percentItems[x.gridFieldName!] = <ObserverNumberField suffix={<span>%</span>} />;
      });
    }

    const lovTableProps: TableProps = {
      autoFocus: true,
      mode: treeFlag === 'Y' ? TableMode.tree : TableMode.list,
      treeAsync: delayLoad === 'Y',
      defaultRowExpanded: expandFlag === 'Y',
      onKeyDown: this.handleKeyDown,
      dataSet,
      columns,
      queryFieldsLimit: queryColumns,
      queryBar: queryBar || getConfig('lovQueryBar') || getConfig('queryBar'),
      selectionMode: SelectionMode.none,
      ...configTableProps,
      ...tableProps,
      queryFields: {
        ...(tableProps && tableProps.queryFields),
        ...percentItems,
      },
      className: classNames(configTableProps && configTableProps.className, tableProps && tableProps.className),
      style: {
        ...(configTableProps && configTableProps.style),
        height,
        ...(tableProps && tableProps.style),
      },
      queryBarProps: {
        ...(tableProps && tableProps.queryBarProps),
        ...(configTableProps && configTableProps.queryBarProps),
        ...getConfig('lovQueryBarProps'),
      } as TableQueryBarHookCustomProps,
    };
    if (multiple) {
      if (popup || !tableProps || !tableProps.selectionMode) {
        if (lovTableProps.mode === TableMode.tree) {
          lovTableProps.selectionMode = SelectionMode.treebox;
        } else {
          lovTableProps.selectionMode = SelectionMode.rowbox;
        }
      }
      if (lovTableProps.selectionMode !== SelectionMode.rowbox && lovTableProps.selectionMode !== SelectionMode.treebox) {
        lovTableProps.highLightRow = false;
        lovTableProps.selectedHighLightRow = true;
      }
    } else if (popup) {
      lovTableProps.onRow = this.handleSingleRow;
    } else if (lovTableProps.selectionMode !== SelectionMode.rowbox) {
      lovTableProps.onRow = this.handleRow;
    } else {
      lovTableProps.highLightRow = false;
      lovTableProps.selectedHighLightRow = true;
    }
    if (popup) {
      if (lovTableProps.showSelectionCachedButton === undefined) {
        lovTableProps.showSelectionCachedButton = false;
        lovTableProps.showCachedSelection = true;
      }
      lovTableProps.autoFocus = false;
      lovTableProps.autoWidth = 'autoWidth' in lovTableProps ? lovTableProps.autoWidth : true;
      lovTableProps.onColumnResize = this.handleColumnResize;
    }

    const isProfessionalBar = lovTableProps.queryBar === TableQueryBarType.professionalBar;
    if (!popup && !lovTableProps.queryBar && isProfessionalBar) {
      lovTableProps.queryBar = (props) => <TableProfessionalBar {...props} />;
    }
    if ((modal || drawer) && showSelectedInView) {
      lovTableProps.showSelectionTips = false;
    }
    let warningNode: ReactNode;
    if (showDetailWhenReadonly) {
      lovTableProps.queryBar = TableQueryBarType.none;
      lovTableProps.selectionMode = SelectionMode.none;
      lovTableProps.filter = () => (values.length === dataSet.length);
      lovTableProps.pagination = false;
      warningNode = (
        <Alert
          style={{ marginBottom: '10px' }}
          message={$l('Lov', 'non_conformity_warning')}
          type="warning"
          showIcon
        />
      );
    }
    this.selectionMode = lovTableProps.selectionMode;
    return (
      <>
        {dataSetLoaded && values.length !== dataSet.length && warningNode}
        <Table {...lovTableProps} />
        {!showDetailWhenReadonly && modal && this.renderSelectionList()}
      </>
    );
  }

  renderSelectionList() {
    const {
      dataSet,
      valueField = '',
      textField = '',
      config: { treeFlag, tableProps: configTableProps },
      tableProps,
      multiple,
      viewMode,
      showSelectedInView,
      getSelectionProps,
      context,
    } = this.props;
    if (!showSelectedInView || !multiple) {
      return null;
    }

    if (!this.selectionMode) {
      const selectionMode = tableProps && tableProps.selectionMode || configTableProps && configTableProps.selectionMode;
      if (!selectionMode) {
        this.selectionMode = treeFlag === 'Y' ? SelectionMode.treebox : SelectionMode.rowbox;
      } else {
        this.selectionMode = selectionMode;
      }
    }

    const selectionsPosition = viewMode === TriggerViewMode.drawer ?
      SelectionsPosition.side :
      (viewMode === TriggerViewMode.modal ? SelectionsPosition.below : undefined);

    return (
      <SelectionList
        dataSet={dataSet}
        treeFlag={treeFlag}
        valueField={valueField}
        textField={textField}
        selectionsPosition={selectionsPosition}
        selectionProps={getSelectionProps && getSelectionProps()}
        selectionMode={this.selectionMode}
        context={context}
      />
    );
  }

  render() {
    const {
      modal,
      viewRenderer,
      dataSet,
      viewMode,
      config: lovConfig,
      textField,
      valueField,
      multiple,
    } = this.props;
    if (modal) {
      modal.handleOk(this.handleSelect);
    }
    return (
      <>
        {viewMode === TriggerViewMode.drawer && this.renderSelectionList()}
        <div>
          {viewRenderer
            ? toJS(
              viewRenderer({
                dataSet,
                lovConfig,
                textField,
                valueField,
                multiple,
                modal,
              }),
            )
            : this.renderTable()}
        </div>
      </>
    );
  }
}
