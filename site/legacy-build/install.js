const path = require('path');
const { spawnSync } = require('child_process');

if (process.env.C7N_LEGACY_INSTALL_ACTIVE !== '1') {
  if (!process.env.npm_execpath) {
    throw new Error('Run npm run install:legacy from the repository root.');
  }
  const result = spawnSync(process.execPath, [
    process.env.npm_execpath,
    'ci',
    '--prefix',
    __dirname,
    '--legacy-peer-deps',
    '--no-audit',
    '--no-fund',
  ], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, C7N_LEGACY_INSTALL_ACTIVE: '1' },
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status === null ? 1 : result.status;
} else {
  process.stdout.write('Legacy dependency installation already active; avoiding recursive installation.\n');
}
