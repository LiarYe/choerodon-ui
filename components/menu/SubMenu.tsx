import React, { MouseEventHandler, PureComponent } from 'react';
import classNames from 'classnames';
import { SubMenu as RcSubMenu } from '../rc-components/menu';
import MenuContext, { MenuContextValue } from './MenuContext';

class SubMenu extends PureComponent<any, any> {
  static get contextType(): typeof MenuContext {
    return MenuContext;
  }

  static isSubMenu = 1;

  context: MenuContextValue;

  private subMenu: any;

  get isRTL(): boolean {
    const { getConfig } = this.context;
    return getConfig('direction') === 'rtl';
  }

  onKeyDown: MouseEventHandler<HTMLElement> = e => {
    this.subMenu.onKeyDown(e);
  };

  saveSubMenu = (subMenu: any) => {
    this.subMenu = subMenu;
  };

  render() {
    const { rootPrefixCls, className } = this.props;
    const { menuTheme } = this.context;
    const popupCls = classNames(`${rootPrefixCls}-${menuTheme}`, className, {
      [`${rootPrefixCls}-popup-rtl`]: this.isRTL,
    });
    return (
      <RcSubMenu
        {...this.props}
        ref={this.saveSubMenu}
        popupClassName={popupCls}
        isRTL={this.isRTL}
      />
    );
  }
}

export default SubMenu;
