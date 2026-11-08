// Builds the static pages of the Meder & Tal website from one layout.
// Run: node src/build.mjs   (writes *.html into the site folder)
// Design: taste-skill kit (assets/), deal: palette paper-grey-brass, type hanken, nav-centre,
// footer-dark, close-type, rhythm dark-band, buttons solid, mark arc.
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const privacy = JSON.parse(readFileSync(join(root, "src/privacy.json"), "utf8"));

const firm = {
  email: "info@medertal.com",
  phone: "+49 151 423 25468",
  tel: "tel:+4915142325468",
  street: "Via Corsica 15",
  city: "16128 Genua, Italien",
};

const people = [
  { id: "meder", name: "Dr. Manuel Meder", role: "Rechtsanwalt, Gründer und Geschäftsführer", phone: "+49 151 423 25468", tel: "tel:+4915142325468", email: "m.meder@medertal.com", linkedin: "https://www.linkedin.com/in/dr-manuel-meder-288b5155/" },
  { id: "tal", name: "Dr. Michael Tal", role: "Rechtsanwalt, Gründer und Geschäftsführer", phone: "+49 151 405 27585", tel: "tel:+4915140527585", email: "m.tal@medertal.com", linkedin: "https://www.linkedin.com/in/dr-michael-tal-340b5355/" },
];

const nav = [
  ["index.html", "Home"],
  ["ueber-uns.html", "Über uns"],
  ["kompetenzen.html", "Kompetenzen"],
  ["team.html", "Team"],
  ["kontakt.html", "Kontakt"],
];

const arrow = `<svg class="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path class="m-arrow__stem" d="M1 6h8"/><path class="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5"/></svg>`;
const chev = `<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const logo = `<span class="mark" data-mark="arc" aria-hidden="true"></span>Meder &amp; Tal`;
const cta = "Erstgespräch vereinbaren";

function head({ title, description, moments = [], preload = "" }) {
  const mo = moments.length
    ? `<script>document.documentElement.classList.add('mo-js');setTimeout(()=>document.documentElement.classList.add('mo-safe'),2500)</script>
<link rel="modulepreload" href="assets/moments/moments.js"><link rel="modulepreload" href="assets/moments/lib.js">
${moments.map((m) => `<link rel="modulepreload" href="assets/moments/${m}/moment.js">`).join("")}`
    : "";
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="share.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#e8e8e3">
<!-- <link rel="canonical" href="https://www.medertal.com/"> once the new site is live on the domain -->
<meta name="site-kind" content="other">
<meta name="page-type" content="service">
<link rel="preload" href="assets/fonts/hanken-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
${preload}
<link rel="stylesheet" href="assets/fonts/fonts.css">
<link rel="stylesheet" href="assets/system.css">
<link rel="stylesheet" href="assets/ui/cards.css">
<link rel="stylesheet" href="assets/motion/motion.css">
<link rel="stylesheet" href="assets/layout/layout.css">
<style>
:root {
  --p-bg: #e8e8e3; --p-surface: #dcdcd6; --p-ink: #181715; --p-muted: #5c5b56;
  --p-accent: #bfb21a; --p-accent-ink: #181715; --p-action: #181715; --p-action-ink: #e8e8e3;
  --p-inv-bg: #181715; --p-inv-surface: #242321; --p-inv-ink: #e8e8e3; --p-inv-muted: #91908d;
  --p-inv-accent: #bfb21a; --p-inv-accent-ink: #181715; --p-inv-action: #bfb21a; --p-inv-action-ink: #181715;
  --font-display: "Hanken Grotesk", system-ui, sans-serif;
  --font-text: "Hanken Grotesk", system-ui, sans-serif;
  --display-weight: 400;
  --display-tracking: -0.03em;
  --display-tracking-xl: -0.038em;
}
</style>
<link rel="stylesheet" href="assets/site.css">
<script>if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('mt-pre');setTimeout(()=>document.documentElement.classList.remove('mt-pre'),3500)}</script>
<script>document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700)</script>
${mo}
</head>`;
}

function header(current) {
  const link = ([href, label]) => {
    const cur = href === current ? ' aria-current="page"' : "";
    if (href === "kompetenzen.html") {
      return `<div class="nav__item">
        <a class="nav__link" href="${href}"${cur}>${label} ${chev}</a>
        <div class="nav__menu">
          <div class="wrap grid">
            <div class="menu-col span-4">
              <p class="t-label">Rechtsgebiete</p>
              <a href="kompetenzen.html#gebiete">Gesellschaftsrecht<span>Gründung, Satzung, Gesellschafter</span></a>
              <a href="kompetenzen.html#gebiete">Unternehmensfinanzierung<span>Finanzierungsrunden und Verkauf</span></a>
              <a href="kompetenzen.html#gebiete">Verträge und Datenschutz<span>Vom Kundenvertrag bis zur DSGVO</span></a>
            </div>
            <div class="menu-col span-4">
              <p class="t-label">Für Gründer</p>
              <a href="kompetenzen.html#phasen">Von der Gründung bis zum Exit<span>Sechs Phasen, ein Ansprechpartner</span></a>
              <a href="kompetenzen.html#kosten">Festpreis oder Stundensatz<span>Volle Kostenkontrolle</span></a>
            </div>
            <a class="menu-card span-3 start-10" href="kompetenzen.html#kosten">
              <div class="panel"><img class="frame__img" src="assets/img/stein.webp" alt="Ein dunkler Stein auf hellem Grund" loading="lazy"></div>
              <span class="t-card">Festpreis für jedes Mandat</span>
              <span class="t-small muted">Keine Überraschungen bei den Kosten</span>
            </a>
          </div>
        </div>
      </div>`;
    }
    return `<div class="nav__item"><a class="nav__link" href="${href}"${cur}>${label}</a></div>`;
  };
  return `<header class="nav nav--centre">
  <div class="wrap nav__bar">
    <a class="skip-link" href="#top">Zum Inhalt springen</a>
    <a class="nav__logo" href="index.html">${logo}</a>
    <nav class="nav__links" aria-label="Hauptmenü">
      ${nav.map(link).join("\n      ")}
    </nav>
    <div class="nav__actions">
      <a class="btn btn--primary" href="kontakt.html#anfrage">${cta}</a>
    </div>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-label="Menü"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
  </div>
</header>`;
}

function footer({ closeTitle = cta, closeLine = "Schreib uns, worum es geht. Für jedes Mandat bekommst Du vorab einen Festpreis.", closeHref = "kontakt.html#anfrage", closeLabel = cta } = {}) {
  return `<footer class="footer closing footer--dark ground-inverse g2" id="kontakt" aria-labelledby="close-h">
  <div class="wrap">
    <div class="closing__cta close--type">
      <div class="section-head">
        <h2 id="close-h">${closeTitle}</h2>
        <p>${closeLine}</p>
      </div>
      <a class="btn btn--primary btn--xl btn--wide" href="${closeHref}">${closeLabel}${arrow}</a>
    </div>
    <div class="closing__links">
      <div class="grid">
        <div class="span-4 stack-4">
          <a class="nav__logo" href="index.html">${logo}</a>
          <p class="footer__lede">Rechtsberatung für Unternehmer, von Unternehmern. Von der Gründung bis zum Exit.</p>
        </div>
        <div class="span-2 start-6 footer__col"><h3>Kanzlei</h3><ul><li><a href="ueber-uns.html">Über uns</a></li><li><a href="team.html">Team</a></li><li><a href="kompetenzen.html">Kompetenzen</a></li></ul></div>
        <div class="span-3 footer__col"><h3>Kontakt</h3><ul><li><a href="mailto:${firm.email}">${firm.email}</a></li><li><a href="${firm.tel}">${firm.phone}</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Adresse</h3><ul><li>${firm.street}</li><li>${firm.city}</li></ul></div>
      </div>
      <p class="footer__giant" aria-hidden="true">Meder &amp; Tal</p>
      <div class="footer__legal">
        <span>&copy; 2026 Meder &amp; Tal &nbsp; <a href="impressum.html">Impressum</a> &nbsp; <a href="datenschutz.html">Datenschutz</a></span>
        <details class="credits"><summary>Fotos der Städte: DXR, Francesco Ungaro, Coolcaesar, Tilman2007 und Bbruno, via Wikimedia Commons</summary><p>Frankfurt am Main von DXR (<a href="https://commons.wikimedia.org/wiki/File:Frankfurt_am_Main_Skyline_from_Ignatz_Bubis_Bridge.jpg">Quelle</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>); Mailand von Francesco Ungaro (<a href="https://commons.wikimedia.org/wiki/File:Milan_skyline_skyscrapers_of_Porta_Nuova_business_district.jpg">Quelle</a>, CC0); Berkeley von Coolcaesar (<a href="https://commons.wikimedia.org/wiki/File:Sather_Tower_from_Memorial_Glade.jpg">Quelle</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>); Oxford von Tilman2007 (<a href="https://commons.wikimedia.org/wiki/File:1099146_I_RADCLIFFE_CAMERA_Oxford_20250617_0012.jpg">Quelle</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>); Genua von Bbruno (<a href="https://commons.wikimedia.org/wiki/File:Genova_Carignano.jpg">Quelle</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>). Zugeschnitten und verkleinert.</p></details>
      </div>
    </div>
  </div>
</footer>`;
}

const scripts = `<script type="module" src="assets/system.js"></script>
<script type="module" src="assets/motion/motion.js"></script>
<script type="module" src="assets/layout/layout.js"></script>
<script type="module" src="assets/site.js"></script>
<script src="assets/vendor/gsap.min.js" defer></script>
<script src="assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="assets/vendor/SplitText.min.js" defer></script>
<script src="assets/motion-wow.js" defer></script>`;

function page({ file, title, description, moments, body, foot, deal, preload }) {
  const html = `<!doctype html>
<html lang="de" data-type="service" data-radius="soft" data-buttons="solid" data-motion>
${head({ title, description, moments, preload })}
<body class="page-${file.replace('.html', '')}">
<div class="curtain" data-curtain hidden aria-hidden="true"><span class="curtain__bar curtain__bar--top" data-curtain-bar="top"></span><span class="curtain__bar curtain__bar--bottom" data-curtain-bar="bottom"></span><span class="curtain__card" data-curtain-card></span></div>
<script>try{if(sessionStorage.getItem('mt-cut')){document.documentElement.classList.add('is-cut');document.querySelector('[data-curtain]').hidden=false}}catch(e){}</script>
<!-- type: service (law firm)
     deal: ${deal}
     moments: ${moments.join(", ") || "none"} -->
${header(file)}

<main id="top">
${body}
</main>

${footer(foot)}
<nav class="actionbar" aria-label="Schnellzugriff">
  <a class="btn btn--primary" href="kontakt.html#anfrage">${cta}</a>
</nav>
${scripts}
</body>
</html>
`;
  writeFileSync(join(root, file), html);
}

/* ------------------------------------------------------------------ Home */
page({
  file: "index.html",
  title: "Meder &amp; Tal: Rechtsberatung für Gründer und Wachstumsunternehmen",
  description: "Zwei Anwälte, die selbst ein Software-Startup gegründet und verkauft haben, beraten Wachstumsunternehmen im Gesellschafts-, Finanzierungs-, Vertrags- und Datenschutzrecht. Festpreis für jedes Mandat.",
  moments: ["word-highlight", "picture-develops"],
  deal: "hero film, nav-centre, close-type, footer-dark, rhythm dark-band, buttons solid, mark arc; palette paper-grey-brass, type hanken",
  preload: `<link rel="preload" as="image" href="media/brandung-poster.webp">`,
  body: `  <!-- HERO: the firm's own film full screen (MotionSites "cinematic video hero": background video,
       edge-blend scrim, liquid glass, blur-rise, serif accent). The letterbox opens on load. -->
  <section class="hero-cine" data-hero-cine aria-labelledby="hero-h">
    <div class="hero-cine__plate">
      <video class="film" muted loop playsinline preload="auto" poster="media/brandung-poster.webp" aria-hidden="true" data-film-video>
        <source src="media/brandung.webm" type="video/webm">
        <source src="media/brandung.mp4" type="video/mp4">
      </video>
    </div>
    <div class="wrap hero-cine__content">
      <p class="liquid-glass hero-cine__badge"><span>Festpreis</span>für jedes Mandat, von der Gründung bis zum Exit</p>
      <h1 id="hero-h">Rechtsberatung für Unternehmer, <em>von Unternehmern.</em></h1>
      <p class="hero-cine__lead">Wir haben 2012 selbst ein Software-Startup gegründet, international aufgebaut und an einen US-Wettbewerber verkauft. Heute beraten wir Gründer.</p>
      <div class="hero-cine__actions">
        <a class="btn-white" href="kontakt.html#anfrage" data-cut="Kontakt">${cta}${arrow}</a>
        <a class="btn-glass liquid-glass" href="ueber-uns.html" data-cut="Über uns">Unsere Geschichte</a>
      </div>
    </div>
    <div class="wrap hero-cine__foot">
      <span class="hero-cine__cue" aria-hidden="true">Scrollen</span>
      <button class="film-toggle liquid-glass" type="button" data-film-toggle aria-pressed="false">
        <span class="film-toggle__disc" aria-hidden="true">
          <svg class="i-pause" viewBox="0 0 18 18"><path d="M5 3h2.6v12H5zM10.4 3H13v12h-2.6z" fill="currentColor"/></svg>
          <svg class="i-play" viewBox="0 0 18 18"><path d="M4.5 2.6v12.8c0 .8.9 1.3 1.6.9l10.3-6.4c.6-.4.6-1.3 0-1.7L6.1 1.7c-.7-.4-1.6.1-1.6.9Z" fill="currentColor"/></svg>
        </span>
        <span class="film-toggle__label"><span data-film-label>Film anhalten</span><small>Die Brandung, ohne Ton</small></span>
      </button>
    </div>
  </section>

  <!-- word-highlight: the firm's own sentence, word by word -->
  <section class="section statement" id="ansatz" data-moment="word-highlight" aria-label="Unser Ansatz">
    <div class="wrap">
      <p class="t-label">Unser Ansatz</p>
      <p class="mo-wh__text">Wir sind Dein Ansprechpartner für alle rechtlichen und taktischen Fragen, die in einem Wachstumsunternehmen auftreten, von der Gründung bis zum <strong>Exit</strong>.</p>
    </div>
  </section>

  <section class="section" id="gebiete" aria-labelledby="gebiete-h">
    <div class="wrap grid grid--top">
      <div class="span-6">
        <div class="section-head">
          <h2 id="gebiete-h">Drei Rechtsgebiete. <span class="muted">Jedes davon haben wir selbst als Gründer erlebt.</span></h2>
        </div>
        <ul class="rows area-rows">
          <li><span class="rows__name">Unternehmens- und Gesellschaftsrecht<small>Gründung, Shareholder-Agreements, (virtuelle) Beteiligungsprogramme</small></span></li>
          <li><span class="rows__name">Recht der Unternehmensfinanzierung<small>Finanzierungsrunden und der Verkauf des Unternehmens</small></span></li>
          <li><span class="rows__name">Vertrags- und Datenschutzrecht<small>Verträge für das Tagesgeschäft, Fragen zur DSGVO</small></span></li>
        </ul>
        <div class="btn-row"><a class="btn btn--secondary" href="kompetenzen.html">Alle Kompetenzen ansehen</a></div>
      </div>
      <!-- picture-develops: the sea, black and white, coming up out of the paper -->
      <figure class="develop span-6 start-7" data-moment="picture-develops"><img src="assets/img/wellen.webp" alt="Dunkles Meer mit einer Welle, die im Nebel ausläuft" width="2400" height="1602" loading="lazy"></figure>
    </div>
  </section>

  <!-- the promises over the second film (MotionSites shelf: light falling into deep water) -->
  <section class="section deep" id="versprechen" aria-labelledby="versprechen-h">
    <div class="deep__plate" aria-hidden="true">
      <video muted loop playsinline preload="none" poster="media/tiefe-poster.webp" data-bg-video>
        <source src="media/tiefe.webm" type="video/webm">
        <source src="media/tiefe.mp4" type="video/mp4">
      </video>
    </div>
    <div class="wrap deep__inner">
      <div class="deep__head">
        <h2 id="versprechen-h">Drei Versprechen, <em>auf die Du Dich verlassen kannst.</em></h2>
        <p class="deep__lead">Wir sind Unternehmer und versetzen uns in Deine Lage. Unser Rat berücksichtigt neben dem Recht auch Strategie und Zahlen, zu fairen und transparenten Konditionen.</p>
      </div>
      <ol class="deep__cards">
        <li class="liquid-glass glass-card"><span class="glass-card__no">01</span><h3>Rechtsrat aus vier Rechtsgebieten</h3><p>Gesellschafts-, Finanzierungs-, Vertrags- und Datenschutzrecht. Alles andere übernehmen Partnerkanzleien.</p></li>
        <li class="liquid-glass glass-card"><span class="glass-card__no">02</span><h3>Empfehlungen für jede Entscheidung</h3><p>Rechtsrat ist nur wertvoll, wenn er in klare Handlungsempfehlungen mündet. Wir sagen Dir, was wir tun würden.</p></li>
        <li class="liquid-glass glass-card"><span class="glass-card__no">03</span><h3>Festpreis für jedes Mandat</h3><p>Du weißt vorher, was die Beratung kostet. Oder Stundensatz, mit voller Kostentransparenz.</p></li>
      </ol>
    </div>
  </section>

  <section class="section" id="partner" aria-labelledby="partner-h">
    <div class="wrap">
      <div class="section-head section-head--split">
        <h2 id="partner-h">Zwei Partner. <span class="muted">Ein gemeinsamer Weg vom Studium bis zum Exit.</span></h2>
        <a class="link" href="team.html">Das Team kennenlernen</a>
      </div>
      <div class="grid">
        ${people
          .map(
            (p) => `<a class="tile partner-tile span-6" href="team.html#${p.id}">
          <div class="frame frame--photo partner-tile__photo"><img class="frame__img" src="assets/img/${p.id}-700.webp" srcset="assets/img/${p.id}-700.webp 700w, assets/img/${p.id}.webp 1400w" sizes="(max-width: 639px) 100vw, 50vw" alt="Porträt von ${p.name}" width="700" height="579" loading="lazy" data-source="client" data-subject="person"></div>
          <span class="t-card">${p.name}</span>
          <span class="t-small muted">${p.role}</span>
        </a>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`,
});

/* ------------------------------------------------------------------ Über uns */
const chapters = [
  ["f46440956", "Frankfurt am Main", "Studium der Rechtswissenschaften", "Hier hat unser Weg begonnen. Heute sind wir bei der Rechtsanwaltskammer Frankfurt am Main zugelassen.", "Die Skyline von Frankfurt am Main über dem Fluss an einem klaren Tag", 1920, 955],
  ["f59053766", "Mailand", "Studium in Italien", "Das zweite Rechtssystem, das wir von innen kennen. Italien ist bis heute der Sitz der Kanzlei.", "Die Hochhäuser von Mailand hinter einem grünen Park", 1920, 1280],
  ["f134851732", "Berkeley", "Promotion in Kalifornien", "Doktorarbeiten zu Corporate Governance und Unternehmensfinanzierung, an zwei der bekanntesten Universitäten der Welt.", "Der Glockenturm der Universität Berkeley über einer Wiese", 1920, 1239],
  ["f175158141", "Oxford", "Promotion in England", "Dieselben Themen aus einem anderen Rechtskreis. Danach über fünf Jahre in internationalen Großkanzleien.", "Die Kuppel der Radcliffe Camera in Oxford, von oben gesehen", 1920, 1251],
  ["f74488434", "Genua", "Der Sitz der Kanzlei", "Via Corsica 15, über dem Hafen. Von hier beraten wir Unternehmer, zugelassen in Deutschland.", "Blick über die Dächer von Genua zum Meer, zwischen Palmen", 1920, 1395],
];
page({
  file: "ueber-uns.html",
  title: "Über uns: Meder &amp; Tal, Anwälte mit eigener Gründung",
  description: "Studium in Frankfurt und Mailand, Promotion in Berkeley und Oxford, Großkanzlei, dann das eigene Startup bis zum Verkauf. Der Weg von Dr. Manuel Meder und Dr. Michael Tal.",
  moments: ["photo-chapters", "word-highlight"],
  deal: "hero photo (words on the dark calm sea), nav-centre, close-type, footer-dark, buttons solid, mark arc",
  preload: `<link rel="preload" as="image" href="assets/img/wellen.webp">`,
  body: `  <section class="hero hero--photo" data-enter="off" data-calm="left" data-box="none" data-tone="dark" aria-labelledby="hero-h">
    <img class="hero__bg" src="assets/img/wellen.webp" alt="Eine dunkle Welle auf offenem Meer, darüber Nebel" style="--ly-pos: 50% 70%; --ly-pos-phone: 50% 70%" fetchpriority="high" width="2400" height="1602">
    <div class="wrap"><div class="hero-text">
      <div class="hero__text">
        <h1 id="hero-h">Anwälte, die selbst gegründet haben</h1>
        <p class="hero__lead">Studium in Frankfurt und Mailand, Promotion in Berkeley und Oxford, über fünf Jahre Großkanzlei. Dann, 2012, das eigene Unternehmen.</p>
        <div class="btn-row"><a class="btn btn--primary" href="kontakt.html#anfrage">${cta}${arrow}</a><a class="btn btn--secondary" href="#weg">Unseren Weg ansehen</a></div>
      </div>
      <dl class="hero__facts">
        <div><dt>Gegründet</dt><dd>2012, B2B-Software</dd></div>
        <div><dt>Exit</dt><dd>Verkauf an einen US-Wettbewerber</dd></div>
        <div><dt>Zulassung</dt><dd>Rechtsanwälte in Deutschland</dd></div>
        <div><dt>Sitz</dt><dd>Genua, Italien</dd></div>
      </dl>
    </div></div>
  </section>

  <section class="section" id="anfang" aria-labelledby="anfang-h">
    <div class="wrap grid grid--top">
      <div class="span-5">
        <h2 id="anfang-h">Bis hierhin ähnelten sich unsere Lebensläufe denen unserer Kollegen. <span class="muted">Dann änderte sich etwas.</span></h2>
      </div>
      <div class="span-6 start-7 stack-5 measure">
        <p class="t-lead">Wir studierten in Frankfurt am Main und Mailand. In Berkeley und Oxford promovierten wir zu Themen der Corporate Governance und Unternehmensfinanzierung.</p>
        <p>Während der juristischen Ausbildung und als Berufseinsteiger sammelten wir über fünf Jahre Erfahrung in internationalen Großkanzleien. Bis dahin sahen unsere Lebensläufe aus wie die vieler Anwälte. Im Jahr 2012 gründeten wir selbst.</p>
      </div>
    </div>
  </section>

  <!-- photo-chapters: the five places of the path, one photograph each (stand-ins from Wikimedia Commons) -->
  <section class="section" id="weg" data-moment="photo-chapters" aria-labelledby="weg-h">
    <div class="wrap mo-ph">
      <div class="mo-ph__head"><h2 id="weg-h">Fünf Orte, ein Weg</h2><p>Von den Hörsälen in Frankfurt bis zur Kanzlei über dem Hafen von Genua.</p></div>
      <ol class="mo-ph__list">
${chapters
  .map(
    ([id, place, t, text, alt, w, h]) => `        <li class="mo-ph__ch">
          <figure class="mo-ph__pic"><img src="assets/img/photo-${id}.webp" alt="${alt}" width="${w}" height="${h}" data-source="stand-in" data-subject="place"></figure>
          <h3>${place}: ${t}</h3>
          <p>${text}</p>
        </li>`,
  )
  .join("\n")}
      </ol>
    </div>
  </section>

  <section class="section statement" id="gruendung" data-moment="word-highlight" aria-label="Die eigene Gründung">
    <div class="wrap">
      <p class="t-label">2012</p>
      <p class="mo-wh__text">Wir gründeten ein B2B-Software-Startup und führten es als Geschäftsführer durch Gründung, Skalierung und Internationalisierung bis zum Verkauf an einen <strong>US-Wettbewerber</strong>. Diese Erfahrung steckt in jeder Beratung.</p>
    </div>
  </section>`,
  foot: { closeTitle: "Mit Anwälten sprechen, die gegründet haben", closeLine: "Erzähl uns von Deinem Vorhaben. Für jedes Mandat bekommst Du vorab einen Festpreis." },
});

/* ------------------------------------------------------------------ Kompetenzen */
const phases = [
  ["Gründung", "Rechtsform, Gesellschaftsvertrag und ein sauberer Start, auf dem sich aufbauen lässt."],
  ["Shareholder-Agreements", "Klare Regeln zwischen Gründern und Investoren, bevor es darauf ankommt."],
  ["Beteiligungsprogramme", "(Virtuelle) Mitarbeiterbeteiligung, die Talente bindet und verständlich bleibt."],
  ["Finanzierungsrunden", "Vom Term Sheet bis zum Closing, mit Blick auf Bewertung und Verhandlung."],
  ["Verträge und Datenschutz", "Verträge für das Tagesgeschäft und Datenschutz, der zum Geschäftsmodell passt."],
  ["Exit", "Der Verkauf des Unternehmens, begleitet von Anwälten, die selbst verkauft haben."],
];
page({
  file: "kompetenzen.html",
  title: "Kompetenzen: Gesellschaftsrecht, Finanzierung und Datenschutz für Gründer",
  description: "Gründung, Shareholder-Agreements, Beteiligungsprogramme, Finanzierungsrunden, Verträge, Datenschutz und Exit: was Meder & Tal für Wachstumsunternehmen übernimmt, zum Festpreis.",
  moments: ["picture-develops"],
  deal: "hero split, nav-centre, close-type, footer-dark, rhythm dark-band, buttons solid, mark arc",
  body: `  <section class="hero hero--split" data-enter="off" aria-labelledby="hero-h">
    <div class="wrap"><div class="hero-text grid hero__grid">
      <div class="hero__text span-5">
        <p class="hero__kicker"><span class="dot" aria-hidden="true"></span>Festpreis für jedes Mandat</p>
        <h1 id="hero-h">Beratung für jede Phase Deines Unternehmens</h1>
        <p class="hero__lead">Gründung, Beteiligungen, Finanzierungsrunden, Verträge, Datenschutz und der Verkauf: Wir haben das alles nicht von der Seitenlinie erlebt, sondern als Gründer und Geschäftsführer.</p>
        <div class="btn-row"><a class="btn btn--primary" href="kontakt.html#anfrage">${cta}${arrow}</a><a class="btn btn--secondary" href="#phasen">Die sechs Phasen</a></div>
      </div>
      <div class="hero__media hero__media--stone span-6 start-7">
        <img src="assets/img/stein.webp" alt="Ein schwerer, dunkler Stein auf hellem Grund" width="640" height="470" fetchpriority="high">
        <div class="ly-float">
          <div class="ly-float__row"><span>Kosten</span><span>vorab bekannt</span></div>
          <div class="ly-float__title">Festpreis oder transparenter Stundensatz</div>
        </div>
      </div>
    </div></div>
  </section>

  <section class="section" id="gebiete" aria-labelledby="gebiete-h">
    <div class="wrap">
      <div class="section-head">
        <h2 id="gebiete-h">Drei Rechtsgebiete. <span class="muted">Was nicht dazugehört, übernehmen Partnerkanzleien.</span></h2>
      </div>
      <div class="grid area-grid">
        <article class="area span-4"><h3>Unternehmens- und Gesellschaftsrecht</h3><p>Gründung, Gesellschaftsverträge, Shareholder-Agreements und die laufende gesellschaftsrechtliche Begleitung Deines Unternehmens.</p></article>
        <article class="area span-4"><h3>Recht der Unternehmensfinanzierung</h3><p>Finanzierungsrunden, (virtuelle) Beteiligungsprogramme und der Unternehmensverkauf, verhandelt mit dem Blick eines Gründers.</p></article>
        <article class="area span-4"><h3>Vertrags- und Datenschutzrecht</h3><p>Verträge, die Dein Geschäft tragen, und datenschutzrechtliche Fragen, pragmatisch gelöst.</p></article>
      </div>
    </div>
  </section>

  <section class="section" id="phasen" aria-labelledby="phasen-h">
    <div class="wrap grid grid--top">
      <div class="span-6">
        <div class="section-head">
          <h2 id="phasen-h">Von der Gründung bis zum Exit. <span class="muted">Sechs Phasen, ein Ansprechpartner.</span></h2>
        </div>
        <ol class="rows phase-rows">
${phases.map(([n, t], i) => `          <li><span class="rows__name"><span class="phase-no">${String(i + 1).padStart(2, "0")}</span>${n}<small>${t}</small></span></li>`).join("\n")}
        </ol>
      </div>
      <figure class="develop develop--tall span-6 start-7" data-moment="picture-develops"><img src="assets/img/photo-f59053766.webp" alt="Die Hochhäuser des Mailänder Geschäftsviertels hinter einem Park" width="1920" height="1280" loading="lazy" data-source="stand-in" data-subject="place"></figure>
    </div>
  </section>

  <section class="section ground-inverse band" id="kosten" aria-labelledby="kosten-h">
    <div class="wrap">
      <div class="section-head">
        <h2 id="kosten-h">Kosten. <span class="muted">Bei uns gibt es keine Überraschungen.</span></h2>
      </div>
      <div class="grid promise-grid">
        <article class="promise span-6"><h3>Festpreis</h3><p>Wir bieten bei jedem Mandat einen Festpreis an. Du weißt vorher, was die Beratung kostet.</p></article>
        <article class="promise span-6"><h3>Stundensatz</h3><p>Bevorzugst Du eine Abrechnung auf Stundensatzbasis, garantieren wir über das gesamte Mandat hinweg volle Kostentransparenz.</p></article>
      </div>
    </div>
  </section>`,
});

/* ------------------------------------------------------------------ Team */
page({
  file: "team.html",
  title: "Team: Dr. Manuel Meder und Dr. Michael Tal, Rechtsanwälte",
  description: "Die beiden Partner von Meder & Tal: Rechtsanwälte, Gründer und Geschäftsführer. Direkte Telefonnummern, E-Mail-Adressen und LinkedIn-Profile.",
  moments: ["word-highlight"],
  deal: "hero split (two portraits), nav-centre, close-type, footer-dark, buttons solid, mark arc",
  body: `  <section class="hero hero--split" data-enter="off" aria-labelledby="hero-h">
    <div class="wrap"><div class="hero-text grid hero__grid">
      <div class="hero__text span-5">
        <h1 id="hero-h">Zwei Partner, die Du direkt erreichst</h1>
        <p class="hero__lead">Dr. Manuel Meder und Dr. Michael Tal sind Rechtsanwälte, Gründer und Geschäftsführer. Bei uns sprichst Du immer mit einem der beiden.</p>
        <div class="btn-row"><a class="btn btn--primary" href="kontakt.html#anfrage">${cta}${arrow}</a><a class="btn btn--secondary" href="#meder">Die Partner ansehen</a></div>
      </div>
      <div class="hero__media hero__media--pair span-6 start-7">
        <img src="assets/img/meder.webp" srcset="assets/img/meder-700.webp 700w, assets/img/meder.webp 1400w" sizes="(max-width: 1023px) 50vw, 25vw" alt="Porträt von Dr. Manuel Meder" width="1400" height="1158" fetchpriority="high">
        <img src="assets/img/tal.webp" srcset="assets/img/tal-700.webp 700w, assets/img/tal.webp 1400w" sizes="(max-width: 1023px) 50vw, 25vw" alt="Porträt von Dr. Michael Tal" width="1400" height="1157" fetchpriority="high">
      </div>
    </div></div>
  </section>

${people
  .map(
    (p, i) => `  <section class="section member${i % 2 ? " member--flip" : ""}" id="${p.id}" aria-labelledby="${p.id}-h">
    <div class="wrap grid grid--middle">
      <div class="frame frame--photo member__photo span-6${i % 2 ? " start-7" : ""}"><img class="frame__img" src="assets/img/${p.id}.webp" srcset="assets/img/${p.id}-700.webp 700w, assets/img/${p.id}.webp 1400w" sizes="(max-width: 1023px) 100vw, 50vw" alt="Porträt von ${p.name}" width="1400" height="1158" loading="lazy" data-source="client" data-subject="person"></div>
      <div class="member__info span-5${i % 2 ? "" : " start-8"}">
        <h2 id="${p.id}-h">${p.name}</h2>
        <p class="t-lead muted">${p.role}</p>
        <ul class="rows member__rows">
          <li><span class="rows__name">Telefon</span><a class="rows__value link" href="${p.tel}">${p.phone}</a></li>
          <li><span class="rows__name">E-Mail</span><a class="rows__value link" href="mailto:${p.email}">${p.email}</a></li>
          <li><span class="rows__name">LinkedIn</span><a class="rows__value link" href="${p.linkedin}" target="_blank" rel="noopener noreferrer">Profil öffnen</a></li>
        </ul>
      </div>
    </div>
  </section>`,
  )
  .join("\n\n")}

  <section class="section statement" id="gemeinsam" data-moment="word-highlight" aria-label="Gemeinsam">
    <div class="wrap">
      <p class="t-label">Gemeinsam</p>
      <p class="mo-wh__text">Unsere Wege verlaufen seit dem Studium parallel: Promotion, Großkanzlei, das eigene Startup und sein Verkauf. Heute beraten wir <strong>gemeinsam</strong>.</p>
    </div>
  </section>`,
});

/* ------------------------------------------------------------------ Kontakt */
page({
  file: "kontakt.html",
  title: "Kontakt: Erstgespräch mit Meder &amp; Tal vereinbaren",
  description: "Schreib Meder & Tal, worum es geht: Gründung, Finanzierungsrunde, Beteiligungsprogramm, Vertrag oder Verkauf. Via Corsica 15, Genua. info@medertal.com.",
  moments: ["picture-develops"],
  deal: "hero split, nav-centre, close-type, footer-dark, buttons solid, mark arc",
  body: `  <section class="hero hero--split" data-enter="off" aria-labelledby="hero-h">
    <div class="wrap"><div class="hero-text grid hero__grid">
      <div class="hero__text span-5">
        <h1 id="hero-h">Erstgespräch vereinbaren</h1>
        <p class="hero__lead">Schreib uns, worum es geht: Gründung, Finanzierungsrunde, Beteiligungsprogramm, Vertrag oder Verkauf. Für das Mandat bekommst Du vorab einen Festpreis.</p>
        <div class="btn-row"><a class="btn btn--primary" href="#anfrage">Anfrage schreiben${arrow}</a><a class="btn btn--secondary" href="${firm.tel}">Anrufen</a></div>
      </div>
      <div class="hero__media span-6 start-7">
        <img src="media/brandung-poster.webp" alt="Brandung an einem hellen Sandstrand, von oben gesehen" width="1920" height="1080" style="--ly-pos: 50% 60%" fetchpriority="high" data-source="client" data-subject="place">
        <div class="ly-float">
          <div class="ly-float__row"><span>Kanzlei</span><span>Genua</span></div>
          <div class="ly-float__title">${firm.street}, ${firm.city}</div>
        </div>
      </div>
    </div></div>
  </section>

  <section class="section" id="anfrage" aria-labelledby="anfrage-h">
    <div class="wrap grid grid--top">
      <div class="span-6">
        <div class="section-head">
          <h2 id="anfrage-h">Deine Anfrage. <span class="muted">Sie geht direkt an beide Partner.</span></h2>
        </div>
        <form class="form" action="mailto:${firm.email}" method="post" enctype="text/plain" data-endpoint="" novalidate>
          <div class="field"><label for="f-name">Name</label>
            <input id="f-name" name="name" type="text" autocomplete="name" required aria-describedby="f-name-err">
            <p class="field__error" id="f-name-err" hidden>Schreib Deinen Namen.</p></div>
          <div class="field"><label for="f-email">E-Mail</label>
            <input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" required aria-describedby="f-email-err">
            <p class="field__error" id="f-email-err" hidden>Schreib eine E-Mail-Adresse mit @, zum Beispiel name@firma.de.</p></div>
          <div class="field"><label for="f-firma">Unternehmen</label>
            <input id="f-firma" name="unternehmen" type="text" autocomplete="organization" aria-describedby="f-firma-err">
            <p class="field__error" id="f-firma-err" hidden>Schreib den Namen Deines Unternehmens.</p></div>
          <div class="field"><label for="f-thema">Worum geht es?</label>
            <textarea id="f-thema" name="thema" rows="4" required aria-describedby="f-thema-err"></textarea>
            <p class="field__error" id="f-thema-err" hidden>Schreib in ein, zwei Sätzen, worum es geht.</p></div>
          <div class="btn-row"><button class="btn btn--primary" type="submit">Anfrage senden</button></div>
          <p class="form__status" role="status" data-form-status></p>
          <p class="t-small muted">Das Formular öffnet Dein E-Mail-Programm mit der fertigen Nachricht an ${firm.email}.</p>
        </form>
      </div>
      <div class="span-5 start-8 stack-6 direct">
        <h3>Direkt erreichen</h3>
        <ul class="rows">
          <li><span class="rows__name">Kanzlei<small>${firm.street}, ${firm.city}</small></span><a class="rows__value link" href="mailto:${firm.email}">${firm.email}</a></li>
${people.map((p) => `          <li><span class="rows__name">${p.name}<small><a class="link" href="${p.tel}">${p.phone}</a></small></span><a class="rows__value link" href="mailto:${p.email}">${p.email}</a></li>`).join("\n")}
        </ul>
        <p><a class="link" href="https://www.openstreetmap.org/search?query=Via%20Corsica%2015%2016128%20Genova">Weg zur Kanzlei anzeigen</a></p>
      </div>
    </div>
  </section>

  <section class="section" id="genua" aria-labelledby="genua-h">
    <div class="wrap grid grid--middle">
      <div class="span-5">
        <h2 id="genua-h">Die Kanzlei in Genua. <span class="muted">Zugelassen in Deutschland.</span></h2>
        <p class="t-lead genua__lead">Unsere Anwälte sind Mitglieder der Rechtsanwaltskammer Frankfurt am Main. Die Kanzlei sitzt in der Via Corsica 15, über dem Hafen.</p>
      </div>
      <figure class="develop span-6 start-7" data-moment="picture-develops"><img src="assets/img/photo-f74488434.webp" alt="Blick über die Dächer von Genua zum Meer, zwischen Palmen" width="1920" height="1395" loading="lazy" data-source="stand-in" data-subject="place"></figure>
    </div>
  </section>`,
  foot: { closeTitle: "Lieber direkt sprechen?", closeLine: `Ruf Dr. Manuel Meder an: ${firm.phone}.`, closeHref: firm.tel, closeLabel: "Jetzt anrufen" },
});

/* ------------------------------------------------------------------ Legal */
function legalPage(file, title, h1, content) {
  page({
    file,
    title: `${h1}: Meder &amp; Tal`,
    description: title,
    moments: [],
    deal: "legal page: heading and running text on the page ground",
    body: `  <section class="section legal-hero" aria-labelledby="hero-h">
    <div class="wrap"><h1 id="hero-h">${h1}</h1></div>
  </section>
  <section class="section legal" aria-label="${h1}">
    <div class="wrap"><div class="measure legal__body">
${content}
    </div></div>
  </section>`,
  });
}

const imprint = `      <p class="t-lead">Angaben zur Partnerschaft, nach § 5 TMG und § 2 DL-InfoV</p>
      <dl class="legal__facts">
        <div><dt>Name und Rechtsform</dt><dd>MEDER &amp; TAL Partnerschaft von Rechtsanwälten</dd></div>
        <div><dt>Sitz</dt><dd>Via Corsica 15, 16128 Genua, Italien</dd></div>
        <div><dt>Registrierung</dt><dd>AG Frankfurt am Main, PR 2015</dd></div>
        <div><dt>Partner</dt><dd>Dr. Manuel Meder<br>Dr. Michael Tal</dd></div>
        <div><dt>E-Mail</dt><dd><a class="link" href="mailto:info@medertal.com">info@medertal.com</a></dd></div>
        <div><dt>Umsatzsteuer-Identifikationsnummer</dt><dd>DE282750208</dd></div>
        <div><dt>Berufshaftpflichtversicherung</dt><dd>R+V Allgemeine Versicherung AG, Raiffeisenplatz 1, 65189 Wiesbaden</dd></div>
      </dl>
      <h2>Rechtsanwälte</h2>
      <p>Zuständige Kammer ist die Rechtsanwaltskammer Frankfurt am Main. Die Anschrift der Kammer findet sich unter www.rechtsanwaltskammer.de.</p>
      <p>Alle Rechtsanwälte sind in der Bundesrepublik Deutschland zugelassen.</p>
      <p>Die maßgeblichen berufsrechtlichen Regelungen sind u.a. die Bundesrechtsanwaltsordnung, die Berufsordnung, die Fachanwaltsordnung, das Rechtsanwaltsvergütungsgesetz und die Berufsregeln der Rechtsanwälte der Europäischen Union. Sie finden sich unter <a class="link" href="https://www.brak.de">www.brak.de</a> in der Rubrik „Informationspflichten gemäß § 5 TMG“.</p>
      <h2>Urheberrecht</h2>
      <p>Das Urheberrecht an dem Inhalt dieser Webseite oder Teilen davon steht MEDER &amp; TAL oder demjenigen zu, dem MEDER &amp; TAL ein entsprechendes Nutzungsrecht eingeräumt hat.</p>
      <p>Einzelne Seiten dieser Webseite dürfen zum ausschließlichen Gebrauch innerhalb Ihres Unternehmens heruntergeladen, vorübergehend gespeichert und/oder gedruckt werden.</p>
      <p>Jede andere Vervielfältigung, Übertragung oder Verbreitung jeglichen Inhalts dieser Webseite, insbesondere durch Herunterladen, Speichern oder Drucken, ist ohne die ausdrückliche Einwilligung von MEDER &amp; TAL verboten. Anfragen hierzu richten Sie bitte an Herrn Dr. Manuel Meder (<a class="link" href="mailto:m.meder@medertal.com">m.meder@medertal.com</a>; +49 151 423 25468).</p>
      <h2>Informationen und Haftung</h2>
      <p>Es wurden alle Anstrengungen unternommen, um die Richtigkeit der auf diesen Webseiten enthaltenen Informationen und Links zu gewährleisten. Jedoch ist jegliche Haftung im Zusammenhang mit der Nutzung der Informationen, der Links oder dem Vertrauen auf deren Richtigkeit ausgeschlossen.</p>
      <p>Die auf diesen Webseiten enthaltenen Informationen stellen keine Rechtsberatung dar.</p>
      <h2>Anwendbares Recht</h2>
      <p>Etwaige rechtliche Hinweise auf dieser Seite sowie alle Fragen und Streitigkeiten im Zusammenhang mit dieser Webseite unterliegen dem Recht der Bundesrepublik Deutschland.</p>`;
legalPage("impressum.html", "Impressum der MEDER & TAL Partnerschaft von Rechtsanwälten, Genua.", "Impressum", imprint);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const privacyHtml = privacy.de
  .map((b) => {
    if (b.t === "title") return "";
    if (b.t === "h") return `      <h2>${esc(b.x)}</h2>`;
    if (b.t === "ul") return `      <ul>${b.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    return `      <p>${esc(b.x)}</p>`;
  })
  .filter(Boolean)
  .join("\n");
legalPage("datenschutz.html", "Datenschutzerklärung der MEDER & TAL Partnerschaft von Rechtsanwälten.", "Datenschutz", privacyHtml);

console.log("built: index, ueber-uns, kompetenzen, team, kontakt, impressum, datenschutz");
