const path = require('path');
const { spawnSync, spawn } = require('child_process');
const legacy = require('./resolve');
const opensslEnv = require('./opensslEnv');

const [command = 'start', ...args] = process.argv.slice(2);

if (!['start', 'build'].includes(command)) {
  throw new Error('Usage: node site/legacy-build/start.js [start|build] [BiSheng options]');
}

process.chdir(legacy.root);

const env = opensslEnv({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || (command === 'start' ? 'development' : 'production'),
  BISHENG_COMMAND: command,
}, process.versions.node);

const cli = legacy.resolve(`bisheng/bin/bisheng-${command}`);
legacy.load('rimraf').sync(path.join(legacy.root, '_site'));

const result = spawnSync(process.execPath, [path.join(legacy.root, 'scripts/generateColorLess.js')], {
  cwd: legacy.root,
  env,
  stdio: 'inherit',
});
if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status || 1);
}

const child = spawn(process.execPath, [cli, '-c', './site/bisheng.config.js', ...args], {
  cwd: legacy.root,
  env,
  stdio: 'inherit',
});

child.on('error', error => {
  console.error(error);
  process.exitCode = 1;
});

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => child.kill(signal));
});

child.on('exit', code => {
  process.exitCode = code === null ? 1 : code;
});
