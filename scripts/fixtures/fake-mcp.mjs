// A stdio MCP server that answers with the tool names given as arguments. It
// quits on a request a real client would not send, so a client that skips the
// handshake fails. `--exit` quits at once, `--silent` never answers, `--noise`
// prints a line that is not JSON, `--refuse` answers tools/list with an error,
// `--once` exits right after answering it.
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);
if (args.includes('--exit')) process.exit(3);
const silent = args.includes('--silent');
if (args.includes('--noise')) process.stdout.write('starting up\n');

const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
let greeted = false;
let initialized = false;

createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.jsonrpc !== '2.0' || silent) return;
  if (msg.method === 'initialize') {
    const { protocolVersion, clientInfo } = msg.params;
    if (!protocolVersion || !clientInfo?.name || !clientInfo?.version) process.exit(4);
    greeted = true;
    reply(msg.id, { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fake', version: '0' } });
  } else if (msg.method === 'notifications/initialized') {
    if (!greeted) process.exit(4);
    initialized = true;
  } else if (msg.method === 'tools/list') {
    if (!initialized) process.exit(5);
    if (args.includes('--refuse')) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'no tools here' } }) + '\n');
      return;
    }
    reply(msg.id, { tools: args.filter((a) => !a.startsWith('--')).map((name) => ({ name, inputSchema: { type: 'object' } })) });
    if (args.includes('--once')) process.exit(0);
  }
});
