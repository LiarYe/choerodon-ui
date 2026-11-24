import React from 'react';

const Divider = function Divider(props) {
  const { className = '', rootPrefixCls, virtualRowRef } = props;
  return <li ref={virtualRowRef} className={`${className} ${rootPrefixCls}-item-divider`} />;
};

Divider.displayName = 'Divider';

Divider.defaultProps = {
  disabled: true
};

export default Divider;
