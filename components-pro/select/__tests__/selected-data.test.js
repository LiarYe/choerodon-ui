import Select from '..';
import selectedDataCases from '../test-utils/selected-data-cases';

describe('Select asynchronous cascade processing', () => {
  selectedDataCases(Select, it);
});
