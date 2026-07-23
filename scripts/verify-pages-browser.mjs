import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const nativeFolderStates = {
  selected: 'ready',
  dismissed: 'not-completed',
};

function usage() {
  return [
    'Usage: node scripts/verify-pages-browser.mjs <page-url>',
    '  [--unavailable-runtime | --folder-diagnostic | --native-folder selected|dismissed]',
    '  [--headed] [--evidence-dir <directory>] [--target-commit <sha>]',
  ].join('\n');
}

export function parseBrowserAcceptanceArguments(argumentsAfterScript) {
  const options = {
    evidenceDirectory: undefined,
    folderDiagnostic: false,
    headed: false,
    nativeFolderOutcome: undefined,
    pageUrl: undefined,
    targetCommit: process.env.GITHUB_SHA,
    unavailableRuntime: false,
  };

  for (let index = 0; index < argumentsAfterScript.length; index += 1) {
    const argument = argumentsAfterScript[index];
    if (!argument.startsWith('--') && !options.pageUrl) {
      options.pageUrl = argument;
      continue;
    }
    if (argument === '--unavailable-runtime') {
      options.unavailableRuntime = true;
      continue;
    }
    if (argument === '--folder-diagnostic') {
      options.folderDiagnostic = true;
      continue;
    }
    if (argument === '--headed') {
      options.headed = true;
      continue;
    }
    if (argument === '--native-folder') {
      const outcome = argumentsAfterScript[index + 1];
      if (!outcome || outcome.startsWith('--')) {
        throw new Error('--native-folder requires selected or dismissed.');
      }
      options.nativeFolderOutcome = outcome;
      index += 1;
      continue;
    }
    if (argument === '--evidence-dir') {
      const directory = argumentsAfterScript[index + 1];
      if (!directory || directory.startsWith('--')) {
        throw new Error('--evidence-dir requires a directory.');
      }
      options.evidenceDirectory = directory;
      index += 1;
      continue;
    }
    if (argument === '--target-commit') {
      const targetCommit = argumentsAfterScript[index + 1];
      if (!targetCommit || targetCommit.startsWith('--')) {
        throw new Error('--target-commit requires a commit SHA.');
      }
      options.targetCommit = targetCommit;
      index += 1;
      continue;
    }
    throw new Error(`Unknown or incomplete argument: ${argument}`);
  }

  if (!options.pageUrl) throw new Error('A page URL is required.');
  try {
    new URL(options.pageUrl);
  } catch {
    throw new Error('The page URL must be an absolute URL.');
  }
  if (
    Number(options.unavailableRuntime) +
      Number(options.folderDiagnostic) +
      Number(Boolean(options.nativeFolderOutcome)) >
    1
  ) {
    throw new Error('Choose only one browser acceptance scenario.');
  }
  if (options.nativeFolderOutcome && !(options.nativeFolderOutcome in nativeFolderStates)) {
    throw new Error('--native-folder must be either selected or dismissed.');
  }
  if (options.nativeFolderOutcome && !options.headed) {
    throw new Error(
      '--native-folder requires --headed so a person can complete the native dialog.',
    );
  }
  return options;
}

export function redactUrl(value) {
  const url = new URL(value);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function redactError(value) {
  return String(value)
    .replaceAll(/file:\/\/[^\s)]+/g, '[redacted-file-url]')
    .replaceAll(/([A-Za-z]:\\|\/)[^\s)]+/g, '[redacted-path]')
    .replaceAll(/[?&](?:token|access_token|authorization|password)=[^\s&]+/gi, '$1=[redacted]');
}

export function createAcceptanceEvidence({
  actions,
  artifacts,
  browserVersion,
  capabilities,
  errors,
  scenario,
  serviceWorkerControlled,
  targetCommit,
  targetUrl,
  crossOriginIsolated,
}) {
  return {
    schemaVersion: 1,
    scenario,
    target: {
      commit: targetCommit ?? null,
      pagesUrl: redactUrl(targetUrl),
    },
    browser: {
      engine: 'chromium',
      version: browserVersion,
    },
    browserContext: {
      crossOriginIsolated,
      serviceWorkerControlled,
    },
    actions,
    observations: {
      capabilities,
      errors: errors.map(({ message, source }) => ({ source, message: redactError(message) })),
    },
    artifacts,
  };
}

async function writeEvidence(evidenceDirectory, evidence) {
  if (!evidenceDirectory) return;
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    path.join(evidenceDirectory, 'acceptance-session.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}

async function screenshot(page, evidenceDirectory, artifacts, filename) {
  if (!evidenceDirectory) return;
  const screenshotPath = path.join(evidenceDirectory, filename);
  await page.screenshot({ path: screenshotPath });
  artifacts.push(filename);
}

async function waitForFolderState(page, expectedState) {
  await page
    .getByText(`Selected folder: ${expectedState}`, { exact: true })
    .waitFor({ timeout: 120_000 });
}

function recordAction(actions, id, result) {
  actions.push({ at: new Date().toISOString(), id, result });
}

export async function runBrowserAcceptance(options) {
  const actions = [];
  const artifacts = [];
  const errors = [];
  let browser;
  let page;
  let capabilities = '';
  let serviceWorkerControlled = false;
  let crossOriginIsolated = false;
  const scenario = options.unavailableRuntime
    ? 'unavailable-runtime'
    : options.folderDiagnostic
      ? 'folder-diagnostic-stub'
      : options.nativeFolderOutcome
        ? `folder-native-${options.nativeFolderOutcome}`
        : 'capability-loop';

  try {
    if (options.evidenceDirectory) await mkdir(options.evidenceDirectory, { recursive: true });
    browser = await chromium.launch({ headless: !options.headed });
    const context = await browser.newContext();

    if (options.unavailableRuntime) {
      await context.route('**/coi-serviceworker.js', (route) =>
        route.fulfill({ contentType: 'application/javascript', body: '' }),
      );
    }

    if (options.folderDiagnostic) {
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

    page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push({ source: 'console', message: message.text() });
    });
    page.on('pageerror', (error) => errors.push({ source: 'page', message: error.message }));

    recordAction(actions, 'navigate', 'started');
    const response = await page.goto(options.pageUrl, { waitUntil: 'networkidle' });
    if (!response?.ok()) {
      throw new Error(`page returned HTTP ${response?.status() ?? 'no response'}`);
    }
    recordAction(actions, 'navigate', 'passed');

    await page.getByText('Browser Dev Workbench', { exact: true }).waitFor();
    const editor = page.locator('textarea[aria-label="Editing src/App.svelte"]');
    await editor.waitFor();
    await page.getByText('Preview is waiting', { exact: true }).waitFor();
    recordAction(actions, 'wait-for-workbench', 'passed');

    if (options.unavailableRuntime) {
      await page.waitForFunction(() => globalThis.crossOriginIsolated === false);
      await page.getByText('runtime unavailable', { exact: true }).waitFor();
      const startButton = page.getByRole('button', { name: 'Install & run dev' });
      if (!(await startButton.isDisabled())) {
        throw new Error('runtime action was enabled without runtime prerequisites');
      }
      await editor.fill('<script>\n  const editorWorksWithoutRuntime = true;\n</script>');
      if (!(await editor.inputValue()).includes('editorWorksWithoutRuntime')) {
        throw new Error('editor did not remain editable when the runtime was unavailable');
      }
      recordAction(actions, 'verify-unavailable-runtime-editor', 'passed');
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
      recordAction(actions, 'verify-capability-loop', 'passed');

      await page.getByRole('button', { name: 'Check storage' }).click();
      await page.getByText('OPFS: ready', { exact: true }).waitFor();
      await page.getByText('IndexedDB: ready', { exact: true }).waitFor();
      recordAction(actions, 'probe-storage', 'passed');

      if (options.folderDiagnostic) {
        if ((await page.evaluate(() => globalThis.folderPickerCallCount)) !== 0) {
          throw new Error('folder picker ran before an explicit user action');
        }
        await page.getByRole('button', { name: 'Check folder access' }).click();
        await waitForFolderState(page, 'ready');
        if ((await page.evaluate(() => globalThis.folderPickerCallCount)) !== 1) {
          throw new Error('folder picker did not run exactly once after the diagnostic click');
        }
        recordAction(actions, 'verify-folder-user-initiation', 'passed');
      }

      if (options.nativeFolderOutcome) {
        await screenshot(
          page,
          options.evidenceDirectory,
          artifacts,
          'before-native-folder-action.png',
        );
        await page.getByRole('button', { name: 'Check folder access' }).click();
        recordAction(actions, 'open-native-folder-dialog', 'human-gated');
        await waitForFolderState(page, nativeFolderStates[options.nativeFolderOutcome]);
        recordAction(actions, `observe-native-folder-${options.nativeFolderOutcome}`, 'passed');
        await screenshot(
          page,
          options.evidenceDirectory,
          artifacts,
          'after-native-folder-action.png',
        );
      }
    }

    if (errors.length) throw new Error('browser emitted console or page errors');
    capabilities = await page.locator('[aria-label="Browser capability results"]').innerText();
    await screenshot(page, options.evidenceDirectory, artifacts, 'completed.png');
    return {
      actions,
      artifacts,
      capabilities,
      errors,
      scenario,
      serviceWorkerControlled,
      crossOriginIsolated,
    };
  } catch (error) {
    errors.push({
      source: 'harness',
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    if (page) {
      try {
        capabilities ||= await page
          .locator('[aria-label="Browser capability results"]')
          .innerText();
        ({ serviceWorkerControlled, crossOriginIsolated } = await page.evaluate(() => ({
          crossOriginIsolated: globalThis.crossOriginIsolated,
          serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
        })));
      } catch {
        // The final evidence retains the observations collected before a failed page became unusable.
      }
    }
    const evidence = createAcceptanceEvidence({
      actions,
      artifacts,
      browserVersion: browser?.version() ?? 'not-started',
      capabilities,
      errors,
      scenario,
      serviceWorkerControlled,
      targetCommit: options.targetCommit,
      targetUrl: options.pageUrl,
      crossOriginIsolated,
    });
    await writeEvidence(options.evidenceDirectory, evidence);
    await browser?.close();
  }
}

async function main() {
  try {
    const options = parseBrowserAcceptanceArguments(process.argv.slice(2));
    const result = await runBrowserAcceptance(options);
    console.log(
      `Pages browser ${result.scenario} verification passed: ${redactUrl(options.pageUrl)}\n${result.capabilities}`,
    );
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n${usage()}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
