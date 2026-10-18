// O nome do escritório (logotipo) cabe na barra do topo? Só para um nome diferente do "Habblaud" (HABBLAUD_OFFICE_NAME):
// o do produto segue os cortes fixos do styles.css, como no original. Puro (sem DOM): testado em brand-fit.test.ts.
// Quem mede o DOM e aplica é a TopBar (ui/topbar.ts), antes de os cartões de uso decidirem a segunda linha (usage.ts,
// com a mesma conta de usage-row.ts).

export interface BrandFitInput {
  /** Largura útil da barra (sem o padding). */
  barWidth: number;
  /** Espaço entre os itens da barra. */
  gap: number;
  /** Larguras naturais dos outros itens visíveis da barra (contadores, botões), sem a esquerda e sem os cartões. */
  others: number[];
  /** A esquerda (botão do painel lateral e a marca) sem a coluna de texto da marca. */
  left: number;
  /** A linha de status embaixo do nome (conexão, versão, selos). */
  status: number;
  /** Largura do logotipo com o nome. */
  name: number;
  /** Largura mínima de cada cartão de uso e o espaço entre eles. */
  cards: number[];
  cardGap: number;
  /** O nome está à vista agora (para a folga, que evita piscar). */
  shown: boolean;
  /** Folga exigida para voltar a mostrar o nome (px). */
  hysteresis?: number;
}

export const BRAND_FIT_HYSTERESIS = 8;

/**
 * Mostrar o nome? Sim se a barra inteira (com os cartões) cabe numa linha com ele. Se só cabe numa linha sem ele, não.
 * Se nem sem ele cabe (os cartões vão para a segunda linha de qualquer jeito), sim se a primeira linha (sem os cartões)
 * cabe com ele. Para voltar a mostrar um nome escondido, exige `hysteresis` px a mais.
 */
export function brandNameShown(i: BrandFitInput): boolean {
  const slack = i.shown ? 0 : (i.hysteresis ?? BRAND_FIT_HYSTERESIS);
  const withName = i.left + Math.max(i.status, i.name);
  const withoutName = i.left + i.status;
  /** Largura de uma linha com a esquerda, os outros itens e (se houver) a fila dos cartões, com um espaço entre cada. */
  const line = (left: number, cards: readonly number[]) => {
    const items = [left, ...i.others];
    let w = items.reduce((s, x) => s + x, 0) + i.gap * (items.length - 1);
    if (cards.length) w += i.gap + cards.reduce((s, x) => s + x, 0) + i.cardGap * (cards.length - 1);
    return w;
  };
  if (line(withName, i.cards) <= i.barWidth - slack) return true;
  if (i.cards.length && line(withoutName, i.cards) <= i.barWidth) return false;
  return line(withName, []) <= i.barWidth - slack;
}
