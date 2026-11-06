import { extendObservable, intercept, isObservable, observable, ObservableMap, runInAction } from 'mobx';
import { isElement, isPortal, isValidElementType } from 'react-is';
import isPlainObject from 'lodash/isPlainObject';

export default function observableConfig<T>(value: T, seen = new WeakMap<object, any>()): T {
  if (!value || typeof value !== 'object' || isElement(value) || isPortal(value) ||
    isValidElementType(value) || isObservable(value)) {
    return value;
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  const convert = (item: any) => observableConfig(item, seen);
  return runInAction(() => {
    if (Array.isArray(value)) {
      const result = observable.array<any>([], { deep: false });
      seen.set(value, result);
      result.replace(value.map(convert));
      intercept(result, change => {
        if (change.type === 'splice') {
          const addedSeen = new WeakMap<object, any>();
          change.added = change.added.map(item => observableConfig(item, addedSeen));
        } else {
          change.newValue = observableConfig(change.newValue);
        }
        return change;
      });
      return result as any;
    }
    if (value instanceof Map) {
      const result = observable.map<any, any>(undefined, { deep: false });
      seen.set(value, result);
      value.forEach((item, key) => result.set(key, convert(item)));
      intercept(result, change => {
        if (change.type === 'add' || change.type === 'update') {
          change.newValue = observableConfig(change.newValue);
        }
        return change;
      });
      return result as any;
    }
    if (value instanceof Set) {
      const result = observable.set<any>([], { deep: false });
      seen.set(value, result);
      value.forEach(item => result.add(convert(item)));
      intercept(result, change => {
        if (change.type === 'add') {
          change.newValue = observableConfig(change.newValue);
        }
        return change;
      });
      return result as any;
    }
    if (isPlainObject(value)) {
      const result = observable.object({}, {}, { deep: false });
      seen.set(value, result);
      const properties = {};
      Reflect.ownKeys(value).forEach(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if ('value' in descriptor) {
          descriptor.value = convert(descriptor.value);
        }
        Object.defineProperty(properties, key, descriptor);
      });
      extendObservable(result, properties);
      intercept(result, change => {
        if (change.type === 'add' || change.type === 'update') {
          change.newValue = observableConfig(change.newValue);
        }
        return change;
      });
      return result as T;
    }
    return value;
  });
}

export function observableConfigMap<K extends string, V>(values?: { [key: string]: any }): ObservableMap<K, V> {
  return observableConfig(new Map(Object.keys(values || {}).map(key => [key, values![key]]))) as unknown as ObservableMap<K, V>;
}
