// =========================================
// Gabriel Kundrát – jednoduché interakcie
// =========================================

(function () {
  'use strict';

  // Sticky nav – tieň po scrollovaní
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 10) nav.classList.add('is-scrolled');
      else nav.classList.remove('is-scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobilné menu (jednoduchý toggle)
  const burger = document.getElementById('navBurger');
  const links = document.getElementById('navLinks');
  if (burger && links) {
    burger.addEventListener('click', () => {
      const isOpen = links.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      // pridaj inline štýly pre otvorené menu
      if (isOpen) {
        links.style.cssText = `
          display: flex;
          flex-direction: column;
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--paper);
          padding: 24px;
          gap: 18px;
          border-top: 1px solid var(--line);
          box-shadow: 0 12px 24px -12px rgba(0,0,0,0.1);
        `;
      } else {
        links.style.cssText = '';
      }
    });

    // zatvor menu po kliknutí na link
    links.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        if (links.classList.contains('is-open')) {
          links.classList.remove('is-open');
          links.style.cssText = '';
          burger.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  // Scroll-reveal: sekcie pri vstupe do viewportu
  const revealTargets = document.querySelectorAll(
    '.section-head, .service, .review, .process__step, ' +
    '.about__visual, .about__content, .contact__intro, .contact__cards, .contact__note'
  );
  revealTargets.forEach((el) => el.classList.add('reveal'));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    // fallback – ak prehliadač nepodporuje IO, ukáž všetko hneď
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }

  // Aktuálny rok v päte
  const yearTargets = document.querySelectorAll('[data-current-year]');
  yearTargets.forEach((el) => (el.textContent = new Date().getFullYear()));
})();
