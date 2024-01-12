import React, { FunctionComponent, memo, ReactNode, useMemo } from 'react';
import { getContext, Symbols } from 'choerodon-ui/shared';
import { getConfig } from '../configure/utils';
import { Config, DefaultConfig } from '../configure/index';

export interface MenuContextValue {
  inlineCollapsed?: boolean;
  menuTheme?: string;

  getConfig<T extends keyof Config>(key: T): T extends keyof DefaultConfig ? DefaultConfig[T] : Config[T];
}

export interface MenuContextProviderProps extends MenuContextValue {
  children?: ReactNode;
}

const MenuContext = getContext<MenuContextValue>(Symbols.MenuContext, { getConfig });

const BaseMenuContextProvider: FunctionComponent<MenuContextProviderProps> = function MenuContextProvider(props) {
  const { children, inlineCollapsed, menuTheme, getConfig: getGlobalConfig } = props;
  const value = useMemo(() => ({
    inlineCollapsed,
    menuTheme,
    getConfig: getGlobalConfig,
  }), [inlineCollapsed, menuTheme]);
  return (
    <MenuContext.Provider value={value}>
      {children}
    </MenuContext.Provider>
  );
};

BaseMenuContextProvider.displayName = 'MenuContextProvider';

export const MenuContextProvider = memo(BaseMenuContextProvider);

export default MenuContext;
