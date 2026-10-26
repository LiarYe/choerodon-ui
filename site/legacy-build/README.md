# BiSheng 独立构建环境

这里安装站点专用的 BiSheng 1.4.6、webpack 4.47.0、Babel 7、Less 3 和 PostCSS 7，不修改根目录的依赖声明。入口执行时始终将 cwd 设为仓库根目录，Markdown source、组件别名和 `_site` 输出路径保持根目录语义。

## 安装

根目录安装依赖时，`postinstall` 会自动执行独立工具树的 `npm ci`。发布包不包含站点目录，安装钩子会安全跳过。已用 `--ignore-scripts` 准备根 `node_modules` 或需要重新安装站点依赖时，在仓库根目录执行：

```powershell
npm run install:legacy
```

安装入口向子进程传递 `C7N_LEGACY_INSTALL_ACTIVE=1`，避免本地 `choerodon-ui` 链接触发根安装钩子后递归安装。通过 npm 运行入口，以提供 `npm_execpath`。更新子项目依赖时使用 `npm install --prefix site/legacy-build --legacy-peer-deps --ignore-scripts`，同时保留子目录的 `package-lock.json`。`--legacy-peer-deps` 用于兼容旧插件的 peer 声明，仅作用于这次子项目安装。不要使用 `npm audit fix --force` 自动升级这套 webpack 4 工具链。

## 启动与构建

在仓库根目录执行：

```powershell
node site/legacy-build/start.js
node site/legacy-build/start.js build --ssr
node site/legacy-build/check.js
```

也可以执行 `npm --prefix site/legacy-build start` 和 `npm --prefix site/legacy-build run build`，入口会自动恢复根 cwd。开发地址为 `http://localhost:8899/`。启动和构建都会清理 `_site`；开发启动先生成 `_site/color.less`。可通过环境变量 `NODE_ENV`、`BROWSER` 控制原有行为，例如设置 `BROWSER=none` 关闭自动打开浏览器。

Node 17 及以上会自动为子进程补充 `--openssl-legacy-provider`，保留已有 `NODE_OPTIONS`。实际验证环境为 Node 20；无需为了启动而降级 Node。

## 解析边界

配置、主题插件、示例 Babel 配置和颜色生成器均通过 `resolve.js` 加载子目录工具。直接依赖缺失时抛出安装提示，不静默退回根工具版本。webpack 的 loader 优先从子目录加载，并兼容旧插件使用的 `babel!` 内联 loader。

应用模块优先从根 `node_modules` 解析，React、ReactDOM、MobX、mobx-react 显式绑定根版本，防止独立工具树引入多份运行时。Webpack 及其 HMR 模块固定从独立工具树解析，避免 dev-server 的相对请求回到根 Webpack。主题插件使用绝对目录，并保留查询参数，以适配 BiSheng 在根 cwd 下的 Node 和浏览器双端解析。

根 `package.json` 的 `start`、`site` 等命令已接入本目录的 `start.js`，不再调用根 BiSheng CLI。不要在根目录使用裸 `bisheng` 或 `npx bisheng` 替代它。
