// Хранилище правок из админки и загруженных файлов.
// GitHub-ветка (если заданы GITHUB_TOKEN и GITHUB_REPO) или Replit Database — переживают перезапуски и передеплой.
// Локально — папка storage/ рядом с проектом.
const fs = require('fs');
const path = require('path');

function replitDbUrl() {
  if (process.env.REPLIT_DB_URL) return process.env.REPLIT_DB_URL;
  try { return fs.readFileSync('/tmp/replitdb', 'utf8').trim(); } catch (e) { return ''; }
}

class FileStore {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.kind = 'Файлы (папка storage/)';
  }
  file(key) { return path.join(this.dir, encodeURIComponent(key)); }
  async get(key) {
    try { return fs.readFileSync(this.file(key), 'utf8'); } catch (e) { return null; }
  }
  async set(key, value) { fs.writeFileSync(this.file(key), value); }
  async del(key) { try { fs.unlinkSync(this.file(key)); } catch (e) { /* нет файла */ } }
  async list(prefix) {
    return fs.readdirSync(this.dir).map(decodeURIComponent).filter(k => k.startsWith(prefix));
  }
}

class ReplitDb {
  constructor(url) {
    this.url = url;
    this.kind = 'Replit Database';
  }
  async get(key) {
    const r = await fetch(`${this.url}/${encodeURIComponent(key)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Replit DB: ' + r.status);
    return r.text();
  }
  async set(key, value) {
    const r = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    });
    if (!r.ok) throw new Error('Replit DB: ' + r.status);
  }
  async del(key) { await fetch(`${this.url}/${encodeURIComponent(key)}`, { method: 'DELETE' }); }
  async list(prefix) {
    const r = await fetch(`${this.url}?encode=true&prefix=${encodeURIComponent(prefix)}`);
    const t = await r.text();
    return t ? t.split('\n').filter(Boolean).map(decodeURIComponent) : [];
  }
}

// GitHub: каждый ключ — файл в отдельной ветке репозитория (по умолчанию «storage»).
// Нужны GITHUB_TOKEN (права Contents: read/write на репозиторий) и GITHUB_REPO вида «owner/name».
class GitHubStore {
  constructor(token, repo, branch) {
    this.token = token;
    this.repo = repo;
    this.branch = branch;
    this.kind = `GitHub (${repo}, ветка ${branch})`;
    this.sha = new Map();
    this.cache = new Map();
    this.queue = Promise.resolve();
  }
  path(key) { return 'data/' + Buffer.from(key, 'utf8').toString('base64url'); }
  req(p, opts = {}) {
    return fetch(`https://api.github.com/repos/${this.repo}/contents/${p}`, {
      ...opts,
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'fixline-site', ...(opts.headers || {}) }
    });
  }
  async get(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const r = await this.req(`${this.path(key)}?ref=${this.branch}`);
    if (r.status === 404) { this.cache.set(key, null); return null; }
    if (!r.ok) throw new Error('GitHub: ' + r.status);
    const j = await r.json();
    let text;
    if (j.content) text = Buffer.from(j.content, 'base64').toString('utf8');
    else {
      // файлы больше 1 МБ API отдаёт без содержимого — берём «сырой» вариант
      const raw = await this.req(`${this.path(key)}?ref=${this.branch}`, { headers: { Accept: 'application/vnd.github.raw' } });
      text = await raw.text();
    }
    this.sha.set(key, j.sha);
    this.cache.set(key, text);
    return text;
  }
  // Записи идут по очереди, чтобы не было конфликтов версий файла
  set(key, value) {
    const run = async () => {
      if (!this.sha.has(key) && !this.cache.has(key)) await this.get(key).catch(() => null);
      const body = { message: `update ${key}`, content: Buffer.from(value, 'utf8').toString('base64'), branch: this.branch };
      if (this.sha.get(key)) body.sha = this.sha.get(key);
      let r = await this.req(this.path(key), { method: 'PUT', body: JSON.stringify(body) });
      if (r.status === 409 || r.status === 422) {
        // версия устарела — перечитываем sha и пробуем ещё раз
        this.cache.delete(key); this.sha.delete(key);
        await this.get(key).catch(() => null);
        if (this.sha.get(key)) body.sha = this.sha.get(key); else delete body.sha;
        r = await this.req(this.path(key), { method: 'PUT', body: JSON.stringify(body) });
      }
      if (!r.ok) throw new Error('GitHub: ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      this.sha.set(key, j.content.sha);
      this.cache.set(key, value);
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }
  del(key) {
    const run = async () => {
      if (!this.sha.has(key)) await this.get(key).catch(() => null);
      const sha = this.sha.get(key);
      if (sha) {
        await this.req(this.path(key), { method: 'DELETE', body: JSON.stringify({ message: `delete ${key}`, sha, branch: this.branch }) });
      }
      this.sha.delete(key);
      this.cache.set(key, null);
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }
  async list(prefix) {
    const r = await this.req(`data?ref=${this.branch}`);
    if (r.status === 404) return [];
    if (!r.ok) throw new Error('GitHub: ' + r.status);
    const files = await r.json();
    return files.map(f => Buffer.from(f.name, 'base64url').toString('utf8')).filter(k => k.startsWith(prefix));
  }
}

const url = replitDbUrl();
let store;
if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
  store = new GitHubStore(process.env.GITHUB_TOKEN, process.env.GITHUB_REPO, process.env.GITHUB_STORAGE_BRANCH || 'storage');
} else if (url) {
  store = new ReplitDb(url);
} else {
  store = new FileStore(path.join(__dirname, '..', 'storage'));
}
module.exports = store;
