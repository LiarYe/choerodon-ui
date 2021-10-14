/* eslint react/no-did-mount-set-state: 0 */
import React, { Children, cloneElement, Component } from 'react';
import PropTypes from 'prop-types';
import { findDOMNode } from 'react-dom';
import classNames from 'classnames';
import debounce from 'lodash/debounce';
import Dropdown from 'choerodon-ui/pro/lib/dropdown';
import { isFlexSupported, getStyle } from './utils';
import StepGroup from './StepGroup';
import Step from './Step';
import RenderIcon from './RenderIcon'
import Icon from '../../icon';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import Menu from '../../menu';
import MenuItem from '../../menu/MenuItem';



export default class Steps extends Component {
  static propTypes = {
    prefixCls: PropTypes.string,
    className: PropTypes.string,
    iconPrefix: PropTypes.string,
    direction: PropTypes.string,
    labelPlacement: PropTypes.string,
    children: PropTypes.any,
    status: PropTypes.string,
    size: PropTypes.string,
    progressDot: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
    style: PropTypes.object,
    current: PropTypes.number,
    getNumberChange: PropTypes.func,
    setNumberChange: PropTypes.func,
    headerRender: PropTypes.func,
    headerIcon: PropTypes.string,
    headerText: PropTypes.string,
  };

  static defaultProps = {
    prefixCls: 'rc-steps',
    iconPrefix: 'rc',
    direction: 'horizontal',
    labelPlacement: 'horizontal',
    current: 0,
    status: 'process',
    size: '',
    progressDot: false,
  };

  constructor(props) {
    super(props);
    this.state = {
      flexSupported: true,
      lastStepOffsetWidth: 0,
      isShowMore: false,
      lastDisplayIndex: 0,
    };
    this.calcStepOffsetWidth = debounce(this.calcStepOffsetWidth, 150);
    this.stepList = Children.toArray(this.props.children).map(x => React.createRef())
  }

  componentDidMount() {
    this.props.setNumberChange(0)
    this.calcStepOffsetWidth();
    if (!isFlexSupported()) {
      this.setState({
        flexSupported: false,
      });
    }
    this.showMore()
  }

  componentDidUpdate() {
    this.props.setNumberChange(0)
    this.calcStepOffsetWidth();

  }

  componentWillUnmount() {
    this.props.setNumberChange(0)
    if (this.calcTimeout) {
      clearTimeout(this.calcTimeout);
    }
    if (this.calcStepOffsetWidth && this.calcStepOffsetWidth.cancel) {
      this.calcStepOffsetWidth.cancel();
    }
  }

  showMore = () => {
    const containerWidth = this.stepsRef.offsetWidth;
    let displayWidth = 0
    let lastDisplayIndex = 0
    let isShowMore = false
    for (let i = 0; i < this.stepList.length; i++) {
      const currentStep = this.stepList[i].current;
      if (currentStep) {
        const { stepRef } = currentStep
        displayWidth += stepRef.offsetWidth + getStyle(stepRef, 'margin-right')
        if (displayWidth > containerWidth) {
          isShowMore = true
          break;
        }
        lastDisplayIndex = i
      }
    }
    this.setState({
      isShowMore,
      lastDisplayIndex
    }, () => {
      // 渲染完成之后判断最后一个step自适应宽度
      if (!isShowMore) {
        const lastStep = this.stepList[this.stepList.length - 1]
        if (lastStep.current) {
          lastStep.current.stepRef.style.minWidth = 'auto'
        }
      }
    })
  }

  calcStepOffsetWidth = () => {
    if (isFlexSupported()) {
      return;
    }
    // Just for IE9
    const domNode = findDOMNode(this);
    if (domNode.children.length > 0) {
      if (this.calcTimeout) {
        clearTimeout(this.calcTimeout);
      }
      this.calcTimeout = setTimeout(() => {
        // +1 for fit edge bug of digit width, like 35.4px
        const lastStepOffsetWidth = (domNode.lastChild.offsetWidth || 0) + 1;
        // Reduce shake bug
        if (
          this.state.lastStepOffsetWidth === lastStepOffsetWidth ||
          Math.abs(this.state.lastStepOffsetWidth - lastStepOffsetWidth) <= 3
        ) {
          return;
        }
        this.setState({ lastStepOffsetWidth });
      });
    }
  };


  setNumberChange = (index) => {
    this.props.setNumberChange(index)
  }

  getNumberChange = () => {
    this.props.getNumberChange()
  }
  render() {
    const {
      prefixCls,
      style = {},
      className,
      children,
      direction,
      labelPlacement,
      iconPrefix,
      status,
      size,
      current,
      progressDot,
      setNumberChange,
      getNumberChange,
      headerRender,
      headerIcon,
      headerText,
      ...restProps
    } = this.props;
    const { lastStepOffsetWidth, flexSupported, lastDisplayIndex, isShowMore } = this.state;
    const filteredChildren = Children.toArray(children).filter(c => !!c);
    const lastIndex = filteredChildren.length - 1;
    const adjustedlabelPlacement = !!progressDot ? 'vertical' : labelPlacement;
    const classString = classNames(prefixCls, `${prefixCls}-${direction}`, className, {
      [`${prefixCls}-${size}`]: size,
      [`${prefixCls}-label-${adjustedlabelPlacement}`]: direction === 'horizontal',
      [`${prefixCls}-dot`]: !!progressDot,
    });

    const menu = () => {
      this.props.setNumberChange(0)
      return <Menu>
        {
          Children.map(filteredChildren, (child, index) => {
            let gIndex = getNumberChange()
            const childProps = {
              stepNumber: `${gIndex + 1}`,
              prefixCls,
              iconPrefix,
              ...child.props,
            };
            if (!child.props.status) {
              if (gIndex === current) {
                childProps.status = status;
              } else if (gIndex < current) {
                childProps.status = 'finish';
              } else {
                childProps.status = 'wait';
              }
            }
            const classString = classNames(`${prefixCls}-item`, `${prefixCls}-item-${childProps.status}`, className, {
              [`${prefixCls}-item-custom`]: child.props.icon,
            });
            const iconCls = classNames(`${prefixCls}-item-icon`, `${prefixCls}-item-dropdown-icon`)
            setNumberChange(++gIndex)
            return (
              <MenuItem key={child.key}>
                <div className={classString}>
                  <div className={iconCls}>{<RenderIcon {...childProps} />}</div>
                  <div className={`${prefixCls}-item-dropdown-title`}>{childProps.title}</div>
                </div>
              </MenuItem>
            )

          })
        }
      </Menu>
    }

    const renderHeader = (renderFn, headerTitle, IconText) => {
      let headerChildren = [];

      if (isString(IconText)) {
        headerChildren.push(<Icon key="IconText" type={IconText} className={classNames(`${prefixCls}-header-icon`)} />)
      }
      if (isString(headerTitle)) {
        headerChildren.push(<span key="headerTitle" className={classNames(`${prefixCls}-header-title`)}>{headerTitle}</span>)
      }

      if (isFunction(renderFn)) {
        const componentFn = renderFn
        const renderFNHOC = (ComponentFn) => {
          return class renderFN extends Component {
            render() {
              return ComponentFn()
            }
          }
        }

        const HasKeyComponent = renderFNHOC(componentFn)
        headerChildren = [<HasKeyComponent key={"renderFn"} />]
      }

      return headerChildren.length > 0 ? <div className={`${prefixCls}-header`}>{headerChildren}</div> : null;
    }

    return (
      <div className={classString} style={style} {...restProps} ref={ref => { this.stepsRef = ref }}>
        {renderHeader(
          headerRender,
          headerText,
          headerIcon
        )}
        {Children.map(lastDisplayIndex > 0 ? filteredChildren.slice(0, lastDisplayIndex + 1) : filteredChildren, (child, index) => {
          if (child.type === Step) {
            let gIndex = getNumberChange()
            const childProps = {
              stepNumber: `${gIndex + 1}`,
              prefixCls,
              iconPrefix,
              wrapperStyle: style,
              progressDot,
              isLast: index === lastDisplayIndex,
              ref: this.stepList[index],
              ...child.props,
            };
            /**
             * 如果支持flex布局 方向不是垂直 indx不是最后一个
             */
            if (!flexSupported && direction !== 'vertical' && gIndex !== lastIndex) {
              childProps.itemWidth = `${100 / lastIndex}%`;
              childProps.adjustMarginRight = -Math.round(lastStepOffsetWidth / lastIndex + 1);
            }
            // fix tail color 修复末尾颜色
            if (status === 'error' && gIndex === current - 1) {
              childProps.className = `${prefixCls}-next-error`;
            }
            if (!child.props.status) {
              if (gIndex === current) {
                childProps.status = status;
              } else if (gIndex < current) {
                childProps.status = 'finish';
              } else {
                childProps.status = 'wait';
              }
            }
            setNumberChange(++gIndex)

            return (
              cloneElement(child, childProps)
            );
          }

          if (child.type === StepGroup) {
            let gruopProps = { ...this.props };
            gruopProps.children = child.props.children
            gruopProps.className = classNames(`${prefixCls}-group`, child.props.className);
            return cloneElement(child, gruopProps);
          }
          return null;

        })}
        {
          isShowMore && direction !== 'vertical' &&
          <div className={`${prefixCls}-dropdown`} >
            <Dropdown overlay={menu} key="more">
              <div className={`${prefixCls}-dropdown-icon`}><Icon type="more_horiz" /></div>
            </Dropdown>
          </div>
        }
      </div>
    )
  }
}
