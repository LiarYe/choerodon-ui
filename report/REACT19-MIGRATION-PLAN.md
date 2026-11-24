# React 19 专线升级计划

**根项目在 C0 切到 React 19，不等 D1。** `master` 维护 16；`react-19-feature` 不做双版本 shim，不发布 React 18 过渡版。顺序：A 固定基线 → B 在 16 根工程逐包升级 → P 准备严格安装所必需的替换 → C0 一次切根 → C 在根 19 上逐组件验收 → D 验发布物。正式源码始终改原目录，不复制到测试工程。

## 背景与目的

本项目为 React 组件库，改造前使用的是 React 16.x，最终要升级 React 19。
此文是升级的计划，需要逐步完成。

## 执行规则与本次证据

- 每次领取一个编号；表中明确分批的项，每个子项单独执行。交付记录：**改了哪些文件 / 实际命令 / 结果 / 未覆盖项**。前置未过则停在该项；不把跳过、mock 包装器或 `npm install` 成功记作交互通过。
- 组件测试放 `tests-react19/cases/<源码目录>/<组件>/`。在根运行 `npm --prefix tests-react19 test -- cases/components/avatar/`（目录），或 `npm --prefix tests-react19 test -- --runTestsByPath cases/components/avatar/image.test.tsx`（文件）。表中的新场景是**要新增的测试**。宽高、真实滚动、指针拖拽须在浏览器测，jsdom 不提供真实布局。
- **已验证（2026-11-20，Node 20.19.6 / npm 10.8.2）：** A2 已建，本次重跑 2 个文件、3 条均通过。下列目标已查 npm 精确版本；B 阶段目标包组合在临时 16.14.0、19.3.1 环境严格安装通过，19 环境加上 P 阶段替代包、RTL 和类型也通过。**不是整库运行认证。**
- **根清单预演：** 原 16 清单带原锁严格解析通过。临时副本换成 19 候选、沿用原锁时出现 `ERESOLVE`（旧 16.14.0 与新 DnD peer）；无锁重算虽通过，但 `react-document-title → react-side-effect` 又带入 16。隔离该站点链后得到单 React/DOM 19 的候选锁。实验只跑 `--package-lock-only --strict-peer-deps --ignore-scripts`；根正式 `ci`、构建、交互仍待执行。

## A｜在现有分支固定参照，不升级根 React

| 步骤 | 动作 | 完成条件 |
|---|---|---|
| A1 基线 | 记录 Node/npm、根 lock 和 `npm ls`；跑 `npm run tsc -- --noEmit`、`npm run test:mobx-source`、`npm run compile` 及本批组件旧用例。 | 按命令留存通过或既有失败；后续用同一条命令比较。裸 `npm run tsc` 可能生成文件。 |
| A2 已完成 | 复用 [独立 Jest](../tests-react19/jest.config.cjs)：React/DOM 19.3.1、RTL 16.3.3、DOM Testing Library 10.4.2。不要重建或加载根 Enzyme setup。 | `npm --prefix tests-react19 test`；runtime 和 Avatar 通过，只证明这两组。 |
| A3 测试入口 | 盘点根普通 Jest 与 MobX setup、serializer、adapter；标记每个套件的替代用例或留在 master 的理由。先迁一条 DataSet 元素判断和一条 observer 更新断言。 | 这两条真实行为在 19 入口可单跑；清单可追踪，不以整批 skip 代替迁移。 |
| A4 安装边界 | 将站点工具安装从根 postinstall 隔离：当前 `site/legacy-build/install.js` 显式使用 `ci --legacy-peer-deps`。同步调整 `tools/tests/install.test.js`；梳理站点专属 dev 依赖的真实引入方。 | `node tools/tests/install.test.js` 通过；能分别安装/报告根与站点，不将站点的宽松安装称为根全链严格。 |

### A5 浏览器手测入口（已实现，A2 后即可使用）

- **启动：** 根项目与 `tests-react19` 均安装依赖后，在仓库根运行 `npm --prefix tests-react19 run preview`，打开 <http://localhost:4191/>。保存源码后等待终端编译完成，刷新浏览器。仅检查编译可运行 `npm --prefix tests-react19 run preview:build`。
- **Avatar 验收：** [示例入口](../tests-react19/preview/main.tsx) 渲染真实 Avatar → Icon，点击按钮切换圆形/方形。React 19.3.1 下实测头像为 64×64，圆角从 50% 变为 2px，人像字体仍显示；不能只看按钮文字变化。
- **增加组件：** 按 AvatarDemo 的形式在入口挂载目标组件和对应样式；示例增多时可按组件拆文件。继承组件直接渲染真实子类，按需传入 Provider、DataSet、父容器等，并执行能触发基类行为的操作（如 focus/blur）。跨组件引用走真实源码，不 mock、不复制父类或从全库总入口批量导入；未迁移依赖导致的报错按实际链路记录。
- **解析边界：** [预览配置](../tests-react19/preview.cjs) 先加载组件库默认配置，再加载手测入口；基础、Pro、DataSet、Shared 映射到源码，React/DOM 及子入口统一到独立 19 实例，编译检查是否混入第二份。P 阶段新包如只装在子工程，其预览解析也要明确指向候选版本；C0c 同步将预览与 Jest 切到根 React，再重跑本例。

## B｜可跨版本的改动：在根加依赖，每次只动一个调用面

**此阶段根仍是 React 16.14.0。** 下列包在根升级并更新 lock，不在测试目录复制一份。每项先用 16 验等价行为；在 19 下能独立运行的再跑同一场景。若整组件被尚未迁移的共享路径阻塞，本项只验注明的局部契约，最终组合测试在指明的后续步骤关闭。

| 步骤 | 改动（当前锁版 → 目标） | 本项验收 |
|---|---|---|
| B1a 移除源码对 `rc-util` 的直接导入 | Avatar.Group 复用仓内 `Children/toArray`；Typography 和 Base 共用 `useMergedRef`，保留 `setContentRef` 和内部测量 ref。不新增或升级 `rc-util`，不改其他包的传递依赖。 | Avatar 验证空项占位、Fragment 计数和折叠结果；Typography 在 React 16/19 下验证 ref 挂载和解绑、19 的 callback cleanup，以及省略测量。以源码无直接导入为准，不要求 `npm ls rc-util` 为空。 |
| B1b 其他直接依赖 | Form 显式声明 `hoist-non-react-statics@3.3.2`；Calendar 声明 `prop-types@15.8.1`；PerformanceTable 若保留 polyfill 则声明 `react-lifecycles-compat@3.0.4`。 | 每项验证实际调用方的导入和行为。不强行覆盖其他包的 `react-is`。（暂不执行，后续其他包升级后验证） |
| B2 公共 DOM ref | 按序各一项：基础 Trigger → Pro TriggerField/ViewComponent → vendored MenuItem/DOMWrap。显式传递真实节点并组合已有 ref，不随意新增 wrapper。 | 依次验首次挂载/外部点击；Lov/Select 无 wrapper 的聚焦；菜单滚入与容器测量。真实尺寸在浏览器验。 |
| B3 Menu store（已完成） | 根 `mini-store` 2.0.0 → 3.0.6。仅 `SubPopupMenu` 的 `connect` 开启 `forwardRef`；根 Menu 的四个实例方法直接委派，不改公开属性。 | [同一交互用例](../tests-react19/cases/components/menu/connectedMenu.test.jsx) 在 16.14.0 / 19.3.1 验证嵌套选中、上下键、实例方法及滚动目标。19 的[真实菜单预览](../tests-react19/preview/components/menu/index.tsx) 实测 `scrollTop` 为 0 → 522 → 0 px；横向收窄后显示“更多”，展开恢复五项。 |
| B4 Tree 动画（已完成） | 根 `rc-motion` 2.4.1 → 2.9.5；沿用动画 `div` 的 ref。NodeList 按当前方向和上次展开数据渲染动画行，不改 Tree 属性。 | [共享用例](../tests-react19/cases/components/tree/motion.test.jsx) 在 React 16.14.0 / 19.3.1 均通过：正常展开、受控展开中反向收起；子节点冒泡不提前结束，容器 `transitionend` 只结算一次，最终节点正确。jsdom 验事件，不验视觉和布局；虚拟列表留 B5。 |
| B5 虚拟列表 | `rc-virtual-list` 3.2.6 → 3.19.2；核对该调用链实际锁到的 `rc-resize-observer`（候选 1.4.3）。 | 改变容器尺寸，Tree/Menu 行高非零、可见行位置改变；仅未抛异常不算通过。 |
| B6 Carousel | `react-slick` 0.25.2 → 0.31.0。 | 浏览器验首屏宽度、切页和断点。 |
| B7 Board 测量 | `react-virtualized` 9.18.5 → 9.22.6；保留 List/AutoSizer，清理 KanbanColumn 对列表实例的 `findDOMNode`。 | 空列/非空列和滚动位置在 16 正确；完整 19 拖拽在 C7 复验。 |
| B8 二维码 | `qrcode.react` 1.0.1 → 4.2.0；用具名 Canvas/SVG 导出，移除失效旧声明，保留 `renderAs`。 | 默认 canvas、显式 svg；旧公开 props 的 TS 样例通过。 |
| B9 CodeArea | `react-codemirror2` 5.1.0 → 9.0.1；保留 `codemirror@5.58.2`，`IInstance` 改为 CodeMirror Editor；移除无 wrapper 时的旧节点回退。 | 16 下真实编辑器输入、受控回写、快捷键、卸载及公开类型；19 整体在 C3b 后复跑。 |
| B10 剩余本地旧写法 | 按目录单做：TimePicker 字符串 ref；Result 函数组件默认值；RC Trigger/TableRow/Form；Align/Animate、上传与列宽拖柄。类组件 `defaultProps` 和 `declare context` 不需机械改写。 | 每批至少触发一次旧路径：focus、默认值、行节点、滚到错误项、动画结束或实际列宽变化，分别记录。 |

## P｜在 C0 之前解除 peer 冲突，不让根切换变成一次业务重写

**为什么需要 P：** 新 DnD 和 InView 11 不能装进 16 根；旧 DnD、懒加载、编辑器等又不能留在 19 根做严格安装。两边都不接受的依赖不能靠调整 `npm install` 顺序解决。以下是少数需要提前验证的例外。能双端运行的直接在根完成；不能的在同一分支准备可单独验证的改动，先不合入要求 16 可安装的基线，C0 一起落正式声明。无需长期分支。

| 步骤 | 准备什么 | 如何关闭本项 |
|---|---|---|
| P1 可见性组件 | 在独立 19 工程装 `react-intersection-observer@11.0.1`（旧 8.34.0）；新版本 React peer 从 17 起。把 Picture/虚拟行改为具名 InView；下一小项以同包替换 Transfer 的 `react-lazy-load@3.1.13`。 | 前者验首次可见及首次 false 的处理；后者验嵌套滚动根、默认提前 500px、整行占位、勾选后滚出再回来仍在。 |
| P2 拖拽 | 在独立 19 工程装 `@hello-pangea/dnd@18.0.1` 替换 `react-beautiful-dnd@13.0.0`；先 Pro Table，再逐入口迁 Upload/Tabs、Attachment、Board/PerformanceTable。公共 Context 不混用。 | 每个入口单测排序；Pro Table 按 [跨表示例](../components-pro/table/demo/multi-table-drag.md) 用真实属性 `customDragDropContenxt`、不同表标识和外部回调，验证数据跨表变化和默认单表。最后清点旧 import/类型、确认根 Redux 7 无独立调用。 |
| P3 图片预览 | `react-image-lightbox` 4.6.0 → `yet-another-react-lightbox@3.33.1`，双端 peer 允许；优先在根做，先验证 ESM/CJS 构建。编辑器、Viewer 的 `findDOMNode` 同步改真实节点。 | 两个入口均从中间图打开、首尾停止、关闭回焦；若 16 工具链不能消费 ESM，按 P1 的独立 19 方式预验，不强装。 |
| P4 富文本入口 | `react-quill` 1.3.5 → `react-quill-new@3.8.3`；其依赖 Quill `~2.0.3`（验证 2.0.3），必需 peer `quill-delta` 用 5.1.0；旧 Delta 3、Parchment 1 类型不能复用。先只验证模块边界，再做编辑行为。 | 无 DOM Node 直接加载包装器实测失败（19 下 `document is not defined`）；验的是**本库** ES/CJS 服务端入口不初始化编辑器，以及浏览器能加载 Snow CSS、插件。若不通，暂停此候选，在同一测试下试直接集成 Quill 2；不得直接进 C0。 |
| P5 富文本行为 | 在 P4 通过的入口迁 Delta、插件和历史数据读写。 | 一份历史 Delta 加载→编辑→保存完整 Delta→Viewer 展示；另验粘贴/拖图。与 SSR 分开出结果。 |

P 阶段使用测试工程的候选包时，**从正式源码导入它**，在 Jest 为该包（包括用到的导出子路径）显式解析到子工程安装位置，断言实际解析路径和版本；测试文件能直接 import 不算。依赖样式可在 jsdom 隔离，但必须另验真实构建。C0 删除临时候选映射。对已经在根完成的项，不再重复安装。

## C0｜正式切根：只验依赖和测试入口，不夹带 Modal 改造

| 步骤 | 操作 | 完成条件 |
|---|---|---|
| C0a 候选锁预检 | 临时复制当前根清单/锁；应用 B/P 已验版本及下行运行时。迁出旧 Enzyme16 adapter、旧 renderer；逐项隔离站点专用 `react-copy-to-clipboard`、`react-infinite-scroller`、`react-intl`、`react-document-title`，查实际消费者再移，不能只删声明。同步检查站点仍能取得这些工具。 | `npm install --package-lock-only --strict-peer-deps --ignore-scripts`。比较保留旧锁与无锁解析；列出所有 React/DOM 安装路径。如需重算，审查无关漂移并缩小差异，不能盲交新锁。失败不进入 C0b。 |
| **C0b 根升级** | 合入准备好的 P 改动；根 dev React/DOM 与根 `react-is` 锁 **19.3.1**，`@types/react`、`@types/react-dom` **19.3.0**；React/DOM 保持消费者 peer，先限 `^19.3.1`。正式依赖写根，删除无引用的旧 DnD/类型和旧根 `react-redux@7.2.0`（新 DnD 自带 Redux 5/React Redux 9）。 | 从干净工作树执行根 `npm ci --strict-peer-deps`（含生命周期）；`npm ls react react-dom react-is mobx mobx-react mobx-react-lite --all`。React/DOM 各一个实例，嵌套 react-is 可不同。若失败在本步解决，不用 force/全树 overrides。 |
| C0c 测试改用根实例 | 保留 `tests-react19/cases`，将 Jest 的 React/DOM 及 JSX/client 子入口统一映射到**根**，替代包也从根解析；更新 runtime 断言（旧断言预期子目录）。启用 A3 迁好的普通/MobX 入口。 | 从组件、RTL、ReactDOM 的测试运行环境证明使用同一根 React；重跑 runtime、Avatar、DataSet element/Fragment、observer 更新以及 P 的定向用例。不要求所有组件此时已兼容。 |

## C｜此后直接改根源码与依赖；每行验完即可关闭

| 步骤 | 只改什么 | 单独验收 |
|---|---|---|
| C0d 共享尺寸监听（关闭 B2 弹层阻塞） | C0c 后将 [ReactResizeObserver](../components/_util/resizeObserver.tsx) 的 `findDOMNode(this)` 改为观察显式传入的真实 DOM 节点，不新增 wrapper。React 16 的 B2 定向用例已通过；React 19 在 `PopupInner` 挂载时抛错，尚未执行外点断言。 | 验证 `immediately` 首次测量、尺寸变化回调、禁用及卸载时断开监听。重跑 [Trigger 首次可见用例](../tests-react19/cases/components/trigger/host.test.tsx)：弹层成功挂载，点击触发器或弹层不关闭，点击外部才关闭。 |
| C0e Trigger 宿主 ref 收尾（C0d 后） | 核对 Tooltip 等真实调用方：能透传 DOM 的子项组合原 ref；返回组件实例的子项显式提供宿主，不改变公开 ref 或新增 wrapper。仅在宿主契约验证后删除 B2 的 `LegacyHost`、旧 `element.ref` 读取和自定义 highlight 的 `findDOMNode` 回退；停止支持旧 React 后直接读 `props.ref`，删除 `mergeRefs` 的版本判断、Typography 专用的旧版 cleanup 参数和 MenuItem 的字符串 ref 分支，保留回调 cleanup 与对象 ref 清空行为。 | 用 Typography 复制按钮（TransButton）、Pro Button 和自定义 highlight 验证首次定位、内外点击、原 ref 值与替换/卸载 cleanup；外部组件不暴露宿主的限制须明确，不以回退到空节点作为通过。 |
| C1 基础静态 Modal | [confirm](../components/modal/confirm.tsx) 按容器保存 root，关闭动画后卸载。公开句柄只有 destroy，不新增 update。 | 打开→取消；同轮打开即 destroy；再打开。验回调次数、动画后节点清理。 |
| C2 Notification / Message | 实例通过 ref 异步交付；处理待定 Promise，旧 ref 不得回写已销毁缓存。 | 同键 open→destroy→open，中间不等待首次提交；只留下新实例。Message 连发、立即关闭单验。 |
| C3a Pro Modal | 无 Provider 冷启动共享待创建的 root；保留 Provider portal。 | 同轮两次 open、立即 update/close，只建一个 root；已有 Provider 不建额外容器。 |
| C3b Pro Tooltip | 改 `components-pro/tooltip/singleton.tsx` 的旧 render callback、首次创建及延迟任务。 | 首次 show 即 hide、连续 show、无 DOM 不悬挂；重跑 B9 CodeArea。 |
| C4 文本提取 | `getReactNodeText` **已返回 Promise**；在提交完成后读 DOM，再卸载。保留已有值语义。 | await 字符串、0（现为 `''`）、非零数、复合节点、无 DOM；用 Tabs 或 TableStore 验一个真实调用且无节点残留。 |
| C5 JSX 编译 | 根 TS 5.9.3 已足够；分别处理 gulp TSX 与 Babel vendored JSX、Jest 和 webpack externals，不能只改 TS。 | 每条编译链各取样例，检查 ES/CJS 的 JSX runtime 解析；更新并跑 `node tools/tests/webpack5.test.js`，不把 React 私有副本打包。 |
| C6 类型 | 使用根 19 声明，逐族处理 `React.JSX`、useRef 初值、ref 返回值、unknown props；Picture 公开类型直接引用 `csstype` 时在发布声明补齐。19 类型声明支持 TS ≥5.6，根满足；站点 TS 4.9.5 单独处理。 | 每族记录 `npm run tsc -- --noEmit` 对应诊断归零；最后全量零错。独立消费者编译 Table/CodeArea/QRCode/Picture，不用 SWC 或 any 代替。 |
| C7 自建与业务集成 | 分目录复验 B/P 需组合的真实路径；扫 vendored rc 和 Pro 的旧 Context、字符串 ref、`element.ref`、被移除 ReactDOM API。 | Board 虚拟行键盘/指针拖拽、Transfer、编辑器分别有浏览器证据；每个执行路径有用例，StrictMode 重挂载不重复监听；历史文本不当作可执行命中。 |

## D｜根已是 19；这里只有验收，没有第二次切换

| 步骤 | 操作及完成条件 |
|---|---|
| D1 整库 | 新环境重新根严格 ci，跑 C0c 入口和组件用例；记录单实例、根类型检查及 A3 套件覆盖。不要用只装锁或 `--ignore-scripts` 替代。 |
| D2 发布产物 | 依次 `npm run compile`、`npm run dist`；跑 `node tools/tests/webpack5.test.js` 和 `node tools/tests/dist-contract.test.js`。先改后者的 React 16 UMD/旧 render 宿主，用本轮产物测 ESM/CJS、SSR 及真实浏览器挂载；React 19 不发布 UMD，不等于本库要删 UMD。 |
| D3 站点 | 先让 `npm run site` 的 SSR 组件页含正文；再修 BiSheng 生成的客户端入口（旧 render）、Router/Intl 与 Layout Context，锁定可复现的模板/工具改动，不手改 node_modules。浏览器接管后无 hydration 错误、demo 可点、页面仅一份根 React。 |
| D4 外部消费者 | `npm pack` 后在仓库外严格安装 tarball，验证基础/Pro/DataSet/Shared、字体 CSS、公开类型、真实 MobX observer。无 alias、无手补依赖。若声明 `^19.0.0`，须另加配对的 React/DOM 19.0.0 消费者通过；否则不扩范围。 |
| D4a JSX 转换终验 | 复用 C5 的 TSX、vendored JSX 样例，核对 D4 实际安装包的 ESM/CJS 对应代码均使用 `react/jsx-runtime`；`tsc --noEmit` 通过不算产物证据。若仍是经典转换，回到 C5 修正实际生成 JS 的环节（TS 用 `react-jsx`，Babel 用 `runtime: "automatic"`）。配置对齐后仅清理确实未使用的 React 导入，复跑 TS、ESLint 和受影响的发布验收。 |
| D5 发布决策 | 对照 A3 关闭剩余行为回归；列出未测/失败和消费者迁移点（拖拽 Context、富文本、类型）。所有发布门槛通过再声明兼容，master 不接收新锁。 |

## 版本依据与复核入口

用 `npm view <包名>@<目标版本> version peerDependencies dependencies engines --json --registry=https://registry.npmjs.org` 复查固定版本，不用 latest 代替。关键边界：[React 19 升级指南](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)、[ReactDOM 19.3.1](https://registry.npmjs.org/react-dom/19.3.1)、[React 类型](https://registry.npmjs.org/@types%2freact/19.3.0)、[CodeMirror 包装器](https://registry.npmjs.org/react-codemirror2/9.0.1)、[InView](https://registry.npmjs.org/react-intersection-observer/11.0.1)、[DnD](https://registry.npmjs.org/@hello-pangea%2fdnd/18.0.1)、[Lightbox](https://registry.npmjs.org/yet-another-react-lightbox/3.33.1)、[Quill 包装器](https://registry.npmjs.org/react-quill-new/3.8.3)、[Quill 2 迁移指南](https://quilljs.com/docs/upgrading-to-2-0)。

保持不动：`mobx@6.16.1`、`mobx-react@9.2.2`、`mobx-react-lite@4.1.1`（绑定 peer 含 19）；沿用[项目 MobX 自查](MOBX6-MAINTENANCE.md)。`react-easy-crop@3.3.2`、`rmc-feedback@1.0.4`、`dom-lib@1.3.1`、`create-react-class@15.6.3` 分别验裁剪导出、长按、尺寸和 Calendar/Form；不因 19 顺带升级 `async-validator@1.12.2` 等无关包。
