import crypto from 'crypto';
import { promisify } from 'util';
import {
  DEFAULT_PACKAGES, OUTPUT_KINDS, ZERO_USAGE, remaining,
  type OutputKind, type PackageDef, type PublicUser, type Usage,
} from '../src/account';
import type { Lang } from '../src/i18n';
import type { SettingsStore } from './store';
import { ResearchError } from './errors';

// Accounts. The super admin comes from .env (OWNER_LOGIN / OWNER_PASSWORD) and is never stored; the admin's own
// profile (language) is a document. Clients and packages are documents too (`clients`, `packages`), which keeps
// both storage backends identical. Passwords are scrypt hashes; a password change bumps `version`, which signs
// every existing session of that client out.

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const ADMIN_ID = 'admin';

export interface ClientRecord {
  id: string;
  login: string;
  displayName: string;
  passwordHash: string;
  version: number;
  packageId: string | null;
  usage: Usage;
  active: boolean;
  createdAt: string;
  /** Shown instead of the name next to scar projects, so the admin's list stays anonymous. */
  alias: string;
}

const LOGIN = /^[a-z0-9._-]{3,32}$/;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function cleanPackage(raw: unknown, fallbackId: string): PackageDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<PackageDef>;
  const limits = { ...ZERO_USAGE };
  for (const k of OUTPUT_KINDS) {
    const n = Number(p.limits?.[k]);
    limits[k] = Number.isFinite(n) ? Math.min(10000, Math.max(0, Math.round(n))) : 0;
  }
  const name = typeof p.name === 'string' ? p.name.trim().slice(0, 40) : '';
  if (!name) return null;
  const id = typeof p.id === 'string' && /^[a-z0-9_-]{1,32}$/.test(p.id) ? p.id : fallbackId;
  return {
    id,
    name,
    description: typeof p.description === 'string' ? p.description.trim().slice(0, 300) : '',
    consultation: p.consultation !== false,
    limits,
  };
}

export class UserService {
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private store: SettingsStore) {}

  /** Serialised read-modify-write, so two quick requests never lose an update. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writes.then(fn);
    this.writes = next.catch(() => undefined);
    return next;
  }

  async packages(): Promise<PackageDef[]> {
    const doc = await this.store.getDoc('packages');
    const list = Array.isArray(doc.packages) ? doc.packages.map((p, i) => cleanPackage(p, `p${i}`)).filter((p): p is PackageDef => Boolean(p)) : [];
    return list.length ? list : DEFAULT_PACKAGES;
  }

  savePackages(input: unknown): Promise<PackageDef[]> {
    return this.serial(async () => {
      if (!Array.isArray(input) || !input.length || input.length > 12) throw new ResearchError('Keep between 1 and 12 packages.', 400);
      const seen = new Set<string>();
      const list: PackageDef[] = [];
      for (const [i, raw] of input.entries()) {
        const p = cleanPackage(raw, `p${Date.now().toString(36)}${i}`);
        if (!p) throw new ResearchError('Every package needs a name.', 400);
        if (seen.has(p.id)) p.id = `${p.id}_${i}`;
        seen.add(p.id);
        list.push(p);
      }
      await this.store.saveDoc('packages', { packages: list });
      return list;
    });
  }

  private async clients(): Promise<ClientRecord[]> {
    const doc = await this.store.getDoc('clients');
    return Array.isArray(doc.clients) ? (doc.clients as ClientRecord[]) : [];
  }

  private saveClients(list: ClientRecord[]) {
    return this.store.saveDoc('clients', { clients: list });
  }

  async getClient(id: string): Promise<ClientRecord | null> {
    return (await this.clients()).find((c) => c.id === id) ?? null;
  }

  async findLogin(login: string): Promise<ClientRecord | null> {
    const l = login.trim().toLowerCase();
    return (await this.clients()).find((c) => c.login === l) ?? null;
  }

  async adminLang(): Promise<Lang> {
    const doc = await this.store.getDoc('admin_profile');
    return doc.lang === 'pl' ? 'pl' : 'en';
  }

  async setAdminLang(lang: Lang) {
    await this.store.saveDoc('admin_profile', { lang: lang === 'pl' ? 'pl' : 'en' });
  }

  adminLogin(): string {
    return (process.env.OWNER_LOGIN || 'admin').trim().toLowerCase();
  }

  async publicAdmin(): Promise<PublicUser> {
    return {
      id: ADMIN_ID,
      login: this.adminLogin(),
      displayName: this.adminLogin().charAt(0).toUpperCase() + this.adminLogin().slice(1),
      role: 'admin',
      lang: await this.adminLang(),
      packageId: null,
      package: null,
      usage: { ...ZERO_USAGE },
      active: true,
      createdAt: new Date(0).toISOString(),
    };
  }

  async toPublic(c: ClientRecord, packages?: PackageDef[]): Promise<PublicUser> {
    const pkgs = packages ?? (await this.packages());
    return {
      id: c.id,
      login: c.login,
      displayName: c.displayName,
      role: 'client',
      lang: 'en',
      packageId: c.packageId,
      package: pkgs.find((p) => p.id === c.packageId) ?? null,
      usage: { ...ZERO_USAGE, ...c.usage },
      active: c.active,
      createdAt: c.createdAt,
    };
  }

  async publicUser(id: string): Promise<PublicUser | null> {
    if (id === ADMIN_ID) return this.publicAdmin();
    const c = await this.getClient(id);
    return c ? this.toPublic(c) : null;
  }

  async listClients(): Promise<PublicUser[]> {
    const packages = await this.packages();
    return Promise.all((await this.clients()).map((c) => this.toPublic(c, packages)));
  }

  async aliasOf(id: string): Promise<string> {
    if (id === ADMIN_ID) return 'Admin';
    return (await this.getClient(id))?.alias ?? 'Anonymous';
  }

  async nameOf(id: string): Promise<string> {
    if (id === ADMIN_ID) return 'Admin';
    return (await this.getClient(id))?.displayName ?? '—';
  }

  createClient(input: { login?: unknown; displayName?: unknown; password?: unknown; packageId?: unknown }): Promise<PublicUser> {
    return this.serial(async () => {
      const login = String(input.login ?? '').trim().toLowerCase();
      const displayName = String(input.displayName ?? '').trim().slice(0, 60) || login;
      const password = String(input.password ?? '');
      if (!LOGIN.test(login)) throw new ResearchError('The login needs 3–32 characters: letters, digits, dot, dash or underscore.', 400);
      if (login === this.adminLogin()) throw new ResearchError('This login is taken.', 400);
      if (password.length < 8) throw new ResearchError('The password needs at least 8 characters.', 400);
      const list = await this.clients();
      if (list.some((c) => c.login === login)) throw new ResearchError('This login is taken.', 400);
      const packages = await this.packages();
      const packageId = packages.some((p) => p.id === input.packageId) ? String(input.packageId) : packages[0]?.id ?? null;
      const record: ClientRecord = {
        id: crypto.randomUUID(),
        login,
        displayName,
        passwordHash: await hashPassword(password),
        version: 1,
        packageId,
        usage: { ...ZERO_USAGE },
        active: true,
        createdAt: new Date().toISOString(),
        alias: `Anonymous ${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      };
      await this.saveClients([...list, record]);
      return this.toPublic(record, packages);
    });
  }

  updateClient(id: string, patch: { displayName?: unknown; password?: unknown; packageId?: unknown; active?: unknown; resetUsage?: unknown }): Promise<PublicUser> {
    return this.serial(async () => {
      const list = await this.clients();
      const c = list.find((x) => x.id === id);
      if (!c) throw new ResearchError('No such client.', 404);
      const packages = await this.packages();
      if (typeof patch.displayName === 'string' && patch.displayName.trim()) c.displayName = patch.displayName.trim().slice(0, 60);
      if (typeof patch.packageId === 'string') {
        if (!packages.some((p) => p.id === patch.packageId)) throw new ResearchError('No such package.', 400);
        c.packageId = patch.packageId;
      }
      if (typeof patch.active === 'boolean') {
        c.active = patch.active;
        if (!patch.active) c.version++;
      }
      if (patch.resetUsage === true) c.usage = { ...ZERO_USAGE };
      if (typeof patch.password === 'string' && patch.password) {
        if (patch.password.length < 8) throw new ResearchError('The password needs at least 8 characters.', 400);
        c.passwordHash = await hashPassword(patch.password);
        c.version++;
      }
      await this.saveClients(list);
      return this.toPublic(c, packages);
    });
  }

  deleteClient(id: string): Promise<void> {
    return this.serial(async () => {
      await this.saveClients((await this.clients()).filter((c) => c.id !== id));
    });
  }

  /**
   * Takes one generation of `kind` from the user's package, or throws a 403 with the reason. Returns a function
   * that gives it back (called when the provider fails, so a failed picture never costs the client).
   */
  consume(userId: string, kind: OutputKind): Promise<() => Promise<void>> {
    return this.serial(async () => {
      if (userId === ADMIN_ID) return async () => {};
      const list = await this.clients();
      const c = list.find((x) => x.id === userId);
      if (!c || !c.active) throw new ResearchError('This account is not active.', 403);
      const user = await this.toPublic(c);
      if (remaining(user, kind) <= 0) throw new ResearchError('Your package has no pictures of this kind left. Ask the studio to extend it.', 403);
      c.usage = { ...ZERO_USAGE, ...c.usage, [kind]: (c.usage?.[kind] ?? 0) + 1 };
      await this.saveClients(list);
      return () =>
        this.serial(async () => {
          const again = await this.clients();
          const x = again.find((y) => y.id === userId);
          if (x) {
            x.usage = { ...ZERO_USAGE, ...x.usage, [kind]: Math.max(0, (x.usage?.[kind] ?? 1) - 1) };
            await this.saveClients(again);
          }
        });
    });
  }
}
