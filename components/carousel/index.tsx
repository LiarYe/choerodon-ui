import React, { Component, CSSProperties } from 'react';
import classNames from 'classnames';
import { matchMediaPolifill } from '../_util/mediaQueryListPolyfill';
import ConfigContext, { ConfigContextValue } from '../config-provider/ConfigContext';

type SlickState = { breakpoint: number | null };

type SlickInstance = Component<CarouselProps, SlickState> & {
  innerSlider: any;
  slickGoTo(slide: number, dontAnimate?: boolean): void;
  slickNext(): void;
  slickPrev(): void;
  slickPlay(): void;
  slickPause(): void;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SlickCarousel: new (props: CarouselProps) => SlickInstance = require('react-slick').default;

export type CarouselEffect = 'scrollx' | 'fade';


export enum CarouselTheme {
  DARK = "dark",
  LIGHT = "light",
}

export interface CarouselResponsiveSettings extends Omit<CarouselProps,
  'children' | 'responsive' | 'effect' | 'theme' | 'prefixCls' | 'style' | 'slickGoTo' | 'dotsActionType' | 'pauseOnArrowsHover' | 'lazyLoad'> {
  appendDots?: (dots: React.ReactNode) => React.ReactElement;
  customPaging?: (index: number) => React.ReactElement;
  edgeFriction?: number;
  lazyLoad?: 'ondemand' | 'progressive';
  onEdge?: (direction: string) => void;
  onInit?: () => void;
  onReInit?: () => void;
  pauseOnFocus?: boolean;
  rows?: number;
  slidesPerRow?: number;
  swipeEvent?: (direction: string) => void;
  useTransform?: boolean;
  waitForAnimate?: boolean;
}

// Carousel
export interface CarouselProps {
  children?: React.ReactNode;
  responsive?: { breakpoint: number; settings: CarouselResponsiveSettings | 'unslick' }[] | null;
  effect?: CarouselEffect;
  dots?: boolean;
  theme?: CarouselTheme;
  vertical?: boolean;
  autoplay?: boolean;
  easing?: string;
  beforeChange?: (from: number, to: number) => void;
  afterChange?: (current: number) => void;
  style?: CSSProperties;
  prefixCls?: string;
  accessibility?: boolean;
  nextArrow?: HTMLElement | any;
  prevArrow?: HTMLElement | any;
  pauseOnHover?: boolean;
  className?: string;
  adaptiveHeight?: boolean;
  arrows?: boolean;
  autoplaySpeed?: number;
  centerMode?: boolean;
  centerPadding?: string | any;
  cssEase?: string | any;
  dotsClass?: string;
  draggable?: boolean;
  fade?: boolean;
  focusOnSelect?: boolean;
  infinite?: boolean;
  initialSlide?: number;
  lazyLoad?: boolean | 'ondemand' | 'progressive';
  onLazyLoad?: (slides: number[]) => void;
  onSwipe?: (direction: string) => void;
  asNavFor?: { innerSlider: { slideHandler(index: number): void } } | null;
  rtl?: boolean;
  slide?: string;
  slidesToShow?: number;
  slidesToScroll?: number;
  speed?: number;
  swipe?: boolean;
  swipeToSlide?: boolean;
  touchMove?: boolean;
  touchThreshold?: number;
  variableWidth?: boolean;
  useCSS?: boolean;
  slickGoTo?: number;
  dotsActionType?: ('click' | 'hover')[];
  verticalSwiping?: boolean;
  pauseOnDotsHover?: boolean;
  pauseOnArrowsHover?: boolean;
}

// Keep Slick's rendering and instance methods while replacing its overlapping breakpoint queries.
class ResponsiveSlick extends SlickCarousel {
  private breakpointQueries: { breakpoint: number; query: Partial<MediaQueryList> }[] = [];

  static getDerivedStateFromProps({ responsive }: CarouselProps, { breakpoint }: SlickState) {
    // Slick's render assumes its active breakpoint exists in the current props.
    if (breakpoint !== null && !responsive?.some(item => item.breakpoint === breakpoint)) {
      return { breakpoint: null };
    }
    return null;
  }

  componentDidMount() {
    this.bindBreakpointQueries();
  }

  componentDidUpdate(prevProps: CarouselProps) {
    if (prevProps.responsive !== this.props.responsive) {
      this.unbindBreakpointQueries();
      this.bindBreakpointQueries();
    }
  }

  componentWillUnmount() {
    this.unbindBreakpointQueries();
  }

  render() {
    const slider = super.render();
    // Slick returns a div for "unslick"; only InnerSlider consumes the filtered callbacks.
    if (!React.isValidElement<CarouselProps>(slider) || typeof slider.type === 'string') return slider;
    const { breakpoint } = this.state;
    const settings = breakpoint ? this.props.responsive?.find(item => item.breakpoint === breakpoint)?.settings : undefined;
    const { onSwipe, onLazyLoad } = { onSwipe: this.props.onSwipe, onLazyLoad: this.props.onLazyLoad, ...(settings !== 'unslick' && settings) };
    const { dotsClass, asNavFor } = slider.props;
    const hasBaseClass = dotsClass?.split(/\s+/).includes('slick-dots');
    if (hasBaseClass && !onSwipe && !onLazyLoad && !asNavFor) return slider;
    return React.cloneElement(slider, {
      // Slick owns index de-duplication; the target's inner ref can change independently.
      asNavFor: asNavFor && { innerSlider: { slideHandler: index => asNavFor.innerSlider?.slideHandler?.(index) } },
      dotsClass: hasBaseClass ? dotsClass : classNames('slick-dots', dotsClass),
      onSwipe,
      onLazyLoad,
    });
  }

  private bindBreakpointQueries() {
    const { responsive } = this.props;
    const breakpoints = [...new Set((responsive ?? []).map(item => item.breakpoint))].sort((a, b) => a - b);
    this.breakpointQueries = breakpoints.map(breakpoint => {
      const media = `(max-width: ${breakpoint}px)`;
      return { breakpoint, query: window.matchMedia?.(media) ?? matchMediaPolifill(media) };
    });
    this.breakpointQueries.forEach(({ query }) => query.addListener?.(this.updateBreakpoint));
    this.updateBreakpoint();
  }

  private unbindBreakpointQueries() {
    this.breakpointQueries.forEach(({ query }) => query.removeListener?.(this.updateBreakpoint));
    this.breakpointQueries = [];
  }

  private updateBreakpoint = () => {
    const breakpoint = this.breakpointQueries.find(({ query }) => query.matches)?.breakpoint ?? null;
    if (this.state.breakpoint !== breakpoint) this.setState({ breakpoint });
  };
}

export default class Carousel extends Component<CarouselProps> {
  static displayName = 'Carousel';

  static get contextType(): typeof ConfigContext {
    return ConfigContext;
  }

  static defaultProps = {
    dots: true,
    arrows: false,
    draggable: false,
    theme: CarouselTheme.LIGHT,
    pauseOnDotsHover: true,
    pauseOnArrowsHover: true,
    dotsActionType: ["click"],
  };

  declare context: ConfigContextValue;

  get innerSlider() {
    return this.slick?.innerSlider;
  }

  wrapper: HTMLElement | null;

  private slick: SlickInstance | null = null;

  componentDidMount() {
    this.wrapper?.addEventListener('mouseenter', this.handleControlHover, true);
    this.wrapper?.addEventListener('mouseleave', this.handleControlHover, true);
  }

  componentWillUnmount() {
    this.wrapper?.removeEventListener('mouseenter', this.handleControlHover, true);
    this.wrapper?.removeEventListener('mouseleave', this.handleControlHover, true);
  }

  private handleControlHover = (event: MouseEvent) => {
    const { target } = event;
    if (!(target instanceof Element) || target.closest('.slick-slider') !== this.wrapper?.firstElementChild) return;
    const { dotsActionType, pauseOnArrowsHover } = this.props;
    if (target.matches('li') && event.type === 'mouseenter' && dotsActionType?.includes('hover')) {
      const dots = target.closest('.slick-dots');
      const slider = this.wrapper?.firstElementChild;
      if (!dots || dots.closest('.slick-slider') !== slider) return;
      const items = Array.from(dots.querySelectorAll('li')).filter(item =>
        item.closest('.slick-dots') === dots && item.closest('.slick-slider') === slider);
      this.goTo(items.indexOf(target as HTMLLIElement), true);
    } else if (target.matches('.slick-arrow') && pauseOnArrowsHover && this.innerSlider?.props.autoplay) {
      if (event.type === 'mouseenter') this.innerSlider.pause('hovered');
      else if (this.innerSlider.state.autoplaying === 'hovered') this.innerSlider.autoPlay('leave');
    }
  };

  saveSlick = (node: SlickInstance | null) => {
    this.slick = node;
  };

  play() {
    if (this.slick?.innerSlider) this.slick.slickPlay();
  }

  pause() {
    if (this.slick?.innerSlider) this.slick.slickPause();
  }

  next() {
    if (this.slick?.innerSlider) this.slick.slickNext();
  }

  prev() {
    if (this.slick?.innerSlider) this.slick.slickPrev();
  }

  goTo(slide: number, dontAnimate?: boolean) {
    if (this.slick?.innerSlider) this.slick.slickGoTo(slide, dontAnimate);
  }

  render() {
    const { getPrefixCls } = this.context;
    const props: CarouselProps = { ...this.props };

    if (props.effect === 'fade') {
      props.fade = true;
    }

    const prefixCls = getPrefixCls('carousel', props.prefixCls);

    const className = classNames(prefixCls, {
      [`${prefixCls}-vertical`]: props.vertical,
      [`${prefixCls}-theme-dark`]: props.theme === CarouselTheme.DARK,
    });

    return (
      <div className={className} ref={(wrapper) => { this.wrapper = wrapper }}>
        <ResponsiveSlick ref={this.saveSlick} {...props} />
      </div>
    );
  }
}
