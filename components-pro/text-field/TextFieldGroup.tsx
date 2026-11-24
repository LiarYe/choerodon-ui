import React, { FocusEventHandler, ReactNode, useEffect, useRef } from 'react';
import classNames from 'classnames';
import useMergedRef from 'choerodon-ui/lib/_util/useMergedRef';

export interface TextFieldGroupProps {
  prefixCls?: string;
  onBlur?: FocusEventHandler<any>;
  children?: ReactNode;
  className?: string;
}

const TextFieldGroup = React.forwardRef<HTMLDivElement, TextFieldGroupProps>(({ prefixCls, onBlur, children, className, ...otherProps }, forwardedRef) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRef(ref, forwardedRef);
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
    <div ref={mergedRef} {...otherProps} className={classNames(selfPrefixCls, className)}>
      {children}
    </div>
  );
});

TextFieldGroup.displayName = 'TextFieldGroup';

export default TextFieldGroup;
