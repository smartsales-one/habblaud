// O nome do escritório na página: o do snapshot ao vivo (meta.officeName) e, antes dele, o que o servidor pôs no
// index.html (meta `habblaud-office-name`, server/http/office-html.ts), para o carregamento e a barra não mostrarem
// "Habblaud" antes do primeiro snapshot.
import type { OfficeSnapshot } from '../../../shared/types';
import { OFFICE_NAME_META, officeNameOf } from '../../../shared/office-name';

let fromPage: string | undefined | null = null;

/** O nome posto no index.html pelo servidor (lido uma vez); undefined sem a meta (nome padrão, modo dev antigo). */
export function pageOfficeName(): string | undefined {
  if (fromPage === null) {
    fromPage = typeof document === 'undefined' ? undefined : (document.querySelector(`meta[name="${OFFICE_NAME_META}"]`)?.getAttribute('content') ?? undefined);
  }
  return fromPage;
}

/** O nome a mostrar: o do snapshot; sem ele, o do index.html; sem nada (ou inválido), "Habblaud". */
export function officeNameFor(snap: OfficeSnapshot | null | undefined, page: string | undefined = pageOfficeName()): string {
  return officeNameOf(snap?.meta.officeName ?? page);
}
