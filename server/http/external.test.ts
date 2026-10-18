// Rota do personagem externo (PUT|DELETE /api/external/agents/:id, http/external.ts): a trava do terminal
// (ptyRequestProblem), a validação do corpo, o upsert e o DELETE, por um servidor de verdade na porta local.
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OfficeSnapshot } from '../../shared/types';
import { AccountsService } from '../accounts/service';
import { setQuiet } from '../log';
import { NameStore } from '../model/names';
import { Office } from '../model/office';
import { tempDir } from '../test/fixtures';
import { createApiHandler, type ApiDeps } from './app';
import { createRequestGuard } from './guard';
import { Hub } from './sse';

setQuiet(true);

interface Env {
  base: string;
  port: string;
  office: Office;
  deps: ApiDeps;
  close: () => Promise<void>;
  cleanup: () => void;
}

async function start(): Promise<Env> {
  const tmp = tempDir();
  const accounts = new AccountsService({ dirs: [], home: tmp.dir, env: {}, onChange: () => {} });
  const office = new Office({ names: new NameStore(null), version: '9.9.9', startedAt: Date.now(), accounts: () => [], sources: () => [], accountName: () => undefined });
  const hub = new Hub(office, { throttleMs: 10 });
  hub.start();
  const deps: ApiDeps = { office, hub, accounts, sources: () => [], version: '9.9.9', inDocker: false };
  const api = createApiHandler(deps);
  const guard = createRequestGuard({ allowedHosts: new Set(['habblaud.lan']) });
  const server = http.createServer((req, res) => {
    if (guard(req, res)) return;
    const url = new URL(req.url ?? '/', 'http://x');
    if (!api(req, res, url)) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = String((server.address() as AddressInfo).port);
  return {
    base: `http://127.0.0.1:${port}`,
    port,
    office,
    deps,
    close: () =>
      new Promise((ok) => {
        hub.stop();
        server.closeAllConnections();
        server.close(() => ok());
      }),
    cleanup: tmp.cleanup,
  };
}

interface Res {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** Requisição crua (o fetch não deixa trocar Host nem Sec-Fetch-Site). */
function request(env: Env, path: string, opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<Res> {
  const body = opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  const headers: Record<string, string> = { Host: `localhost:${env.port}`, 'Content-Type': 'application/json', ...opts.headers };
  return new Promise((ok, fail) => {
    const req = http.request({ host: '127.0.0.1', port: env.port, path, method: opts.method ?? 'GET', headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (text += c));
      res.on('end', () => ok({ status: res.statusCode ?? 0, headers: res.headers, body: text }));
    });
    req.on('error', fail);
    req.end(body);
  });
}

const ROUTE = '/api/external/agents/claudio';
const OK_BODY = { name: 'Claudio', room: 'gerencia', status: 'working', activity: 'Ouvindo você' };

async function snapshot(env: Env): Promise<OfficeSnapshot> {
  return JSON.parse((await request(env, '/api/snapshot')).body) as OfficeSnapshot;
}

const errorOf = (r: Res): string => (JSON.parse(r.body) as { error: string }).error;

describe('PUT|DELETE /api/external/agents/:id', () => {
  let env: Env;
  beforeEach(async () => {
    env = await start();
  });
  afterEach(async () => {
    await env.close();
    env.cleanup();
  });

  it('PUT cria e atualiza (upsert); o snapshot mostra o externo na Gerência', async () => {
    const created = await request(env, ROUTE, { method: 'PUT', body: OK_BODY });
    expect(created.status).toBe(200);
    expect(JSON.parse(created.body)).toEqual({ ok: true, id: 'external:claudio' });
    let a = (await snapshot(env)).agents.find((x) => x.id === 'external:claudio')!;
    expect(a).toMatchObject({ provider: 'external', kind: 'main', roomId: 'core:gerencia', status: 'working', canMessage: false, name: 'Claudio' });
    expect(a.activity?.text).toBe('Ouvindo você');

    const updated = await request(env, ROUTE, { method: 'PUT', body: { ...OK_BODY, status: 'waiting', waitingFor: 'Para qual projeto?', activity: 'Para qual projeto?' } });
    expect(updated.status).toBe(200);
    const snap = await snapshot(env);
    expect(snap.agents.filter((x) => x.provider === 'external')).toHaveLength(1);
    a = snap.agents.find((x) => x.id === 'external:claudio')!;
    expect(a).toMatchObject({ status: 'waiting', waitingFor: 'Para qual projeto?' });
    expect(a.recent.map((x) => x.text)).toEqual(['Ouvindo você', 'Para qual projeto?']);
  });

  it('DELETE tira na hora (204); id desconhecido também é 204', async () => {
    await request(env, ROUTE, { method: 'PUT', body: OK_BODY });
    const del = await request(env, ROUTE, { method: 'DELETE' });
    expect(del.status).toBe(204);
    expect(del.body).toBe('');
    expect((await snapshot(env)).agents).toEqual([]);
    expect((await request(env, ROUTE, { method: 'DELETE' })).status).toBe(204);
    expect((await request(env, '/api/external/agents/nunca-existiu', { method: 'DELETE' })).status).toBe(204);
  });

  it('a trava do terminal: Host da rede, Origin de outra origem e Sec-Fetch-Site cross-site/same-site são recusados', async () => {
    const refused: Array<Record<string, string>> = [
      { Host: 'habblaud.lan' },
      { Host: `192.168.0.9:${env.port}` },
      { Origin: 'http://localhost:9999' },
      { Origin: `http://127.0.0.1:${env.port}` },
      { 'Sec-Fetch-Site': 'cross-site' },
      { 'Sec-Fetch-Site': 'same-site' },
    ];
    for (const headers of refused) {
      for (const method of ['PUT', 'DELETE']) {
        // DELETE vai sem corpo (o Node não manda Content-Length nele: o corpo viraria o começo do próximo pedido).
        const r = await request(env, ROUTE, { method, headers, ...(method === 'PUT' ? { body: OK_BODY } : {}) });
        expect(r.status, `${method} ${JSON.stringify(headers)}`).toBe(403);
        expect(errorOf(r)).toMatch(/próprio computador/);
      }
    }
    expect((await snapshot(env)).agents).toEqual([]);
    // Mesma origem, pelo navegador: passa.
    const same = await request(env, ROUTE, { method: 'PUT', headers: { Origin: `http://localhost:${env.port}`, 'Sec-Fetch-Site': 'same-origin' }, body: OK_BODY });
    expect(same.status).toBe(200);
  });

  it('conexão que não vem do próprio computador é recusada antes de ler o corpo', () => {
    const api = createApiHandler(env.deps);
    let status = 0;
    let body = '';
    const req = {
      method: 'PUT',
      url: ROUTE,
      headers: { host: `localhost:${env.port}`, 'content-type': 'application/json' },
      socket: { remoteAddress: '192.168.0.9' },
      resume() {},
      on() {
        throw new Error('o corpo não deveria ser lido');
      },
    } as unknown as IncomingMessage;
    const res = {
      headersSent: false,
      setHeader() {},
      writeHead(s: number) {
        status = s;
      },
      end(d?: string) {
        body = d ?? '';
      },
    } as unknown as ServerResponse;
    expect(api(req, res, new URL(ROUTE, 'http://x'))).toBe(true);
    expect(status).toBe(403);
    expect(errorOf({ status, headers: {}, body })).toMatch(/próprio computador/);
    expect(env.office.isExternal('external:claudio')).toBe(false);
  });

  it('validação do corpo: 400 com a mensagem traduzida', async () => {
    const bad: unknown[] = [
      {},
      [],
      JSON.stringify('texto'),
      { ...OK_BODY, name: undefined },
      { ...OK_BODY, name: '' },
      { ...OK_BODY, name: '   ' },
      { ...OK_BODY, name: 'x'.repeat(31) },
      { ...OK_BODY, name: 42 },
      { ...OK_BODY, name: 'Clau\u0007dio' },
      { ...OK_BODY, room: undefined },
      { ...OK_BODY, room: 'copa' },
      { ...OK_BODY, room: 'Gerencia' },
      { ...OK_BODY, status: undefined },
      { ...OK_BODY, status: 'offline' },
      { ...OK_BODY, status: 'done' },
      { ...OK_BODY, status: 'shell' },
      { ...OK_BODY, activity: 'x'.repeat(121) },
      { ...OK_BODY, activity: 7 },
      { ...OK_BODY, waitingFor: 'x'.repeat(81) },
      { ...OK_BODY, waitingFor: false },
      { ...OK_BODY, seed: -1 },
      { ...OK_BODY, seed: 1.5 },
      { ...OK_BODY, seed: '3' },
      { ...OK_BODY, look: 'x' },
    ];
    for (const body of bad) {
      const r = await request(env, ROUTE, { method: 'PUT', body: body === undefined ? 'null' : body });
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(errorOf(r)).toMatch(/esperado \{name/);
    }
    expect((await request(env, ROUTE, { method: 'PUT', body: 'null' })).status).toBe(400);
    expect((await snapshot(env)).agents).toEqual([]);
    // Nos limites: passa (e o texto é limpo: espaços repetidos e quebras de linha viram um espaço).
    const edge = { name: ` ${'n'.repeat(30)} `, room: 'gerencia', status: 'idle', activity: `${'a'.repeat(118)}\n\nb`, waitingFor: 'w'.repeat(80), seed: 4294967295, look: 'f' };
    expect((await request(env, ROUTE, { method: 'PUT', body: edge })).status).toBe(200);
    const a = (await snapshot(env)).agents[0];
    expect(a).toMatchObject({ name: 'n'.repeat(30), seed: 4294967295, look: 'f', status: 'idle' });
    expect(a.activity?.text).toBe(`${'a'.repeat(118)} b`);
    // Campos desconhecidos são ignorados (versões futuras do Claudio).
    expect((await request(env, ROUTE, { method: 'PUT', body: { ...OK_BODY, extra: true } })).status).toBe(200);
  });

  it('id: só [a-z0-9-]{1,32}', async () => {
    for (const id of ['Claudio', 'a_b', 'a.b', 'x'.repeat(33), '%41', 'caf%C3%A9']) {
      const r = await request(env, `/api/external/agents/${id}`, { method: 'PUT', body: OK_BODY });
      expect(r.status, id).toBe(400);
      expect(errorOf(r)).toMatch(/id inválido/);
    }
    for (const id of ['claudio-2', '0', 'z'.repeat(32)]) {
      expect((await request(env, `/api/external/agents/${id}`, { method: 'PUT', body: OK_BODY })).status, id).toBe(200);
    }
    expect((await snapshot(env)).agents.map((a) => a.id).sort()).toEqual(['external:0', 'external:claudio-2', `external:${'z'.repeat(32)}`]);
  });

  it('corpo que não é JSON: 415 (Content-Type) e 400 (JSON inválido)', async () => {
    const plain = await request(env, ROUTE, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(OK_BODY) });
    expect(plain.status).toBe(415);
    const broken = await request(env, ROUTE, { method: 'PUT', body: '{' });
    expect(broken.status).toBe(400);
    expect(errorOf(broken)).toMatch(/JSON inválido/);
    expect((await snapshot(env)).agents).toEqual([]);
  });

  it('método errado: 405 com Allow; outra rota de /api/external: 404', async () => {
    for (const method of ['GET', 'POST']) {
      const r = await request(env, ROUTE, { method, ...(method === 'POST' ? { body: OK_BODY } : {}) });
      expect(r.status, method).toBe(405);
      expect(r.headers.allow).toBe('PUT, DELETE');
    }
    expect((await request(env, '/api/external/agents', { method: 'PUT', body: OK_BODY })).status).toBe(404);
    expect((await request(env, '/api/external/agents/claudio/x', { method: 'PUT', body: OK_BODY })).status).toBe(404);
  });
});
