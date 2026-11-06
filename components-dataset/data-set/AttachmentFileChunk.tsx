import { makeObservable, observable } from 'mobx';
import isNil from 'lodash/isNil';
import { CancelTokenSource } from 'axios';
import AttachmentFile from './AttachmentFile';

export default class AttachmentFileChunk {
  file: AttachmentFile;

  total: number;

  start: number;

  end: number;

  index: number;

  @observable percent?: number | undefined = undefined;

  status?: 'error' | 'success' | 'uploading' | 'aborted';

  @observable aborted?: boolean = undefined;
  
  cancelToken?: CancelTokenSource;

  constructor(chunk: AttachmentFileChunk) {
    Object.keys(chunk).forEach(key => {
      const value = chunk[key];
      if (!isNil(value)) {
        this[key] = value;
      }
    });
    makeObservable(this);
  }
}
