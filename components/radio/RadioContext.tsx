import React, { FunctionComponent, memo, ReactNode, useMemo } from 'react';
import { getContext, Symbols } from 'choerodon-ui/shared';
import { getPrefixCls, getConfig } from '../configure/utils';
import { Config, DefaultConfig } from '../configure/index';
import { RadioChangeEvent } from './interface';

export interface RadioGroupContext {
  radioGroup?: {
    onChange: (e: RadioChangeEvent) => void;
    value: any;
    disabled?: boolean;
    name?: string;
  };

  getPrefixCls(suffixCls: string, customizePrefixCls?: string): string;
  getConfig<T extends keyof Config>(key: T): T extends keyof DefaultConfig ? DefaultConfig[T] : Config[T];
}

export interface RadioContextProviderProps extends RadioGroupContext {
  children?: ReactNode;
}

const RadioContext = getContext<RadioGroupContext>(Symbols.RadioContext, { getPrefixCls, getConfig });

const BaseRadioContextProvider: FunctionComponent<RadioContextProviderProps> = function RadioContextProvider(props) {
  const { children, radioGroup, getPrefixCls: getGlobalPrefixCls, getConfig: getGlobalConfig } = props;
  const value = useMemo(() => ({
    radioGroup,
    getPrefixCls: getGlobalPrefixCls,
    getConfig: getGlobalConfig,
  }), [getGlobalPrefixCls, radioGroup]);
  return (
    <RadioContext.Provider value={value}>
      {children}
    </RadioContext.Provider>
  );
};

BaseRadioContextProvider.displayName = 'RadioContextProvider';

export const RadioContextProvider = memo(BaseRadioContextProvider);

export default RadioContext;
