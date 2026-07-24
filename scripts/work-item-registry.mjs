import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const registryPath = 'docs/work-items/registry.md';
const activeSliceDirectory = 'docs/slices/active';
const issueDirectory = 'docs/work-items/issues';
const requirementDirectory = 'docs/work-items/requirements';
const projectionStates = new Set(['pending', 'projected']);

function fail(message) {
  throw new Error(`Work-item registry validation failed: ${message}`);
}

function read(rootDirectory, path) {
  return readFileSync(join(rootDirectory, path), 'utf8');
}

function tableFields(content) {
  const fields = new Map();

  for (const match of content.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm)) {
    const [, field, value] = match;
    if (!/^-+$/.test(field.trim())) {
      fields.set(field.trim().toLowerCase(), value.trim());
    }
  }

  return fields;
}

function requiredField(fields, name, path) {
  const value = fields.get(name.toLowerCase());
  if (!value) {
    fail(`${path} must declare a ${name} field.`);
  }

  return value;
}

function markdownLinks(value) {
  return [...value.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(([, label, target]) => ({
    label,
    target,
  }));
}

function localLinkPath(fromPath, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) {
    return undefined;
  }

  return normalize(join(dirname(fromPath), target.split('#', 1)[0]));
}

function requireLocalLink(fields, field, fromPath, expectedPath) {
  const value = requiredField(fields, field, fromPath);
  const link = markdownLinks(value).find(
    ({ target }) => localLinkPath(fromPath, target) === expectedPath,
  );

  if (!link) {
    fail(`${fromPath} ${field} must link to ${expectedPath}.`);
  }
}

function requireGitHubIssueLink(fields, path) {
  const value = requiredField(fields, 'GitHub issue', path);
  const link = markdownLinks(value).find(({ target }) =>
    /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(target),
  );

  if (!link) {
    fail(`${path} GitHub issue must contain a canonical GitHub Issue URL.`);
  }

  return link.target;
}

function recordId(content, kind, path) {
  const match = content.match(new RegExp(`^# (${kind}-\\d{4})\\b`, 'm'));
  if (!match) {
    fail(`${path} must start with a ${kind}-xxxx heading.`);
  }

  return match[1];
}

function firstActiveSlice(rootDirectory) {
  const index = read(rootDirectory, 'docs/slices/README.md');
  const activeLinks = [
    ...new Set(
      markdownLinks(index)
        .map(({ target }) => localLinkPath('docs/slices/README.md', target))
        .filter((path) => path?.startsWith(`${activeSliceDirectory}/`) && path.endsWith('.md')),
    ),
  ];

  if (activeLinks.length !== 1) {
    fail('docs/slices/README.md must link to exactly one active Slice document.');
  }

  return activeLinks[0];
}

function markdownTable(rows) {
  const widths = [
    Math.max(...rows.map(([field]) => field.length)),
    Math.max(...rows.map(([, value]) => value.length)),
  ];
  const format = ([field, value]) => `| ${field.padEnd(widths[0])} | ${value.padEnd(widths[1])} |`;

  return [
    format(rows[0]),
    `| ${'-'.repeat(widths[0])} | ${'-'.repeat(widths[1])} |`,
    ...rows.slice(1).map(format),
  ].join('\n');
}

export function validateWorkItemGraph(rootDirectory = process.cwd()) {
  const root = resolve(rootDirectory);
  const agents = read(root, 'AGENTS.md');
  const activeSlicePath = firstActiveSlice(root);
  const sliceContent = read(root, activeSlicePath);
  const sliceFields = tableFields(sliceContent);

  if (!/\[Project conventions\]\(docs\/PROJECT_CONVENTIONS\.md\)/.test(agents)) {
    fail('AGENTS.md must link to the project conventions.');
  }
  if (!/\[Slice index\]\(docs\/slices\/README\.md\)/.test(agents)) {
    fail('AGENTS.md must link to the Slice index.');
  }
  if (requiredField(sliceFields, 'Status', activeSlicePath) !== 'active') {
    fail(`${activeSlicePath} must have Status active.`);
  }

  const requirementLink = markdownLinks(
    requiredField(sliceFields, 'Requirement', activeSlicePath),
  )[0];
  const issueLink = markdownLinks(requiredField(sliceFields, 'Source Issue', activeSlicePath))[0];
  if (!requirementLink || !issueLink) {
    fail(`${activeSlicePath} must link to its requirement and source Issue record.`);
  }

  const requirementPath = localLinkPath(activeSlicePath, requirementLink.target);
  const issuePath = localLinkPath(activeSlicePath, issueLink.target);
  if (!requirementPath?.startsWith(`${requirementDirectory}/`)) {
    fail(`${activeSlicePath} Requirement must point into ${requirementDirectory}.`);
  }
  if (!issuePath?.startsWith(`${issueDirectory}/`)) {
    fail(`${activeSlicePath} Source Issue must point into ${issueDirectory}.`);
  }

  const requirementContent = read(root, requirementPath);
  const issueContent = read(root, issuePath);
  const requirementFields = tableFields(requirementContent);
  const issueFields = tableFields(issueContent);
  const requirementId = recordId(requirementContent, 'REQ', requirementPath);
  const issueId = recordId(issueContent, 'ISSUE', issuePath);

  requireLocalLink(requirementFields, 'Slice', requirementPath, activeSlicePath);
  requireLocalLink(requirementFields, 'Source Issue', requirementPath, issuePath);
  requireLocalLink(issueFields, 'Slice', issuePath, activeSlicePath);
  requireLocalLink(issueFields, 'Requirement', issuePath, requirementPath);

  const delivery = requiredField(sliceFields, 'Delivery', activeSlicePath);
  for (const [path, fields] of [
    [requirementPath, requirementFields],
    [issuePath, issueFields],
  ]) {
    if (requiredField(fields, 'Delivery', path) !== delivery) {
      fail(`${path} Delivery must match ${activeSlicePath}.`);
    }
  }

  const projection = requiredField(issueFields, 'Projection', issuePath);
  if (!projectionStates.has(projection)) {
    fail(`${issuePath} Projection must be pending or projected.`);
  }

  const githubIssueUrl = requireGitHubIssueLink(issueFields, issuePath);
  const repositoryUrl = githubIssueUrl.replace(/\/issues\/\d+$/, '');
  const recordUrl = `${repositoryUrl}/blob/main/${issuePath}`;
  const marker = `<!-- work-item-record: ${issueId}; path=${issuePath}; revision=main; url=${recordUrl} -->`;

  return {
    activeSlicePath,
    delivery,
    githubIssueUrl,
    issueId,
    issuePath,
    marker,
    projection,
    recordUrl,
    requirementId,
    requirementPath,
  };
}

export function createRegistry(graph) {
  const sliceLink = `../slices/${relative('docs/slices', graph.activeSlicePath)}`;
  const requirementLink = `requirements/${graph.requirementPath.split('/').at(-1)}`;
  const issueLink = `issues/${graph.issuePath.split('/').at(-1)}`;
  const table = markdownTable([
    ['Field', 'Value'],
    ['Slice', `[${graph.activeSlicePath}](${sliceLink})`],
    ['Requirement', `[${graph.requirementId}](${requirementLink})`],
    ['Issue record', `[${graph.issueId}](${issueLink})`],
    ['Delivery', graph.delivery],
    ['GitHub projection', graph.projection],
    ['Stable record link', `[${graph.issueId}](${graph.recordUrl})`],
  ]);

  return `# Work-item registry\n\n> Generated from the primary Slice, requirement, and Issue records. Do not edit manually; run\n> \`npm run work-items:generate\`.\n\n## Active control-plane chain\n\n[AGENTS.md](../../AGENTS.md) → [Slice index](../slices/README.md) → [${graph.activeSlicePath}](${sliceLink}) → [${graph.requirementId}](${requirementLink}) → [${graph.issueId}](${issueLink}) → [GitHub Issue](${graph.githubIssueUrl})\n\n## Active work item\n\n${table}\n\n## Expected GitHub projection marker\n\n\`${graph.marker}\`\n`;
}

export function writeRegistry(rootDirectory = process.cwd()) {
  const root = resolve(rootDirectory);
  const registry = createRegistry(validateWorkItemGraph(root));
  writeFileSync(join(root, registryPath), registry);
}

export function checkRegistry(rootDirectory = process.cwd()) {
  const root = resolve(rootDirectory);
  const expected = createRegistry(validateWorkItemGraph(root));
  const actual = read(root, registryPath);
  if (actual !== expected) {
    fail(`${registryPath} is stale; run npm run work-items:generate.`);
  }
}

function run() {
  const argument = process.argv[2];
  if (argument === '--write') {
    writeRegistry();
    return;
  }
  if (argument === '--check') {
    checkRegistry();
    return;
  }

  fail('expected --write or --check.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
