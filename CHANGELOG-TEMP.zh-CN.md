## 2026-10-26

- 将根目录发布构建升级至 Webpack 5，并更新相关 loader、CSS 提取与压缩配置。
- 将 BiSheng 文档站及 Webpack 4 依赖迁移到`site/legacy-build` 独立工具树，保留站点启动与 SSR 构建入口。
- 增加 Less 串行渲染队列，降低并发构建下 CSS 类名偶发丢失的风险，并保留 source map。
- 调整样式`sideEffects` 声明，避免打包时误删组件样式。
- 增加构建产物、安装流程与 legacy 依赖解析的回归检查。
- 兼容 Node 至 24.x，并优化 package.json 中 mobx react 依赖版本。
- 将 CircleCI Node 环境切换至 Node 18，并隔离旧 Node 版本依赖缓存。
