// Rota POST /api/pty com `addDirs` (pastas extras, `claude --add-dir`): o corpo chega ao PtyManager, o terminal
// aberto devolve as pastas e um pedido inválido é recusado com 400 e o motivo. O spawn é de mentira (nenhum claude
// de verdade roda) e o servidor é um http local efêmero.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PtyInfo } from '../../shared/types';
import { setQuiet } from '../log';
import { PtyManager, type PtyProcess } from '../pty/manager';
import { tempDir } from '../test/fixtures';
import { createPtyRoutes } from './pty';

setQuiet(true);

const closers: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (closers.length) await closers.pop()!();
});

function fakeProc(pid: number): PtyProcess {
  return { pid, onData() {}, onExit() {}, write() {}, resize() {}, kill() {} };
}

async function serve(): Promise<{ base: string; spawned: string[][]; root: string }> {
  const tmp = tempDir();
  closers.push(tmp.cleanup);
  const spawned: string[][] = [];
  let pid = 500;
  const ptys = new PtyManager({
    spawn: (_file, args) => {
      spawned.push(args);
      return fakeProc(++pid);
    },
    claudeBin: process.execPath,
    accounts: () => [{ id: 'acc', dir: join(tmp.dir, 'conta'), isDefault: true }],
    agent: () => undefined,
    onChange: () => {},
  });
  const routes = createPtyRoutes(ptys);
  const server = http.createServer((req, res) => routes(req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  closers.push(() => new Promise<void>((ok) => server.close(() => ok())));
  const port = (server.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, spawned, root: tmp.dir };
}

const post = (base: string, body: unknown) =>
  fetch(`${base}/api/pty`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/pty com addDirs', () => {
  it('abre com as pastas extras e devolve o terminal com elas', async () => {
    const s = await serve();
    const [cwd, a, b] = ['smartcrm', 'discador', 'portal'].map((n) => join(s.root, n));
    for (const d of [cwd, a, b]) mkdirSync(d);
    const res = await post(s.base, { cwd, addDirs: [a, b], cols: 120, rows: 40 });
    expect(res.status).toBe(201);
    const info = (await res.json()) as PtyInfo;
    expect(info).toMatchObject({ cwd, addDirs: [a, b], agentId: expect.stringMatching(/^acc:\d+$/) });
    expect(s.spawned).toEqual([['--add-dir', a, '--add-dir', b]]);
  });

  it('sem addDirs: como sempre', async () => {
    const s = await serve();
    const res = await post(s.base, { cwd: s.root });
    expect(res.status).toBe(201);
    expect(((await res.json()) as PtyInfo).addDirs).toBeUndefined();
    expect(s.spawned).toEqual([[]]);
  });

  it('pasta extra inválida: 400 com o motivo, nada aberto', async () => {
    const s = await serve();
    const res = await post(s.base, { cwd: s.root, addDirs: [join(s.root, 'nao-existe')] });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('nao-existe');
    expect(s.spawned).toEqual([]);
  });
});
