// PowerShell, from the repo root (requires installed Edge and running preview servers):
// npm install --prefix "$env:TEMP\b5-driver" --no-save --no-package-lock playwright-core@1.55.0
// $env:NODE_PATH="$env:TEMP\b5-driver\node_modules"
// node tests-react19/preview-b5.cjs http://localhost:4291 http://localhost:4292
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

async function check(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => { console.error(url, error); process.exitCode = 1; });
  await page.goto(new URL('/#/b5', url).href);
  const tree = page.locator('#b5 .c7n-tree-list-holder');
  const menu = page.locator('#b5 .rc-virtual-list-holder');
  async function measure(holder) {
    return holder.evaluate(el => {
      const rows = [...el.querySelector('[class$="-holder-inner"]').children];
      const viewportTop = el.getBoundingClientRect().top + el.clientTop;
      const last = rows.at(-1).getBoundingClientRect();
      const lastInView = last.height > 0 && last.top >= Math.max(viewportTop, 0) - 0.5 &&
        last.bottom <= Math.min(viewportTop + el.clientHeight, window.innerHeight) + 0.5;
      return { height: el.clientHeight, rows: rows.length, rowHeight: rows[0].getBoundingClientRect().height,
        lastY: [last.top - viewportTop, last.bottom - viewportTop], lastInView,
        first: rows[0].textContent.trim(), last: rows.at(-1).textContent.trim(), top: el.scrollTop };
    });
  }
  async function snapshot(stage) {
    const values = await Promise.all([measure(tree), measure(menu)]);
    process.stdout.write(`${stage} ${JSON.stringify(values)}\n`);
    for (const v of values) assert(v.rows > 0 && v.rows < 200 && v.rowHeight > 0);
    return values;
  }
  await menu.getByText('菜单 1', { exact: true }).waitFor();
  process.stdout.write(`${await page.getByText(/React 运行版本/).innerText()}\n`);
  const small = await snapshot('初始');
  await page.getByRole('button', { name: /切换高度/ }).click();
  const large = await snapshot('增高');
  large.forEach((v, i) => assert(small[i].height === 120 && v.height === 240 && v.rows > small[i].rows));
  await page.getByRole('button', { name: '远端' }).click();
  const last = menu.locator('[data-menu-key="200"]');
  await Promise.all([last.waitFor(), tree.getByText('节点 200', { exact: true }).waitFor()]);
  const far = await snapshot('远端');
  far.forEach((v, i) => assert(v.top > 0 && v.last === ['节点 200', '菜单 200'][i] && v.lastInView,
    `${v.last}: 末行边界 ${v.lastY}，视口高度 ${v.height}`));
  await page.getByRole('button', { name: '返回首行' }).click();
  await Promise.all([tree.getByText('长树').waitFor(), menu.getByText('菜单 1', { exact: true }).waitFor()]);
  const back = await snapshot('返回');
  back.forEach((v, i) => assert(v.top === 0 && v.first === small[i].first));
  await page.getByRole('button', { name: '远端' }).click();
  await last.hover();
  await page.mouse.down();
  const circle = last.locator('.c7n-ripple');
  await circle.waitFor({ state: 'visible' });
  await page.mouse.up();
  await circle.waitFor({ state: 'hidden' });
  await menu.locator('.c7n-menu-item-selected[data-menu-key="200"]').waitFor();
  const selected = await page.locator('#b5 output').innerText();
  process.stdout.write(`${selected}\n`);
  assert.equal(selected, '菜单选中：200');
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const urls = process.argv.length > 2 ? process.argv.slice(2) : ['http://localhost:4191'];
    await urls.reduce(async (previous, url) => {
      await previous;
      try { await check(browser, url); } catch (error) { console.error(url, error); process.exitCode = 1; }
    }, Promise.resolve());
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
