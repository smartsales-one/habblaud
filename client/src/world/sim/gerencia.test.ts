// A Gerência no prédio: só existe com um personagem externo nela (provider 'external', roomId 'core:gerencia'), fica na
// primeira vaga depois do núcleo, é só dele (ninguém mais usa nada lá) e ele não sai dela (nem para a copa).
import { describe, expect, it } from 'vitest';
import type { AgentInfo, OfficeSnapshot, RoomInfo } from '../../../../shared/types';
import type { Appearance, ArtModule, RoomTheme } from '../../art/api';
import { DEFAULT_WORLD_OPTIONS } from '../api';
import { COL_W } from '../constants';
import { GERENCIA_ID, GERENCIA_SLOT } from '../layout/core';
import { columnsFor, inRect, slotRect } from '../layout/geometry';
import type { Character } from './character';
import { Sim } from './sim';

const theme: RoomTheme = {
  carpet: '#4f6d8f',
  carpet2: '#486685',
  wall: { base: '#e6e2da', trim: '#9a8f80', pattern: 'plain' },
  accent: '#3f7fd8',
  deskVariant: 'wood',
  chairVariant: 'black',
};

const appearance: Appearance = {
  skin: '#f0c8a0',
  hair: '#3a2a20',
  hairStyle: 'short',
  eyes: '#222',
  top: '#3f7fd8',
  topAccent: '#fff',
  topStyle: 'tshirt',
  bottom: '#333',
  shoes: '#111',
  accessory: 'none',
  accessoryColor: '#000',
  lanyard: null,
  look: 'm',
};

const art = { appearanceFromSeed: () => appearance, roomTheme: () => theme } as unknown as ArtModule;

const T0 = 1_700_000_000_000;

function room(id: string, slot: number): RoomInfo {
  return { id, name: id.replace('/', ''), path: id, slot, seed: slot * 99 + 7, createdAt: T0 };
}

function agent(id: string, roomId: string, status: AgentInfo['status'], extra: Partial<AgentInfo> = {}): AgentInfo {
  return {
    id,
    kind: 'main',
    roomId,
    name: id,
    look: 'f',
    role: 'Agente principal',
    sessionId: `s-${id}`,
    account: '.claude',
    status,
    recent: [],
    tasks: [],
    startedAt: T0,
    lastEventAt: T0,
    statusSince: T0,
    stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, subagents: 0 },
    seed: id.length * 1234567,
    ...extra,
  };
}

/** O personagem externo como o servidor o manda (server/model/office.ts, upsertExternal). */
function claudio(status: AgentInfo['status'], extra: Partial<AgentInfo> = {}): AgentInfo {
  return agent('external:claudio', GERENCIA_ID, status, { provider: 'external', name: 'Claudio', role: 'Personagem externo', sessionId: '', account: '', canMessage: false, seed: 4242, ...extra });
}

function snap(rooms: RoomInfo[], agents: AgentInfo[], rev = 1): OfficeSnapshot {
  return {
    rev,
    serverTime: T0,
    rooms,
    agents,
    accounts: [{ id: '.claude', short: 'C', name: 'Conta C', color: '#f08a3c', configDir: '~/.claude', sessions: 1, usageStatus: 'ok' }],
    meta: { demo: true, sources: [], startedAt: T0, version: 't' },
  };
}

function run(sim: Sim, clock: { now: number }, seconds: number, each?: () => void): void {
  const steps = Math.round(seconds * 30);
  for (let i = 0; i < steps; i++) {
    clock.now += 1000 / 30;
    sim.update(1 / 30, clock.now);
    each?.();
  }
}

function newSim(): Sim {
  return new Sim(art, () => ({ ...DEFAULT_WORLD_OPTIONS, liveliness: 'lively' }));
}

const gRect = slotRect(GERENCIA_SLOT);
const inGerencia = (c: Character) => inRect(gRect, c.tx, c.ty) || inRect(gRect, Math.floor(c.x / 16), Math.floor(c.y / 16));

describe('Gerência no prédio', () => {
  it('sem personagem externo, o prédio é o de sempre: sem Gerência, salas nas vagas 0 e 1', () => {
    const sim = newSim();
    const clock = { now: T0 };
    sim.applySnapshot(snap([room('/a', 0), room('/b', 1)], [agent('ana', '/a', 'working'), agent('bia', '/b', 'idle')]), clock.now);
    run(sim, clock, 0.5);
    expect(sim.rooms.has(GERENCIA_ID)).toBe(false);
    expect(sim.rooms.get('/a')!.slot).toBe(0);
    expect(sim.rooms.get('/b')!.slot).toBe(1);
    expect(sim.building.cols).toBe(columnsFor([0, 1]));
    expect(sim.building.spots.some((s) => s.areaId === GERENCIA_ID)).toBe(false);
  });

  it('com o externo já no primeiro snapshot: a Gerência pronta e acesa na vaga 0, as salas de projeto a partir da 1', () => {
    const sim = newSim();
    const clock = { now: T0 };
    sim.applySnapshot(snap([room('/a', 0), room('/b', 1)], [agent('ana', '/a', 'working'), agent('bia', '/b', 'idle'), claudio('working')]), clock.now);
    run(sim, clock, 0.5);
    const g = sim.rooms.get(GERENCIA_ID)!;
    expect(g).toBeDefined();
    expect(g.slot).toBe(GERENCIA_SLOT);
    expect(g.phase).toBe('ready');
    expect(g.lightOn).toBe(true);
    expect(g.layout.rect).toEqual(gRect);
    expect(g.info.name).toBe('Gerência');
    expect(sim.rooms.get('/a')!.slot).toBe(1);
    expect(sim.rooms.get('/b')!.slot).toBe(2);
    expect(sim.building.cols).toBe(columnsFor([0, 1, 2]));
    // a placa não ganha a bolinha de uma conta vazia (o externo não tem conta)
    expect(g.accounts).toEqual([]);
  });

  it('o externo senta na mesa do diretor: trabalhando digita, esperando levanta a mão', () => {
    const sim = newSim();
    const clock = { now: T0 };
    sim.applySnapshot(snap([room('/a', 0)], [agent('ana', '/a', 'working'), claudio('working')]), clock.now);
    run(sim, clock, 0.5);
    const c = sim.chars.get('external:claudio')!;
    const desk = sim.rooms.get(GERENCIA_ID)!.layout.spots.find((s) => s.kind === 'desk')!;
    expect(c.homeSpot).toBe(desk.id);
    expect(c.atSpot).toBe(desk.id);
    expect(c.pose).toBe('type');
    sim.applySnapshot(snap([room('/a', 0)], [agent('ana', '/a', 'working'), claudio('waiting', { waitingFor: 'Para qual projeto?' })], 2), clock.now);
    run(sim, clock, 0.5);
    expect(c.mode).toBe('wait');
    expect(c.atSpot).toBe(desk.id);
    expect(c.pose).toBe('raise_hand');
  });

  it('parado, o externo senta ou anda só pela Gerência; ninguém mais entra nela', () => {
    const sim = newSim();
    const clock = { now: T0 - 600_000 };
    const idle = { statusSince: T0 - 600_000 };
    const agents = [claudio('idle', idle), agent('ana', '/a', 'idle', idle), agent('bia', '/a', 'idle', idle), agent('caio', '/b', 'idle', idle), agent('duda', '/b', 'idle', idle)];
    sim.applySnapshot(snap([room('/a', 0), room('/b', 1)], agents), clock.now);
    const c = sim.chars.get('external:claudio')!;
    const others = [...sim.chars.values()].filter((o) => o !== c);
    let outside = 0;
    let intruders = 0;
    let away = 0;
    run(sim, clock, 480, () => {
      if (!inGerencia(c)) outside++;
      if (c.atSpot !== c.homeSpot) away++;
      for (const o of others) if (inGerencia(o)) intruders++;
    });
    expect(outside).toBe(0);
    expect(intruders).toBe(0);
    // e ele de fato saiu da mesa em algum momento (sofá, quadro, janela, estante ou espreguiçar)
    expect(away).toBeGreaterThan(0);
    expect(c.gathering).toBeNull();
  });

  it('a Gerência é só do externo, e ele só usa os lugares dela', () => {
    const sim = newSim();
    const clock = { now: T0 };
    sim.applySnapshot(snap([room('/a', 0)], [agent('ana', '/a', 'idle'), claudio('idle')]), clock.now);
    const sofa = sim.spots.ofKind('sofa').find((s) => s.areaId === GERENCIA_ID)!;
    const coffee = sim.spots.ofKind('coffee')[0];
    expect(sim.spots.isFree(sofa.id, 'ana')).toBe(false);
    expect(sim.spots.reserve(sofa.id, 'ana')).toBe(false);
    expect(sim.spots.isFree(sofa.id, 'external:claudio')).toBe(true);
    expect(sim.spots.isFree(coffee.id, 'external:claudio')).toBe(false);
    expect(sim.spots.isFree(coffee.id, 'ana')).toBe(true);
    // rodas (sem dono) também não usam a Gerência
    expect(sim.spots.isFree(sofa.id)).toBe(false);
  });

  it('chegando depois: a sala de projeto da vaga 0 se muda e a Gerência é construída lá; o externo vai para a mesa', () => {
    const sim = newSim();
    const clock = { now: T0 };
    sim.applySnapshot(snap([room('/a', 0)], [agent('ana', '/a', 'working')]), clock.now);
    run(sim, clock, 0.5);
    expect(sim.rooms.get('/a')!.slot).toBe(0);
    sim.applySnapshot(snap([room('/a', 0)], [agent('ana', '/a', 'working'), claudio('working')], 2), clock.now);
    // a sala muda de endereço na hora (vaga 1); a antiga vira fantasma até esvaziar e ser desmontada
    expect(sim.rooms.get('/a')!.slot).toBe(1);
    expect(sim.rooms.has(GERENCIA_ID)).toBe(false);
    run(sim, clock, 40, () => void 0);
    const g = sim.rooms.get(GERENCIA_ID)!;
    expect(g).toBeDefined();
    expect(g.slot).toBe(GERENCIA_SLOT);
    expect(g.phase).toBe('ready');
    expect([...sim.rooms.values()].filter((r) => r.slot === GERENCIA_SLOT)).toHaveLength(1);
    const c = sim.chars.get('external:claudio')!;
    const desk = g.layout.spots.find((s) => s.kind === 'desk')!;
    expect(c.atSpot).toBe(desk.id);
    expect(c.pose).toBe('type');
    const ana = sim.chars.get('ana')!;
    expect(inRect(sim.rooms.get('/a')!.layout.rect, ana.tx, ana.ty)).toBe(true);
  });

  it('sem o externo, a Gerência apaga, é desmontada e a vaga volta para as salas de projeto', () => {
    const sim = newSim();
    const clock = { now: T0 };
    sim.applySnapshot(snap([room('/a', 0), room('/b', 1)], [agent('ana', '/a', 'working'), agent('bia', '/b', 'working'), claudio('working')]), clock.now);
    run(sim, clock, 0.5);
    expect(sim.rooms.get('/b')!.slot).toBe(2);
    sim.applySnapshot(snap([room('/a', 0), room('/b', 1)], [agent('ana', '/a', 'working'), agent('bia', '/b', 'working'), claudio('offline')], 2), clock.now);
    run(sim, clock, 40);
    expect(sim.chars.has('external:claudio')).toBe(false);
    expect(sim.rooms.has(GERENCIA_ID)).toBe(false);
    sim.applySnapshot(snap([room('/a', 0), room('/b', 1)], [agent('ana', '/a', 'working'), agent('bia', '/b', 'working')], 3), clock.now);
    run(sim, clock, 40);
    // a sala mais distante se mudou para a vaga livre: sem buraco onde estava a Gerência
    expect(new Set([...sim.rooms.values()].filter((r) => !r.ghost).map((r) => r.slot))).toEqual(new Set([0, 1]));
    expect(sim.building.cols).toBe(columnsFor([0, 1]));
    expect(sim.building.cols * COL_W).toBe(sim.building.grid.w);
  });
});
