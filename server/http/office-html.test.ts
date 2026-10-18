import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDir } from '../test/fixtures';
import { escapeHtml, injectOfficeName } from './office-html';
import { createStaticHandler } from './static';

async function serve(officeName: string | undefined, run: (base: string, dist: string) => Promise<void>): Promise<void> {
  const tmp = tempDir();
  writeFileSync(join(tmp.dir, 'index.html'), '<!doctype html><title>Habblaud</title><meta name="twitter:title" content="Habblaud" />');
  const handler = createStaticHandler(tmp.dir, officeName === undefined ? {} : { officeName });
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url ?? '/', 'http://x').pathname));
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, tmp.dir);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((ok) => server.close(() => ok()));
    tmp.cleanup();
  }
}

const INDEX = readFileSync(join(import.meta.dirname, '..', '..', 'client', 'index.html'), 'utf8');

describe('nome do escritório no index.html', () => {
  it('nome padrão: o arquivo sai como está', () => {
    expect(injectOfficeName(INDEX, 'Habblaud')).toBe(INDEX);
  });

  it('título da aba, og:title, twitter:title, nome do app e a meta habblaud-office-name', () => {
    const html = injectOfficeName(INDEX, 'SmartSales Corp.');
    expect(html).toContain('<title>SmartSales Corp.</title>');
    expect(html).toContain('<meta property="og:title" content="SmartSales Corp." />');
    expect(html).toContain('<meta name="twitter:title" content="SmartSales Corp." />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="SmartSales Corp." />');
    expect(html).toContain('<meta name="habblaud-office-name" content="SmartSales Corp." />');
    // o nome do produto continua onde é o produto
    expect(html).toContain('<meta property="og:site_name" content="Habblaud" />');
    expect(html.match(/habblaud-office-name/g)).toHaveLength(1);
  });

  it('escapa texto e atributo', () => {
    expect(escapeHtml(`A & B <x> "y" 'z'`)).toBe('A &amp; B &lt;x&gt; &quot;y&quot; &#39;z&#39;');
    const html = injectOfficeName(INDEX, `"><script>alert(1)</script> & $& $1`);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('<title>&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; $&amp; $1</title>');
    expect(html).toContain('content="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; $&amp; $1"');
  });

  it('o servidor estático manda o index.html com o nome (na raiz, no /index.html e no fallback de SPA)', async () => {
    await serve('SmartSales Corp.', async (base, dist) => {
      for (const path of ['/', '/index.html', '/sala/qualquer']) {
        const res = await fetch(`${base}${path}`);
        const body = await res.text();
        expect(body).toContain('<title>SmartSales Corp.</title>');
        expect(body).toContain('<meta name="habblaud-office-name" content="SmartSales Corp." />');
        expect(body).toContain('<meta name="twitter:title" content="SmartSales Corp." />');
        expect(Number(res.headers.get('content-length'))).toBe(Buffer.byteLength(body));
      }
      // ETag com o nome: revalida (304) e um build novo troca o corpo
      const first = await fetch(base);
      const etag = first.headers.get('etag')!;
      expect((await fetch(base, { headers: { 'If-None-Match': etag } })).status).toBe(304);
      writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Habblaud</title><p>build novo</p>');
      const fresh = await (await fetch(base)).text();
      expect(fresh).toContain('build novo');
      expect(fresh).toContain('<title>SmartSales Corp.</title>');
    });
  });

  it('sem nome (ou o padrão): o index.html como está, com o ETag de sempre', async () => {
    await serve(undefined, async (base) => {
      const res = await fetch(base);
      expect(await res.text()).toBe('<!doctype html><title>Habblaud</title><meta name="twitter:title" content="Habblaud" />');
      expect(res.headers.get('etag')).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
    });
  });
});
