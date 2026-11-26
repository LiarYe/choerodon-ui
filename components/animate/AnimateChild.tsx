import React, { cloneElement, CSSProperties, isValidElement, PureComponent } from 'react';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import cssAnimate, { isCssAnimationSupported } from 'css-animation';
import { HostChild, RegisterHost } from '../trigger/TriggerChild';
import animUtil from './util';

const transitionMap = {
  enter: 'transitionEnter',
  appear: 'transitionAppear',
  leave: 'transitionLeave',
};

export interface AnimateChildProps {
  getNode?: () => Element | Text | null;
  transitionName?: string | object;
  animation?: { [key: string]: (node: Element | Text, end: () => void) => void };
  style?: CSSProperties;
}

export default class AnimateChild extends PureComponent<AnimateChildProps, any> {
  static displayName = 'AnimateChild';

  stopper;

  readHost?: () => Element | Text | null;

  registerHost: RegisterHost = (read, mounted) => {
    this.readHost = mounted ? read : undefined;
  };

  style?: CSSProperties;

  componentWillUnmount() {
    this.stop();
  }

  componentWillEnter(done: (child: AnimateChild) => void) {
    if (animUtil.isEnterSupported(this.props)) {
      this.transition('enter', done);
    } else {
      done(this);
    }
  }

  componentWillAppear(done: (child: AnimateChild) => void) {
    if (animUtil.isAppearSupported(this.props)) {
      this.transition('appear', done);
    } else {
      done(this);
    }
  }

  componentWillLeave(done: (child: AnimateChild) => void) {
    if (animUtil.isLeaveSupported(this.props)) {
      this.transition('leave', done);
    } else {
      done(this);
    }
  }

  transition(animationType: string, finishCallback: (child: AnimateChild) => void) {
    const { getNode } = this.props;
    const node = getNode ? getNode() : this.readHost?.();
    if (node) {
      const { props } = this;
      const { transitionName, animation = {} } = props;
      const nameIsObj = typeof transitionName === 'object';
      this.stop();
      const end = () => {
        this.stopper = null;
        finishCallback(this);
      };
      if (
        (isCssAnimationSupported || !animation[animationType]) &&
        transitionName &&
        props[transitionMap[animationType]]
      ) {
        const name = nameIsObj
          ? transitionName[animationType]
          : `${transitionName}-${animationType}`;
        let activeName = `${name}-active`;
        if (nameIsObj && transitionName[`${animationType}Active`]) {
          activeName = transitionName[`${animationType}Active`];
        }
        this.stopper = cssAnimate(
          node,
          {
            name,
            active: activeName,
          },
          end,
        );
      } else {
        this.stopper = animation[animationType](node, end);
      }
    } else {
      finishCallback(this);
    }
  }

  stop() {
    const { stopper } = this;
    if (stopper) {
      this.stopper = null;
      stopper.stop();
    }
  }

  getStyle(style?: CSSProperties) {
    if (isEqual(style, this.style)) {
      return this.style;
    }
    this.style = style;
    return style;
  }

  render() {
    const { children, getNode, ...otherProps } = this.props;
    let child = children;
    if (isValidElement(children)) {
      const props = omit(otherProps, [
        'animation',
        'transitionName',
        'transitionEnter',
        'transitionAppear',
        'transitionLeave',
      ]);
      const { style } = children.props as any;
      child = cloneElement(children, { ...props, style: this.getStyle({ ...props.style, ...style }) } as any);
    }
    return getNode ? child : <HostChild child={child} register={this.registerHost} />;
  }
}
