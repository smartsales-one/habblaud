// Personagem externo na interface (shared/external.ts): o clique nele dentro de outra página e o que a gaveta mostra.
//
// - Dentro de um iframe da MESMA origem (ex.: o Claudio, que mostra o escritório na própria página), escolher o personagem
//   externo avisa a página de fora — window.parent.postMessage({type: 'habblaud:external-select', id}, location.origin),
//   com o id da rota (/api/external/agents/:id, sem o prefixo "external:"; ex.: "claudio") — e a gaveta não abre: quem
//   mostra o personagem é a página de fora. Fora de iframe (ou num iframe de outra origem), a gaveta comum abre.
//   Um duplo clique vale como um clique: uma mensagem só (externalSelectNotifier) e a câmera não passa a segui-lo.
// - Na gaveta, o externo não tem terminal, mensagens, editor de personagem, conta, estatísticas de sessão, subagentes nem
//   vida social (ele não entra nas rodas): só nome, estado, atividade, tarefas e a linha do tempo.
import { EXTERNAL_ID_PREFIX, isExternalAgent } from '../../../shared/external';
import type { AgentInfo } from '../../../shared/types';

/** Tipo da mensagem para a página de fora. */
export const EXTERNAL_SELECT_MESSAGE = 'habblaud:external-select';

/** O que a página de fora recebe. */
export interface ExternalSelectMessage {
  type: typeof EXTERNAL_SELECT_MESSAGE;
  /** O id da rota, sem o prefixo "external:" (o mesmo do PUT /api/external/agents/:id). */
  id: string;
}

/** O pedaço da janela que importa (testável sem DOM). */
export interface FrameWindow {
  readonly location: { readonly origin: string };
  readonly parent: unknown;
  postMessage?: unknown;
}

/** Id da rota de um id de snapshot do externo ("external:claudio" -> "claudio"). */
export function externalKey(id: string): string {
  return id.startsWith(EXTERNAL_ID_PREFIX) ? id.slice(EXTERNAL_ID_PREFIX.length) : id;
}

/**
 * A janela de fora, quando o Habblaud está num iframe da mesma origem; null fora de iframe ou com a página de fora em
 * outra origem (ler a origem dela lança: a mensagem não sai do escritório).
 */
export function sameOriginParent(win: FrameWindow): { postMessage(message: unknown, targetOrigin: string): void } | null {
  try {
    const parent = win.parent as FrameWindow | null | undefined;
    if (!parent || parent === win) return null;
    if (parent.location.origin !== win.location.origin) return null;
    return typeof parent.postMessage === 'function' ? (parent as unknown as { postMessage(message: unknown, targetOrigin: string): void }) : null;
  } catch {
    return null;
  }
}

/**
 * Escolheram o personagem externo: dentro de um iframe da mesma origem, avisa a página de fora e retorna true (a gaveta
 * não abre). Agente de verdade, fora de iframe ou com outra origem: false (segue a gaveta comum).
 */
export function notifyExternalSelect(agent: Pick<AgentInfo, 'id' | 'provider'> | undefined, win: FrameWindow = window): boolean {
  if (!agent || !isExternalAgent(agent)) return false;
  const parent = sameOriginParent(win);
  if (!parent) return false;
  const message: ExternalSelectMessage = { type: EXTERNAL_SELECT_MESSAGE, id: externalKey(agent.id) };
  try {
    parent.postMessage(message, win.location.origin);
  } catch {
    return false;
  }
  return true;
}

/** Um duplo clique entrega 2 cliques e o duplo: dentro desta janela, o mesmo personagem não é avisado de novo. */
export const EXTERNAL_SELECT_REPEAT_MS = 600;

/**
 * notifyExternalSelect com uma mensagem só por clique: os cliques repetidos no mesmo personagem dentro de
 * EXTERNAL_SELECT_REPEAT_MS (o duplo clique) não mandam outra, mas continuam sem abrir a gaveta (retorna true).
 */
export function externalSelectNotifier(frame?: FrameWindow, clock: () => number = () => Date.now()): (agent: Pick<AgentInfo, 'id' | 'provider'> | undefined) => boolean {
  let last: { id: string; at: number } | null = null;
  return (agent) => {
    // a janela só na hora do clique (a interface também é montada em testes sem DOM)
    const win = frame ?? (typeof window === 'undefined' ? undefined : window);
    if (!win || !agent || !isExternalAgent(agent) || !sameOriginParent(win)) return false;
    const now = clock();
    if (last && last.id === agent.id && now - last.at < EXTERNAL_SELECT_REPEAT_MS) return true;
    if (!notifyExternalSelect(agent, win)) return false;
    last = { id: agent.id, at: now };
    return true;
  };
}

/**
 * Partes da gaveta do agente que valem para ele (o externo só tem as de leitura). A caixa de mensagem e o editor do
 * personagem se escondem sozinhos (composerMode e canEditCharacter já recusam o externo).
 */
export interface AgentDrawerParts {
  terminal: boolean;
  account: boolean;
  stats: boolean;
  team: boolean;
  social: boolean;
  /** O nome da sala leva à gaveta da sala (a Gerência não tem gaveta). */
  roomLink: boolean;
}

export function agentDrawerParts(a: Pick<AgentInfo, 'provider'>): AgentDrawerParts {
  const all = !isExternalAgent(a);
  return { terminal: all, account: all, stats: all, team: all, social: all, roomLink: all };
}
