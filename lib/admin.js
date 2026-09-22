// Админ-панель: /admin. Пароль задаётся переменной окружения ADMIN_PASSWORD (на Replit — в Secrets).
const crypto = require('crypto');
const express = require('express');
const content = require('./content');

const router = express.Router();
const COOKIE = 'fl_admin';
const SESSION_DAYS = 14;

const password = () => process.env.ADMIN_PASSWORD || '';
const secret = () => process.env.SESSION_SECRET || crypto.createHash('sha256').update('fixline-admin:' + password()).digest('hex');
const sign = s => crypto.createHmac('sha256', secret()).update(s).digest('hex');

function makeToken() {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  return `${exp}.${sign(String(exp))}`;
}
function validToken(t) {
  if (!t || !password()) return false;
  const [exp, sig] = String(t).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
function setCookie(req, res, value, maxAge) {
  const secure = req.secure ? '; Secure' : '';
  res.set('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}
const authed = req => validToken(readCookie(req, COOKIE));

// Защита от перебора пароля: 10 попыток за 15 минут с одного IP
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter(t => now - t < 15 * 60e3);
  attempts.set(ip, list);
  return list.length >= 10;
}

router.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/', (req, res) => {
  res.render('admin', {
    loggedIn: authed(req),
    configured: !!password(),
    siteName: content.get('site').name
  });
});

router.post('/login', express.json(), (req, res) => {
  const ip = req.ip;
  if (!password()) return res.status(503).json({ ok: false, error: 'Пароль не задан. Добавьте ADMIN_PASSWORD в Secrets.' });
  if (tooMany(ip)) return res.status(429).json({ ok: false, error: 'Слишком много попыток. Подождите 15 минут.' });
  const given = Buffer.from(String((req.body && req.body.password) || ''));
  const real = Buffer.from(password());
  const ok = given.length === real.length && crypto.timingSafeEqual(given, real);
  if (!ok) {
    attempts.get(ip).push(Date.now());
    return res.status(401).json({ ok: false, error: 'Неверный пароль' });
  }
  attempts.delete(ip);
  setCookie(req, res, makeToken(), SESSION_DAYS * 86400);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  setCookie(req, res, '', 0);
  res.json({ ok: true });
});

// ----- API (только после входа) -----
const api = express.Router();
api.use((req, res, next) => {
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'Нужно войти заново' });
  next();
});

api.get('/collections', (req, res) => {
  res.json({ collections: content.COLLECTIONS, storage: content.storageKind });
});

api.get('/c/:name', (req, res) => {
  const data = content.get(req.params.name);
  if (!data) return res.status(404).json({ ok: false, error: 'Нет такого раздела' });
  res.json({ data });
});

api.put('/c/:name', express.json({ limit: '8mb' }), async (req, res) => {
  const cur = content.get(req.params.name);
  const data = req.body && req.body.data;
  if (!cur) return res.status(404).json({ ok: false, error: 'Нет такого раздела' });
  if (!data || typeof data !== 'object' || Array.isArray(data) !== Array.isArray(cur)) {
    return res.status(400).json({ ok: false, error: 'Неверный формат данных' });
  }
  try {
    await content.save(req.params.name, data);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Не удалось сохранить: ' + e.message });
  }
});

api.get('/c/:name/history', async (req, res) => {
  const h = await content.history(req.params.name);
  res.json({ history: h.map((x, i) => ({ i, date: x.date })) });
});

api.post('/c/:name/restore/:i', async (req, res) => {
  const h = await content.history(req.params.name);
  const item = h[Number(req.params.i)];
  if (!item) return res.status(404).json({ ok: false, error: 'Версия не найдена' });
  await content.save(req.params.name, item.data);
  res.json({ ok: true });
});

api.post('/c/:name/reset', async (req, res) => {
  await content.reset(req.params.name);
  res.json({ ok: true });
});

const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const translit = s => s.replace(/[а-яё]/g, ch => TR[ch]);

// Загрузка файлов: тело запроса — сам файл, имя — в заголовке X-Filename
const TYPES = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'video/mp4': 'mp4'
};
api.post('/upload', express.raw({ type: () => true, limit: '25mb' }), async (req, res) => {
  const type = (req.headers['content-type'] || '').split(';')[0];
  if (!TYPES[type]) return res.status(400).json({ ok: false, error: 'Можно загружать JPG, PNG, WEBP, GIF, SVG, ICO и MP4' });
  const base = translit(decodeURIComponent(String(req.headers['x-filename'] || 'file')).replace(/\.[^.]+$/, '').toLowerCase())
    .replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';
  let buf = req.body;
  let ext = TYPES[type];
  let outType = type;
  try {
    if (['jpg', 'png', 'webp'].includes(ext)) {
      const sharp = require('sharp');
      buf = await sharp(buf).rotate().resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      ext = 'webp';
      outType = 'image/webp';
    }
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Не удалось обработать картинку' });
  }
  if (buf.length > 3.6 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: 'Файл слишком большой (после сжатия больше 3,5 МБ). Для видео — сожмите ролик.' });
  }
  const name = `${base}-${Date.now().toString(36)}.${ext}`;
  const url = await content.saveUpload(name, buf, outType);
  res.json({ ok: true, url });
});

api.get('/uploads', async (req, res) => res.json({ files: await content.listUploads() }));
api.delete('/uploads/:file', async (req, res) => {
  await content.deleteUpload(req.params.file);
  res.json({ ok: true });
});

api.get('/leads', async (req, res) => res.json({ leads: await content.listLeads() }));
api.delete('/leads/:id', async (req, res) => {
  await content.deleteLead(req.params.id);
  res.json({ ok: true });
});

// Список иконок для поля icon
api.get('/icons', (req, res) => {
  res.json({ icons: ['server', 'camera', 'led', 'pc', 'payment', 'ticket', 'cart', 'kiosk', 'projector', 'videowall', 'queue', 'cable', 'panel', 'table', 'pylon', 'street', 'busstop', 'more'] });
});

router.use('/api', api);

module.exports = router;
