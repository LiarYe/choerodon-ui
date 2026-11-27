// Run the preview server, then node tests-react19/preview-p2-table.cjs http://localhost:4191
// See preview-b5.cjs for the playwright-core NODE_PATH setup.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

async function check(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(120000);
  const errors = [];
  page.on('pageerror', err => { errors.push(err.message); console.error(err.message); });
  const table = side => page.locator(`#p2 [data-side="${side}"]`);
  const handle = '[data-rfd-drag-handle-draggable-id], [data-rbd-drag-handle-draggable-id]';
  const row = '[data-rfd-draggable-id], [data-rbd-draggable-id]';
  const nameCell = 'td[data-index="name"] .c7n-pro-table-cell-inner, [role="gridcell"][aria-colindex="1"]';
  const namedRow = name => table('source').locator(row).filter({ has: page.locator(nameCell).filter({ hasText: new RegExp(`^${name}$`) }) });
  async function combinedWith(name) {
    const id = await namedRow(name).evaluate(el => el.dataset.rfdDraggableId ?? el.dataset.rbdDraggableId);
    assert(id, `缺少 ${name} 的 draggable ID`);
    return `has been combined with ${id}`;
  }
  async function pointerStart(name) {
    const cell = namedRow(name).locator(nameCell);
    await cell.scrollIntoViewIfNeeded();
    const { x, y } = await cell.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await page.mouse.move(x, y);
    const hit = await cell.evaluate((el, { x, y, handle }) => {
      const target = document.elementFromPoint(x, y);
      return el.contains(target) && target.closest(handle) === el.closest(handle) && !target.closest('button, input, .c7n-pro-table-expand-icon');
    }, { x, y, handle });
    assert(hit, `${name} 的鼠标起点未命中可拖动姓名单元格`);
    return { x, y };
  }
  const announcement = page.locator('[aria-live="assertive"]');
  const choose = id => page.getByLabel('表格场景').selectOption(id);
  async function lift() {
    const first = table('source').locator(handle).first();
    await first.scrollIntoViewIfNeeded();
    await page.waitForFunction((row) => [...document.querySelectorAll(`#p2 [data-side]`)].every(side => {
      const r = side.querySelector(row)?.getBoundingClientRect();
      const d = side.querySelector('[data-rfd-droppable-id], [data-rbd-droppable-id]')?.getBoundingClientRect();
      return r?.width > 0 && r?.height > 0 && d?.height > 0 && d?.width > 0;
    }), row);
    await first.press('Space');
    await announcement.filter({ hasText: /lifted/i }).waitFor({ state: 'attached' });
  }
  async function move(key, cancel = false) {
    await lift();
    await page.keyboard.press(key);
    await announcement.filter({ hasText: /moved|combined/i }).waitFor({ state: 'attached' });
    await page.keyboard.press(cancel ? 'Escape' : 'Space');
    const active = row.split(', ').flatMap(selector => [
      `${selector}[style*="fixed"]`, `${selector}[style*="z-index: 999;"]`,
    ]).join(', ');
    await page.locator(active).first().waitFor({ state: 'detached' });
  }
  async function order(side, expected) {
    await page.waitForFunction(({ side, row, nameCell, expected }) => {
      const rows = [...document.querySelector(`#p2 [data-side="${side}"]`).querySelectorAll(row)]
        .filter(el => el.getBoundingClientRect().height && getComputedStyle(el).visibility === 'visible');
      return rows.length === expected.length && rows.every((el, i) => el.querySelector(nameCell)?.innerText.trim() === expected[i]);
    }, { side, row, nameCell, expected });
  }
  async function mouseDrop(tree = false, perf = false) {
    await order('source', ['A', 'B', 'C']);
    const first = table('source').locator(handle).first();
    await first.scrollIntoViewIfNeeded();
    const start = await first.boundingBox();
    const b = await table('source').locator(row).nth(1).boundingBox();
    const c = await table('source').locator(row).nth(2).boundingBox();
    async function assertSlots(expectedB, phase) {
      const tops = await table('source').locator(row).evaluateAll(async (rows, nameCell) => {
        await new Promise(requestAnimationFrame);
        await Promise.all(rows.flatMap(el => el.getAnimations()).map(animation => animation.finished));
        return Object.fromEntries(rows.map(el => [el.querySelector(nameCell)?.innerText.trim(), el.getBoundingClientRect().top]));
      }, nameCell);
      for (const [name, expected] of [['B', expectedB], ['C', c.y]]) {
        assert(Math.abs(tops[name] - expected) < 1, `${phase} ${name}.top=${tops[name]}，预期 ${expected}`);
      }
      console.log(`${phase}: B/C.top=${tops.B}/${tops.C}`);
    }
    const { x, y } = await pointerStart('A');
    // Sample every rendered frame, including the drop animation; a later recovery must not hide a failure.
    await table('source').evaluate((table, { row: selector, nameCell }) => {
      const missing = new Set();
      let frame;
      function sample() {
        const visible = [...table.querySelectorAll(selector)].filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width && rect.height && el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
            && rect.bottom > 0 && rect.top < innerHeight;
        }).map(el => el.querySelector(nameCell)?.innerText.trim());
        for (const name of ['B', 'C']) if (!visible.includes(name)) missing.add(name);
        frame = requestAnimationFrame(sample);
      }
      sample();
      window.stopP2Sampling = () => { cancelAnimationFrame(frame); return [...missing]; };
    }, { row, nameCell });
    await page.mouse.down();
    await page.mouse.move(x, y + 8);
    await announcement.filter({ hasText: /lifted/i }).waitFor({ state: 'attached' });
    const placeholder = table('source').locator('[data-rfd-placeholder-context-id], [data-rbd-placeholder-context-id]');
    if (!tree) {
      await placeholder.waitFor({ state: 'visible' });
      assert(Math.abs((await placeholder.boundingBox()).height - start.height) < 2, '拖中占位高度');
      await assertSlots(b.y, '未越过 B');
    }
    // The combine sensor uses A's leading edge (not the cursor) against B's center.
    await page.mouse.move(x, tree ? b.y + 8 : b.y + b.height * 0.75, { steps: 8 });
    await announcement.filter({ hasText: tree ? /combined/i : /position 2/i }).waitFor({ state: 'attached' });
    if (!tree) await assertSlots(b.y - start.height, '越过 B');
    if (perf) {
      await table('source').evaluate((table, { row, nameCell, first, second, third }) => {
        const rows = () => [...table.querySelectorAll(row)];
        const name = el => el.querySelector(nameCell).innerText.trim();
        const originals = new Map(rows().map(el => [name(el), el]));
        const faults = new Set();
        let frames = 0;
        let raf;
        function sample() {
          const current = rows();
          for (const [key, el] of originals) {
            if (!current.includes(el) || name(el) !== key) faults.add(`行身份变化: ${key}`);
          }
          for (const el of current) {
            const key = name(el);
            const top = el.getBoundingClientRect().top;
            const expected = { A: second, B: first, C: third }[key];
            // A is still moving to its slot during the drop animation.
            if ((key !== 'A' || !table.querySelector('[data-rfd-placeholder-context-id], [data-rbd-placeholder-context-id]')) && Math.abs(top - expected) >= 1) {
              faults.add(`${key}.top=${top}, expected ${expected}`);
            }
          }
        }
        // Also inspect committed DOM batches: a timer can repair one before the next rAF.
        const observer = new MutationObserver(sample);
        observer.observe(table, { childList: true, subtree: true, attributes: true });
        function frame() { frames++; sample(); raf = requestAnimationFrame(frame); }
        raf = requestAnimationFrame(frame);
        window.finishPerfDrop = async () => {
          await new Promise(requestAnimationFrame);
          observer.disconnect(); cancelAnimationFrame(raf);
          return { frames, faults: [...faults] };
        };
      }, { row, nameCell, first: start.y, second: b.y, third: c.y });
    }
    await page.mouse.up();
    await placeholder.waitFor({ state: 'detached' });
    if (tree) await page.getByText('父节点 B', { exact: true }).waitFor();
    else await order('source', ['B', 'A', 'C']);
    if (perf) {
      const { frames, faults } = await page.evaluate(() => window.finishPerfDrop());
      console.log(`Performance 落下采样 ${frames} 帧`, faults);
      assert(frames > 0);
      assert.deepEqual(faults, []);
    }
    assert.deepEqual(await page.evaluate(() => window.stopP2Sampling()), [], '拖放期间消失的行');
  }
  async function treeRowDrops() {
    const source = table('source');
    const toggle = source.locator('.c7n-pro-table-expand-icon[tabindex="0"]');
    async function drag(name, key, steps, cancel = false) {
      const item = namedRow(name);
      await item.press('Space');
      await announcement.filter({ hasText: /lifted/i }).waitFor({ state: 'attached' });
      for (const step of steps) {
        await page.keyboard.press(key);
        await announcement.filter({ hasText: step }).waitFor({ state: 'attached' });
      }
      await page.keyboard.press(cancel ? 'Escape' : 'Space');
      await announcement.filter({ hasText: cancel ? /cancelled/i : /dropped/i }).waitFor({ state: 'attached' });
    }
    async function reset() {
      await choose('pro');
      await choose('tree');
      await order('source', ['A', 'B', 'C']);
    }
    await reset();
    async function mouseToC(offset, expected) {
      const { x, y } = await pointerStart('A');
      const c = await namedRow('C').boundingBox();
      await page.mouse.down();
      await page.mouse.move(x, y + 8);
      await announcement.filter({ hasText: /lifted/i }).waitFor({ state: 'attached' });
      await page.mouse.move(x, c.y + c.height * offset, { steps: 12 });
      await announcement.filter({ hasText: expected }).waitFor({ state: 'attached' });
      await page.mouse.up();
      await announcement.filter({ hasText: /dropped/i }).waitFor({ state: 'attached' });
    }
    await mouseToC(0.2, await combinedWith('C'));
    await page.getByText('父节点 C', { exact: true }).waitFor();
    await order('source', ['B', 'C', 'A']);
    const { x, y } = await pointerStart('A');
    await page.mouse.down();
    await page.mouse.move(x + 8, y);
    await announcement.filter({ hasText: /lifted/i }).waitFor({ state: 'attached' });
    await page.mouse.up();
    await announcement.filter({ hasText: /dropped/i }).waitFor({ state: 'attached' });
    await toggle.click();
    await order('source', ['B', 'C']);
    await toggle.click();
    await order('source', ['B', 'C', 'A']);
    await mouseToC(0.8, /to position 2/i);
    await page.getByText('父节点 undefined', { exact: true }).waitFor();
    await toggle.waitFor({ state: 'detached' });
    await order('source', ['B', 'A', 'C']);
    console.log('Pro 树：鼠标 A 合并到 C，再提升到 B/C 之间通过');
    for (const first of [false, true]) {
      await reset();
      await drag('A', 'ArrowDown', [await combinedWith('B'), /to position 2/i, await combinedWith('C')]);
      await page.getByText('父节点 C', { exact: true }).waitFor();
      await order('source', ['B', 'C', 'A']);
      const up = [await combinedWith('C'), /to position 2/i];
      await drag('A', 'ArrowUp', up, true);
      await toggle.click();
      await order('source', ['B', 'C']);
      await toggle.click();
      await order('source', ['B', 'C', 'A']);
      await drag('A', 'ArrowUp', first ? [...up, await combinedWith('B'), /to position 1/i] : up);
      await toggle.waitFor({ state: 'detached' });
      await order('source', first ? ['A', 'B', 'C'] : ['B', 'A', 'C']);
    }
    await reset();
    await drag('C', 'ArrowUp', [await combinedWith('B'), /to position 2/i, await combinedWith('A')]);
    await order('source', ['A', 'C', 'B']);
    await drag('C', 'ArrowDown', [await combinedWith('B'), /to position 3/i]);
    await toggle.waitFor({ state: 'detached' });
    await order('source', ['A', 'B', 'C']);
    await reset();
    await drag('B', 'ArrowUp', [await combinedWith('A')]);
    await toggle.click();
    await order('source', ['A', 'C']);
    await drag('A', 'ArrowDown', [await combinedWith('C')]);
    await order('source', ['C', 'A']);
    await drag('A', 'ArrowUp', [await combinedWith('C'), /to position 1/i]);
    await order('source', ['A', 'C']);
    await toggle.click();
    await order('source', ['A', 'B', 'C']);
    console.log('Pro 树：子行提升至根中间、首尾、反向、取消及子树保留通过');
  }
  async function virtualClones() {
    const cells = el => [...el.querySelectorAll('td')].map(td => {
      const style = getComputedStyle(td);
      const align = style.textAlign === 'start' ? (style.direction === 'rtl' ? 'right' : 'left') : style.textAlign;
      return { width: td.getBoundingClientRect().width, name: td.dataset.index, text: td.innerText.trim(),
        inner: !!td.querySelector('.c7n-pro-table-cell-inner'), padding: style.padding, align, display: style.display };
    });
    for (const scenario of ['virtual', 'virtual-default']) {
      await choose(scenario);
      const source = namedRow('行0');
      const before = await source.evaluate(cells);
      assert.deepEqual(before.map(c => c.text), ['行0', '研发', '待办']);
      assert(before.every(c => c.inner && c.width > 0));
      assert(await table('source').locator(row).count() < 100);
      await lift();
      const clone = page.locator('tr.dragging-row');
      assert.equal(await clone.evaluate(el => el.classList.contains('p2-custom-clone')), scenario === 'virtual');
      async function compare(locator, phase) {
        const actual = await locator.evaluate(cells);
        assert.equal(actual.length, before.length);
        actual.forEach(({ width, ...style }, i) => {
          const { width: expected, ...sourceStyle } = before[i];
          assert(Math.abs(width - expected) <= 1, `${scenario} ${phase} ${style.name}: ${width} ≠ ${expected}`);
          assert.deepEqual(style, sourceStyle);
        });
      }
      await compare(clone, '拖中');
      await page.keyboard.press('Escape');
      await clone.waitFor({ state: 'detached' });
      await compare(source, '取消后');
      console.log(`${scenario}: 三列宽度 ${before.map(c => c.width).join('/')}，拖前、拖中、取消后样式一致`);
    }
  }
  try {
    if (process.argv[3] === 'clone') {
      await page.goto(new URL('/?scenario=virtual#/p2', url).href);
      await virtualClones();
      assert.deepEqual(errors, []);
      return;
    }
    if (process.argv[3] === 'tree') {
      await page.goto(new URL('/?scenario=tree#/p2', url).href);
      await treeRowDrops();
      assert.deepEqual(errors, []);
      return;
    }
    const kinds = process.argv[3] ? [process.argv[3]] : ['pro', 'perf'];
    await page.goto(new URL(`/?scenario=${kinds[0]}#/p2`, url).href);
    for (const kind of kinds) {
      await choose(kind);
      await mouseDrop(false, kind === 'perf');
      console.log(`${kind}: 鼠标落点 B/A/C、占位高度及 B/C 持续可见通过`);
      await choose(`${kind}-pair`);
      await move('ArrowRight', true);
      await page.locator('#p2-result').filter({ hasText: /^CANCEL$/ }).waitFor();
      await order('source', ['A', 'B', 'C']);
      await order('target', ['D', 'E']);
      await move('ArrowRight');
      await order('source', ['B', 'C']);
      await order('target', ['A', 'D', 'E']);
      await choose(kind);
      await move('ArrowDown');
      await order('source', ['B', 'A', 'C']);
      await move('ArrowDown', true);
      await order('source', ['B', 'A', 'C']);
      console.log(`${kind}: 键盘单表、跨表、取消通过`);
    }
    if (!kinds.includes('pro')) { assert.deepEqual(errors, []); return; }
    await choose('veto');
    await move('ArrowDown');
    await page.locator('#p2-result').filter({ hasText: /^否决 1$/ }).waitFor();
    await order('source', ['A', 'B', 'C']);
    await choose('rewrite');
    await move('ArrowDown');
    await order('source', ['B', 'C', 'A']);
    await virtualClones();
    await treeRowDrops();
    await choose('pro'); // Start the next mouse drag on fresh roots, not the preceding subtree.
    for (const input of ['鼠标', '键盘']) {
      await choose('tree');
      if (input === '鼠标') await mouseDrop(true);
      else await move('ArrowDown');
      await page.getByText('父节点 B', { exact: true }).waitFor();
      const toggle = table('source').locator('.c7n-pro-table-expand-icon[tabindex="0"]');
      if ((await toggle.getAttribute('class')).includes('-expanded')) await toggle.click();
      await order('source', ['B', 'C']);
      await toggle.click();
      await order('source', ['B', 'A', 'C']);
      await toggle.click();
      await order('source', ['B', 'C']);
      console.log(`Pro: ${input}树合并及折叠展开通过`);
      if (input === '鼠标') await choose('pro');
    }
    assert.deepEqual(errors, []);
    console.log('Pro: 否决、改写、虚拟行 clone、树合并通过');
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try { await check(browser, process.argv[2] || 'http://localhost:4191'); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
