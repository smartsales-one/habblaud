// Placa da recepção com o nome do escritório (HABBLAUD_OFFICE_NAME). Com o nome padrão vale a placa pronta
// (assets/brand/signage.png, gerada por scripts/assets/pixelart.py: signage()); com outro nome, a mesma chapa é
// desenhada aqui com a fonte bitmap da marca (art/pixel-font.ts), nas mesmas cores. Puro: nada de DOM (o renderer pinta
// o mapa num canvas).
import { TILE } from '../../art/api';
import { DEFAULT_OFFICE_NAME } from '../../../../shared/office-name';
import { wordmarkRows } from '../../art/pixel-font';

/** Espaço da placa na parede da recepção (px de mundo). */
export const SIGN_MAX_W = 5 * TILE;
export const SIGN_MAX_H = 24;
/** Abaixo desta escala o nome não se lê mais na chapa: vai para a placa comum, com o texto escrito pelo overlay. */
export const PLATE_MIN_SCALE = 0.5;

/** Largura mínima da chapa (a da placa pronta) e margem de cada lado do texto (os parafusos ficam nela). */
const PLATE_MIN_W = 64;
const PLATE_PAD_X = 9;
/** Linha do topo do texto e o que sobra embaixo dele (bisel). */
const TEXT_Y = 4;

/**
 * Cores da chapa (as de signage() em pixelart.py): O contorno, T bisel de cima, F face, B bisel de baixo, L/D parafuso
 * (luz/sombra), c texto creme, t texto âmbar, s sombra do texto. '.' = transparente.
 */
export const PLATE_PALETTE: Readonly<Record<string, string>> = {
  O: '#1c2541',
  T: '#3a4a70',
  F: '#2a3656',
  B: '#222b47',
  L: '#c9d3e3',
  D: '#7d8aa3',
  c: '#f4f1ea',
  t: '#fac665',
  s: '#151c33',
};

/**
 * A chapa com o nome, como mapa de pixels (PLATE_PALETTE): no mínimo 64 px de largura (a da placa pronta), o texto
 * centralizado a 4 px do topo, com sombra de 1 px; 16 px de altura, ou 18 quando o nome tem descendente. Com
 * "Habblaud" sai igual à placa pronta. null = a fonte não desenha algum caractere.
 */
export function plateRows(name: string): string[] | null {
  const text = wordmarkRows(name);
  if (!text) return null;
  const tw = text[0].length;
  const w = Math.max(PLATE_MIN_W, tw + 2 * PLATE_PAD_X);
  const h = text.length + 2 * TEXT_Y;
  const grid: string[][] = [];
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) {
      const edgeX = x === 0 || x === w - 1;
      const edgeY = y === 0 || y === h - 1;
      if (edgeX && edgeY) row.push('.'); // cantos arredondados
      else if (edgeX || edgeY) row.push('O');
      else if (y === 1) row.push('T');
      else if (y === h - 2) row.push('B');
      else row.push('F');
    }
    grid.push(row);
  }
  const screwY = h / 2 - 1;
  for (const sx of [3, w - 4]) {
    grid[screwY][sx] = 'L';
    grid[screwY + 1][sx] = 'D';
  }
  const tx = Math.floor((w - tw) / 2);
  text.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') grid[TEXT_Y + y][tx + x] = row[x];
  });
  return grid.map((r) => r.join(''));
}

/**
 * Tamanho da placa no espaço da parede: escala inteira (pixels nítidos) sempre que couber; senão, a fração que cabe.
 * `dw`/`dh` arredondados (px de mundo).
 */
export function plateFit(w: number, h: number, maxW = SIGN_MAX_W, maxH = SIGN_MAX_H): { k: number; dw: number; dh: number } {
  const fit = Math.min(maxW / w, maxH / h);
  const k = fit >= 1 ? Math.floor(fit) : fit;
  return { k, dw: Math.round(w * k), dh: Math.round(h * k) };
}

/**
 * Como a placa da recepção sai: `png` = a placa pronta (nome padrão, com o asset carregado); `plate` = a chapa desenhada
 * com o nome (plateRows); `text` = a placa comum da arte, com o nome escrito pelo overlay (nome padrão sem o asset, um
 * caractere que a fonte não tem, ou nome tão longo que a chapa ficaria menor que PLATE_MIN_SCALE).
 */
export function signagePlan(name: string, hasPng: boolean): 'png' | 'plate' | 'text' {
  if (name === DEFAULT_OFFICE_NAME) return hasPng ? 'png' : 'text';
  const rows = plateRows(name);
  if (!rows) return 'text';
  return plateFit(rows[0].length, rows.length).k >= PLATE_MIN_SCALE ? 'plate' : 'text';
}
