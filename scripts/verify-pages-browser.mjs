import { chromium } from 'playwright';

const pageUrl = process.argv[2];

if (!pageUrl) {
  console.error('Usage: node scripts/verify-pages-browser.mjs <page-url>');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  const response = await page.goto(pageUrl, { waitUntil: 'networkidle' });
  if (!response?.ok()) {
    throw new Error(`page returned HTTP ${response?.status() ?? 'no response'}`);
  }

  await page.waitForFunction(() => globalThis.crossOriginIsolated === true, null, {
    timeout: 60_000,
  });
  await page.getByText('Browser Dev Workbench', { exact: true }).waitFor();
  await page.locator('textarea[aria-label="Editing src/App.svelte"]').waitFor();
  await page.getByText('runtime can start', { exact: true }).waitFor();
  await page.getByText('Preview is waiting', { exact: true }).waitFor();

  const capabilityResults = await page
    .locator('[aria-label="Browser capability results"]')
    .innerText();
  for (const expected of ['Workspace core: ready', 'IndexedDB: ready', 'OPFS: available']) {
    if (!capabilityResults.includes(expected)) {
      throw new Error(`missing expected capability result: ${expected}`);
    }
  }
  await page.getByRole('button', { name: 'Check storage' }).click();
  await page.getByText('OPFS: ready', { exact: true }).waitFor();
  await page.getByText('IndexedDB: ready', { exact: true }).waitFor();

  if (consoleErrors.length || pageErrors.length) {
    throw new Error(
      [
        ...consoleErrors.map((error) => `console: ${error}`),
        ...pageErrors.map((error) => `page: ${error}`),
      ].join('\n'),
    );
  }

  console.log(
    `Pages browser smoke verification passed: ${pageUrl}\n${await page
      .locator('[aria-label="Browser capability results"]')
      .innerText()}`,
  );
} finally {
  await browser.close();
}
