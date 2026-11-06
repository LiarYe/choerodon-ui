import { makeObservable, action, computed, observable } from 'mobx';

export default class Validity {
  badInput: boolean;

  customError: boolean;

  patternMismatch: boolean;

  rangeOverflow: boolean;

  rangeUnderflow: boolean;

  rangeOverflowExcl: boolean;

  rangeUnderflowExcl: boolean;

  stepMismatch: boolean;

  tooLong: boolean;

  tooShort: boolean;

  typeMismatch: boolean;

  valueMissing: boolean;

  uniqueError: boolean;

  get valid(): boolean {
    return Object.keys(this)
      .filter(key => key !== 'valid')
      .every(key => !this[key]);
  }

  constructor(props?: object) {
    Object.assign(this, {
      badInput: undefined,
      customError: undefined,
      patternMismatch: undefined,
      rangeOverflow: undefined,
      rangeUnderflow: undefined,
      rangeOverflowExcl: undefined,
      rangeUnderflowExcl: undefined,
      stepMismatch: undefined,
      tooLong: undefined,
      tooShort: undefined,
      typeMismatch: undefined,
      valueMissing: undefined,
      uniqueError: undefined,
    });
    makeObservable(this, {
      badInput: observable,
      customError: observable,
      patternMismatch: observable,
      rangeOverflow: observable,
      rangeUnderflow: observable,
      rangeOverflowExcl: observable,
      rangeUnderflowExcl: observable,
      stepMismatch: observable,
      tooLong: observable,
      tooShort: observable,
      typeMismatch: observable,
      valueMissing: observable,
      uniqueError: observable,
      valid: computed,
      init: action,
    });
    this.init(props);
  }

  reset() {
    this.init();
  }

  init(props?: object) {
    this.badInput = false;
    this.customError = false;
    this.patternMismatch = false;
    this.rangeOverflow = false;
    this.rangeUnderflow = false;
    this.rangeOverflowExcl = false;
    this.rangeUnderflowExcl = false;
    this.stepMismatch = false;
    this.tooLong = false;
    this.tooShort = false;
    this.typeMismatch = false;
    this.valueMissing = false;
    this.uniqueError = false;
    if (props) {
      Object.assign(this, props);
    }
  }
}
