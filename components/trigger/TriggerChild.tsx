import React, { Children, cloneElement, PureComponent, ReactElement, ReactNode, Ref } from 'react';
import * as ReactDOM from 'react-dom';
import acceptsHostRef from '../_util/acceptsHostRef';
import useMergedRef from '../_util/useMergedRef';

export function elementRef(child: ReactElement) {
  // React 16 stores ref on the element; React 19 stores it in props.
  const descriptor = Object.getOwnPropertyDescriptor(child.props, 'ref');
  return descriptor && 'value' in descriptor ? descriptor.value : Object.getOwnPropertyDescriptor(child, 'ref')?.value;
}

type Host = Element | Text;
export type RegisterHost = (read: () => Host | null, mounted: boolean) => void;

// Look up opaque children lazily: they can replace their DOM without updating Trigger.
class LegacyHost extends PureComponent<{ children?: ReactNode; register: RegisterHost; readExplicit?: () => Host | null }> {
  read = () => {
    const { readExplicit } = this.props;
    const explicit = readExplicit?.();
    if (explicit) return explicit;
    const { findDOMNode } = ReactDOM as { findDOMNode?: (instance: LegacyHost) => Host | null };
    return findDOMNode ? findDOMNode(this) : null;
  };

  componentDidMount() {
    const { register } = this.props;
    register(this.read, true);
  }

  componentWillUnmount() {
    const { register } = this.props;
    register(this.read, false);
  }

  render() {
    const { children } = this.props;
    return children;
  }
}

export function HostChild({ child, register }: { child: ReactNode; register: RegisterHost }) {
  const node = React.useRef<Element | null>(null);
  const read = React.useCallback(() => node.current, []);
  const acceptsRef = React.isValidElement<{ ref?: Ref<Element> }>(child) && acceptsHostRef(child.type);
  const legacyForward = acceptsRef && typeof child.type !== 'string' && typeof ReactDOM.findDOMNode === 'function';
  const save = React.useCallback((value: Element | null) => {
    node.current = value && value.nodeType === 1 ? value : null;
    if (!legacyForward) register(read, !!node.current);
  }, [register, read, legacyForward]);
  const original = acceptsRef ? elementRef(child) : null;
  const ref = useMergedRef(save, original);
  if (acceptsRef && typeof original !== 'string') {
    const cloned = cloneElement(child, { ref });
    return legacyForward ? <LegacyHost register={register} readExplicit={read}>{cloned}</LegacyHost> : cloned;
  }
  return <LegacyHost register={register}>{child}</LegacyHost>;
}

export type hook = (eventName: string, child: ReactElement<any>, e) => void;

export interface TriggerChildProps {
  onContextMenu?: hook;
  onClick?: hook;
  onMouseDown?: hook;
  onMouseEnter?: hook;
  onMouseLeave?: hook;
  onFocus?: hook;
  onBlur?: hook;
  isClickScrollbar?: {
    value: boolean | undefined;
  };
  popupHidden?: boolean;
  children?: ReactElement<any>;
  register?: RegisterHost;
}

export default class TriggerChild extends PureComponent<TriggerChildProps> {
  static displayName = 'TriggerChild';

  handleContextMenu;

  handleClick;

  handleMouseDown;

  handleMouseEnter;

  handleMouseLeave;

  handleFocus;

  handleBlur;

  handleKeyDown;

  constructor(props: TriggerChildProps, context?: any) {
    super(props, context);
    const createChains = eventName => e => {
      const { [`on${eventName}`]: handle, children } = this.props as { [key: string]: any };
      const child = Children.only(children);
      if (handle) {
        return handle(eventName, child, e);
      }
      if (child) {
        const { [`on${eventName}`]: childHandle } = child.props;
        if (childHandle) {
          return childHandle(e);
        }
      }
    };

    this.handleContextMenu = createChains('ContextMenu');
    this.handleClick = createChains('Click');
    this.handleMouseDown = createChains('MouseDown');
    this.handleMouseEnter = createChains('MouseEnter');
    this.handleMouseLeave = createChains('MouseLeave');
    this.handleFocus = createChains('Focus');
    this.handleBlur = createChains('Blur');
    this.handleKeyDown = createChains('KeyDown');
  }

  render() {
    const { children, register } = this.props;
    const child = cloneElement(Children.only(children as ReactElement<any>), {
      onContextMenu: this.handleContextMenu,
      onClick: this.handleClick,
      onMouseDown: this.handleMouseDown,
      onMouseEnter: this.handleMouseEnter,
      onMouseLeave: this.handleMouseLeave,
      onFocus: this.handleFocus,
      onBlur: this.handleBlur,
      onKeyDown: this.handleKeyDown,
    });
    return register ? <HostChild child={child} register={register} /> : child;
  }
}
