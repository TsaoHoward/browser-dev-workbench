import { chromium } from 'playwright';

const argumentsAfterScript = process.argv.slice(2);
const pageUrl = argumentsAfterScript.find((argument) => !argument.startsWith('--'));
const unavailableRuntime = argumentsAfterScript.includes('--unavailable-runtime');
const folderDiagnostic = argumentsAfterScript.includes('--folder-diagnostic');

if (
  !pageUrl ||
  argumentsAfterScript.some(
    (argument) =>
      argument !== pageUrl &&
      argument !== '--unavailable-runtime' &&
      argument !== '--folder-diagnostic',
  ) ||
  (unavailableRuntime && folderDiagnostic)
) {
  console.error(
    'Usage: node scripts/verify-pages-browser.mjs <page-url> [--unavailable-runtime | --folder-diagnostic]',
  );
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const consoleErrors = [];
const pageErrors = [];

if (unavailableRuntime) {
  await context.route('**/coi-serviceworker.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  );
}

if (folderDiagnostic) {
  await context.addInitScript(() => {
    globalThis.folderPickerCallCount = 0;
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        globalThis.folderPickerCallCount += 1;
        return { queryPermission: async () => 'granted' };
      },
      writable: true,
    });
  });
}

const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  const response = await page.goto(pageUrl, { waitUntil: 'networkidle' });
  if (!response?.ok()) {
    throw new Error(`page returned HTTP ${response?.status() ?? 'no response'}`);
  }

  await page.getByText('Browser Dev Workbench', { exact: true }).waitFor();
  const editor = page.locator('textarea[aria-label="Editing src/App.svelte"]');
  await editor.waitFor();
  await page.getByText('Preview is waiting', { exact: true }).waitFor();

  if (unavailableRuntime) {
    await page.waitForFunction(() => globalThis.crossOriginIsolated === false);
    await page.getByText('runtime unavailable', { exact: true }).waitFor();
    const startButton = page.getByRole('button', { name: 'Install & run dev' });
    await startButton.waitFor();
    if (!(await startButton.isDisabled())) {
      throw new Error('runtime action was enabled without runtime prerequisites');
    }
    await editor.fill('<script>\n  const editorWorksWithoutRuntime = true;\n</script>');
    if (!(await editor.inputValue()).includes('editorWorksWithoutRuntime')) {
      throw new Error('editor did not remain editable when the runtime was unavailable');
    }
  } else {
    await page.waitForFunction(() => globalThis.crossOriginIsolated === true, null, {
      timeout: 60_000,
    });
    await page.getByText('runtime can start', { exact: true }).waitFor();

    const capabilityResults = page.locator('[aria-label="Browser capability results"]');
    for (const expected of [
      'Workspace core: ready',
      'IndexedDB: ready',
      'OPFS: available',
      'Selected folder: user-action-required',
    ]) {
      if (!(await capabilityResults.innerText()).includes(expected)) {
        throw new Error(`missing expected capability result: ${expected}`);
      }
    }
    await page.getByRole('button', { name: 'Check storage' }).click();
    await page.getByText('OPFS: ready', { exact: true }).waitFor();
    await page.getByText('IndexedDB: ready', { exact: true }).waitFor();

    if (folderDiagnostic) {
      if ((await page.evaluate(() => globalThis.folderPickerCallCount)) !== 0) {
        throw new Error('folder picker ran before an explicit user action');
      }
      await page.getByRole('button', { name: 'Check folder access' }).click();
      await page.getByText('Selected folder: ready', { exact: true }).waitFor();
      if ((await page.evaluate(() => globalThis.folderPickerCallCount)) !== 1) {
        throw new Error('folder picker did not run exactly once after the diagnostic click');
      }
    }
  }

  if (consoleErrors.length || pageErrors.length) {
    throw new Error(
      [
        ...consoleErrors.map((error) => `console: ${error}`),
        ...pageErrors.map((error) => `page: ${error}`),
      ].join('\n'),
    );
  }

  console.log(
    `Pages browser ${unavailableRuntime ? 'unavailable-runtime ' : ''}${folderDiagnostic ? 'folder-diagnostic ' : ''}verification passed: ${pageUrl}\n${await page
      .locator('[aria-label="Browser capability results"]')
      .innerText()}`,
  );
} finally {
  await browser.close();
}
