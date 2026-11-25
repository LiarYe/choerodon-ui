---
category: Components
type: Data Display
title: Carousel
subtitle: 走马灯
---

旋转木马，一组轮播的区域。

## 何时使用

- 当有一组平级的内容。
- 当内容空间不足时，可以用走马灯的形式进行收纳，进行轮播展现。
- 常用于一组图片或卡片轮播。

## API

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| afterChange | 切换面板的回调 | function(current) | 无 |
| autoplay | 是否自动切换 | boolean | false |
| beforeChange | 切换面板的回调 | function(from, to) | 无 |
| dots | 是否显示面板指示点 | boolean | true |
| easing | 动画效果 | string | linear |
| effect | 面板切换效果 | `scrollx` \| `fade` | `scrollx` |
| vertical | 垂直显示 | boolean | false |
| className | 组件自定义类名 | string | |
| dotsClass | 指示器类名 | string | |
| prevArrow | 自定义上一个箭头 | HTMLElement | |
| nextArrow | 自定义下一个箭头 | HTMLElement | |
| theme | 箭头和指示器主题 | dark \| light| light |
| arrows | 是否显示箭头 | boolean | false |
| dotsActionType | 指示点触发方式；包含 `'hover'` 时，悬停也可切换面板 | `('click' \| 'hover')[]` | `['click']` |
| slidesToShow | 一个画面中显示多少张（可以是小数）| number | 1 |
| verticalSwiping | 垂直方向拖动 | boolean | false |
| pauseOnDotsHover | 鼠标在指示器上停止播放 | boolean | true |
| pauseOnArrowsHover | 鼠标在箭头上停止播放 | boolean | true |
| children | 轮播面板内容 | `React.ReactNode` | - |
| responsive | 按视口宽度覆盖设置，匹配规则见下文 | `{ breakpoint: number; settings: CarouselResponsiveSettings \| 'unslick' }[] \| null` | - |
| asNavFor | 联动目标。传入已挂载的实例（如 `peerRef.current`），而非 ref 容器；传 `null` 可关闭联动。目标进入 `'unslick'` 时会自动跳过同步，不补播错过的切换；目标恢复后，下次切到不同索引时继续同步 | `{ innerSlider: { slideHandler(index: number): void } } \| null` | - |
| onSwipe | 滑动时接收方向 | `(direction: string) => void` | - |
| onLazyLoad | 接收本次懒加载的面板索引 | `(slides: number[]) => void` | - |
| lazyLoad | 顶层设置仍接受布尔值，也可指定按需或渐进加载 | `boolean \| 'ondemand' \| 'progressive'` | - |

### responsive 与 CarouselResponsiveSettings

`breakpoint` 是视口宽度上限（px，含边界）。若同时匹配多个断点，只应用其中最小断点的设置，不叠加其他断点。没有匹配项，或 `responsive` 为 `null` 或未提供时，使用顶层设置。匹配到 `'unslick'` 时，面板作为普通内容显示，不启用轮播。

`CarouselResponsiveSettings` 以 `CarouselProps` 为基础，排除 `children`、`responsive`、`effect`、`theme`、`prefixCls`、`style`、`slickGoTo`、`dotsActionType`、`pauseOnArrowsHover` 和 `lazyLoad`。断点内重新声明的 `lazyLoad` 只接受 `'ondemand'` 或 `'progressive'`，不接受布尔值。以下为额外可选字段，并非任意 Slick 设置都受支持：

| 字段 | 类型 |
| --- | --- |
| `appendDots` | `(dots: React.ReactNode) => React.ReactElement` |
| `customPaging` | `(index: number) => React.ReactElement` |
| `edgeFriction`, `rows`, `slidesPerRow` | `number` |
| `onEdge`, `swipeEvent` | `(direction: string) => void` |
| `onInit`, `onReInit` | `() => void` |
| `pauseOnFocus`, `useTransform`, `waitForAnimate` | `boolean` |

## 方法

通过 Carousel 实例调用下列方法。处于 `'unslick'` 时没有可操作的轮播，调用这些方法不会产生效果。

| 名称 | 描述 |
| --- | --- |
| `goTo(slide: number, dontAnimate?: boolean)` | 切换到指定索引的面板（从 0 开始）；传 `true` 跳过动画 |
| `next()` | 切换到下一面板 |
| `prev()` | 切换到上一面板 |
| `play()` | 开始或恢复自动播放 |
| `pause()` | 暂停自动播放 |

**旧版迁移：** 旧声明暴露了未文档化的 `arrowsRef`、`dotsRef`、`bindDotsEvent`、`bindArrowEvent`、`handleDotsHover` 和 `handleArrowMouseChange`。仓内未发现组件实现之外的调用；这些成员已移除。若外部代码依赖它们，请改用 `dotsActionType`、`pauseOnArrowsHover` 或上述实例方法，不要再手动绑定内部控件。

## Q&A

1. 拖动的过程出现画面卡住一半的情况。

  解决方案：请使用 div 对内容多包裹一层进行处理。详情参考垂直demo。

2. 切换下一张图片时导致溢出的问题

  解决方案：配置 slidesToShow 为小数点，可以避免。 例如：理论上一个画面显示 1 张，实际确显示了 1.01  张，配置 0.99 即可解决。

更多参数可参考：<https://github.com/akiran/react-slick>
