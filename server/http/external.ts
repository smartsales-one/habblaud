// Personagem externo (shared/external.ts): um agente que não é do Claude Code nem do Codex, posto no escritório por um
// programa do próprio computador (ex.: o assistente de voz Claudio).
//   PUT    /api/external/agents/:id   {name, room: "gerencia", status, activity?, waitingFor?, seed?, look?}: 200 {ok, id}
//   DELETE /api/external/agents/:id   sai na hora: 204 (também para um id que não está no escritório)
// Mexe no que o escritório mostra: a MESMA trava do terminal interativo (ptyRequestProblem: conexão pelo loopback, Host
// local, Origin da mesma origem, sem Sec-Fetch-Site cross-site/same-site), só com o terminal ligado (ServerConfig.terminal:
// bind local e sem HABBLAUD_TERMINAL=0) e nunca pela porta remota (as duas conferidas em http/app.ts). A borda
// (http/guard.ts) já exige JSON em PUT e DELETE (DELETE vai sem corpo, mas com Content-Type: application/json).
// No máximo EXTERNAL_MAX externos ao mesmo tempo: um novo além disso é 429.
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  EXTERNAL_ACTIVITY_MAX,
  EXTERNAL_KEY_RE,
  EXTERNAL_MAX,
  EXTERNAL_NAME_MAX,
  EXTERNAL_WAITING_MAX,
  externalAgentId,
  parseExternalAgent,
} from '../../shared/external';
import type { Office } from '../model/office';
import { HttpError, readJson, sendJson } from './app';
import { ptyRequestProblem } from './pty';
import { tr } from '../../shared/i18n';

/** /api/external/agents/:id (o id cru da URL: só [a-z0-9-], então nunca precisa de decodificação). */
const ROUTE = /^\/api\/external\/agents\/([^/]+)$/;

/** Trata /api/external/* (a porta remota já foi recusada em http/app.ts). */
export async function handleExternalRoute(req: IncomingMessage, res: ServerResponse, path: string, office: Office): Promise<void> {
  if (ptyRequestProblem(req)) {
    req.resume();
    return sendJson(res, 403, { error: tr('o personagem externo só é atualizado pelo próprio computador (http://localhost)') });
  }
  const m = ROUTE.exec(path);
  if (!m) {
    req.resume();
    return sendJson(res, 404, { error: tr('rota desconhecida') });
  }
  const method = req.method ?? 'GET';
  if (method !== 'PUT' && method !== 'DELETE') {
    req.resume();
    res.setHeader('Allow', 'PUT, DELETE');
    return sendJson(res, 405, { error: tr('método não permitido') });
  }
  const key = m[1];
  if (!EXTERNAL_KEY_RE.test(key)) {
    req.resume();
    throw new HttpError(400, tr('id inválido'));
  }
  if (method === 'DELETE') {
    req.resume();
    office.removeExternal(key);
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    return void res.end();
  }
  const body = parseExternalAgent(await readJson(req));
  if (!body) {
    throw new HttpError(
      400,
      tr('esperado {name: texto de 1 a {0} caracteres, room: "gerencia", status: working, waiting ou idle, activity?: até {1} caracteres, waitingFor?: até {2} caracteres, seed?: inteiro de 0 a 4294967295, look?: f ou m}', [
        EXTERNAL_NAME_MAX,
        EXTERNAL_ACTIVITY_MAX,
        EXTERNAL_WAITING_MAX,
      ]),
    );
  }
  const r = office.upsertExternal(key, body);
  if (r === 'full') throw new HttpError(429, tr('personagens externos demais: no máximo {0} ao mesmo tempo', [EXTERNAL_MAX]));
  if (r === 'conflict') throw new HttpError(409, tr('já existe um agente com este id no escritório'));
  sendJson(res, 200, { ok: true, id: externalAgentId(key) });
}
