const merge2 = require('merge2');
const { execSync } = require('child_process');
const through2 = require('through2');
const webpack = require('webpack');
const babel = require('gulp-babel');
const argv = require('minimist')(process.argv.slice(2));
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// gulp-typescript 依赖 source-map, source-map@0.7.3 会将 Node 18+ 的全局 fetch 误判为浏览器环境;
// source-map 判断环境主要发生在模块加载阶段;
// 加载 gulp-typescript 前隐藏 fetch, source-map 正确识别为 Node 环境, 加载完成后恢复 fetch;
const globalFetch = global.fetch;
if (globalFetch) {
  delete global.fetch;
}
const ts = require('gulp-typescript');
if (globalFetch) {
  global.fetch = globalFetch;
}

const gulp = require('gulp');
const rimraf = require('rimraf');
const stripCode = require('gulp-strip-code');
const sourcemaps = require('gulp-sourcemaps');
const runCmd = require('./tools/runCmd');
const getBabelCommonConfig = require('./tools/getBabelCommonConfig');
const transformLess = require('./tools/transformLess');
const getNpmArgs = require('./tools/utils/get-npm-args');
const { cssInjection } = require('./tools/utils/styleUtil');
const tsConfig = require('./tools/getTSCommonConfig')();
const replaceLib = require('./tools/replaceLib');

const tsDefaultReporter = ts.reporter.defaultReporter();
const cwd = process.cwd();
const libDir = path.join(cwd, 'lib');
const esDir = path.join(cwd, 'es');
const libRcDir = path.join(cwd, 'lib', 'rc-components');
const esRcDir = path.join(cwd, 'es', 'rc-components');
const libProDir = path.join(cwd, 'pro', 'lib');
const esProDir = path.join(cwd, 'pro', 'es');
const datasetDir = path.join(cwd, 'dataset');
const datasetAxiosHelpersDir = path.join(cwd, 'dataset', 'axios', '_helpers');
const sharedDir = path.join(cwd, 'shared');

const packageJson = require(`${cwd}/package.json`);

const libName = `${packageJson.name}/lib`;
const proName = `${packageJson.name}/pro/lib`;
const lessLibName = /(\.\.\/)+components/g;

function dist(done) {
  const previousRunEnv = process.env.RUN_ENV;
  process.env.RUN_ENV = 'PRODUCTION';
  let compiler;
  let setupError;
  try {
    const configPath = require.resolve(path.join(cwd, 'webpack.config.js'));
    delete require.cache[configPath];
    const webpackConfig = require(configPath);
    compiler = webpack(webpackConfig);
  } catch (error) {
    setupError = error;
  } finally {
    if (previousRunEnv === undefined) {
      delete process.env.RUN_ENV;
    } else {
      process.env.RUN_ENV = previousRunEnv;
    }
  }
  if (setupError) {
    done(setupError);
    return;
  }
  try {
    rimraf.sync(path.join(cwd, 'dist'));
  } catch (error) {
    compiler.close(() => done(error));
    return;
  }
  compiler.run((err, stats) => {
    if (err) {
      console.error(err.stack || err);
      if (err.details) {
        console.error(err.details);
      }
      compiler.close(() => done(err));
      return;
    }

    const info = stats.toJson({ all: false, errors: true, warnings: true });

    if (stats.hasErrors()) {
      console.error(info.errors);
    }

    if (stats.hasWarnings()) {
      console.warn(info.warnings);
    }

    const buildInfo = stats.toString({
      colors: true,
      children: true,
      chunks: false,
      modules: false,
      chunkModules: false,
      hash: false,
      version: false,
    });
    console.log(buildInfo);
    const buildError = stats.hasErrors() ? new Error('Webpack dist compilation failed') : undefined;
    compiler.close(closeError => done(buildError || closeError));
  });
}

function tag() {
  console.log('tagging');
  const { version } = packageJson;
  execSync(`git tag v${version}`);
  execSync(`git push origin ${version}:${version}`);
  execSync('git push origin master:master');
  console.log('tagged');
}

function pipeStreams(...streams) {
  return streams.reduce((source, destination) => {
    let ended = false;
    let finished = false;
    source.once('end', () => {
      ended = true;
    });
    destination.once('finish', () => {
      finished = true;
    });
    source.on('error', error => destination.destroy(error));
    source.once('close', () => {
      if (!ended && !destination.destroyed) {
        destination.destroy(new Error('Stream closed before completion'));
      }
    });
    destination.once('close', () => {
      if (!finished) {
        source.destroy();
      }
    });
    return source.pipe(destination);
  });
}

function runCompile(stream, destination, done) {
  let completed = false;
  function complete(error) {
    if (!completed) {
      completed = true;
      done(error);
    }
  }
  destination.once('error', complete);
  destination.once('finish', () => complete());
  destination.once('close', () => complete(new Error('Stream closed before completion')));
  pipeStreams(stream, destination).resume();
}

function cleanCompileDirs(done) {
  try {
    [esDir, libDir, esProDir, libProDir, datasetDir, sharedDir].forEach(dir => {
      rimraf.sync(dir);
    });
    done();
  } catch (error) {
    done(error);
  }
}

function compileTypescript(source, modules, streams = []) {
  let hasDiagnostics = false;
  const tsResult = ts(tsConfig, {
    error(error, typescript) {
      hasDiagnostics = true;
      tsDefaultReporter.error(error, typescript);
    },
    finish: tsDefaultReporter.finish,
  });
  const auxiliaryStreams = streams.map(stream => pipeStreams(stream, through2.obj()));
  const js = babelify(tsResult.js, modules);
  const inputs = [...auxiliaryStreams, js, tsResult.dts];
  const output = merge2(inputs, { pipeError: true });
  function cancel() {
    [tsResult, tsResult.js, tsResult.dts, ...streams, ...inputs].forEach(stream => {
      if (!stream.destroyed) {
        stream.destroy();
      }
    });
  }
  output.on('error', error => output.destroy(error));
  output.once('error', cancel);
  output.once('close', cancel);
  [tsResult, ...inputs].forEach(stream => {
    let ended = false;
    stream.once('end', () => {
      ended = true;
    });
    stream.once('close', () => {
      if (!ended && !output.destroyed) {
        output.destroy(new Error('Stream closed before completion'));
      }
    });
  });
  tsResult.on('error', error => {
    if (
      argv['ignore-error'] &&
      hasDiagnostics &&
      error.message === 'TypeScript: Compilation failed'
    ) {
      return;
    }
    output.destroy(error);
  });
  pipeStreams(gulp.src(source), tsResult);
  tsResult.resume();
  return output;
}

function babelify(js, modules) {
  const babelConfig = getBabelCommonConfig(modules);
  if (modules === false) {
    babelConfig.plugins.push(replaceLib);
  }
  let stream = pipeStreams(
    js,
    sourcemaps.init(),
    babel(babelConfig),
    through2.obj(function z(file, encoding, next) {
      this.push(file.clone());
      if (file.path.match(/[/\\]style[/\\]index\.js/)) {
        const content = file.contents.toString(encoding);
        file.contents = Buffer.from(cssInjection(content));
        file.path = file.path.replace(/index\.js/, 'css.js');
        this.push(file);
        next();
      } else {
        next();
      }
    }),
    sourcemaps.write('.'),
  );
  if (modules === false) {
    stream = pipeStreams(
      stream,
      stripCode({
        start_comment: '@remove-on-es-build-begin',
        end_comment: '@remove-on-es-build-end',
      }),
    );
  }
  return stream;
}

function compileRc(modules) {
  const source = ['components/rc-components/**/*.jsx', 'components/rc-components/**/*.js'];
  return babelify(gulp.src(source), modules);
}

function compileShared() {
  const source = ['components-shared/**/*.tsx', 'components-shared/**/*.ts', 'typings/**/*.d.ts'];
  return compileTypescript(source);
}

function compileDataset() {
  const source = ['components-dataset/**/*.tsx', 'components-dataset/**/*.ts', 'typings/**/*.d.ts'];
  return compileTypescript(source);
}

function compilePro(modules) {
  const dir = modules === false ? 'es' : 'lib';
  const less = pipeStreams(
    gulp.src(['components-pro/**/*.less']),
    through2.obj(function (file, encoding, next) {
      const content = file.contents.toString(encoding);
      if (content.match(lessLibName)) {
        file.contents = Buffer.from(
          content.replace(
            lessLibName,
            path.relative(file.path, path.join(cwd, dir)).replace(/\\/g, '/'),
          ),
        );
      }
      this.push(file.clone());
      if (
        file.path.match(/[/\\]style[/\\]index\.less$/) ||
        file.path.match(/[/\\]style[/\\]v2-compatible-reset\.less$/)
      ) {
        transformLess(file.path)
          .then(css => {
            file.contents = Buffer.from(css);
            file.path = file.path.replace(/\.less$/, '.css');
            this.push(file);
            next();
          })
          .catch(next);
      } else {
        next();
      }
    }),
  );
  const assets = gulp.src(['components-pro/**/*.@(png|svg)'], { encoding: false });
  const source = ['components-pro/**/*.tsx', 'components-pro/**/*.ts', 'typings/**/*.d.ts'];
  return compileTypescript(source, modules, [less, assets]);
}

function compile(modules) {
  const less = pipeStreams(
    gulp.src(['components/**/*.less']),
    through2.obj(function (file, encoding, next) {
      this.push(file.clone());
      if (
        file.path.match(/[/\\]style[/\\]index\.less$/) ||
        file.path.match(/[/\\]style[/\\]v2-compatible-reset\.less$/)
      ) {
        transformLess(file.path)
          .then(css => {
            file.contents = Buffer.from(css);
            file.path = file.path.replace(/\.less$/, '.css');
            this.push(file);
            next();
          })
          .catch(next);
      } else {
        next();
      }
    }),
  );
  const assets = gulp.src(['components/**/*.@(png|svg)'], { encoding: false });
  const source = ['components/**/*.tsx', 'components/**/*.ts', 'typings/**/*.d.ts'];
  return compileTypescript(source, modules, [less, assets]);
}

function publish(tagString, done) {
  let args = ['publish', '--with-tools', '--access=public'];
  if (tagString) {
    args = args.concat(['--tag', tagString]);
  }
  const publishNpm = process.env.PUBLISH_NPM_CLI || 'npm';
  runCmd(publishNpm, args, code => {
    if (!argv['skip-tag']) {
      tag();
    }
    done(code);
  });
}

function pub(done) {
  dist(code => {
    if (code) {
      done(code);
      return;
    }
    const notOk = !packageJson.version.match(/^\d+\.\d+\.\d+$/);
    let tagString;
    if (argv['npm-tag']) {
      tagString = argv['npm-tag'];
    }
    if (!tagString && notOk) {
      tagString = 'next';
    }
    if (packageJson.scripts['pre-publish']) {
      runCmd('npm', ['run', 'pre-publish'], code2 => {
        if (code2) {
          done(code2);
          return;
        }
        publish(tagString, done);
      });
    } else {
      publish(tagString, done);
    }
  });
}

function changePath(dir, name, isPro) {
  return through2.obj(function (file, encoding, next) {
    const matches = file.path.match(/\.d\.ts|\.js/);
    if (matches) {
      const content = file.contents.toString(encoding);
      if (content.match(name)) {
        const replaceText = path.relative(file.path, dir).replace(/\\/g, '/');
        file.contents = Buffer.from(
          content.replace(
            new RegExp(name, 'g'),
            isPro ? replaceText.replace('../', '') : replaceText,
          ),
        );
      }
    }
    this.push(file);
    next();
  });
}

gulp.task(
  'check-git',
  gulp.series(done => {
    runCmd('git', ['status', '--porcelain'], (code, result) => {
      if (/^\?\?/m.test(result)) {
        return done(`There are untracked files in the working tree.\n${result}
      `);
      }
      if (/^([ADRM]| [ADRM])/m.test(result)) {
        return done(`There are uncommitted changes in the working tree.\n${result}
      `);
      }
      return done();
    });
  }),
);

gulp.task('clean', done => {
  rimraf.sync(path.join(cwd, '_site'));
  done();
});

gulp.task(
  'dist',
  gulp.series(done => {
    dist(done);
  }),
);

gulp.task('compile-with-es', done => {
  rimraf.sync(esDir);
  runCompile(pipeStreams(compile(false), changePath(esProDir, proName, true)), gulp.dest(esDir), done);
});

gulp.task('compile-with-lib', done => {
  rimraf.sync(libDir);
  runCompile(pipeStreams(compile(), changePath(libProDir, proName, true)), gulp.dest(libDir), done);
});

gulp.task('compile-with-pro-es', done => {
  rimraf.sync(esProDir);
  runCompile(pipeStreams(compilePro(false), changePath(esDir, libName)), gulp.dest(esProDir), done);
});

gulp.task('compile-with-pro-lib', done => {
  rimraf.sync(libProDir);
  runCompile(pipeStreams(compilePro(), changePath(libDir, libName)), gulp.dest(libProDir), done);
});

gulp.task('compile-with-dataset-compile', done => {
  rimraf.sync(datasetDir);
  runCompile(compileDataset(), gulp.dest(datasetDir), done);
});
gulp.task('compile-with-dataset-move-js', done => {
  runCompile(gulp.src(['components-dataset/axios/_helpers/*.js']), gulp.dest(datasetAxiosHelpersDir), done);
});
gulp.task('compile-with-dataset', gulp.series('compile-with-dataset-compile', 'compile-with-dataset-move-js'));

gulp.task('compile-with-shared', done => {
  rimraf.sync(sharedDir);
  runCompile(compileShared(), gulp.dest(sharedDir), done);
});

gulp.task('compile-with-rc-es', done => {
  runCompile(pipeStreams(compileRc(false), changePath(esProDir, proName, true)), gulp.dest(esRcDir), done);
});

gulp.task('compile-with-rc-lib', done => {
  runCompile(pipeStreams(compileRc(), changePath(libProDir, proName, true)), gulp.dest(libRcDir), done);
});

function checkCompileEntries(done) {
  const entries = ['main', 'module', 'main-pro', 'module-pro'];
  const missing = entries
    .map(entry => packageJson[entry])
    .filter(entry => {
      const filename = path.join(cwd, entry);
      return !fs.existsSync(filename) || fs.statSync(filename).size === 0;
    });
  done(missing.length ? new Error(`Missing or empty compile entries: ${missing.join(', ')}`) : undefined);
}

gulp.task(
  'compile',
  gulp.series(
    cleanCompileDirs,
    gulp.parallel(
      'compile-with-es',
      'compile-with-lib',
      'compile-with-pro-es',
      'compile-with-pro-lib',
      'compile-with-dataset',
      'compile-with-shared',
    ),
    gulp.parallel('compile-with-rc-es', 'compile-with-rc-lib'),
    checkCompileEntries,
  ),
);

gulp.task('pub', gulp.series('check-git', 'compile', pub));

gulp.task(
  'guard',
  gulp.series(done => {
    function reportError() {
      console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
      console.log(chalk.bgRed('!! `npm publish` is forbidden for this package. !!'));
      console.log(chalk.bgRed('!! Use `npm run pub` instead.        !!'));
      console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
    }

    const npmArgs = getNpmArgs();
    if (npmArgs) {
      for (let arg = npmArgs.shift(); arg; arg = npmArgs.shift()) {
        if (/^pu(b(l(i(sh?)?)?)?)?$/.test(arg) && npmArgs.indexOf('--with-tools') < 0) {
          reportError();
          done(1);
          return;
        }
      }
    }
    done();
  }),
);
