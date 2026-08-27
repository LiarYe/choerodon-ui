export enum InputSuffixCompName  {
  TextField = 'TextField',
  SecretField = 'SecretField',
  UrlField = 'UrlField',
  Password = 'Password',
  TextArea = 'TextArea',
  IntlField = 'IntlField',
  EmailField = 'EmailField',
  NumberField = 'NumberField',
  Currency = 'Currency',
  DatePicker = 'DatePicker',
  Cascader = 'Cascader',
  Select = 'Select',
  AutoComplete = 'AutoComplete',
  Lov = 'Lov',
  TreeSelect = 'TreeSelect',
  ColorPicker = 'ColorPicker',
  IconPicker = 'IconPicker',
}

export interface DuplicateKeyConfig {
  /**
   * 是否禁用重复项
   */
  disable?: boolean;
  /**
   * 是否显示重复项提示
   */
  showWarning?: boolean;
}

export type DuplicateKeyConfigHook = (componentName: string) => (DuplicateKeyConfig | undefined);
