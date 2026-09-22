(function () {
  'use strict';

  // ---------- подписи полей ----------
  var LABELS = {
    name: 'Название', title: 'Заголовок', titleAccent: 'Заголовок — выделенная часть', titleEnd: 'Заголовок — окончание',
    tagline: 'Слоган', phone: 'Телефон', phoneHref: 'Ссылка телефона', email: 'E-mail', address: 'Адрес',
    schedule: 'График работы', max: 'Мессенджер MAX', href: 'Ссылка', copyright: 'Копирайт',
    brand: 'Логотип — текст', main: 'Основная часть', accent: 'Выделенная часть', suffix: 'Индекс',
    brandSub: 'Подпись под логотипом', logo: 'Логотип (картинка)', logoWithText: 'Показывать текст рядом с картинкой логотипа',
    favicon: 'Иконка вкладки', heroVideo: 'Видео на первом экране', src: 'Файл', poster: 'Обложка видео',
    counterStart: 'Дата начала отсчёта счётчиков (ГГГГ-ММ-ДД)', counters: 'Счётчики', prefix: 'Приставка', value: 'Значение',
    text: 'Текст', label: 'Подпись', grows: 'Растёт на +3 в неделю',
    hero: 'Первый экран', eyebrow: 'Надзаголовок', lead: 'Описание', buttonMain: 'Главная кнопка', buttonSecond: 'Вторая кнопка', stats: 'Показатели',
    sections: 'Разделы', components: 'Комплектующие', popular: 'Популярные услуги', portfolio: 'Портфолио', software: 'Программное обеспечение',
    clients: 'Клиенты', reviews: 'Отзывы', news: 'Новости', mock: 'Вид картинки (monitor / desk / kiosk)', role: 'Должность, компания',
    categories: 'Разделы', slug: 'Адрес страницы (латиница)', short: 'Короткое название (в меню)', items: 'Подразделы',
    menu: 'Название в меню', inMenu: 'Показывать в выпадающем меню', icon: 'Иконка меню', img: 'Картинка', intro: 'Описание', works: 'Состав работ',
    category: 'Раздел (адрес)', service: 'Подраздел (адрес)', kind: 'Тип (Обслуживание / Ремонт…)',
    key: 'Служебное поле', cats: 'Категории', products: 'Товары', images: 'Фото', attrs: 'Характеристики', spare: 'Категории в «Запчастях»',
    price: 'Цена (пусто — «по запросу»)',
    projects: 'Проекты', client: 'Заказчик', place: 'География', tags: 'Метки', task: 'Задача', done: 'Что сделали',
    articles: 'Статьи', date: 'Дата (ГГГГ-ММ-ДД)', excerpt: 'Краткое описание', body: 'Текст статьи',
    topbarStatus: 'Надпись в верхней полосе', consult: 'Блок «Бесплатная консультация»', points: 'Пункты',
    servicePage: 'Страница услуги (общие блоки)', checks: 'Преимущества', cta: 'Текст призыва', steps: 'Этапы работы',
    productPage: 'Карточка товара (общие блоки)', about: 'О компании', cooperation: 'Сотрудничество',
    requisites: 'Реквизиты', rows: 'Строки', privacy: 'Политика конфиденциальности', offer: 'Договор оферты',
    h: 'Подзаголовок', list: 'Список', alt: 'Подпись картинки', service_: ''
  };
  // Для каталога поле components — это категории «Комплектующих»
  function labelFor(key, path) {
    if (key === 'components' && path.indexOf('products') !== -1) return 'Категории в «Комплектующих»';
    return LABELS[key] || key;
  }

  var IMG_KEYS = ['img', 'logo', 'favicon', 'poster', 'src'];
  // Шаблоны новых элементов для пустых списков
  var TEMPLATES = {
    reviews: { name: '', role: '', text: '' },
    clients: { name: '', logo: '' },
    software: { title: '', text: '', mock: 'monitor' },
    stats: { value: '', label: '' },
    points: { value: '', label: '' },
    attrs: ['', ''],
    rows: ['', '']
  };
  var LONG_KEYS = ['text', 'intro', 'lead', 'excerpt', 'task', 'tagline', 'cta'];
  var LINKS = {
    site: '/', home: '/', services: '/uslugi/', catalog: '/komplektuyushchie/',
    portfolio: '/portfolio/', articles: '/novosti/', pages: '/o-kompanii/'
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  };

  var state = { collections: [], current: null, data: null, dirty: false, icons: [] };

  function toast(msg, bad) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast is-on' + (bad ? ' is-bad' : '');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.className = 'toast'; }, 3200);
  }

  async function api(url, opts) {
    var r = await fetch('/admin/api' + url, opts);
    if (r.status === 401) { alert('Сессия истекла, войдите снова'); location.reload(); throw new Error('401'); }
    var j = await r.json().catch(function () { return { ok: false, error: 'Ошибка сервера' }; });
    if (!r.ok || j.ok === false) throw new Error(j.error || 'Ошибка');
    return j;
  }

  function setDirty(v) {
    state.dirty = v;
    var b = $('#save');
    if (b) { b.disabled = !v; b.textContent = v ? 'Сохранить изменения' : 'Сохранено'; }
  }
  window.addEventListener('beforeunload', function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (state.dirty) save(); }
  });

  // ---------- загрузка файлов ----------
  function pickFile(accept) {
    return new Promise(function (resolve) {
      var f = $('#file');
      f.value = '';
      f.accept = accept || 'image/*';
      f.onchange = function () { resolve(f.files[0] || null); };
      f.click();
    });
  }
  async function upload(file) {
    toast('Загружаю «' + file.name + '»…');
    var r = await fetch('/admin/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) },
      body: file
    });
    var j = await r.json().catch(function () { return {}; });
    if (!j.ok) { toast(j.error || 'Не удалось загрузить', true); return null; }
    toast('Файл загружен');
    return j.url;
  }

  async function chooseUploaded() {
    var j = await api('/uploads');
    return new Promise(function (resolve) {
      var grid = el('div', { class: 'gallery' });
      if (!j.files.length) grid.appendChild(el('p', { class: 'muted', text: 'Пока ничего не загружено.' }));
      j.files.forEach(function (u) {
        grid.appendChild(el('button', { class: 'gallery__item', type: 'button', onclick: function () { onModalClose = null; closeModal(); resolve(u); } }, [thumb(u)]));
      });
      openModal('Выберите загруженный файл', grid, function () { resolve(null); });
    });
  }

  function thumb(url) {
    if (/\.mp4$/i.test(url)) return el('video', { src: url, muted: '', class: 'thumb' });
    return el('img', { src: url, alt: '', class: 'thumb', loading: 'lazy' });
  }

  // ---------- модалка ----------
  var onModalClose = null;
  function openModal(title, body, onClose) {
    $('#modal-title').textContent = title;
    var b = $('#modal-body');
    b.innerHTML = '';
    b.appendChild(body);
    $('#modal').hidden = false;
    onModalClose = onClose || null;
  }
  function closeModal() {
    $('#modal').hidden = true;
    var cb = onModalClose; onModalClose = null;
    if (cb) cb();
  }

  // ---------- редактор ----------
  function isImageField(key, value, parentKey) {
    if (parentKey === 'images') return true;
    if (IMG_KEYS.indexOf(key) !== -1) return true;
    return typeof value === 'string' && /^\/(img|uploads)\/.+\.(webp|jpe?g|png|gif|svg|ico|mp4)$/i.test(value);
  }

  function blankLike(v) {
    if (Array.isArray(v)) return [];
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) { o[k] = blankLike(v[k]); });
      return o;
    }
    if (typeof v === 'number') return 0;
    if (typeof v === 'boolean') return false;
    return '';
  }

  function summary(v, i) {
    if (typeof v === 'string') return v || '(пусто)';
    if (Array.isArray(v)) return v.join(' — ') || '(пусто)';
    if (v && typeof v === 'object') {
      if (v.h) return 'Подзаголовок: ' + v.h;
      if (v.list) return 'Список: ' + v.list.slice(0, 2).join('; ') + (v.list.length > 2 ? '…' : '');
      var s = v.title || v.name || v.menu || v.client || v.label || v.slug || v.value || v.service;
      if (!s) { for (var k in v) if (typeof v[k] === 'string' && v[k]) { s = v[k]; break; } }
      return s || 'Элемент ' + (i + 1);
    }
    return String(v);
  }

  function field(label, input, note) {
    return el('label', { class: 'field' }, [el('span', { class: 'field__label', text: label }), input, note ? el('small', { class: 'field__note', text: note }) : null]);
  }

  // Поле для строки/числа/флага. set(newValue) — записать значение в данные.
  function primitive(key, value, set, parentKey, path) {
    var label = parentKey && typeof key === 'number' ? '' : labelFor(key, path);
    if (typeof value === 'boolean') {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = value;
      cb.addEventListener('change', function () { set(cb.checked); setDirty(true); });
      return el('label', { class: 'check' }, [cb, el('span', { text: label })]);
    }
    if (typeof value === 'number') {
      var n = el('input', { type: 'number', value: value, step: 'any' });
      n.addEventListener('input', function () { set(n.value === '' ? '' : Number(n.value)); setDirty(true); });
      return label ? field(label, n) : n;
    }
    if (key === 'icon' && state.icons.length) {
      var sel = el('select');
      state.icons.concat(state.icons.indexOf(value) === -1 && value ? [value] : []).forEach(function (ic) {
        var o = el('option', { value: ic, text: ic }); if (ic === value) o.selected = true; sel.appendChild(o);
      });
      sel.addEventListener('change', function () { set(sel.value); setDirty(true); });
      return field(label, sel);
    }
    if (isImageField(key, value, parentKey)) return imageField(label, value, set, key === 'src' ? 'image/*,video/mp4' : 'image/*');

    var long = LONG_KEYS.indexOf(key) !== -1 || (typeof value === 'string' && value.length > 70) || typeof key === 'number';
    var inp = long ? el('textarea', { rows: Math.min(8, Math.max(2, Math.ceil(String(value).length / 80))) }) : el('input', { type: 'text' });
    inp.value = value == null ? '' : value;
    inp.addEventListener('input', function () { set(inp.value); setDirty(true); });
    var note = key === 'slug' ? 'Меняет адрес страницы. Старые ссылки перестанут работать.' : null;
    return label ? field(label, inp, note) : inp;
  }

  function imageField(label, value, set, accept) {
    var wrap = el('div', { class: 'img-field' });
    var prev = el('div', { class: 'img-field__prev' });
    var inp = el('input', { type: 'text', value: value || '', placeholder: 'Путь к файлу или ссылка' });
    function redraw() {
      prev.innerHTML = '';
      if (inp.value) prev.appendChild(thumb(inp.value)); else prev.appendChild(el('span', { text: 'нет' }));
    }
    inp.addEventListener('input', function () { set(inp.value); setDirty(true); redraw(); });
    var up = el('button', { type: 'button', class: 'btn btn--sm', text: 'Загрузить', onclick: async function () {
      var f = await pickFile(accept); if (!f) return;
      var url = await upload(f); if (!url) return;
      inp.value = url; set(url); setDirty(true); redraw();
    } });
    var pick = el('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Из загруженных', onclick: async function () {
      var url = await chooseUploaded(); if (!url) return;
      inp.value = url; set(url); setDirty(true); redraw();
    } });
    redraw();
    wrap.appendChild(prev);
    wrap.appendChild(el('div', { class: 'img-field__side' }, [inp, el('div', { class: 'row' }, [up, pick])]));
    return label ? el('div', { class: 'field' }, [el('span', { class: 'field__label', text: label }), wrap]) : wrap;
  }

  // Узел дерева: объект или массив
  function node(key, value, set, path, parentKey) {
    if (value === null || typeof value !== 'object') return primitive(key, value, set, parentKey, path);
    if (Array.isArray(value)) return arrayNode(key, value, path);
    return objectNode(key, value, path);
  }

  function objectNode(key, obj, path) {
    var box = el('div', { class: 'obj' });
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      var child = node(k, v, function (nv) { obj[k] = nv; }, path.concat(k), key);
      if (v && typeof v === 'object') {
        box.appendChild(group(labelFor(k, path), child, path.length > 0));
      } else {
        box.appendChild(child);
      }
    });
    return box;
  }

  function group(title, body, collapsed) {
    var g = el('details', { class: 'group' });
    if (!collapsed) g.open = true;
    g.appendChild(el('summary', { text: title }));
    g.appendChild(body);
    return g;
  }

  function arrayNode(key, arr, path) {
    var box = el('div', { class: 'arr' });
    var list = el('div', { class: 'arr__list' });
    var allStrings = arr.every(function (x) { return typeof x === 'string'; });
    var pairs = key === 'attrs' || key === 'rows' || (arr.length && arr.every(function (x) { return Array.isArray(x); }));
    var mixedBlocks = key === 'body';
    var filterInput = null;

    function redraw() {
      list.innerHTML = '';
      var q = filterInput ? filterInput.value.trim().toLowerCase() : '';
      arr.forEach(function (item, i) {
        if (q && JSON.stringify(item).toLowerCase().indexOf(q) === -1) return;
        list.appendChild(row(item, i));
      });
    }

    function controls(i) {
      return el('div', { class: 'ctrl' }, [
        el('button', { type: 'button', title: 'Выше', text: '↑', disabled: i === 0 ? '' : null, onclick: function (e) { e.preventDefault(); move(i, -1); } }),
        el('button', { type: 'button', title: 'Ниже', text: '↓', disabled: i === arr.length - 1 ? '' : null, onclick: function (e) { e.preventDefault(); move(i, 1); } }),
        el('button', { type: 'button', title: 'Копия', text: '⧉', onclick: function (e) { e.preventDefault(); arr.splice(i + 1, 0, JSON.parse(JSON.stringify(arr[i]))); setDirty(true); redraw(); } }),
        el('button', { type: 'button', title: 'Удалить', class: 'del', text: '✕', onclick: function (e) {
          e.preventDefault();
          if (!confirm('Удалить «' + summary(arr[i], i).slice(0, 60) + '»?')) return;
          arr.splice(i, 1); setDirty(true); redraw();
        } })
      ]);
    }
    function move(i, d) {
      var j = i + d; if (j < 0 || j >= arr.length) return;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t; setDirty(true); redraw();
    }

    function row(item, i) {
      var set = function (nv) { arr[i] = nv; };
      if (item === null || typeof item !== 'object') {
        return el('div', { class: 'arr__row' }, [primitive(i, item, set, key, path), controls(i)]);
      }
      if (Array.isArray(item) && item.every(function (x) { return typeof x !== 'object'; })) {
        // пара «название — значение»
        var cells = item.map(function (v, j) {
          var inp = el('input', { type: 'text', value: v });
          inp.addEventListener('input', function () { item[j] = inp.value; setDirty(true); });
          return inp;
        });
        return el('div', { class: 'arr__row arr__row--pair' }, cells.concat([controls(i)]));
      }
      // объект — сворачиваемая карточка, содержимое строится при открытии
      var card = el('details', { class: 'card' });
      var sum = el('summary', {}, [el('span', { class: 'card__num', text: String(i + 1) }), el('span', { class: 'card__title', text: summary(item, i) }), controls(i)]);
      card.appendChild(sum);
      var built = false;
      card.addEventListener('toggle', function () {
        if (card.open && !built) {
          built = true;
          var inner = node(i, item, set, path.concat(i), key);
          inner.addEventListener('input', function () { sum.querySelector('.card__title').textContent = summary(item, i); });
          card.appendChild(el('div', { class: 'card__body' }, [inner]));
        }
      });
      return card;
    }

    if (arr.length > 12 && !allStrings) {
      filterInput = el('input', { type: 'search', class: 'arr__filter', placeholder: 'Поиск по ' + arr.length + ' элементам…' });
      filterInput.addEventListener('input', redraw);
      box.appendChild(filterInput);
    }
    box.appendChild(list);

    var add = el('div', { class: 'arr__add' });
    function addBtn(text, make) {
      add.appendChild(el('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: text, onclick: function () {
        arr.push(make()); setDirty(true); if (filterInput) filterInput.value = ''; redraw();
        var last = list.lastElementChild; if (last && last.tagName === 'DETAILS') last.open = true;
        if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } }));
    }
    if (mixedBlocks) {
      addBtn('+ Абзац', function () { return ''; });
      addBtn('+ Подзаголовок', function () { return { h: '' }; });
      addBtn('+ Список', function () { return { list: [''] }; });
      addBtn('+ Картинка', function () { return { img: '', alt: '' }; });
    } else if (pairs) {
      addBtn('+ Строка', function () { return ['', '']; });
    } else if (!arr.length && TEMPLATES[key]) {
      addBtn('+ Добавить', function () { return JSON.parse(JSON.stringify(TEMPLATES[key])); });
    } else if (!arr.length || allStrings) {
      addBtn('+ Добавить', function () { return ''; });
    } else {
      addBtn('+ Добавить', function () { return blankLike(arr[0]); });
    }
    box.appendChild(add);
    redraw();
    return box;
  }

  // ---------- экраны ----------
  function setHeader(title, hint, actions) {
    $('#title').textContent = title;
    $('#hint').textContent = hint || '';
    var a = $('#actions'); a.innerHTML = '';
    (actions || []).forEach(function (b) { a.appendChild(b); });
    document.title = title + ' — админ-панель';
  }

  function navigate(hash) { if (location.hash !== hash) location.hash = hash; else route(); }

  async function route() {
    if (state.dirty && !confirm('Есть несохранённые изменения. Уйти без сохранения?')) {
      history.replaceState(null, '', '#' + (state.current ? 'c/' + state.current : ''));
      return;
    }
    setDirty(false);
    document.body.classList.remove('side-open');
    var h = location.hash.slice(1) || 'dashboard';
    markNav(h);
    var content = $('#content');
    content.innerHTML = '<p class="muted">Загрузка…</p>';
    try {
      if (h.indexOf('c/') === 0) await showCollection(h.slice(2));
      else if (h === 'leads') await showLeads();
      else if (h === 'files') await showFiles();
      else showDashboard();
    } catch (e) {
      content.innerHTML = '';
      content.appendChild(el('p', { class: 'error', text: e.message }));
    }
  }

  function markNav(h) {
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + h);
    });
  }

  function showDashboard() {
    state.current = null;
    setHeader('Добро пожаловать', 'Выберите, что хотите изменить');
    var grid = el('div', { class: 'tiles' });
    state.collections.forEach(function (c) {
      grid.appendChild(el('a', { class: 'tile', href: '#c/' + c.name }, [el('b', { text: c.title }), el('span', { text: c.hint })]));
    });
    grid.appendChild(el('a', { class: 'tile tile--alt', href: '#leads' }, [el('b', { text: 'Заявки с сайта' }), el('span', { text: 'Все заявки из форм' })]));
    grid.appendChild(el('a', { class: 'tile tile--alt', href: '#files' }, [el('b', { text: 'Файлы' }), el('span', { text: 'Загруженные картинки и видео' })]));
    var c = $('#content'); c.innerHTML = '';
    c.appendChild(grid);
    c.appendChild(el('div', { class: 'help' }, [
      el('h3', { text: 'Как это работает' }),
      el('p', { text: 'Откройте раздел, измените тексты, картинки или порядок элементов и нажмите «Сохранить изменения» (или Ctrl+S). Изменения сразу появятся на сайте.' }),
      el('p', { text: 'Каждое сохранение запоминается: в «Истории» можно вернуть любую из 15 предыдущих версий раздела.' }),
      el('p', { text: 'В текстах можно писать {{name}}, {{phone}}, {{email}}, {{address}} — подставятся значения из общих настроек.' })
    ]));
  }

  async function showCollection(name) {
    var meta = state.collections.find(function (c) { return c.name === name; });
    if (!meta) throw new Error('Раздел не найден');
    var j = await api('/c/' + name);
    state.current = name;
    state.data = j.data;
    var saveBtn = el('button', { id: 'save', class: 'btn btn--acc', disabled: '', text: 'Сохранено', onclick: save });
    setHeader(meta.title, meta.hint, [
      el('a', { class: 'btn btn--ghost', href: LINKS[name] || '/', target: '_blank', text: 'На сайте ↗' }),
      el('button', { class: 'btn btn--ghost', text: 'История', onclick: showHistory }),
      el('button', { class: 'btn btn--ghost', text: 'JSON', onclick: showRaw }),
      saveBtn
    ]);
    var c = $('#content'); c.innerHTML = '';
    c.appendChild(el('form', { class: 'editor', onsubmit: function (e) { e.preventDefault(); } }, [objectNode(null, state.data, [])]));
  }

  async function save() {
    var b = $('#save'); if (b) { b.disabled = true; b.textContent = 'Сохраняю…'; }
    try {
      await api('/c/' + state.current, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: state.data }) });
      setDirty(false);
      toast('Сохранено. Изменения уже на сайте.');
    } catch (e) {
      toast(e.message, true);
      setDirty(true);
    }
  }

  async function showHistory() {
    var j = await api('/c/' + state.current + '/history');
    var box = el('div', { class: 'hist' });
    if (!j.history.length) box.appendChild(el('p', { class: 'muted', text: 'Сохранений ещё не было.' }));
    j.history.forEach(function (h) {
      box.appendChild(el('div', { class: 'hist__row' }, [
        el('span', { text: 'Версия до сохранения ' + new Date(h.date).toLocaleString('ru-RU') }),
        el('button', { class: 'btn btn--sm', text: 'Вернуть', onclick: async function () {
          if (!confirm('Вернуть эту версию? Текущая попадёт в историю.')) return;
          await api('/c/' + state.current + '/restore/' + h.i, { method: 'POST' });
          closeModal(); setDirty(false); toast('Версия восстановлена'); route();
        } })
      ]));
    });
    box.appendChild(el('div', { class: 'hist__reset' }, [
      el('button', { class: 'btn btn--sm btn--danger', text: 'Сбросить раздел к исходной версии', onclick: async function () {
        if (!confirm('Вернуть раздел к исходному состоянию (как при запуске сайта)? Текущая версия попадёт в историю.')) return;
        await api('/c/' + state.current + '/reset', { method: 'POST' });
        closeModal(); setDirty(false); toast('Раздел сброшен'); route();
      } })
    ]));
    openModal('История изменений', box);
  }

  function showRaw() {
    var ta = el('textarea', { class: 'raw', spellcheck: 'false' });
    ta.value = JSON.stringify(state.data, null, 2);
    var err = el('p', { class: 'error' });
    var box = el('div', {}, [
      el('p', { class: 'muted', text: 'Для опытных: весь раздел в формате JSON. После применения не забудьте сохранить.' }),
      ta, err,
      el('button', { class: 'btn btn--acc', text: 'Применить', onclick: function () {
        try {
          var d = JSON.parse(ta.value);
          if (typeof d !== 'object' || d === null) throw new Error('Нужен объект');
          state.data = d;
          closeModal();
          var c = $('#content'); c.innerHTML = '';
          c.appendChild(el('form', { class: 'editor' }, [objectNode(null, state.data, [])]));
          setDirty(true);
        } catch (e) { err.textContent = 'Ошибка в JSON: ' + e.message; }
      } })
    ]);
    openModal('JSON раздела', box);
  }

  async function showLeads() {
    state.current = null;
    setHeader('Заявки с сайта', 'Последние 300 заявок из всех форм');
    var j = await api('/leads');
    var c = $('#content'); c.innerHTML = '';
    if (!j.leads.length) { c.appendChild(el('p', { class: 'muted', text: 'Заявок пока нет.' })); return; }
    var t = el('table', { class: 'leads' });
    t.appendChild(el('tr', {}, ['Дата', 'Имя', 'Телефон', 'Комментарий', 'Откуда', ''].map(function (h) { return el('th', { text: h }); })));
    j.leads.forEach(function (l) {
      t.appendChild(el('tr', {}, [
        el('td', { text: new Date(l.date).toLocaleString('ru-RU') }),
        el('td', { text: l.name || '—' }),
        el('td', {}, [el('a', { href: 'tel:' + (l.phone || '').replace(/[^\d+]/g, ''), text: l.phone || l.email || '—' })]),
        el('td', { text: l.comment || '' }),
        el('td', { class: 'muted', text: l.source || '' }),
        el('td', {}, [el('button', { class: 'btn btn--sm btn--ghost', text: 'Удалить', onclick: async function () {
          if (!confirm('Удалить заявку?')) return;
          await api('/leads/' + encodeURIComponent(l.id), { method: 'DELETE' }); route();
        } })])
      ]));
    });
    c.appendChild(el('div', { class: 'table-wrap' }, [t]));
  }

  async function showFiles() {
    state.current = null;
    setHeader('Файлы', 'Картинки и видео, загруженные через админку', [
      el('button', { class: 'btn btn--acc', text: 'Загрузить файл', onclick: async function () {
        var f = await pickFile('image/*,video/mp4'); if (!f) return;
        if (await upload(f)) route();
      } })
    ]);
    var j = await api('/uploads');
    var c = $('#content'); c.innerHTML = '';
    if (!j.files.length) { c.appendChild(el('p', { class: 'muted', text: 'Файлов пока нет. Картинки загружаются прямо из полей в разделах или здесь.' })); return; }
    var grid = el('div', { class: 'files' });
    j.files.forEach(function (u) {
      grid.appendChild(el('div', { class: 'files__item' }, [
        thumb(u),
        el('code', { text: u }),
        el('div', { class: 'row' }, [
          el('button', { class: 'btn btn--sm btn--ghost', text: 'Копировать путь', onclick: function () { navigator.clipboard.writeText(u); toast('Путь скопирован'); } }),
          el('button', { class: 'btn btn--sm btn--danger', text: 'Удалить', onclick: async function () {
            if (!confirm('Удалить файл? Если он используется на сайте, картинка пропадёт.')) return;
            await api('/uploads/' + encodeURIComponent(u.split('/').pop()), { method: 'DELETE' }); route();
          } })
        ])
      ]));
    });
    c.appendChild(grid);
  }

  // ---------- старт ----------
  async function init() {
    var j = await api('/collections');
    state.collections = j.collections;
    $('#storage').textContent = 'Хранилище: ' + j.storage;
    api('/icons').then(function (r) { state.icons = r.icons; }).catch(function () {});
    var nav = $('#nav');
    nav.appendChild(el('a', { href: '#dashboard', text: 'Главная панели' }));
    nav.appendChild(el('p', { class: 'side__label', text: 'Контент' }));
    j.collections.forEach(function (c) { nav.appendChild(el('a', { href: '#c/' + c.name, text: c.title })); });
    nav.appendChild(el('p', { class: 'side__label', text: 'Прочее' }));
    nav.appendChild(el('a', { href: '#leads', text: 'Заявки' }));
    nav.appendChild(el('a', { href: '#files', text: 'Файлы' }));
    window.addEventListener('hashchange', route);
    route();
  }

  $('#logout').addEventListener('click', async function () {
    await fetch('/admin/logout', { method: 'POST' });
    location.href = '/';
  });
  $('#menu').addEventListener('click', function () { document.body.classList.toggle('side-open'); });
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });

  init().catch(function (e) { toast(e.message, true); });
})();
