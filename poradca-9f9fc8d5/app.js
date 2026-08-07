"use strict";

/* ============================================================
   KONFIGURÁCIA — jediné miesto, kde sa menia parametre.
   Pri zmene legislatívy prepíšte hodnoty tu a nikde inde.
   ============================================================ */
const CONFIG = {
  zivotneMinimum: { dospely1: 295.22, dospely2: 205.96, dieta: 134.80, platneOd: "1. 7. 2026" },
  dsti:      { koeficient: 0.60 },        // max 60 % z príjmu po odpočítaní životného minima
  dti:       { zaklad: 8, vekZlom: 40, poklesZaRok: 0.25, minimum: 3 },
  stresTest: { navysenieSadzbyPB: 2.0 },  // banka počíta splátku so sadzbou + 2 p.b.
  splatnost: { maxRokov: 30, vekStrop: 65 },
  mimoriadne:{ bezPoplatkuRocne: 0.30, poplatokMax: 0.01 },
  sadzbaTrh: { min: 3.39, max: 3.88 },    // orientačné trhové rozpätie 08/2026

  /* ---------- ŽIVOTNÉ POISTENIE ----------
     Poistné sumy vychádzajú z metodiky RHR (prezentér pre klientov, str. 5):
       Smrť a invalidita nad 40 %  … zostatok hypotéky (+ rezerva pre deti pri Maxi)
       Trvalé následky úrazu       … 3–5× ročný čistý príjem
       Kritické choroby            … 1,5–3× ročný čistý príjem
       PN od 29. dňa               … dorovnanie do 100 % mzdy

     CENA JE ODHAD, NIE SADZOBNÍK POISŤOVNE. Sadzby nižšie sú kalibrované tak,
     aby modelová rodina z prezentéra (manžel 35 r./1 000 €, manželka 33 r./830 €,
     hypotéka 100 000 €, 2 deti, balíček Optimal) vyšla na 130–150 €/mes.
     Keď budete mať z praxe reálne ceny, prepíšte `rezia` alebo jednotlivé sadzby. */
  zivot: {
    // sadzby v € za mesiac; pri poistných sumách za každých 1 000 € krytia
    sadzby: {
      smrt: 0.068, invalidita: 0.130, tnu: 0.140, kch: 0.550,
      pn: 0.80,                 // za 1 € dennej dávky
      d_tnu: 0.050, d_kch: 0.250, d_denne: 0.350   // deti
    },
    rezia: 1.18,                // réžia a poplatky poisťovne
    pasmo: 0.07,                // ±7 % → zobrazené cenové rozpätie
    vekKrivka:   { smrt: 0.045, invalidita: 0.045, kch: 0.060, uraz: 0.015 },
    zenaFaktor:  { smrt: 0.85, invalidita: 0.90, kch: 1.15 },
    fajciarFaktor:{ smrt: 1.35, invalidita: 1.20, kch: 1.35 },
    skupiny: [
      {k:1, f:1.00, popis:"kancelária, obchod, učiteľ, IT"},
      {k:2, f:1.25, popis:"predavač, skladník, vodič, technik"},
      {k:3, f:1.55, popis:"remeselník, stavbár, zdravotník v teréne"},
      {k:4, f:2.00, popis:"práca vo výškach, baník, hasič, pilot"}
    ],
    rezervaNaDieta: 15000,      // pri balíčku Maxi sa pripočíta k poistnej sume za smrť
    nemocenskePodiel: 0.70,     // nemocenské ≈ 70 % čistého príjmu (55 % hrubého DVZ, nedaní sa)
                                // → dorovnanie 30 % dáva presne denné dávky z prezentéra (10 € pri 1 000 €)
    invalidnyPodiel: 0.45,      // orientačný invalidný dôchodok pri invalidite nad 70 %
    pnSkorsiZaciatokFaktor: 1.35 // pripoistenie PN od 15. dňa namiesto 29.
  }
};

/* Tri balíčky. Optimal zámerne reprodukuje modelový príklad z prezentéra. */
const BALICKY = [
  { id:"mini", nazov:"Mini", podnadpis:"Ochrana hypotéky",
    popis:"Minimum pre každého, kto má hypotéku. Kryje to, čo by rodinu položilo — smrť a invaliditu.",
    tnu:2, kch:1, pn:false, pnOd:29, rezervaDeti:false, prijemNasobok:0,
    deti:null },
  { id:"optimal", nazov:"Optimal", podnadpis:"Odporúčané nastavenie", odporucane:true,
    popis:"Päť najdôležitejších rizík u dospelých a tri u detí. Toto nastavenie používame ako východisko.",
    tnu:3.5, kch:1.5, pn:true, pnOd:29, rezervaDeti:false, prijemNasobok:0,
    deti:{ tnu:30000, kch:20000, denne:10 } },
  { id:"maxi", nazov:"Maxi", podnadpis:"Plná ochrana príjmu",
    popis:"Horná hranica odporúčaných pásiem, rezerva pre deti navyše a PN už od 15. dňa.",
    tnu:5, kch:3, pn:true, pnOd:15, rezervaDeti:true, prijemNasobok:2,
    deti:{ tnu:40000, kch:30000, denne:15 } }
];

/* ============================================================
   PORADCOVIA — každý si hore vyberie svoje meno a načíta sa mu
   jeho logo (a neskôr aj vlastné farby).

   PRIDANIE ĎALŠIEHO PORADCU: skopírujte jeden blok a vyplňte.
     id       — čokoľvek jedinečné, používa sa len interne
     meno     — zobrazí sa v hlavičke a v zhrnutí
     rola     — riadok pod menom (napr. "finančný sprostredkovateľ")
     monogram — 2 písmená do štvorčeka, ak nie je logo ako obrázok
     logo     — nechajte "" alebo vložte obrázok ako data URL:
                "data:image/png;base64,iVBORw0KGgo…"
                (v prehliadači: obrázok → prevod na base64, alebo mi ho pošlite)
     kontakt  — objaví sa v päte zhrnutia, ktoré klient dostane
     farby    — zatiaľ sa nemenia; keď budeme robiť farebné verzie,
                stačí odkomentovať a doplniť
   ============================================================ */
const PORADCOVIA = [
  {
    id: "gk",
    meno: "Gabriel Kundrát",
    rola: "finančný sprostredkovateľ",
    monogram: "GK",
    logo: "data:image/png;base64,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",
    kontakt: { web: "gabrielkundrat.sk", email: "", tel: "" },
    farby: { logoBg: "#1c3a2f", logoInk: "#fbf6ec" /*, akcent: "#1c3a2f" — zelená z gabrielkundrat.sk */ }
  }
  // ,{ id:"xy", meno:"Meno Priezvisko", rola:"finančný sprostredkovateľ",
  //    monogram:"XY", logo:"", kontakt:{web:"",email:"",tel:""},
  //    farby:{logoBg:"#0b0b0b", logoInk:"#ffffff"} }
];

let poradca = PORADCOVIA[0];

/* ---------- pomocné ---------- */
const $ = id => document.getElementById(id);
const eur = (v, d = 0) => (isFinite(v) ? v : 0).toLocaleString("sk-SK", {minimumFractionDigits:d, maximumFractionDigits:d}) + " €";
const num = v => (isFinite(v) ? v : 0).toLocaleString("sk-SK", {maximumFractionDigits:1});
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* anuitná splátka */
function anuita(P, rocna, mesiacov){
  if (P <= 0 || mesiacov <= 0) return 0;
  const i = rocna/100/12;
  if (i === 0) return P/mesiacov;
  return P * i / (1 - Math.pow(1+i, -mesiacov));
}
/* súčasná hodnota — z max. splátky spočíta max. istinu */
function istinaZoSplatky(splatka, rocna, mesiacov){
  if (splatka <= 0 || mesiacov <= 0) return 0;
  const i = rocna/100/12;
  if (i === 0) return splatka*mesiacov;
  return splatka * (1 - Math.pow(1+i, -mesiacov)) / i;
}
/* amortizačný plán; extra = mesačne navyše, jednorazova vo zvolenom mesiaci */
function amortizacia(P, rocna, mesiacov, splatka, extra = 0, jednorazova = 0, mesiacJedn = 0){
  const i = rocna/100/12;
  let zost = P, kumUrok = 0, m = 0;
  const rows = [{m:0, zost:P, kumUrok:0}];
  const rocne = [];
  let rokUrok = 0, rokIstina = 0;
  const strop = mesiacov * 2 + 24;           // poistka proti nekonečnu
  while (zost > 0.01 && m < strop){
    m++;
    const urok = zost * i;
    let istina = splatka - urok;
    if (istina <= 0) { rows.push({m, zost, kumUrok}); break; } // splátka nepokryje ani úrok
    istina += extra;
    if (jednorazova > 0 && m === mesiacJedn) istina += jednorazova;
    if (istina > zost) istina = zost;
    zost -= istina; kumUrok += urok;
    rokUrok += urok; rokIstina += istina;
    if (m % 12 === 0 || zost <= 0.01){
      rocne.push({rok: Math.ceil(m/12), urok: rokUrok, istina: rokIstina});
      rokUrok = 0; rokIstina = 0;
    }
    rows.push({m, zost, kumUrok});
  }
  return {rows, rocne, mesiacov: m, urokCelkom: kumUrok};
}

/* ============================================================
   IKONY
   ============================================================ */
const ICONS = {
  rezerva:'<path d="M12 3 4.5 6v5.5c0 4.3 3.1 8 7.5 9.5 4.4-1.5 7.5-5.2 7.5-9.5V6L12 3Z"/><path d="M9.5 12.2 11.3 14l3.4-3.4"/>',
  hypo:  '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M10 21v-6h4v6"/>',
  early: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  zivot: '<path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7-.5c0 5-7 13.5-7 13.5Z"/>',
  deti:  '<circle cx="8" cy="7.5" r="2.5"/><path d="M4 20v-3.5a4 4 0 0 1 8 0V20"/><circle cx="16.5" cy="11" r="2"/><path d="M13.5 20v-2.5a3 3 0 0 1 6 0V20"/>',
  dom:   '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M9 20v-5h6v5"/>',
  doch:  '<path d="M4 20V9m5 11V5m5 15v-8m5 8V7"/>',
  auto:  '<path d="M4 16v-3.5L6 8h12l2 4.5V16"/><path d="M4 16h16"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/>',
  uver:  '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10.5h18"/><path d="M6.5 14.5h3"/>',
  klient:'<circle cx="12" cy="7" r="3.2"/><path d="M5.5 20v-1.5a6.5 6.5 0 0 1 13 0V20"/>',
  mapa:  '<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="6" r="1.8"/><circle cx="19" cy="6" r="1.8"/><circle cx="5" cy="18" r="1.8"/><circle cx="19" cy="18" r="1.8"/><path d="M10.4 10.6 6.3 7.4M13.6 10.6l4.1-3.2M10.4 13.4l-4.1 3.2M13.6 13.4l4.1 3.2"/>'
};
const svgIc = k => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+ICONS[k]+'</svg>';

/* ============================================================
   OBLASTI — spoločný zdroj pre mapu, hornú lištu aj karty.
   live:true = modul je v aplikácii hotový a má vlastnú sekciu.
   ============================================================ */
const OBLASTI = [
  {id:"rezerva", nazov:"Finančná rezerva", vetvy:["3–6 mesačných výdavkov","rýchlo dostupné peniaze"],
   sec:"sec-oblasti", live:false, popis:"Vankúš na nečakané výdavky. Bez neho sa pri prvom probléme siaha po úvere."},
  {id:"hypo",    nazov:"Hypotéka",         vetvy:["predčasné splatenie","poistenie nehnuteľnosti"],
   sec:"sec-hypo",   live:true,  popis:"Úverový rámec, splátka a splátkový plán."},
  {id:"zivot",   nazov:"Životné poistenie",vetvy:["krytie príjmu","krytie hypotéky"],
   sec:"sec-zivot",  live:true, popis:"Krytie príjmu a hypotéky pri chorobe, úraze alebo úmrtí. Tri úrovne — mini, optimal, maxi."},
  {id:"deti",    nazov:"Deti",             vetvy:["poistenie","sporenie a investovanie"],
   sec:"sec-oblasti", live:false, popis:"Poistenie dieťaťa a dlhodobé sporenie na štart do života — škola, bývanie, prvé auto."},
  {id:"doch",    nazov:"Dôchodok",         vetvy:["I. a II. pilier","III. a IV. pilier"],
   sec:"sec-oblasti", live:false, popis:"Kde reálne skončíte pri dnešnom nastavení a čo sa s tým dá urobiť teraz."},
  {id:"auto",    nazov:"Auto",             vetvy:["PZP","kasko a GAP"],
   sec:"sec-oblasti", live:false, popis:"PZP, havarijné poistenie a GAP, porovnanie a načasovanie výpovede."},
  {id:"uver",    nazov:"Spotrebné úvery",  vetvy:["refinancovanie","konsolidácia"],
   sec:"sec-oblasti", live:false, popis:"Zlúčenie drahých úverov do jedného lacnejšieho a nižšia mesačná splátka."},
  {id:"dom",     nazov:"Poistenie nehnuteľnosti", vetvy:[], skryPreMapu:true,
   sec:"sec-oblasti", live:false, popis:"Poistenie stavby a domácnosti, zodpovednosť za škodu. Banka ho pri hypotéke vyžaduje."}
];
const zaujem = {rezerva:false, hypo:true, zivot:false, deti:false, doch:false, auto:false, uver:false, dom:false, early:false};

/* ============================================================
   MAPA PORTFÓLIA — klient v strede, oblasti okolo neho
   ============================================================ */
function renderMapa(v){
  const uzly = OBLASTI.filter(o => !o.skryPreMapu);
  const W = 1000, H = 580, cx = W/2, cy = H/2, rx = 335, ry = 196;
  const bh = 44;
  const n = uzly.length;

  let spoj = "", boxy = "";
  uzly.forEach((o, i) => {
    const a = (-90 + i * (360/n)) * Math.PI/180;
    const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
    // šírka podľa dĺžky názvu, aby fajka nikdy neprekryla text
    const bw = Math.max(168, 62 + o.nazov.length * 8.4 + 26);
    const bx = x - bw/2, by = y - bh/2;
    // spojnica končí na okraji boxu, nie v jeho strede
    const k = 0.80;
    spoj += `<line x1="${cx + 60*Math.cos(a)}" y1="${cy + 60*Math.sin(a)}"
                   x2="${cx + rx*k*Math.cos(a)}" y2="${cy + ry*k*Math.sin(a)}"
                   stroke="var(--grid)" stroke-width="1.5"/>`;
    const on = zaujem[o.id];
    boxy += `<g class="node ${on?'on':''}" data-id="${o.id}" data-sec="${o.sec}" tabindex="0" role="button"
                aria-pressed="${on}" aria-label="${o.nazov}">
      <rect x="${bx-8}" y="${by-6}" width="${bw+16}" height="${bh+14+o.vetvy.length*13}" rx="14"
            fill="transparent" class="nhit"/>
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="11" class="nbox"/>
      <g transform="translate(${bx+14},${by+bh/2-9}) scale(0.75)" class="nic">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[o.id]}</svg>
      </g>
      <text x="${bx+40}" y="${by+bh/2+5}" class="ntxt">${o.nazov}</text>
      ${on ? `<g transform="translate(${bx+bw-19},${by+7})"><circle cx="6" cy="6" r="8" class="nchk"/>
        <path d="M2.6 6.2 5 8.6 9.4 4" fill="none" stroke="#fff" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round"/></g>` : ""}
      ${o.vetvy.map((t,j) => `<text x="${x}" y="${by+bh+15+j*13}" class="nsub">${t}</text>`).join("")}
    </g>`;
  });

  const deti = v ? v.deti : 0;
  const kto = v ? `${v.dvaja ? "2 dospelí" : "1 dospelý"}${deti>0 ? ", "+deti+" "+(deti===1?"dieťa":deti<=4?"deti":"detí") : ""}` : "";

  $("mapa").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa oblastí finančného portfólia">
    ${spoj}
    <circle cx="${cx}" cy="${cy}" r="52" class="hub"/>
    <g transform="translate(${cx-21},${cy-21})" class="hubic">
      <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor"
           stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS.klient}</svg>
    </g>
    <text x="${cx}" y="${cy+72}" class="hubtxt">${kto}</text>
    ${boxy}
  </svg>`;

  $("mapa").querySelectorAll(".node").forEach(el => {
    const klik = () => {
      const o = OBLASTI.find(x => x.id === el.dataset.id);
      if (o.id === "zivot" && !zivotOn) { odomkniZivot(); return; }
      zaujem[o.id] = true;
      renderAll();
      $(o.sec).scrollIntoView({behavior:"smooth", block:"start"});
    };
    el.addEventListener("click", klik);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); klik(); } });
  });
}

/* horná lišta */
function renderModules(){
  const uzly = OBLASTI.filter(o => !o.skryPreMapu);
  $("modules").innerHTML =
    `<div class="mod mapbtn" data-sec="sec-mapa" title="Späť na mapu oblastí">${svgIc("mapa")}<span>Mapa</span></div>` +
    uzly.map(o =>
    `<div class="mod ${zaujem[o.id]?'on':(o.live?'ready':'')}" data-id="${o.id}" data-sec="${o.sec}">
       ${svgIc(o.id)}<span>${o.nazov}</span><span class="dot"></span>
     </div>`).join("");
  document.querySelectorAll(".mod").forEach(el => el.onclick = () => {
    const id = el.dataset.id;
    if (id === "zivot" && !zivotOn) { odomkniZivot(); return; }
    if (id){ zaujem[id] = true; renderAll(); }
    $(el.dataset.sec).scrollIntoView({behavior:"smooth", block:"start"});
  });
}
/* karty oblastí */
function renderAreas(){
  $("areas").innerHTML = OBLASTI.filter(o=>!o.live).map(o =>
    `<div class="area ${zaujem[o.id]?'on':''}" data-id="${o.id}">
       <div class="chk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></div>
       <div class="h">${svgIc(o.id)}<span class="t">${o.nazov}</span></div>
       <p>${o.popis}</p>
     </div>`).join("");
  document.querySelectorAll(".area").forEach(el => el.onclick = () => {
    zaujem[el.dataset.id] = !zaujem[el.dataset.id]; renderAll();
  });
}


/* ============================================================
   ŽIVOTNÉ POISTENIE — poistné sumy a odhad ceny
   ============================================================ */
function osobaVstup(i){
  return {
    vek:      i===1 ? clamp(+$("iVek1").value||35,18,70) : clamp(+$("iVek2").value||35,18,70),
    prijem:   i===1 ? Math.max(0,+$("iPr1").value||0)    : Math.max(0,+$("iPr2").value||0),
    zena:     $("iPohl"+i).value === "z",
    skupina:  +$("iSkup"+i).value || 1,
    fajciar:  $("iFajc"+i).value === "a"
  };
}

/* poistné sumy pre jednu osobu podľa vybraného balíčka */
function kryteSumy(o, bal, hypoZostatok, pocetDeti){
  const rocny = o.prijem * 12;
  const Z = CONFIG.zivot;
  let smrt = hypoZostatok;
  if (bal.rezervaDeti) smrt += pocetDeti * Z.rezervaNaDieta;
  if (bal.prijemNasobok) smrt += bal.prijemNasobok * rocny;
  return {
    smrt,
    invalidita: smrt,
    tnu: Math.round(bal.tnu * rocny / 1000) * 1000,
    kch: Math.round(bal.kch * rocny / 1000) * 1000,
    pnDenne: bal.pn ? Math.round((1 - Z.nemocenskePodiel) * o.prijem / 30) : 0
  };
}

/* odhad mesačného poistného za jednu osobu, rozpísaný po rizikách */
function cenaOsoby(o, ps, bal){
  const Z = CONFIG.zivot, S = Z.sadzby;
  const vek = k => 1 + Math.max(0, o.vek - 30) * k;
  const fS = vek(Z.vekKrivka.smrt)       * (o.zena?Z.zenaFaktor.smrt:1)       * (o.fajciar?Z.fajciarFaktor.smrt:1);
  const fI = vek(Z.vekKrivka.invalidita) * (o.zena?Z.zenaFaktor.invalidita:1) * (o.fajciar?Z.fajciarFaktor.invalidita:1);
  const fK = vek(Z.vekKrivka.kch)        * (o.zena?Z.zenaFaktor.kch:1)        * (o.fajciar?Z.fajciarFaktor.kch:1);
  const fU = vek(Z.vekKrivka.uraz) * (Z.skupiny.find(x=>x.k===o.skupina)||Z.skupiny[0]).f;
  const pnF = bal.pnOd < 29 ? Z.pnSkorsiZaciatokFaktor : 1;
  return {
    smrt:       S.smrt/1000       * ps.smrt       * fS,
    invalidita: S.invalidita/1000 * ps.invalidita * fI,
    tnu:        S.tnu/1000        * ps.tnu        * fU,
    kch:        S.kch/1000        * ps.kch        * fK,
    pn:         S.pn              * ps.pnDenne    * fU * pnF
  };
}
const sucet = o => Object.values(o).reduce((a,b)=>a+b,0);

function cenaDietata(bal){
  if (!bal.deti) return 0;
  const S = CONFIG.zivot.sadzby, d = bal.deti;
  return S.d_tnu/1000*d.tnu + S.d_kch/1000*d.kch + S.d_denne*d.denne;
}

/* celý návrh pre jeden balíček */
function navrh(v, bal){
  const o1 = osobaVstup(1);
  const o2 = v.dvaja ? osobaVstup(2) : null;
  const hypo = v.suma;                       // poistná suma = modelovaná výška hypotéky
  const ps1 = kryteSumy(o1, bal, hypo, v.deti);
  const ps2 = o2 ? kryteSumy(o2, bal, hypo, v.deti) : null;
  const c1 = cenaOsoby(o1, ps1, bal);
  const c2 = o2 ? cenaOsoby(o2, ps2, bal) : null;
  const cd = cenaDietata(bal) * v.deti;
  const spolu = (sucet(c1) + (c2?sucet(c2):0) + cd) * CONFIG.zivot.rezia;
  const p = CONFIG.zivot.pasmo;
  return {bal, o1, o2, ps1, ps2, c1, c2, cd,
          spolu, dolna: spolu*(1-p), horna: spolu*(1+p)};
}

let vybranyBalicek = "optimal";

function renderZivot(v){
  const navrhy = BALICKY.map(b => navrh(v, b));
  const vyb = navrhy.find(n => n.bal.id === vybranyBalicek) || navrhy[1];

  /* --- karty balíčkov --- */
  $("balicky").innerHTML = navrhy.map(n => `
    <div class="bal ${n.bal.id===vybranyBalicek?'on':''}" data-id="${n.bal.id}" tabindex="0" role="button">
      ${n.bal.odporucane ? '<span class="odp">odporúčame</span>' : ''}
      <div class="bt">${n.bal.nazov}</div>
      <div class="bp">${n.bal.podnadpis}</div>
      <div class="bc">${Math.round(n.dolna/5)*5} – ${Math.round(n.horna/5)*5} €</div>
      <div class="bm">mesačne za celú rodinu</div>
      <p>${n.bal.popis}</p>
    </div>`).join("");
  $("balicky").querySelectorAll(".bal").forEach(el => {
    const k = () => { vybranyBalicek = el.dataset.id; renderAll(); };
    el.onclick = k;
    el.onkeydown = e => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); k(); } };
  });

  /* --- tabuľka krytí --- */
  const dvaja = !!vyb.o2;
  const riadok = (nazov, f, pozn) => `<tr><td>${nazov}<span>${pozn||""}</span></td>
      <td>${f(vyb.ps1, vyb.o1)}</td>${dvaja?`<td>${f(vyb.ps2, vyb.o2)}</td>`:""}</tr>`;
  const d = vyb.bal.deti;
  $("kryttab").innerHTML = `
    <table class="kt">
      <thead><tr><th>Riziko</th><th>${dvaja?"Žiadateľ 1":"Žiadateľ"}</th>${dvaja?"<th>Žiadateľ 2</th>":""}</tr></thead>
      <tbody>
        ${riadok("Smrť", ps => eur(ps.smrt), "poistná suma")}
        ${riadok("Invalidita nad 40 %", ps => eur(ps.invalidita), "poistná suma")}
        ${riadok("Trvalé následky úrazu", ps => eur(ps.tnu), `s progresiou · ${num(vyb.bal.tnu)}× ročný príjem`)}
        ${riadok("Kritické choroby", ps => eur(ps.kch), `${num(vyb.bal.kch)}× ročný príjem`)}
        ${riadok(`Práceneschopnosť od ${vyb.bal.pnOd}. dňa`, ps => ps.pnDenne ? eur(ps.pnDenne)+" / deň" : "—", "dorovnanie mzdy")}
      </tbody>
      ${d && v.deti>0 ? `<thead><tr><th>Deti (${v.deti})</th><th colspan="${dvaja?2:1}">na každé dieťa</th></tr></thead>
      <tbody>
        <tr><td>Trvalé následky úrazu<span>s progresiou</span></td><td colspan="${dvaja?2:1}">${eur(d.tnu)}</td></tr>
        <tr><td>Detské kritické choroby</td><td colspan="${dvaja?2:1}">${eur(d.kch)}</td></tr>
        <tr><td>Úraz a hospitalizácia<span>denné odškodné</span></td><td colspan="${dvaja?2:1}">${eur(d.denne)} / deň</td></tr>
      </tbody>` : ""}
    </table>`;

  /* --- scenáre --- */
  const rocny1 = vyb.o1.prijem*12;
  const scen = [];
  scen.push({
    t:"Pri úmrtí",
    bez:`Rodine zostane hypotéka <b>${eur(v.suma)}</b> a príjem klesne o <b>${eur(vyb.o1.prijem)}</b> mesačne.`,
    s:`Poisťovňa vyplatí <b>${eur(vyb.ps1.smrt)}</b> — hypotéka je splatená${vyb.bal.rezervaDeti && v.deti>0 ? " a zostáva rezerva pre deti" : ""}.`
  });
  scen.push({
    t:"Pri invalidite nad 40 %",
    bez:`Invalidný dôchodok je približne <b>${eur(vyb.o1.prijem*CONFIG.zivot.invalidnyPodiel)}</b> mesačne, splátka ${eur(splatkaGlob)} beží ďalej.`,
    s:`Poisťovňa vyplatí <b>${eur(vyb.ps1.invalidita)}</b> jednorazovo.`
  });
  if (vyb.ps1.pnDenne) scen.push({
    t:"Pri dlhodobej chorobe",
    bez:`Nemocenské je približne <b>${eur(vyb.o1.prijem*CONFIG.zivot.nemocenskePodiel)}</b> mesačne — chýba <b>${eur(vyb.o1.prijem*(1-CONFIG.zivot.nemocenskePodiel))}</b>.`,
    s:`Poistenie dopláca <b>${eur(vyb.ps1.pnDenne)}</b> denne, teda <b>${eur(vyb.ps1.pnDenne*30)}</b> mesačne.`
  });
  $("scenare").innerHTML = scen.map(x => `<div class="scen">
      <div class="st">${x.t}</div>
      <div class="sb"><span class="tag bad">bez poistenia</span><p>${x.bez}</p></div>
      <div class="sb"><span class="tag ok">s poistením</span><p>${x.s}</p></div>
    </div>`).join("");

  /* --- graf: príjem pri dlhodobej PN --- */
  const c3 = $("chartPN"); c3.querySelectorAll("svg").forEach(e=>e.remove());
  const prijemDom = v.prijem;
  const vypadok = vyb.o1.prijem * (1 - CONFIG.zivot.nemocenskePodiel);
  const doplatok = vyb.ps1.pnDenne * 30;
  prijemChart(c3, $("tipPN"), [
    {n:"Dnes",                z:prijemDom,          d:0,        p:"plný príjem domácnosti"},
    {n:"PN bez poistenia",    z:prijemDom-vypadok,  d:0,        p:"nemocenské kryje len časť mzdy"},
    {n:"PN s poistením",      z:prijemDom-vypadok,  d:doplatok, p:"poistné plnenie dorovnáva výpadok"}
  ], splatkaGlob);

  return vyb;
}

/* stĺpcový graf mesačného príjmu domácnosti s čiarou splátky */
function prijemChart(host, tipEl, data, splatka){
  const W=900,H=250,PADl=68,PADr=16,PADt=16,PADb=40;
  const iw=W-PADl-PADr, ih=H-PADt-PADb;
  const yMax = niceMax(Math.max(...data.map(d=>d.z+d.d), splatka*1.15));
  const bw = Math.min(120, iw/data.length - 40);
  const X = i => PADl + (i+0.5)*(iw/data.length) - bw/2;
  const Y = val => PADt + ih - (val/yMax)*ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mesačný príjem domácnosti pri dlhodobej práceneschopnosti">`;
  for (let i=0;i<=4;i++){ const val=yMax*i/4,y=Y(val);
    s+=`<line x1="${PADl}" x2="${W-PADr}" y1="${y}" y2="${y}" stroke="var(--grid)"/>
        <text x="${PADl-10}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--muted)">${kFmt(val)}</text>`; }
  data.forEach((d,i)=>{
    const hz=ih*(d.z/yMax), hd=ih*(d.d/yMax);
    s+=`<rect x="${X(i)}" y="${Y(d.z)}" width="${bw}" height="${hz}" rx="${hd>0?0:4}" fill="var(--s1)"/>`;
    if (hd>0) s+=`<path d="M${X(i)} ${Y(d.z+d.d)+4} a4 4 0 0 1 4-4 h${bw-8} a4 4 0 0 1 4 4 v${hd-4} h${-bw} Z" fill="var(--s3)"/>`;
    s+=`<text x="${X(i)+bw/2}" y="${Y(d.z+d.d)-8}" text-anchor="middle" font-size="13" font-weight="640" fill="var(--ink)">${eur(d.z+d.d)}</text>`;
    s+=`<text x="${X(i)+bw/2}" y="${H-PADb+18}" text-anchor="middle" font-size="12" fill="var(--ink-2)">${d.n}</text>`;
    s+=`<rect class="pnb" data-i="${i}" x="${X(i)-6}" y="${PADt}" width="${bw+12}" height="${ih}" fill="transparent"/>`;
  });
  if (splatka>0){
    const lbl = `splátka hypotéky ${eur(splatka)}`, lw = lbl.length*6.4 + 12;
    s+=`<line x1="${PADl}" x2="${W-PADr}" y1="${Y(splatka)}" y2="${Y(splatka)}" stroke="var(--s2)" stroke-width="1.6" stroke-dasharray="6 4"/>
        <rect x="${W-PADr-lw}" y="${Y(splatka)-19}" width="${lw}" height="17" rx="4" fill="var(--card)" opacity="0.94"/>
        <text x="${W-PADr-6}" y="${Y(splatka)-7}" text-anchor="end" font-size="11.5" fill="var(--s2)" font-weight="600">${lbl}</text>`;
  }
  s+=`<line x1="${PADl}" x2="${W-PADr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--axis)" stroke-width="1.5"/></svg>`;
  host.insertAdjacentHTML("afterbegin", s);
  host.querySelectorAll(".pnb").forEach(el=>{
    el.addEventListener("mousemove", e=>{
      const d=data[+el.dataset.i];
      tipEl.innerHTML = `<div style="margin-bottom:4px;color:#aaa">${d.n}</div>
        <div class="r"><span><i style="background:var(--s1)"></i>Príjem</span><b>${eur(d.z)}</b></div>
        ${d.d>0?`<div class="r"><span><i style="background:var(--s3)"></i>Poistné plnenie</span><b>${eur(d.d)}</b></div>`:""}
        <div style="margin-top:4px;color:#aaa">${d.p}</div>`;
      tipEl.style.opacity="1";
      const hb=host.getBoundingClientRect();
      let left=e.clientX-hb.left+14;
      if (left+tipEl.offsetWidth>hb.width) left=e.clientX-hb.left-tipEl.offsetWidth-14;
      tipEl.style.left=left+"px";
      tipEl.style.top=clamp(e.clientY-hb.top-10,0,hb.height-tipEl.offsetHeight)+"px";
    });
    el.addEventListener("mouseleave",()=>tipEl.style.opacity="0");
  });
}

/* ============================================================
   GRAFY
   ============================================================ */
const PAD = {t:14, r:16, b:30, l:62};
function osX(w){ return w - PAD.l - PAD.r; }

function niceMax(v){
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v/e;
  const kroky = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return (kroky.find(k => f <= k) || 10) * e;
}
function kFmt(v){
  if (v >= 10000) return Math.round(v/1000) + " tis.";
  return Math.round(v).toLocaleString("sk-SK");
}

/* čiarový/plošný graf zostatku istiny — 1 alebo 2 série */
function lineChart(host, tipEl, series, maxRokov){
  const W = 900, H = 300, iw = osX(W), ih = H - PAD.t - PAD.b;
  const yMax = niceMax(Math.max(...series.map(s => s.data[0]?.v || 0)));
  const xMax = Math.max(maxRokov, 1);
  const X = r => PAD.l + (r/xMax)*iw;
  const Y = v => PAD.t + ih - (v/yMax)*ih;

  const ticksY = 5, gy = [];
  for (let i=0;i<=ticksY;i++){ const v = yMax*i/ticksY; gy.push({v, y:Y(v)}); }
  const stepX = xMax<=10?2:xMax<=20?5:5, gx = [];
  for (let r=0;r<=xMax;r+=stepX) gx.push({r, x:X(r)});
  if (gx[gx.length-1].r !== xMax) gx.push({r:xMax, x:X(xMax)});

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Vývoj zostatku istiny">`;
  gy.forEach(g => s += `<line x1="${PAD.l}" x2="${W-PAD.r}" y1="${g.y}" y2="${g.y}" stroke="var(--grid)" stroke-width="1"/>
     <text x="${PAD.l-10}" y="${g.y+4}" text-anchor="end" font-size="11" fill="var(--muted)">${kFmt(g.v)}</text>`);
  gx.forEach(g => s += `<text x="${g.x}" y="${H-PAD.b+18}" text-anchor="middle" font-size="11" fill="var(--muted)">${g.r}</text>`);
  s += `<line x1="${PAD.l}" x2="${W-PAD.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--axis)" stroke-width="1.5"/>`;

  series.forEach((se, si) => {
    const pts = se.data.map(d => [X(d.r), Y(d.v)]);
    const line = pts.map((p,i) => (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
    if (se.fill){
      s += `<path d="${line} L ${pts[pts.length-1][0].toFixed(1)} ${Y(0)} L ${PAD.l} ${Y(0)} Z" fill="${se.color}" opacity="${se.fillOpacity||0.10}"/>`;
    }
    s += `<path d="${line}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${se.dash?'stroke-dasharray="5 4"':''}/>`;
  });
  s += `<line id="ch-hair" x1="0" x2="0" y1="${PAD.t}" y2="${Y(0)}" stroke="var(--axis)" stroke-width="1" opacity="0"/>`;
  series.forEach((se,si) => s += `<circle id="ch-d${si}" r="4.5" fill="${se.color}" stroke="#fff" stroke-width="2" opacity="0"/>`);
  s += `<rect id="ch-hit" x="${PAD.l}" y="${PAD.t}" width="${iw}" height="${ih}" fill="transparent" style="cursor:crosshair"/>`;
  s += `</svg>`;
  host.insertAdjacentHTML("afterbegin", s);

  const svg = host.querySelector("svg");
  const hair = svg.querySelector("#ch-hair");
  const dots = series.map((_,i)=>svg.querySelector("#ch-d"+i));
  svg.querySelector("#ch-hit").addEventListener("mousemove", e => {
    const box = svg.getBoundingClientRect();
    const px = (e.clientX - box.left) / box.width * W;
    const rok = clamp((px - PAD.l)/iw * xMax, 0, xMax);
    hair.setAttribute("x1", X(rok)); hair.setAttribute("x2", X(rok)); hair.setAttribute("opacity","1");
    let rows = "";
    series.forEach((se, si) => {
      const d = se.data.reduce((a,b) => Math.abs(b.r-rok) < Math.abs(a.r-rok) ? b : a);
      dots[si].setAttribute("cx", X(d.r)); dots[si].setAttribute("cy", Y(d.v));
      dots[si].setAttribute("opacity", d.v > 0 || d.r === 0 ? "1" : "0.25");
      rows += `<div class="r"><span><i style="background:${se.color}"></i>${se.name}</span><b>${eur(d.v)}</b></div>`;
    });
    tipEl.innerHTML = `<div style="margin-bottom:4px;color:#aaa">po ${Math.round(rok)} rokoch</div>${rows}`;
    tipEl.style.opacity = "1";
    const hb = host.getBoundingClientRect();
    let left = e.clientX - hb.left + 14;
    if (left + tipEl.offsetWidth > hb.width) left = e.clientX - hb.left - tipEl.offsetWidth - 14;
    tipEl.style.left = left + "px";
    tipEl.style.top  = clamp(e.clientY - hb.top - 10, 0, hb.height - tipEl.offsetHeight) + "px";
  });
  svg.querySelector("#ch-hit").addEventListener("mouseleave", () => {
    tipEl.style.opacity = "0"; hair.setAttribute("opacity","0"); dots.forEach(d=>d.setAttribute("opacity","0"));
  });
}

/* stĺpcový graf úrok vs istina po rokoch */
function stackChart(host, tipEl, rocne){
  const W = 900, H = 260, iw = osX(W), ih = H - PAD.t - PAD.b;
  const n = rocne.length;
  const yMax = niceMax(Math.max(...rocne.map(r => r.urok + r.istina)));
  const bw = Math.max(3, Math.min(26, iw/n - 3));
  const X = i => PAD.l + (i + 0.5) * (iw/n) - bw/2;
  const Y = v => PAD.t + ih - (v/yMax)*ih;

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rozdelenie ročných platieb na úrok a istinu">`;
  for (let i=0;i<=4;i++){ const v=yMax*i/4, y=Y(v);
    s += `<line x1="${PAD.l}" x2="${W-PAD.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/>
          <text x="${PAD.l-10}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--muted)">${kFmt(v)}</text>`; }
  const step = n<=12?2:5;
  for (let i=0;i<n;i+=step) s += `<text x="${X(i)+bw/2}" y="${H-PAD.b+18}" text-anchor="middle" font-size="11" fill="var(--muted)">${rocne[i].rok}</text>`;
  s += `<line x1="${PAD.l}" x2="${W-PAD.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--axis)" stroke-width="1.5"/>`;

  rocne.forEach((r,i) => {
    const hI = Math.max(0, ih*(r.istina/yMax));
    const hU = Math.max(0, ih*(r.urok/yMax));
    // istina sedí na základnej čiare, úrok nad ňou s 2px medzerou a zaobleným koncom
    s += `<rect x="${X(i)}" y="${Y(0)-hI}" width="${bw}" height="${hI}" fill="var(--s1)"/>`;
    const yU = Y(0)-hI-hU-2, rr = Math.min(4, bw/2, Math.max(0,hU));
    s += `<path d="M${X(i)} ${yU+hU} V${yU+rr} a${rr} ${rr} 0 0 1 ${rr} ${-rr} h${bw-2*rr} a${rr} ${rr} 0 0 1 ${rr} ${rr} V${yU+hU} Z" fill="var(--s2)"/>`;
    s += `<rect class="hb" data-i="${i}" x="${X(i)-1.5}" y="${PAD.t}" width="${bw+3}" height="${ih}" fill="transparent"/>`;
  });
  s += `</svg>`;
  host.insertAdjacentHTML("afterbegin", s);

  host.querySelectorAll(".hb").forEach(el => {
    el.addEventListener("mousemove", e => {
      const r = rocne[+el.dataset.i];
      tipEl.innerHTML = `<div style="margin-bottom:4px;color:#aaa">${r.rok}. rok splácania</div>
        <div class="r"><span><i style="background:var(--s2)"></i>Úrok</span><b>${eur(r.urok)}</b></div>
        <div class="r"><span><i style="background:var(--s1)"></i>Istina</span><b>${eur(r.istina)}</b></div>`;
      tipEl.style.opacity = "1";
      const hb = host.getBoundingClientRect();
      let left = e.clientX - hb.left + 14;
      if (left + tipEl.offsetWidth > hb.width) left = e.clientX - hb.left - tipEl.offsetWidth - 14;
      tipEl.style.left = left + "px";
      tipEl.style.top  = clamp(e.clientY - hb.top - 10, 0, hb.height - tipEl.offsetHeight) + "px";
    });
    el.addEventListener("mouseleave", () => tipEl.style.opacity = "0");
  });
}

/* graf preriedime na rozumný počet bodov */
function bodyRocne(rows, krok){
  const out = [];
  for (let i=0; i<rows.length; i+=krok) out.push({r: rows[i].m/12, v: rows[i].zost});
  const last = rows[rows.length-1];
  if (out[out.length-1].r !== last.m/12) out.push({r:last.m/12, v:last.zost});
  return out;
}

/* ============================================================
   VÝPOČET + RENDER
   ============================================================ */
let earlyOn = false, zivotOn = false, splatkaGlob = 0;

function citajVstupy(){
  const dvaja = $("iStav").value === "2";
  const v = {
    dvaja,
    deti:  clamp(+$("iDeti").value||0, 0, 10),
    vek1:  clamp(+$("iVek1").value||30, 18, 70),
    vek2:  clamp(+$("iVek2").value||30, 18, 70),
    pr1:   Math.max(0, +$("iPr1").value||0),
    pr2:   dvaja ? Math.max(0, +$("iPr2").value||0) : 0,
    spl:   Math.max(0, +$("iSpl").value||0),
    zost:  Math.max(0, +$("iZost").value||0),
    hodn:  Math.max(0, +$("iHodn").value||0),
    vlast: Math.max(0, +$("iVlast").value||0),
    ltv:   +$("iLtv").value,
    suma:  Math.max(0, +$("iSuma").value||0),
    sadz:  clamp(+$("iSadz").value||3.6, 0.1, 12),
    roky:  clamp(+$("iRoky").value||30, 1, 40),
    extra: Math.max(0, +$("iExtra").value||0),
    jedn:  Math.max(0, +$("iJedn").value||0),
    kedy:  clamp(+$("iKedy").value||1, 1, 40)
  };
  v.prijem = v.pr1 + v.pr2;
  // vážený vek podľa výšky príjmu — tak, ako to robia banky pri DTI
  v.vekVaz = v.dvaja && v.prijem > 0 ? (v.vek1*v.pr1 + v.vek2*v.pr2)/v.prijem : v.vek1;
  return v;
}

function limity(v, roky){
  const zm = CONFIG.zivotneMinimum.dospely1
           + (v.dvaja ? CONFIG.zivotneMinimum.dospely2 : 0)
           + v.deti * CONFIG.zivotneMinimum.dieta;
  const disponibilny = v.prijem - zm;
  const maxSplatka = Math.max(0, disponibilny * CONFIG.dsti.koeficient - v.spl);
  const stres = v.sadz + CONFIG.stresTest.navysenieSadzbyPB;
  const dsti = istinaZoSplatky(maxSplatka, stres, roky*12);

  const nad = Math.max(0, v.vekVaz - CONFIG.dti.vekZlom);
  const nasobok = Math.max(CONFIG.dti.minimum, CONFIG.dti.zaklad - nad * CONFIG.dti.poklesZaRok);
  const dti = Math.max(0, nasobok * v.prijem * 12 - v.zost);

  const ltv = v.hodn * v.ltv;

  const kandidati = [
    {k:"DSTI", v:dsti}, {k:"DTI", v:dti}, {k:"LTV", v:ltv}
  ];
  const min = kandidati.reduce((a,b)=> b.v < a.v ? b : a);
  return {zm, disponibilny, maxSplatka, stres, dsti, dti, ltv, nasobok, max:min.v, bind:min.k};
}

function renderAll(){
  const v = citajVstupy();
  $("wVek2").style.display = v.dvaja ? "" : "none";
  $("wPr2").style.display  = v.dvaja ? "" : "none";

  /* --- 2. rámec --- */
  const L = limity(v, v.roky);
  $("oMax").textContent = eur(Math.floor(L.max/1000)*1000);
  $("oBind").textContent = {DSTI:"rozpočet (DSTI)", DTI:"násobok príjmu (DTI)", LTV:"hodnota nehnuteľnosti (LTV)"}[L.bind];
  $("oDsti").textContent = eur(Math.floor(L.dsti/1000)*1000);
  $("nDsti").textContent = `max. splátka ${eur(L.maxSplatka)} pri testovacej sadzbe ${num(L.stres)} % (${num(v.sadz)} % + 2 p. b.) na ${v.roky} r.`;
  $("oDti").textContent  = eur(Math.floor(L.dti/1000)*1000);
  $("nDti").textContent  = `${num(L.nasobok)}× ročný čistý príjem ${eur(v.prijem*12)}${v.zost>0? " mínus existujúce záväzky "+eur(v.zost):""} · vek ${num(v.vekVaz)} r.`;
  $("oLtv").textContent  = eur(Math.floor(L.ltv/1000)*1000);
  $("nLtv").textContent  = `${Math.round(v.ltv*100)} % z hodnoty ${eur(v.hodn)} · vlastné zdroje ${eur(v.vlast)}`;
  $("oSpl").textContent  = eur(L.maxSplatka);
  $("nSpl").textContent  = `príjem ${eur(v.prijem)} − životné minimum ${eur(L.zm,2)} = ${eur(L.disponibilny)}, z toho 60 %${v.spl>0? " mínus splátky "+eur(v.spl):""}`;
  ["tDsti","tDti","tLtv"].forEach(id => $(id).classList.remove("lim"));
  $({DSTI:"tDsti",DTI:"tDti",LTV:"tLtv"}[L.bind]).classList.add("lim");

  const potreba = Math.max(0, v.hodn - v.vlast);
  const flags = [];
  if (v.prijem <= L.zm)
    flags.push(["bad","Príjem domácnosti nepokrýva ani životné minimum — banka v tejto podobe úver neschváli."]);
  if (potreba > L.max && L.max > 0)
    flags.push(["warn",`Na kúpu potrebujete <b>${eur(potreba)}</b>, rámec je <b>${eur(L.max)}</b>. Chýba <b>${eur(potreba-L.max)}</b> — riešením je vyššia akontácia, dlhšia splatnosť, spoludlžník alebo lacnejšia nehnuteľnosť.`]);
  else if (L.max > 0 && potreba > 0)
    flags.push(["ok",`Rámec pokrýva potrebu <b>${eur(potreba)}</b> s rezervou <b>${eur(L.max-potreba)}</b>.`]);
  const maxRokovVek = Math.max(1, Math.round(CONFIG.splatnost.vekStrop - v.vekVaz));
  if (v.roky > Math.min(CONFIG.splatnost.maxRokov, maxRokovVek))
    flags.push(["warn",`Splatnosť ${v.roky} rokov je nad hranicou — banka dá spravidla najviac ${Math.min(CONFIG.splatnost.maxRokov, maxRokovVek)} rokov (limit 30 rokov a vek do ${CONFIG.splatnost.vekStrop} rokov pri poslednej splátke).`]);
  if (v.vlast < v.hodn*0.1 && v.hodn > 0)
    flags.push(["warn",`Vlastné zdroje sú ${Math.round(v.vlast/v.hodn*100)} % z ceny. Okrem akontácie počítajte aj s poplatkami — znalecký posudok, kataster, prípadne provízia realitke.`]);
  $("oFlags").innerHTML = flags.map(f => `<div class="flag ${f[0]}"><span>${f[1]}</span></div>`).join("");

  $("oRozklad").innerHTML = `Životné minimum domácnosti: ${eur(CONFIG.zivotneMinimum.dospely1,2)}
    ${v.dvaja? "+ "+eur(CONFIG.zivotneMinimum.dospely2,2)+" (druhý dospelý) ":""}
    ${v.deti>0? "+ "+v.deti+" × "+eur(CONFIG.zivotneMinimum.dieta,2)+" (deti) ":""}
    = <b>${eur(L.zm,2)}</b> · sumy platné od ${CONFIG.zivotneMinimum.platneOd}. Trhové sadzby 08/2026: ${num(CONFIG.sadzbaTrh.min)}–${num(CONFIG.sadzbaTrh.max)} % p. a.`;

  /* --- 3. hypotéka --- */
  $("hNeed").textContent = potreba>0 ? `— na kúpu treba ${eur(potreba)}` : "";
  const splatka = anuita(v.suma, v.sadz, v.roky*12);
  splatkaGlob = splatka;
  const zaklad = amortizacia(v.suma, v.sadz, v.roky*12, splatka);
  $("oSplatka").textContent = eur(splatka);
  $("oUroky").textContent   = eur(zaklad.urokCelkom);
  $("oCelkom").textContent  = eur(v.suma + zaklad.urokCelkom);

  const hf = [];
  if (splatka > L.maxSplatka)
    hf.push(["bad",`Splátka <b>${eur(splatka)}</b> presahuje maximum <b>${eur(L.maxSplatka)}</b>, ktoré banka podľa vášho rozpočtu pripustí.`]);
  if (v.suma > L.max && L.max>0)
    hf.push(["warn",`Zadaná suma je nad úverovým rámcom o <b>${eur(v.suma-L.max)}</b>.`]);
  if (zaklad.urokCelkom > v.suma*0.5)
    hf.push(["warn",`Na úrokoch zaplatíte <b>${Math.round(zaklad.urokCelkom/v.suma*100)} %</b> požičanej sumy. Skrátenie splatnosti alebo mimoriadne splátky to výrazne znížia.`]);
  $("hFlags").innerHTML = hf.map(f => `<div class="flag ${f[0]}"><span>${f[1]}</span></div>`).join("");

  /* graf 1 */
  const c1 = $("chart1"); c1.querySelectorAll("svg").forEach(e=>e.remove());
  const krok = v.roky > 15 ? 6 : 3;
  const serie = [{name:"Zostatok istiny", color:"var(--s1)", fill:true, data:bodyRocne(zaklad.rows, krok)}];
  let porovnanie = null;
  if (earlyOn && (v.extra>0 || v.jedn>0)){
    porovnanie = amortizacia(v.suma, v.sadz, v.roky*12, splatka, v.extra, v.jedn, Math.round(v.kedy*12));
    serie.push({name:"S predčasným splácaním", color:"var(--s3)", fill:false, data:bodyRocne(porovnanie.rows, krok)});
    $("cap1").textContent = "Zostatok istiny v € podľa rokov — pôvodný plán a plán s mimoriadnymi splátkami";
    $("leg1").innerHTML = `<span><i style="background:var(--s1)"></i>Pôvodný plán</span><span><i style="background:var(--s3)"></i>S predčasným splácaním</span>`;
  } else {
    $("cap1").textContent = "Zostatok istiny počas splácania (€ podľa rokov)";
    $("leg1").innerHTML = `<span><i style="background:var(--s1)"></i>Zostatok istiny</span>`;
  }
  lineChart(c1, $("tip1"), serie, v.roky);

  /* graf 2 */
  const c2 = $("chart2"); c2.querySelectorAll("svg").forEach(e=>e.remove());
  stackChart(c2, $("tip2"), zaklad.rocne);

  /* --- 4. predčasné splatenie --- */
  if (earlyOn){
    const e = porovnanie || amortizacia(v.suma, v.sadz, v.roky*12, splatka, v.extra, v.jedn, Math.round(v.kedy*12));
    const uspora = zaklad.urokCelkom - e.urokCelkom;
    const skorMes = zaklad.mesiacov - e.mesiacov;
    $("oUspora").textContent = eur(Math.max(0,uspora));
    $("oSkor").textContent   = skorMes>0 ? `${Math.floor(skorMes/12)} r. ${skorMes%12} mes.` : "—";
    $("oKoniec").textContent = `za ${Math.floor(e.mesiacov/12)} r. ${e.mesiacov%12} mes.`;

    const c3 = $("chart3"); c3.querySelectorAll("svg").forEach(el=>el.remove());
    lineChart(c3, $("tip3"), [
      {name:"Pôvodný plán", color:"var(--s2)", fill:false, dash:true, data:bodyRocne(zaklad.rows, krok)},
      {name:"S predčasným splácaním", color:"var(--s1)", fill:true, data:bodyRocne(e.rows, krok)}
    ], v.roky);

    const rocneNavyse = v.extra*12 + (v.jedn>0 ? v.jedn : 0);
    const limitBez = v.suma * CONFIG.mimoriadne.bezPoplatkuRocne;
    $("poplatok").innerHTML = `<span><b>Poplatky:</b> zo zostatku istiny môžete ročne mimoriadne splatiť až
      ${Math.round(CONFIG.mimoriadne.bezPoplatkuRocne*100)} % bez poplatku, a pri výročí fixácie ľubovoľnú sumu.
      Nad tento rámec si banka môže účtovať najviac ${Math.round(CONFIG.mimoriadne.poplatokMax*100)} % zo splácanej sumy.
      ${rocneNavyse > limitBez ? `Vo vašom nastavení ide o ${eur(rocneNavyse)} ročne, čo je nad hranicou ${eur(limitBez)} — časť môže byť spoplatnená.` :
      `Vaše nastavenie (${eur(rocneNavyse)} ročne) sa do bezplatného limitu zmestí.`}
      Konkrétne podmienky sa medzi bankami líšia — overíme ich pri vašej zmluve.</span>`;
  }

  /* --- 5. životné poistenie --- */
  let vybZivot = null;
  if (zivotOn){
    $("iSkup1").innerHTML = $("iSkup2").innerHTML = CONFIG.zivot.skupiny
      .map(x => `<option value="${x.k}">${x.k}. skupina — ${x.popis}</option>`).join("");
    $("iSkup1").value = skupHodnota[1]; $("iSkup2").value = skupHodnota[2];
    document.querySelectorAll(".w2").forEach(el => el.classList.toggle("skryt", !v.dvaja));
    vybZivot = renderZivot(v);
    $("cenaPozn").innerHTML = `<span><b>Cena je odhad, nie ponuka poisťovne.</b> Vychádza z metodiky poistných súm,
      ktorú používame, a je nastavená tak, aby modelová rodina z nášho prezentéra vyšla na 130–150 € mesačne.
      Skutočnú cenu určuje konkrétna poisťovňa podľa veku, zdravotného stavu, povolania a svojho sadzobníka —
      spočítam vám ju presne, keď si vyberieme poisťovňu.</span>`;
  }

  /* --- 6/7 --- */
  if (earlyOn) zaujem.early = true;
  if (zivotOn) zaujem.zivot = true;
  renderMapa(v); renderModules(); renderAreas(); renderSum(v, L, splatka, zaklad, porovnanie, vybZivot);
}

function renderSum(v, L, splatka, zaklad, porov, z){
  const potreba = Math.max(0, v.hodn - v.vlast);
  const kroky = OBLASTI.filter(o=>!o.live && zaujem[o.id]).map(o=>o.nazov);
  let html = `
    <p><b>Situácia:</b> ${v.dvaja?"dvaja žiadatelia":"jeden žiadateľ"}, ${v.deti} ${v.deti===1?"dieťa":v.deti>=2&&v.deti<=4?"deti":"detí"},
       čistý príjem domácnosti ${eur(v.prijem)} mesačne.</p>
    <p><b>Úverový rámec:</b> približne <b>${eur(Math.floor(L.max/1000)*1000)}</b>; rozhodujúci je limit ${L.bind}.
       Nehnuteľnosť ${eur(v.hodn)}, vlastné zdroje ${eur(v.vlast)}, potreba financovania ${eur(potreba)}.</p>
    <p><b>Modelovaná hypotéka:</b> ${eur(v.suma)} na ${v.roky} rokov pri ${num(v.sadz)} % p. a. →
       splátka <b>${eur(splatka)}</b>, úroky spolu ${eur(zaklad.urokCelkom)}, zaplatíte ${eur(v.suma+zaklad.urokCelkom)}.</p>`;
  if (earlyOn && porov){
    const skor = zaklad.mesiacov - porov.mesiacov;
    html += `<p><b>Predčasné splatenie:</b> ${v.extra>0?eur(v.extra)+" mesačne navyše":""}${v.extra>0&&v.jedn>0?", ":""}${v.jedn>0?"jednorazovo "+eur(v.jedn)+" v "+v.kedy+". roku":""} →
      úspora na úrokoch <b>${eur(zaklad.urokCelkom-porov.urokCelkom)}</b>, splatené skôr o ${Math.floor(skor/12)} r. ${skor%12} mes.</p>`;
  }
  if (z){
    const d = z.bal.deti;
    html += `<p><b>Zabezpečenie rodiny — balíček ${z.bal.nazov}:</b> odhad
      <b>${Math.round(z.dolna/5)*5} – ${Math.round(z.horna/5)*5} €</b> mesačne za celú rodinu.
      Smrť a invalidita ${eur(z.ps1.smrt)}${z.o2 ? " / "+eur(z.ps2.smrt) : ""},
      trvalé následky úrazu ${eur(z.ps1.tnu)}${z.o2 ? " / "+eur(z.ps2.tnu) : ""},
      kritické choroby ${eur(z.ps1.kch)}${z.o2 ? " / "+eur(z.ps2.kch) : ""}${
      z.ps1.pnDenne ? ", PN od "+z.bal.pnOd+". dňa "+eur(z.ps1.pnDenne)+" denne"+(z.o2?" / "+eur(z.ps2.pnDenne)+" denne":"") : ""}${
      d && v.deti>0 ? `. Deti: úraz ${eur(d.tnu)}, kritické choroby ${eur(d.kch)}, ${eur(d.denne)} denne` : ""}.</p>`;
  }
  html += kroky.length
    ? `<p><b>Ďalšie kroky — klient prejavil záujem o:</b></p><ul>${kroky.map(k=>`<li>${k}</li>`).join("")}</ul>`
    : `<p style="color:var(--muted)">Zatiaľ nie sú vybrané žiadne ďalšie oblasti. Označte ich v sekcii 6.</p>`;
  const k = poradca.kontakt || {};
  const kont = [k.tel, k.email, k.web].filter(Boolean).join(" · ");
  html += `<div class="sumfoot">${markHTML(poradca,"mk")}
    <span><b>${poradca.meno}</b>, ${poradca.rola}${kont ? " · " + kont : ""}</span></div>`;
  $("sumBox").innerHTML = html;
}

const skupHodnota = {1:1, 2:1};

function odomkniZivot(){
  zivotOn = true;
  $("sec-zivot").classList.remove("hidden");
  $("sec-askz").classList.add("hidden");
  renderAll();
  setTimeout(()=>$("sec-zivot").scrollIntoView({behavior:"smooth",block:"start"}), 60);
}

function odomkniEarly(){
  earlyOn = true;
  $("sec-early").classList.remove("hidden");
  $("askEarly").classList.add("hidden");
  renderAll();
  setTimeout(()=>$("sec-early").scrollIntoView({behavior:"smooth",block:"start"}), 60);
}

/* ============================================================
   PREPÍNAČ PORADCU
   ============================================================ */
function markHTML(p, cls){
  return p.logo
    ? `<span class="${cls} img"><img src="${p.logo}" alt="${p.meno}"></span>`
    : `<span class="${cls}" style="background:${p.farby.logoBg};color:${p.farby.logoInk}">${p.monogram}</span>`;
}
function renderPoradca(){
  document.documentElement.style.setProperty("--logo-bg", poradca.farby.logoBg);
  document.documentElement.style.setProperty("--logo-ink", poradca.farby.logoInk);
  if (poradca.farby.akcent) document.documentElement.style.setProperty("--s1", poradca.farby.akcent);

  $("logoBox").innerHTML = markHTML(poradca, "mark") +
    `<span class="nm"><b>${poradca.meno}</b><small>${poradca.rola}</small></span>`;

  $("whoBtn").innerHTML = `<span>${PORADCOVIA.length > 1 ? "zmeniť poradcu" : "poradca"}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;

  $("whoMenu").innerHTML = `<div class="hd">Prihlásený poradca</div>` +
    PORADCOVIA.map(p => `<button type="button" role="menuitem" data-id="${p.id}" class="${p.id===poradca.id?'sel':''}">
        ${markHTML(p,"mk")}<span>${p.meno}</span></button>`).join("") +
    (PORADCOVIA.length === 1
      ? `<div class="empty">Ďalších poradcov pridáte v súbore v zozname <b>PORADCOVIA</b> na začiatku skriptu.</div>` : "");

  $("whoMenu").querySelectorAll("button").forEach(b => b.onclick = () => {
    poradca = PORADCOVIA.find(x => x.id === b.dataset.id) || PORADCOVIA[0];
    try { localStorage.setItem("poradcaId", poradca.id); } catch(e){}
    zavriMenu(); renderPoradca(); renderAll();
  });
}
function zavriMenu(){ $("whoMenu").classList.add("hidden"); $("whoBtn").setAttribute("aria-expanded","false"); }
function prepniMenu(){
  const m = $("whoMenu"), open = m.classList.contains("hidden");
  m.classList.toggle("hidden", !open);
  $("whoBtn").setAttribute("aria-expanded", String(open));
}

/* prepojenie posuvníkov a políčok */
function pair(inp, rng){
  const a=$(inp), b=$(rng);
  a.addEventListener("input",()=>{ b.value=a.value; renderAll(); });
  b.addEventListener("input",()=>{ a.value=b.value; renderAll(); });
}

document.addEventListener("DOMContentLoaded", () => {
  ["iStav","iDeti","iVek1","iVek2","iPr1","iPr2","iSpl","iZost","iHodn","iVlast","iLtv","iKedy"]
    .forEach(id => $(id).addEventListener("input", renderAll));
  pair("iSuma","rSuma"); pair("iSadz","rSadz"); pair("iRoky","rRoky");
  pair("iExtra","rExtra"); pair("iJedn","rJedn");
  $("whoBtn").onclick = e => { e.stopPropagation(); prepniMenu(); };
  document.addEventListener("click", e => { if (!$("who").contains(e.target)) zavriMenu(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") zavriMenu(); });
  try { const ulozeny = PORADCOVIA.find(p => p.id === localStorage.getItem("poradcaId")); if (ulozeny) poradca = ulozeny; } catch(e){}
  renderPoradca();
  ["iPohl1","iPohl2","iFajc1","iFajc2"].forEach(id => $(id).addEventListener("change", renderAll));
  $("iSkup1").addEventListener("change", e => { skupHodnota[1] = +e.target.value; renderAll(); });
  $("iSkup2").addEventListener("change", e => { skupHodnota[2] = +e.target.value; renderAll(); });
  $("btnZivotYes").onclick = odomkniZivot;
  $("btnZivotNo").onclick  = () => $("sec-askz").classList.add("hidden");
  $("btnEarlyYes").onclick = odomkniEarly;
  $("btnEarlyNo").onclick  = () => $("askEarly").classList.add("hidden");
  renderAll();
});