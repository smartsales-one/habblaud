import { describe, expect, it, vi } from 'vitest';
import type { AgentInfo, OfficeSnapshot } from '../../../shared/types';
import { canEditCharacter } from './character-model';
import { composerMode } from './composer-model';
import {
  agentDrawerParts,
  EXTERNAL_SELECT_MESSAGE,
  EXTERNAL_SELECT_REPEAT_MS,
  externalKey,
  externalSelectNotifier,
  notifyExternalSelect,
  sameOriginParent,
  type FrameWindow,
} from './external';
import { computeCounters, groupRooms } from './model';
import { ptyControllable } from './ptyapi';

const ORIGIN = 'http://127.0.0.1:8765';
const claudio = { id: 'external:claudio', provider: 'external' } as const;
const real = { id: '.claude:123', provider: 'claude' } as const;

/** Página de fora (o Claudio) e o iframe do Habblaud dentro dela. */
function framed(parentOrigin = ORIGIN): { win: FrameWindow; post: ReturnType<typeof vi.fn> } {
  const post = vi.fn();
  const parent = { location: { origin: parentOrigin }, parent: null as unknown, postMessage: post };
  parent.parent = parent;
  return { win: { location: { origin: ORIGIN }, parent }, post };
}

describe('clique no personagem externo', () => {
  it('dentro de um iframe da mesma origem: avisa a página de fora com o id da rota e a gaveta não abre', () => {
    const { win, post } = framed();
    expect(notifyExternalSelect(claudio, win)).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith({ type: EXTERNAL_SELECT_MESSAGE, id: 'claudio' }, ORIGIN);
    expect(EXTERNAL_SELECT_MESSAGE).toBe('habblaud:external-select');
  });

  it('fora de iframe: nada é mandado (a gaveta comum abre)', () => {
    const post = vi.fn();
    const win: FrameWindow = { location: { origin: ORIGIN }, parent: null, postMessage: post };
    (win as { parent: unknown }).parent = win;
    expect(sameOriginParent(win)).toBeNull();
    expect(notifyExternalSelect(claudio, win)).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('iframe de outra origem: nada sai do escritório', () => {
    const { win, post } = framed('https://outro.exemplo');
    expect(notifyExternalSelect(claudio, win)).toBe(false);
    // o navegador lança ao ler a origem de uma página de fora de outra origem
    const throwing: FrameWindow = {
      location: { origin: ORIGIN },
      parent: {
        get location(): never {
          throw new DOMException('Blocked a frame', 'SecurityError');
        },
        postMessage: post,
      },
    };
    expect(sameOriginParent(throwing)).toBeNull();
    expect(notifyExternalSelect(claudio, throwing)).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('agente de verdade (ou desconhecido): sempre a gaveta comum, mesmo no iframe', () => {
    const { win, post } = framed();
    expect(notifyExternalSelect(real, win)).toBe(false);
    // um agente de verdade de uma conta numa pasta "external" (id "external:<pid>") continua sendo de verdade
    expect(notifyExternalSelect({ id: 'external:4321', provider: 'claude' }, win)).toBe(false);
    expect(notifyExternalSelect(undefined, win)).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('duplo clique (dois cliques e o duplo): uma mensagem só, e a gaveta continua fechada', () => {
    const { win, post } = framed();
    let now = 1_000;
    const notify = externalSelectNotifier(win, () => now);
    expect(notify(claudio)).toBe(true);
    now += 150;
    expect(notify(claudio)).toBe(true);
    now += 10;
    expect(notify(claudio)).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    // outro clique depois: outra mensagem
    now += EXTERNAL_SELECT_REPEAT_MS;
    expect(notify(claudio)).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);
    // fora de iframe ou agente de verdade: nada, e a gaveta abre
    expect(notify(real)).toBe(false);
    const alone: FrameWindow = { location: { origin: ORIGIN }, parent: null };
    (alone as { parent: unknown }).parent = alone;
    expect(externalSelectNotifier(alone, () => now)(claudio)).toBe(false);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('o id vai sem o prefixo "external:"', () => {
    expect(externalKey('external:claudio')).toBe('claudio');
    expect(externalKey('external:assistente-2')).toBe('assistente-2');
    expect(externalKey('claudio')).toBe('claudio');
  });
});

const ext: AgentInfo = {
  id: 'external:claudio',
  kind: 'main',
  provider: 'external',
  roomId: 'core:gerencia',
  name: 'Claudio',
  look: 'm',
  role: 'Personagem externo',
  sessionId: '',
  account: '',
  status: 'working',
  recent: [],
  tasks: [],
  startedAt: 1,
  lastEventAt: 1,
  statusSince: 1,
  stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, subagents: 0 },
  seed: 7,
  canMessage: false,
};

describe('gaveta do personagem externo (fora de iframe)', () => {
  it('sem terminal, mensagens, editor, conta, estatísticas, equipe, vida social nem link para a sala', () => {
    expect(agentDrawerParts(ext)).toEqual({ terminal: false, account: false, stats: false, team: false, social: false, roomLink: false });
    expect(Object.values(agentDrawerParts({ provider: 'claude' })).every(Boolean)).toBe(true);
    expect(Object.values(agentDrawerParts({})).every(Boolean)).toBe(true);
    expect(Object.values(agentDrawerParts({ provider: 'codex' })).every(Boolean)).toBe(true);
  });

  it('caixa de mensagem desligada, lápis do personagem escondido e nada de assumir a sessão', () => {
    const env = { enabled: true, local: true, replaying: false };
    expect(composerMode(ext, env).kind).toBe('off');
    expect(composerMode({ ...ext, canMessage: true }, env).kind).toBe('off');
    expect(canEditCharacter(ext, { live: true, terminal: true, local: true, replaying: false, mock: false })).toBe(false);
    expect(ptyControllable(ext)).toBe(false);
  });

  it('a Gerência não é sala de projeto: fora da lista de salas e do contador do topo', () => {
    const snap: Pick<OfficeSnapshot, 'rooms' | 'agents' | 'accounts'> = {
      rooms: [{ id: '/a', name: 'a', path: '/a', slot: 0, seed: 1, createdAt: 1 }],
      agents: [{ ...ext, id: '.claude:1', provider: undefined, roomId: '/a', account: '.claude', canMessage: true }, ext],
      accounts: [],
    };
    expect(computeCounters(snap).rooms).toBe(1);
    expect(groupRooms(snap).map((g) => g.room.id)).toEqual(['/a']);
  });
});
