import { matchPattern, parse } from 'codeowners-utils';
import { readFileSync } from 'node:fs';

const { GITHUB_TOKEN, PR_NUMBER, REPO_OWNER, REPO_NAME } = process.env;

async function githubRequest(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function getChangedFiles() {
  const files = [];
  let page = 1;
  while (true) {
    const data = await githubRequest(
      `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`,
    );
    files.push(...data.map((f) => f.filename));
    if (data.length < 100) break;
    page++;
  }
  return files;
}

export function getOwnersForPaths(codeownersContent, changedFiles) {
  const definitions = parse(codeownersContent);
  let ownersForPaths = [];

  for (const { pattern, owners } of definitions) {
    for (const file of changedFiles) {
      if (matchPattern(file, pattern)) {
        ownersForPaths = ownersForPaths.concat(owners);
      }
    }
  }

  return ownersForPaths.filter((v, i) => ownersForPaths.indexOf(v) === i).sort();
}

export function getCommentBody(owners) {
  return `Review requested:\n\n${owners.map((i) => `- [ ] ${i}`).join('\n')}`;
}

async function pingOwners() {
  const changedFiles = await getChangedFiles();
  const codeownersContent = readFileSync('.github/CODEOWNERS', 'utf8');
  const owners = getOwnersForPaths(codeownersContent, changedFiles);
  if (owners.length === 0) return;
  await githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ body: getCommentBody(owners) }),
    },
  );
}

pingOwners().catch((err) => {
  console.error(err);
  process.exit(1);
});
