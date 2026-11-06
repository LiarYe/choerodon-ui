import { isAction } from 'mobx';
import lookupCodeStore, { LookupCodeStore } from '../LookupCodeStore';

it('keeps deprecated clearCache a no-op for both singleton and new stores', () => {
  const store = new LookupCodeStore();
  try {
    [lookupCodeStore, store].forEach(instance => {
      const value = [{ value: 'cached' }];
      instance.merger.cache.set('clear-cache-regression', value);
      try {
        expect(isAction(instance.clearCache)).toBe(false);
        expect(isAction(instance.merger.add)).toBe(true);
        expect(instance.clearCache()).toBeUndefined();
        expect(instance.merger.cache.get('clear-cache-regression')).toBe(value);
      } finally {
        instance.merger.cache.del('clear-cache-regression');
      }
    });
  } finally {
    store.merger.dispose();
  }
});
