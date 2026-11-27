// Start node tests-react19/preview.cjs; set NODE_PATH as in preview-b5.cjs.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

async function move(page, handle, direction) {
  await handle.scrollIntoViewIfNeeded();
  await handle.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press(direction);
  await page.keyboard.press('Space');
}
async function pointerMove(page, handle, target, checkBody) {
  const selector = checkBody ? '.c7n-pro-board-quote-container[data-is-dragging="true"]' : '.c7n-tabs-customization-group-item-dragging';
  const active = page.locator(selector);
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  const end = await target.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 8);
  await active.waitFor();
  if (checkBody) assert.ok(await active.evaluate(el => el.parentElement === document.body), 'Board clone must be a direct child of body');
  else {
    const siblings = page.locator('.c7n-tabs-customization-group-item').filter({ hasText: /页签 [BC]/ });
    assert.equal(await siblings.count(), 2);
    assert.ok(await siblings.evaluateAll((items, left) => items.every(item => Math.abs(item.getBoundingClientRect().left - left) < 2), end.x), '提起后其余页签不应横移');
  }
  const start = await active.boundingBox();
  const dy = end.y + end.height / 2 - (y + 8);
  const dx = checkBody ? end.x + end.width / 2 - x : 0;
  await page.mouse.move(x + dx, y + 8 + dy, { steps: 12 });
  await page.waitForFunction(({ selector, start, dx, dy }) => {
    const rect = document.querySelector(selector)?.getBoundingClientRect();
    return rect && Math.abs(rect.y - start.y - dy) < 2 && Math.abs(rect.x - start.x - dx) < 2;
  }, { selector, start, dx, dy });
  const finish = await active.boundingBox();
  console.log(`  ${checkBody ? 'body > Board clone' : 'Tabs row'}: Δ(${Math.round(finish.x - start.x)}, ${Math.round(finish.y - start.y)})px`);
  await page.mouse.up();
}
async function checkNames(items, values) {
  await items.first().filter({ hasText: values[0] }).waitFor();
  assert.deepEqual((await items.allInnerTexts()).map(x => x.trim()), values);
}
const expected = prefix => ['A', 'B', 'C'].map(c => `${prefix} ${c}.txt`);
const swapped = ([a, b, c]) => [b, a, c];
const scenarios = {
  async Board(page, pointer) {
    const board = page.locator('#p2-board');
    const cards = label => board.locator('.c7n-pro-board-column-container').filter({ has: page.locator('.c7n-pro-board-column-header').filter({ hasText: label }) }).locator('.c7n-pro-board-quote-container');
    const titles = label => cards(label).locator('.c7n-pro-board-quote-head-wrapper > p');
    await checkNames(titles('待办'), ['任务 A', '任务 B']);
    await board.locator('.c7n-pro-board-column-header').filter({ hasText: '完成' }).waitFor();
    assert.equal(await cards('完成').count(), 0);
    if (pointer) {
      const target = board.locator('.c7n-pro-board-column-container').filter({ hasText: '完成' }).locator('.c7n-pro-board-column-list');
      await pointerMove(page, cards('待办').first(), target, true);
    } else await move(page, cards('待办').first(), 'ArrowRight');
    await board.locator('output').filter({ hasText: '任务 A: todo → done' }).waitFor();
    await checkNames(titles('待办'), ['任务 B']);
    await checkNames(titles('完成'), ['任务 A']);
    if (pointer) {
      const list = label => board.locator('.c7n-pro-board-column-container').filter({ hasText: label }).locator('.c7n-pro-board-column-list');
      assert.equal(await cards('未分组').count(), 0);
      await pointerMove(page, cards('待办').first(), list('未分组'), true);
      await board.locator('output').filter({ hasText: '任务 B: todo → _empty' }).waitFor();
      await checkNames(titles('未分组'), ['任务 B']);
      assert.equal(await cards('待办').count(), 0);
      await pointerMove(page, cards('未分组').first(), list('待办'), true);
      await board.locator('output').filter({ hasText: '任务 B: _empty → todo' }).waitFor();
      await checkNames(titles('待办'), ['任务 B']);
      assert.equal(await cards('未分组').count(), 0);
      await checkNames(titles('完成'), ['任务 A']);
      return 'A: 待办 → 完成；B: 待办 → 未分组 → 待办';
    }
    return '[A,B] / [] → [B] / [A]';
  },
  async Upload(page) {
    const rows = page.locator('#p2-upload .c7n-upload-list-item');
    const names = rows.locator('.c7n-upload-list-item-name');
    await checkNames(names, expected('上传'));
    await move(page, rows.first(), 'ArrowRight');
    await checkNames(names, swapped(expected('上传')));
    return 'A,B,C → B,A,C';
  },
  async Tabs(page, pointer) {
    const tabs = page.locator('#p2-tabs');
    const labels = tabs.getByRole('tab');
    const names = ['页签 A', '页签 B', '页签 C'];
    await checkNames(labels, names);
    await tabs.locator('button.c7n-tabs-hover-button').click();
    const settings = page.locator('.c7n-tabs-customization-group-item');
    const settingNames = settings.locator('.c7n-tabs-customization-group-item-title-text > span:first-child');
    await checkNames(settingNames, names);
    const handle = settings.first().locator('.c7n-tabs-customization-group-item-drag-icon');
    if (pointer) await pointerMove(page, handle, settings.nth(1), false);
    else await move(page, handle, 'ArrowDown');
    await checkNames(settingNames, swapped(names));
    await page.getByRole('button', { name: /保\s*存|save/i }).click();
    await checkNames(labels, swapped(names));
    return 'saved A,B,C → B,A,C';
  },
  BoardPointer: page => scenarios.Board(page, true),
  TabsPointer: page => scenarios.Tabs(page, true),
  async Attachment(page) {
    const names = page.locator('#p2-attachment .c7n-pro-attachment-list-item-name');
    const initial = ['附件 A', '附件 B', '附件 C'];
    await checkNames(names, initial);
    await move(page, page.locator('#p2-attachment .c7n-pro-attachment-list-item-drag-icon').first(), 'ArrowDown');
    await checkNames(names, swapped(initial));
    return 'A,B,C → B,A,C';
  },
};
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    for (const name of (process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(scenarios))) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 920 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', e => { errors.push(e.message); });
      page.setDefaultTimeout(8000);
      try {
        await page.goto(process.argv[2] || 'http://localhost:4191/#/p2', { timeout: 120000 });
        await page.getByRole('heading', { name: /列表拖拽 · React (16|19)\./ }).waitFor();
        await page.getByLabel('列表场景').selectOption(name.replace(/Pointer$/, ''));
        const result = await scenarios[name](page);
        assert.deepEqual(errors, []);
        console.log(`${name}: ${result}`);
      } catch (e) {
        console.error(`${name}: ${e.message}`, errors);
        process.exitCode = 1;
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
