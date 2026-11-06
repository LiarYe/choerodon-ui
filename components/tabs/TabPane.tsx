import React, { CSSProperties, FunctionComponent, memo, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { action } from 'mobx';
import classnames from 'classnames';
import DataSet from 'choerodon-ui/dataset';
import { DataSetEvents } from 'choerodon-ui/dataset/data-set/enum';
import ConfigProvider from '../config-provider';
import { getDataAttr } from './utils';
import { CountRendererProps } from './Count';
import TabsContext from './TabsContext';

export interface TabPaneProps {
  /** 选项卡头显示文字 */
  tab?: ReactNode | ((title?: string) => ReactNode);
  title?: string;
  style?: CSSProperties;
  active?: boolean;
  closable?: boolean;
  className?: string;
  eventKey?: string;
  rootPrefixCls?: string;
  disabled?: boolean;
  forceRender?: boolean;
  destroyInactiveTabPane?: boolean;
  count?: number | (() => number | undefined);
  countRenderer?: (props: CountRendererProps) => ReactNode;
  overflowCount?: number;
  showCount?: boolean;
  placeholder?: ReactNode;
  sort?: number;
  dataSet?: DataSet | DataSet[];
  children?: ReactNode;
  hidden?: boolean;
}

const TabPane: FunctionComponent<TabPaneProps> = function TabPane(props) {
  const {
    className,
    destroyInactiveTabPane,
    active,
    forceRender,
    rootPrefixCls,
    style,
    children,
    placeholder,
    disabled,
    dataSet,
    eventKey,
    ...restProps
  } = props;
  const { validationMap, showInvalidTips } = useContext(TabsContext);
  const dsList: DataSet[] = useMemo(() => dataSet ? ([] as DataSet[]).concat(dataSet) : [], [dataSet]);
  const previousDataSets = useRef<DataSet[]>([]);
  const invalidComponents: Set<any> = useMemo(() => new Set<any>(), []);
  const { length } = dsList;
  const [rendered, setRendered] = useState(active);
  const prefixCls = `${rootPrefixCls}-tabpane`;
  const cls = classnames(prefixCls, active ? `${prefixCls}-active` : `${prefixCls}-inactive`, className);
  const paneRef = useRef<HTMLDivElement>(null);

  const handleValidationReport = useCallback(action<(props: { showInvalid, component }) => void>((validationProps) => {
    if (showInvalidTips === false) {
      if (eventKey) {
        validationMap.delete(eventKey);
      }
      return;
    }
    // why validationProps is undefined?
    if (validationProps) {
      const { showInvalid, component } = validationProps;
      if (!disabled && eventKey) {
        if (showInvalid) {
          invalidComponents.add(component);
        } else {
          invalidComponents.delete(component);
        }
        validationMap.set(eventKey, invalidComponents.size === 0);
      }
    }
  }), [eventKey, disabled, invalidComponents, showInvalidTips, validationMap]);
  const handleValidate = useCallback(({ valid, dataSet }) => {
    handleValidationReport({
      showInvalid: !valid,
      component: dataSet,
    });
  }, [handleValidationReport]);
  const handleReset = useCallback(({ dataSet, record }) => {
    if (record) {
      const errors = dataSet.getAllValidationErrors();
      handleValidationReport({
        showInvalid: errors.dataSet.length > 0 || errors.records.length > 0,
        component: dataSet,
      });
    } else {
      handleValidationReport({
        showInvalid: false,
        component: dataSet,
      });
    }
  }, [handleValidationReport]);

  const handleRemove = useCallback(({ dataSet, records }) => {
    if (records) {
      const errors = dataSet.getAllValidationErrors();
      handleValidationReport({
        showInvalid: errors.dataSet.length > 0 || errors.records.length > 0,
        component: dataSet,
      });
    }
  }, [handleValidationReport]);

  useEffect(() => () => invalidComponents.clear(), []);

  useEffect(() => {
    if (showInvalidTips === false) {
      invalidComponents.clear();
      if (eventKey) {
        action(() => validationMap.delete(eventKey))();
      }
    }
  }, [showInvalidTips, invalidComponents, validationMap, eventKey]);

  useEffect(() => {
    if (!destroyInactiveTabPane && active) {
      setRendered(true);
    }
  }, [destroyInactiveTabPane, active]);

  useEffect(() => {
    let changed = false;
    previousDataSets.current.forEach(ds => {
      if (!dsList.includes(ds) && invalidComponents.delete(ds)) {
        changed = true;
      }
    });
    previousDataSets.current = dsList;
    if (changed && eventKey && showInvalidTips !== false) {
      action(() => validationMap.set(eventKey, invalidComponents.size === 0))();
    }
  }, [dsList, eventKey, invalidComponents, validationMap, showInvalidTips]);

  useEffect(() => {
    if (length && !disabled && showInvalidTips !== false) {
      dsList.forEach(
        ds => ds
          .addEventListener(DataSetEvents.validate, handleValidate)
          .addEventListener(DataSetEvents.validateSelf, handleValidate)
          .addEventListener(DataSetEvents.remove, handleRemove)
          .addEventListener(DataSetEvents.reset, handleReset),
      );
      return () => dsList.forEach(
        ds => ds
          .removeEventListener(DataSetEvents.validate, handleValidate)
          .removeEventListener(DataSetEvents.validateSelf, handleValidate)
          .removeEventListener(DataSetEvents.remove, handleRemove)
          .removeEventListener(DataSetEvents.reset, handleReset),
      );
    }
  }, [disabled, handleValidate, handleReset, handleRemove, dsList, length, showInvalidTips]);

  const childrenWithProvider = length || showInvalidTips === false ? children : (
    <ConfigProvider onComponentValidationReport={handleValidationReport}>
      {children}
    </ConfigProvider>
  );

  const handleFocus = (e) => {
    if (!active && paneRef.current && e.currentTarget.contains(e.target)) {
      paneRef.current.focus();
    }
  }

  return (
    <div
      style={style}
      role="tabpanel"
      aria-hidden={active ? 'false' : 'true'}
      className={cls}
      tabIndex={-1}
      data-node-key={eventKey} 
      ref={paneRef}
      onFocus={handleFocus}
      {...getDataAttr(restProps)}
    >
      {forceRender || (destroyInactiveTabPane ? active : rendered) ? childrenWithProvider : placeholder}
    </div>
  );
};

TabPane.displayName = 'TabPane';

const MemoTabPane: typeof TabPane = memo(TabPane, (props, nextProps) => !nextProps.forceRender && !props.active && !nextProps.active && props.dataSet === nextProps.dataSet && props.disabled === nextProps.disabled && props.eventKey === nextProps.eventKey);

MemoTabPane.defaultProps = {
  overflowCount: 99,
  showCount: true,
  hidden: false,
};

export default MemoTabPane;
