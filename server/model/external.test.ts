// Personagem externo no modelo (Office.upsertExternal/removeExternal): agente principal comum no snapshot, mas fora
// de office.list() (Habblaud World, terminal, personagem do projeto), sem aviso nem feed, e com expiração de 90 s.
import { describe, expect, it } from 'vitest';
import { EXTERNAL_TTL_MS, externalAgentId, GERENCIA_ROOM_ID } from '../../shared/external';
import { setQuiet } from '../log';
import { modSummary } from '../http/app';
import { NameStore } from './names';
import { Office, OFFLINE_GRACE_MS, SNAPSHOT_RECENT } from './office';

setQuiet(true);

function makeOffice() {
  let clock = 1_000_000;
  const office = new Office({
    names: new NameStore(null),
    version: 't',
    startedAt: clock,
    accounts: () => [],
    sources: () => [],
    accountName: () => undefined,
    now: () => clock,
  });
  return { office, advance: (ms: number) => (clock += ms), now: () => clock };
}

const ID = externalAgentId('claudio');
const agentOf = (office: Office) => office.commit().snapshot.agents.find((a) => a.id === ID);

describe('Office: personagem externo', () => {
  it('entra no snapshot como agente principal externo, na Gerência, sem conta, sessão nem mensagens', () => {
    const { office, now } = makeOffice();
    expect(office.upsertExternal('claudio', { name: 'Claudio', room: 'gerencia', status: 'working', activity: 'Ouvindo você' })).toBe('created');
    const r = office.commit();
    const a = r.snapshot.agents.find((x) => x.id === ID)!;
    expect(a).toMatchObject({
      id: 'external:claudio',
      kind: 'main',
      provider: 'external',
      roomId: GERENCIA_ROOM_ID,
      name: 'Claudio',
      status: 'working',
      canMessage: false,
      account: '',
      sessionId: '',
      startedAt: now(),
      statusSince: now(),
    });
    expect(a.activity).toMatchObject({ text: 'Ouvindo você', at: now() });
    expect(a.recent.map((x) => x.text)).toEqual(['Ouvindo você']);
    expect(GERENCIA_ROOM_ID).toBe('core:gerencia');
    // A Gerência é uma área fixa do cliente: não vira sala de projeto.
    expect(r.snapshot.rooms).toEqual([]);
    // Nem aviso ("chegou", "precisa de você") nem feed: o Claudio fala por conta própria.
    expect(r.notices).toEqual([]);
    expect(r.feed).toEqual([]);
    expect(r.snapshot.accounts).toEqual([]);
  });

  it('fica fora de office.list()/get()/has() (World, terminal, personagem), mas tem detalhe', () => {
    const { office } = makeOffice();
    office.upsertExternal('claudio', { name: 'Claudio', room: 'gerencia', status: 'idle' });
    expect(office.list()).toEqual([]);
    expect(office.get(ID)).toBeUndefined();
    expect(office.has(ID)).toBe(false);
    expect(office.isExternal(ID)).toBe(true);
    expect(office.isExternal('claudio')).toBe(false);
    expect(office.detail(ID)?.agent.name).toBe('Claudio');
    expect(office.setCharacter(ID, { name: 'Outro', seed: 1, parts: {} })).toEqual({ result: 'not-found' });
    expect(office.resetCharacter(ID)).toBe('not-found');
  });

  it('PUT é upsert: status, waitingFor, nome, aparência e atividade refletem no snapshot', () => {
    const { office, advance, now } = makeOffice();
    office.upsertExternal('claudio', { name: 'Claudio', room: 'gerencia', status: 'idle' });
    let a = agentOf(office)!;
    expect(a.activity).toBeUndefined();
    expect(a.waitingFor).toBeUndefined();
    const since = a.statusSince;

    advance(1_000);
    expect(office.upsertExternal('claudio', { name: 'Cláudio', room: 'gerencia', status: 'waiting', waitingFor: 'Para qual projeto?', seed: 7, look: 'm' })).toBe('updated');
    a = agentOf(office)!;
    expect(a).toMatchObject({ name: 'Cláudio', status: 'waiting', waitingFor: 'Para qual projeto?', seed: 7, look: 'm', statusSince: since + 1_000 });

    // Mesmo status: statusSince não muda; sair da espera tira o waitingFor.
    advance(1_000);
    office.upsertExternal('claudio', { name: 'Cláudio', room: 'gerencia', status: 'waiting', waitingFor: 'Para qual projeto?' });
    expect(agentOf(office)!.statusSince).toBe(since + 1_000);
    office.upsertExternal('claudio', { name: 'Cláudio', room: 'gerencia', status: 'working', activity: 'Abrindo o projeto' });
    a = agentOf(office)!;
    expect(a.waitingFor).toBeUndefined();
    expect(a.statusSince).toBe(now());
    expect(a.activity?.text).toBe('Abrindo o projeto');
    // Sem seed/look no PUT: volta ao padrão do id (a aparência é a do último PUT, não acumulada).
    expect(a.seed).not.toBe(7);
  });

  it('atividade: uma nova vira a atual e entra no recent; a mesma repetida não duplica; ausente mantém a última', () => {
    const { office, advance } = makeOffice();
    const put = (activity?: string) => office.upsertExternal('claudio', { name: 'Claudio', room: 'gerencia', status: 'working', ...(activity ? { activity } : {}) });
    put('Primeira frase');
    advance(1_000);
    put('Primeira frase');
    put();
    advance(1_000);
    put('Segunda frase');
    advance(1_000);
    put('Primeira frase');
    const a = agentOf(office)!;
    expect(a.recent.map((x) => x.text)).toEqual(['Primeira frase', 'Segunda frase', 'Primeira frase']);
    expect(a.activity?.text).toBe('Primeira frase');
    expect(new Set(a.recent.map((x) => x.id)).size).toBe(3);
    expect(office.detail(ID)?.history.map((x) => x.text)).toEqual(['Primeira frase', 'Segunda frase', 'Primeira frase']);
    // O snapshot leva só as últimas, como os outros agentes.
    for (let i = 0; i < 20; i++) put(`Frase ${i}`);
    expect(agentOf(office)!.recent).toHaveLength(SNAPSHOT_RECENT);
  });

  it('PUT de vida idêntico não gera snapshot novo', () => {
    const { office, advance } = makeOffice();
    const body = { name: 'Claudio', room: 'gerencia', status: 'idle', activity: 'Oi' } as const;
    office.upsertExternal('claudio', body);
    office.commit();
    advance(30_000);
    office.upsertExternal('claudio', body);
    expect(office.commit().changed).toBe(false);
  });

  it('sem PUT por 90 s vira offline e depois sai; um PUT antes disso renova', () => {
    const { office, advance } = makeOffice();
    const body = { name: 'Claudio', room: 'gerencia', status: 'working' } as const;
    office.upsertExternal('claudio', body);
    advance(EXTERNAL_TTL_MS - 1);
    office.tick();
    expect(agentOf(office)?.status).toBe('working');
    office.upsertExternal('claudio', body); // renova
    advance(EXTERNAL_TTL_MS - 1);
    office.tick();
    expect(agentOf(office)?.status).toBe('working');
    advance(1);
    office.tick();
    const off = agentOf(office)!;
    expect(off.status).toBe('offline');
    expect(off.waitingFor).toBeUndefined();
    advance(OFFLINE_GRACE_MS);
    office.tick();
    expect(agentOf(office)).toBeUndefined();
    expect(office.isExternal(ID)).toBe(false);
  });

  it('PUT durante a saída traz de volta', () => {
    const { office, advance } = makeOffice();
    office.upsertExternal('claudio', { name: 'Claudio', room: 'gerencia', status: 'idle' });
    advance(EXTERNAL_TTL_MS);
    office.tick();
    expect(agentOf(office)?.status).toBe('offline');
    office.upsertExternal('claudio', { name: 'Claudio', room: 'gerencia', status: 'idle' });
    advance(OFFLINE_GRACE_MS);
    office.tick();
    expect(agentOf(office)?.status).toBe('idle');
  });

  it('removeExternal tira na hora; id desconhecido devolve false', () => {
    const { office } = makeOffice();
    office.upsertExternal('claudio', { name: 'Claudio', room: 'gerencia', status: 'idle' });
    office.commit();
    expect(office.removeExternal('claudio')).toBe(true);
    const r = office.commit();
    expect(r.changed).toBe(true);
    expect(r.snapshot.agents).toEqual([]);
    expect(office.removeExternal('claudio')).toBe(false);
    expect(office.removeExternal('outro')).toBe(false);
  });

  it('esperando conta em "precisam de você" do resumo do mod, com a sala Gerência', () => {
    const { office } = makeOffice();
    office.upsertExternal('claudio', { name: 'Claudio', room: 'gerencia', status: 'waiting', waitingFor: 'Para qual projeto?' });
    const snap = office.commit().snapshot;
    const s = modSummary(snap, (id) => office.has(id) || office.isExternal(id), 't');
    expect(s.agents).toBe(1);
    expect(s.waiting).toHaveLength(1);
    expect(s.waiting[0]).toMatchObject({ id: ID, name: 'Claudio', room: 'Gerência', waitingFor: 'Para qual projeto?', answerable: false });
  });

  it('o nome do externo não é sorteado para um agente de verdade', () => {
    const { office, now } = makeOffice();
    office.upsertExternal('x', { name: 'Marina', room: 'gerencia', status: 'idle' });
    // Muitos agentes: o sorteio passaria por "Marina" se ela não estivesse ocupada.
    for (let i = 0; i < 60; i++) {
      office.addMain({ id: `acc:${i}`, account: 'acc', sessionId: `s${i}`, cwd: '/p/a', role: 'x', startedAt: now(), status: 'idle' });
    }
    expect(office.list().some((a) => a.name === 'Marina')).toBe(false);
  });
});
