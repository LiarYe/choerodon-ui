#!/usr/bin/env node

const { spawn } = require('child_process');

const [, , command, ...args] = process.argv;
const env = { ...process.env };
const nodeMajor = Number(process.versions.node.split('.')[0]);

if (nodeMajor >= 17 && !env.NODE_OPTIONS?.includes('--openssl-legacy-provider')) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --openssl-legacy-provider`.trim();
}

const child = spawn(command, args, {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code === null ? 1 : code);
  }
});
