// A fonte bitmap da marca (a mesma de scripts/assets/pixelart.py, que gera a placa assets/brand/signage.png e os
// textos do og-image): proporcional, maiúsculas 5x7, com acentos. Aqui ela desenha o logotipo da barra do topo a partir
// do nome do escritório (HABBLAUD_OFFICE_NAME) e a placa da recepção (world/render/plate.ts). Mudou um glifo lá, mude
// aqui também: pixel-font.test.ts compara as tabelas com as do pixelart.py. Puro: nada de DOM.
import { DEFAULT_OFFICE_NAME } from '../../../shared/office-name';

/**
 * Célula de 9 linhas: maiúsculas e ascendentes nas linhas 0-6, altura-x de 5 linhas (2-6), descendentes nas linhas
 * 7-8 e acentos das minúsculas nas linhas 0-1. Glifos com 7 linhas não têm descendente. Espaço entre letras: 1 px.
 */
export const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##', '.#..', '.#..', '###.', '.#..', '.#..', '.#..'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  j: ['...#', '....', '..##', '...#', '...#', '...#', '...#', '#..#', '.##.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['....', '....', '#.##', '##..', '#...', '#...', '#...'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#..', '.#..', '###.', '.#..', '.#..', '.#..', '..##'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ':': ['.', '.', '#', '.', '.', '.', '#'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
};

/** Acentos das minúsculas (linhas 0-1); nos glifos estreitos (i), as 3 colunas do meio. */
export const ACCENTS = {
  acute: ['...#.', '..#..'],
  grave: ['.#...', '..#..'],
  circ: ['..#..', '.#.#.'],
  tilde: ['.##.#', '#..#.'],
} as const;
export const ACCENTED: Readonly<Record<string, readonly [string, keyof typeof ACCENTS]>> = {
  á: ['a', 'acute'],
  à: ['a', 'grave'],
  â: ['a', 'circ'],
  ã: ['a', 'tilde'],
  é: ['e', 'acute'],
  ê: ['e', 'circ'],
  ó: ['o', 'acute'],
  ô: ['o', 'circ'],
  õ: ['o', 'tilde'],
  ú: ['u', 'acute'],
  í: ['i', 'acute'],
};

/** Altura da célula (com os descendentes) e das maiúsculas. */
export const CELL_HEIGHT = 9;
export const CAP_HEIGHT = 7;

function buildFont(): Map<string, readonly string[]> {
  const font = new Map<string, readonly string[]>();
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    const blank = '.'.repeat(rows[0].length);
    font.set(ch, [...rows, ...Array<string>(CELL_HEIGHT - rows.length).fill(blank)]);
  }
  for (const [ch, [base, accent]] of Object.entries(ACCENTED)) {
    const rows = [...font.get(base)!];
    const [top, bottom]: readonly string[] = ACCENTS[accent];
    const narrow = rows[0].length < 5;
    rows[0] = narrow ? top.slice(1, 4) : top;
    rows[1] = narrow ? bottom.slice(1, 4) : bottom;
    font.set(ch, rows);
  }
  const c = [...font.get('c')!];
  c[7] = '.#..';
  c[8] = '##..';
  font.set('ç', c);
  return font;
}

const FONT = buildFont();

/**
 * O glifo do caractere (9 linhas). Sem ele na fonte, tenta a letra sem o acento ("É" -> "E", "ü" -> "u");
 * undefined = a fonte não tem como desenhar.
 */
export function glyphOf(ch: string): readonly string[] | undefined {
  return FONT.get(ch) ?? FONT.get(ch.normalize('NFD').replace(/\p{M}/gu, ''));
}

/** A fonte desenha todos os caracteres do texto? */
export function canDraw(text: string): boolean {
  return [...text].every((ch) => glyphOf(ch) !== undefined);
}

/** Largura do texto em pixels da fonte (1 px entre as letras); 0 para texto vazio ou que a fonte não desenha. */
export function textWidth(text: string): number {
  const chars = [...text];
  if (!chars.length || !canDraw(text)) return 0;
  return chars.reduce((w, ch) => w + glyphOf(ch)![0].length, 0) + chars.length - 1;
}

/**
 * Onde a cor do logotipo troca (índice do primeiro caractere em âmbar; os de antes ficam em creme): "Habblaud" em
 * "Hab" + "blaud", como na placa da marca; nomes com espaço, na última palavra ("SmartSales" + " Corp."); uma palavra
 * só, na última maiúscula do meio ("Smart" + "Sales"); sem nada disso, tudo em creme.
 */
export function wordmarkSplit(name: string): number {
  const chars = [...name];
  if (name === DEFAULT_OFFICE_NAME) return 3;
  const space = chars.lastIndexOf(' ');
  if (space > 0) return space;
  for (let i = chars.length - 1; i > 0; i--) {
    if (/\p{Lu}/u.test(chars[i]) && /\p{Ll}/u.test(chars[i - 1])) return i;
  }
  return chars.length;
}

/**
 * O logotipo como mapa de pixels (o formato de pixelIcon): c = creme, t = âmbar, s = sombra de 1 px logo abaixo.
 * Altura: 7 linhas mais a sombra, ou 9 mais a sombra quando alguma letra tem descendente (p, g, j, q, y, ç e a
 * vírgula). null = a fonte não desenha algum caractere (quem chama mostra o nome como texto).
 */
export function wordmarkRows(name: string, split = wordmarkSplit(name)): string[] | null {
  const chars = [...name];
  if (!chars.length || !canDraw(name)) return null;
  const glyphs = chars.map((ch) => glyphOf(ch)!);
  const hasDescender = glyphs.some((g) => g.slice(CAP_HEIGHT).some((row) => row.includes('#')));
  const textH = hasDescender ? CELL_HEIGHT : CAP_HEIGHT;
  const width = textWidth(name);
  const grid = Array.from({ length: textH + 1 }, () => Array<string>(width).fill('.'));
  let x = 0;
  glyphs.forEach((g, i) => {
    const color = i < split ? 'c' : 't';
    for (let y = 0; y < textH; y++) {
      for (let gx = 0; gx < g[y].length; gx++) {
        if (g[y][gx] !== '#') continue;
        grid[y][x + gx] = color;
        if (grid[y + 1][x + gx] === '.') grid[y + 1][x + gx] = 's';
      }
    }
    x += g[0].length + 1;
  });
  return grid.map((row) => row.join(''));
}

/**
 * Larguras (px de tela) do logotipo na barra que mudam quando o nome some (styles.css, bloco "responsivo"): até 150 o
 * de sempre (o "Habblaud" tem 135); até 255 `wide` (os cortes sobem 120 px: "SmartSales Corp." tem 252); acima, `xwide`
 * (sobem 165 px: o máximo é 300). O nome em texto (fonte que não desenha) conta como TEXT_WORDMARK_MAX_W.
 */
export const TEXT_WORDMARK_MAX_W = 300;
export function wordmarkTier(widthPx: number): 'normal' | 'wide' | 'xwide' {
  return widthPx <= 150 ? 'normal' : widthPx <= 255 ? 'wide' : 'xwide';
}

/**
 * Escala inteira do logotipo: a maior até `preferred` em que `width` pixels da fonte cabem em `maxPx` px de tela (e
 * `height` em `maxH`, quando dados; inteira para ficar nítido); no mínimo 1.
 */
export function wordmarkScale(width: number, preferred: number, maxPx: number, height = 0, maxH = Infinity): number {
  for (let s = preferred; s > 1; s--) if (width * s <= maxPx && height * s <= maxH) return s;
  return 1;
}
