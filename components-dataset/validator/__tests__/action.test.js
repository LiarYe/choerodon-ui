import { autorun, isAction, observable, runInAction } from 'mobx';
import Validator from '../Validator';

it('activates the static action without constructing Validator and keeps reads untracked', async () => {
  expect(isAction(Validator.checkValidity)).toBe(true);
  const state = observable({ required: true });
  const reports = [];
  const dispose = autorun(() => {
    reports.push(Validator.checkValidity(null, {}, key => state[key]));
  });
  try {
    runInAction(() => { state.required = false; });
    expect(reports).toHaveLength(1);
    await expect(reports[0]).resolves.toMatchObject({
      valid: false,
      validationResults: [{ ruleName: 'valueMissingNoLabel' }],
    });
    await expect(Validator.checkValidity()).resolves.toMatchObject({ valid: true, validationResults: [] });
  } finally {
    dispose();
  }
});

it('preserves asynchronous custom validation and report props', async () => {
  const props = { name: 'code' };
  const customValidator = jest.fn().mockResolvedValue('invalid code');
  const result = await Validator.checkValidity('bad', props, key => ({ customValidator })[key]);
  expect(customValidator).toHaveBeenCalledWith('bad', 'code', undefined);
  expect(result.validatorProps).toBe(props);
  expect(result).toMatchObject({
    valid: false,
    validationResults: [{ ruleName: 'customError', value: 'bad', validationMessage: 'invalid code' }],
  });
});
