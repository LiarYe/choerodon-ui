import React, { FunctionComponent, memo, ReactNode, useMemo } from 'react';
import { getContext, Symbols } from 'choerodon-ui/shared';
import { getPrefixCls, getConfig } from '../configure/utils';
import { Config, DefaultConfig } from '../configure/index';
import { Size } from '../_util/enum';

export interface AvatarContextValue {
  size?: Size | number;

  getPrefixCls(suffixCls: string, customizePrefixCls?: string): string;

  getConfig<T extends keyof Config>(key: T): T extends keyof DefaultConfig ? DefaultConfig[T] : Config[T];
}

export interface AvatarContextProviderProps extends AvatarContextValue {
  children?: ReactNode;
}

const AvatarContext = getContext<AvatarContextValue>(Symbols.AvatarContext, { getPrefixCls, getConfig });

const BaseAvatarContextProvider: FunctionComponent<AvatarContextProviderProps> = function AvatarContextProvider(props) {
  const { children, size, getPrefixCls: getGlobalPrefixCls, getConfig: getGlobalConfig } = props;
  const value = useMemo(() => ({
    size,
    getPrefixCls: getGlobalPrefixCls,
    getConfig: getGlobalConfig,
  }), [getGlobalPrefixCls, size]);
  return (
    <AvatarContext.Provider value={value}>
      {children}
    </AvatarContext.Provider>
  );
};

BaseAvatarContextProvider.displayName = 'AvatarContextProvider';

export const AvatarContextProvider = memo(BaseAvatarContextProvider);

export default AvatarContext;
