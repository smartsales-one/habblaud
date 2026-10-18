// O nome do escritório (HABBLAUD_OFFICE_NAME) já no index.html servido: título da aba, títulos da prévia do link
// (Open Graph / Twitter), nome do app na Tela de Início e a meta `habblaud-office-name`, que o carregamento lê antes
// do primeiro snapshot (nada de "Habblaud" piscando). Com o nome padrão o arquivo sai como está.
import { DEFAULT_OFFICE_NAME, OFFICE_NAME_META } from '../../shared/office-name';

/** Escapa para texto e para valor de atributo entre aspas duplas. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** `content` das metas cujo valor é o título da página. */
const TITLE_METAS = /(<meta\s+(?:property|name)="(?:og:title|twitter:title|apple-mobile-web-app-title)"\s+content=")[^"]*(")/g;

/**
 * O index.html com o nome do escritório: `<title>`, og:title, twitter:title, apple-mobile-web-app-title e a meta
 * `habblaud-office-name` (logo depois do `<title>`). Nome padrão: o HTML sem mudança.
 */
export function injectOfficeName(html: string, name: string): string {
  if (name === DEFAULT_OFFICE_NAME) return html;
  const text = escapeHtml(name);
  return html
    .replace(TITLE_METAS, (_m, open: string, close: string) => `${open}${text}${close}`)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${text}</title>\n    <meta name="${OFFICE_NAME_META}" content="${text}" />`);
}
