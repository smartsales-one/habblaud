import { describe, expect, it } from 'vitest';
import { FURNITURE, TILE, type FurnitureKind, type RoomTheme } from '../../art/api';
import { BUILDING_H, COL_W, CORE_COLS, CORRIDOR_Y, SOUTH_Y } from '../constants';
import { assembleBuilding, coreAreas } from './building';
import { columnsFor, inRect, slotAt, slotColumn, slotRect, slotSide } from './geometry';
import { layoutProjectRoom, roomVariant } from './room';
import { layoutExterior, slotShell } from './exterior';
import { GERENCIA_SLOT, layoutManagement, RECEPTION_ID } from './core';
import type { AreaLayout } from './types';

const theme: RoomTheme = {
  carpet: '#4f6d8f',
  carpet2: '#486685',
  wall: { base: '#e6e2da', trim: '#9a8f80', pattern: 'plain' },
  accent: '#3f7fd8',
  deskVariant: 'wood',
  chairVariant: 'black',
};

function roomsFor(slots: number[]): AreaLayout[] {
  return slots.map((slot) => layoutProjectRoom({ id: `/proj/${slot}`, slot, seed: 1000 + slot * 77 }, theme));
}

describe('mapeamento de slots', () => {
  it('coluna = núcleo + floor(slot/2); par = norte, ímpar = sul', () => {
    expect(slotColumn(0)).toBe(2);
    expect(slotColumn(1)).toBe(2);
    expect(slotColumn(2)).toBe(3);
    expect(slotColumn(7)).toBe(5);
    expect(slotSide(0)).toBe('north');
    expect(slotSide(1)).toBe('south');
    expect(slotSide(6)).toBe('north');
    expect(slotAt(3, 'south')).toBe(3);
    expect(slotAt(slotColumn(9), slotSide(9))).toBe(9);
  });

  it('retângulos das salas não se sobrepõem e respeitam o corredor', () => {
    const a = slotRect(0);
    const b = slotRect(1);
    expect(a).toEqual({ x: 2 * COL_W, y: 0, w: COL_W, h: 12 });
    expect(b.y).toBe(SOUTH_Y);
    expect(a.y + a.h).toBe(CORRIDOR_Y);
    expect(b.y + b.h).toBe(BUILDING_H);
  });

  it('largura do prédio: núcleo + maior coluna usada + 1 (mínimo 1 coluna de projeto)', () => {
    expect(columnsFor([])).toBe(3);
    expect(columnsFor([0, 1])).toBe(3);
    expect(columnsFor([5])).toBe(5);
    expect(columnsFor([2, 11])).toBe(8);
  });
});

describe('layout do prédio', () => {
  const slots = [0, 1, 2, 3, 4, 7];
  const rooms = roomsFor(slots);
  const cols = columnsFor(slots);
  const b = assembleBuilding(cols, rooms);
  const reception = coreAreas().find((a) => a.id === RECEPTION_ID)!;
  const elevator = reception.spots.find((s) => s.kind === 'elevator')!;
  const reach = b.grid.reachableFrom(elevator.tx, elevator.ty);
  const reachable = (x: number, y: number) => reach[y * b.grid.w + x] === 1;

  it('há dois elevadores com tiles de aproximação caminháveis', () => {
    const elevators = reception.spots.filter((s) => s.kind === 'elevator');
    expect(elevators).toHaveLength(2);
    for (const e of elevators) expect(b.grid.walkable(e.tx, e.ty)).toBe(true);
  });

  it('todos os spots são alcançáveis a partir dos elevadores', () => {
    const unreachable = b.spots.filter((s) => !reachable(s.tx, s.ty)).map((s) => s.id);
    expect(unreachable).toEqual([]);
  });

  it('as portas conectam cada sala ao corredor', () => {
    for (const room of rooms) {
      const door = room.door!;
      expect(door).toBeDefined();
      for (let x = door.x; x < door.x + door.w; x++) {
        for (let y = door.y; y < door.y + door.h; y++) expect(b.grid.walkable(x, y)).toBe(true);
        // tile do corredor imediatamente fora da porta
        const outside = room.side === 'north' ? door.y + door.h : door.y - 1;
        expect(outside >= CORRIDOR_Y && outside < SOUTH_Y).toBe(true);
        expect(reachable(x, outside)).toBe(true);
      }
      // o interior inteiro (fora móveis) é alcançável
      const r = room.rect;
      for (let y = r.y + 2; y < r.y + 11; y++)
        for (let x = r.x + 1; x < r.x + 15; x++) if (b.grid.walkable(x, y)) expect(reachable(x, y)).toBe(true);
    }
  });

  it('cada sala tem 6 mesas, ao menos 4 lugares extras sentados, interruptor e quadro', () => {
    for (const room of rooms) {
      const desks = room.spots.filter((s) => s.kind === 'desk');
      expect(desks).toHaveLength(6);
      expect(new Set(desks.map((d) => d.rank))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
      expect(desks.filter((d) => d.side === 'N')).toHaveLength(3);
      expect(room.spots.filter((s) => s.kind === 'stool' || s.kind === 'nook').length).toBeGreaterThanOrEqual(4);
      expect(room.spots.filter((s) => s.kind === 'stand').length).toBeGreaterThanOrEqual(3);
      expect(room.spots.filter((s) => s.kind === 'switch')).toHaveLength(1);
      expect(room.wallItems.some((w) => w.kind === 'whiteboard')).toBe(true);
      expect(room.wallItems.some((w) => w.kind === 'sign')).toBe(true);
      expect(room.wallItems.some((w) => w.kind === 'light_switch')).toBe(true);
      for (const d of desks) expect(room.furniture.some((f) => f.id === d.deskId)).toBe(true);
    }
  });

  it('móveis bloqueantes não se sobrepõem e ficam dentro da área', () => {
    for (const area of [...b.core, b.corridor, ...rooms]) {
      const used = new Map<string, string>();
      for (const f of area.furniture) {
        const def = FURNITURE[f.kind];
        expect(def.mount).toBe('floor');
        for (let y = f.ty; y < f.ty + def.footprint.h; y++) {
          for (let x = f.tx; x < f.tx + def.footprint.w; x++) {
            expect(x >= area.rect.x && x < area.rect.x + area.rect.w && y >= area.rect.y && y < area.rect.y + area.rect.h).toBe(true);
            const key = `${x},${y}`;
            if (def.blocks) {
              expect(used.get(key), `${f.id} sobre ${used.get(key)}`).toBeUndefined();
              used.set(key, f.id);
            }
          }
        }
      }
      for (const w of area.wallItems) expect(FURNITURE[w.kind].mount).toBe('wall');
    }
  });

  it('spots têm ids únicos', () => {
    const ids = b.spots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pontos de conversa e ping-pong vêm em pares', () => {
    const groups = new Map<string, number>();
    for (const s of b.spots) if (s.group && (s.kind === 'talk' || s.kind === 'pingpong')) groups.set(s.group, (groups.get(s.group) ?? 0) + 1);
    for (const [, n] of groups) expect(n).toBe(2);
  });

  it('corredor alterna bebedouro e banco nas colunas de projeto, sem excesso de plantas', () => {
    const coolers = b.corridor.furniture.filter((f) => f.kind === 'water_cooler');
    expect(coolers.length).toBeGreaterThanOrEqual(Math.ceil((cols - 2) / 2));
    const benches = b.corridor.furniture.filter((f) => f.kind === 'bench');
    expect(benches.length).toBeGreaterThanOrEqual(Math.floor((cols - 2) / 2));
    const plants = b.corridor.furniture.filter((f) => f.kind === 'plant_tall' || f.kind === 'plant_small');
    expect(plants.length).toBeLessThanOrEqual(cols * 2);
  });

  it('a área externa e os pátios cobrem o prédio', () => {
    const ext = layoutExterior(cols);
    expect(ext.bounds.x).toBeLessThan(0);
    expect(ext.bounds.x + ext.bounds.w).toBeGreaterThan(cols * COL_W);
    const shell = slotShell(5, true);
    expect(shell.walls.length).toBeGreaterThan(0);
    expect(shell.props.every((p) => p.slot === 5)).toBe(true);
  });
});

/** Móveis de chão altos que escondem o que está pendurado na parede logo atrás. */
const TALL_FLOOR = new Set<FurnitureKind>(['plant_tall', 'bookshelf', 'binder_shelf', 'fridge', 'vending_machine', 'arcade', 'water_cooler', 'floor_lamp', 'toilet_stall']);
const WALL_DECOR = new Set<FurnitureKind>(['painting', 'poster', 'window', 'tv', 'whiteboard', 'sign', 'clock', 'mirror', 'door_frame']);

/** Itens de parede decorativos com algum móvel alto encostado na frente (ids). */
function hiddenWallItems(area: AreaLayout): string[] {
  const out: string[] = [];
  for (const w of area.wallItems) {
    if (w.on !== 'face' || !WALL_DECOR.has(w.kind)) continue;
    const half = (FURNITURE[w.kind].footprint.w * TILE) / 2 - 2;
    const wy = w.baseY / TILE;
    for (const f of area.furniture) {
      if (!TALL_FLOOR.has(f.kind) || f.ty !== wy) continue;
      const fx0 = f.tx * TILE + (f.dx ?? 0);
      const fx1 = fx0 + FURNITURE[f.kind].footprint.w * TILE;
      if (fx0 < w.cx + half && fx1 > w.cx - half) out.push(`${w.id} atrás de ${f.id}`);
    }
  }
  return out;
}

describe('variações das salas de projeto', () => {
  const seeds = Array.from({ length: 90 }, (_, i) => (i * 7919 + 13) >>> 0);

  it('toda variação é válida: sem sobreposição, tudo alcançável, lugares suficientes', () => {
    for (const slot of [0, 1]) {
      for (const seed of seeds) {
        const room = layoutProjectRoom({ id: `/v/${seed}`, slot, seed }, theme);
        const b = assembleBuilding(columnsFor([slot]), [room]);
        const used = new Map<string, string>();
        for (const f of room.furniture) {
          const def = FURNITURE[f.kind];
          for (let y = f.ty; y < f.ty + def.footprint.h; y++)
            for (let x = f.tx; x < f.tx + def.footprint.w; x++) {
              expect(x >= room.rect.x + 1 && x < room.rect.x + 15 && y >= room.rect.y + 2 && y < room.rect.y + 11, `${f.id} fora do piso`).toBe(true);
              if (!def.blocks) continue;
              expect(used.get(`${x},${y}`), `${f.id} sobre ${used.get(`${x},${y}`)}`).toBeUndefined();
              used.set(`${x},${y}`, f.id);
            }
        }
        const door = room.door!;
        const reach = b.grid.reachableFrom(door.x, door.y);
        for (const sp of room.spots) expect(reach[sp.ty * b.grid.w + sp.tx], `${sp.id} inalcançável (semente ${seed})`).toBe(1);
        const r = room.rect;
        for (let y = r.y + 2; y < r.y + 11; y++)
          for (let x = r.x + 1; x < r.x + 15; x++) if (b.grid.walkable(x, y)) expect(reach[y * b.grid.w + x], `tile ${x},${y} isolado (semente ${seed})`).toBe(1);
        expect(room.spots.filter((sp) => sp.kind === 'desk')).toHaveLength(6);
        expect(room.spots.filter((sp) => sp.kind === 'stool' || sp.kind === 'nook').length).toBeGreaterThanOrEqual(4);
        // spots de uso não podem cair em cima de móvel que bloqueia
        for (const sp of room.spots) expect(b.grid.walkable(sp.tx, sp.ty), `${sp.id} sobre móvel`).toBe(true);
        expect(hiddenWallItems(room)).toEqual([]);
      }
    }
  });

  it('as salas não são todas iguais: espelhamento, canto de reunião e cantos variam', () => {
    const vs = seeds.map(roomVariant);
    expect(new Set(vs.map((v) => v.mirror)).size).toBe(2);
    expect(new Set(vs.map((v) => v.meeting)).size).toBe(3);
    expect(new Set(vs.map((v) => v.left)).size).toBeGreaterThan(1);
    expect(new Set(vs.map((v) => v.right)).size).toBeGreaterThan(1);
    // o piso é porcelanato (azulejo é do banheiro) com um leve tom da sala
    const room = layoutProjectRoom({ id: '/v/x', slot: 0, seed: 42 }, theme);
    expect(room.floors.every((f) => f.kind !== 'tile_white')).toBe(true);
    expect(room.floorTint).toBe(theme.carpet);
  });
});

describe('Gerência (sala fixa do personagem externo)', () => {
  const g = layoutManagement();
  // com a Gerência na vaga 0, as salas de projeto começam na vaga 1
  const slots = [1, 2, 3, 4];
  const rooms = roomsFor(slots);
  const cols = columnsFor([GERENCIA_SLOT, ...slots]);
  const b = assembleBuilding(cols, [g, ...rooms]);
  const reception = coreAreas().find((a) => a.id === RECEPTION_ID)!;
  const elevator = reception.spots.find((s) => s.kind === 'elevator')!;
  const reach = b.grid.reachableFrom(elevator.tx, elevator.ty);

  it('ocupa a primeira vaga: a coluna logo depois do núcleo, ao norte do corredor', () => {
    expect(g.id).toBe('core:gerencia');
    expect(g.rect).toEqual(slotRect(GERENCIA_SLOT));
    expect(g.rect).toEqual({ x: CORE_COLS * COL_W, y: 0, w: COL_W, h: 12 });
    expect(g.side).toBe('north');
    // não muda o núcleo nem a largura do prédio: sem salas de projeto, continua com 1 coluna de projeto
    expect(coreAreas().map((a) => a.id)).toEqual(['core:recepcao', 'core:banheiros', 'core:copa', 'core:lounge']);
    expect(columnsFor([GERENCIA_SLOT])).toBe(columnsFor([]));
  });

  it('mesa de diretor com computador e cadeira (o único lugar de trabalho), quadro, placa, sofá e plantas; sem interruptor', () => {
    const desks = g.spots.filter((s) => s.kind === 'desk');
    expect(desks).toHaveLength(1);
    const desk = g.furniture.find((f) => f.id === desks[0].deskId)!;
    expect(desk.kind).toBe('desk_back');
    expect(g.furniture.some((f) => f.kind === 'office_chair_front' && f.id === desks[0].furnitureId)).toBe(true);
    expect(desks[0].seated).toBe(true);
    expect(g.spots.some((s) => s.kind === 'stool' || s.kind === 'nook' || s.kind === 'stand')).toBe(false);
    expect(g.wallItems.some((w) => w.kind === 'whiteboard')).toBe(true);
    expect(g.wallItems.some((w) => w.kind === 'sign' && w.id === g.signId)).toBe(true);
    expect(g.furniture.some((f) => f.kind === 'sofa')).toBe(true);
    expect(g.spots.filter((s) => s.kind === 'sofa')).toHaveLength(3);
    expect(g.furniture.some((f) => f.kind === 'plant_tall' || f.kind === 'plant_small')).toBe(true);
    expect(g.spots.some((s) => s.kind === 'switch')).toBe(false);
    expect(g.wallItems.some((w) => w.kind === 'light_switch')).toBe(false);
    expect(g.spots.every((s) => s.areaId === g.id)).toBe(true);
  });

  it('móveis dentro do piso e sem sobreposição; tudo alcançável a partir dos elevadores pela porta', () => {
    const used = new Map<string, string>();
    for (const f of g.furniture) {
      const def = FURNITURE[f.kind];
      expect(def.mount).toBe('floor');
      for (let y = f.ty; y < f.ty + def.footprint.h; y++)
        for (let x = f.tx; x < f.tx + def.footprint.w; x++) {
          expect(x >= g.rect.x + 1 && x < g.rect.x + 15 && y >= g.rect.y + 2 && y < g.rect.y + 11, `${f.id} fora do piso`).toBe(true);
          if (!def.blocks) continue;
          expect(used.get(`${x},${y}`), `${f.id} sobre ${used.get(`${x},${y}`)}`).toBeUndefined();
          used.set(`${x},${y}`, f.id);
        }
    }
    for (const w of g.wallItems) expect(FURNITURE[w.kind].mount).toBe('wall');
    for (const s of g.spots) {
      expect(b.grid.walkable(s.tx, s.ty), `${s.id} sobre móvel`).toBe(true);
      expect(reach[s.ty * b.grid.w + s.tx], `${s.id} inalcançável`).toBe(1);
    }
    const door = g.door!;
    for (let x = door.x; x < door.x + door.w; x++) {
      expect(reach[door.y * b.grid.w + x]).toBe(1);
      // o tile do corredor logo abaixo da porta
      expect(door.y + 1).toBe(CORRIDOR_Y);
    }
    const r = g.rect;
    for (let y = r.y + 2; y < r.y + 11; y++)
      for (let x = r.x + 1; x < r.x + 15; x++) if (b.grid.walkable(x, y)) expect(reach[y * b.grid.w + x], `tile ${x},${y} isolado`).toBe(1);
    expect(hiddenWallItems(g)).toEqual([]);
    const ids = b.spots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('as salas de projeto, o corredor e a área externa são os mesmos com ou sem ela', () => {
    // a mesma vaga dá o mesmo retângulo (a Gerência só reserva a vaga 0)
    for (const s of [1, 2, 7]) expect(slotRect(s)).toEqual(roomsFor([s])[0].rect);
    const without = assembleBuilding(cols, rooms);
    expect(without.corridor).toEqual(b.corridor);
    expect(b.rect).toEqual(without.rect);
    expect(b.grid.w).toBe(cols * COL_W);
    // a Gerência só soma ao que já existia: fora dela, a grade é a mesma
    for (let y = 0; y < BUILDING_H; y++)
      for (let x = 0; x < cols * COL_W; x++) if (!inRect(g.rect, x, y)) expect(b.grid.get(x, y), `${x},${y}`).toBe(without.grid.get(x, y));
  });
});

describe('itens de parede', () => {
  it('quadros, janelas, TV, placas e espelhos não ficam atrás de móveis altos', () => {
    for (const area of [...coreAreas(), layoutManagement(), ...roomsFor([0, 1, 2, 3, 4, 7])]) expect(hiddenWallItems(area), area.id).toEqual([]);
  });

  it('passagens nas faces das paredes têm batente', () => {
    const restroom = coreAreas().find((a) => a.kind === 'restroom')!;
    expect(restroom.wallItems.some((w) => w.kind === 'door_frame')).toBe(true);
    for (const room of roomsFor([1, 3, 7])) expect(room.wallItems.some((w) => w.kind === 'door_frame'), room.id).toBe(true);
  });
});
