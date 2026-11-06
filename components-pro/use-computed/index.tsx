import { DependencyList, useMemo } from 'react';
import { computed } from 'mobx';

const useComputed = <T,>(func: () => T, inputs: DependencyList = []): T => {
  return useMemo(() => computed(func), inputs).get();
};

export default useComputed;
