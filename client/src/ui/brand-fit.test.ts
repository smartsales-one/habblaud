import { describe, expect, it } from 'vitest';
import { BRAND_FIT_HYSTERESIS, brandNameShown, type BrandFitInput } from './brand-fit';

// Barra de exemplo: esquerda sem o texto da marca 80 px, status 150, nome 252 ("SmartSales Corp." a 3x), contadores
// 300, botões 400, 4 cartões de 150 com 8 de espaço, 12 entre os itens.
const base: BrandFitInput = { barWidth: 0, gap: 12, others: [300, 400], left: 80, status: 150, name: 252, cards: [150, 150, 150, 150], cardGap: 8, shown: true };
// linha com o nome: 80+252 + 300 + 400 + 2*12 = 1056; cartões: 12 + 600 + 24 = 636 -> 1692
const WITH_NAME = 1692;
// sem o nome: 80+150 ... = 954 + 636 = 1590
const WITHOUT_NAME = 1590;
// primeira linha só (cartões embaixo), com o nome
const FIRST_ROW = 1056;

const at = (barWidth: number, extra: Partial<BrandFitInput> = {}) => brandNameShown({ ...base, barWidth, ...extra });

describe('o nome do escritório cabe na barra do topo?', () => {
  it('cabe tudo numa linha com o nome: mostra', () => {
    expect(at(WITH_NAME)).toBe(true);
    expect(at(1800)).toBe(true);
  });

  it('só cabe numa linha sem o nome: esconde (em vez de mandar os cartões para a segunda linha)', () => {
    expect(at(WITH_NAME - 1)).toBe(false);
    expect(at(WITHOUT_NAME)).toBe(false);
  });

  it('nem sem o nome cabe (os cartões vão para baixo de qualquer jeito): mostra se a primeira linha cabe com ele', () => {
    expect(at(WITHOUT_NAME - 1)).toBe(true);
    expect(at(FIRST_ROW)).toBe(true);
    expect(at(FIRST_ROW - 1)).toBe(false);
  });

  it('folga para voltar: escondido, só reaparece com HYSTERESIS px a mais', () => {
    expect(at(WITH_NAME, { shown: false })).toBe(false);
    expect(at(WITH_NAME + BRAND_FIT_HYSTERESIS - 1, { shown: false })).toBe(false);
    expect(at(WITH_NAME + BRAND_FIT_HYSTERESIS, { shown: false })).toBe(true);
    expect(at(WITH_NAME + 2, { shown: false, hysteresis: 2 })).toBe(true);
  });

  it('sem cartões: só a linha com o nome', () => {
    expect(at(FIRST_ROW, { cards: [] })).toBe(true);
    expect(at(FIRST_ROW - 1, { cards: [] })).toBe(false);
  });

  it('nome mais estreito que a linha de status não muda a largura', () => {
    expect(at(WITHOUT_NAME, { name: 100 })).toBe(true);
  });
});
