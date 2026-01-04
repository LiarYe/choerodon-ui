import { action, computed, observable, ObservableMap } from 'mobx';
import Record, { EXPANDED_KEY } from './Record';
import { getIf } from './utils';

export default class Group {

  readonly name: string | symbol;

  parentName?: string | symbol;

  readonly value: any;

  parentValue?: any;

  records: Record[];

  readonly totalRecords: Record[];

  // 子分组， 非同组
  subGroups: Group[];

  subHGroups?: Set<Group>;

  // 父分组， 非同组
  readonly parentGroup?: Group | undefined;

  readonly index: number;

  @observable state?: ObservableMap<string, any>;

  // 同组下的树形子分组
  children?: Group[] | undefined;

  // 同组下的父分组
  parent?: Group | undefined;

  get isExpanded(): boolean {
    return this.getState(EXPANDED_KEY) !== false;
  }

  set isExpanded(isExpanded: boolean) {
    this.setState(EXPANDED_KEY, isExpanded);
  }

  get isAllExpanded(): boolean {
    return this.isExpanded && (!this.parentGroup || this.parentGroup.isAllExpanded);
  }

  get level(): number {
    const { parent } = this;
    if (parent) {
      return parent.level + 1;
    }
    return 0;
  }

  // @computed
  // get expandedRecords(): Record[] {
  //   const { subGroups } = this;
  //   if (subGroups.length) {
  //     return subGroups.reduce<Record[]>((list, group) => {
  //       const newList = list.concat(group.expandedRecords);
  //       const { children } = group;
  //       if (children && group.isExpanded) {
  //         return children.reduce((childList, childGroup) => childList.concat(childGroup.expandedRecords), newList);
  //       }
  //       return newList;
  //     }, []);
  //   }
  //   return this.records;
  // }

  // @computed
  // get expandedRecords(): Record[] {
  //   const { subGroups } = this;
  //   if (subGroups.length) {
  //     const records = subGroups.reduce<Record[]>((list, group) => {
  //       const newList = list.concat(group.expandedRecords);
  //       return newList;
  //     }, []);
  //     return this.isAllExpanded ? records : records.slice(0, 1);
  //   }
  //   return this.isAllExpanded ? this.records : this.records.slice(0, 1);
  // }

  @computed
  get expandedRecords(): Record[] {
    const { subGroups } = this;
    if (subGroups.length) {
      let records = subGroups.reduce<Record[]>((list, group) => {
        const newList = list.concat(group.expandedRecords);
        return newList;
      }, []);
      records = this.calcRecord ? records.concat(this.calcRecord) : records;
      return this.isAllExpanded ? records : [records[records.length - 1]];
    }
    const records = this.calcRecord ? this.records.concat(this.calcRecord) : this.records;
    return this.isAllExpanded ? records : [records[records.length - 1]];
  }

  constructor(name: string | symbol, index: number, value?: any, parentGroup?: Group) {
    this.index = index;
    this.name = name;
    this.value = value;
    this.parentGroup = parentGroup;
    this.records = [];
    this.totalRecords = [];
    this.subGroups = [];
  }

  getState(key: string): any {
    const { state } = this;
    return state && state.get(key);
  }

  @action
  setState(key: string, value: any) {
    if (value !== undefined || this.state) {
      const state = getIf<Group, ObservableMap>(this, 'state', () => observable.map());
      return state.set(key, value);
    }
  }

  mergeState(newState: ObservableMap<string, any>) {
    const state = getIf<Group, ObservableMap>(this, 'state', () => observable.map());
    state.merge(newState);
  }
}
