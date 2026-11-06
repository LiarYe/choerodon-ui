import Cascader from '..';
import selectedDataCases from '../../select/test-utils/selected-data-cases';

describe('Cascader asynchronous cascade processing', () => {
  selectedDataCases(Cascader, it, true);
});
