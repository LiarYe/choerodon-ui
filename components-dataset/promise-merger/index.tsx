import { action, IReactionDisposer, makeObservable, toJS } from 'mobx';
import Cache, { refreshCacheOptions } from '../cache';

// key 为 lookupCode
export type BatchParaType = { [key: string]: object };

const KEY = Symbol('KEY');

type Request<K, V> = {
  code: string;
  cacheKey: string | symbol;
  data?: V;
  batchPara?: object;
  flying: boolean;
  resolves: ((value: K) => void)[];
  rejects: ((reason: any) => void)[];
};

export default class PromiseMerger<K, ARGS, V> {
  timeout: number;

  cache: Cache<string | symbol, K>;

  promiseMap = new Map<string | symbol, Map<string | symbol, Request<K, V>>>();

  waitIDs = new Map<string | symbol, ReturnType<typeof setTimeout>>();

  disposed = false;

  callback: (codes: string[], args: ARGS, dataList: V[], batchParaObj: BatchParaType) => Promise<{ [key: string]: K }>;

  reaction: IReactionDisposer;

  constructor(callback: (codes: string[], args: ARGS, dataList: V[], batchParaObj: BatchParaType) => Promise<{ [key: string]: K }>, config, timeout = 200) {
    this.timeout = timeout;
    this.cache = new Cache<string | symbol, K>(toJS(config));
    this.callback = callback;
    this.reaction = refreshCacheOptions(this.cache);
    makeObservable(this, { add: action });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.reaction();
    this.waitIDs.forEach(timer => clearTimeout(timer));
    this.waitIDs.clear();
    const error = new Error('PromiseMerger disposed');
    this.promiseMap.forEach(list => {
      list.forEach(request => {
        request.rejects.forEach(reject => reject(error));
        request.resolves = [];
        request.rejects = [];
        request.data = undefined;
        request.batchPara = undefined;
      });
      list.clear();
    });
    this.promiseMap.clear();
  }

  add(code: string, getBatchKey: ((defaultKey: symbol) => string | symbol) | undefined, args: ARGS, data?: V, batchPara?: object, cacheKey: string | symbol = code): Promise<K> {
    if (this.disposed) return Promise.reject(new Error('PromiseMerger disposed'));
    const { cache, promiseMap, waitIDs } = this;
    const item = cache.get(cacheKey);
    if (item !== undefined) {
      return Promise.resolve(item);
    }
    const batchKey = getBatchKey ? getBatchKey(KEY) : KEY;
    return new Promise<K>((resolve, reject) => {
      const promiseList = promiseMap.get(batchKey) || new Map();
      promiseMap.set(batchKey, promiseList);
      let promise = promiseList.get(cacheKey);
      if (promise) {
        promise.resolves.push(resolve);
        promise.rejects.push(reject);
        if (!promise.flying) {
          if (data !== undefined) promise.data = data;
          if (batchPara !== undefined) promise.batchPara = batchPara;
        }
      } else {
        const timer = waitIDs.get(batchKey);
        if (timer !== undefined) clearTimeout(timer);
        promise = {
          code,
          cacheKey,
          data,
          batchPara,
          flying: false,
          resolves: [resolve],
          rejects: [reject],
        };
        promiseList.set(cacheKey, promise);
        waitIDs.set(batchKey, setTimeout(() => {
          waitIDs.delete(batchKey);
          const requests = Array.from(promiseList.values()).filter(request => !request.flying);
          const codes = requests.map(request => request.code);
          const dataList: V[] = [];
          const batchParaObj: BatchParaType = {};
          requests.forEach(request => {
            request.flying = true;
            if (request.data !== undefined) dataList.push(request.data);
            if (request.batchPara != null) batchParaObj[request.code] = request.batchPara;
            request.data = undefined;
            request.batchPara = undefined;
          });
          const release = () => {
            requests.forEach(request => {
              if (promiseList.get(request.cacheKey) === request) promiseList.delete(request.cacheKey);
              request.resolves = [];
              request.rejects = [];
            });
            if (promiseList.size === 0 && promiseMap.get(batchKey) === promiseList) promiseMap.delete(batchKey);
          };
          Promise.resolve().then(() => {
            if (this.disposed) return undefined;
            return this.callback(codes, args, dataList, batchParaObj);
          }).then(res => {
            if (!this.disposed) {
              requests.forEach(request => {
                const value = res && res[request.code];
                if (res) cache.set(request.cacheKey, value!);
                request.resolves.forEach(r => r(value!));
              });
            }
            release();
          }).catch(error => {
            requests.forEach(request => request.rejects.forEach(r => r(error)));
            release();
          });
        }, this.timeout));
      }
    });
  }
}
