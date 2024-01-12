import React, { FunctionComponent, memo, ReactNode, useMemo } from 'react';
import { getContext, Symbols } from 'choerodon-ui/shared';
import { getPrefixCls, getConfig } from '../configure/utils';
import { Config, DefaultConfig } from '../configure/index';

export interface LayoutSiderContextValue {
  siderCollapsed?: boolean;
  collapsedWidth?: number | string;

  getPrefixCls(suffixCls: string, customizePrefixCls?: string): string;
  getConfig<T extends keyof Config>(key: T): T extends keyof DefaultConfig ? DefaultConfig[T] : Config[T];
}

export interface LayoutSiderContextProviderProps extends LayoutSiderContextValue {
  children?: ReactNode;
}

const LayoutSiderContext = getContext<LayoutSiderContextValue>(Symbols.LayoutSiderContext, { getPrefixCls, getConfig });

const BaseLayoutSiderContextProvider: FunctionComponent<LayoutSiderContextProviderProps> = function LayoutSiderContextProvider(props) {
  const { children, siderCollapsed, collapsedWidth, getPrefixCls: getGlobalPrefixCls, getConfig: getGlobalConfig } = props;
  const value = useMemo(() => ({
    siderCollapsed,
    collapsedWidth,
    getPrefixCls: getGlobalPrefixCls,
    getConfig: getGlobalConfig,
  }), [getGlobalPrefixCls, siderCollapsed, collapsedWidth]);
  return (
    <LayoutSiderContext.Provider value={value}>
      {children}
    </LayoutSiderContext.Provider>
  );
};

BaseLayoutSiderContextProvider.displayName = 'LayoutSiderContextProvider';

export const LayoutSiderContextProvider = memo(BaseLayoutSiderContextProvider);

export default LayoutSiderContext;
