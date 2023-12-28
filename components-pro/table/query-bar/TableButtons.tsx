import React, { memo, ReactElement, ReactNode, useContext } from 'react';
import classNames from 'classnames';
import ConfigContext, { ConfigContextValue } from 'choerodon-ui/lib/config-provider/ConfigContext';
import { ButtonProps } from '../../button/Button';

export interface TableButtonProps {
  prefixCls?: string;
  buttons: ReactElement<ButtonProps>[];
  children?: ReactNode;
}

export default memo(function TableButtons({ prefixCls, buttons, children }: TableButtonProps) {
  const { getConfig } = useContext<ConfigContextValue>(ConfigContext);
  const isRTL = getConfig('direction') === 'rtl';

  const buttonGroup = buttons.length ? (
    <span className={`${prefixCls}-toolbar-button-group`}>{buttons}</span>
  ) : null;
  const cls = classNames(`${prefixCls}-toolbar`, {
    [`${prefixCls}-toolbar-rtl`]: isRTL,
  });
  if (buttonGroup || children) {
    return (
      <div className={cls}>
        {buttonGroup}
        {children}
      </div>
    );
  }

  return null;
});
