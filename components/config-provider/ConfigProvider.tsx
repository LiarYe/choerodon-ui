import cssVars from 'css-vars-ponyfill';
import React, { FunctionComponent, memo, ReactNode, useCallback, useContext, useMemo } from 'react';
import { observable } from 'mobx';
import { useLocalStore } from 'mobx-react-lite';
import isBoolean from 'lodash/isBoolean';
import { FormProvider } from 'choerodon-ui/pro/lib/form/FormContext';
import ConfigContext, { ConfigContextValue } from './ConfigContext';
import { Config } from '../configure';
import { getConfig, getCustomizable, getPrefixCls, getProPrefixCls, isCustomizable } from '../configure/utils';
import { getTooltip, getTooltipTheme, getUsefulTooltip, getTooltipPlacement } from '../_util/TooltipUtils';
import { updateCSS, canUseDom } from './dynamicCSS';

export interface ConfigProviderProps extends Config {
  children?: ReactNode;
}

const dynamicStyleMark = `-c7n-ui-${Date.now()}-${Math.random()}`;

const registerTheme = (props: object) => {
  // 如果是primary等颜色，可以使用色阶库，生成色阶后赋值给对应的变量

  // 赋值
  const cssList = Object.keys(props).map(
    key => `--${key}: ${props[key]};`,
  );
  
  const cssStr = `
  :root {
    ${cssList.join('\n')}
  }
  `.trim();

  if (canUseDom()) {
    updateCSS(cssStr, `${dynamicStyleMark}-dynamic-theme`);

    if (!!window.ActiveXObject || "ActiveXObject" in window) {
      cssVars({
        onlyLegacy: false,
      });
    }
  }
}

const setGlobalConfig = (props: object) => {
  if (props) {
    registerTheme(props);
  }
}

// @ts-ignore
const ConfigProvider: FunctionComponent<ConfigProviderProps> & { config: typeof setGlobalConfig } = function ConfigProvider(props) {
  const { getConfig: getParentConfig } = useContext(ConfigContext);
  const { children, ...localConfig } = props;
  const configStore = useLocalStore((config) => ({
    config,
  }), observable.map(localConfig));
  const getLocalConfig = useCallback<typeof getConfig>((key) => {
    const localValue = configStore.config.get(key);
    if (configStore.config.has(key)) {
      return localValue;
    }
    return getParentConfig(key);
  }, [configStore, getParentConfig]);
  const getLocalPrefixCls = useCallback<typeof getPrefixCls>((suffixCls, customizePrefixCls) => {
    if (customizePrefixCls) {
      return customizePrefixCls;
    }
    return `${getLocalConfig('prefixCls')}-${suffixCls}`;
  }, [getLocalConfig]);
  const getLocalProPrefixCls = useCallback<typeof getProPrefixCls>((suffixCls, customizePrefixCls) => {
    if (customizePrefixCls) {
      return customizePrefixCls;
    }
    return `${getLocalConfig('proPrefixCls')}-${suffixCls}`;
  }, [getLocalConfig]);
  const getLocalCustomizable = useCallback<typeof getCustomizable>((component) => {
    const customizable = getLocalConfig('customizable');
    if (isBoolean(customizable)) {
      return customizable;
    }
    if (isCustomizable(customizable)) {
      return customizable[component];
    }
  }, [getLocalConfig]);
  const getLocalUsefulTooltip = useCallback<typeof getUsefulTooltip>((target) => {
    switch (target) {
      case 'table-cell':
        return getLocalConfig('tableColumnTooltip');
      case 'button':
        return getLocalConfig('buttonTooltip');
      case 'select-option':
        return getLocalConfig('selectOptionTooltip');
      case 'label':
        return getLocalConfig('labelTooltip');
      default:
    }
  }, [getLocalConfig]);
  const getLocalTooltip = useCallback<typeof getTooltip>((target) => {
    const tooltip = getLocalConfig('tooltip');
    if (typeof tooltip === 'function') {
      return tooltip(target);
    }
    return getLocalUsefulTooltip(target) || tooltip;
  }, [getLocalConfig, getLocalUsefulTooltip]);
  const getLocalTooltipTheme = useCallback<typeof getTooltipTheme>((target) => {
    const tooltipTheme = getLocalConfig('tooltipTheme');
    if (typeof tooltipTheme === 'function') {
      return tooltipTheme(target);
    }
    if (target === 'validation') {
      const validationTooltipTheme = getLocalConfig('validationTooltipTheme');
      if (validationTooltipTheme) {
        return validationTooltipTheme;
      }
    }
    return tooltipTheme;
  }, [getLocalConfig]);
  const getLocalTooltipPlacement = useCallback<typeof getTooltipPlacement>((target) => {
    const tooltipPlacement = getLocalConfig('tooltipPlacement');
    if (typeof tooltipPlacement === 'function') {
      return tooltipPlacement(target);
    }
    return tooltipPlacement;
  }, [getLocalConfig]);
  const value = useMemo<ConfigContextValue>(() => ({
    getConfig: getLocalConfig,
    getPrefixCls: getLocalPrefixCls,
    getProPrefixCls: getLocalProPrefixCls,
    getCustomizable: getLocalCustomizable,
    getTooltip: getLocalTooltip,
    getTooltipTheme: getLocalTooltipTheme,
    getTooltipPlacement: getLocalTooltipPlacement,
  }), [getLocalConfig, getLocalPrefixCls, getLocalProPrefixCls, getLocalCustomizable, getLocalTooltip, getLocalTooltipTheme, getLocalTooltipPlacement]);
  return (
    <ConfigContext.Provider value={value}>
      <FormProvider>
        {children}
      </FormProvider>
    </ConfigContext.Provider>
  );
};

ConfigProvider.displayName = 'ConfigProvider';

// @ts-ignore
const MemoConfigProvider: typeof ConfigProvider = memo(ConfigProvider);
MemoConfigProvider.config = setGlobalConfig;

export default MemoConfigProvider;
