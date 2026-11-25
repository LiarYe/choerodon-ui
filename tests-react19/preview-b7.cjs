// Start with: node tests-react19/preview.cjs --react16 --b7
// Set NODE_PATH as for preview-b6.cjs, then: node tests-react19/preview-b7.cjs [url]
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.goto(process.argv[2] || 'http://localhost:4191');
    await page.getByText(/^React 16\./).waitFor();
    const list = id => page.locator(`.${id} .c7n-pro-board-column-list`);
    const cards = list('full').locator('[data-index]');
    await cards.first().waitFor();
    const dimensions = async (id, width, height = 240) => {
      const node = list(id);
      await node.evaluate((el, w) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`list width: ${el.offsetWidth}, expected ${w}`)); }, 3000);
        const observer = new ResizeObserver(() => {
          if (el.offsetWidth === w) { observer.disconnect(); clearTimeout(timer); resolve(); }
        });
        observer.observe(el);
      }), width);
      const size = await node.evaluate(el => [el.offsetWidth, el.offsetHeight, el.scrollHeight]);
      assert.deepEqual(size.slice(0, 2), [width, height]);
      process.stdout.write(`${id}: ${size[0]}x${size[1]}, scrollHeight=${size[2]}\n`);
      return size[2];
    };
    assert.equal(await dimensions('empty', 400), 240);
    assert.equal(await list('empty').locator('[data-index]').count(), 0);
    assert(await dimensions('full', 400) > 240);
    assert.equal(await dimensions('empty-column', 332, 500), 500);
    assert.equal(await list('empty-column').locator('[data-rbd-draggable-id]').count(), 0);
    await page.setViewportSize({ width: 800, height: 700 });
    await dimensions('full', 320);
    await dimensions('empty', 320);
    assert.equal(await dimensions('empty-column', 332, 500), 500);
    const first = cards.first();
    assert.match(await first.innerText(), /Card 1\b/);
    assert(await cards.count() < 100);
    await list('full').hover();
    // The virtualizer may extend its estimated scroll range as new rows are measured.
    /* eslint-disable no-await-in-loop -- each wheel event depends on the preceding layout */
    for (let i = 0; i < 8; i++) {
      const before = await list('full').evaluate(el => el.scrollTop);
      await page.mouse.wheel(0, 12000);
      await page.waitForFunction(top => document.querySelector('.full .c7n-pro-board-column-list').scrollTop > top, before);
      if (await list('full').evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 1)) break;
    }
    /* eslint-enable no-await-in-loop */
    const last = list('full').locator('[data-index="99"]');
    await last.waitFor();
    assert.match(await last.innerText(), /Card 100\b/);
    assert.equal(await list('full').locator('[data-index="0"]').count(), 0);
    const bottom = await list('full').evaluate(el => el.scrollTop);
    assert(bottom > 0);
    await page.mouse.wheel(0, -12000);
    const handle = list('full').locator('[data-index="0"]');
    await handle.waitFor();
    assert.equal(await list('full').evaluate(el => el.scrollTop), 0);
    process.stdout.write(`wheel: 0 → ${bottom} → 0; Card 1 → Card 100 → Card 1\n`);
    await handle.focus();
    await page.keyboard.press('Space');
    await page.locator('[data-is-dragging="true"]').waitFor();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await page.locator('output').filter({ hasText: /^full → empty-column$/ }).waitFor();
    assert.deepEqual(errors, []);
    process.stdout.write('DnD: full → empty-column\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
