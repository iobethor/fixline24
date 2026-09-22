(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----- Вход в админку: долгое нажатие (1,5 с) на логотип -----
  $$('.header .logo').forEach(function (logo) {
    var timer = null, fired = false;
    function start(e) {
      if (e.button && e.button !== 0) return;
      fired = false;
      logo.classList.add('is-holding');
      timer = setTimeout(function () {
        fired = true;
        logo.classList.remove('is-holding');
        location.href = '/admin/';
      }, 1500);
    }
    function stop() { clearTimeout(timer); logo.classList.remove('is-holding'); }
    logo.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { logo.addEventListener(ev, stop); });
    logo.addEventListener('click', function (e) { if (fired) e.preventDefault(); });
    logo.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    logo.addEventListener('dragstart', function (e) { e.preventDefault(); });
  });

  // ----- Мобильное меню -----
  var burger = $('[data-burger]');
  var nav = $('[data-nav]');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = !nav.classList.contains('is-open');
      if (open) nav.style.top = document.querySelector('.header').getBoundingClientRect().bottom + 'px';
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open);
      document.body.classList.toggle('nav-open', open);
    });
  }
  $$('.nav__toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.parentElement.classList.toggle('is-open');
    });
  });

  // ----- Слайдеры (прокрутка + стрелки) -----
  $$('[data-slider-arrows]').forEach(function (arrows) {
    var track = $('[data-slider="' + arrows.getAttribute('data-slider-arrows') + '"]');
    if (!track) return;
    $$('.arrow', arrows).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = Number(btn.getAttribute('data-dir'));
        var item = track.firstElementChild;
        var step = item ? item.getBoundingClientRect().width + 16 : track.clientWidth;
        var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
        var atStart = track.scrollLeft <= 4;
        if (dir > 0 && atEnd) track.scrollTo({ left: 0, behavior: 'smooth' });
        else if (dir < 0 && atStart) track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
        else track.scrollBy({ left: dir * step, behavior: 'smooth' });
      });
    });
  });

  // ----- Модальное окно заявки -----
  var modal = $('[data-modal="lead"]');
  function openModal(product) {
    if (!modal) return;
    var comment = $('textarea[name="comment"]', modal);
    if (product && comment && !comment.value) comment.value = 'Интересует: ' + product;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { var f = $('input[name="name"]', modal); if (f) f.focus(); }, 50);
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-modal-open]');
    if (opener) { e.preventDefault(); openModal(opener.getAttribute('data-product')); }
    if (e.target.closest('[data-modal-close]')) closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // ----- Отправка форм -----
  $$('[data-lead-form]').forEach(function (form) {
    var status = $('[data-status]', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = form.elements.phone;
      var agree = form.elements.agree;
      var digits = (phone.value || '').replace(/\D/g, '');
      phone.classList.toggle('is-error', digits.length < 10);
      agree.parentElement.classList.toggle('is-error', !agree.checked);
      if (digits.length < 10) { setStatus('Укажите номер телефона', 'err'); phone.focus(); return; }
      if (!agree.checked) { setStatus('Нужно согласие на обработку данных', 'err'); return; }

      var data = {
        name: form.elements.name.value,
        phone: phone.value,
        comment: form.elements.comment.value,
        source: form.elements.source.value + ' | ' + location.pathname
      };
      var btn = $('button[type="submit"]', form);
      btn.disabled = true;
      setStatus('Отправляем…', '');
      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.ok) throw new Error(res.error);
        form.reset();
        setStatus('Спасибо! Заявка отправлена, мы скоро свяжемся с вами.', 'ok');
      }).catch(function () {
        setStatus('Не удалось отправить. Позвоните нам или напишите в MAX.', 'err');
      }).then(function () { btn.disabled = false; });
    });
    function setStatus(text, cls) { status.textContent = text; status.className = 'lead-form__status ' + cls; }
  });

  // Маска телефона (простая)
  $$('input[type="tel"]').forEach(function (input) {
    input.addEventListener('input', function () {
      var d = input.value.replace(/\D/g, '');
      if (!d) { input.value = ''; return; }
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);
      var out = '+7';
      if (d.length > 1) out += ' (' + d.slice(1, 4);
      if (d.length >= 4) out += ')';
      if (d.length > 4) out += ' ' + d.slice(4, 7);
      if (d.length > 7) out += '-' + d.slice(7, 9);
      if (d.length > 9) out += '-' + d.slice(9, 11);
      input.value = out;
    });
  });

  // ----- Галерея товара -----
  $$('[data-gallery]').forEach(function (g) {
    var main = $('[data-gallery-main]', g);
    $$('[data-gallery-thumb]', g).forEach(function (t) {
      t.addEventListener('click', function () {
        main.src = t.getAttribute('data-gallery-thumb');
        $$('[data-gallery-thumb]', g).forEach(function (x) { x.classList.toggle('is-active', x === t); });
      });
    });
  });

  // ----- Cookie -----
  var cookie = $('[data-cookie]');
  try {
    if (cookie && !localStorage.getItem('cookieOk')) cookie.hidden = false;
  } catch (e) { if (cookie) cookie.hidden = false; }
  var cookieOk = $('[data-cookie-ok]');
  if (cookieOk) cookieOk.addEventListener('click', function () {
    cookie.hidden = true;
    try { localStorage.setItem('cookieOk', '1'); } catch (e) { /* ignore */ }
  });

  // ----- Счётчики -----
  function animateCount(el) {
    var target = Number(el.getAttribute('data-count'));
    if (reduceMotion) { el.textContent = target.toLocaleString('ru-RU'); return; }
    var start = null;
    var dur = 2200;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * eased).toLocaleString('ru-RU');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var counters = $('[data-counters]');
  if (counters && 'IntersectionObserver' in window) {
    $$('[data-count]', counters).forEach(function (el) { el.textContent = '0'; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        counters.classList.add('is-visible');
        $$('[data-count]', counters).forEach(animateCount);
        io.disconnect();
      });
    }, { threshold: 0.3 });
    io.observe(counters);
  } else if (counters) {
    counters.classList.add('is-visible');
  }

  // ----- Фон «сеть точек» для счётчиков -----
  var canvas = $('[data-plexus]');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var pts = [];
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var mouse = { x: -9999, y: -9999 };
    var running = false;

    function resize() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(90, (W * H) / 14000));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
          r: Math.random() * 3 + 1.5
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var maxD = 150;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxD) {
            ctx.strokeStyle = 'rgba(95,107,125,' + (1 - d / maxD) * .35 + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        var md = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (md < 180) {
          ctx.strokeStyle = 'rgba(10,138,106,' + (1 - md / 180) * .7 + ')';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = md < 180 ? 'rgba(20,199,154,.9)' : 'rgba(95,107,125,.55)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      if (running) requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    canvas.parentElement.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    canvas.parentElement.addEventListener('mouseleave', function () { mouse.x = mouse.y = -9999; });

    if (reduceMotion) { draw(); }
    else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !running) { running = true; requestAnimationFrame(draw); }
        if (!vis) running = false;
      }).observe(canvas);
    } else { running = true; draw(); }
  }

  // ----- Плавное появление секций -----
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var targets = $$('.section .container > *:not(.page-title)');
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); ro.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (t) {
      if (t.getBoundingClientRect().top > window.innerHeight) { t.classList.add('reveal'); ro.observe(t); }
    });
  }

  // Видео в hero: пауза при reduced motion
  var video = $('.hero__video');
  if (video && reduceMotion) { video.removeAttribute('autoplay'); video.pause(); }

  // ----- Hero: анимированная «сервисная сеть» (узлы + бегущие импульсы) -----
  var net = $('[data-network]');
  if (net && net.getContext) {
    var nctx = net.getContext('2d');
    var nodes = [], edges = [], pulses = [];
    var NW = 0, NH = 0, ndpr = Math.min(window.devicePixelRatio || 1, 2), netRunning = false;

    function build() {
      var r = net.getBoundingClientRect();
      NW = r.width; NH = r.height;
      net.width = NW * ndpr; net.height = NH * ndpr;
      nctx.setTransform(ndpr, 0, 0, ndpr, 0, 0);
      nodes = []; edges = []; pulses = [];
      var count = Math.round(Math.min(70, (NW * NH) / 16000));
      for (var i = 0; i < count; i++) {
        // плотнее справа, чтобы не мешать тексту слева
        var x = NW * (0.25 + Math.pow(Math.random(), 0.7) * 0.75);
        nodes.push({ x: x, y: Math.random() * NH, r: Math.random() * 1.8 + 1.2, hub: Math.random() < .12, ph: Math.random() * 6.28 });
      }
      for (var a = 0; a < nodes.length; a++) {
        var near = nodes.map(function (n, idx) { return { idx: idx, d: Math.hypot(n.x - nodes[a].x, n.y - nodes[a].y) }; })
          .filter(function (o) { return o.idx !== a; }).sort(function (p, q) { return p.d - q.d; }).slice(0, 2);
        near.forEach(function (o) { if (o.d < 260) edges.push([a, o.idx]); });
      }
    }

    function spawn() {
      if (!edges.length) return;
      var e = edges[Math.floor(Math.random() * edges.length)];
      if (Math.random() < .5) e = [e[1], e[0]];
      pulses.push({ e: e, t: 0, v: .006 + Math.random() * .01 });
    }

    function drawNet(ts) {
      nctx.clearRect(0, 0, NW, NH);
      nctx.lineWidth = 1;
      nctx.strokeStyle = 'rgba(120,145,175,.16)';
      edges.forEach(function (e) {
        var p = nodes[e[0]], q = nodes[e[1]];
        nctx.beginPath(); nctx.moveTo(p.x, p.y); nctx.lineTo(q.x, q.y); nctx.stroke();
      });
      var time = (ts || 0) / 1000;
      nodes.forEach(function (n) {
        if (n.hub) {
          var k = (Math.sin(time * 1.6 + n.ph) + 1) / 2;
          nctx.fillStyle = 'rgba(20,199,154,' + (.08 + k * .12) + ')';
          nctx.beginPath(); nctx.arc(n.x, n.y, 8 + k * 6, 0, 6.283); nctx.fill();
          nctx.fillStyle = 'rgba(20,199,154,.95)';
        } else {
          nctx.fillStyle = 'rgba(160,180,205,.45)';
        }
        nctx.beginPath(); nctx.arc(n.x, n.y, n.r, 0, 6.283); nctx.fill();
      });
      if (pulses.length < 14 && Math.random() < .08) spawn();
      pulses = pulses.filter(function (p) {
        p.t += p.v;
        var a = nodes[p.e[0]], b = nodes[p.e[1]];
        var x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
        var tx = a.x + (b.x - a.x) * Math.max(0, p.t - .15), ty = a.y + (b.y - a.y) * Math.max(0, p.t - .15);
        var g = nctx.createLinearGradient(tx, ty, x, y);
        g.addColorStop(0, 'rgba(20,199,154,0)'); g.addColorStop(1, 'rgba(20,199,154,.9)');
        nctx.strokeStyle = g; nctx.lineWidth = 2;
        nctx.beginPath(); nctx.moveTo(tx, ty); nctx.lineTo(x, y); nctx.stroke();
        nctx.fillStyle = '#14c79a';
        nctx.beginPath(); nctx.arc(x, y, 2.2, 0, 6.283); nctx.fill();
        return p.t < 1;
      });
      if (netRunning) requestAnimationFrame(drawNet);
    }

    build();
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 150); });
    if (reduceMotion) { drawNet(0); }
    else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !netRunning) { netRunning = true; requestAnimationFrame(drawNet); }
        if (!vis) netRunning = false;
      }).observe(net);
    } else { netRunning = true; requestAnimationFrame(drawNet); }
  }
})();
