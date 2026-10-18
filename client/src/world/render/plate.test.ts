import { describe, expect, it } from 'vitest';
import SIGNAGE_PNG from '../../../public/assets/brand/signage.png?inline';
import { PLATE_MIN_SCALE, PLATE_PALETTE, plateFit, plateRows, SIGN_MAX_H, SIGN_MAX_W, signagePlan } from './plate';

/**
 * PNG RGBA de 8 bits sem entrelaçamento (o formato das placas geradas por scripts/assets), em data URL -> linhas de
 * "#rrggbb" ou '' (transparente).
 */
async function readPng(dataUrl: string): Promise<string[][]> {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const buf = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const u32 = (o: number) => ((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0;
  let w = 0;
  let h = 0;
  const idat: Uint8Array[] = [];
  for (let i = 8; i < buf.length; ) {
    const n = u32(i);
    const type = String.fromCharCode(...buf.subarray(i + 4, i + 8));
    const data = buf.subarray(i + 8, i + 8 + n);
    if (type === 'IHDR') {
      w = u32(i + 8);
      h = u32(i + 12);
      expect([data[8], data[9], data[12]]).toEqual([8, 6, 0]);
    } else if (type === 'IDAT') idat.push(data);
    i += 12 + n;
  }
  const stream = new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw = new Uint8Array(await new Response(stream).arrayBuffer());
  const bpp = 4;
  const stride = w * bpp;
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const pred = [0, a, b, (a + b) >> 1, paeth][filter];
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const o = y * stride + x * bpp;
      return px[o + 3] === 0 ? '' : `#${hex(px[o])}${hex(px[o + 1])}${hex(px[o + 2])}`;
    }),
  );
}

const paint = (rows: string[]) => rows.map((r) => [...r].map((ch) => PLATE_PALETTE[ch] ?? ''));

describe('placa da recepção', () => {
  it('"Habblaud" desenhado aqui sai pixel a pixel igual à placa pronta (assets/brand/signage.png)', async () => {
    const png = await readPng(SIGNAGE_PNG);
    expect(png).toHaveLength(16);
    expect(paint(plateRows('Habblaud')!)).toEqual(png);
  });

  it('"SmartSales Corp.": chapa mais larga (texto + 9 px de cada lado) e 18 px de altura pelo descendente do "p"', () => {
    const rows = plateRows('SmartSales Corp.')!;
    expect(rows).toHaveLength(18);
    expect(rows[0]).toHaveLength(84 + 18);
    expect(rows[0][0]).toBe('.');
    expect(rows[1][0]).toBe('O');
    expect(rows[1][1]).toBe('T');
    expect(rows[16][1]).toBe('B');
    // parafusos no meio da altura
    expect(rows[8][3]).toBe('L');
    expect(rows[9][3]).toBe('D');
    expect(rows[8][rows[0].length - 4]).toBe('L');
    // texto a 9 px da borda e a 4 do topo: o "S" começa com ".####" (o vazio do glifo fica na face da chapa)
    expect(rows[4].slice(9, 14)).toBe('Fcccc');
    expect(rows[4][8]).toBe('F');
  });

  it('nome que a fonte não desenha: sem chapa', () => {
    expect(plateRows('A&B')).toBeNull();
  });

  it('plateFit: escala inteira quando cabe, senão a fração que cabe', () => {
    expect(SIGN_MAX_W).toBe(80);
    expect(SIGN_MAX_H).toBe(24);
    expect(plateFit(64, 16)).toEqual({ k: 1, dw: 64, dh: 16 });
    expect(plateFit(30, 10)).toEqual({ k: 2, dw: 60, dh: 20 });
    const wide = plateFit(102, 18);
    expect(wide.k).toBeCloseTo(80 / 102);
    expect([wide.dw, wide.dh]).toEqual([80, 14]);
  });

  it('signagePlan: padrão = a placa pronta (ou a comum sem o asset); outro nome = a chapa desenhada; ilegível = texto', () => {
    expect(signagePlan('Habblaud', true)).toBe('png');
    expect(signagePlan('Habblaud', false)).toBe('text');
    expect(signagePlan('SmartSales Corp.', true)).toBe('plate');
    expect(signagePlan('SmartSales Corp.', false)).toBe('plate');
    expect(signagePlan('A&B', true)).toBe('text');
    // 40 letras: a chapa ficaria abaixo da escala mínima
    const long = 'Escritorio Central da Empresa Exemplo SA';
    expect(long).toHaveLength(40);
    const rows = plateRows(long)!;
    expect(plateFit(rows[0].length, rows.length).k).toBeLessThan(PLATE_MIN_SCALE);
    expect(signagePlan(long, true)).toBe('text');
  });
});
