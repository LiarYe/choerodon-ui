import { isObservableArray } from 'mobx';

export default function isArrayLike(value: any): value is any[] {
  return Array.isArray(value) || isObservableArray(value);
}
