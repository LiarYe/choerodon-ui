import React, { Children, CSSProperties, FunctionComponent, isValidElement, ReactNode, useContext } from 'react';
import classNames from 'classnames';
import isNil from 'lodash/isNil';
import isFunction from 'lodash/isFunction';
import omit from 'lodash/omit';
import ConfigContext from 'choerodon-ui/lib/config-provider/ConfigContext';
import isFragment from '../_util/isFragment';
import { ShowHelp } from '../field/enum';

export interface ItemGroupProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  label?: string | ReactNode;
  help?: string;
  showHelp?: ShowHelp.label;
  required?: boolean;
  useColon?: boolean;
  compact?: boolean;
}

const ItemGroup: FunctionComponent<ItemGroupProps> = props => {
  const {
    className,
    children,
    compact,
    ...otherProps
  } = props;
  const { getProPrefixCls } = useContext(ConfigContext);
  const prefixCls = getProPrefixCls('form-item-group');
  const cls = classNames(className, prefixCls, {
    [`${prefixCls}-compact`]: compact,
  });

  const mapChildren = (child: ReactNode): ReactNode => {
    if (!isValidElement(child)) {
      return undefined;
    }
    if (isFragment(child) && child.props) {
      return Children.map<ReactNode, ReactNode>(child.props.children, innerChild => mapChildren(innerChild));
    }

    let itemStyle: CSSProperties = {};
    if (child.props && child.props.style && (child.props.style.originalWidth || child.props.style.width)) {
      if (child.props.style.width !== '100%') {
        itemStyle = {
          width: child.props.style.width,
        };
        child.props.style.originalWidth = child.props.style.width;
      }
      itemStyle = {
        width: child.props.style.originalWidth || child.props.style.width,
      };
      child.props.style.width = '100%';
    }

    if ((isFunction(child.type) || typeof child.type === 'object') && (child.type as any).displayName === 'FormItem') {
      return mapChildren(child.props.children);
    }

    let childCls = '';
    if (compact) {
      const { suffixCls } = child.props;
      const prefixCls = getProPrefixCls(suffixCls);
      childCls = `${prefixCls}-compact`;
    }

    return (
      <span className={`${prefixCls}-item ${childCls}`} style={{ ...itemStyle }}>
        {child}
      </span>
    );
  };

  const childes = Children.map<ReactNode, ReactNode>(children, child => mapChildren(child));
  if (isNil(childes)) {
    return null;
  }

  const passProps = omit(otherProps, [
    'label',
    'help',
    'showHelp',
    'required',
    'useColon',
  ]);

  return (
    <span
      className={cls}
      {...passProps}
    >
      {childes}
    </span>
  );
};

ItemGroup.displayName = 'ItemGroup';

ItemGroup.defaultProps = {
  showHelp: ShowHelp.label,
};

export default ItemGroup;
