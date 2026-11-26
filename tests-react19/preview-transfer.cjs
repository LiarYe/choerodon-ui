// Start npm --prefix tests-react19 run preview. For Edge / NODE_PATH setup see preview-b5.cjs.
// node tests-react19/preview-transfer.cjs [http://localhost:4191]
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error); });
    await page.goto(process.argv[2] || 'http://localhost:4191');
    const nav = page.getByRole('navigation');
    const links = await nav.getByRole('link').evaluateAll(nodes => nodes.map(el => el.hash));
    for (const hash of ['#/b5', '#/b6', '#/components/menu', '#/components/avatar', '#/components/icon']) {
      assert(links.includes(hash), `Missing ${hash}`);
    }
    await nav.getByRole('link', { name: 'Transfer 穿梭框' }).click();
    assert.equal(new URL(page.url()).hash, '#/components/transfer');
    const demo = page.locator('#transfer-demo');
    const lists = demo.locator('.c7n-transfer-list');
    const left = lists.first();
    const right = lists.last();
    const search = left.getByRole('textbox');
    const row = (list, n) => list.getByText(`行 ${n}`, { exact: true });
    await search.fill('行 119');
    await row(left, 119).waitFor();
    assert.equal(await left.locator('li').count(), 1);
    await left.locator('a.c7n-transfer-list-search-action').click();
    await row(left, 1).waitFor();
    assert.equal(await search.inputValue(), '');
    await row(left, 1).click();
    const checked = left.locator('li').filter({ has: row(page, 1) }).getByRole('checkbox');
    assert(await checked.isChecked());
    const content = left.locator('.c7n-transfer-list-content');
    await content.hover();
    await page.mouse.wheel(0, 1120);
    await row(left, 38).waitFor();
    assert(await content.evaluate(el => el.scrollTop > el.clientHeight));
    await page.mouse.wheel(0, -1120);
    await page.waitForFunction(el => el.scrollTop === 0, await content.elementHandle());
    assert(await checked.isChecked());
    await demo.getByRole('button', { name: /右移/ }).click();
    await row(right, 1).waitFor();
    await row(left, 1).waitFor({ state: 'detached' });
    await row(right, 1).click();
    await demo.getByRole('button', { name: /左移/ }).click();
    try {
      await row(left, 1).waitFor();
    } catch (error) {
      console.error('After moving left:', await lists.evaluateAll(nodes => nodes.map(el => ({
        heading: el.querySelector('.c7n-transfer-list-header')?.textContent,
        firstRow: el.querySelector('li')?.textContent,
        scrollTop: el.querySelector('.c7n-transfer-list-content')?.scrollTop,
      }))));
      throw error;
    }
    await row(right, 1).waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    console.log(`Edge ${browser.version()}: default preview Transfer interactions passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
