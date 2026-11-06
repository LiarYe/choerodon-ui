# MobX 4 → 6 改造与后续维护

本文件是本仓库 MobX 迁移的唯一长期说明。记录改造目标、当前实现、MobX API 差异、验证边界和后续维护要求；不保存逐轮调试流水账或本机临时产物。

## 改造范围

- 运行时从 MobX 4 迁移到 MobX 6，当前开发基线为 `mobx@6.16.1`、`mobx-react@9.2.2`、`mobx-react-lite@4.1.1`。
- 保留 React 16 与现有 Babel legacy decorators 构建路线。当前 React peer 范围是 `>=16.9.0 <17.0.0`；分支名称或绑定包版本不能作为 React 19 支持声明。
- 保持 DataSet、Record、Field、组件 props/context、表格、附件和发布入口的既有公开行为；重点处理初始化、继承描述符、响应性边界、引用身份、异步生命周期及多入口构建。
- 不通过全局关闭 `enforceActions`、`safeDescriptors` 或绑定包检查来掩盖迁移问题；不为了让测试变绿而跳过失败或批量更新快照。

## 当前实现

- DataSet/Record/Field、附件模型、配置、locale、validator 和组件层已按 MobX 6 显式初始化/注解适配。
- 每层声明 MobX 成员的类都需正确初始化。`declare` 仅提供类型，不会创建运行时属性；初始化不得清空父类已赋值状态。
- `ViewComponent` 以 `observable.ref` 桥接 React props/context，以 shallow observable 投影组件所需 props；更新时同步删除已移除字段。
- `observableConfig` 递归转换普通对象、数组、Map、Set，并保留 React element/portal、组件类型、已有 observable 和循环引用关系。它用于配置响应性与身份保真，不是通用克隆/序列化工具。
- `observableColumn` 对列配置中的 React renderer/editor/header 等叶子值保留身份，并处理嵌套 children。
- `useComputed` 使用本地 hook；调用方仍需提供正确的 React 依赖，MobX 不会跟踪普通闭包变量或 React props/context。
- ConfigProvider 更新与 DataSet 实例身份分离；依赖不变时更新配置读取，不因配置对象变化而丢弃用户编辑状态。
- PromiseMerger 和附件 Store 按请求组、loader 身份及存储作用域管理合并和缓存；清理排队/飞行调用者不代表底层 HTTP 自动取消，也没有为永久 pending 的 loader 新增超时。
- Pro 入口显式载入默认配置，并通过 package sideEffects 保留该副作用；源码测试 alias、CI 门禁和产物合同共同防止入口行为漂移。

## MobX 4 → 6 API 对照

| MobX 4 用法/假设 | MobX 6 对应行为 | 本项目维护要求 |
| --- | --- | --- |
| `@observable`、`@computed`、`@action` legacy 装饰器单独使用 | legacy 装饰器仍可用，但类需在构造中调用 `makeObservable(this)` 收集注解元数据 | 保持现有 legacy 路线；每个声明注解成员的类层次正确初始化 |
| `decorate(Class, annotations)` | 已移除；使用 `makeObservable(this, annotations)` | 检查父子类注解和构造顺序，不在同一继承链随意混用初始化风格 |
| 只声明类型字段或依赖旧字段初始化顺序 | MobX 6 需要运行时成员；描述符更严格，注解成员可能不可重定义 | `declare` 不可替代运行时属性；验证子类字段不会覆盖父类初始化 |
| 对继承类一律使用 `makeAutoObservable` | `makeAutoObservable` 不支持继承 | ViewComponent/FormField 等继承层次使用显式注解 |
| 重复装饰/覆盖父类 observable 字段或箭头 action | 可能触发 `Cannot redefine property`；实例字段不能像普通原型方法那样覆盖 | 不重复注解父类字段；原型 action/computed/flow 覆盖需按 MobX 6 `override` 规则处理 |
| `action.bound` 负责 action 且绑定实例 | 仍可用，绑定语义不可丢 | 作为回调传递的方法确认 `this` 绑定；不要只替换为 `action` |
| `runInAction(name, fn)` | v6 移除 name 首参数形式 | 用 `runInAction(fn)`；需要调试名时使用命名函数或 `action(name, fn)()` |
| `reaction` effect 第二参数为 disposer/reaction | v6 第二参数是 previousValue，reaction 对象在第三参数 | 检查 effect 参数位置；通过类型和行为测试确认 |
| `toJS(value, options)` | options 已移除；Map/Set 输出不再自动转成普通对象/数组 | 序列化按 DataSet/API 契约显式定义，不能仅删除 options 后假设结果相同 |
| `map.toPOJO()`、`map.toJS()`、`set.toJS()`、observable array `.toJS()` | 已移除；浅复制分别用 `new Map(map)`、`new Set(set)`、`.slice()` | 嵌套序列化单独实现；`mapToObject` 是浅值转换并安全保留特殊键 |
| `map.toJSON()` 返回 Map、`set.toJSON()` 返回 Set | Map JSON 形式为 entries 数组，Set 为数组 | 依赖 JSON 输出的调用方需显式核对外部格式 |
| 任意对象/函数放入 deep observable，假定引用不变 | deep enhancer 可能转换普通对象及函数行为 | React 节点、组件类型和回调需用 ref/shallow/专用配置 helper 保持身份 |
| 所有 observable array 都是原生数组 | 默认 Proxy 模式与 `useProxies: "never"` 模式的数组检测不同 | 使用有语义检查的 `isArrayLike`；第三方 API 需要原生数组时先复制 |
| 默认宽松写入/读取习惯 | v6 默认配置更严格，`enforceActions` 默认 `observed`；其它 reaction 诊断默认仍需显式开启 | 在正确动作/派生边界修复，不设置全局 `never`；逐步用测试诊断未跟踪访问 |
| 为测试覆盖描述符而 globally disable safety | `safeDescriptors` 默认 true，关闭会掩盖错误 | 不在库入口或全局测试配置关闭；针对测试隔离调整 mock 方式 |
| MobX reaction 生命周期等同组件生命周期 | reaction、autorun、timer、DOM listener 需显式 disposer | 建立/更新/卸载路径只保留一个 owner，dispose 幂等，阻止卸载后迟到写回 |

### 仍然有效但需遵守边界的 API

- `observable.box` 仍用 `.get()` / `.set()`；适合可观察地替换一个配置读取引用。
- `observable.ref` 观察引用替换，不递归转换内部值；`observable.shallow` 只观察容器，不递归转换元素；二者不是全局 deep observable 的机械替代。
- `computed` 只跟踪同步读取到的 observable；普通 React props/context 或闭包变量需要显式桥接/React deps。
- `autorun`、`reaction`、`when` 的追踪表达式及 computed 保持纯读取；副作用放在 effect、action 或明确生命周期中。
- async action 的事务不跨越 `await` 自动延续；await 后写 observable 时按正确边界使用 action、`runInAction` 或 `flow`。这不是 MobX 6 独有的异步原则。
- `configure({ useProxies })` 在 MobX 6 仍存在；不要把 MobX 7 移除此项的行为套用到本项目。非 Proxy 目标需要单独验证动态对象属性、数组及集合使用。
- 使用 MobX 公开 introspection API，不在业务逻辑中读取私有 administration 字段。

## 后续维护要求

1. 修改前梳理类继承链、每层字段初始化和 observer 包装；对原型覆盖、父类 observable 状态及实例方法分别设计。
2. 先为公开行为建立正式回归，再做最小修复。至少覆盖初始化、值更新、对象/配置替换与删除、上下文变化和卸载。
3. 区分三个问题：值是否响应、对象引用是否保留、异步结果归属哪个 owner；不能用全面 shallow/ref、深克隆或重建 DataSet 同时“解决”。
4. 异步流程覆盖 stale request、同步 throw、非 Error rejection、重试、卸载和 dispose；附件另覆盖 loader 优先级、公私有/存储坐标、受控零值及缓存更新。
5. 避免在 render/computed/reaction 表达式中写 observable、启动请求或持久化；表格/组件验证 render 与 commit 不发生重复副作用或更新循环。
6. 不对 observable 数组直接排序/反转来构造派生输出；先复制并验证原数组、Record 顺序和选择状态未变化。
7. 正式测试必须被 Git 跟踪且出现在干净克隆的同一测试清单中。源码 glob 会发现本机未跟踪文件，故门禁应同时核对预期 suite 数和必需测试是否 tracked，避免漏提交后静默变绿。
8. 源码门禁、TypeScript、转译链、继承扫描、定向 lint、构建/产物合同和真实交互分别报告；一个范围绿色不得扩大成全仓或发布通过。
9. 变更依赖时同步根 package/lock、站点 legacy-build 依赖和 peer 声明；在打包/消费者安装中检查 MobX 单实例、Pro 默认配置和副作用入口。
10. 快照失败先判定是公开行为回归、测试夹具、MobX 内部表示还是 React Fiber 遍历；不得整库 `-u`、静默删除行为断言或仅凭快照差异定性。
11. 临时复现脚本、历史源码副本、Jest cache、coverage、构建产物及原始日志放在仓库外或受忽略的临时区。只把稳定回归和简明验收结论提交；原始日志应由 CI 制品保存并记录 commit、环境、命令、退出码和摘要。
12. 发布前在干净克隆、固定 Node 环境中运行完整门禁，重新从最终源码构建 CJS/ESM/UMD，检查公开入口、sideEffects、依赖单例、消费者安装及目标浏览器交互；未做的 React 19、SSR、真实网络和长期性能验证明确列为未承诺。
13. Node 版本以仓库 CI、package 工具链和实际发布流程确认后统一；旧项目的 Node 14 历史记忆不能替代当前 TypeScript 5.9/ESLint 8 依赖基线的验证。

## 当前状态与验收口径

截至 2026-11-06，工作区已有记录显示源码门禁主体覆盖 aliases、dataset 和 manifest 组件测试共 75 个 suite、867 个断言通过；专项附件关联测试 7 个 suite、88 个断言通过；Form 原入口 5 个断言通过。上述是历史执行记录，不代表本文件创建时重跑。

该结果不是全仓测试通过：组件测试按 manifest 选择，存在历史快照/lint 债务；第四轮最终源码构建与产物合同、第四轮真实浏览器交互、干净消费者安装尚未完成。历史 Node 版本记录也不一致（CI Node 18、一次验收 Node 20、本终端 Node 14）；后续验收先固定环境并重新执行。

发布完成条件至少包括：正式测试已跟踪且干净克隆发现集合完整；最终源码门禁及编译检查通过；CJS/ESM/UMD 与站点产物合同通过；消费者依赖只有预期 MobX 实例；关键表格、配置切换及附件交互回归完成；所有未覆盖矩阵明确记录。

## 关键项目入口

- 依赖与 peer：`package.json`
- MobX 源码门禁：`scripts/test-mobx-source.js`、`tests/mobx-source-manifest.json`、`.jest.mobx-source.js`
- 类组件响应性桥接：`components-pro/core/ViewComponent.tsx`
- 配置响应性 helper：`components-dataset/mobx-helper/observableConfig.ts`
- Map 安全浅转换：`components-dataset/mobx-helper/mapToObject.ts`
- Proxy/非 Proxy 数组识别：`components-dataset/mobx-helper/isArrayLike.ts`
- 列配置身份保护：`components-pro/_util/observableColumn.ts`
- 附件请求合并：`components-dataset/promise-merger/index.tsx`
- 附件作用域缓存：`components-dataset/stores/AttachmentStore.tsx`
- Pro 默认配置入口：`index-pro.js`、`index-pro-with-locales.js`
- 发布产物合同：`tools/tests/dist-contract.test.js`

## 参考资料

- [MobX 官方：MobX 4/5 迁移到 6](https://mobx.js.org/migrating-from-4-or-5.html)
- [MobX 官方：类继承限制](https://mobx.js.org/subclassing.html)
- [MobX 官方：运行时配置](https://mobx.js.org/configuration.html)
- [MobX 6.16.1 CHANGELOG](https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/CHANGELOG.md)
