import { makeObservable, observable } from 'mobx';

export default class LookupCache {
  items?: object[] = undefined;

  promise?: Promise<object[]> | undefined = undefined;

  constructor() {
    makeObservable(this, {
      items: observable,
      promise: observable,
    });
  }
}
