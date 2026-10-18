// Nome do escritório (HABBLAUD_OFFICE_NAME): aparece no logotipo da barra do topo, no título da aba, nas notificações
// do navegador e na placa da recepção. O servidor lê a variável (server/config.ts) e manda o nome em
// OfficeSnapshot.meta.officeName; a página confere o que chegou com a mesma regra (servidor antigo ou corpo torto: o
// padrão). "Habblaud World" é o nome do serviço online e não muda.

export const DEFAULT_OFFICE_NAME = 'Habblaud';

/**
 * `<meta name>` com o nome do escritório no index.html servido (server/http/office-html.ts): a página usa antes do
 * primeiro snapshot (client/src/ui/office-name.ts).
 */
export const OFFICE_NAME_META = 'habblaud-office-name';

/** Tamanho máximo, em caracteres (pontos de código), depois de tirar os espaços das pontas. */
export const OFFICE_NAME_MAX = 40;

/** Quebras de linha e outros caracteres de controle (Cc), mais os separadores de linha (Zl) e de parágrafo (Zp). */
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/**
 * Por que o nome (já sem os espaços das pontas) não vale: `control` = quebra de linha ou caractere de controle,
 * `long` = mais de OFFICE_NAME_MAX caracteres, `empty` = vazio. undefined = vale.
 */
export function officeNameProblem(name: string): 'empty' | 'control' | 'long' | undefined {
  if (!name) return 'empty';
  if (CONTROL.test(name)) return 'control';
  if ([...name].length > OFFICE_NAME_MAX) return 'long';
  return undefined;
}

/** O nome a usar: o valor recebido sem os espaços das pontas, se valer; senão, DEFAULT_OFFICE_NAME. */
export function officeNameOf(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_OFFICE_NAME;
  const name = raw.trim();
  return officeNameProblem(name) ? DEFAULT_OFFICE_NAME : name;
}
