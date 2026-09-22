// Собирает из JSON-контента структуру, удобную для шаблонов: меню, ссылки, связи товаров с категориями.
// Пересобирается после каждого сохранения в админке.
const content = require('./content');

let built = null;
let builtVersion = -1;

function build() {
  const rawSite = content.get('site');
  // Ссылка на телефон собирается из номера автоматически
  const site = { ...rawSite, phoneHref: 'tel:+' + String(rawSite.phone || '').replace(/\D/g, '').replace(/^8(?=\d{10}$)/, '7') };
  const services = content.get('services');
  const catalog = content.get('catalog');
  const portfolio = content.get('portfolio');
  const articles = content.get('articles');

  const categories = services.categories.map(c => ({
    ...c,
    items: c.items,
    menuItems: c.items.filter(i => i.inMenu)
  }));
  const findService = (cat, slug) => {
    const c = categories.find(x => x.slug === cat);
    return c && c.items.find(i => i.slug === slug);
  };
  const popular = (services.popular || []).map(p => {
    const item = findService(p.category, p.service) || {};
    return { href: `/${p.category}/${p.service}/`, kind: p.kind, name: p.name, img: p.img || item.img };
  });

  const products = catalog.products.map(p => ({ ...p, href: `/katalog/${p.slug}/` }));
  const sections = {};
  catalog.sections.forEach(s => {
    sections[s.slug] = {
      ...s,
      cats: s.cats.map(c => {
        const items = products.filter(p => (p[s.key] || []).includes(c.slug));
        return { ...c, items, img: c.img || (items[0] && items[0].images && items[0].images[0]), href: `/${s.slug}/${c.slug}/` };
      })
    };
  });
  products.forEach(p => {
    const secList = Object.values(sections);
    const sec = secList.find(s => (p[s.key] || []).length) || secList[0];
    const cat = sec.cats.find(c => c.slug === (p[sec.key] || [])[0]) || sec.cats[0];
    p.home = { section: sec, cat };
  });

  return {
    site,
    home: content.get('home'),
    pages: content.get('pages'),
    categories,
    popular,
    sections,
    products,
    findProduct: slug => products.find(p => p.slug === slug),
    projects: portfolio.projects,
    articles: articles.articles
  };
}

function model() {
  if (builtVersion !== content.version()) {
    built = build();
    builtVersion = content.version();
  }
  return built;
}

// Счётчики: +3 в неделю ко всем значениям с grows: true, начиная с counterStart.
function counters() {
  const site = content.get('site');
  const week = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.max(0, Math.floor((Date.now() - new Date(site.counterStart).getTime()) / week));
  return site.counters.map(c => ({ ...c, value: c.grows && c.value != null && c.value !== '' ? Number(c.value) + weeks * 3 : c.value }));
}

module.exports = { model, counters };
