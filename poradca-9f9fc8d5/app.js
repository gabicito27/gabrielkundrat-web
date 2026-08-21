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

  /* ---------- DÔCHODOK ----------
     I. pilier: dôchodok = POMB × ODP × ADH (Sociálna poisťovňa)
       POMB … priemerný osobný mzdový bod = podiel vašej hrubej mzdy k priemernej mzde v hospodárstve
       ODP  … počet rokov dôchodkového poistenia
       ADH  … aktuálna dôchodková hodnota, pre rok 2026 je 19,7633 €
     Krátenie za II. pilier: od roku 2022 sa odpočíta 22/91 pomernej sumy za roky sporenia (§ 66 ods. 6). */
  dochodok: {
    adh: 19.7633,              // aktuálna dôchodková hodnota 2026
    priemernaMzda: 1777,       // priemerná mzda v hospodárstve SR, odhad 2026
    vekOdchodu: 65,
    kratenieII: 22/91,         // podiel, o ktorý sa kráti I. pilier za roky v II. pilieri
    sadzbaII: 0.04,            // príspevok do II. piliera z hrubej mzdy (2026)
    vynosII: 6,                // predpokladané zhodnotenie II. piliera, % p. a. (nominálne)
    vynosIII: 5,               // predpokladané zhodnotenie III. piliera, % p. a. (nominálne)
    inflacia: 2.5,             // dlhodobý cieľ ECB — počítame v dnešných eurách, preto ju odpočítavame
    vyplataRokov: 20,          // na koľko rokov sa kapitál rozpočíta na rentu
    vyplataVynos: 3,           // zhodnotenie počas výplaty, % p. a. (nominálne)
    referencnaSuma: 702.30     // referenčná suma 2026 (Sociálna poisťovňa)
  },

  /* ---------- INVESTÍCIE (kýbliková metóda) ----------
     Zdroj: prezentér RHR str. 7 a materiál Profi Sporenie ETF. */
  vedierka: {
    rezervaNasobok: { min: 3, max: 6 },     // krátkodobá rezerva = násobok mesačných výdavkov
    podielPrijmu:   { min: 0.05, max: 0.10 },// odporúčaný príspevok do stredno- aj dlhodobej rezervy
    vynos: { kratke: {min:0, max:3}, stredne: {min:3, max:6}, dlhe: {min:6, max:10} },
    // rozdelenie voľných peňazí, kým nie je krátkodobá rezerva naplnená / keď už naplnená je
    rozdelenieNeplna: { kratke: 0.60, stredne: 0.15, dlhe: 0.25 },
    rozdeleniePlna:   { kratke: 0.00, stredne: 0.35, dlhe: 0.65 },
    vynosProjekcia: 8                        // % p. a. pre dlhodobé vedierko
  },

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
    // priemerné invalidné dôchodky (brožúrka ŽP FVP) — absolútne sumy, nie percentá z príjmu
    invalidnyDochodok: { do70: 300, nad70: 550, plnaPriemer: 523, ciastocnaPriemer: 289 },
    // maximálna denná dávka PN, ktorú poisťovňa pripustí podľa čistého príjmu (brožúrka ŽP FVP)
    limitPN: [[835,10],[947,11],[1058,12],[1170,13],[1393,14],[1429,15],[1548,20],[1849,30],[2149,40],[2449,50]],
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
    popis:"Horná hranica odporúčaných pásiem, rezerva pre deti navyše, PN už od 15. dňa a v maximálnej dennej dávke.",
    tnu:5, kch:3, pn:true, pnOd:15, pnMax:true, rezervaDeti:true, prijemNasobok:2,
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
  },
  {
    id: "hv",
    meno: "Hypotéka Východ",
    rola: "finančné sprostredkovanie",
    monogram: "HV",
    logo: "data:image/png;base64,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",
    logoPomer: 3.23,          /* široký lockup — šírka/výška obrázka */
    kontakt: { web: "hypoteka-vychod.sk", email: "serus@hypotekavychod.sk", tel: "" },
    farby: {
      logoBg: "#F1F6F2", logoInk: "#0E5E35",
      /* Farby zo značky: zelená zo strechy #0E5E35 je hlavná, modrá z nápisu #0C4C77
         (na papieri zosvetlená na #2F5AAE, ako ju používa aj web) je druhá.
         Terakota (--s2) zámerne zostáva — v appke znamená „čo vás to stojí"
         (zaplatené úroky, pôvodný splátkový plán). Zelená tam nepatrí. */
      schema: {
        "--s1":"#0E5E35", "--s5":"#0A4527",
        "--s3":"#2F5AAE", "--s6":"#24478A",
        "--good":"#0E5E35", "--good-ink":"#0B4A2A", "--ok-bg":"#E8F1EA",
        "--prim":"#2F5AAE", "--prim-tm":"#264990",
        "--page":"#F3F6F2", "--card":"#FFFFFF", "--surface-1":"#E7EFE8",
        "--grid":"#DEE7E0", "--axis":"#C8D5CB", "--border":"#DEE7E0",
        "--ink":"#17251C", "--ink-2":"#4F5F54", "--muted":"#85938A", "--muted-2":"#A5B1A9",
        "--nav":"#0B3325", "--nav-ink":"#DCE8DF", "--nav-muted":"#7E9686",
        "--nav-line":"#164534", "--nav-hover":"#1B5340", "--nav-box":"#124030", "--nav-border":"#1E5A44"
      }
    }
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
  invest: '<path d="M4 19h16"/><path d="M6.5 19v-5m5 5V8m5 11V4"/>',
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
  {id:"invest",  nazov:"Investície",       vetvy:["rezerva a strednodobé ciele","dlhodobé budovanie majetku"],
   sec:"sec-invest", rozbal:"d-invest", live:true, krok:"Investície — pripraviť konkrétny návrh a porovnanie riešení",
   popis:"Rozdelenie peňazí podľa toho, kedy ich budete potrebovať — kýbliková metóda."},
  {id:"hypo",    nazov:"Hypotéka",         vetvy:["predčasné splatenie","poistenie nehnuteľnosti"],
   sec:"sec-hypo",   live:true, krok:"Hypotéka — porovnať ponuky bánk a pripraviť žiadosť",  popis:"Úverový rámec, splátka a splátkový plán."},
  {id:"zivot",   nazov:"Životné poistenie",vetvy:["krytie príjmu","krytie hypotéky"],
   sec:"sec-zivot", rozbal:"d-zivot", live:true, krok:"Životné poistenie — pripraviť ponuku na vybraný balíček", popis:"Krytie príjmu a hypotéky pri chorobe, úraze alebo úmrtí. Tri úrovne — mini, optimal, maxi."},
  {id:"doch",    nazov:"Dôchodok",         vetvy:["I., II. a III. pilier","doživotná renta"],
   sec:"sec-doch",  live:true, krok:"Dôchodok — pripraviť návrh III. piliera a vlastnej renty", popis:"Kde reálne skončíte pri dnešnom nastavení a čo sa s tým dá urobiť teraz."},
  {id:"auto",    nazov:"Auto",             vetvy:["PZP a havarijné","GAP"],
   sec:"sec-auto",  live:true, krok:"Auto — porovnať PZP a havarijné, skontrolovať termín výpovede", popis:"PZP, havarijné poistenie a GAP — porovnanie a načasovanie výpovede."},
  {id:"dom",     nazov:"Nehnuteľnosť",    vetvy:["poistenie stavby a domácnosti","podpoistenie"],
   sec:"sec-dom",   live:true, krok:"Nehnuteľnosť — prepočítať poistnú sumu stavby a domácnosti",
   popis:"Poistenie stavby a domácnosti, zodpovednosť za škodu. Banka ho pri hypotéke vyžaduje."}
];
const zaujem = {invest:false, hypo:false, zivot:false, doch:false, auto:false, dom:false, early:false};

/* Priebežný pruh — kľúčové čísla zostanú na očiach aj po zrolovaní.
   Zobrazí sa až vtedy, keď zmizne úvodná sekcia s rámcom. */
function renderPruh(polozky){
  const p = polozky.filter(Boolean);
  $("pruhWrap").classList.toggle("prazdny", p.length === 0);
  $("pruh").innerHTML = p
    .map(x => `<span class="pi"><span class="pk">${x.k}</span><span class="pv ${x.f||''}">${x.v}</span></span>`)
    .join('<span class="sep"></span>');
}
/* Dve nezávislé akcie:
   — zaškrtávacie políčko označuje, že klient chce oblasť riešiť (zapíše sa do zhrnutia)
   — klik na názov prepne obrazovku, výber nemení */
function prepniZaujem(id){
  if (!id) return;
  zaujem[id] = !zaujem[id];
  renderAll();
}
function prejdiNaOblast(id){
  const k = KROKY.find(x => x.oblast === id);
  if (k) prepniObrazovku(k.id);
}

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
      <g class="nzchk" data-id="${o.id}" transform="translate(${bx+bw-19},${by+7})"
         role="checkbox" aria-checked="${on}" aria-label="${o.nazov} — označiť ako oblasť na riešenie">
        <circle cx="6" cy="6" r="11" fill="transparent"/>
        <circle cx="6" cy="6" r="8" class="${on?'nchk':'nchk-off'}"/>
        <path d="M2.6 6.2 5 8.6 9.4 4" fill="none" stroke="${on?'#fff':'var(--axis)'}" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round"/>
      </g>
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
    const klik = () => prejdiNaOblast(el.dataset.id);
    el.addEventListener("click", klik);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); klik(); } });
  });
  $("mapa").querySelectorAll(".nzchk").forEach(el => el.addEventListener("click", e => {
    e.stopPropagation();
    prepniZaujem(el.dataset.id);
  }));
}

/* ============================================================
   OBRAZOVKY — v jednom čase je viditeľná práve jedna.
   Bočný panel slúži ako osnova stretnutia: prepína obrazovky
   a zaškrtávacím políčkom sa označuje, čo klient chce riešiť.
   ============================================================ */
const KROKY = [
  {id:"mapa",   sec:"sec-mapa",   nazov:"Mapa oblastí"},
  {id:"vstup",  sec:"sec-vstup",  nazov:"Situácia"},
  {id:"hypo",   sec:"sec-hypo",   nazov:"Hypotéka",           oblast:"hypo"},
  {id:"invest", sec:"sec-invest", nazov:"Investície",         oblast:"invest"},
  {id:"zivot",  sec:"sec-zivot",  nazov:"Zabezpečenie rodiny",oblast:"zivot"},
  {id:"doch",   sec:"sec-doch",   nazov:"Dôchodok",           oblast:"doch"},
  {id:"dom",    sec:"sec-dom",    nazov:"Nehnuteľnosť",       oblast:"dom"},
  {id:"auto",   sec:"sec-auto",   nazov:"Auto",               oblast:"auto"},
  {id:"sum",    sec:"sec-sum",    nazov:"Zhrnutie"}
];
let obrazovka = "mapa";

/* Affiliate odkazy pre sekciu Auto — doplňte svoje adresy. */
const ODKAZY = {
  pzp:   "https://www.najpoistenie.sk/pzp-povinne-zmluvne-poistenie/?kod=108900379",
  kasko: "https://www.najpoistenie.sk/havarijne-poistenie/?kod=108900379",
  gap:   "https://www.najpoistenie.sk/gap-poistenie-financnej-straty/?kod=108900379",
  dom:   "https://www.najpoistenie.sk/poistenie-domu-bytu-domacnosti/?kod=108900379"
};

function prepniObrazovku(id, bezHistorie){
  if (!KROKY.some(k => k.id === id)) id = "mapa";
  obrazovka = id;
  const k = KROKY.find(x => x.id === id);
  document.querySelectorAll(".obr").forEach(el => el.classList.toggle("on", el.id === k.sec));
  $("obrazovky").scrollTop = 0;
  if (!bezHistorie && location.hash !== "#"+id) history.replaceState(null, "", "#"+id);
  renderAll();
}

function renderKroky(){
  $("kroky").innerHTML = KROKY.map(k => {
    const ozn = k.oblast && zaujem[k.oblast];
    return `<div class="krok ${obrazovka===k.id?'on':''} ${ozn?'ozn':''}" data-id="${k.id}">
      ${k.oblast
        ? `<button class="kchk" type="button" role="checkbox" aria-checked="${!!ozn}"
             data-obl="${k.oblast}" title="${ozn?'Klient túto oblasť rieši — kliknutím zrušíte':'Označiť ako oblasť, ktorú klient chce riešiť'}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
           </button>`
        : `<span class="kbez"></span>`}
      <span class="kn">${k.nazov}</span><span class="rail"></span>
    </div>`;
  }).join("");
  $("kroky").querySelectorAll(".krok").forEach(el => el.onclick = () => prepniObrazovku(el.dataset.id));
  $("kroky").querySelectorAll(".kchk").forEach(el => el.onclick = e => {
    e.stopPropagation(); prepniZaujem(el.dataset.obl);
  });
}

/* ============================================================
   FAKTY K RIZIKÁM — zbalené, rozkliknú sa až na požiadanie.
   Zdroj: brožúrka „Ako správne nastaviť životné poistenie" (FVP)
   a prezentér RHR. Čísla sú štatistiky za Slovensko.
   ============================================================ */
const FAKTY = [
  { id:"f-smrt", nazov:"Ako často sa to naozaj stane",
    zhrn:"Pravdepodobnosti v aktívnom veku do 69 rokov",
    body:[
      {c:"1 z 13", t:"mužov zomrie v aktívnom veku do 69 rokov"},
      {c:"1 z 31", t:"žien zomrie v aktívnom veku do 69 rokov"},
      {c:"1 z 23", t:"mužov sa stane invalidom"},
      {c:"1 z 25", t:"žien sa stane invalidom"},
      {c:"1 z 15", t:"mužov dostane diagnózu rakoviny"},
      {c:"1 z 19", t:"žien dostane diagnózu rakoviny"}
    ],
    pozn:"Invalidita nevzniká najmä z úrazov, ako sa väčšina ľudí domnieva — <b>97 % invalidít spôsobí choroba</b> a len 3 % úraz." },

  { id:"f-inv", nazov:"Čo dostanete od štátu pri invalidite",
    zhrn:"Priemerný invalidný dôchodok a ako sa priznáva",
    body:[
      {c:"≈ 300 €", t:"mesačne pri invalidite nad 40 do 70 %"},
      {c:"≈ 550 €", t:"mesačne pri invalidite nad 70 %"},
      {c:"80 %", t:"poberateľov plnej invalidity má menej ako 530 € mesačne"},
      {c:"3 z 10", t:"invalidných dôchodcov popri dôchodku pracuje"},
      {c:"14 069", t:"nových invalidných dôchodkov ročne (spolu 221 815 poberateľov)"},
      {c:"10 %", t:"nových invalidít pripadá na ľudí do 29 rokov"}
    ],
    pozn:"Invalidný dôchodok <b>môže Sociálna poisťovňa znížiť alebo odobrať</b> pri prehodnotení zdravotného stavu. Najčastejšie príčiny plnej invalidity: choroby pohybového systému 28 %, duševné poruchy 18 %, obehová sústava 12 %. Pri čiastočnej vedú nádorové ochorenia s 52 %." },

  { id:"f-tnu", nazov:"Trvalé následky úrazu a čo robí progresia",
    zhrn:"Prečo je poistná suma s progresiou niekoľkonásobne účinnejšia",
    body:[
      {c:"3 + 15", t:"ťažkých a ľahších zranení pripadá na jedno úmrtie pri dopravnej nehode"},
      {c:"3 ľudia", t:"sa každý deň na Slovensku vážne zrania pri dopravnej nehode"},
      {c:"4.", t:"najčastejšia príčina hospitalizácie sú úrazy"},
      {c:"1/3", t:"obetí dopravných nehôd tvoria chodci a cyklisti"}
    ],
    pozn:"Progresia znamená, že pri vážnom poškodení poisťovňa vyplatí násobok poistnej sumy. Pri <b>1 000 % progresii a poistnej sume 10 000 €</b> je plnenie pri 100 % telesnom poškodení až <b>100 000 €</b> — preto sa progresia oplatí viac ako vyššia základná suma bez nej." },

  { id:"f-kch", nazov:"Kritické choroby v číslach",
    zhrn:"Koľko prípadov ročne a na čo si dať pozor pri výbere",
    body:[
      {c:"39 500", t:"zhubných nádorov ročne, z toho 15 000 u ľudí do 64 rokov"},
      {c:"11 400", t:"cievnych mozgových príhod ročne, 3 100 do 64 rokov"},
      {c:"3 500", t:"infarktov myokardu ročne, 1 500 do 64 rokov"},
      {c:"4,5", t:"nových pacientov so zhubným nádorom pribudne každú hodinu"},
      {c:"2×", t:"častejšie diagnostikujú nádor ženám vo veku 25–49 rokov ako mužom"}
    ],
    pozn:"Pri porovnávaní poisťovní <b>nerozhoduje počet krytých diagnóz, ale ktoré to sú</b>. Dlhé zoznamy často obsahujú ochorenia s nulovým alebo jednotkovým výskytom na Slovensku — brušný týfus 0 prípadov, tetanus 0, malária 2, Creutzfeldt-Jakobova choroba 17. To je marketing, nie ochrana. Podstatné je krytie nádorov, infarktu a mozgovej príhody." },

  { id:"f-pn", nazov:"Dlhodobá práceneschopnosť",
    zhrn:"Ako dlho trvá a aký je strop dennej dávky",
    body:[
      {c:"36 %", t:"práceneschopností trvá viac ako 29 dní"},
      {c:"44,5", t:"dňa je priemerná dĺžka práceneschopnosti"}
    ],
    pozn:"Najčastejšie príčiny: choroby dýchacej sústavy, svalového a kostrového aparátu, úrazy, tráviaca a obehová sústava.",
    tabulka:true },

  { id:"f-met", nazov:"Ako určujeme poistné sumy",
    zhrn:"Metodika, podľa ktorej sú balíčky nastavené",
    body:[
      {c:"Smrť a invalidita", t:"zostatok hypotéky, rezerva pre nezaopatrené deti, mínus existujúci majetok vrátane úspor v II. a III. pilieri"},
      {c:"Trvalé následky", t:"3–5× ročný čistý príjem, vždy s progresiou"},
      {c:"Kritické choroby", t:"1,5–3× ročný čistý príjem"},
      {c:"Práceneschopnosť", t:"dorovnanie do 100 % mzdy, obmedzené stropom poisťovne"}
    ],
    pozn:"Päť rizík, na ktorých to stojí: <b>smrť, invalidita, trvalé následky úrazu, kritické choroby a dlhodobá PN</b>. Ostatné pripoistenia sú doplnok — ak sa nezmestia do rozpočtu, obetujeme ich ako prvé." }
];

function renderFakty(){
  const T = CONFIG.zivot.limitPN;
  const tab = `<table class="ft"><thead><tr><th>Čistý mesačný príjem</th><th>Maximálna denná dávka</th></tr></thead>
    <tbody>${T.map(([p,d]) => `<tr><td>od ${eur(p)}</td><td>${eur(d)} / deň</td></tr>`).join("")}</tbody></table>
    <div class="ftp">Limity sa medzi poisťovňami mierne líšia. Appka o ne automaticky zastropuje vypočítanú dennú dávku.</div>`;
  $("fakty").innerHTML = FAKTY.map(f => `
    <details class="fakt" id="${f.id}">
      <summary><span class="fn">${f.nazov}</span><span class="fz">${f.zhrn}</span>
        <svg class="fs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>
      <div class="fbody">
        <div class="fgrid">${f.body.map(b => `<div class="fi"><b>${b.c}</b><span>${b.t}</span></div>`).join("")}</div>
        ${f.tabulka ? tab : ""}
        ${f.pozn ? `<p class="fpozn">${f.pozn}</p>` : ""}
      </div>
    </details>`).join("");
}

/* ============================================================
   INVESTÍCIE
   Hore názorné vedierka (bez počítania — slúžia na pochopenie),
   pod nimi samostatné kalkulačky na konkrétne ciele.
   ============================================================ */
function buducaHodnota(mesacne, rocnyVynos, mesiacov){
  const i = rocnyVynos/100/12;
  if (i === 0) return mesacne * mesiacov;
  return mesacne * (Math.pow(1+i, mesiacov) - 1) / i;
}
function ulozkaNaCiel(ciel, rocnyVynos, mesiacov){
  const i = rocnyVynos/100/12;
  if (mesiacov <= 0) return 0;
  if (i === 0) return ciel / mesiacov;
  return ciel * i / (Math.pow(1+i, mesiacov) - 1);
}
/* kapitál potrebný na vyplácanie renty (anuita s výnosom počas výplaty) */
function kapitalNaRentu(mesacne, rocnyVynos, mesiacov){
  const i = rocnyVynos/100/12;
  if (i === 0) return mesacne * mesiacov;
  return mesacne * (1 - Math.pow(1+i, -mesiacov)) / i;
}

/* ---- názorné vedierka ---- */
const VEDIERKA = [
  { id:"bezny", nazov:"Bežný účet", horizont:"na tento mesiac",
    popis:"Peniaze na bežné výdavky. Nič sa tu nezhodnocuje a ani nemá.",
    ciel:"približne jeden mesačný výdavok", vynos:"0 %", farba:"var(--s1)", vyska:0.34 },
  { id:"rezerva", nazov:"Rezerva", horizont:"do 5 rokov",
    popis:"Vankúš na nečakané výdavky a výpadok príjmu. Musí byť dostupná do pár dní.",
    ciel:"3 až 6 mesačných výdavkov", vynos:"0–3 % ročne", farba:"var(--s4)", vyska:0.62 },
  { id:"ciel", nazov:"Dlhodobý cieľ", horizont:"10 rokov a viac",
    popis:"Dôchodok, predčasné splatenie hypotéky, štart pre deti. Čas tu pracuje za vás.",
    ciel:"5 až 10 % príjmu mesačne", vynos:"6–10 % ročne", farba:"var(--s3)", vyska:1.0 }
];

function renderKybliky(v){
  const vyd = Math.max(0, +$("iVyd").value || 0);
  const orient = [
    vyd > 0 ? eur(vyd) : "—",
    vyd > 0 ? `${eur(vyd*3)} – ${eur(vyd*6)}` : "—",
    v.prijem > 0 ? `${eur(v.prijem*0.05)} – ${eur(v.prijem*0.10)} mesačne` : "—"
  ];
  $("kybliky").innerHTML = `<div class="kyb">` + VEDIERKA.map((k,i) => {
    const H = 92, h = Math.round(H * k.vyska);
    return `<div class="kb">
      <svg viewBox="0 0 120 120" class="kbimg" role="img" aria-label="Vedierko ${k.nazov}">
        <defs><clipPath id="cp${i}"><path d="M22 26 h76 l-9 74 a6 6 0 0 1 -6 5 h-46 a6 6 0 0 1 -6 -5 Z"/></clipPath></defs>
        <rect x="0" y="${118-h}" width="120" height="${h}" fill="${k.farba}" opacity=".22" clip-path="url(#cp${i})"/>
        <path d="M22 26 h76 l-9 74 a6 6 0 0 1 -6 5 h-46 a6 6 0 0 1 -6 -5 Z"
              fill="none" stroke="${k.farba}" stroke-width="2.4" stroke-linejoin="round"/>
        <rect x="16" y="19" width="88" height="9" rx="4.5" fill="${k.farba}"/>
        <path d="M38 19 a22 14 0 0 1 44 0" fill="none" stroke="${k.farba}" stroke-width="2.2" opacity=".55"/>
      </svg>
      <div class="kbh">${k.horizont}</div>
      <div class="kbn">${k.nazov}</div>
      <p>${k.popis}</p>
      <div class="kbc"><b>${orient[i]}</b><span>${k.ciel}</span></div>
      <div class="kbv">Zhodnotenie ${k.vynos}</div>
    </div>`;
  }).join("") + `</div>
  <div class="kybpozn">Poradie nie je náhodné: kým nestojí rezerva, každý nečakaný výdavok sa rieši úverom
    alebo predajom investície v najhoršom možnom čase. Preto sa najprv naplní druhé vedierko a až potom tretie.</div>`;
}

/* ---- kalkulačka: doživotná renta ---- */
function renderRenta(v){
  const mes  = Math.max(0, +$("iRenta").value || 0);
  const roky = clamp(+$("iRentaRoky").value || 20, 5, 35);
  const vyn  = clamp(+$("iRentaVynos").value || 3, 0, 8);
  const spor = clamp(+$("iRentaSpor").value || 8, 0, 12);
  const kapital = kapitalNaRentu(mes, vyn, roky*12);
  const doDochodku = Math.max(1, Math.round(65 - v.vekVaz));
  const ulozka  = ulozkaNaCiel(kapital, spor, doDochodku*12);
  const neskor  = ulozkaNaCiel(kapital, spor, Math.max(1, doDochodku-10)*12);

  /* priebeh: rast počas sporenia, potom čerpanie renty */
  const vekTeraz = Math.round(v.vekVaz);
  const body = [];
  for (let r = 0; r <= doDochodku; r++)
    body.push({vek: vekTeraz+r, v: buducaHodnota(ulozka, spor, r*12), faza:"spor"});
  const iv = vyn/100/12;
  for (let r = 1; r <= roky; r++){
    const m = r*12;
    const zost = iv === 0 ? kapital - mes*m
      : kapital*Math.pow(1+iv,m) - mes*(Math.pow(1+iv,m)-1)/iv;
    body.push({vek: vekTeraz+doDochodku+r, v: Math.max(0, zost), faza:"vyplata"});
  }
  rentaChart($("chartRenta"), $("tipRenta"), body, vekTeraz+doDochodku);
  $("rentaSub").innerHTML = `Hodnota účtu v eurách podľa veku. Do ${vekTeraz+doDochodku} rokov sporíte
    ${eur(ulozka)} mesačne pri ${num(spor)} % ročne, potom si ${roky} rokov vyplácate ${eur(mes)} mesačne
    a zvyšok sa medzitým zhodnocuje ${num(vyn)} %.`;
  $("oRentaKapital").textContent = eur(kapital);
  $("oRentaUlozka").textContent  = eur(ulozka);
  $("oRentaNeskor").textContent  = eur(neskor);
  $("oRentaDoba").textContent = `mesačne počas ${doDochodku} rokov pri ${num(spor)} % ročne`;
  $("rentaPozn").innerHTML = `<span>Kapitál <b>${eur(kapital)}</b> vystačí na rentu ${eur(mes)} mesačne
    počas ${roky} rokov, ak sa zvyšok medzitým zhodnocuje ${num(vyn)} % ročne. Po tomto období sa vyčerpá —
    doživotnú garanciu dáva len anuita z poisťovne alebo II. pilier, tam je však renta spravidla nižšia.
    Sumy sú v dnešných eurách, infláciu prepočet neuvažuje.</span>`;
}

/* graf: rast kapitálu počas sporenia a jeho čerpanie počas výplaty */
function rentaChart(host, tipEl, data, vekZlom){
  host.querySelectorAll("svg").forEach(e => e.remove());
  const W=900,H=250,PADl=70,PADr=16,PADt=16,PADb=32;
  const iw=W-PADl-PADr, ih=H-PADt-PADb;
  const v0=data[0].vek, v1=data[data.length-1].vek;
  const yMax=niceMax(Math.max(...data.map(d=>d.v),1));
  const X=vek=>PADl+((vek-v0)/Math.max(1,v1-v0))*iw;
  const Y=val=>PADt+ih-(val/yMax)*ih;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Vývoj kapitálu počas sporenia a výplaty renty">`;
  for(let i=0;i<=4;i++){const val=yMax*i/4,y=Y(val);
    s+=`<line x1="${PADl}" x2="${W-PADr}" y1="${y}" y2="${y}" stroke="var(--grid)"/>
        <text x="${PADl-10}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--muted)">${kFmt(val)}</text>`;}
  const krok = (v1-v0)>30?10:5;
  for(let vek=v0;vek<=v1;vek+=krok)
    s+=`<text x="${X(vek)}" y="${H-PADb+18}" text-anchor="middle" font-size="11" fill="var(--muted)">${vek}</text>`;
  const useky=(f)=>data.filter(d=>d.faza===f);
  const plocha=(arr,farba)=>{
    if(!arr.length) return "";
    const c=arr.map((d,i)=>(i?"L":"M")+X(d.vek).toFixed(1)+" "+Y(d.v).toFixed(1)).join(" ");
    return `<path d="${c} L ${X(arr[arr.length-1].vek).toFixed(1)} ${Y(0)} L ${X(arr[0].vek).toFixed(1)} ${Y(0)} Z" fill="${farba}" opacity=".18"/>
            <path d="${c}" fill="none" stroke="${farba}" stroke-width="2.4" stroke-linejoin="round"/>`;
  };
  const spor=useky("spor"), vypl=[spor[spor.length-1]].concat(useky("vyplata"));
  s+=plocha(spor,"var(--s3)")+plocha(vypl,"var(--s2)");
  s+=`<line x1="${X(vekZlom)}" x2="${X(vekZlom)}" y1="${PADt}" y2="${Y(0)}" stroke="var(--axis)" stroke-dasharray="4 4"/>
      <text x="${X(vekZlom)}" y="${PADt-4}" text-anchor="middle" font-size="11" fill="var(--muted)">odchod do dôchodku</text>`;
  s+=`<line x1="${PADl}" x2="${W-PADr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--axis)" stroke-width="1.5"/>
      <line class="rt-hair" x1="0" x2="0" y1="${PADt}" y2="${Y(0)}" stroke="var(--axis)" opacity="0"/>
      <circle class="rt-dot" r="4.5" fill="var(--ink)" stroke="var(--card)" stroke-width="2" opacity="0"/>
      <rect class="rt-hit" x="${PADl}" y="${PADt}" width="${iw}" height="${ih}" fill="transparent" style="cursor:crosshair"/></svg>`;
  host.insertAdjacentHTML("afterbegin", s);
  const svg=host.querySelector("svg");
  svg.querySelector(".rt-hit").addEventListener("mousemove", e=>{
    const box=svg.getBoundingClientRect();
    const vek=v0+clamp((e.clientX-box.left)/box.width*W-PADl,0,iw)/iw*(v1-v0);
    const d=data.reduce((a,b)=>Math.abs(b.vek-vek)<Math.abs(a.vek-vek)?b:a);
    svg.querySelector(".rt-hair").setAttribute("x1",X(d.vek));
    svg.querySelector(".rt-hair").setAttribute("x2",X(d.vek));
    svg.querySelector(".rt-hair").setAttribute("opacity","1");
    svg.querySelector(".rt-dot").setAttribute("cx",X(d.vek));
    svg.querySelector(".rt-dot").setAttribute("cy",Y(d.v));
    svg.querySelector(".rt-dot").setAttribute("opacity","1");
    tipEl.innerHTML=`<div style="margin-bottom:4px;color:#aaa">vo veku ${d.vek} rokov</div>
      <div class="r"><span>Na účte</span><b>${eur(d.v)}</b></div>
      <div style="margin-top:4px;color:#aaa">${d.faza==="spor"?"ešte sporíte":"vyplácate si rentu"}</div>`;
    tipEl.style.opacity="1";
    const hb=host.getBoundingClientRect();
    let left=e.clientX-hb.left+14;
    if(left+tipEl.offsetWidth>hb.width) left=e.clientX-hb.left-tipEl.offsetWidth-14;
    tipEl.style.left=left+"px"; tipEl.style.top=clamp(e.clientY-hb.top-10,0,hb.height-tipEl.offsetHeight)+"px";
  });
  svg.querySelector(".rt-hit").addEventListener("mouseleave",()=>{
    tipEl.style.opacity="0";
    [".rt-hair",".rt-dot"].forEach(q=>svg.querySelector(q).setAttribute("opacity","0"));
  });
}

/* ---- kalkulačka: sporenie pre deti ---- */
function renderDeti(){
  const vek  = clamp(+$("iDietaVek").value || 0, 0, 25);
  const ciel = clamp(+$("iDietaCiel").value || 20, 15, 30);
  const suma = Math.max(0, +$("iDietaSuma").value || 0);
  const roky = Math.max(1, ciel - vek);
  const V = clamp(+$("iDetiVynos").value || 8, 0, 12);
  const ul = ulozkaNaCiel(suma, V, roky*12);
  const vklad = ul*roky*12, vynos = Math.max(0, suma - vklad);
  $("oDetiUlozka").textContent = eur(ul);
  $("oDetiDoba").textContent   = `mesačne počas ${roky} rokov pri ${num(V)} % ročne`;
  $("oDetiVklad").textContent  = eur(vklad);
  $("oDetiVynos").textContent  = eur(vynos);
  pasik("pasikDeti", vklad, suma);
  $("detiPozn").className = "flag ok";
  $("detiPozn").innerHTML = `<span>Čas je tu najsilnejší nástroj: pri dieťati, ktoré má ${vek} ${vek===1?"rok":vek<5?"roky":"rokov"},
    tvorí výnos <b>${suma>0?Math.round(vynos/suma*100):0} %</b> cieľovej sumy. O päť rokov neskôr by ste na rovnaký cieľ
    potrebovali <b>${eur(ulozkaNaCiel(suma, V, Math.max(1,roky-5)*12))}</b> mesačne.</span>`;
}

/* ---- kalkulačka: vlastný cieľ ---- */
function renderSen(){
  const nazov = ($("iSenNazov").value || "").trim() || "váš cieľ";
  const suma  = Math.max(0, +$("iSenSuma").value || 0);
  const roky  = clamp(+$("iSenRoky").value || 10, 1, 40);
  const vyn   = clamp(+$("iSenVynos").value || 6, 0, 12);
  const ul = ulozkaNaCiel(suma, vyn, roky*12);
  const vklad = ul*roky*12, vynos = Math.max(0, suma - vklad);
  $("lblSen").textContent   = `Na „${nazov}" odkladajte`;
  $("oSenUlozka").textContent = eur(ul);
  $("oSenVklad").textContent  = eur(vklad);
  $("oSenVynos").textContent  = eur(vynos);
  pasik("pasikSen", vklad, suma);
  $("senPozn").className = "flag ok";
  $("senPozn").innerHTML = `<span>Na <b>${eur(suma)}</b> o ${roky} ${roky===1?"rok":roky<5?"roky":"rokov"} treba
    <b>${eur(ul)}</b> mesačne. Bez zhodnotenia by to bolo ${eur(suma/(roky*12))} — rozdiel
    <b>${eur(Math.max(0, suma/(roky*12) - ul))}</b> mesačne urobí trh za vás.</span>`;
}

/* spoločný pásik vklady vs. výnos */
function pasik(id, vklad, cielova){
  const pV = cielova > 0 ? clamp(vklad/cielova*100, 0, 100) : 0;
  $(id).innerHTML = `
    <div class="p"><i style="width:${pV}%;background:var(--s1)"></i><i style="width:${100-pV}%;background:var(--s3)"></i></div>
    <div class="l">
      <span><i style="background:var(--s1)"></i>Vaše vklady <b>${eur(vklad)}</b> (${Math.round(pV)} %)</span>
      <span><i style="background:var(--s3)"></i>Výnos <b>${eur(Math.max(0,cielova-vklad))}</b> (${Math.round(100-pV)} %)</span>
    </div>`;
}

function renderInvest(v){
  renderKybliky(v);
  if ($("d-renta").open) renderRenta(v);
  if ($("d-deti").open)  renderDeti();
  if ($("d-sen").open)   renderSen();
}

/* ============================================================
   DÔCHODOK — odhad z troch pilierov
   I. pilier podľa vzorca Sociálnej poisťovne, II. a III. ako
   nasporený kapitál prepočítaný na mesačnú rentu.
   ============================================================ */
function renderDoch(v){
  const D = CONFIG.dochodok;
  const hruba  = Math.max(0, +$("iHruba").value || 0);
  const odprac = clamp(+$("iOdprac").value || 0, 0, 50);
  const maII   = $("iMaII").value === "a";
  const rokII  = clamp(+$("iRokII").value || 2015, 2005, 2060);
  const stavII = Math.max(0, +$("iStavII").value || 0);
  const stavIII= Math.max(0, +$("iStavIII").value || 0);
  const prisIII= Math.max(0, +$("iPrispIII").value || 0);
  document.querySelectorAll(".w2ii").forEach(el => el.style.display = maII ? "" : "none");

  const vek = v.vekVaz;
  const rokovDo = Math.max(0, D.vekOdchodu - vek);
  const mesiacov = Math.round(rokovDo*12);
  const rokTeraz = 2026;

  /* --- I. pilier --- */
  const pomb = D.priemernaMzda > 0 ? hruba / D.priemernaMzda : 0;
  const odp  = odprac + rokovDo;
  const plny = pomb * odp * D.adh;
  const rokovVII = maII ? Math.max(0, (rokTeraz - rokII) + rokovDo) : 0;
  const kratenie = pomb * rokovVII * D.adh * D.kratenieII;
  const p1 = Math.max(0, plny - kratenie);

  /* --- II. a III. pilier ---
     Počítame v dnešných eurách: od nominálneho výnosu odpočítavame infláciu.
     Inak by kapitál za 30 rokov vyzeral obrovsky, hoci jeho kúpna sila bude oveľa nižšia. */
  const r2 = D.vynosII  - D.inflacia;
  const r3 = D.vynosIII - D.inflacia;
  const rv = Math.max(0, D.vyplataVynos - D.inflacia);
  const anuita = kapitalNaRentu(1, rv, D.vyplataRokov*12);   // kapitál potrebný na 1 € renty

  const vklad2 = maII ? hruba * D.sadzbaII : 0;
  const kapital2 = maII
    ? stavII * Math.pow(1 + r2/100, rokovDo) + buducaHodnota(vklad2, r2, mesiacov) : 0;
  const p2 = kapital2 > 0 ? kapital2 / anuita : 0;

  const kapital3 = stavIII * Math.pow(1 + r3/100, rokovDo) + buducaHodnota(prisIII, r3, mesiacov);
  const p3 = kapital3 > 0 ? kapital3 / anuita : 0;

  const spolu = p1 + p2 + p3;
  const dnes  = v.prijem;                       // čistý príjem domácnosti dnes
  const cisty1 = hruba * 0.79;                  // hrubá → čistá, orientačne
  const podiel = cisty1 > 0 ? spolu/cisty1*100 : 0;

  $("oDochSpolu").textContent  = eur(spolu);
  $("oDochPodiel").textContent = cisty1 > 0 ? `${Math.round(podiel)} % vášho dnešného čistého príjmu` : "";
  $("oDochDnes").textContent   = eur(cisty1);
  $("oDochDoba").textContent   = `do dôchodku ${Math.round(rokovDo)} rokov`;
  $("oDochChyba").textContent  = eur(Math.max(0, cisty1 - spolu));

  dochChart($("chartDoch"), $("tipDoch"), [
    {n:"I. pilier",   v:p1, f:"var(--s1)", p:"štátny dôchodok zo Sociálnej poisťovne"},
    {n:"II. pilier",  v:p2, f:"var(--s4)", p:"vaše sporenie, renta na "+D.vyplataRokov+" rokov"},
    {n:"III. pilier", v:p3, f:"var(--s3)", p:"doplnkové sporenie, renta na "+D.vyplataRokov+" rokov"}
  ], cisty1);

  $("dochSub").innerHTML = `Mesačná suma v eurách, v dnešných cenách. Prerušovaná čiara je váš dnešný čistý príjem
    ${eur(cisty1)} — rozdiel medzi ňou a stĺpcami je to, čo si treba pripraviť sám.`;

  $("dochPozn").innerHTML = `<span><b>Ide o odhad, nie o výpočet Sociálnej poisťovne.</b>
    Predpokladá, že váš pomer k priemernej mzde zostane rovnaký po celý život (dnes ${num(pomb)}),
    že odpracujete ${Math.round(odp)} rokov a že sa hodnoty nezmenia legislatívou.
    Všetky sumy sú <b>v dnešných eurách</b> — od predpokladaného zhodnotenia (${D.vynosII} % v II. a ${D.vynosIII} % v III. pilieri)
    odpočítavame infláciu ${D.inflacia} %, aby boli porovnateľné s dnešným príjmom.
    Presný nárok vám Sociálna poisťovňa vypočíta až pri žiadosti — toto slúži na rozhodovanie, nie na plánovanie na euro.</span>`;

  /* --- IV. pilier: vlastná renta --- */
  if (!r4Dotknute) { $("iR4").value = Math.round(Math.max(0, cisty1 - spolu)); $("rR4").value = $("iR4").value; }
  const r4mes  = Math.max(0, +$("iR4").value || 0);
  const r4roky = clamp(+$("iR4Roky").value || 20, 5, 35);
  const r4vyn  = clamp(+$("iR4Vynos").value || 3, 0, 8);
  const r4spor = clamp(+$("iR4Spor").value || CONFIG.vedierka.vynosProjekcia, 0, 12);
  const r4sporR= Math.max(0, r4spor - D.inflacia);         // reálne zhodnotenie počas sporenia
  const r4vynR = Math.max(0, r4vyn  - D.inflacia);         // reálne zhodnotenie počas výplaty
  const r4kap  = kapitalNaRentu(r4mes, r4vynR, r4roky*12);
  const r4mes_ = Math.max(1, mesiacov);
  const r4ul   = ulozkaNaCiel(r4kap, r4sporR, r4mes_);
  const r4nesk = ulozkaNaCiel(r4kap, r4sporR, Math.max(12, mesiacov-120));
  $("oR4Kapital").textContent = eur(r4kap);
  $("oR4Ulozka").textContent  = eur(r4ul);
  $("oR4Doba").textContent    = `mesačne počas ${Math.round(rokovDo)} rokov pri ${num(r4spor)} % ročne`;
  $("oR4Neskor").textContent  = eur(r4nesk);
  pasik("pasikR4", r4ul*mesiacov, r4kap);

  /* priebeh: rast počas sporenia, potom čerpanie renty — všetko v dnešných eurách */
  const r4Vek   = Math.round(vek);
  const r4Odchod= Math.max(1, Math.round(rokovDo));
  const r4Body  = [];
  for (let r = 0; r <= r4Odchod; r++)
    r4Body.push({vek: r4Vek+r, v: buducaHodnota(r4ul, r4sporR, Math.round(r*12)), faza:"spor"});
  const r4i = r4vynR/100/12;
  for (let r = 1; r <= r4roky; r++){
    const m = r*12;
    const zost = r4i === 0 ? r4kap - r4mes*m
      : r4kap*Math.pow(1+r4i,m) - r4mes*(Math.pow(1+r4i,m)-1)/r4i;
    r4Body.push({vek: r4Vek+r4Odchod+r, v: Math.max(0, zost), faza:"vyplata"});
  }
  rentaChart($("chartR4"), $("tipR4"), r4Body, r4Vek+r4Odchod);
  $("r4Sub").innerHTML = `Hodnota účtu v dnešných eurách podľa veku. Do ${r4Vek+r4Odchod} rokov si odkladáte
    ${eur(r4ul)} mesačne pri ${num(r4spor)} % ročne, potom si ${r4roky} rokov vyplácate ${eur(r4mes)} mesačne
    a zvyšok sa medzitým zhodnocuje ${num(r4vyn)} %.`;

  $("r4Pozn").innerHTML = `<span>Aj tu počítame <b>v dnešných eurách</b> — od predpokladaného zhodnotenia
    ${num(r4spor)} % odpočítavame infláciu ${D.inflacia} %, takže ${eur(r4ul)} mesačne má
    dnešnú kúpnu silu. Renta ${eur(r4mes)} vydrží ${r4roky} rokov a potom sa kapitál vyčerpá.</span>`;

  $("dochRozpis").innerHTML = `
    <table class="kt"><tbody>
      <tr><td>POMB — pomer vašej mzdy k priemernej<span>hrubá ${eur(hruba)} ÷ priemerná mzda ${eur(D.priemernaMzda)}</span></td><td>${num(pomb)}</td></tr>
      <tr><td>Roky dôchodkového poistenia<span>${odprac} odpracovaných + ${Math.round(rokovDo)} do 65 rokov</span></td><td>${Math.round(odp)}</td></tr>
      <tr><td>Aktuálna dôchodková hodnota 2026</td><td>${eur(D.adh,4)}</td></tr>
      <tr><td>I. pilier pred krátením<span>POMB × roky × ADH</span></td><td>${eur(plny)}</td></tr>
      ${maII ? `<tr><td>Krátenie za ${Math.round(rokovVII)} rokov v II. pilieri<span>22/91 pomernej sumy podľa § 66 ods. 6</span></td><td>− ${eur(kratenie)}</td></tr>` : ""}
      <tr><td><b>I. pilier — mesačne</b></td><td><b>${eur(p1)}</b></td></tr>
      ${maII ? `<tr><td>II. pilier — kapitál v 65<span>${eur(stavII)} dnes + ${eur(vklad2)} mesačne; ${D.vynosII} % výnos − ${D.inflacia} % inflácia = ${num(r2)} % reálne</span></td><td>${eur(kapital2)}</td></tr>
      <tr><td><b>II. pilier — renta na ${D.vyplataRokov} rokov</b></td><td><b>${eur(p2)}</b></td></tr>` : ""}
      <tr><td>III. pilier — kapitál v 65<span>${eur(stavIII)} dnes + ${eur(prisIII)} mesačne; ${D.vynosIII} % výnos − ${D.inflacia} % inflácia = ${num(r3)} % reálne</span></td><td>${eur(kapital3)}</td></tr>
      <tr><td><b>III. pilier — renta na ${D.vyplataRokov} rokov</b></td><td><b>${eur(p3)}</b></td></tr>
    </tbody></table>`;
  return {p1, p2, p3, spolu, cisty1, chyba: Math.max(0, cisty1-spolu), rokovDo, r4kap, r4ul};
}

/* stĺpcový graf pilierov s čiarou dnešného príjmu */
function dochChart(host, tipEl, data, prijem){
  host.querySelectorAll("svg").forEach(e => e.remove());
  const W=900,H=250,PADl=68,PADr=16,PADt=18,PADb=40;
  const iw=W-PADl-PADr, ih=H-PADt-PADb;
  const yMax = niceMax(Math.max(prijem*1.1, ...data.map(d=>d.v), 1));
  const bw = Math.min(110, iw/data.length - 60);
  const X = i => PADl + (i+0.5)*(iw/data.length) - bw/2;
  const Y = val => PADt + ih - (val/yMax)*ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Odhadovaný dôchodok podľa pilierov">`;
  for (let i=0;i<=4;i++){ const val=yMax*i/4,y=Y(val);
    s+=`<line x1="${PADl}" x2="${W-PADr}" y1="${y}" y2="${y}" stroke="var(--grid)"/>
        <text x="${PADl-10}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--muted)">${kFmt(val)}</text>`; }
  data.forEach((d,i)=>{
    const h = Math.max(0, ih*(d.v/yMax));
    s+=`<path d="M${X(i)} ${Y(d.v)+4} a4 4 0 0 1 4-4 h${bw-8} a4 4 0 0 1 4 4 v${h-4} h${-bw} Z" fill="${d.f}"/>`;
    s+=`<text x="${X(i)+bw/2}" y="${Y(d.v)-8}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)">${eur(d.v)}</text>`;
    s+=`<text x="${X(i)+bw/2}" y="${H-PADb+18}" text-anchor="middle" font-size="12" fill="var(--ink-2)">${d.n}</text>`;
    s+=`<rect class="dhb" data-i="${i}" x="${X(i)-8}" y="${PADt}" width="${bw+16}" height="${ih}" fill="transparent"/>`;
  });
  if (prijem>0){
    const lbl=`dnešný čistý príjem ${eur(prijem)}`, lw=lbl.length*6.2+12;
    s+=`<line x1="${PADl}" x2="${W-PADr}" y1="${Y(prijem)}" y2="${Y(prijem)}" stroke="var(--s2)" stroke-width="1.6" stroke-dasharray="6 4"/>
        <rect x="${W-PADr-lw}" y="${Y(prijem)-19}" width="${lw}" height="17" rx="4" fill="var(--page)" opacity=".95"/>
        <text x="${W-PADr-6}" y="${Y(prijem)-7}" text-anchor="end" font-size="11.5" fill="var(--s2)" font-weight="600">${lbl}</text>`;
  }
  s+=`<line x1="${PADl}" x2="${W-PADr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--axis)" stroke-width="1.5"/></svg>`;
  host.insertAdjacentHTML("afterbegin", s);
  host.querySelectorAll(".dhb").forEach(el=>{
    el.addEventListener("mousemove", e=>{
      const d=data[+el.dataset.i];
      tipEl.innerHTML=`<div style="margin-bottom:4px;color:#aaa">${d.n}</div>
        <div class="r"><span><i style="background:${d.f}"></i>Mesačne</span><b>${eur(d.v)}</b></div>
        <div style="margin-top:4px;color:#aaa">${d.p}</div>`;
      tipEl.style.opacity="1";
      const hb=host.getBoundingClientRect();
      let left=e.clientX-hb.left+14;
      if(left+tipEl.offsetWidth>hb.width) left=e.clientX-hb.left-tipEl.offsetWidth-14;
      tipEl.style.left=left+"px"; tipEl.style.top=clamp(e.clientY-hb.top-10,0,hb.height-tipEl.offsetHeight)+"px";
    });
    el.addEventListener("mouseleave",()=>tipEl.style.opacity="0");
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

/* maximálna denná dávka PN, ktorú poisťovňa pripustí pri danom čistom príjme */
function maxPnDenne(prijem){
  const t = CONFIG.zivot.limitPN;
  if (prijem < t[0][0]) return Math.max(0, Math.round(prijem / (t[0][0]/t[0][1])));  // pod tabuľkou dopočet
  let v = t[0][1];
  for (const [p, d] of t) if (prijem >= p) v = d;
  return v;
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
    pnDenne: bal.pn ? (bal.pnMax ? maxPnDenne(o.prijem)
                     : Math.min(Math.round((1 - Z.nemocenskePodiel) * o.prijem / 30), maxPnDenne(o.prijem))) : 0,
    pnStrop: maxPnDenne(o.prijem)
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

  /* --- porovnanie balíčkov aj krytí v jednej tabuľke --- */
  const dvaja = !!vyb.o2;
  const dvojhodnota = (f) => navrhy.map(n => {
    const a = f(n.ps1, n.o1), b = n.ps2 ? f(n.ps2, n.o2) : null;
    return b === null ? a : `${a}<i>${b}</i>`;
  });
  const stavZnak = (hod, min) => hod <= 0 ? `<em class="st st-ne">nekryté</em>`
      : hod >= min*0.97 ? `<em class="st st-ok">✓ v pásme</em>` : `<em class="st st-pod">pod pásmom</em>`;
  const riadok = (nazov, pozn, f, minF) => {
    const h = dvojhodnota(f);
    return `<tr>
      <th scope="row">${nazov}${pozn?`<span>${pozn}</span>`:""}</th>
      ${navrhy.map((n,i) => `<td class="${n.bal.id===vybranyBalicek?'sel':''}">${h[i]}${
        minF ? stavZnak(minF(n.ps1, n.o1), minF(null, n.o1, true)) : ""}</td>`).join("")}
    </tr>`;
  };

  const d0 = navrhy.map(n => n.bal.deti);
  $("balTab").innerHTML = `
    <table class="bt">
      <thead>
        <tr>
          <th></th>
          ${navrhy.map(n => `<th class="${n.bal.id===vybranyBalicek?'sel':''}" data-bal="${n.bal.id}">
            ${n.bal.odporucane?'<span class="odp">odporúčame</span>':''}
            <span class="bn">${n.bal.nazov}</span>
            <span class="bp">${n.bal.podnadpis}</span>
            <span class="bc">${Math.round(n.dolna/5)*5} – ${Math.round(n.horna/5)*5} €</span>
            <span class="bm">mesačne za rodinu</span>
            <button type="button" class="bvyb ${n.bal.id===vybranyBalicek?'on':''}" data-bal="${n.bal.id}">
              ${n.bal.id===vybranyBalicek?'✓ vybraté':'vybrať'}</button>
          </th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${dvaja?`<tr class="pozn"><th scope="row"></th>${navrhy.map(n=>`<td class="${n.bal.id===vybranyBalicek?'sel':''}">žiadateľ 1 / žiadateľ 2</td>`).join("")}</tr>`:""}
        ${riadok("Smrť a invalidita nad 40 %", "aspoň zostatok hypotéky", ps => eur(ps.smrt),
                 (ps,o,min) => min ? v.suma : ps.smrt)}
        ${riadok("Trvalé následky úrazu", "odporúčame 3–5× ročný príjem", ps => eur(ps.tnu),
                 (ps,o,min) => min ? 3*o.prijem*12 : ps.tnu)}
        ${riadok("Kritické choroby", "odporúčame 1,5–3× ročný príjem", ps => eur(ps.kch),
                 (ps,o,min) => min ? 1.5*o.prijem*12 : ps.kch)}
        ${riadok("Práceneschopnosť", "dorovnanie mzdy", ps => ps.pnDenne ? eur(ps.pnDenne)+" / deň" : "—",
                 (ps,o,min) => min ? Math.round((1-CONFIG.zivot.nemocenskePodiel)*o.prijem/30) : ps.pnDenne)}
        <tr><th scope="row">Začiatok krytia PN</th>
          ${navrhy.map(n => `<td class="${n.bal.id===vybranyBalicek?'sel':''}">${n.bal.pn?`od ${n.bal.pnOd}. dňa`:"—"}</td>`).join("")}</tr>
        <tr><th scope="row">Deti${v.deti>0?` (${v.deti})`:""}<span>úraz · kritické choroby · denne</span></th>
          ${navrhy.map((n,i) => `<td class="${n.bal.id===vybranyBalicek?'sel':''}">${
            d0[i] ? `${eur(d0[i].tnu)} · ${eur(d0[i].kch)} · ${eur(d0[i].denne)}` : "nekryté"}</td>`).join("")}</tr>
      </tbody>
    </table>`;

  $("balTab").querySelectorAll("[data-bal]").forEach(el => el.onclick = () => {
    vybranyBalicek = el.dataset.bal; renderAll();
  });

  /* koľko krytí vo vybranom balíčku je v odporúčanom pásme */
  let vPasme = 0, spolu = 0;
  [[ps => ps.smrt, o => v.suma],
   [ps => ps.tnu,  o => 3*o.prijem*12],
   [ps => ps.kch,  o => 1.5*o.prijem*12],
   [ps => ps.pnDenne, o => Math.round((1-CONFIG.zivot.nemocenskePodiel)*o.prijem/30)]
  ].forEach(([hod, min]) => {
    [[vyb.ps1, vyb.o1], [vyb.ps2, vyb.o2]].forEach(([ps, o]) => {
      if (!ps) return;
      spolu++;
      if (hod(ps) > 0 && hod(ps) >= min(o)*0.97) vPasme++;
    });
  });
  $("cenaPozn").innerHTML = `<span><b>Cena je odhad, nie ponuka poisťovne.</b> Vychádza z metodiky poistných súm,
    ktorú používame, a je nastavená tak, aby modelová rodina z nášho prezentéra vyšla na 130–150 € mesačne.
    Skutočnú cenu určuje poisťovňa podľa veku, zdravotného stavu a povolania.
    ${vPasme === spolu
      ? `V balíčku <b>${vyb.bal.nazov}</b> sú všetky krytia v odporúčanom pásme.`
      : `V balíčku <b>${vyb.bal.nazov}</b> je <b>${vPasme} z ${spolu}</b> krytí v odporúčanom pásme.`}</span>`;

  /* --- krytie detí --- */
  const dd = vyb.bal.deti;
  $("detipoistZ").textContent = dd && v.deti > 0
    ? `${v.deti} ${v.deti===1?"dieťa":v.deti<5?"deti":"detí"} · v balíčku ${vyb.bal.nazov}`
    : "v tomto balíčku nie je zahrnuté";
  $("detiKryt").innerHTML = !dd
    ? `<p class="sub">Balíček <b>${vyb.bal.nazov}</b> deti nekryje. Optimal a Maxi obsahujú tri riziká,
       ktoré u detí dávajú zmysel — trvalé následky úrazu, detské kritické choroby a denné odškodné.</p>`
    : v.deti === 0
      ? `<p class="sub">V prvej sekcii nie sú zadané žiadne deti. Ak nejaké sú, doplňte ich počet — krytie sa dopočíta.</p>`
      : `<p class="sub">U detí neriešime výpadok príjmu, ale <b>náklady a čas rodiča</b>. Pri vážnej diagnóze
         jeden z rodičov spravidla prestane pracovať — a to je skutočná strata, ktorú poistenie kryje.</p>
      <table class="kt"><thead><tr><th>Riziko</th><th>na každé dieťa</th></tr></thead><tbody>
        <tr><td>Trvalé následky úrazu<span>s progresiou</span></td><td>${eur(dd.tnu)}</td></tr>
        <tr><td>Detské kritické choroby<span>onkologické a vážne diagnózy</span></td><td>${eur(dd.kch)}</td></tr>
        <tr><td>Úraz a hospitalizácia<span>denné odškodné</span></td><td>${eur(dd.denne)} / deň</td></tr>
        <tr><td><b>Spolu za ${v.deti} ${v.deti===1?"dieťa":v.deti<5?"deti":"detí"}</b><span>zahrnuté v cene balíčka</span></td>
            <td><b>${eur(cenaDietata(vyb.bal)*v.deti*CONFIG.zivot.rezia)}</b> / mes.</td></tr>
      </tbody></table>
      <div class="flag" style="background:var(--ok-bg);color:#2F5C3D"><span>Denné odškodné pri hospitalizácii
        ${eur(dd.denne)} znamená pri dvojtýždňovom pobyte v nemocnici ${eur(dd.denne*14)} — presne na to,
        aby mohol rodič zostať s dieťaťom bez toho, aby riešil výpadok mzdy.</span></div>`;

  /* --- scenáre --- */
  const rocny1 = vyb.o1.prijem*12;
  const scen = [];
  scen.push({
    t:"Pri úmrtí",
    bez:`Rodine zostane hypotéka <b>${eur(v.suma)}</b> a príjem klesne o <b>${eur(vyb.o1.prijem)}</b> mesačne.`,
    s:`Poisťovňa vyplatí <b>${eur(vyb.ps1.smrt)}</b> — hypotéka je splatená${vyb.bal.rezervaDeti && v.deti>0 ? " a zostáva rezerva pre deti" : ""}.`
  });
  const ID = CONFIG.zivot.invalidnyDochodok;
  scen.push({
    t:"Pri invalidite nad 40 %",
    bez:`Priemerný invalidný dôchodok je <b>${eur(ID.do70)}</b> mesačne (pri invalidite nad 70 % ${eur(ID.nad70)}) —
         teda menej ako splátka ${eur(splatkaGlob)}, ktorá beží ďalej.`,
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

  return vyb;
}

/* ============================================================
   „ÚROKY NASPÄŤ" — koľko si mesačne sporiť, aby výnos z investície
   za dobu splácania pokryl všetky zaplatené úroky.
   FV = PMT × ((1+i)^n − 1) / i   →   PMT = FV × i / ((1+i)^n − 1)
   ============================================================ */
let rezimUroky = "suma";   // "suma" = celá nasporená suma kryje úroky, "vynos" = kryje ich samotný výnos

function renderUroky(ciel, mesiacov){
  const r = clamp(+$("iVynos").value || 8, 1, 12);
  const i = r/100/12, n = mesiacov;
  const faktor = i === 0 ? n : (Math.pow(1+i, n) - 1) / i;   // budúca hodnota 1 € mesačne
  // režim „suma":  PMT × faktor = ciel
  // režim „vynos": PMT × faktor − PMT × n = ciel   (výnos bez vlastných vkladov)
  const delitel = rezimUroky === "vynos" ? Math.max(faktor - n, 0.0001) : faktor;
  const ulozka  = n === 0 ? 0 : ciel / delitel;
  const vlozene = ulozka * n;
  const konecna = ulozka * faktor;
  const vynos   = Math.max(0, konecna - vlozene);

  $("rezimPopis").innerHTML = rezimUroky === "vynos"
    ? "Prísnejší variant: úroky pokryje <b>samotný výnos</b>, vaše vklady zostávajú navyše. Na konci máte viac, než ste zaplatili banke."
    : "Nasporená suma sa bude rovnať zaplateným úrokom — <b>vrátane vašich vkladov</b>.";
  $("lblCiel").textContent = rezimUroky === "vynos" ? "Nasporíte celkovo" : "Nasporíte";

  $("oDobaSpor").value = `${Math.floor(n/12)} rokov (rovnako ako hypotéka)`;
  $("oUlozka").textContent  = eur(ulozka);
  $("oVlozene").textContent = eur(vlozene);
  $("oCiel").textContent    = eur(konecna);

  const pV = konecna > 0 ? vlozene/konecna*100 : 0;
  $("pasikUroky").innerHTML = `
    <div class="p"><i style="width:${pV}%;background:var(--s1)"></i><i style="width:${100-pV}%;background:var(--s3)"></i></div>
    <div class="l">
      <span><i style="background:var(--s1)"></i>Vaše vklady <b>${eur(vlozene)}</b> (${Math.round(pV)} %)</span>
      <span><i style="background:var(--s3)"></i>Výnos z investície <b>${eur(vynos)}</b> (${Math.round(100-pV)} %)</span>
    </div>
    <div class="ftp" style="margin-top:8px">Zaplatené úroky: <b>${eur(ciel)}</b>${
      rezimUroky === "vynos" ? " — pokryté samotným výnosom, vklady " + eur(vlozene) + " vám zostávajú." : "."}</div>`;

  $("urokyPozn").innerHTML = `<span><b>${num(r)} % ročne je predpoklad, nie záruka.</b>
    Ide o dlhodobý priemer akciových trhov — jednotlivé roky môžu byť aj výrazne stratové a výsledok
    závisí od zvoleného riešenia. Prepočet neuvažuje poplatky ani infláciu. Pri investovaní cez ETF je
    výnos po ročnom teste držby oslobodený od dane, pri podielových fondoch sa zdaňuje 19 %.</span>`;
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
let earlyOn = false, splatkaGlob = 0;
let r4Dotknute = false;   // keď poradca prepíše rentu, prestaneme ju predvypĺňať

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
    flags.push(["ok", L.max - potreba < 1000
      ? `Rámec presne pokrýva potrebu <b>${eur(potreba)}</b> — bez rezervy navyše.`
      : `Rámec pokrýva potrebu <b>${eur(potreba)}</b> s rezervou <b>${eur(L.max-potreba)}</b>.`]);
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
  $("oSplatkaPodiel").textContent = v.prijem > 0
    ? `${Math.round(splatka/v.prijem*100)} % čistého príjmu domácnosti` : "";
  $("oUrokyPodiel").textContent = (v.suma + zaklad.urokCelkom) > 0
    ? `${Math.round(zaklad.urokCelkom/(v.suma+zaklad.urokCelkom)*100)} % zo všetkého, čo banke pošlete` : "";
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

  /* --- úroky naspäť --- */
  if ($("d-uroky").open) renderUroky(zaklad.urokCelkom, zaklad.mesiacov);

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

  /* --- 3. investície --- */
  if (obrazovka === "invest" || zaujem.invest) renderInvest(v);

  /* --- 5. dôchodok --- */
  let vybDoch = null;
  if (obrazovka === "doch" || zaujem.doch) vybDoch = renderDoch(v);

  /* --- odkazy v sekcii Auto --- */
  [["lnkPzp","pzp"],["lnkKasko","kasko"],["lnkGap","gap"],["lnkDom","dom"]].forEach(([id,k]) => {
    const a = $(id); if (!a) return;
    a.href = ODKAZY[k] || "#";
    a.classList.toggle("off", !ODKAZY[k]);
  });
  $("autoPozn").style.display = (ODKAZY.pzp || ODKAZY.kasko || ODKAZY.gap) ? "none" : "";

  /* --- 4. životné poistenie --- */
  let vybZivot = null;
  if (obrazovka === "zivot" || zaujem.zivot){
    $("iSkup1").innerHTML = $("iSkup2").innerHTML = CONFIG.zivot.skupiny
      .map(x => `<option value="${x.k}">${x.k}. skupina — ${x.popis}</option>`).join("");
    $("iSkup1").value = skupHodnota[1]; $("iSkup2").value = skupHodnota[2];
    document.querySelectorAll(".w2").forEach(el => el.classList.toggle("skryt", !v.dvaja));
    vybZivot = renderZivot(v);
    renderFakty();
  }

  /* --- 6/7 --- */
  if (earlyOn) zaujem.early = true;
  /* Pruh ukazuje len to, čo klient rieši — pribúda so zaškrtnutými oblasťami. */
  const V = CONFIG.vedierka.podielPrijmu;
  renderPruh([
    zaujem.hypo ? {k:"Hypotéka", v: eur(v.suma)} : null,
    zaujem.hypo ? {k:"Splátka",  v: eur(splatka), f:"a"} : null,
    zaujem.invest && v.prijem > 0
      ? {k:"Na investovanie", v: `${eur(v.prijem*V.min)} – ${eur(v.prijem*V.max)}`, f:"a"} : null,
    zaujem.zivot && vybZivot
      ? {k:"Poistné", v: `${vybZivot.bal.nazov} · ${Math.round(vybZivot.dolna/5)*5} – ${Math.round(vybZivot.horna/5)*5} €`} : null,
    zaujem.doch && vybDoch && vybDoch.cisty1 > 0
      ? {k:"Na dôchodku bude chýbať", v: eur(vybDoch.chyba), f:"b"} : null
  ]);
  poslZivot = vybZivot; poslDoch = vybDoch;
  renderMapa(v); renderKroky();
  renderZTlacidla(v); renderSum(v); renderDalsieKroky(); renderKand();
}

/* ============================================================
   ZHRNUTIE — čo sa dostane do podkladu pre klienta
   Zaradenie je výhradne explicitné: kalkulačka odovzdá snímku
   svojich vstupov, výsledok sa dopočíta až pri vykreslení zhrnutia.
   Stav prežije obnovenie stránky (sessionStorage), nie však
   zatvorenie karty — na disk sa nič neukladá.
   ============================================================ */
const TYPY = {
  ramec:    {n:"Úverový rámec",              p:1},
  hypo:     {n:"Modelovaná hypotéka",        p:2},
  early:    {n:"Predčasné splatenie",        p:3},
  uroky:    {n:"Úroky z hypotéky naspäť",    p:4},
  vedierka: {n:"Rozdelenie peňazí",          p:5},
  renta:    {n:"Renta k dôchodku",           p:6},
  deti:     {n:"Sporenie pre deti",          p:7,  viac:true},
  sen:      {n:"Vlastný cieľ",               p:8,  viac:true},
  doch:     {n:"Dôchodok",                   p:9},
  r4:       {n:"Vlastná renta (IV. pilier)", p:10},
  zivot:    {n:"Zabezpečenie rodiny",        p:11}
};
/* kandidáti — kalkulačky, ktoré sme počas stretnutia otvorili, ale neuložili */
const KANDIDATI = ["early","uroky","renta","deti","sen"];

let zhrnutie = [];          // [{k, typ, nazov, vst:{…}}]
const videne = new Set();
let krokyText = null;       // null = odvodiť zo zaškrtnutých oblastí
let zSeq = 1;
let poslZivot = null, poslDoch = null;

function zUloz(){
  try { sessionStorage.setItem("zhr2", JSON.stringify({z:zhrnutie, v:[...videne], k:krokyText, s:zSeq})); } catch(e){}
}
function zNacitaj(){
  try {
    const d = JSON.parse(sessionStorage.getItem("zhr2") || "null");
    if (!d) return;
    if (Array.isArray(d.z)) zhrnutie = d.z.filter(x => x && TYPY[x.typ] && x.vst);
    (d.v || []).forEach(x => videne.add(x));
    if (typeof d.k === "string") krokyText = d.k;
    zSeq = +d.s || zhrnutie.length + 1;
  } catch(e){}
}

/* ---- dá sa daná vec práve teraz uložiť? ---- */
function zMozne(typ, v){
  switch(typ){
    case "hypo":  return v.suma > 0;
    case "early": return v.suma > 0 && (v.extra > 0 || v.jedn > 0);
    case "uroky": return v.suma > 0;
    case "doch":
    case "r4":    return !!poslDoch;
    case "zivot": return !!poslZivot;
    default:      return true;
  }
}
function zDovod(typ){
  return {
    hypo:  "Najprv zadajte výšku hypotéky.",
    early: "Najprv nastavte mimoriadnu splátku.",
    uroky: "Najprv zadajte výšku hypotéky.",
    doch:  "Najprv vyplňte údaje o dôchodku.",
    r4:    "Najprv vyplňte údaje o dôchodku.",
    zivot: "Najprv vyberte balíček poistenia."
  }[typ] || "";
}

/* ---- snímka vstupov ---- */
function zZbier(typ, v){
  const c = (id, def, a, b) => clamp(+$(id).value || def, a, b);
  switch(typ){
    case "ramec": return {nazov:"Úverový rámec", vst:{
      dvaja:v.dvaja, deti:v.deti, prijem:v.prijem, spl:v.spl, zost:v.zost,
      hodn:v.hodn, vlast:v.vlast, ltv:v.ltv, sadz:v.sadz, roky:v.roky, vekVaz:v.vekVaz}};
    case "hypo": return {nazov:"Hypotéka " + eur(v.suma), vst:{suma:v.suma, sadz:v.sadz, roky:v.roky}};
    case "early": return {nazov:"Predčasné splatenie", vst:{
      suma:v.suma, sadz:v.sadz, roky:v.roky, extra:v.extra, jedn:v.jedn, kedy:v.kedy}};
    case "uroky": return {nazov:"Úroky z hypotéky naspäť", vst:{
      suma:v.suma, sadz:v.sadz, roky:v.roky, vynos:c("iVynos",8,1,12), rezim:rezimUroky}};
    case "vedierka": return {nazov:"Rozdelenie peňazí", vst:{
      vyd:Math.max(0, +$("iVyd").value || 0), prijem:v.prijem}};
    case "renta": return {nazov:"Renta k dôchodku", vst:{
      mes:Math.max(0, +$("iRenta").value || 0), roky:c("iRentaRoky",20,5,35),
      vyn:c("iRentaVynos",3,0,8), spor:c("iRentaSpor",8,0,12), vekVaz:v.vekVaz}};
    case "deti": {
      const meno = ($("iDetiMeno").value || "").trim();
      return {nazov: meno ? "Sporenie pre deti — " + meno : "Sporenie pre dieťa", vst:{
        vek:c("iDietaVek",0,0,25), ciel:c("iDietaCiel",20,15,30),
        suma:Math.max(0, +$("iDietaSuma").value || 0), vynos:c("iDetiVynos",8,0,12)}};
    }
    case "sen": return {nazov: ($("iSenNazov").value || "").trim() || "Vlastný cieľ", vst:{
      suma:Math.max(0, +$("iSenSuma").value || 0), roky:c("iSenRoky",10,1,40), vynos:c("iSenVynos",8,0,12)}};
    case "doch": {
      const d = poslDoch;
      return {nazov:"Dôchodok zo štátu a pilierov", vst:{
        p1:d.p1, p2:d.p2, p3:d.p3, spolu:d.spolu, cisty1:d.cisty1, chyba:d.chyba, rokovDo:d.rokovDo,
        hruba:Math.max(0, +$("iHruba").value || 0), odprac:c("iOdprac",0,0,50), maII:$("iMaII").value === "a"}};
    }
    case "r4": return {nazov:"Vlastná renta k dôchodku", vst:{
      mes:Math.max(0, +$("iR4").value || 0), roky:c("iR4Roky",20,5,35), vyn:c("iR4Vynos",3,0,8),
      spor:c("iR4Spor",8,0,12), kap:poslDoch.r4kap, ul:poslDoch.r4ul, rokovDo:poslDoch.rokovDo}};
    case "zivot": {
      const z = poslZivot, d = z.bal.deti;
      return {nazov:"Zabezpečenie rodiny — " + z.bal.nazov, vst:{
        bal:z.bal.nazov, dolna:z.dolna, horna:z.horna, pnOd:z.bal.pnOd, dvaja:!!z.o2, pocetDeti:v.deti,
        ps1:{smrt:z.ps1.smrt, tnu:z.ps1.tnu, kch:z.ps1.kch, pnDenne:z.ps1.pnDenne},
        ps2:z.ps2 ? {smrt:z.ps2.smrt, tnu:z.ps2.tnu, kch:z.ps2.kch, pnDenne:z.ps2.pnDenne} : null,
        det:d ? {tnu:d.tnu, kch:d.kch, denne:d.denne} : null}};
    }
  }
  return null;
}

function zPridaj(typ){
  const v = citajVstupy();
  if (!TYPY[typ] || !zMozne(typ, v)) return;
  const z = zZbier(typ, v);
  if (!z) return;
  const ex = TYPY[typ].viac
    ? zhrnutie.find(x => x.typ === typ && x.nazov === z.nazov)
    : zhrnutie.find(x => x.typ === typ);
  if (ex){ ex.nazov = z.nazov; ex.vst = z.vst; }
  else zhrnutie.push({k:"z" + (zSeq++), typ, nazov:z.nazov, vst:z.vst});
  videne.delete(typ);
  zUloz(); renderAll();
}
function zOdober(k){
  zhrnutie = zhrnutie.filter(x => x.k !== k);
  zUloz(); renderAll();
}

/* ---- text položky v zhrnutí: vstupy (čo sme zadali) + výsledok ---- */
const rokySlovo = r => r === 1 ? "rok" : (r >= 2 && r <= 4 ? "roky" : "rokov");

function zText(pol){
  const a = pol.vst;
  switch(pol.typ){
    case "ramec": {
      const L = limity(a, a.roky);
      const potreba = Math.max(0, a.hodn - a.vlast);
      return {
        in: `${a.dvaja ? "dvaja žiadatelia" : "jeden žiadateľ"}, ${a.deti} ${a.deti === 1 ? "dieťa" : (a.deti >= 2 && a.deti <= 4 ? "deti" : "detí")} · príjem ${eur(a.prijem)} mesačne` +
            (a.spl > 0 ? ` · existujúce splátky ${eur(a.spl)}` : "") +
            ` · nehnuteľnosť ${eur(a.hodn)}, vlastné zdroje ${eur(a.vlast)}`,
        out: `Rámec približne <b>${eur(Math.floor(L.max/1000)*1000)}</b>, rozhoduje limit ${L.bind}. ` +
             `Potreba financovania ${eur(potreba)}` +
             (L.max >= potreba ? `, rámec ju pokrýva.` : `, chýba ${eur(potreba - L.max)}.`)
      };
    }
    case "hypo": {
      const spl = anuita(a.suma, a.sadz, a.roky*12);
      const z = amortizacia(a.suma, a.sadz, a.roky*12, spl);
      return {
        in: `${eur(a.suma)} · ${a.roky} ${rokySlovo(a.roky)} · ${num(a.sadz)} % p. a.`,
        out: `Splátka <b>${eur(spl)}</b> · úroky spolu ${eur(z.urokCelkom)} · banke zaplatíte ${eur(a.suma + z.urokCelkom)}.`
      };
    }
    case "early": {
      const spl = anuita(a.suma, a.sadz, a.roky*12);
      const zak = amortizacia(a.suma, a.sadz, a.roky*12, spl);
      const por = amortizacia(a.suma, a.sadz, a.roky*12, spl, a.extra, a.jedn, Math.round(a.kedy*12));
      const skor = zak.mesiacov - por.mesiacov;
      const cast = [];
      if (a.extra > 0) cast.push(`${eur(a.extra)} mesačne navyše`);
      if (a.jedn > 0)  cast.push(`jednorazovo ${eur(a.jedn)} v ${a.kedy}. roku`);
      return {
        in: cast.join(" · "),
        out: `Úspora na úrokoch <b>${eur(Math.max(0, zak.urokCelkom - por.urokCelkom))}</b> · ` +
             `splatené skôr o ${Math.floor(skor/12)} r. ${skor%12} mes. ` +
             `(za ${Math.floor(por.mesiacov/12)} r. ${por.mesiacov%12} mes. namiesto ${a.roky} rokov).`
      };
    }
    case "uroky": {
      const spl = anuita(a.suma, a.sadz, a.roky*12);
      const z = amortizacia(a.suma, a.sadz, a.roky*12, spl);
      const i = a.vynos/100/12, n = z.mesiacov;
      const f = i === 0 ? n : (Math.pow(1+i, n) - 1)/i;
      const del = a.rezim === "vynos" ? Math.max(f - n, 0.0001) : f;
      const ul = n === 0 ? 0 : z.urokCelkom/del;
      return {
        in: `zaplatené úroky ${eur(z.urokCelkom)} · zhodnotenie ${num(a.vynos)} % p. a. · ${Math.floor(n/12)} ${rokySlovo(Math.floor(n/12))} · ` +
            (a.rezim === "vynos" ? "úroky pokryje samotný výnos" : "úroky pokryje nasporená suma"),
        out: `Odkladať <b>${eur(ul)}</b> mesačne · vložíte ${eur(ul*n)} · nasporíte ${eur(ul*f)}` +
             (a.rezim === "vynos" ? `, z toho výnos ${eur(Math.max(0, ul*f - ul*n))} pokryje zaplatené úroky.` : ".")
      };
    }
    case "vedierka": {
      const V = CONFIG.vedierka.podielPrijmu;
      return {
        in: `mesačné výdavky ${eur(a.vyd)} · čistý príjem ${eur(a.prijem)}`,
        out: `Rezerva <b>${eur(a.vyd*3)} – ${eur(a.vyd*6)}</b> (3 až 6 mesačných výdavkov) · ` +
             `na dlhodobý cieľ <b>${eur(a.prijem*V.min)} – ${eur(a.prijem*V.max)}</b> mesačne.`
      };
    }
    case "renta": {
      const kap = kapitalNaRentu(a.mes, a.vyn, a.roky*12);
      const doD = Math.max(1, Math.round(65 - a.vekVaz));
      const ul  = ulozkaNaCiel(kap, a.spor, doD*12);
      return {
        in: `${eur(a.mes)} mesačne počas ${a.roky} ${rokySlovo(a.roky)} · sporenie ${num(a.spor)} % · výplata ${num(a.vyn)} % p. a.`,
        out: `Treba nasporiť <b>${eur(kap)}</b> · odkladať <b>${eur(ul)}</b> mesačne počas ${doD} ${rokySlovo(doD)}.`
      };
    }
    case "deti": {
      const roky = Math.max(1, a.ciel - a.vek);
      const ul = ulozkaNaCiel(a.suma, a.vynos, roky*12);
      const vklad = ul*roky*12;
      return {
        in: `${eur(a.suma)} vo veku ${a.ciel} (dnes ${a.vek} ${rokySlovo(a.vek)}) · ${num(a.vynos)} % p. a.`,
        out: `Odkladať <b>${eur(ul)}</b> mesačne počas ${roky} ${rokySlovo(roky)} · vaše vklady ${eur(vklad)}, ` +
             `výnos pridá ${eur(Math.max(0, a.suma - vklad))}.`
      };
    }
    case "sen": {
      const ul = ulozkaNaCiel(a.suma, a.vynos, a.roky*12);
      const vklad = ul*a.roky*12;
      return {
        in: `${eur(a.suma)} o ${a.roky} ${rokySlovo(a.roky)} · ${num(a.vynos)} % p. a.`,
        out: `Odkladať <b>${eur(ul)}</b> mesačne · vaše vklady ${eur(vklad)}, výnos pridá ${eur(Math.max(0, a.suma - vklad))}.`
      };
    }
    case "doch": return {
      in: `hrubá mzda ${eur(a.hruba)} · ${a.odprac} odpracovaných ${rokySlovo(a.odprac)} · II. pilier ${a.maII ? "áno" : "nie"} · do dôchodku ${Math.round(a.rokovDo)} ${rokySlovo(Math.round(a.rokovDo))}`,
      out: `Odhad <b>${eur(a.spolu)}</b> mesačne (I. pilier ${eur(a.p1)}${a.p2 > 0 ? ", II. pilier " + eur(a.p2) : ""}, III. pilier ${eur(a.p3)}) — ` +
           `${a.cisty1 > 0 ? Math.round(a.spolu/a.cisty1*100) : 0} % dnešného čistého príjmu ${eur(a.cisty1)}. ` +
           `Chýbať bude približne <b>${eur(a.chyba)}</b> mesačne.`
    };
    case "r4": return {
      in: `renta ${eur(a.mes)} mesačne počas ${a.roky} ${rokySlovo(a.roky)} · sporenie ${num(a.spor)} % · výplata ${num(a.vyn)} % p. a.`,
      out: `Nasporiť <b>${eur(a.kap)}</b> · odkladať <b>${eur(a.ul)}</b> mesačne počas ${Math.round(a.rokovDo)} ${rokySlovo(Math.round(a.rokovDo))}. ` +
           `Sumy sú v dnešných eurách.`
    };
    case "zivot": {
      const dv = x => a.ps2 ? `${eur(a.ps1[x])} / ${eur(a.ps2[x])}` : eur(a.ps1[x]);
      let t = `Odhad <b>${Math.round(a.dolna/5)*5} – ${Math.round(a.horna/5)*5} €</b> mesačne za celú rodinu. ` +
              `Smrť a invalidita ${dv("smrt")} · trvalé následky úrazu ${dv("tnu")} · kritické choroby ${dv("kch")}`;
      if (a.ps1.pnDenne) t += ` · PN od ${a.pnOd}. dňa ${a.ps2 ? eur(a.ps1.pnDenne) + " / " + eur(a.ps2.pnDenne) : eur(a.ps1.pnDenne)} denne`;
      if (a.det && a.pocetDeti > 0) t += `. Deti — úraz ${eur(a.det.tnu)}, kritické choroby ${eur(a.det.kch)}, ${eur(a.det.denne)} denne`;
      return {
        in: `balíček ${a.bal} · ${a.dvaja ? "dvaja dospelí" : "jeden dospelý"}${a.pocetDeti > 0 ? ", " + a.pocetDeti + " " + (a.pocetDeti === 1 ? "dieťa" : (a.pocetDeti <= 4 ? "deti" : "detí")) : ""}`,
        out: t + "."
      };
    }
  }
  return null;
}

/* ---- tlačidlá pri kalkulačkách ---- */
const IKONA_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const IKONA_OK   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';

function renderZTlacidla(v){
  document.querySelectorAll(".zrad").forEach(el => {
    const typ = el.dataset.z, t = TYPY[typ];
    if (!t) return;
    const moje = zhrnutie.filter(x => x.typ === typ);
    const ok = zMozne(typ, v);
    const lbl = moje.length ? (t.viac ? "Uložiť ďalšiu variantu" : "Aktualizovať v zhrnutí") : "Uložiť do zhrnutia";
    el.innerHTML =
      `<button type="button" class="zbtn ${moje.length ? "on" : ""}" data-zadd="${typ}" ${ok ? "" : "disabled"}
         title="${ok ? "" : zDovod(typ)}">${moje.length ? IKONA_OK : IKONA_PLUS}${lbl}</button>` +
      `<span class="zchips">${moje.map(x =>
        `<span class="zchip">${x.nazov}<button type="button" data-zdel="${x.k}" aria-label="Odobrať zo zhrnutia" title="Odobrať zo zhrnutia">✕</button></span>`).join("")}</span>`;
  });
}

/* ---- dohodnuté ďalšie kroky ---- */
function autoKroky(){
  return OBLASTI.filter(o => zaujem[o.id]).map(o => o.krok).join("\n");
}
function renderDalsieKroky(){
  const t = krokyText === null ? autoKroky() : krokyText;
  if (document.activeElement !== $("iKroky")) $("iKroky").value = t;
  const riadky = t.split("\n").map(x => x.trim()).filter(Boolean);
  $("sumKroky").innerHTML = riadky.length
    ? `<div class="zsek"><h3>Dohodnuté ďalšie kroky</h3><ul class="zkroky">${riadky.map(x => `<li>${markUp(x)}</li>`).join("")}</ul></div>`
    : `<div class="zsek noprint"><h3>Dohodnuté ďalšie kroky</h3><p class="zprazdne">Zatiaľ žiadne — zaškrtnite oblasti v mape alebo si kroky napíšte nižšie.</p></div>`;
}
/* jednoduché escapovanie — do zoznamu ide text od poradcu, nie HTML */
function markUp(x){
  return x.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* kalkulačku sme otvorili — ak ju neuložíme, ponúkne sa na konci zhrnutia */
function zVidene(typ){
  const d = $({early:"d-early", uroky:"d-uroky", renta:"d-renta", deti:"d-deti", sen:"d-sen"}[typ]);
  if (d && d.open){ videne.add(typ); zUloz(); }
}

/* ---- kandidáti: čo sme otvorili, ale neuložili ---- */
function renderKand(){
  const zoz = KANDIDATI.filter(t => videne.has(t) && !zhrnutie.some(x => x.typ === t));
  $("sumKand").innerHTML = zoz.length
    ? `<span>Prešli sme aj:</span>` + zoz.map(t =>
        `<button type="button" class="zchip" data-zadd="${t}">${TYPY[t].n} +</button>`).join("")
    : "";
}

function renderSum(v){
  const klient = ($("iKlient").value || "").trim();
  const datum  = ($("iDatum").value || "").trim();
  const k = poradca.kontakt || {};
  const kont = [k.tel, k.email, k.web].filter(Boolean).join(" · ");

  let h = `<div class="pdfhd">${markHTML(poradca,"mk")}
      ${poradca.logoPomer ? "" : `<div class="pdfme"><b>${poradca.meno}</b><span>${poradca.rola}</span></div>`}
      <div class="pdfkl"><b>${klient || "Klient"}</b><span>${datum}</span></div>
    </div>`;

  h += `<div class="zsek"><h3>Východiská</h3><p>${v.dvaja ? "Dvaja žiadatelia" : "Jeden žiadateľ"},
      ${v.deti} ${v.deti === 1 ? "dieťa" : (v.deti >= 2 && v.deti <= 4 ? "deti" : "detí")},
      čistý príjem domácnosti <b>${eur(v.prijem)}</b> mesačne.</p></div>`;

  const polozky = zhrnutie.slice().sort((a,b) => TYPY[a.typ].p - TYPY[b.typ].p);
  h += `<div class="zsek"><h3>Čo sme prepočítali</h3>`;
  if (polozky.length){
    h += polozky.map(pol => {
      const t = zText(pol);
      if (!t) return "";
      return `<div class="zpol"><h4>${markUp(pol.nazov)}</h4>
        <div class="zin">${t.in}</div><div class="zout">${t.out}</div></div>`;
    }).join("");
  } else {
    h += `<p class="zprazdne">Zatiaľ nič. Pri každej kalkulačke je tlačidlo „Uložiť do zhrnutia“ —
      do podkladu pre klienta ide len to, čo ním označíte.</p>`;
  }
  h += `</div>`;
  $("sumBox").innerHTML = h;

  $("sumFoot").innerHTML = `<div class="sumfoot">${markHTML(poradca,"mk")}
    <span><b>${poradca.meno}</b>, ${poradca.rola}${kont ? " · " + kont : ""}</span></div>`;
}

const skupHodnota = {1:1, 2:1};

/* ============================================================
   PREPÍNAČ PORADCU
   ============================================================ */
function markHTML(p, cls){
  if (!p.logo)
    return `<span class="${cls}" style="background:${p.farby.logoBg};color:${p.farby.logoInk}">${p.monogram}</span>`;
  /* logoPomer = šírka/výška loga. Ak je nastavený, ide o široký značkový lockup:
     nevojde sa do kruhu, dostane preto podlhovastý svetlý štítok. */
  const sir = p.logoPomer
    ? ` sirok" style="aspect-ratio:${p.logoPomer + 0.45}` : "";
  return `<span class="${cls} img${sir}"><img src="${p.logo}" alt="${p.meno}"></span>`;
}

/* Premenné, ktoré smie poradca/značka prefarbiť. Čo nie je v jeho zázname,
   sa pri prepnutí vráti na predvolenú hodnotu z :root — inak by po prepnutí
   ostali visieť farby predchádzajúcej značky. */
const PREFARBITELNE = ["--s1","--s2","--s3","--s4","--s5","--s6","--prim","--prim-tm",
  "--good","--good-ink","--ok-bg","--warn","--warn-bg",
  "--page","--card","--surface-1","--grid","--axis","--border",
  "--ink","--ink-2","--muted","--muted-2",
  "--nav","--nav-ink","--nav-muted","--nav-line","--nav-hover","--nav-box","--nav-border"];
function renderPoradca(){
  const R = document.documentElement.style;
  R.setProperty("--logo-bg", poradca.farby.logoBg);
  R.setProperty("--logo-ink", poradca.farby.logoInk);
  const schema = poradca.farby.schema || {};
  if (poradca.farby.akcent && !schema["--s1"]) schema["--s1"] = poradca.farby.akcent;
  PREFARBITELNE.forEach(v => schema[v] ? R.setProperty(v, schema[v]) : R.removeProperty(v));

  /* pri značkovom logu je názov už v obrázku — netreba ho písať druhýkrát */
  $("logoBox").className = "logo" + (poradca.logoPomer ? " zn" : "");
  $("logoBox").innerHTML = markHTML(poradca, "mark") +
    `<span class="nm"><b>${poradca.meno}</b><small>${poradca.rola}</small></span>`;

  const popis = PORADCOVIA.length > 1 ? "Prepnúť poradcu alebo značku" : "Poradca";
  $("whoBtn").title = popis; $("whoBtn").setAttribute("aria-label", popis);
  $("whoBtn").innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;

  $("whoMenu").innerHTML = `<div class="hd">Prihlásený poradca</div>` +
    PORADCOVIA.map(p => `<button type="button" role="menuitem" data-id="${p.id}" class="${p.id===poradca.id?'sel':''}">
        ${markHTML(p, p.logoPomer ? "mk sirokmenu" : "mk")}<span>${p.meno}</span></button>`).join("") +
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
  document.addEventListener("click", e => {
    if (!$("whoMenu").contains(e.target) && e.target !== $("whoBtn")) zavriMenu();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") zavriMenu(); });
  try { const ulozeny = PORADCOVIA.find(p => p.id === localStorage.getItem("poradcaId")); if (ulozeny) poradca = ulozeny; } catch(e){}
  renderPoradca();
  ["iPohl1","iPohl2","iFajc1","iFajc2"].forEach(id => $(id).addEventListener("change", renderAll));
  $("iSkup1").addEventListener("change", e => { skupHodnota[1] = +e.target.value; renderAll(); });
  $("iSkup2").addEventListener("change", e => { skupHodnota[2] = +e.target.value; renderAll(); });
  $("d-early").addEventListener("toggle", () => { earlyOn = $("d-early").open; zVidene("early"); renderAll(); });
  $("d-uroky").addEventListener("toggle", () => { zVidene("uroky"); renderAll(); });
  [["d-renta","renta"],["d-deti","deti"],["d-sen","sen"]].forEach(([id,typ]) =>
    $(id).addEventListener("toggle", () => { zVidene(typ); renderAll(); }));
  ["iRentaRoky","iRentaVynos","iDietaVek","iDietaCiel","iDetiVynos","iSenNazov","iSenRoky","iSenVynos"]
    .forEach(id => $(id).addEventListener("input", renderAll));
  $("iVyd").addEventListener("input", renderAll);
  ["iHruba","iOdprac","iMaII","iRokII","iStavII","iStavIII","iPrispIII"]
    .forEach(id => $(id).addEventListener("input", renderAll));
  $("iMaII").addEventListener("change", renderAll);
  $("d-dochdet").addEventListener("toggle", renderAll);
  ["iR4","rR4"].forEach(id => $(id).addEventListener("input", () => { r4Dotknute = true; }));
  pair("iR4","rR4"); pair("iR4Spor","rR4Spor");
  ["iR4Roky","iR4Vynos"].forEach(id => $(id).addEventListener("input", renderAll));
  $("d-detipoist").addEventListener("toggle", renderAll);
  pair("iRenta","rRenta"); pair("iDietaSuma","rDietaSuma"); pair("iRentaSpor","rRentaSpor");
  ["d-graf1","d-graf2"].forEach(id => $(id).addEventListener("toggle", renderAll));
  pair("iVynos","rVynos");
  document.querySelectorAll("[data-rezim]").forEach(b => b.onclick = () => {
    rezimUroky = b.dataset.rezim;
    document.querySelectorAll("[data-rezim]").forEach(x => x.classList.toggle("on", x === b));
    renderAll();
  });
  ["btnPrintNav","btnPrintSum"].forEach(id => $(id).addEventListener("click", () => {
    if (obrazovka !== "sum") prepniObrazovku("sum");
    window.print();
  }));
  $("btnSum").addEventListener("click", () => prepniObrazovku("sum"));
  ["iKlient","iDatum"].forEach(id => $(id).addEventListener("input", renderAll));
  /* uloženie do zhrnutia — delegovane, aby v HTML nezostal žiadny inline handler */
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("[data-zadd]");
    if (a){ e.preventDefault(); zPridaj(a.dataset.zadd); return; }
    const d = e.target.closest && e.target.closest("[data-zdel]");
    if (d){ e.preventDefault(); zOdober(d.dataset.zdel); }
  });
  $("iKroky").addEventListener("input", e => { krokyText = e.target.value; zUloz(); renderDalsieKroky(); });
  $("btnKrokyAuto").addEventListener("click", () => { krokyText = null; zUloz(); renderDalsieKroky(); });
  zNacitaj();
  $("iDatum").value = new Date().toLocaleDateString("sk-SK", {day:"numeric", month:"numeric", year:"numeric"});
  window.addEventListener("hashchange", () => prepniObrazovku(location.hash.slice(1), true));
  prepniObrazovku(location.hash.slice(1) || "mapa", true);
  renderAll();
});
