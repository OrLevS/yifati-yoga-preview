(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ?capture renders the settled state for screenshots
  if (/[?&]capture\b/.test(location.search)) { reduceMotion = true; document.querySelectorAll('img[loading=lazy]').forEach(function (i) { i.loading = 'eager'; }); }

  // Reveal sections on scroll
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

  // Hero parallax
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

  // Contact form — no backend yet: show the thank-you state.
  var form = document.getElementById('contact-form');
  var thanks = document.getElementById('thanks');
  var service = document.getElementById('f-service');
  document.querySelectorAll('[data-service]').forEach(function (a) {
    a.addEventListener('click', function () { service.value = a.getAttribute('data-service'); });
  });
  // Testimonials carousel (RTL: moving forward is a negative scrollLeft)
  var track = document.getElementById('quotes');
  var carPrev = document.getElementById('car-prev');
  var carNext = document.getElementById('car-next');
  if (track && carPrev && carNext) {
    var syncArrows = function () {
      var max = track.scrollWidth - track.clientWidth;
      var pos = Math.abs(track.scrollLeft);
      carPrev.disabled = pos < 8;
      carNext.disabled = pos > max - 8;
    };
    var step = function (dir) {
      var card = track.querySelector('.quote');
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

  // Hide the floating mobile button once the form is on screen
  var mobileCta = document.querySelector('.mobile-cta');
  var contact = document.getElementById('contact');
  if (mobileCta && contact && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      mobileCta.style.visibility = entries[0].isIntersecting ? 'hidden' : '';
    }).observe(contact);
  }
  var thanksAgain = document.getElementById('thanks-again');
  if (thanksAgain) {
    thanksAgain.addEventListener('click', function () {
      thanks.hidden = true;
      form.hidden = false;
      form.querySelector('input').focus();
    });
  }
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.reset();
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus({ preventScroll: true });
      thanks.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
})();
