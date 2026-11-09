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
  // Retreats that have their own static page (better link previews and search results); the rest use retreat.html?r=
  var STATIC_PAGES = ['sdot-yam-14-11', 'sinai-18-21-11', 'sinai-16-19-12', 'sdot-yam-26-12'];
  function retreatHref(id) { return STATIC_PAGES.indexOf(id) >= 0 ? 'retreat-' + id + '.html' : 'retreat.html?r=' + encodeURIComponent(id); }
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
    setHomeEventsLd(d.retreats);

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

  // Used until a "retreat_about" row exists in the sheet's texts tab
  var DEFAULT_RETREAT_ABOUT = 'היי, אני יפעת. היוגה נכנסה לחיים שלי לפני יותר מ־20 שנה, כבר 14 שנה שאני מלמדת, ובעשור האחרון אני לוקחת אנשים איתי לריטריטים בארץ, בסיני ובחו״ל.\nמה שאני הכי אוהבת בכל מה שאני עושה הוא *המפגש עם אנשים*. השיחות שמתפתחות, הדברים שאנשים מביאים מעצמם, והרגעים שבהם פתאום נפתח כיוון שלא חשבנו עליו.';

  function renderRetreat(r, faq, d) {
    var t = (d && d.texts) || {};
    var aboutText = t.retreat_about || DEFAULT_RETREAT_ABOUT;
    var aboutImg = imgSrc((d && d.images && d.images.about) || 'assets/images/about-portrait.jpg');
    var sched = lines(r.schedule).map(function (l) {
      var parts = l.split('|');
      return '<li><span dir="ltr">' + esc((parts[0] || '').trim()) + '</span><span>' + rich((parts.slice(1).join('|') || '').trim()) + '</span></li>';
    }).join('');
    var gal = (r.gallery || []).map(imgSrc).filter(Boolean).slice(0, 8);
    var myFaq = (faq || []).filter(function (f) { return !f.place || f.place === r.place; });
    var img = imgSrc(r.image);
    return '<section class="rp-hero">' + (img ? '<img src="' + esc(img) + '" alt="">' : '') +
      '<div class="rp-hero-copy"><p class="rp-kind">' + esc(r.kind) + ' · ' + esc(r.place) + '</p><h1>' + esc(r.title) + '</h1>' +
      '<div class="rp-dates"><span class="rp-date" dir="ltr">' + esc(r.date) + '</span></div></div></section>' +
      '<div class="rp-body">' +
      '<section class="rp-lead">' + paras(r.lead) + '</section>' +
      (r.program ? '<section class="rp-block"><h2 class="rp-h">מה בתוכנית?</h2><ul class="rp-list">' + list(r.program) + '</ul></section>' : '') +
      (sched ? '<section class="rp-block"><h2 class="rp-h">לו״ז</h2><ul class="rp-schedule">' + sched + '</ul></section>' : '') +
      (gal.length ? '<section class="rp-block"><h2 class="rp-h">רגעים מהמקום</h2><div class="rp-gallery">' + gal.map(function (g, i) {
        return '<button type="button" class="rp-shot" data-full="' + esc(g) + '" aria-label="להגדלת תמונה ' + (i + 1) + '"><img src="' + esc(g) + '" alt="" loading="lazy"></button>';
      }).join('') + '</div></section>' : '') +
      '<section class="rp-block rp-about">' + (aboutImg ? '<img class="rp-about-photo" src="' + esc(aboutImg) + '" alt="יפעת" loading="lazy">' : '') +
        '<div><h2 class="rp-h">' + esc(t.retreat_about_title || 'קצת עליי') + '</h2>' + paras(aboutText) + '</div></section>' +
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
    main.innerHTML = renderRetreat(r, d.faq, d);
    document.title = r.title + ' ' + r.date + ' - יוגה עם יפעתי';
    var desc = document.querySelector('meta[name=description]');
    if (desc) desc.setAttribute('content', (r.kind + ' ב' + r.place + ' ' + r.date + ' עם יפעת. ' + lines(r.lead)[0]).replace(/\*/g, '').slice(0, 155));
    if (document.body.hasAttribute('data-retreat-page')) {
      var canon = document.querySelector('link[rel=canonical]');
      if (canon) canon.href = SITE + retreatHref(r.id);
    }
    setEventLd(r);
  }

  /* ---------- Event structured data, so Google can show the retreat dates ---------- */
  var SITE = 'https://ifatyoga.com/';

  // "18-21.11" or "14.11" (optionally ".2027"); without a year, the next upcoming occurrence
  function parseDates(s) {
    var m = String(s || '').match(/(\d{1,2})(?:\s*-\s*(\d{1,2}))?\.(\d{1,2})(?:\.(\d{2,4}))?/);
    if (!m) return null;
    var d1 = +m[1], d2 = +(m[2] || m[1]), mo = +m[3], now = new Date();
    var y = m[4] ? (m[4].length === 2 ? 2000 + +m[4] : +m[4]) : now.getFullYear();
    if (!m[4] && new Date(y, mo - 1, d2) < new Date(now.getTime() - 60 * 864e5)) y++;
    return { y: y, mo: mo, d1: d1, d2: d2 };
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function eventLd(r) {
    var dt = parseDates(r.date);
    if (!dt) return null;
    var tz = dt.mo >= 4 && dt.mo <= 10 ? '+03:00' : '+02:00';
    var day1 = dt.y + '-' + pad(dt.mo) + '-' + pad(dt.d1), day2 = dt.y + '-' + pad(dt.mo) + '-' + pad(dt.d2);
    var times = lines(r.schedule).map(function (l) { return (l.split('|')[0] || '').trim(); }).filter(function (t) { return /^\d{1,2}:\d{2}$/.test(t); });
    var start = times.length ? day1 + 'T' + pad(+times[0].split(':')[0]) + ':' + times[0].split(':')[1] + ':00' + tz : day1;
    var end = times.length > 1 ? day2 + 'T' + pad(+times[times.length - 1].split(':')[0]) + ':' + times[times.length - 1].split(':')[1] + ':00' + tz : day2;
    var url = SITE + retreatHref(r.id);
    var img = imgSrc(r.image);
    var prices = (String(r.price || '').match(/\d{2,6}/g) || []).map(Number);
    var offers = !prices.length ? undefined : prices.length === 1
      ? { '@type': 'Offer', price: prices[0], priceCurrency: 'ILS', url: url, availability: 'https://schema.org/InStock' }
      : { '@type': 'AggregateOffer', lowPrice: Math.min.apply(null, prices), highPrice: Math.max.apply(null, prices), priceCurrency: 'ILS', url: url, availability: 'https://schema.org/InStock' };
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: r.title + ' - ' + r.kind + ' ב' + r.place,
      description: lines(r.lead).join(' ').replace(/\*/g, '').slice(0, 300),
      startDate: start,
      endDate: end,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: r.place, address: { '@type': 'PostalAddress', addressLocality: r.place, addressCountry: /סיני/.test(r.place) ? 'EG' : 'IL' } },
      image: img ? [/^https:/.test(img) ? img : SITE + img] : undefined,
      url: url,
      offers: offers,
      organizer: { '@type': 'Organization', name: 'יוגה עם יפעתי', url: SITE },
      performer: { '@type': 'Person', name: 'יפעת' }
    };
  }

  function setEventLd(r) {
    var data = eventLd(r);
    if (!data) return;
    var el = document.getElementById('event-ld');
    if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'event-ld'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(data);
  }

  // Home page: one event per upcoming retreat
  function setHomeEventsLd(retreats) {
    var list = (retreats || []).map(eventLd).filter(Boolean);
    if (!list.length) return;
    var el = document.getElementById('events-ld');
    if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'events-ld'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(list);
  }

  // Retreat gallery: click a photo to see it large
  document.addEventListener('click', function (e) {
    var shot = e.target.closest && e.target.closest('.rp-shot');
    if (!shot) return;
    var dlg = document.getElementById('lightbox');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'lightbox';
      dlg.className = 'lightbox';
      dlg.innerHTML = '<button type="button" class="lightbox-close" aria-label="סגירה">×</button><img alt="">';
      dlg.addEventListener('click', function (ev) { if (ev.target === dlg || ev.target.classList.contains('lightbox-close')) dlg.close(); });
      document.body.appendChild(dlg);
    }
    dlg.querySelector('img').src = shot.getAttribute('data-full');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  });

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
