## 2026-11-26

- 在独立 React 19 工程中锁定 `react-intersection-observer@11.0.1`；根项目仍使用 React 16.14.0 和 `react-intersection-observer@8.34.0`。Picture 和文档站 Demo 改用具名 `InView`，保留首次进入视口时才加载的行为。
- Pro Table 虚拟行、单元格和表头保留首次不可见通知，以正确计算占位高度和列可见状态；修复无 `IntersectionObserver` 且配置 `defaultFallbackInView(true)` 时虚拟行挂载报错的问题。
- 基础 Transfer 移除 `react-lazy-load`，保留整行占位、默认提前 500px 加载及滚动后的勾选状态。修复可视行空白、清空搜索或将条目移回后内容不显示的问题。自定义防抖不再延迟首屏；不能提供 DOM ref 的自定义包装组件直接显示内容。

## 2026-11-26

- 将 TimePicker 面板输入框的字符串 ref 改为对象 ref，保留打开时的聚焦和全选行为。Result 改用参数默认值，省略 `status` 时仍显示 `info` 样式和图标。
- 将 RC Trigger、Popup、Align、Animate 和表格行的定位、动画及测量改为优先使用真实 DOM ref，支持 `forwardRef` 和 `memo(forwardRef)`，保留原有实例 ref 和动画回调。修复 React 19 下默认菜单波纹触发旧 DOM API 的问题。
- 保留 RC Form 校验失败时滚动到首个可见错误字段的行为，修复仅更换字段 ref 就可能影响其他字段值的问题。iframe 上传优先测量外层节点，PerformanceTable 列宽拖柄复用已有 DOM ref。
- 补充 React 16/19 回归用例和浏览器验收脚本。根项目仍使用 React 16.14.0，基础 Trigger 首次打开与完整 PerformanceTable 拖宽留待切根后在 React 19 下验收。

## 2026-11-25

- 将 CodeArea 的 `react-codemirror2` 从 5.1.0 升级至 9.0.1，保留 `codemirror@5.58.2`。将 `@types/codemirror` 从 0.0.72 升级至 5.60.15，并移至 `dependencies`，确保使用方能解析公开声明。
- 保留 `editorDidMount(editor, value, cb)` 的三个参数；显式引用旧 `IInstance` 的调用方需改用 `codemirror` 导出的 `Editor` 类型。
- 移除 CodeArea 失焦处理中的 `findDOMNode` 回退，修复卸载后延迟失焦仍触发 `onChange` 的问题。补充公开类型检查和真实编辑器回归用例，在 React 16.14.0 和 19.3.1 下验证输入、受控回写、快捷键与卸载行为。

## 2026-11-25

- 将二维码依赖 `qrcode.react` 从 1.0.1 升级至 4.2.0，沿用 `^` 版本范围，移除旧类型包 `@types/qrcode.react`。默认仍渲染 Canvas，`renderAs="svg"` 仍渲染 SVG；保留原有纠错级别和嵌图默认尺寸。
- 类型兼容提示：开启 `exactOptionalPropertyTypes` 时，仍可省略 `size` 等可选属性，但显式传入 `undefined`（如 `size={undefined}`）不再通过类型检查。

## 2026-11-25

- 将 Board 的 `react-virtualized` 从 9.18.5 升级至 9.22.6。`Column` 和 `KanbanColumn` 通过 `elementRef` 将滚动节点传给拖拽组件，不再使用 `findDOMNode`；保留原有公开属性、列尺寸和动态行高刷新行为。
- 新增 Board 浏览器回归用例，在 React 16.14.0 下验证空列与非空列的尺寸、100 条记录的首尾滚动，以及键盘跨列投放到空列。
- 为 `mini-store`、`rc-motion`、`rc-virtual-list` 恢复 `^` 版本范围，为 `react-slick`、`@types/react-slick` 恢复 `~`；`react-virtualized` 沿用 `~`。重新安装后，各包仍使用已验证的锁定版本。

## 2026-11-25

- 将 Carousel 的 `react-slick` 从 0.25.2 升级至 0.31.0，`@types/react-slick` 升级至 0.23.12，并重新生成文档站锁文件；根项目仍使用 React 16.14.0。
- 修复 Carousel 窄屏首次挂载未应用断点、从不同方向进入同一断点时显示张数不一致的问题；使用自定义圆点类名时保留默认样式，嵌套轮播的悬停切页互不干扰。
- 保留顶层和断点配置中的 `onSwipe`、`onLazyLoad` 回调；修复 `asNavFor` 联动目标进入 `'unslick'` 后源轮播切页报错的问题，目标恢复后可继续同步切页。

## 2026-11-24

- 将 `rc-virtual-list` 从 3.2.6 升级至 3.19.2，传递依赖 `rc-resize-observer` 从 1.0.0 升级至 1.4.3，保持 Tree 和 Menu 的公开属性不变。
- 修复非虚拟 Tree 按节点 key 或索引滚动时定位不准的问题，缩放容器内也能正确对齐并保留指定偏移。
- 虚拟 Menu 直接测量菜单项 DOM，保留原有实例 ref；将菜单行构造从 O(n²) 降为 O(n)，并修复横向菜单折叠指示项、测量占位项与业务项的 key 冲突。

## 2026-11-24

- 将 `rc-motion` 从 2.4.1 升级至 2.9.5，保持 Tree 公开属性不变。修复受控展开与收起快速切换时动画方向不正确，以及动画中替换树数据后旧节点重新出现的问题。
- 修复 React 19 `StrictMode` 下 Tree 动画提前结束的问题；仅焦点状态变化时，非虚拟列表不再重复渲染各行。

## 2026-11-24

- 将 `mini-store` 从 2.0.0 升级至 3.0.6，Menu 通过 `forwardRef` 获取子菜单实例，不再依赖 `getWrappedInstance()`，保持公开属性和实例方法不变。
- 补充 Menu 在 React 16 和 19 下的嵌套选中、键盘导航及 `scrollToKey` 回归测试；预览改用真实 Menu，验证 React 19 下的列表滚动和横向菜单溢出，并更新迁移计划中的 B3 验收结果。

## 2026-11-24

- 调整 Trigger 的 DOM ref，区分触发区域、弹层节点和对齐目标，保留子组件原有 ref，并修复重复定位时自定义样式被覆盖的问题。
- 调整 Pro 字段的焦点与对齐节点，保留 Lov 按钮模式的聚焦、失焦行为；复用共享 ref 合并逻辑，保留 Typography 在 React 16 下的清理行为，并支持 React 19 的回调 ref 清理。
- 区分 Menu 的滚动容器、测量节点和虚拟列表滚动句柄，保留菜单项原有 ref，并修复横向虚拟菜单误隐藏可见末项的问题。
- 补充 Trigger、Pro 字段和 Menu 的回归测试及菜单预览；在升级计划中明确 React 19 下的尺寸监听修复、旧版 ref 兼容代码清理及发布包 JSX 转换检查。

## 2026-11-23

- 代码中去除对 `rc-util` 的直接导入，并优化相关代码。

## 2026-11-20

- 补充 React 19 分阶段迁移计划，明确依赖升级顺序、根项目切换时机及各步骤的验收条件。
- 新增独立的 React 19.3.1 测试工程，支持全量、按组件目录或按文件运行用例，并配置 TypeScript 和 ESLint 检查；根项目仍使用 React 16.14.0。
- 新增按组件访问的浏览器预览页，可独立查看和操作 Avatar、Icon，验证真实组件、样式及字体资源。

## 2026-11-06

- 升级 MobX 至 6.16.1、mobx-react 至 9.2.2，新增 mobx-react-lite 依赖，同步依赖声明、锁文件及文档站解析配置。
- 完成 DataSet、Store 及 Pro 组件的 MobX 6 响应式初始化与 action/computed 适配，兼容继承、方法绑定及 React props/context 更新。
- 修复配置引用身份与 useDataSet 重建问题，完善表格异步配置、附件计数缓存及组件卸载清理，并避免排序修改原始数据。
- 补齐 Pro 入口默认配置初始化及 sideEffects 声明，防止打包优化移除必要配置。
- 补充 MobX 迁移、配置更新、缓存和生命周期等回归测试，增强行为断言、源码测试门禁与构建产物检查，并接入 CI。

## 2026-10-28

- 升级 TypeScript 至 `^5.9.3`、ESLint 至 8.57.1、typescript-eslint 至 8.x、Airbnb 配置至 19.x，并匹配 Jest、React Hooks lint 插件及依赖锁文件。
- 适配新版 TypeScript 的类型检查，修复上传、弹窗、数字输入、查询过滤、图片裁剪及按钮回调等类型报错，保持现有运行逻辑与公开 API。
- 调整 ESLint 配置以兼容新版解析器和装饰器字段，恢复 Promise 执行器返回值、静态正则及构造器返回值检查，仅为 Yallist 构造器保留文件级例外。
- 恢复未使用 catch 参数检查，移除 29 处未使用的异常参数绑定；等价调整 Promise 执行器与静态正则写法，保留原有异常处理和执行行为。

## 2026-10-27

- 升级 Babel 至 7.29.7、Gulp 至 5.0.1 及相关构建依赖，React/ReactDOM 更新至 16.14.0，为后续 React 19 迁移做准备；本次不升级 React 19。
- 调整 Babel 浏览器目标为现代浏览器并明确不再支持 Internet Explorer；保留经典 JSX runtime，并为 Webpack 4 文档站配置独立语法目标。
- 重构 Gulp 编译流的完成、错误传播、提前关闭与取消清理逻辑，改进 TypeScript、Less 和二进制资源处理，并增加发布入口完整性检查。
- 修复文档站构建错误未可靠返回失败状态的问题，区分 `start` 与 `build` 错误策略；统一启动/构建时颜色文件生成，并按 Node 14–24 大版本处理 OpenSSL 参数。
- 收紧项目依赖兜底解析，仅对顶层模块缺失执行回退，保留嵌套依赖及模块执行异常。
- 补充 AJV 8 开发依赖，修复新版 schema 校验工具错误解析到旧版 AJV 的依赖冲突，并同步根项目与文档站锁文件。
- 修复 Tabs 初始化时 Ink Bar 回调的暂时性死区异常，补充启用计数场景的回归测试。
- 重命名 shared 全局对象的模块内变量，避免 Jest 25 包装参数冲突，对外默认导出保持不变。
- 补充 Gulp、依赖解析、站点构建与启动脚本的回归检查；更新构建语法、产物及 React 16.14 相关验证。

## 2026-10-26

- 将根目录发布构建升级至 Webpack 5，并更新相关 loader、CSS 提取与压缩配置。
- 将 BiSheng 文档站及 Webpack 4 依赖迁移到`site/legacy-build` 独立工具树，保留站点启动与 SSR 构建入口。
- 增加 Less 串行渲染队列，降低并发构建下 CSS 类名偶发丢失的风险，并保留 source map。
- 调整样式`sideEffects` 声明，避免打包时误删组件样式。
- 增加构建产物、安装流程与 legacy 依赖解析的回归检查。
- 兼容 Node 至 24.x，并优化 package.json 中 mobx react 依赖版本。
- 将 CircleCI Node 环境切换至 Node 18，并隔离旧 Node 版本依赖缓存。
