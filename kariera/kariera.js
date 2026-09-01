// =========================================================================
// Gabriel Kundrát – /kariera/  (náborová landing page)
// =========================================================================

// #########################################################################
// ##  KONFIGURÁCIA                                                       ##
// ##  Čísla pochádzajú z materiálu "01 RHR_prezentér.pdf" (str. 7).      ##
// ##  PRED SPUSTENÍM OVERIŤ, ŽE PLATIA – materiál je z augusta 2022.     ##
// #########################################################################
const KONFIG = {

  // Obchodnícka línia RHR. koef = podiel z toho, ČO PRÍDE DO RHR (1 PJ = 1 €).
  // Finportal si z provízie inštitúcie ponecháva 10 %, do RHR ide 90 %
  // a tam sa berie ako nový 100 % základ. Prepočet na celkovú províziu
  // inštitúcie sa preto robí ako koef × 0,90 (dopočítava sa automaticky).
  kariera: [
    { nazov: 'Obchodník 1',          koef: 0.55, od: 0,     doo: 1500 },
    { nazov: 'Obchodník 2',          koef: 0.62, od: 1501,  doo: 2200 },
    { nazov: 'Obchodník 3',          koef: 0.69, od: 2201,  doo: 3700 },
    { nazov: 'Obchodník 4',          koef: 0.73, od: 3701,  doo: 5000 },
    { nazov: 'Obchodník 5',          koef: 0.77, od: 5001,  doo: 8000 },
    { nazov: 'Exkluzívny obchodník', koef: 0.90, od: 8001,  doo: Infinity }
  ],

  // Podiel celkovej provízie inštitúcie, ktorý prichádza do RHR.
  podielDoRHR: 0.90,

  // Modelový komplexný klient (RHR_prezentér, str. 8): 4 132 PJ.
  // Hypotéka 100 tis. 1 440 + ŽP 1 000 €/rok 1 665 + sporenie 900
  // + II. pilier 82 + PZP 18 + bývanie 27.
  klientPJ: 4132,

  metodika:
    'Porovnanie je postavené na jednom modelovom klientovi (4 132 PJ podľa kariérneho ' +
    'materiálu RHR), aby bola na oboch stranách rovnaká provízia od inštitúcie – ' +
    'percentá naprieč firmami sa porovnať nedajú, každá ich počíta z iného základu. ' +
    'Pozícia v tabuľke sa odvodzuje z priemerného mesačného obratu pri zadanom počte ' +
    'klientov. Ide o modelový prepočet bez bonusov, storien, daní a odvodov. ' +
    'Konkrétne zaradenie pri prestupe sa odvíja od vašej produkcie za posledných 12 mesiacov ' +
    'a potvrdím vám ho až po tom, ako si ju spolu prejdeme. Toto nie je prísľub výšky príjmu.',

  formEndpoint: '',
  formEmail: 'gabriel.kundrat@gmail.com'
};
// #########################################################################

(function () {
  'use strict';

  const eur = (n) => new Intl.NumberFormat('sk-SK', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  }).format(Math.round(n));
  const pct = (n) => (Math.round(n * 1000) / 10).toString().replace('.', ',') + ' %';
  const num = (n) => new Intl.NumberFormat('sk-SK').format(Math.round(n));

  const poziciaPre = (pj) =>
    KONFIG.kariera.find((k) => pj >= k.od && pj <= k.doo) || KONFIG.kariera[0];

  // ---------- Sticky nav ----------
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- Mobilné menu ----------
  const burger = document.getElementById('navBurger');
  const links = document.getElementById('navLinks');
  if (burger && links) {
    const close = () => {
      links.classList.remove('is-open');
      links.style.cssText = '';
      burger.setAttribute('aria-expanded', 'false');
    };
    burger.addEventListener('click', () => {
      const isOpen = links.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      links.style.cssText = isOpen ? `
        display:flex; flex-direction:column; position:absolute; top:100%;
        left:0; right:0; background:var(--paper); padding:24px; gap:18px;
        border-top:1px solid var(--line); box-shadow:0 12px 24px -12px rgba(0,0,0,.1);
      ` : '';
    });
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  }

  // ---------- Checklist ----------
  const checkItems = Array.from(document.querySelectorAll('.check__item'));
  const checkNum = document.getElementById('checkNum');
  const checkText = document.getElementById('checkText');

  const hodnotenie = (n) => {
    if (n === 0) return 'Zaškrtnite vety, ktoré na vás sedia. Podľa výsledku vám poviem, či má vôbec zmysel sa baviť ďalej.';
    if (n <= 2) return 'Vyzerá to, že ste na tom slušne. V takom prípade nič nemeňte – len si pre istotu overte tie dva body vo svojej zmluve.';
    if (n <= 4) return 'Bežný stav, ktorý väčšina ľudí prehliada, lebo si zvykla. Oplatí sa spočítať, koľko vás to stojí ročne. Kalkulačka je hneď nižšie.';
    if (n <= 6) return 'Toto už nie je otázka pocitu, ale peňazí a času. Pozrite si prepočet a potom sa pokojne ozvite – aj keby len na porovnanie.';
    return 'Sedem a viac znamená, že problém nie je vo vás ani vo vašom výkone, ale v nastavení systému. Ozvite sa; prvý rozhovor vás nič nestojí.';
  };

  const prepocitajCheck = () => {
    const n = checkItems.filter((el) => el.classList.contains('is-checked')).length;
    if (checkNum) checkNum.textContent = n + ' / ' + checkItems.length;
    if (checkText) checkText.textContent = hodnotenie(n);
  };
  checkItems.forEach((el) => {
    el.addEventListener('click', () => {
      const on = el.classList.toggle('is-checked');
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
      prepocitajCheck();
    });
  });
  prepocitajCheck();

  // ---------- Kariérna tabuľka ----------
  const grid = document.getElementById('ladderGrid');
  if (grid) {
    grid.innerHTML = KONFIG.kariera.map((k) => `
      <div class="ladder__row" data-poz="${k.nazov}">
        <span class="ladder__name">${k.nazov}</span>
        <span class="ladder__obrat">${k.doo === Infinity
          ? num(k.od) + ' PJ a viac'
          : num(k.od) + ' – ' + num(k.doo) + ' PJ'}</span>
        <span class="ladder__koef">${pct(k.koef)}</span>
        <span class="ladder__brutto">${pct(k.koef * KONFIG.podielDoRHR)}</span>
      </div>`).join('');
  }

  // ---------- Kalkulačka ----------
  const prijem = document.getElementById('prijem');
  const pocet = document.getElementById('pocet');
  const pocetRange = document.getElementById('pocetRange');
  const el = (id) => document.getElementById(id);

  const prepocitajKalk = () => {
    if (!prijem || !pocet) return;

    const dnes = Math.max(0, Number(prijem.value) || 0);          // € za klienta dnes
    const n = Math.max(0, Number(pocet.value) || 0);              // klientov za rok

    // priemerný mesačný obrat v PJ pri danom počte klientov
    const pjMes = (n * KONFIG.klientPJ) / 12;
    const poz = poziciaPre(pjMes);

    const rhr = KONFIG.klientPJ * poz.koef;                       // € za klienta v RHR
    const d = rhr - dnes;

    // celková provízia inštitúcie za modelového klienta
    const brutto = KONFIG.klientPJ / KONFIG.podielDoRHR;
    const koefTerazBrutto = brutto > 0 ? dnes / brutto : 0;

    el('outTeraz').textContent = eur(dnes);
    el('outTu').textContent = eur(rhr);
    el('pctTeraz').textContent = dnes > 0 ? pct(koefTerazBrutto) : '–';
    el('pctTu').textContent = pct(poz.koef * KONFIG.podielDoRHR);
    el('poziciaTu').textContent = poz.nazov;
    el('outRozdiel').textContent = (d > 0 ? '+ ' : '') + eur(d);
    el('outRok').textContent = (d > 0 ? '+ ' : '') + eur(d * n);
    el('outDekada').textContent = (d > 0 ? '+ ' : '') + eur(d * n * 10);

    document.querySelectorAll('.ladder__row').forEach((r) =>
      r.classList.toggle('is-active', r.dataset.poz === poz.nazov));

    const v = el('verdict');
    if (!v) return;
    if (dnes === 0 || n === 0) {
      v.className = 'calc__verdict';
      v.textContent = 'Zadajte obe čísla a uvidíte rozdiel.';
    } else if (d <= 0) {
      v.className = 'calc__verdict calc__verdict--stop';
      v.innerHTML = '<strong>Máte lepšie podmienky, než vám viem ponúknuť.</strong> ' +
        'Pri ' + num(n) + ' klientoch ročne by ste v RHR boli na pozícii ' + poz.nazov +
        ' a za takéhoto klienta by vám prišlo ' + eur(rhr) + '. Vám príde ' + eur(dnes) +
        '. Nemeňte to. Ak vás trápi niečo iné než peniaze, ozvite sa – ale prestup ' +
        'vám v tejto chvíli neodporúčam.';
    } else if (d * n < 2400) {
      v.className = 'calc__verdict calc__verdict--soft';
      v.innerHTML = 'Ročný rozdiel je ' + eur(d * n) + '. Za prestup so všetkým, čo obnáša, ' +
        'to samo osebe nestojí – pozerajte skôr na kmeň, nástroje a to, ' +
        'či vás niekto netlačí do naberania ľudí.';
    } else {
      v.className = 'calc__verdict calc__verdict--go';
      v.innerHTML = 'Pri ' + num(n) + ' komplexných klientoch ročne ste v RHR na pozícii ' +
        '<strong>' + poz.nazov + '</strong> – koeficient <strong>' + pct(poz.koef) +
        '</strong> z toho, čo príde do RHR, teda <strong>' +
        pct(poz.koef * KONFIG.podielDoRHR) + '</strong> z celkovej provízie inštitúcie.';
    }
  };

  if (prijem) prijem.addEventListener('input', prepocitajKalk);
  if (pocet) {
    pocet.addEventListener('input', () => {
      if (pocetRange) pocetRange.value = Math.min(Number(pocet.value) || 0, Number(pocetRange.max));
      prepocitajKalk();
    });
  }
  if (pocetRange) {
    pocetRange.addEventListener('input', () => { pocet.value = pocetRange.value; prepocitajKalk(); });
  }
  const note = document.getElementById('calcNote');
  if (note) note.textContent = KONFIG.metodika;
  prepocitajKalk();

  // ---------- Akordeóny ----------
  document.querySelectorAll('.acc__head').forEach((head) => {
    head.addEventListener('click', () => {
      const item = head.closest('.acc__item');
      const open = item.classList.toggle('is-open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  // ---------- Formulár ----------
  const form = document.getElementById('leadForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.meno || !data.telefon || !data.email) {
        alert('Vyplňte prosím meno, telefón a e-mail.');
        return;
      }
      if (KONFIG.formEndpoint) {
        try {
          const r = await fetch(KONFIG.formEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          form.innerHTML = '<p style="font-size:18px;color:var(--green)">Ďakujem. Ozvem sa vám do 24 hodín.</p>';
          return;
        } catch (err) { /* fallback na mailto */ }
      }
      const telo = [
        'Meno: ' + data.meno,
        'Telefón: ' + data.telefon,
        'E-mail: ' + data.email,
        'Prax: ' + (data.prax || '–'),
        'Mesačný obrat: ' + (data.obrat || '–'),
        '', 'Čo mi prekáža:', data.sprava || '–'
      ].join('\n');
      window.location.href = 'mailto:' + KONFIG.formEmail
        + '?subject=' + encodeURIComponent('Spolupráca – ' + data.meno)
        + '&body=' + encodeURIComponent(telo);
    });
  }

  // ---------- Scroll reveal ----------
  const targets = document.querySelectorAll(
    '.section-head, .filter__card, .check__item, .model, .calc__panel, .split, .ladder, ' +
    '.compare__wrap, .eco__card, .acc__item, .process__step, ' +
    '.about__visual, .about__content, .contact__intro, .form'
  );
  targets.forEach((e) => e.classList.add('reveal'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    targets.forEach((e) => io.observe(e));
  } else {
    targets.forEach((e) => e.classList.add('is-visible'));
  }

  document.querySelectorAll('[data-current-year]')
    .forEach((e) => (e.textContent = new Date().getFullYear()));
})();
