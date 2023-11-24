import React, { FocusEventHandler, FunctionComponent, ReactNode, useEffect, useRef, useContext } from 'react';
import classNames from 'classnames';
import ConfigContext from 'choerodon-ui/lib/config-provider/ConfigContext';

export interface TextFieldGroupProps {
  prefixCls?: string;
  onBlur?: FocusEventHandler<any>;
  children?: ReactNode;
  className?: string;
}

const TextFieldGroup: FunctionComponent<TextFieldGroupProps> = ({ prefixCls, onBlur, children, className, ...otherProps }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const { getConfig } = useContext(ConfigContext);
  const isRTL =  getConfig('direction') === 'rtl';
  const selfPrefixCls = `${prefixCls}-group-wrapper`;
  useEffect(() => {
    const { current } = ref;
    if (current && onBlur) {
      const handleMousedown = (e) => {
        const { target } = e;
        if (!e.defaultPrevented && !current.contains(target)) {
          onBlur(e);
        }
      };

      document.addEventListener('mousedown', handleMousedown, false);
      return () => {
        document.removeEventListener('mousedown', handleMousedown, false);
      };
    }
  }, [onBlur, ref]);
  return (
    <div ref={ref} {...otherProps} className={classNames(selfPrefixCls, className, { [`${selfPrefixCls}-rtl`]: isRTL })}>
      {children}
    </div>
  );
};

TextFieldGroup.displayName = 'TextFieldGroup';

export default TextFieldGroup;
