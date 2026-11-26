// Start preview.cjs --p1-transfer on both ports (add --react16 on the first).
// Use the playwright-core NODE_PATH from preview-b5.cjs, then run:
// node tests-react19/preview-p1-transfer.cjs http://localhost:4391 http://localhost:4392
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright-core');

async function check(browser, url, major) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  try {
    await page.goto(url);
    const react = await page.locator('output').innerText();
    const observer = require(path.resolve(__dirname, major === 16 ? '..' : '.', 'node_modules/react-intersection-observer/package.json')).version;
    assert.equal(parseInt(react, 10), major);
    assert.equal(parseInt(observer, 10), major === 16 ? 8 : 11);
    const content = id => page.locator(`#${id} .c7n-transfer-list-content`).first();
    const list = content('near');
    const far = content('far');
    const index = 40;
    const row = list.locator(':scope > .LazyLoad').nth(index);
    const first = list.locator('input[type=checkbox]').first();
    const snapshot = () => list.evaluate((el, i) => {
      const wrapper = el.children[i];
      const rect = wrapper.getBoundingClientRect();
      return { top: el.scrollTop, pageY: scrollY, gap: rect.top - el.getBoundingClientRect().top - el.clientTop - el.clientHeight,
        rowHeight: rect.height, rowWidth: rect.width, step: el.children[i + 1].getBoundingClientRect().top - rect.top,
        viewport: el.clientHeight, scrollHeight: el.scrollHeight, mounted: el.querySelectorAll('li').length,
        empty: !wrapper.hasChildNodes(), wrappers: el.children.length };
    }, index);
    await first.waitFor({ state: 'attached' });
    await list.getByText('行 1', { exact: true }).click();
    assert(await first.isChecked());
    const initial = await snapshot();
    assert(initial.empty && initial.gap > 501 && initial.pageY === 0 && initial.top === 0);
    assert.equal(initial.wrappers, 120);
    assert.equal(initial.rowHeight, 32);
    assert.equal(initial.step, initial.rowHeight);
    assert.equal(initial.rowWidth, await list.locator('li').first().evaluate(el => el.getBoundingClientRect().width));
    const farGap = await far.evaluate(el => el.getBoundingClientRect().top - innerHeight);
    assert(farGap > 500);
    assert.equal(await far.locator('.LazyLoad').count(), 120);
    // At 501px the preceding row is inside the preload area: wait for its real IO delivery.
    await list.evaluate((el, delta) => { el.scrollTop += delta; }, initial.gap - 501);
    await list.getByText(`行 ${index}`, { exact: true }).waitFor({ state: 'attached' });
    const outside = await snapshot();
    assert(outside.gap === 501 && outside.empty && outside.pageY === 0);
    await list.evaluate(el => { el.scrollTop += 1; });
    await row.locator('li').waitFor({ state: 'attached' });
    const boundary = await snapshot();
    assert(boundary.gap === 500 && !boundary.empty && boundary.pageY === 0);
    assert.equal(boundary.scrollHeight, initial.scrollHeight);
    assert.equal(boundary.rowHeight, initial.rowHeight);
    assert(boundary.top > boundary.viewport && await first.isChecked());
    await list.evaluate(el => { el.scrollTop = 0; });
    const back = await snapshot();
    assert(back.pageY === 0 && back.top === 0 && !back.empty && await first.isChecked());
    const farBefore = await far.locator('li').count();
    assert.equal(farBefore, 0);
    await far.scrollIntoViewIfNeeded();
    await far.getByText('行 1', { exact: true }).waitFor();
    const farAfter = await far.locator('li').count();
    assert(farAfter > 0 && farAfter < 120);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ react, observer, initial, outside, boundary, back, checkedOnReturn: true, farGap, farBefore, farAfter }));
  } finally { await page.close(); }
}

(async () => {
  const [legacy, modern] = process.argv.slice(2);
  assert(legacy && modern, 'Pass the React 16 and React 19 preview URLs in order');
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    console.log('Edge', browser.version());
    for (const [url, major] of [[legacy, 16], [modern, 19]]) {
      try { await check(browser, url, major); } catch (error) { console.error(url, error); process.exitCode = 1; }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
