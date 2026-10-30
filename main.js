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
  // Hide the floating mobile button once the form is on screen
  var mobileCta = document.querySelector('.mobile-cta');
  var contact = document.getElementById('contact');
  if (mobileCta && contact && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      mobileCta.style.visibility = entries[0].isIntersecting ? 'hidden' : '';
    }).observe(contact);
  }
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.hidden = true;
      thanks.hidden = false;
    });
  }
})();
