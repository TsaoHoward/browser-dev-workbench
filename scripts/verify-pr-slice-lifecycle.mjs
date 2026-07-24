import { execFileSync } from 'node:child_process';

const [baseSha, pullRequestNumber] = process.argv.slice(2);
const pullRequestBody = process.env.PR_BODY ?? '';

function fail(message) {
  console.error(`Slice lifecycle check failed: ${message}`);
  process.exit(1);
}

function gitDiffNameStatus() {
  const output = execFileSync('git', ['diff', '--name-status', '--find-renames', baseSha, 'HEAD'], {
    encoding: 'utf8',
  });

  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split('\t');
      return { paths, status };
    });
}

function gitShow(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' });
}

function isActiveSlice(path) {
  return path.startsWith('docs/slices/active/') && path.endsWith('.md');
}

function isArchivedSlice(path) {
  return path.startsWith('docs/slices/archive/') && path.endsWith('.md');
}

function completionMove(changes) {
  const moved = [];

  for (const { paths, status } of changes) {
    if (status.startsWith('R') && paths.length === 2) {
      const [from, to] = paths;
      if (
        isActiveSlice(from) &&
        isArchivedSlice(to) &&
        from.split('/').at(-1) === to.split('/').at(-1)
      ) {
        moved.push({ from, to });
      }
    }
  }

  const deletedActive = changes
    .filter(({ status, paths }) => status === 'D' && paths.length === 1 && isActiveSlice(paths[0]))
    .map(({ paths }) => paths[0]);
  const addedArchived = changes
    .filter(
      ({ status, paths }) => status === 'A' && paths.length === 1 && isArchivedSlice(paths[0]),
    )
    .map(({ paths }) => paths[0]);

  for (const from of deletedActive) {
    const filename = from.split('/').at(-1);
    const to = addedArchived.find((candidate) => candidate.split('/').at(-1) === filename);
    if (to) {
      moved.push({ from, to });
    }
  }

  return moved;
}

if (!baseSha || !pullRequestNumber) {
  fail('expected the pull request base SHA and number.');
}

const kindMatch = pullRequestBody.match(/^\s*-\s*PR kind:\s*`?(none|progress|completion)`?\s*$/m);
if (!kindMatch) {
  fail('set `PR kind` in the pull request description to `none`, `progress`, or `completion`.');
}

const kind = kindMatch[1];
const changes = gitDiffNameStatus();
const changedPaths = changes.flatMap(({ paths }) => paths);

if (kind === 'none') {
  process.exit(0);
}

const sliceMatch = pullRequestBody.match(/^\s*-\s*Slice:\s*`?(?!none\b)(.+?)`?\s*$/m);
if (!sliceMatch) {
  fail('identify the related slice in the pull request description.');
}

if (kind === 'progress') {
  if (!changedPaths.some(isActiveSlice)) {
    fail(
      'a progress PR must update its active slice document with progress and remaining exit conditions.',
    );
  }

  process.exit(0);
}

const moves = completionMove(changes);
if (moves.length !== 1) {
  fail('a completion PR must move exactly one same-named slice document from active/ to archive/.');
}

if (!changedPaths.includes('docs/slices/README.md')) {
  fail('a completion PR must update docs/slices/README.md.');
}

if (!changedPaths.includes('docs/references/IMPLEMENTATION_STATUS.md')) {
  fail('a completion PR must update docs/references/IMPLEMENTATION_STATUS.md.');
}

const archivedDocument = gitShow(moves[0].to);
if (!/^\|\s*Status\s*\|\s*completed\s*\|$/m.test(archivedDocument)) {
  fail('the archived slice document must have Status `completed`.');
}

if (
  !new RegExp(`^\\|\\s*Completion PR\\s*\\|.*#${pullRequestNumber}\\b`, 'm').test(archivedDocument)
) {
  fail(`record completion PR #${pullRequestNumber} in the archived slice document before review.`);
}

if (!/^\|\s*Completed\s*\|\s*(?!Pending\b).+\|$/m.test(archivedDocument)) {
  fail('record a non-pending completion date in the archived slice document before review.');
}

const handoffMatch = archivedDocument.match(/^\|\s*Handoff\s*\|\s*(.+?)\s*\|$/m);
if (!handoffMatch) {
  fail('declare `Handoff: none` or an explicit successor in the archived slice document.');
}

if (!/^none$/i.test(handoffMatch[1])) {
  const parentSliceMatch = archivedDocument.match(/^# Slice (\d+)\b/m);
  const successorDocuments = changedPaths.filter(
    (path) =>
      (path.startsWith('docs/slices/planned/') || path.startsWith('docs/slices/active/')) &&
      path.endsWith('.md'),
  );

  if (!parentSliceMatch || successorDocuments.length === 0) {
    fail('an explicit handoff must update its planned or active successor slice document.');
  }

  const handoffHeading = new RegExp(`^## Handoff from Slice ${parentSliceMatch[1]}\\b`, 'm');
  if (!successorDocuments.some((path) => handoffHeading.test(gitShow(path)))) {
    fail(`the successor document must include \`## Handoff from Slice ${parentSliceMatch[1]}\`.`);
  }
}

console.log(`Slice lifecycle check passed for completion PR #${pullRequestNumber}.`);
