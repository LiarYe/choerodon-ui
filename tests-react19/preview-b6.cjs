// PowerShell, from the repo root (requires installed Edge and running preview servers):
// npm install --prefix "$env:TEMP\b5-driver" --no-save --no-package-lock playwright-core@1.55.0
// $env:NODE_PATH="$env:TEMP\b5-driver\node_modules"
// node tests-react19/preview-b6.cjs http://localhost:4291 http://localhost:4292
const assert = require('node:assert/strict');
const { inspect } = require('node:util');
const { chromium } = require('playwright-core');

function installFirstFrameProbe() {
  window.readCarouselLayout = () => {
    const list = document.querySelector('#b6 .slick-list');
    if (!list) return null;
    return {
      viewportWidth: window.innerWidth,
      listWidth: list.getBoundingClientRect().width,
      slideWidths: Array.from(list.querySelectorAll('.slick-slide.slick-active'), slide => slide.getBoundingClientRect().width),
      overflow: getComputedStyle(list).overflow,
    };
  };
  function sampleFirstFrame() {
    const layout = window.readCarouselLayout();
    if (layout?.listWidth) window.firstCarouselFrame = layout;
    else requestAnimationFrame(sampleFirstFrame);
  }
  requestAnimationFrame(sampleFirstFrame);
}

function measure(stage, actual, width, expected) {
  process.stdout.write(`${stage} ${JSON.stringify(actual)}\n`);
  assert.equal(actual.viewportWidth, width, `${stage} viewport`);
  assert.equal(actual.slideWidths.length, expected, `${stage} slidesToShow`);
  assert.equal(actual.overflow, 'hidden', `${stage} clipping`);
  actual.slideWidths.forEach(slideWidth => assert(Math.abs(slideWidth * expected - actual.listWidth) <= 1, `${stage} slide width`));
}

async function layout(page, stage, width, expected) {
  await page.locator('#b6 .slick-list').waitFor();
  await page.waitForFunction(count => {
    const actual = window.readCarouselLayout();
    return actual?.listWidth > 0 && actual.slideWidths.length === count &&
      Math.abs(actual.slideWidths[0] - actual.listWidth / count) <= 1;
  }, expected, { timeout: 3000 });
  measure(stage, await page.evaluate(() => window.readCarouselLayout()), width, expected);
}

async function firstFrame(page, stage, width, expected, failures) {
  const first = await page.waitForFunction(() => window.firstCarouselFrame);
  try {
    measure(stage, await first.jsonValue(), width, expected);
  } catch (error) {
    failures.push(error);
  }
}

async function transition(page, events, label, action, from, to) {
  const pair = `before(${from},${to}) after(${to})`;
  events.push(pair);
  await action();
  await page.waitForFunction(text => document.querySelector('#b6 output')?.textContent === text, events.join(' '));
  const index = await page.locator('#b6 .slick-list .slick-current').getAttribute('data-index');
  assert.equal(index, String(to), label);
  process.stdout.write(`${page.url()} ${label} ${pair} current=${index}\n`);
}

async function enterBreakpoint(page, from, count, failures) {
  await page.setViewportSize({ width: from, height: 850 });
  await layout(page, `${page.url()} 断点前 ${from}px`, from, count);
  await page.setViewportSize({ width: 768, height: 850 });
  try {
    await layout(page, `${page.url()} ${from} → 768px`, 768, 1);
  } catch (error) {
    const actual = await page.evaluate(() => window.readCarouselLayout());
    process.stderr.write(`${page.url()} ${from} → 768px: 预期 slidesToShow=1，实测 ${JSON.stringify(actual)}\n`);
    failures.push(error);
  }
}

async function check(browser, url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 850 } });
  page.setDefaultTimeout(10000);
  const failures = [];
  page.on('pageerror', error => failures.push(error));
  try {
    await page.addInitScript(installFirstFrameProbe);
    await page.goto(new URL('/#/b6', url).href);
    process.stdout.write(`${url} ${await page.getByText(/React 运行版本/).innerText()}\n`);
    await firstFrame(page, `${url} 窄屏首个布局帧`, 390, 1, failures);
    await layout(page, `${url} 冷启动窄屏`, 390, 1);
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.reload();
    await firstFrame(page, `${url} 宽屏首个布局帧`, 1280, 2, failures);
    await layout(page, `${url} 冷启动宽屏`, 1280, 2);

    const events = [];
    const slider = page.locator('#b6 .slick-slider');
    const refButton = name => page.getByRole('button', { name, exact: true });
    await transition(page, events, '点击下一张箭头', () => slider.locator('.slick-next').click(), 0, 1);
    await transition(page, events, '悬停第 4 个圆点', () => slider.locator('.slick-dots li').nth(3).hover(), 1, 3);
    await transition(page, events, 'ref.prev', () => refButton('ref.prev').click(), 3, 2);
    await transition(page, events, 'ref.next', () => refButton('ref.next').click(), 2, 3);
    await transition(page, events, 'ref.goTo(2)', () => refButton('ref.goTo(2)').click(), 3, 2);

    await page.setViewportSize({ width: 600, height: 850 });
    await layout(page, `${url} 缩窄`, 600, 1);
    await page.setViewportSize({ width: 1280, height: 850 });
    await layout(page, `${url} 恢复宽屏`, 1280, 2);
    await enterBreakpoint(page, 767, 1, failures);
    await enterBreakpoint(page, 769, 2, failures);
  } catch (error) {
    const received = await page.locator('#b6 output').textContent({ timeout: 1000 }).catch(() => null);
    process.stderr.write(`${url} 已收到的切页事件：${received}\n`);
    failures.push(error);
  } finally {
    await page.close();
  }
  if (failures.length) throw new AggregateError(failures, `${url} B6 验收失败`);
}

function reportError(error) {
  process.stderr.write(`${inspect(error)}\n`);
  process.exitCode = 1;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const urls = process.argv.length > 2 ? process.argv.slice(2) : ['http://localhost:4191'];
    await Promise.all(urls.map(url => check(browser, url).catch(reportError)));
  } finally { await browser.close(); }
})().catch(reportError);
