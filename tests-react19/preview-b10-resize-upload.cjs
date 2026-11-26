const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

async function verify(browser, url, version) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); process.stderr.write(`${error}\n`); });
  await page.addInitScript(() => { window.File = undefined; });
  await page.goto(url);
  await page.getByText(`React ${version}`, { exact: true }).waitFor();
  const host = page.locator('section.rc-upload');
  const size = locator => locator.evaluate(el => [el.offsetWidth, el.offsetHeight]);
  async function checkSize(expected) {
    const sections = await host.all();
    await sections.reduce(async (previous, section, index) => {
      await previous;
      assert.deepEqual(await size(section), expected);
      assert.deepEqual(await size(section.locator(':scope > div')), [41, 17]);
      const frame = section.locator(':scope > div > iframe');
      // An opaque React 19 component exposes only the CSS containing block.
      const viewport = index === 1 && version.startsWith('19.') ? [41, 17] : expected;
      assert.deepEqual(await frame.evaluate(el => [el.clientWidth, el.clientHeight]), viewport);
    }, Promise.resolve());
    assert.equal(await host.count(), 2);
  }
  await checkSize([164, 32]);
  await page.getByRole('button', { name: 'Resize upload' }).click();
  await checkSize([252, 58]);
  const header = page.getByRole('columnheader', { name: 'Name' });
  const cell = page.getByRole('gridcell', { name: 'Sample' });
  const handle = page.locator('[class*="column-resize-spanner"][role="button"]');
  const beforeHeader = (await size(header))[0];
  const beforeCell = (await size(cell))[0];
  assert(beforeHeader > 0 && beforeCell > 0);
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 64, y, { steps: 8 });
  await page.mouse.up();
  const afterHeader = (await size(header))[0];
  const afterCell = (await size(cell))[0];
  assert.equal(afterHeader, beforeHeader + 64);
  assert.equal(afterCell, beforeCell + 64);
  assert.deepEqual(errors, []);
  process.stdout.write(`React ${version}: section/iframe 164x32 -> 252x58; header ${beforeHeader} -> ${afterHeader}; cell ${beforeCell} -> ${afterCell}\n`);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    await verify(browser, process.argv[2] || 'http://localhost:4416', '16.14.0');
    await verify(browser, process.argv[3] || 'http://localhost:4419/?isolated', '19.3.1');
  } finally { await browser.close(); }
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
