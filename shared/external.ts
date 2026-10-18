// Personagem externo: um agente que não é do Claude Code nem do Codex (ex.: o assistente de voz Claudio), posto no
// escritório por PUT /api/external/agents/:id (server/http/external.ts) e guardado à parte no Office
// (server/model/office.ts). Código puro: sem APIs de Node nem de DOM.
//
// - Entra no snapshot como um agente principal comum: provider 'external', id "external:<id>", na sala fixa da
//   Gerência (GERENCIA_ROOM_ID, desenhada pelo cliente; nunca uma sala de projeto), canMessage false, sem conta,
//   sessão, terminal nem transcript.
// - Sem PUT por EXTERNAL_TTL_MS, vira offline e sai.
// - NUNCA vai ao Habblaud World (shared/world/projection.ts e server/world/uplink.ts o tiram, e a Gerência também),
//   nem à linha do tempo do timelapse nem ao "Meu dia": o prédio no mundo mostra só os agentes de verdade.
import { tr } from './i18n';
import type { AgentInfo, AgentStatus } from './types';

/** Prefixo do id do externo no snapshot: "external:claudio" (não colide com os ids das ferramentas). */
export const EXTERNAL_ID_PREFIX = 'external:';
/** A sala fixa da Gerência (área do cliente, como a Copa): onde fica o externo com `room: "gerencia"`. */
export const GERENCIA_ROOM_ID = 'core:gerencia';
/** Sem PUT por este tempo, o externo vira offline (e sai depois do período de graça de quem encerra a sessão). */
export const EXTERNAL_TTL_MS = 90_000;
/** Id na rota: minúsculas, dígitos e hífen, de 1 a 32. */
export const EXTERNAL_KEY_RE = /^[a-z0-9-]{1,32}$/;
export const EXTERNAL_NAME_MAX = 30;
export const EXTERNAL_ACTIVITY_MAX = 120;
export const EXTERNAL_WAITING_MAX = 80;

/** Salas aceitas em `room` (por enquanto só a Gerência) e o id de cada uma no snapshot. */
export const EXTERNAL_ROOMS = { gerencia: GERENCIA_ROOM_ID } as const;
export type ExternalRoom = keyof typeof EXTERNAL_ROOMS;

/** Status que o externo pode ter (offline é só o da expiração). */
export type ExternalStatus = Extract<AgentStatus, 'working' | 'waiting' | 'idle'>;
const STATUSES: readonly ExternalStatus[] = ['working', 'waiting', 'idle'];

/** Corpo do PUT, já validado. */
export interface ExternalAgentInput {
  name: string;
  room: ExternalRoom;
  status: ExternalStatus;
  activity?: string;
  waitingFor?: string;
  seed?: number;
  look?: 'f' | 'm';
}

export function externalAgentId(key: string): string {
  return EXTERNAL_ID_PREFIX + key;
}

export function isExternalId(id: string): boolean {
  return id.startsWith(EXTERNAL_ID_PREFIX);
}

/** É o personagem externo (pelo provider ou pelo id)? */
export function isExternalAgent(a: Pick<AgentInfo, 'id' | 'provider'>): boolean {
  return a.provider === 'external' || isExternalId(a.id);
}

/** Nome traduzido de uma sala fixa do externo (undefined = não é uma delas). */
export function externalRoomName(roomId: string): string | undefined {
  return roomId === GERENCIA_ROOM_ID ? tr('Gerência') : undefined;
}

/** Caracteres de controle, separadores de linha/parágrafo e controles de direção do texto (bidi). */
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/u;

/** Texto de uma linha: espaços e quebras viram um espaço; vazio, longo demais ou com controle = null. */
function line(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!s || CONTROL.test(s) || [...s].length > max) return null;
  return s;
}

/** Valida o corpo do PUT. null = inválido (campos desconhecidos são ignorados). */
export function parseExternalAgent(raw: unknown): ExternalAgentInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name = line(r.name, EXTERNAL_NAME_MAX);
  if (!name) return null;
  if (typeof r.room !== 'string' || !Object.hasOwn(EXTERNAL_ROOMS, r.room)) return null;
  if (!(STATUSES as readonly unknown[]).includes(r.status)) return null;
  const out: ExternalAgentInput = { name, room: r.room as ExternalRoom, status: r.status as ExternalStatus };
  for (const [key, max] of [
    ['activity', EXTERNAL_ACTIVITY_MAX],
    ['waitingFor', EXTERNAL_WAITING_MAX],
  ] as const) {
    const given = r[key];
    if (given === undefined) continue;
    if (typeof given !== 'string') return null;
    // Texto vazio (ou só espaços) = sem o campo; o resto passa pela mesma regra do nome.
    if (!given.trim()) continue;
    const v = line(given, max);
    if (!v) return null;
    out[key] = v;
  }
  if (r.seed !== undefined) {
    if (typeof r.seed !== 'number' || !Number.isInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff) return null;
    out.seed = r.seed;
  }
  if (r.look !== undefined) {
    if (r.look !== 'f' && r.look !== 'm') return null;
    out.look = r.look;
  }
  return out;
}
