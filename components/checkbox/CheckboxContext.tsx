import React, { FunctionComponent, memo, ReactNode, useMemo } from 'react';
import { getContext, Symbols } from 'choerodon-ui/shared';
import { getPrefixCls, getConfig } from '../configure/utils';
import { CheckboxGroupContext } from './Group';

export interface CheckboxContextProviderProps extends CheckboxGroupContext {
  children?: ReactNode;
}

const CheckboxContext = getContext<CheckboxGroupContext>(Symbols.CheckboxContext, { getPrefixCls, getConfig });

const BaseCheckboxContextProvider: FunctionComponent<CheckboxContextProviderProps> = function CheckboxContextProvider(props) {
  const { children, checkboxGroup, getPrefixCls: getGlobalPrefixCls, getConfig: getGlobalConfig } = props;
  const value = useMemo(() => ({
    checkboxGroup,
    getPrefixCls: getGlobalPrefixCls,
    getConfig: getGlobalConfig,
  }), [getGlobalPrefixCls, checkboxGroup]);
  return (
    <CheckboxContext.Provider value={value}>
      {children}
    </CheckboxContext.Provider>
  );
};

BaseCheckboxContextProvider.displayName = 'CheckboxContextProvider';

export const CheckboxContextProvider = memo(BaseCheckboxContextProvider);

export default CheckboxContext;
