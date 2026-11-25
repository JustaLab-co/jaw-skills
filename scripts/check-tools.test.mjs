import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { checkSkill, cliVersion, compare, documentedTools, listTools, sourceTools } from './check-tools.mjs';

const ROOT = join(import.meta.dirname, '..');
const fake = join(import.meta.dirname, 'fixtures', 'fake-mcp.mjs');
const manifest = JSON.parse(readFileSync(join(import.meta.dirname, 'hosted-tools.json'), 'utf8'));
const LOCAL = [
  'jaw_rpc', 'jaw_config_show', 'jaw_config_set', 'jaw_status', 'jaw_disconnect', 'jaw_session_status',
  'jaw_grant_permissions', 'jaw_pay_and_fetch', 'jaw_x402_log', 'jaw_x402_balance', 'jaw_discover',
];

test('documentedTools reads only the first cell of table rows', () => {
  const md = [
    '| Tool | What |',
    '| --- | --- |',
    '| `jaw_a` | calls `jaw_b` first |',
    '|`jaw_c`|tight|',
    '| Follows | `jaw_second_cell` |',
    'Prose naming `jaw_d` is not a row.',
    '- `jaw_e` in a list is not a row.',
  ].join('\n');
  assert.deepEqual([...documentedTools(md)].sort(), ['jaw_a', 'jaw_c']);
});

test('compare names what is served but undocumented, and documented but not served, sorted', () => {
  assert.deepEqual(compare(new Set(['jaw_old_z', 'jaw_a', 'jaw_old_b']), ['jaw_new_z', 'jaw_a', 'jaw_new_b']), {
    missing: ['jaw_new_b', 'jaw_new_z'],
    extra: ['jaw_old_b', 'jaw_old_z'],
  });
  assert.deepEqual(compare(new Set(['jaw_a']), ['jaw_a']), { missing: [], extra: [] });
});

test('cliVersion reads the pinned version from the skill', () => {
  assert.equal(cliVersion('Written against `@jaw.id/cli@0.12.3` and the hosted server.'), '0.12.3');
  assert.equal(cliVersion('`@jaw.id/cli@10.20.30`'), '10.20.30');
  assert.throws(() => cliVersion('no pin here'), /@jaw\.id\/cli@/);
});

test('listTools asks a stdio server for its tools after the handshake', async () => {
  assert.deepEqual(await listTools(process.execPath, [fake, 'jaw_x', 'jaw_y']), ['jaw_x', 'jaw_y']);
});

test('listTools fails when the server exits without answering', async () => {
  await assert.rejects(listTools(process.execPath, [fake, '--exit']), /exited with code 3/);
});

test('listTools fails when the command does not exist', async () => {
  await assert.rejects(listTools('jaw-no-such-command', []), /ENOENT/);
});

test('listTools gives up on a server that never answers', async () => {
  await assert.rejects(listTools(process.execPath, [fake, '--silent'], 300), /no tools\/list answer within 300 ms/);
});

test('the skill documents every tool both servers serve, and nothing else', () => {
  assert.deepEqual(checkSkill({ local: LOCAL, hosted: manifest.tools }), []);
});

test('checkSkill reports each side by name', () => {
  const problems = checkSkill({ local: [...LOCAL, 'jaw_new_one', 'jaw_new_two'], hosted: manifest.tools.slice(2) });
  assert.deepEqual(problems, [
    'jaw-cli/rules/mcp.md: served by the CLI but not documented: jaw_new_one, jaw_new_two',
    `jaw-cli/rules/hosted-mcp.md: documented but not served by the hosted server: ${manifest.tools.slice(0, 2).join(', ')}`,
  ]);
});

// origin/main serves jaw_alpha and jaw_beta; HEAD adds jaw_gamma; the working
// tree adds jaw_dirty, which no ref has.
function jawAgentRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'jaw-agent-'));
  const tools = join(dir, 'apps/mcp/src/tools');
  mkdirSync(tools, { recursive: true });
  writeFileSync(join(tools, 'a.ts'), "server.registerTool(\n    'jaw_beta',\n  {});\nserver.registerTool('jaw_alpha', {});");
  writeFileSync(join(tools, 'a.test.ts'), "server.registerTool('jaw_test_only', {});");
  writeFileSync(join(tools, 'notes.md'), "server.registerTool('jaw_in_markdown', {});");
  writeFileSync(join(tools, 'wrap.ts'), 'server.registerTool = ((name: string) => name);');
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();
  const commit = () => {
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x');
    return git('rev-parse', '--short', 'HEAD');
  };
  git('init', '-q');
  const main = commit();
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  writeFileSync(join(tools, 'b.ts'), "server.registerTool('jaw_gamma', {});");
  const head = commit();
  appendFileSync(join(tools, 'b.ts'), "\nserver.registerTool('jaw_dirty', {});");
  return { dir, main, head };
}

test('sourceTools reads tool names and the commit from the given ref, not the working tree', () => {
  const { dir, head } = jawAgentRepo();
  assert.deepEqual(sourceTools(dir, 'HEAD'), { source: `jaw-agent@${head}`, tools: ['jaw_alpha', 'jaw_beta', 'jaw_gamma'] });
});

// Runs the script as CI does, from a copy of the repo, with a pnpm on PATH that
// serves FAKE_TOOLS only when called with the release-age gate and the pin.
function run(args, { tools = LOCAL, edit } = {}) {
  const copy = mkdtempSync(join(tmpdir(), 'jaw-skills-'));
  for (const dir of ['jaw-cli', 'scripts']) cpSync(join(ROOT, dir), join(copy, dir), { recursive: true });
  edit?.(copy);
  const result = spawnSync(process.execPath, [join(copy, 'scripts/check-tools.mjs'), ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: join(import.meta.dirname, 'fixtures', 'bin') + delimiter + process.env.PATH,
      FAKE_TOOLS: tools.join(' '),
      FAKE_CLI_VERSION: cliVersion(readFileSync(join(ROOT, 'jaw-cli/SKILL.md'), 'utf8')),
    },
  });
  return { ...result, copy };
}

test('the script exits 0 and counts both servers when the docs match', () => {
  const { status, stdout } = run([]);
  assert.equal(status, 0);
  assert.equal(stdout, `ok: ${LOCAL.length} CLI tools, ${manifest.tools.length} hosted tools\n`);
});

test('the script exits 1 and names the drift on either server', () => {
  const { status, stdout, stderr } = run([], {
    tools: LOCAL.slice(1),
    edit: (copy) => appendFileSync(join(copy, 'jaw-cli/rules/hosted-mcp.md'), '\n| `jaw_gone` | removed |\n'),
  });
  assert.equal(status, 1);
  assert.equal(stdout, '');
  assert.equal(
    stderr,
    'jaw-cli/rules/mcp.md: documented but not served by the CLI: jaw_rpc\n' +
      'jaw-cli/rules/hosted-mcp.md: documented but not served by the hosted server: jaw_gone\n',
  );
});

test('the script fails when the CLI cannot be started the expected way', () => {
  const { status } = run([], { edit: (copy) => writeFileSync(join(copy, 'jaw-cli/SKILL.md'), 'Written against `@jaw.id/cli@9.9.9`.') });
  assert.equal(status, 1);
});

test('--refresh-hosted rewrites the manifest from origin/main by default', () => {
  const { dir, main } = jawAgentRepo();
  const { status, copy } = run(['--refresh-hosted', dir]);
  assert.equal(status, 0);
  assert.equal(
    readFileSync(join(copy, 'scripts/hosted-tools.json'), 'utf8'),
    JSON.stringify({ source: `jaw-agent@${main}`, tools: ['jaw_alpha', 'jaw_beta'] }, null, 2) + '\n',
  );
});
