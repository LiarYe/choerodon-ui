class BuildErrorPlugin {
  apply(compiler) {
    compiler.hooks.failed.tap('SiteBuildErrorPlugin', error => {
      console.error(error);
      process.exit(1);
    });
    compiler.hooks.done.tap('SiteBuildErrorPlugin', stats => {
      if (stats.hasErrors()) {
        console.error(stats.toString('errors-only'));
        process.exit(1);
      }
    });
  }
}

module.exports = BuildErrorPlugin;
