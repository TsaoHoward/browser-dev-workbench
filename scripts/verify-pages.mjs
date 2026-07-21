import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const pagesBasePath = '/browser-dev-workbench/';
const retryCount = 6;
const retryDelayMs = 5000;

function fail(message) {
  console.error(`Pages verification failed: ${message}`);
  process.exitCode = 1;
}

function findResource(html, pattern, label) {
  const match = html.match(pattern);
  if (!match?.[1]) {
    throw new Error(`could not find ${label} in the deployed HTML`);
  }
  return match[1];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyBuild() {
  const html = await readFile('dist/index.html', 'utf8');
  const modulePath = findResource(
    html,
    /<script[^>]+type="module"[^>]+src="([^"]+)"/,
    'the application module',
  );
  const serviceWorkerPath = findResource(
    html,
    /<script[^>]+src="([^"]*coi-serviceworker\.js)"/,
    'the COOP/COEP service worker',
  );

  assert(modulePath.startsWith(pagesBasePath), `application module is not under ${pagesBasePath}`);
  assert(!modulePath.includes('/src/'), 'application module still points at source files');
  assert(serviceWorkerPath === './coi-serviceworker.js', 'service worker path is not relative');
  await access('dist/coi-serviceworker.js', constants.R_OK);

  console.log('Pages build verification passed.');
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retryCount) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error(`${url} did not become available: ${lastError?.message ?? 'unknown error'}`);
}

async function verifyDeployment(pageUrl) {
  const normalizedPageUrl = pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`;
  const html = await (await fetchWithRetry(normalizedPageUrl)).text();
  assert(
    html.includes('<div id="app"></div>'),
    'deployed HTML is missing the application mount point',
  );

  const modulePath = findResource(
    html,
    /<script[^>]+type="module"[^>]+src="([^"]+)"/,
    'the application module',
  );
  const stylePath = findResource(
    html,
    /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/,
    'the stylesheet',
  );
  const serviceWorkerPath = findResource(
    html,
    /<script[^>]+src="([^"]*coi-serviceworker\.js)"/,
    'the COOP/COEP service worker',
  );

  const resources = [modulePath, stylePath, serviceWorkerPath].map(
    (resourcePath) => new URL(resourcePath, normalizedPageUrl).href,
  );
  await Promise.all(resources.map((resource) => fetchWithRetry(resource)));

  assert(modulePath.includes(pagesBasePath), `deployed module is not under ${pagesBasePath}`);
  assert(!modulePath.includes('/src/'), 'deployed module still points at source files');
  console.log(`Pages deployment verification passed: ${normalizedPageUrl}`);
}

const target = process.argv[2];

try {
  if (target === '--build') {
    await verifyBuild();
  } else if (target) {
    await verifyDeployment(target);
  } else {
    throw new Error('provide --build or a deployed Pages URL');
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
