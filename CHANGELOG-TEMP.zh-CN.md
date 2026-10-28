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
