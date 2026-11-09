(function () {
  /* Content and form backend: the Google Apps Script web app bound to Yifat's sheet.
     Empty until deployed; the page then keeps the content written in the HTML. */
  var DATA_URL = 'https://script.google.com/macros/s/AKfycby000LPSACokhs8qxtmqugk557khxS0Can-sSEBk_qiaZRcLSPS_4idMoSGfSrWT8Z_/exec';
  var WHATSAPP_GROUP = 'https://chat.whatsapp.com/K7wKS0aRaVA459lflpOVRU';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  // ?capture renders the settled state for screenshots
  if (params.has('capture')) { reduceMotion = true; document.querySelectorAll('img[loading=lazy]').forEach(function (i) { i.loading = 'eager'; }); }
  // ?data=dev/content.mock.json loads local sample content (same-origin paths only)
  var dataOverride = params.get('data');
  if (dataOverride && /^[\w./-]+\.json$/.test(dataOverride) && dataOverride.indexOf('..') < 0) DATA_URL = dataOverride;

  /* ---------- Small helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // *word* becomes the pink highlight, everything else is escaped text
  function rich(s) { return esc(s).replace(/\*([^*\n]+)\*/g, '<span class="hl">$1</span>'); }
  function lines(s) { return String(s || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function paras(s) { return lines(s).map(function (l) { return '<p>' + rich(l) + '</p>'; }).join(''); }
  function list(s) { return lines(s).map(function (l) { return '<li>' + rich(l) + '</li>'; }).join(''); }
  function imgSrc(u) { u = String(u || '').trim(); return /^(https:\/\/|assets\/)/.test(u) ? u : ''; }
  function retreatHref(id) { return 'retreat.html?r=' + encodeURIComponent(id); }
  function retreatLabel(r) { return 'ריטריט ' + r.place + ' ' + r.date; }

  /* ---------- Reveal sections on scroll ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: .15, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Hero parallax ---------- */
  var parallaxEls = document.querySelectorAll('[data-parallax]');
  if (!reduceMotion && parallaxEls.length) {
    var ticking = false;
    var update = function () {
      parallaxEls.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-parallax')) || .2;
        el.style.transform = 'translateY(' + (window.scrollY * speed) + 'px)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- Testimonials carousel (RTL: moving forward is a negative scrollLeft) ---------- */
  var track = document.getElementById('quotes');
  var carPrev = document.getElementById('car-prev');
  var carNext = document.getElementById('car-next');
  var syncArrows = function () {};
  if (track && carPrev && carNext) {
    syncArrows = function () {
      var max = track.scrollWidth - track.clientWidth;
      var pos = Math.abs(track.scrollLeft);
      carPrev.disabled = pos < 8;
      carNext.disabled = pos > max - 8;
    };
    var step = function (dir) {
      var card = track.querySelector('.quote');
      if (!card) return;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      track.scrollBy({ left: -dir * (card.offsetWidth + gap), behavior: reduceMotion ? 'auto' : 'smooth' });
      setTimeout(syncArrows, 500);
    };
    carPrev.addEventListener('click', function () { step(-1); });
    carNext.addEventListener('click', function () { step(1); });
    track.addEventListener('scroll', syncArrows, { passive: true });
    window.addEventListener('resize', syncArrows);
    syncArrows();
  }

  /* ---------- Hide the floating mobile button once the form is on screen ---------- */
  var mobileCta = document.querySelector('.mobile-cta');
  var contact = document.getElementById('contact');
  if (mobileCta && contact && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      mobileCta.style.visibility = entries[0].isIntersecting ? 'hidden' : '';
    }).observe(contact);
  }

  /* ---------- Form ---------- */
  var form = document.getElementById('contact-form');
  var thanks = document.getElementById('thanks');
  var service = document.getElementById('f-service');
  var sendError = document.getElementById('send-error');
  var submitBtn = document.getElementById('f-submit');

  // Links like "לשמוע עוד" preselect the matching option in the form
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-service]');
    if (!a || !service) return;
    var v = a.getAttribute('data-service');
    if ([].some.call(service.options, function (o) { return o.value === v; })) service.value = v;
  });

  var thanksAgain = document.getElementById('thanks-again');
  if (thanksAgain) {
    thanksAgain.addEventListener('click', function () {
      thanks.hidden = true;
      form.hidden = false;
      form.querySelector('input').focus();
    });
  }

  function showThanks() {
    form.reset();
    form.hidden = true;
    sendError.hidden = true;
    thanks.hidden = false;
    thanks.focus({ preventScroll: true });
    thanks.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var opt = service.options[service.selectedIndex];
      var body = new URLSearchParams({
        name: form.elements.name.value,
        phone: form.elements.phone.value,
        email: form.elements.email.value,
        interest: opt ? opt.textContent : '',
        message: form.elements.message.value,
        page: location.pathname.split('/').pop() || 'index.html',
        website: form.elements.website.value
      });
      if (!DATA_URL || /\.json$/.test(DATA_URL)) { showThanks(); return; } // no backend yet / local sample
      submitBtn.disabled = true;
      submitBtn.textContent = 'שולח…';
      // Apps Script answers without CORS headers, so the response is opaque: a resolved fetch means it arrived
      fetch(DATA_URL, { method: 'POST', mode: 'no-cors', body: body })
        .then(showThanks)
        .catch(function () { sendError.hidden = false; })
        .then(function () { submitBtn.disabled = false; submitBtn.textContent = 'לשמוע עוד פרטים'; });
    });
  }

  /* ---------- Live content from the sheet ---------- */
  var retreatId = document.body.getAttribute('data-retreat') || (document.body.hasAttribute('data-retreat-page') ? params.get('r') : null);

  function applyHome(d) {
    var t = d.texts || {};
    document.querySelectorAll('[data-text]').forEach(function (el) {
      var v = t[el.getAttribute('data-text')];
      if (v) el.innerHTML = lines(v).map(rich).join('<br>');
    });
    document.querySelectorAll('[data-paras]').forEach(function (el) {
      var v = t[el.getAttribute('data-paras')];
      if (v) el.innerHTML = paras(v);
    });
    var im = d.images || {};
    document.querySelectorAll('[data-img]').forEach(function (el) {
      var v = imgSrc(im[el.getAttribute('data-img')]);
      if (v) el.src = v;
    });

    var dates = document.getElementById('retreat-dates');
    if (dates && d.retreats && d.retreats.length) {
      dates.innerHTML = d.retreats.map(function (r) {
        return '<li><a href="' + retreatHref(r.id) + '"><span class="rd-date" dir="ltr">' + esc(r.date) + '</span><span class="rd-place">' + esc(r.place) + '</span></a></li>';
      }).join('');
    }

    if (track && d.testimonials && d.testimonials.length) {
      track.innerHTML = d.testimonials.map(function (q) {
        var initial = /^משתתפ/.test(q.name) || !q.name ? '♡' : q.name.charAt(0);
        return '<figure class="quote"><figcaption><span class="avatar" aria-hidden="true">' + esc(initial) + '</span><span><strong>' + esc(q.name) + '</strong>' +
          (q.context ? '<small>' + esc(q.context) + '</small>' : '') + '</span></figcaption><blockquote>' + paras(q.text) + '</blockquote></figure>';
      }).join('');
      track.scrollLeft = 0;
      syncArrows();
    }

    var grid = document.getElementById('gallery-grid');
    if (grid && d.gallery && d.gallery.length) {
      grid.innerHTML = d.gallery.filter(function (g) { return imgSrc(g.src); }).map(function (g, i) {
        return '<img' + (i === 0 ? ' class="g-big"' : '') + ' src="' + esc(imgSrc(g.src)) + '" alt="' + esc(g.alt) + '" loading="lazy">';
      }).join('');
    }

    if (service && (d.retreats || d.services)) {
      var current = service.value;
      var opts = (d.retreats || []).map(function (r) { return { id: 'retreat:' + r.id, label: retreatLabel(r) }; }).concat(d.services || []);
      if (opts.length) {
        service.innerHTML = opts.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.label) + '</option>'; }).join('');
        if ([].some.call(service.options, function (o) { return o.value === current; })) service.value = current;
      }
    }
  }

  function renderRetreat(r, faq) {
    var sched = lines(r.schedule).map(function (l) {
      var parts = l.split('|');
      return '<li><span dir="ltr">' + esc((parts[0] || '').trim()) + '</span><span>' + rich((parts.slice(1).join('|') || '').trim()) + '</span></li>';
    }).join('');
    var myFaq = (faq || []).filter(function (f) { return !f.place || f.place === r.place; });
    var img = imgSrc(r.image);
    return '<section class="rp-hero">' + (img ? '<img src="' + esc(img) + '" alt="">' : '') +
      '<div class="rp-hero-copy"><p class="rp-kind">' + esc(r.kind) + ' · ' + esc(r.place) + '</p><h1>' + esc(r.title) + '</h1>' +
      '<div class="rp-dates"><span class="rp-date" dir="ltr">' + esc(r.date) + '</span></div></div></section>' +
      '<div class="rp-body">' +
      '<section class="rp-lead">' + paras(r.lead) + '</section>' +
      (r.program ? '<section class="rp-block"><h2 class="rp-h">מה בתוכנית?</h2><ul class="rp-list">' + list(r.program) + '</ul></section>' : '') +
      (sched ? '<section class="rp-block"><h2 class="rp-h">לו״ז</h2><ul class="rp-schedule">' + sched + '</ul></section>' : '') +
      (r.who ? '<section class="rp-block"><h2 class="rp-h">למי זה מתאים?</h2>' + paras(r.who) + '</section>' : '') +
      (r.price || r.includes ? '<section class="rp-block rp-price"><h2 class="rp-h">פרטים טכניים</h2>' +
        (r.price ? '<p class="rp-amount">' + esc(r.price) + ' <span>' + esc(r.priceNote) + '</span></p>' : '') +
        (r.includes ? '<p class="rp-inc-title">העלות כוללת:</p><ul class="rp-list">' + list(r.includes) + '</ul>' : '') + '</section>' : '') +
      (r.closing ? '<p class="rp-closing">' + lines(r.closing).map(rich).join('<br>') + '<br>מחכה לכם, יפעת</p>' : '') +
      (myFaq.length ? '<section class="rp-block rp-faq"><h2 class="rp-h">שאלות נפוצות</h2>' + myFaq.map(function (f) {
        return '<details><summary>' + esc(f.q) + '</summary>' + paras(f.a) + '</details>';
      }).join('') + '</section>' : '') +
      '</div>';
  }

  function applyRetreat(d) {
    var main = document.querySelector('main');
    var r = (d.retreats || []).filter(function (x) { return x.id === retreatId; })[0];
    if (!r) {
      if (document.body.hasAttribute('data-retreat-page')) showMissing();
      return;
    }
    main.innerHTML = renderRetreat(r, d.faq);
    document.title = r.title + ' ' + r.date + ' - יוגה עם יפעתי';
  }

  function showMissing() {
    var main = document.querySelector('main');
    if (main) main.innerHTML = '<div class="rp-body rp-missing"><h1 class="rp-h">הריטריט הזה לא נמצא</h1><p>אולי התאריך עודכן. את כל הריטריטים הקרובים אפשר לראות <a href="index.html#retreats">בעמוד הראשי</a>.</p></div>';
  }

  if (DATA_URL) {
    var timer;
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    if (ctrl) timer = setTimeout(function () { ctrl.abort(); }, 8000);
    fetch(DATA_URL + (/\.json$/.test(DATA_URL) ? '' : '?t=' + Math.floor(Date.now() / 60000)), ctrl ? { signal: ctrl.signal } : {})
      .then(function (res) { return res.json(); })
      .then(function (d) {
        clearTimeout(timer);
        if (retreatId) applyRetreat(d); else applyHome(d);
      })
      .catch(function () { if (document.body.hasAttribute('data-retreat-page')) showMissing(); });
  } else if (document.body.hasAttribute('data-retreat-page')) {
    showMissing();
  }
})();
