import * as React from 'react';
import classNames from 'classnames';
import toArray from 'rc-util/lib/Children/toArray';
import Popover from '../popover';
import { cloneElement } from '../_util/reactNode';
import ConfigContext, { ConfigContextValue } from '../config-provider/ConfigContext';
import { Size } from '../_util/enum';
import { AvatarContextProvider } from './AvatarContext';

export interface GroupProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  prefixCls?: string;
  maxCount?: number;
  maxStyle?: React.CSSProperties;
  maxPopoverPlacement?: 'top' | 'bottom';
  maxPopoverTrigger?: 'hover' | 'focus' | 'click';
  size?: Size | number;
}

export default class Group extends React.Component<GroupProps> {
  static displayName = 'AvatarGroup';

  static get contextType(): typeof ConfigContext {
    return ConfigContext;
  }

  static defaultProps = {
    size: Size.default,
    maxPopoverPlacement: 'top',
    maxPopoverTrigger: 'hover',
    className: '',
  };

  context: ConfigContextValue;

  get isRTL(): boolean {
    const { getConfig } = this.context;
    return getConfig('direction') === 'rtl';
  }

  render() {
    const { prefixCls: customizePrefixCls, className, maxCount, maxStyle, size, style, children, maxPopoverPlacement, maxPopoverTrigger } = this.props;
    const { getPrefixCls, getConfig } = this.context;
    const prefixCls = getPrefixCls('avatar-group', customizePrefixCls);
    const cls = classNames(
      prefixCls,
      className,
      {
        [`${prefixCls}-wrapper-rtl`]: this.isRTL,
      },
    );

    const childrenWithProps = toArray(children).map((child, index) =>
      cloneElement(child, {
        key: `avatar-key-${index}`,
      }),
    );

    const numOfChildren = childrenWithProps.length;
    if (maxCount && maxCount < numOfChildren) {
      const childrenShow = childrenWithProps.slice(0, maxCount);
      const childrenHidden = childrenWithProps.slice(maxCount, numOfChildren);
      const numberCls = `${prefixCls}-popover-number`;
      const popverNumberCls = classNames(numberCls, {
        [`${numberCls}-lg`]: size === Size.large,
        [`${numberCls}-sm`]: size === Size.small,
      });
      const additionNumber = Math.min(numOfChildren - maxCount, 99);
      childrenShow.push(
        <Popover
          key="avatar-popover-key"
          content={childrenHidden}
          trigger={maxPopoverTrigger}
          placement={maxPopoverPlacement}
          overlayClassName={`${prefixCls}-popover`}
        >
          <span className={`${prefixCls}-popover-mask`}>
            {childrenHidden[0]}
            <span style={maxStyle} data-contentlength={`+${additionNumber}`.length} className={popverNumberCls}>+{additionNumber}</span>
          </span>
        </Popover>,
      );
      return (
        <AvatarContextProvider size={size} getPrefixCls={getPrefixCls} getConfig={getConfig}>
          <div className={cls} style={style}>
            {childrenShow}
          </div>
        </AvatarContextProvider >
      );
    }

    return (
      <AvatarContextProvider size={size} getPrefixCls={getPrefixCls} getConfig={getConfig}>
        <div className={cls} style={style}>
          {childrenWithProps}
        </div>
      </AvatarContextProvider>
    )
  }
}
