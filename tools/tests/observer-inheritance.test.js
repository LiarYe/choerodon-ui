const assert = require('assert');
const path = require('path');
const glob = require('glob');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const files = glob.sync('{components,components-pro,components-dataset,components-shared}/**/*.{ts,tsx}', {
  cwd: root,
  absolute: true,
  ignore: ['**/*.d.ts'],
});
const program = ts.createProgram(files, {
  experimentalDecorators: true,
  jsx: ts.JsxEmit.React,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  baseUrl: root,
  paths: {
    'choerodon-ui/lib/*': ['components/*'],
    'choerodon-ui/pro/lib/*': ['components-pro/*'],
    'choerodon-ui/dataset/*': ['components-dataset/*'],
  },
});
const checker = program.getTypeChecker();
const violations = [];
let inheritanceCount = 0;

function isObserver(node) {
  return (ts.getDecorators(node) || []).some(decorator => decorator.expression.getText() === 'observer');
}

function getBase(node) {
  const clause = (node.heritageClauses || []).find(item => item.token === ts.SyntaxKind.ExtendsKeyword);
  if (!clause) return undefined;
  const type = checker.getTypeAtLocation(clause.types[0]);
  return type.symbol && (type.symbol.declarations || []).find(ts.isClassDeclaration);
}

files.forEach(filename => {
  const source = program.getSourceFile(filename);
  function visit(node) {
    if (ts.isClassDeclaration(node)) {
      let base = getBase(node);
      if (base) inheritanceCount += 1;
      const seen = new Set();
      while (isObserver(node) && base && !seen.has(base)) {
        seen.add(base);
        if (isObserver(base)) {
          violations.push(`${path.relative(root, filename)}: ${node.name.text} extends observed ${base.name.text}`);
        }
        base = getBase(base);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
});

assert(inheritanceCount > 50, 'Expected to resolve repository inheritance chains');
assert.deepStrictEqual(violations, []);
process.stdout.write(`PASS observer inheritance: ${files.length} source files, ${inheritanceCount} resolved inheritance chains\n`);
