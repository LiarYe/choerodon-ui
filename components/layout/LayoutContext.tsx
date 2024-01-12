import React, { FunctionComponent, memo, ReactNode, useMemo } from 'react';
import { getContext, Symbols } from 'choerodon-ui/shared';
import { getPrefixCls, getConfig } from '../configure/utils';
import { Config, DefaultConfig } from '../configure/index';

export interface LayoutContextValue {
  siderHook?: {
    addSider: (id: string) => void,
    removeSider: (id: string) => void;
  };

  getPrefixCls(suffixCls: string, customizePrefixCls?: string): string;
  getConfig<T extends keyof Config>(key: T): T extends keyof DefaultConfig ? DefaultConfig[T] : Config[T];
}

export interface LayoutContextProviderProps extends LayoutContextValue {
  children?: ReactNode;
}

const LayoutContext = getContext<LayoutContextValue>(Symbols.LayoutContext, { getPrefixCls, getConfig });

const BaseLayoutContextProvider: FunctionComponent<LayoutContextProviderProps> = function LayoutContextProvider(props) {
  const { children, siderHook, getPrefixCls: getGlobalPrefixCls, getConfig: getGlobalConfig } = props;
  const value = useMemo(() => ({
    siderHook,
    getPrefixCls: getGlobalPrefixCls,
    getConfig: getGlobalConfig,
  }), [getGlobalPrefixCls, siderHook]);
  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};

BaseLayoutContextProvider.displayName = 'LayoutContextProvider';

export const LayoutContextProvider = memo(BaseLayoutContextProvider);

export default LayoutContext;
