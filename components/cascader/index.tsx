import React, { ChangeEvent, Component, CSSProperties, KeyboardEvent, MouseEventHandler, ReactElement, ReactNode } from 'react';
import arrayTreeFilter from 'array-tree-filter';
import classNames from 'classnames';
import omit from 'lodash/omit';
import isEmpty from 'lodash/isEmpty';
import { MenuMode } from './enum';
import Input from '../input';
import Icon from '../icon';
import RcCascader from '../rc-components/cascader';
import KeyCode from '../_util/KeyCode';
import { Size } from '../_util/enum';
import LocaleReceiver from '../locale-provider/LocaleReceiver';
import { getRuntimeLocale } from '../locale-provider/utils';
import ConfigContext, { ConfigContextValue } from '../config-provider/ConfigContext';

export interface CascaderOptionType {
  value?: string;
  label?: React.ReactNode;
  disabled?: boolean;
  children?: Array<CascaderOptionType>;

  [key: string]: any;

  __IS_FILTERED_OPTION?: boolean;
}

export interface FieldNamesType {
  value?: string;
  label?: string;
  children?: string;
}

export interface FilledFieldNamesType {
  value: string;
  label: string;
  children: string;
}

export type CascaderExpandTrigger = 'click' | 'hover';

export interface ShowSearchType {
  filter?: (inputValue: string, path: CascaderOptionType[], names: FilledFieldNamesType) => boolean;
  render?: (
    inputValue: string,
    path: CascaderOptionType[],
    prefixCls: string | undefined,
    names: FilledFieldNamesType,
  ) => React.ReactNode;
  sort?: (a: CascaderOptionType[], b: CascaderOptionType[], inputValue: string, names: FilledFieldNamesType) => number;
  matchInputWidth?: boolean;
}

export {
  MenuMode,
};
export type CascaderLocale = any;

export interface CascaderProps {
  /** 可选项数据源 */
  options: CascaderOptionType[];
  /** 默认的选中项 */
  defaultValue?: string[];
  /** 指定选中项 */
  value?: string[];
  /** 选择完成后的回调 */
  onChange?: (value: string[], selectedOptions?: CascaderOptionType[]) => void;
  /** 选择后展示的渲染函数 */
  displayRender?: (label: string[], selectedOptions?: CascaderOptionType[]) => ReactNode;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 自定义类名 */
  className?: string;
  /** 自定义浮层类名 */
  popupClassName?: string;
  /** 浮层预设位置：`bottomLeft` `bottomRight` `topLeft` `topRight` */
  popupPlacement?: string;
  /** 输入框占位文本 */
  placeholder?: string;
  /** 输入框大小，可选 `large` `default` `small` */
  size?: Size;
  /** 禁用 */
  disabled?: boolean;
  /** 是否支持清除 */
  allowClear?: boolean;
  showSearch?: boolean | ShowSearchType;
  notFoundContent?: ReactNode;
  loadData?: (selectedOptions?: CascaderOptionType[]) => void;
  /** 次级菜单的展开方式，可选 'click' 和 'hover' */
  expandTrigger?: CascaderExpandTrigger;
  /** 当此项为 true 时，点选每级菜单选项值都会发生变化 */
  changeOnSelect?: boolean;
  /** 浮层可见变化时回调 */
  onPopupVisibleChange?: (popupVisible: boolean) => void;
  prefixCls?: string;
  inputPrefixCls?: string;
  getPopupContainer?: (triggerNode?: HTMLElement) => HTMLElement;
  popupVisible?: boolean;
  fieldNames?: FieldNamesType;
  label?: ReactNode;
  /** 单框弹出形式切换 */
  menuMode?: MenuMode;
  /** 由于渲染在body下可以方便按照业务配置弹出框的大小 */
  singleMenuStyle?: CSSProperties;
  /** 由于渲染在body下可以方便按照业务配置超出大小样式和最小宽度等 */
  singleMenuItemStyle?: CSSProperties;
  /** 设置需要的提示问题配置 */
  singlePleaseRender?: ({ key, className, text }: { key: string; className: string; text: string }) => ReactElement<any>;
  /** 头部可以渲染出想要的tab样子 */
  singleMenuItemRender?: (title: string) => ReactElement<any>;
}

export interface CascaderState {
  inputFocused: boolean;
  inputValue: string;
  value: string[];
  popupVisible: boolean | undefined;
  flattenOptions: CascaderOptionType[][] | undefined;
}

function highlightKeyword(str: string, keyword: string, prefixCls: string | undefined) {
  return str.split(keyword).map((node: string, index: number) =>
    index === 0
      ? node
      : [
        <span className={`${prefixCls}-menu-item-keyword`} key="seperator">
          {keyword}
        </span>,
        node,
      ],
  );
}

function defaultFilterOption(inputValue: string, path: CascaderOptionType[], names: FilledFieldNamesType) {
  return path.some(option => (option[names.label] as string).indexOf(inputValue) > -1);
}

function defaultRenderFilteredOption(
  inputValue: string,
  path: CascaderOptionType[],
  prefixCls: string | undefined,
  names: FilledFieldNamesType,
) {
  return path.map((option, index) => {
    const label = option[names.label];
    const node = (label as string).indexOf(inputValue) > -1 ?
      highlightKeyword(label as string, inputValue, prefixCls) : label;
    return index === 0 ? node : [' / ', node];
  });
}

function defaultSortFilteredOption(
  a: CascaderOptionType[], b: CascaderOptionType[], inputValue: string, names: FilledFieldNamesType,
) {
  function callback(elem: CascaderOptionType) {
    return (elem[names.label] as string).indexOf(inputValue) > -1;
  }

  return a.findIndex(callback) - b.findIndex(callback);
}

function getFilledFieldNames(fieldNames: FieldNamesType = {}) {
  const names: FilledFieldNamesType = {
    children: fieldNames.children || 'children',
    label: fieldNames.label || 'label',
    value: fieldNames.value || 'value',
  };
  return names;
}

const defaultDisplayRender = (label: string[]) => label.join(' / ');

export default class Cascader extends Component<CascaderProps, CascaderState> {
  static displayName = 'Cascader';

  static get contextType(): typeof ConfigContext {
    return ConfigContext;
  }

  static defaultProps = {
    placeholder: 'Please select',
    transitionName: 'slide-up',
    popupPlacement: 'bottomLeft',
    options: [],
    disabled: false,
    allowClear: true,
    notFoundContent: 'Not Found',
    menuMode: MenuMode.multiple,
  };

  context: ConfigContextValue;

  cachedOptions: CascaderOptionType[];

  private input: Input;

  constructor(props: CascaderProps) {
    super(props);
    this.state = {
      value: props.value || props.defaultValue || [],
      inputValue: '',
      inputFocused: false,
      popupVisible: props.popupVisible,
      flattenOptions: props.showSearch ? this.flattenTree(props.options, props.changeOnSelect, props.fieldNames) : undefined,
    };
  }

  componentWillReceiveProps(nextProps: CascaderProps) {
    if ('value' in nextProps) {
      this.setState({ value: nextProps.value || [] });
    }
    if ('popupVisible' in nextProps) {
      this.setState({ popupVisible: nextProps.popupVisible });
    }
    const { options } = this.props;
    if (nextProps.showSearch && options !== nextProps.options) {
      this.setState({
        flattenOptions: this.flattenTree(nextProps.options, nextProps.changeOnSelect, nextProps.fieldNames),
      });
    }
  }

  handleChange = (value: any, selectedOptions: CascaderOptionType[]) => {
    this.setState({ inputValue: '' });
    if (selectedOptions[0].__IS_FILTERED_OPTION) {
      const unwrappedValue = value[0];
      const unwrappedSelectedOptions = selectedOptions[0].path;
      this.setValue(unwrappedValue, unwrappedSelectedOptions);
      return;
    }
    this.setValue(value, selectedOptions);
  };

  handlePopupVisibleChange = (popupVisible: boolean) => {
    if (!('popupVisible' in this.props)) {
      const { inputValue } = this.state;
      this.setState({
        popupVisible,
        inputFocused: popupVisible,
        inputValue: popupVisible ? inputValue : '',
      });
    }

    const { onPopupVisibleChange } = this.props;
    if (onPopupVisibleChange) {
      onPopupVisibleChange(popupVisible);
    }
  };

  handleInputBlur = () => {
    this.setState({
      inputFocused: false,
    });
  };

  handleInputClick: MouseEventHandler<HTMLInputElement> = e => {
    const { inputFocused, popupVisible } = this.state;
    // Prevent `Trigger` behaviour.
    if (inputFocused || popupVisible) {
      e.stopPropagation();
      if (e.nativeEvent.stopImmediatePropagation) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
  };

  handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === KeyCode.BACKSPACE) {
      e.stopPropagation();
    }
  };

  handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    this.setState({ inputValue });
  };

  clearSelection: MouseEventHandler<HTMLElement> = e => {
    e.preventDefault();
    e.stopPropagation();
    const { inputValue } = this.state;
    if (!inputValue) {
      this.setValue([]);
      this.handlePopupVisibleChange(false);
    } else {
      this.setState({ inputValue: '' });
    }
  };

  setValue = (value: string[], selectedOptions: CascaderOptionType[] = []) => {
    if (!('value' in this.props)) {
      this.setState({ value });
    }
    const { onChange } = this.props;
    if (onChange) {
      onChange(value, selectedOptions);
    }
  };

  getLabel() {
    const { options, displayRender = defaultDisplayRender as Function, fieldNames } = this.props;
    const names = getFilledFieldNames(fieldNames);
    const { value } = this.state;
    const unwrappedValue = Array.isArray(value[0]) ? value[0] : value;
    const selectedOptions: CascaderOptionType[] = arrayTreeFilter(
      options,
      (o: CascaderOptionType, level: number) => o[names.value] === unwrappedValue[level],
      { childrenKeyName: names.children },
    );
    const label = selectedOptions.map(o => o[names.label]);
    return displayRender(label, selectedOptions);
  }

  flattenTree(
    options: CascaderOptionType[],
    changeOnSelect: boolean | undefined,
    fieldNames: FieldNamesType | undefined,
    ancestor: CascaderOptionType[] = [],
  ) {
    const names: FilledFieldNamesType = getFilledFieldNames(fieldNames);
    let flattenOptions = [] as CascaderOptionType[][];
    const childrenName = names.children;
    options.forEach(option => {
      const path = ancestor.concat(option);
      if (changeOnSelect || !option[childrenName] || !option[childrenName].length) {
        flattenOptions.push(path);
      }
      if (option[childrenName]) {
        flattenOptions = flattenOptions.concat(
          this.flattenTree(
            option[childrenName],
            changeOnSelect,
            fieldNames,
            path,
          ),
        );
      }
    });
    return flattenOptions;
  }

  generateFilteredOptions(prefixCls: string | undefined) {
    const { showSearch, notFoundContent, fieldNames } = this.props;
    const names: FilledFieldNamesType = getFilledFieldNames(fieldNames);
    const {
      filter = defaultFilterOption,
      render = defaultRenderFilteredOption,
      sort = defaultSortFilteredOption,
    } = showSearch as ShowSearchType;
    const { flattenOptions = [], inputValue } = this.state;
    const filtered = flattenOptions
      .filter(path => filter(inputValue, path, names))
      .sort((a, b) => sort(a, b, inputValue, names));

    if (filtered.length > 0) {
      return filtered.map((path: CascaderOptionType[]) => {
        return {
          __IS_FILTERED_OPTION: true,
          path,
          [names.label]: render(inputValue, path, prefixCls, names),
          [names.value]: path.map((o: CascaderOptionType) => o[names.value]),
          disabled: path.some((o: CascaderOptionType) => !!o.disabled),
        } as CascaderOptionType;
      });
    }
    return [{ [names.label]: notFoundContent, [names.value]: 'ANT_CASCADER_NOT_FOUND', disabled: true }];
  }

  focus() {
    this.input.focus();
  }

  blur() {
    this.input.blur();
  }

  saveInput = (node: Input) => {
    this.input = node;
  };

  render() {
    const { props, state } = this;
    const {
      prefixCls: customizePrefixCls,
      inputPrefixCls: customizeInputPrefixCls,
      children,
      placeholder,
      size,
      disabled,
      className,
      style,
      showSearch = false,
      allowClear,
      ...otherProps
    } = props;
    const { getPrefixCls } = this.context;
    const prefixCls = getPrefixCls('cascader', customizePrefixCls);
    const inputPrefixCls = getPrefixCls('input', customizeInputPrefixCls);
    const defaultValue = props.defaultValue;
    const { value, inputFocused } = state;

    const arrowCls = classNames({
      [`${prefixCls}-picker-arrow`]: true,
      [`${prefixCls}-picker-arrow-expand`]: state.popupVisible,
    });
    const pickerCls = classNames(className, `${prefixCls}-picker`, {
      [`${prefixCls}-picker-with-value`]: state.inputValue,
      [`${prefixCls}-picker-disabled`]: disabled,
      [`${prefixCls}-picker-${size}`]: !!size,
      [`${prefixCls}-picker-show-search`]: !!showSearch,
      [`${prefixCls}-picker-focused`]: inputFocused,
      [`${inputPrefixCls}-has-value`]: !!defaultValue || value.length,
      [`${inputPrefixCls}-focused`]: state.popupVisible,
    });

    // Fix bug of https://github.com/facebook/react/pull/5004
    // and https://fb.me/react-unknown-prop
    const inputProps = omit(otherProps, [
      'onChange',
      'options',
      'popupPlacement',
      'transitionName',
      'displayRender',
      'onPopupVisibleChange',
      'changeOnSelect',
      'expandTrigger',
      'popupVisible',
      'getPopupContainer',
      'loadData',
      'popupClassName',
      'filterOption',
      'renderFilteredOption',
      'sortFilteredOption',
      'notFoundContent',
      'fieldNames',
      'allowClear',
      'singleMenuStyle',
      'singleMenuItemStyle',
      'singlePleaseRender',
      'singleMenuItemRender',
      'menuMode',
      'defaultValue',
    ]);

    let options = props.options;
    if (state.inputValue) {
      options = this.generateFilteredOptions(prefixCls);
    }
    // Dropdown menu should keep previous status until it is fully closed.
    if (!state.popupVisible) {
      options = this.cachedOptions;
    } else {
      this.cachedOptions = options;
    }

    const dropdownMenuColumnStyle: { width?: number; height?: string } = {};
    const isNotFound =
      (options || []).length === 1 && options[0].value === 'ANT_CASCADER_NOT_FOUND';
    if (isNotFound) {
      dropdownMenuColumnStyle.height = 'auto'; // Height of one row.
    }
    // The default value of `matchInputWidth` is `true`
    const resultListMatchInputWidth = (showSearch as ShowSearchType).matchInputWidth !== false;
    if (resultListMatchInputWidth && state.inputValue && this.input) {
      dropdownMenuColumnStyle.width = this.input.input.offsetWidth;
    }

    const clearIcon =
      (allowClear && !disabled && value.length > 0) || state.inputValue ? (
        <Icon
          type="close"
          className={`${prefixCls}-picker-clear`}
          onClick={this.clearSelection} />
      ) : null;
    const input = children || (
      <span style={style} className={pickerCls}>
        <span className={`${prefixCls}-picker-label`}>{this.getLabel()}</span>
        <Input
          {...inputProps}
          ref={this.saveInput}
          prefixCls={inputPrefixCls}
          placeholder={value && value.length > 0 ? undefined : placeholder}
          className={`${prefixCls}-input`}
          size={size}
          value={state.inputValue}
          disabled={disabled}
          readOnly={!showSearch}
          autoComplete="off"
          onClick={showSearch ? this.handleInputClick : undefined}
          onBlur={showSearch ? this.handleInputBlur : undefined}
          onKeyDown={this.handleKeyDown}
          onChange={showSearch ? this.handleInputChange : undefined}
        />
        {clearIcon}
        <Icon type="arrow_drop_down" className={arrowCls} />
      </span>
    );

    /**
     * 添加多语言配置
     * @param locale any
     */
    const renderCascader = (locale: CascaderLocale) => {
      // 只配置部分语言其他英语即可
      const cascaderLocal = isEmpty(locale) ? getRuntimeLocale().Cascader : locale;
      return (
        <RcCascader
          {...props}
          inputPrefixCls={inputPrefixCls}
          prefixCls={prefixCls}
          options={options}
          value={value}
          popupVisible={state.popupVisible}
          onPopupVisibleChange={this.handlePopupVisibleChange}
          onChange={this.handleChange}
          dropdownMenuColumnStyle={dropdownMenuColumnStyle}
          locale={cascaderLocal}
        >
          {input}
        </RcCascader>
      );
    };

    return (
      <LocaleReceiver componentName="Cascader" defaultLocale={getRuntimeLocale().Cascader || {}}>
        {renderCascader}
      </LocaleReceiver>
    );
  }
}
