// NODE_PATH as in preview-b6.cjs; pass the React 16 and React 19 preview URLs.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

async function verify(browser, url) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('output').filter({ hasText: /^32$/ }).waitFor();
  const height = () => page.locator('tr').evaluate(el => el.getBoundingClientRect().height);
  assert.equal(await height(), 32);
  await page.getByText('Resize', { exact: true }).click();
  await page.locator('output').filter({ hasText: /^76$/ }).waitFor();
  assert.equal(await height(), 76);
  assert.equal(await page.locator('#box').evaluate(el => el.scrollTop), 0);
  await page.getByText('Validate', { exact: true }).click();
  const scroll = await page.locator('#box').evaluate(box => {
    const rect = box.getBoundingClientRect();
    const target = box.querySelector('#first').getBoundingClientRect();
    return { top: box.scrollTop, visible: target.top >= rect.top && target.bottom <= rect.bottom + 1 };
  });
  assert(scroll.top > 0 && scroll.visible);
  assert.deepEqual(errors, []);
  process.stdout.write(`${await page.locator('p').innerText()}: row 32 -> 76, scroll 0 -> ${scroll.top}, first visible\n`);
  await page.close();
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    await verify(browser, process.argv[2]);
    await verify(browser, process.argv[3]);
  } finally { await browser.close(); }
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
