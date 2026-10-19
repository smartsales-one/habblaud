// Pastas extras das sessões abertas pelo terminal (`claude --add-dir`): a chave de comparação das pastas e o arquivo
// pequeno em <dataDir>/add-dirs.json (modo 600) que guarda sessão -> pastas para sobreviver a um reinício.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setQuiet } from '../log';
import { tempDir } from '../test/fixtures';
import { AddDirsStore, dirKey, MAX_STORED_SESSIONS, STORED_TTL_MS } from './add-dirs';

setQuiet(true);

const S1 = '0f8fad5b-d9cb-469f-a165-70867728950e';
const S2 = '1f8fad5b-d9cb-469f-a165-70867728950e';

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

function tmpFile(): string {
  const t = tempDir();
  cleanups.push(t.cleanup);
  return join(t.dir, 'add-dirs.json');
}

const sid = (n: number) => `${n.toString(16).padStart(8, '0')}-d9cb-469f-a165-70867728950e`;

describe('dirKey', () => {
  it('no Windows: sem caixa, barra para qualquer lado e sem a barra do fim', () => {
    expect(dirKey('C:\\Projetos\\SmartCRM', 'win32')).toBe(dirKey('c:/projetos/smartcrm/', 'win32'));
    expect(dirKey('C:\\', 'win32')).toBe('c:\\');
    expect(dirKey('C:\\a', 'win32')).not.toBe(dirKey('C:\\b', 'win32'));
  });

  it('fora do Windows: caixa conta; só a barra do fim sai', () => {
    expect(dirKey('/p/App', 'linux')).not.toBe(dirKey('/p/app', 'linux'));
    expect(dirKey('/p/app/', 'linux')).toBe(dirKey('/p/app', 'linux'));
    expect(dirKey('/', 'darwin')).toBe('/');
  });
});

describe('AddDirsStore', () => {
  it('grava, relê num reinício e apaga quando a sessão acaba (arquivo 600; vazio = sem arquivo)', () => {
    const file = tmpFile();
    const a = new AddDirsStore(file);
    a.load();
    a.remember(S1, ['/p/a', '/p/b']);
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ v: 1, sessions: { [S1]: { dirs: ['/p/a', '/p/b'] } } });
    const b = new AddDirsStore(file);
    b.load();
    expect(b.get(S1)).toEqual(['/p/a', '/p/b']);
    expect(b.get(S2)).toBeUndefined();
    b.forget(S1);
    expect(b.get(S1)).toBeUndefined();
    const c = new AddDirsStore(file);
    c.load();
    expect(c.size()).toBe(0);
    expect(() => statSync(file)).toThrow();
  });

  it('devolve uma cópia; sem pastas, esquece; id que não é de sessão é ignorado', () => {
    const s = new AddDirsStore(null);
    s.remember(S1, ['/p/a']);
    s.get(S1)!.push('/p/zzz');
    expect(s.get(S1)).toEqual(['/p/a']);
    s.remember(S1, []);
    expect(s.get(S1)).toBeUndefined();
    s.remember('nao-e-sessao', ['/p/a']);
    expect(s.size()).toBe(0);
  });

  it('no máximo MAX_STORED_SESSIONS: as mais antigas saem', () => {
    let t = 1_000_000;
    const file = tmpFile();
    const s = new AddDirsStore(file, () => t);
    for (let i = 0; i < MAX_STORED_SESSIONS + 5; i++) {
      t += 1_000;
      s.remember(sid(i), ['/p/a']);
    }
    expect(s.size()).toBe(MAX_STORED_SESSIONS);
    expect(s.get(sid(0))).toBeUndefined();
    expect(s.get(sid(MAX_STORED_SESSIONS + 4))).toEqual(['/p/a']);
    const again = new AddDirsStore(file, () => t);
    again.load();
    expect(again.size()).toBe(MAX_STORED_SESSIONS);
  });

  it('ao ler: entradas vencidas, fora do formato ou ilegíveis ficam de fora', () => {
    const now = 50 * STORED_TTL_MS;
    const file = tmpFile();
    writeFileSync(
      file,
      JSON.stringify({
        v: 1,
        sessions: {
          [S1]: { dirs: ['/p/a'], at: now - 1_000 },
          [S2]: { dirs: ['/p/a'], at: now - STORED_TTL_MS - 1 },
          [sid(7)]: { dirs: ['relativa'], at: now },
          [sid(8)]: { dirs: 'x', at: now },
          'nao-e-sessao': { dirs: ['/p/a'], at: now },
        },
      }),
    );
    const s = new AddDirsStore(file, () => now);
    s.load();
    expect(s.get(S1)).toEqual(['/p/a']);
    expect(s.size()).toBe(1);
    writeFileSync(file, '{ lixo');
    const broken = new AddDirsStore(file, () => now);
    broken.load();
    expect(broken.size()).toBe(0);
  });
});
