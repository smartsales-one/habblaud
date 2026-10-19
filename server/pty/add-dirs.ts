// Pastas extras das sessões abertas pelo terminal interativo (`claude --add-dir <pasta>`, POST /api/pty com
// `addDirs`). O PtyManager guarda as pastas com o terminal; este arquivo guarda, além disso, sessão -> pastas em
// <dataDir>/add-dirs.json (modo 600), para o "assumir" (`claude --resume`) reabrir com as mesmas pastas mesmo depois
// de um reinício do Habblaud. A entrada sai quando o terminal da sessão encerra; as que sobram (o Habblaud parou antes
// de saber) vencem em STORED_TTL_MS, e o arquivo guarda no máximo MAX_STORED_SESSIONS sessões.
//
// Caminhos são locais: nada daqui vai ao Habblaud World (a projeção só leva campos da lista fechada).
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, posix, win32 } from 'node:path';
import { log } from '../log';
import { tr } from '../../shared/i18n';

/** Nome do arquivo dentro do HABBLAUD_DATA_DIR. */
export const ADD_DIRS_FILE = 'add-dirs.json';
/** Pastas extras por sessão, no máximo. */
export const MAX_ADD_DIRS = 8;
export const MAX_STORED_SESSIONS = 100;
/** Entrada que ninguém renovou nesse tempo é esquecida. */
export const STORED_TTL_MS = 14 * 24 * 3_600_000;
/** Uma sessão viva é regravada (renova o prazo) no máximo uma vez nesse intervalo. */
const REFRESH_MS = 24 * 3_600_000;
const MAX_FILE = 256 * 1024;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chave para comparar pastas (repetida? a mesma do projeto?). No Windows: sem caixa e com a barra para qualquer
 * lado; nos outros, a caixa conta. A barra do fim nunca conta (menos na raiz).
 */
export function dirKey(p: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') {
    const s = p.replace(/\//g, '\\');
    const trimmed = /^[a-z]:\\$/i.test(s) ? s : s.replace(/\\+$/, '');
    return (trimmed || '\\').toLowerCase();
  }
  const trimmed = p.replace(/\/+$/, '');
  return trimmed || '/';
}

const isAbs = (p: string) => posix.isAbsolute(p) || win32.isAbsolute(p);

interface Entry {
  dirs: string[];
  at: number;
}

function parseEntry(v: unknown): Entry | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const e = v as { dirs?: unknown; at?: unknown };
  if (!Array.isArray(e.dirs) || e.dirs.length === 0 || e.dirs.length > MAX_ADD_DIRS) return undefined;
  if (!e.dirs.every((d) => typeof d === 'string' && d.length > 0 && d.length <= 4096 && isAbs(d))) return undefined;
  if (typeof e.at !== 'number' || !Number.isFinite(e.at)) return undefined;
  return { dirs: [...(e.dirs as string[])], at: e.at };
}

/** sessão do Claude Code -> pastas extras. `file` null = só em memória (testes). */
export class AddDirsStore {
  private entries = new Map<string, Entry>();

  constructor(
    readonly file: string | null,
    private readonly now: () => number = Date.now,
  ) {}

  /** Lê o arquivo (ilegível ou fora do formato = vazio, com aviso no log). */
  load(): void {
    this.entries.clear();
    if (!this.file) return;
    try {
      const st = statSync(this.file);
      if (st.size > MAX_FILE) throw Object.assign(new Error('too large'), { code: 'EFBIG' });
      if ((st.mode & 0o077) !== 0) chmodSync(this.file, 0o600);
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as { sessions?: unknown };
      const sessions = raw && typeof raw === 'object' && raw.sessions && typeof raw.sessions === 'object' ? (raw.sessions as Record<string, unknown>) : {};
      const now = this.now();
      for (const [id, v] of Object.entries(sessions)) {
        const e = parseEntry(v);
        if (SESSION_ID.test(id) && e && now - e.at <= STORED_TTL_MS) this.entries.set(id, e);
      }
      this.cap();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') log.warn(tr('{0} ilegível ({1}): ignorado.', [ADD_DIRS_FILE, code ?? 'JSON']));
    }
  }

  get(sessionId: string): string[] | undefined {
    const e = this.entries.get(sessionId);
    return e ? [...e.dirs] : undefined;
  }

  size(): number {
    return this.entries.size;
  }

  /** Guarda as pastas da sessão (sem pastas = esquece). Mesmas pastas, há pouco: não regrava. */
  remember(sessionId: string, dirs: readonly string[]): void {
    if (!SESSION_ID.test(sessionId)) return;
    if (dirs.length === 0) return this.forget(sessionId);
    const now = this.now();
    const cur = this.entries.get(sessionId);
    if (cur && now - cur.at < REFRESH_MS && cur.dirs.length === dirs.length && cur.dirs.every((d, i) => d === dirs[i])) return;
    this.entries.delete(sessionId);
    this.entries.set(sessionId, { dirs: [...dirs], at: now });
    this.cap();
    this.write();
  }

  forget(sessionId: string): void {
    if (this.entries.delete(sessionId)) this.write();
  }

  /** Vencidas saem; acima do limite, as mais antigas. */
  private cap(): void {
    const now = this.now();
    for (const [id, e] of this.entries) if (now - e.at > STORED_TTL_MS) this.entries.delete(id);
    if (this.entries.size <= MAX_STORED_SESSIONS) return;
    const oldest = [...this.entries].sort((x, y) => x[1].at - y[1].at);
    for (const [id] of oldest.slice(0, this.entries.size - MAX_STORED_SESSIONS)) this.entries.delete(id);
  }

  /** Grava (atômico: temporário com modo 600 e rename); nada guardado = sem arquivo. Falha de disco só avisa. */
  private write(): void {
    if (!this.file) return;
    if (this.entries.size === 0) {
      try {
        rmSync(this.file, { force: true });
      } catch (err) {
        log.warnOnce('add-dirs-write', tr('Não foi possível apagar {0} ({1}).', [this.file, (err as NodeJS.ErrnoException).code ?? '?']));
      }
      return;
    }
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(tmp, JSON.stringify({ v: 1, sessions: Object.fromEntries(this.entries) }), { mode: 0o600 });
      chmodSync(tmp, 0o600);
      renameSync(tmp, this.file);
      log.clearOnce('add-dirs-write');
    } catch (err) {
      try {
        rmSync(tmp, { force: true });
      } catch {
        // nada sobrou
      }
      log.warnOnce('add-dirs-write', tr('Não foi possível gravar {0} ({1}); as pastas extras das sessões valem só nesta execução.', [this.file, (err as NodeJS.ErrnoException).code ?? '?']));
    }
  }
}
