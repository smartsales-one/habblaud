import { describe, expect, it } from 'vitest';
import { canDraw, glyphOf, textWidth, wordmarkRows, wordmarkScale, wordmarkSplit } from './pixel-font';

/** O logotipo "Habblaud" desenhado à mão antes do nome configurável (a placa da marca, scripts/assets/pixelart.py). */
const HABBLAUD_ROWS = [
  'c...c.......c.....t.....tt..................t',
  'c...c.......c.....t.....st..................t',
  'c...c..ccc..cccc..tttt...t...ttt..t...t..tttt',
  'ccccc..sssc.csssc.tssst..t...ssst.t...t.tssst',
  'csssc..cccc.c...c.t...t..t...tttt.t...t.t...t',
  'c...c.csssc.c...c.t...t..t..tssst.t...t.t...t',
  'c...c.scccc.ccccs.tttts.ttt.stttt.stttt.stttt',
  's...s..ssss.ssss..ssss..sss..ssss..ssss..ssss',
];

describe('fonte bitmap da marca', () => {
  it('"Habblaud" sai igual ao logotipo de antes (Hab em creme, blaud em âmbar, sombra de 1 px)', () => {
    expect(wordmarkSplit('Habblaud')).toBe(3);
    expect(wordmarkRows('Habblaud')).toEqual(HABBLAUD_ROWS);
    expect(textWidth('Habblaud')).toBe(45);
  });

  it('"SmartSales Corp.": todos os glifos existem; a última palavra em âmbar; o "p" desce (9 linhas + sombra)', () => {
    const name = 'SmartSales Corp.';
    expect(canDraw(name)).toBe(true);
    expect(wordmarkSplit(name)).toBe(10);
    expect(textWidth(name)).toBe(84);
    const rows = wordmarkRows(name)!;
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.length === 84)).toBe(true);
    // "S" de "SmartSales" em creme, "C" de "Corp." em âmbar, o ponto final na linha de base
    expect(rows[0].startsWith('.cccc')).toBe(true);
    const corp = textWidth('SmartSales ') + 1;
    expect(rows[0].slice(corp, corp + 5)).toBe('.ttt.');
    expect(rows[6].at(-1)).toBe('t');
    expect(rows[7].at(-1)).toBe('s');
    // descendente do "p" nas linhas 7-8 e a sombra dele na última
    const p = textWidth('SmartSales Cor') + 1;
    expect(rows[8][p]).toBe('t');
    expect(rows[9][p]).toBe('s');
  });

  it('sem descendente, 7 linhas + a sombra', () => {
    expect(wordmarkRows('Acme')).toHaveLength(8);
    expect(wordmarkRows('Agency')).toHaveLength(10);
  });

  it('troca de cor: última palavra; numa palavra só, a última maiúscula do meio; senão, tudo em creme', () => {
    expect(wordmarkSplit('Escritório da Ana')).toBe(13);
    expect(wordmarkSplit('SmartSales')).toBe(5);
    expect(wordmarkSplit('ACME')).toBe(4);
    expect(wordmarkSplit('acme')).toBe(4);
    expect(wordmarkRows('acme')!.join('')).not.toContain('t');
  });

  it('acentos: os da fonte e, sem eles, a letra sem o acento', () => {
    expect(glyphOf('ã')).toBeDefined();
    expect(glyphOf('ç')).toBeDefined();
    expect(glyphOf('É')).toEqual(glyphOf('E'));
    expect(glyphOf('ü')).toEqual(glyphOf('u'));
    expect(canDraw('Escritório São João')).toBe(true);
  });

  it('caractere que a fonte não tem: null (o nome vira texto)', () => {
    expect(canDraw('A&B')).toBe(false);
    expect(wordmarkRows('A&B')).toBeNull();
    expect(wordmarkRows('Escritório 🏢')).toBeNull();
    expect(wordmarkRows('')).toBeNull();
    expect(textWidth('A&B')).toBe(0);
  });

  it('escala inteira que cabe na largura, no mínimo 1', () => {
    expect(wordmarkScale(45, 3, 300)).toBe(3);
    expect(wordmarkScale(84, 3, 300)).toBe(3);
    expect(wordmarkScale(120, 3, 300)).toBe(2);
    expect(wordmarkScale(240, 3, 300)).toBe(1);
    expect(wordmarkScale(500, 3, 300)).toBe(1);
    expect(wordmarkScale(45, 5, 400)).toBe(5);
  });
});
