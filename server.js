const path = require('path');
const express = require('express');

const content = require('./lib/content');
const { model, counters } = require('./lib/model');
const admin = require('./lib/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

// Версия для сброса кэша CSS/JS после каждого перезапуска
app.locals.v = Date.now().toString(36);
app.locals.formatDate = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '');
};

app.use((req, res, next) => {
  const m = model();
  const site = m.site;
  // {{name}}, {{phone}}, {{email}}, {{address}} в текстах подставляются из общих настроек
  res.locals.fill = s => String(s == null ? '' : s).replace(/\{\{(\w+)\}\}/g, (_, k) => site[k] != null ? site[k] : '');
  res.locals.path = req.path;
  res.locals.meta = { title: '', description: '' };
  res.locals.site = site;
  res.locals.pages = m.pages;
  res.locals.nav = {
    services: m.categories,
    components: m.sections.komplektuyushchie,
    spareParts: m.sections.zapchasti
  };
  req.m = m;
  next();
});

// Загруженные через админку файлы
app.get('/uploads/:file', async (req, res, next) => {
  try {
    const f = await content.getUpload(req.params.file);
    if (!f) return next();
    res.set('Content-Type', f.type);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; media-src 'self'");
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(f.buffer);
  } catch (e) { next(e); }
});

app.use('/admin', admin);

app.get('/', (req, res) => {
  const m = req.m;
  res.render('index', {
    meta: { title: `${m.site.name} — сервисное обслуживание, монтаж и ремонт ИТ и интерактивного оборудования`, description: m.site.tagline },
    home: m.home,
    components: m.sections.komplektuyushchie ? m.sections.komplektuyushchie.cats : [],
    popular: m.popular,
    projects: m.projects,
    counters: counters(),
    news: m.articles,
    software: m.home.software || [],
    clients: m.home.clients || [],
    reviews: m.home.reviews || []
  });
});

app.get('/uslugi/', (req, res) => res.render('services', {
  meta: { title: 'Услуги', description: 'Сервисное обслуживание, монтаж, диагностика и ремонт оборудования' },
  categories: req.m.categories
}));

// Карточка товара
app.get('/katalog/:slug/', (req, res, next) => {
  const product = req.m.findProduct(req.params.slug);
  if (!product) return next();
  const { cat } = product.home;
  res.render('product', {
    meta: { title: product.title, description: `${product.title} — купить с установкой. ${cat.title}.` },
    product,
    related: cat.items.filter(p => p.slug !== product.slug).slice(0, 4)
  });
});

// Портфолио
app.get('/portfolio/', (req, res) => res.render('portfolio', {
  meta: { title: 'Портфолио', description: 'Реализованные проекты сервисной службы' },
  projects: req.m.projects
}));
app.get('/portfolio/:slug/', (req, res, next) => {
  const project = req.m.projects.find(p => p.slug === req.params.slug);
  if (!project) return next();
  res.render('project', {
    meta: { title: project.title, description: project.task },
    project,
    others: req.m.projects.filter(p => p !== project).slice(0, 3)
  });
});

// Новости
app.get('/novosti/', (req, res) => res.render('news', {
  meta: { title: 'Новости и статьи', description: 'Новости и полезные статьи сервисной службы' },
  news: req.m.articles
}));
app.get('/novosti/:slug/', (req, res, next) => {
  const article = req.m.articles.find(a => a.slug === req.params.slug);
  if (!article) return next();
  res.render('article', {
    meta: { title: article.title, description: article.excerpt },
    article,
    others: req.m.articles.filter(a => a !== article).slice(0, 3)
  });
});

// Текстовые страницы: адрес → [ключ в content/pages.json, шаблон]
const textPages = {
  'o-kompanii': ['about', 'text'],
  'sotrudnichestvo': ['cooperation', 'text'],
  'politika-konfidencialnosti': ['privacy', 'text'],
  'dogovor-oferty': ['offer', 'text'],
  'rekvizity': ['requisites', 'rekvizity'],
  'kontakty': [null, 'kontakty']
};
Object.entries(textPages).forEach(([slug, [key, view]]) => {
  app.get(`/${slug}/`, (req, res) => {
    const page = key ? req.m.pages[key] : { title: 'Контакты' };
    res.render(`pages/${view}`, {
      meta: { title: page.title, description: `${page.title} — ${req.m.site.name}` },
      title: page.title,
      page,
      slug,
      counters: counters()
    });
  });
});

app.get('/karta-sayta/', (req, res) => res.render('sitemap', {
  meta: { title: 'Карта сайта', description: 'Все разделы сайта' },
  pageLinks: Object.keys(textPages).map(slug => [slug, textPages[slug][0] ? req.m.pages[textPages[slug][0]].title : 'Контакты']),
  categories: req.m.categories,
  sections: req.m.sections,
  projects: req.m.projects,
  articles: req.m.articles
}));

// Заявки с форм: сохраняются в хранилище (видны в админке) и, если заданы
// TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID, пересылаются в Telegram.
app.post('/api/lead', async (req, res) => {
  const clean = v => String(v || '').trim().slice(0, 1000);
  const lead = {
    date: new Date().toISOString(),
    name: clean(req.body.name),
    phone: clean(req.body.phone),
    email: clean(req.body.email),
    comment: clean(req.body.comment),
    source: clean(req.body.source)
  };
  if (!lead.phone && !lead.email) {
    return res.status(400).json({ ok: false, error: 'Укажите телефон или email' });
  }
  try {
    await content.addLead(lead);
  } catch (e) {
    console.error('Не удалось сохранить заявку', e);
  }
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
  if (token && chat) {
    const text = [
      'Новая заявка с сайта',
      `Имя: ${lead.name || '—'}`,
      `Телефон: ${lead.phone || '—'}`,
      `Email: ${lead.email || '—'}`,
      `Комментарий: ${lead.comment || '—'}`,
      `Страница: ${lead.source || '—'}`
    ].join('\n');
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text })
      });
    } catch (e) {
      console.error('Не удалось отправить заявку в Telegram', e);
    }
  }
  res.json({ ok: true });
});

// Разделы каталога и услуг: /komplektuyushchie/, /zapchasti/, /montazh/ и т.д.
app.get('/:section/', (req, res, next) => {
  const m = req.m;
  const sec = m.sections[req.params.section];
  if (sec) return res.render('parts', { meta: { title: sec.title, description: sec.lead }, sec });
  const cat = m.categories.find(c => c.slug === req.params.section);
  if (cat) return res.render('category', { meta: { title: cat.title, description: cat.lead }, cat });
  next();
});
app.get('/:section/:slug/', (req, res, next) => {
  const m = req.m;
  const sec = m.sections[req.params.section];
  if (sec) {
    const cat = sec.cats.find(c => c.slug === req.params.slug);
    if (!cat) return next();
    return res.render('parts-category', { meta: { title: cat.title, description: cat.lead }, sec, cat });
  }
  const cat = m.categories.find(c => c.slug === req.params.section);
  const item = cat && cat.items.find(i => i.slug === req.params.slug);
  if (!item) return next();
  const related = m.projects.filter(p => p.service === `/${cat.slug}/${item.slug}/`);
  res.render('service', {
    meta: { title: item.title, description: item.intro },
    cat, item,
    related: related.length ? related : m.projects.slice(0, 3)
  });
});

app.use((req, res) => res.status(404).render('404', { meta: { title: 'Страница не найдена', description: '' } }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Ошибка сервера');
});

content.loadAll().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`${content.get('site').name} запущен: http://localhost:${PORT} (хранилище: ${content.storageKind})`);
  });
});
