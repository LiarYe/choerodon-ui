const less = require('less');

// Less 3.10.3 的 parser 状态存在共享；并发 render 可能污染选择器来源信息，
// 导致 sourceMap 输出阶段丢弃 CSS 文本。同一进程内的调用共用队列，直到 CSS 和 map 生成完成再执行下一项。
let queue = Promise.resolve();

// 继承 FileManager、logger 等 Less API，仅包装 render，不修改原始 less.render。
const implementation = Object.create(less);

implementation.render = function render(input, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = undefined;
  }
  const result = queue.then(() => less.render(input, options));
  // 调用方仍收到原始错误，但队列在失败后恢复，避免阻断后续编译。
  queue = result.then(() => undefined, () => undefined);
  // 同时保留 Less 的回调和 Promise 调用方式。
  if (callback) {
    result.then(output => callback(null, output), error => callback(error));
    return undefined;
  }
  return result;
};

module.exports = implementation;
