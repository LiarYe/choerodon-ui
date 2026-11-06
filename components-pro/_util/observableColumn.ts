import { isValidElement } from 'react';
import { intercept, isObservableArray, isObservableObject, observable } from 'mobx';
import isPlainObject from 'lodash/isPlainObject';
import observableConfig from 'choerodon-ui/dataset/mobx-helper/observableConfig';

const reactValueKeys = [
  'header', 'footer', 'title', 'editor', 'renderer', 'render', 'tagRenderer',
  'highlightRenderer', 'filterPopover', 'command', 'onCell', 'onResize',
];

function observableChildren(children: any[]) {
  const convert = child => isPlainObject(child) && !isValidElement(child) ? observableColumn(child) : child;
  const columns = observable.array(children.map(convert), { deep: false });
  intercept(columns, change => {
    if (change.type === 'splice') {
      change.added = change.added.map(convert);
    } else {
      change.newValue = convert(change.newValue);
    }
    return change;
  });
  return columns;
}

function observableValue(key: PropertyKey, value: any) {
  if (key === 'children' && (Array.isArray(value) || isObservableArray(value))) {
    return observableChildren(value);
  }
  if (reactValueKeys.includes(String(key)) || typeof value === 'function' || isValidElement(value)) {
    return value;
  }
  return Array.isArray(value) || isPlainObject(value) || value instanceof Map || value instanceof Set
    ? observableConfig(value)
    : value;
}

export default function observableColumn<T extends object>(column: T): T {
  if (isObservableObject(column)) {
    return column;
  }
  const values: { [key: string]: any } = { ...column };
  Object.keys(values).forEach(key => {
    values[key] = observableValue(key, values[key]);
  });
  const model = observable.object(values, {}, { deep: false });
  intercept(model, change => {
    if (change.type === 'add' || change.type === 'update') {
      change.newValue = observableValue(change.name, change.newValue);
    }
    return change;
  });
  return model as T;
}
