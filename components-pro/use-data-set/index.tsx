import { DependencyList, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { observable, runInAction } from 'mobx';
import DataSet from 'choerodon-ui/dataset';
import { getConfig } from 'choerodon-ui/dataset/configure';
import { DataSetProps } from 'choerodon-ui/dataset/data-set/interface';
import useConfig from 'choerodon-ui/lib/use-config';

const useConfigEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function useDataSet(factory: () => DataSetProps | undefined, deps: DependencyList | undefined): DataSet {
  const context = useConfig();
  const getLocalConfig = context.getConfig as typeof getConfig;
  const [, setConfigVersion] = useState(0);
  const { dataSet, config } = useMemo(() => {
    const config = observable.box(getLocalConfig, { deep: false });
    const getCurrentConfig: typeof getConfig = key => config.get()(key);
    return { dataSet: new DataSet(factory(), { getConfig: getCurrentConfig }), config };
  }, deps || []);
  useConfigEffect(() => {
    if (config.get() !== getLocalConfig) {
      runInAction(() => config.set(getLocalConfig));
      setConfigVersion(version => version + 1);
    }
  }, [config, getLocalConfig]);
  return dataSet;
}
