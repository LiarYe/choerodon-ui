const http = require('node:http');
const path = require('node:path');
const webpack = require('webpack');
const middleware = require('webpack-dev-middleware');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const less = require('../tools/lessImplementation');

const root = path.resolve(__dirname, '..');
const legacy = process.argv.includes('--react16');
const local = name => path.dirname(require.resolve(`${name}/package.json`, { paths: [legacy ? root : __dirname] }));
const source = name => path.join(root, name);
const compiler = webpack({
  context: __dirname,
  mode: 'development',
  // Direct component imports need the library's UI defaults before the first render.
  entry: ['./preview/index.html', source('components/configure/index.tsx'), legacy && process.argv.includes('--b7') ? './preview/b7.jsx' : './preview/main.tsx'],
  output: { path: path.join(__dirname, 'dist'), publicPath: '/', filename: 'preview.js' },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      ...(legacy && { 'react-dom/client$': path.join(__dirname, 'preview/client16.js') }),
      react: local('react'),
      'react-dom': local('react-dom'),
      'choerodon-ui$': source('components'),
      'choerodon-ui/lib': source('components'),
      'choerodon-ui/es': source('components'),
      'choerodon-ui/pro$': source('components-pro'),
      'choerodon-ui/pro/lib': source('components-pro'),
      'choerodon-ui/pro/es': source('components-pro'),
      'choerodon-ui/dataset': source('components-dataset'),
      'choerodon-ui/shared': source('components-shared'),
    },
  },
  module: { rules: [
    { test: /\.tsx?$/, exclude: /node_modules/, loader: require.resolve('ts-loader'), options: {
      configFile: source('tsconfig.json'), transpileOnly: true,
      compilerOptions: { target: 'ES2019', jsx: 'react-jsx', useDefineForClassFields: false },
    } },
    { test: /\.jsx?$/, exclude: /node_modules/, loader: require.resolve('babel-loader'), options: {
      babelrc: false, configFile: false, presets: [require.resolve('@babel/preset-react')],
    } },
    { test: /\.(less|css)$/, use: [MiniCssExtractPlugin.loader, require.resolve('css-loader')] },
    { test: /\.less$/, loader: require.resolve('less-loader'), options: {
      implementation: less, lessOptions: { javascriptEnabled: true },
    } },
    { test: /\.(woff2?|ttf|eot|svg|png|gif|jpe?g)$/i, type: 'asset/resource' },
    { test: /\.html$/, type: 'asset/resource', generator: { filename: '[name][ext]' } },
  ] },
  plugins: [new MiniCssExtractPlugin({ filename: 'preview.css' })],
  stats: 'errors-warnings',
});

// Check the compiled graph, including dependencies imported from outside tests-react19.
compiler.hooks.afterCompile.tap('React19Resolution', compilation => {
  const seen = new Set();
  for (const { resource } of compilation.modules) {
    const match = resource && resource.match(/[\\/]node_modules[\\/](react(?:-dom)?)[\\/]/);
    if (!match) continue;
    if (!resource.startsWith(local(match[1]) + path.sep)) {
      compilation.errors.push(new Error(`Unexpected React module: ${resource}`));
    }
    seen.add(match[1]);
  }
  for (const pkg of ['react', 'react-dom']) {
    if (!seen.has(pkg)) compilation.errors.push(new Error(`Missing preview dependency: ${pkg}`));
  }
});

if (process.argv.includes('--build')) {
  compiler.run((error, stats) => {
    console.log(error || stats.toString('errors-warnings'));
    compiler.close(() => { process.exitCode = error || stats.hasErrors() ? 1 : 0; });
  });
} else {
  const port = Number(process.env.PREVIEW_PORT || 4191);
  const serve = middleware(compiler);
  http.createServer((req, res) => serve(req, res, () => {
    res.writeHead(404).end();
  })).listen(port, 'localhost', () => console.log(`React ${legacy ? 16 : 19} preview: http://localhost:${port}/`));
}
