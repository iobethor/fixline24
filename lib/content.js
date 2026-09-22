// Контент сайта. Исходные версии лежат в content/*.json (в git),
// правки из админки сохраняются в хранилище и имеют приоритет.
const fs = require('fs');
const path = require('path');
const store = require('./storage');

const DIR = path.join(__dirname, '..', 'content');
const HISTORY_LIMIT = 15;

const COLLECTIONS = [
  { name: 'site', title: 'Общие настройки', hint: 'Название, логотип, телефон, почта, адрес, MAX, счётчики, видео' },
  { name: 'home', title: 'Главная страница', hint: 'Первый экран, заголовки блоков, ПО, клиенты, отзывы' },
  { name: 'services', title: 'Услуги', hint: 'Разделы, подразделы, фото, перечни работ, популярные услуги' },
  { name: 'catalog', title: 'Комплектующие и запчасти', hint: 'Категории и товары: названия, фото, характеристики' },
  { name: 'portfolio', title: 'Портфолио', hint: 'Проекты, фото, описания' },
  { name: 'articles', title: 'Новости и статьи', hint: 'Статьи, обложки, тексты' },
  { name: 'pages', title: 'Тексты страниц', hint: 'Консультация, страницы услуг и товаров, О компании, реквизиты, политика, оферта' }
];

const cache = {};
let version = 0;

function readDefault(name) {
  return JSON.parse(fs.readFileSync(path.join(DIR, name + '.json'), 'utf8'));
}

async function loadAll() {
  for (const { name } of COLLECTIONS) {
    let data = null;
    try {
      const saved = await store.get('content:' + name);
      if (saved) data = JSON.parse(saved);
    } catch (e) {
      console.error(`Не удалось прочитать «${name}» из хранилища, беру исходную версию`, e.message);
    }
    cache[name] = data || readDefault(name);
  }
  version++;
}

function get(name) { return cache[name]; }

async function save(name, data) {
  if (!COLLECTIONS.find(c => c.name === name)) throw new Error('Нет такого раздела');
  const prev = cache[name];
  const histKey = 'history:' + name;
  let history = [];
  try { history = JSON.parse((await store.get(histKey)) || '[]'); } catch (e) { history = []; }
  history.unshift({ date: new Date().toISOString(), data: prev });
  await store.set(histKey, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  await store.set('content:' + name, JSON.stringify(data));
  cache[name] = data;
  version++;
}

async function history(name) {
  try { return JSON.parse((await store.get('history:' + name)) || '[]'); } catch (e) { return []; }
}

async function reset(name) {
  await save(name, readDefault(name));
}

// Загруженные файлы: хранятся как base64 под ключом upload:<имя>
async function saveUpload(fileName, buffer, type) {
  await store.set('upload:' + fileName, JSON.stringify({ type, data: buffer.toString('base64') }));
  return '/uploads/' + fileName;
}
async function getUpload(fileName) {
  const raw = await store.get('upload:' + fileName);
  if (!raw) return null;
  const { type, data } = JSON.parse(raw);
  return { type, buffer: Buffer.from(data, 'base64') };
}
async function listUploads() {
  return (await store.list('upload:')).map(k => '/uploads/' + k.slice(7)).sort().reverse();
}
async function deleteUpload(fileName) { await store.del('upload:' + fileName); }

// Заявки с сайта
async function addLead(lead) {
  await store.set(`lead:${lead.date}:${Math.random().toString(36).slice(2, 7)}`, JSON.stringify(lead));
}
async function listLeads() {
  const keys = (await store.list('lead:')).sort().reverse().slice(0, 300);
  const out = [];
  for (const k of keys) {
    try { out.push({ id: k, ...JSON.parse(await store.get(k)) }); } catch (e) { /* пропускаем битую */ }
  }
  return out;
}
async function deleteLead(id) { if (id.startsWith('lead:')) await store.del(id); }

module.exports = {
  COLLECTIONS, loadAll, get, save, history, reset,
  saveUpload, getUpload, listUploads, deleteUpload,
  addLead, listLeads, deleteLead,
  storageKind: store.kind,
  version: () => version
};
