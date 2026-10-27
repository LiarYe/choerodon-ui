function opensslEnv(environment = process.env, nodeVersion = process.versions.node) {
  const env = { ...environment };
  if (Number(nodeVersion.split('.')[0]) >= 17
    && !(env.NODE_OPTIONS || '').includes('--openssl-legacy-provider')) {
    env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --openssl-legacy-provider`.trim();
  }
  return env;
}

module.exports = opensslEnv;
