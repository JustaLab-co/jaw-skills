#!/usr/bin/env node
// Fails when the jaw-cli skill and the MCP servers disagree on which tools exist.
//
//   node scripts/check-tools.mjs
//     Lists the tools of the pinned @jaw.id/cli over stdio and compares them with
//     rules/mcp.md, then compares rules/hosted-mcp.md with hosted-tools.json.
//
//   node scripts/check-tools.mjs --refresh-hosted <jaw-agent checkout> [ref]
//     Rewrites hosted-tools.json from the hosted server's source at ref
//     (default origin/main). The hosted server needs OAuth and its source is
//     private, so the manifest is the copy this public repo can check against.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const MANIFEST = join(import.meta.dirname, 'hosted-tools.json');
const LOCAL_DOC = 'jaw-cli/rules/mcp.md';
const HOSTED_DOC = 'jaw-cli/rules/hosted-mcp.md';

const read = (path) => readFileSync(join(ROOT, path), 'utf8');

export function documentedTools(markdown) {
  return new Set([...markdown.matchAll(/^\|\s*`(jaw_[a-z0-9_]+)`\s*\|/gm)].map((m) => m[1]));
}

export function compare(documented, served) {
  return {
    missing: served.filter((name) => !documented.has(name)).sort(),
    extra: [...documented].filter((name) => !served.includes(name)).sort(),
  };
}

export function cliVersion(skillMarkdown) {
  const pin = skillMarkdown.match(/`@jaw\.id\/cli@(\d+\.\d+\.\d+)`/);
  if (!pin) throw new Error('SKILL.md must name the CLI it was written against as `@jaw.id/cli@x.y.z`');
  return pin[1];
}

export function checkSkill({ local, hosted }) {
  const problems = [];
  for (const [doc, served, server] of [
    [LOCAL_DOC, local, 'the CLI'],
    [HOSTED_DOC, hosted, 'the hosted server'],
  ]) {
    const { missing, extra } = compare(documentedTools(read(doc)), served);
    if (missing.length) problems.push(`${doc}: served by ${server} but not documented: ${missing.join(', ')}`);
    if (extra.length) problems.push(`${doc}: documented but not served by ${server}: ${extra.join(', ')}`);
  }
  return problems;
}

// One initialize and one tools/list over newline-delimited JSON-RPC.
export function listTools(command, args, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`no tools/list answer within ${timeoutMs} ms`));
    }, timeoutMs);
    const finish = (settle) => {
      clearTimeout(timer);
      child.kill();
      settle();
    };
    let pending = '';
    child.stdout.on('data', (chunk) => {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop();
      for (const line of lines) {
        const msg = JSON.parse(line);
        if (msg.id === 2) finish(() => resolve(msg.result.tools.map((t) => t.name)));
      }
    });
    child.on('error', (err) => finish(() => reject(err)));
    child.on('exit', (code) => finish(() => reject(new Error(`${command} exited with code ${code} before listing its tools`))));
    const send = (msg) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check-tools', version: '1' } } });
    send({ method: 'notifications/initialized' });
    send({ id: 2, method: 'tools/list' });
  });
}

export function sourceTools(dir, ref) {
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  const files = git('ls-tree', '--name-only', `${ref}:apps/mcp/src/tools`)
    .split('\n')
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const tools = files.flatMap((f) =>
    [...git('show', `${ref}:apps/mcp/src/tools/${f}`).matchAll(/registerTool\(\s*'(jaw_[a-z0-9_]+)'/g)].map((m) => m[1]),
  );
  return { source: `jaw-agent@${git('rev-parse', '--short', ref).trim()}`, tools: tools.sort() };
}

async function main([flag, dir, ref = 'origin/main']) {
  if (flag === '--refresh-hosted') {
    writeFileSync(MANIFEST, JSON.stringify(sourceTools(dir, ref), null, 2) + '\n');
    return 0;
  }
  // Transitive dependencies must be a week old; JAW's own packages are exempt
  // so the check can follow a release the day it ships.
  const local = await listTools('pnpm', [
    '--config.minimum-release-age=10080',
    '--config.minimum-release-age-exclude=@jaw.id/*',
    'dlx',
    `@jaw.id/cli@${cliVersion(read('jaw-cli/SKILL.md'))}`,
    'mcp',
  ]);
  const { tools: hosted } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const problems = checkSkill({ local, hosted });
  for (const p of problems) console.error(p);
  if (!problems.length) console.log(`ok: ${local.length} CLI tools, ${hosted.length} hosted tools`);
  return problems.length ? 1 : 0;
}

if (fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) process.exitCode = await main(process.argv.slice(2));
