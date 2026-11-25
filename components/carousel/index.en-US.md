---
category: Components
type: Data Display
title: Carousel
---

A carousel component. Scales with its container.

## When To Use

- When there is a group of content on the same level.
- When there is insufficient content space, it can be used to save space in the form of a revolving door.
- Commonly used for a group of pictures/cards.

## API

| Property | Description | Type | Default |
| -------- | ----------- | ---- | ------- |
| afterChange | Callback function called after the current index changes | function(current) | - |
| autoplay | Whether to scroll automatically | boolean | `false` |
| beforeChange | Callback function called before the current index changes | function(from, to) | - |
| dots | Whether to show the dots at the bottom of the gallery | boolean | `true` |
| easing | Transition interpolation function name | string | `linear` |
| effect | Transition effect | `scrollx` \| `fade` | `scrollx` |
| vertical | Whether to use a vertical display | boolean | `false` |
| className | Component Custom Class Names | string | |
| dotsClass | Indicator class name | string | |
| prevArrow | Customize the previous arrow | HTMLElement | |
| nextArrow | Customize the next arrow | HTMLElement | |
| theme | Arrow and Indicator Theme | dark \| light| light |
| arrows | Whether to show arrows | boolean | false |
| dotsActionType | Dot triggers. Include `'hover'` to also switch slides on hover | `('click' \| 'hover')[]` | `['click']` |
| slidesToShow | Number of slides shown at once (can be fractional) | number | 1 |
| verticalSwiping | Vertical Drag | boolean | false |
| pauseOnDotsHover | Mouse over indicator to stop playback | boolean | true |
| pauseOnArrowsHover | Mouse over arrows to stop playback | boolean | true |
| children | Content of the slides | `React.ReactNode` | - |
| responsive | Override settings by viewport width; see the matching rule below | `{ breakpoint: number; settings: CarouselResponsiveSettings \| 'unslick' }[] \| null` | - |
| asNavFor | Pass the mounted peer instance (e.g. `peerRef.current`), not the ref object. Pass `null` to disable synchronization. A peer in `'unslick'` mode is skipped automatically; missed changes are not replayed. Once active again, it follows the next change to a different index | `{ innerSlider: { slideHandler(index: number): void } } \| null` | - |
| onSwipe | Receives the swipe direction | `(direction: string) => void` | - |
| onLazyLoad | Receives the indices of the slides just loaded | `(slides: number[]) => void` | - |
| lazyLoad | The top-level setting still accepts a boolean, or you can select on-demand or progressive loading | `boolean \| 'ondemand' \| 'progressive'` | - |

### responsive and CarouselResponsiveSettings

`breakpoint` is an inclusive maximum viewport width in pixels. If multiple breakpoints match, only the smallest matching breakpoint applies; settings from other breakpoints are not merged. When none match, or `responsive` is `null` or omitted, the top-level settings apply. A matching `'unslick'` renders the slides as plain content without a slider.

`CarouselResponsiveSettings` starts from `CarouselProps` and excludes `children`, `responsive`, `effect`, `theme`, `prefixCls`, `style`, `slickGoTo`, `dotsActionType`, `pauseOnArrowsHover`, and `lazyLoad`. It redefines `lazyLoad` to accept only `'ondemand'` or `'progressive'`, not a boolean. The following additional fields are optional; arbitrary Slick settings are not supported by this type:

| Field | Type |
| --- | --- |
| `appendDots` | `(dots: React.ReactNode) => React.ReactElement` |
| `customPaging` | `(index: number) => React.ReactElement` |
| `edgeFriction`, `rows`, `slidesPerRow` | `number` |
| `onEdge`, `swipeEvent` | `(direction: string) => void` |
| `onInit`, `onReInit` | `() => void` |
| `pauseOnFocus`, `useTransform`, `waitForAnimate` | `boolean` |

## Methods

Call these methods on the Carousel instance. In `'unslick'` mode there is no active slider, so these calls have no effect.

| Name | Description |
| ---- | ----------- |
| `goTo(slide: number, dontAnimate?: boolean)` | Switch to the zero-based slide index; pass `true` to skip animation |
| `next()` | Switch to the next slide |
| `prev()` | Switch to the previous slide |
| `play()` | Start or resume autoplay |
| `pause()` | Pause autoplay |

**Migrating from older versions:** The old declarations exposed the undocumented `arrowsRef`, `dotsRef`, `bindDotsEvent`, `bindArrowEvent`, `handleDotsHover`, and `handleArrowMouseChange`. No in-repository consumers were found outside the component implementation. These members have been removed. If your code used them, use `dotsActionType`, `pauseOnArrowsHover`, or the instance methods above instead of binding events to internal controls.

## Q&A

1. The dragging process appears to be stuck halfway through the screen.

  Solution: Please use div to wrap the content with one more layer for processing. For details, please refer to the vertical demo.

2. Problem causing overflow when switching to the next image

  Solution: Configure slidesToShow to be a decimal point, it can be avoided. For example, in theory, a screen shows 1 picture, but in reality, it shows 1.01 pictures, configure 0.99 to solve the problem.

For more info on the parameters, refer to the <https://github.com/akiran/react-slick>
