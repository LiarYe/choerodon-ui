import React, { CSSProperties, MouseEventHandler, ReactElement, ReactNode, useContext } from 'react';
import classNames from 'classnames';
import RcSteps, { Step, StepGroup } from '../rc-components/steps';
import { Size } from '../_util/enum';
import ConfigContext from '../config-provider/ConfigContext';

export interface StepsProps {
  prefixCls?: string;
  iconPrefix?: string;
  current?: number;
  status?: 'wait' | 'process' | 'finish' | 'error';
  size?: Size;
  direction?: 'horizontal' | 'vertical';
  progressDot?: boolean | Function;
  style?: CSSProperties;
  headerRender?: () => ReactElement<any>;
  headerIcon?: string;
  headerText?: string;
  type?: string;
  onChange?: Function
}

export interface StepProps {
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
  status?: 'wait' | 'process' | 'finish' | 'error';
  disabled?: boolean;
  title?: ReactNode;
  subTitle?: ReactNode;
  style?: CSSProperties;
}

export type StepsComponent = typeof Steps & {
  Step: typeof Step;
  StepGroup: typeof StepGroup;
}

const Steps = function Steps(props) {
  const { prefixCls: customizePrefixCls, className } = props;
  const { getPrefixCls, getConfig } = useContext(ConfigContext);
  const prefixCls = getPrefixCls('steps', customizePrefixCls);
  const isRTL = getConfig('direction') === 'rtl';
  const cls = classNames(className, {
    [`${prefixCls}-wrapper-rtl`]: isRTL,
  });
  return <RcSteps {...props} prefixCls={prefixCls} className={cls} />;
};

Steps.displayName = 'Steps';

(Steps as StepsComponent).Step = Step;

(Steps as StepsComponent).StepGroup = StepGroup;

Steps.defaultProps = {
  iconPrefix: 'icon',
  current: 0,
};

export default Steps as StepsComponent;
