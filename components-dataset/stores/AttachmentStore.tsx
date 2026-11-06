import { AttachmentBatchFetchCount, AttachmentValue } from 'choerodon-ui/dataset/configure';
import PromiseMerger from '../promise-merger';
import AttachmentFile from '../data-set/AttachmentFile';
import Field from '../data-set/Field';
import { getGlobalConfig } from './utils';

export type AttachmentCache = { count?: number | undefined, attachments?: AttachmentFile[] | undefined };

type callbackArgs = [AttachmentBatchFetchCount, boolean | undefined];

const loaderKeys = new WeakMap<AttachmentBatchFetchCount, number>();
let nextLoaderKey = 0;

function getScopeKey(options: AttachmentValue, loader: AttachmentBatchFetchCount): string {
  let loaderKey = loaderKeys.get(loader);
  if (loaderKey === undefined) {
    loaderKey = nextLoaderKey++;
    loaderKeys.set(loader, loaderKey);
  }
  const { isPublic, bucketName, bucketDirectory, storageCode } = options;
  return JSON.stringify([loaderKey, isPublic === undefined ? null : isPublic, bucketName, bucketDirectory, storageCode]);
}

function getCacheKey(options: AttachmentValue, loader: AttachmentBatchFetchCount): string {
  return JSON.stringify([getScopeKey(options, loader), options.attachmentUUID]);
}

export class AttachmentStore {

  batchCallback = (uuids: string[], args: callbackArgs, items: AttachmentValue[]): Promise<{ [key: string]: number | undefined }> => {
    return args[0](uuids, { isPublic: args[1], items });
  };

  merger: PromiseMerger<number | undefined, callbackArgs, AttachmentValue> = new PromiseMerger<number | undefined, callbackArgs, AttachmentValue>(
    this.batchCallback,
    { maxAge: 60000, max: 100 },
  );

  fetchCountInBatch(options: AttachmentValue, field?: Field | undefined, loader?: AttachmentBatchFetchCount): Promise<number | undefined> {
    const batchFetchCount = loader || getGlobalConfig('attachment', field).batchFetchCount;
    if (batchFetchCount) {
      const { isPublic, attachmentUUID } = options;
      return this.merger.add(attachmentUUID, () => getScopeKey(options, batchFetchCount),
        [batchFetchCount, isPublic], options, undefined, getCacheKey(options, batchFetchCount));
    }
    return Promise.resolve(undefined);
  }

  updateCacheCount(code: string | AttachmentValue, count?: number, field?: Field, loader?: AttachmentBatchFetchCount): void {
    const batchFetchCount = loader || getGlobalConfig('attachment', field).batchFetchCount;
    if (!batchFetchCount) return;
    const options = typeof code === 'string' ? { attachmentUUID: code } : code;
    const key = getCacheKey(options, batchFetchCount);
    const { merger: { cache } } = this;
    const cacheCount = cache.get(key);
    if (cacheCount !== count) {
      cache.set(key, count);
    }
  }

  /**
   * @deprecated
   */
  get(_uuid: string): undefined {
    return undefined;
  }


  /**
   * @deprecated
   */
  set(_uuid: string, _cache: AttachmentCache) {
  }


  /**
   * @deprecated
   */
  getCount(_uuid: string): number | undefined {
    return undefined;
  }


  /**
   * @deprecated
   */
  getAttachments(_uuid: string): AttachmentFile[] | undefined {
    return undefined;
  }


  /**
   * @deprecated
   */
  clearCache(_codes?: string[]) {

  }
}

export default new AttachmentStore();
