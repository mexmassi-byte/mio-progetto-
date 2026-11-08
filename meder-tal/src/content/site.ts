// All copy for the site, German (primary) and English.
// Source: WEBSITE_CONTENT_PACKAGE (medertal.com). Obvious typos of the original
// site were corrected. Texts marked "NEW COPY" were written for this relaunch
// and should be reviewed by the firm before going live.

export type Lang = "de" | "en";

export const contact = {
  firm: "Meder & Tal",
  legalName: "MEDER & TAL Partnerschaft von Rechtsanwälten",
  street: "Via Corsica 15",
  zip: "16128",
  city: { de: "Genua", en: "Genoa" },
  country: { de: "Italien", en: "Italy" },
  email: "info@medertal.com",
  phone: "+49 (0) 151 423 25468",
  phoneHref: "tel:+4915142325468",
};

export const people = [
  {
    id: "meder",
    name: "Dr. Manuel Meder",
    role: { de: "Rechtsanwalt, Gründer und Geschäftsführer", en: "Lawyer, founder and managing director" },
    phone: "+49 151 423 25468",
    phoneHref: "tel:+4915142325468",
    email: "m.meder@medertal.com",
    linkedin: "https://www.linkedin.com/in/dr-manuel-meder-288b5155/",
    portrait: "/img/meder-portrait.jpg",
    wide: "/img/meder.jpg",
  },
  {
    id: "tal",
    name: "Dr. Michael Tal",
    role: { de: "Rechtsanwalt, Gründer und Geschäftsführer", en: "Lawyer, founder and managing director" },
    phone: "+49 151 405 27585",
    phoneHref: "tel:+4915140527585",
    email: "m.tal@medertal.com",
    linkedin: "https://www.linkedin.com/in/dr-michael-tal-340b5355/",
    portrait: "/img/tal-portrait.jpg",
    wide: "/img/tal.jpg",
  },
] as const;

export const nav = [
  { to: "/", label: { de: "Home", en: "Home" } },
  { to: "/about", label: { de: "Über uns", en: "About Us" } },
  { to: "/expertise", label: { de: "Kompetenzen", en: "Expertise" } },
  { to: "/team", label: { de: "Team", en: "Team" } },
  { to: "/contact", label: { de: "Kontakt", en: "Contact" } },
] as const;

export const legalNav = [
  { to: "/imprint", label: { de: "Impressum", en: "Imprint" } },
  { to: "/privacy", label: { de: "Datenschutz", en: "Data protection" } },
] as const;

const de = {
  ui: {
    menu: "Menü",
    close: "Schließen",
    skip: "Zum Inhalt springen",
    call: "Anrufen",
    write: "E-Mail schreiben",
    linkedin: "LinkedIn-Profil",
    scroll: "Scrollen",
    langSwitch: "English",
    rights: "Alle Rechte vorbehalten.",
    address: "Adresse",
    emailLabel: "E-Mail",
    phoneLabel: "Telefon",
  },
  footer: {
    line1: "Wende Dich an uns, wenn Du rechtliche Beratung für Dein Unternehmen benötigst.",
    line2: "Wir sind bereit, Dich bei der Verwirklichung Deiner Ziele zu unterstützen.",
  },
  home: {
    subtitle: "Wir sind Anwälte, Gründer und Geschäftsführer.",
    title: "Rechtsberatung für Unternehmer von Unternehmern.",
    intro:
      "Wir sind Dein Ansprechpartner für alle rechtlichen und taktischen Angelegenheiten, die in einem Wachstumsunternehmen auftreten – von der Gründung bis zum Exit.",
    strengthsTitle: "Unsere Stärken",
    strengthsText:
      "Themen wie Gründung, Shareholder-Agreements, (virtuelle) Beteiligungsprogramme, Finanzierungsrunden, datenschutzrechtliche Fragestellungen und den Unternehmensverkauf haben wir nicht nur als Rechtsberater von der Seitenlinie erlebt, sondern als Gründer und Geschäftsführer. Wir können uns daher bestens in die Situation unserer Mandanten versetzen.",
    strengthsLink: "Alle Kompetenzen ansehen",
    partnersTitle: "Zwei Partner. Eine Gründungsgeschichte.",
    partnersLink: "Das Team kennenlernen",
    standTitle: "Was uns auszeichnet",
    standText:
      "Wir bieten mehr als nur exzellenten Rechtsrat. Wir sind Unternehmer und versetzen uns in die Lage unserer Mandanten. Wir erteilen klare Handlungsempfehlungen, die neben den juristischen auch die strategischen sowie betriebswirtschaftlichen Aspekte des Einzelfalls berücksichtigen. Dies alles bieten wir zu fairen und transparenten Konditionen. Überraschungen beim Thema Kosten sind bei uns ausgeschlossen.",
    ctaTitle: "Lass uns über Dein Unternehmen sprechen.",
    ctaButton: "Kontakt aufnehmen",
  },
  areas: [
    { title: "Unternehmens- und Gesellschaftsrecht" },
    { title: "Recht der Unternehmensfinanzierung" },
    { title: "Vertrags- und Datenschutzrecht" },
  ],
  promises: [
    {
      title: "Exzellenter Rechtsrat",
      text: "Unsere Stärken liegen im Gesellschaftsrecht, Finanzierungsrecht, Vertragsrecht und Datenschutzrecht. Sollte ein Mandat Rechtsgebiete tangieren, in denen wir nicht selbst exzellent beraten können, ziehen wir Partnerkanzleien hinzu.",
    },
    {
      title: "Klare Handlungsempfehlungen",
      text: "Als Unternehmer wissen wir, dass exzellenter Rechtsrat nur dann wertvoll ist, wenn er für den Mandanten in klare Handlungsempfehlungen mündet. Unser Rat berücksichtigt immer auch die strategischen und betriebswirtschaftlichen Facetten des Einzelfalls.",
    },
    {
      title: "Volle Kostenkontrolle",
      text: "Beim Thema Kosten gibt es bei uns keine Überraschungen. Wir bieten bei jedem Mandat einen Festpreis an. Solltest Du eine Abrechnung auf Stundensatzbasis bevorzugen, garantieren wir über das gesamte Mandat hinweg volle Kostentransparenz.",
    },
  ],
  about: {
    title: "Über uns",
    lead: "Bis hierhin ähnelten sich unsere Lebensläufe denen unserer Anwaltskollegen. Dann änderte sich etwas.",
    bio1:
      "Wir studierten in Frankfurt am Main und Mailand. In Berkeley und Oxford promovierten wir zu Themen der Corporate Governance und Unternehmensfinanzierung. Während der juristischen Ausbildung und als Berufseinsteiger sammelten wir über fünf Jahre wertvolle Erfahrungen in internationalen Großkanzleien.",
    bio2:
      "Im Jahr 2012 gründeten wir ein B2B-Software-Startup. Als Geschäftsführer verantworteten wir alle strategischen, kommerziellen und juristischen Themen der Unternehmung. Von der Gründung, Skalierung und Internationalisierung bis zum Verkauf an einen US-amerikanischen Wettbewerber sammelten wir viele wertvolle Erfahrungen. Diese setzen wir durchweg bei der Beratung unserer Mandanten ein.",
    timelineTitle: "Unser Weg",
    timeline: [
      { when: "Studium", title: "Frankfurt am Main und Mailand", text: "Rechtswissenschaften an zwei Standorten, zwei Rechtskulturen." },
      { when: "Promotion", title: "Berkeley und Oxford", text: "Doktorarbeiten zu Corporate Governance und Unternehmensfinanzierung." },
      { when: "Großkanzleien", title: "Über fünf Jahre", text: "Ausbildung und Berufseinstieg in internationalen Großkanzleien." },
      { when: "2012", title: "Die eigene Gründung", text: "Ein B2B-Software-Startup. Als Geschäftsführer verantworten wir Strategie, Vertrieb und Recht." },
      { when: "Wachstum", title: "Skalierung und Internationalisierung", text: "Das Unternehmen wächst über Ländergrenzen hinweg." },
      { when: "Exit", title: "Verkauf an einen US-Wettbewerber", text: "Der gesamte Weg, von der Gründung bis zum Verkauf, aus Sicht der Unternehmer." },
      { when: "Heute", title: "Meder & Tal", text: "Rechtsberatung von Unternehmern für Unternehmer." },
    ],
    manifesto:
      "Wir bieten mehr als nur exzellenten Rechtsrat. Wir sind Unternehmer und versetzen uns in die Lage unserer Mandanten.",
    teamLink: "Die Partner kennenlernen",
  },
  expertise: {
    title: "Kompetenzen",
    lead: "Wir haben diese Themen nicht nur als Rechtsberater von der Seitenlinie erlebt, sondern als Gründer und Geschäftsführer.",
    areasTitle: "Drei Rechtsgebiete",
    // NEW COPY: short descriptions of the three practice areas.
    areaTexts: [
      "Gründung, Gesellschaftsverträge, Shareholder-Agreements und die laufende gesellschaftsrechtliche Begleitung Deines Unternehmens.",
      "Finanzierungsrunden, (virtuelle) Beteiligungsprogramme und der Unternehmensverkauf, verhandelt mit dem Blick eines Gründers.",
      "Verträge, die Dein Geschäft tragen, und datenschutzrechtliche Fragestellungen, pragmatisch gelöst.",
    ],
    journeyTitle: "Von der Gründung bis zum Exit",
    journeyText: "Wir begleiten Wachstumsunternehmen durch jede Phase. Diese Stationen kennen wir aus eigener Erfahrung.",
    // NEW COPY: one line per stage, based on the topics named on the original site.
    journey: [
      { title: "Gründung", text: "Rechtsform, Gesellschaftsvertrag und ein sauberer Start, auf dem sich aufbauen lässt." },
      { title: "Shareholder-Agreements", text: "Klare Regeln zwischen Gründern und Investoren, bevor es darauf ankommt." },
      { title: "Beteiligungsprogramme", text: "(Virtuelle) Mitarbeiterbeteiligung, die Talente bindet und verständlich bleibt." },
      { title: "Finanzierungsrunden", text: "Vom Term Sheet bis zum Closing, mit Verständnis für Bewertung und Verhandlung." },
      { title: "Verträge und Datenschutz", text: "Verträge, die das Tagesgeschäft tragen, und Datenschutz, der zum Geschäftsmodell passt." },
      { title: "Exit", text: "Der Unternehmensverkauf, begleitet von Anwälten, die selbst verkauft haben." },
    ],
    partnersNote:
      "Sollte ein Mandat Rechtsgebiete tangieren, in denen wir nicht selbst exzellent beraten können, ziehen wir Partnerkanzleien hinzu.",
    costTitle: "Volle Kostenkontrolle",
    costFixed: "Festpreis",
    costFixedText: "Wir bieten bei jedem Mandat einen Festpreis an.",
    costHourly: "Stundensatz",
    costHourlyText: "Bevorzugst Du eine Abrechnung auf Stundensatzbasis, garantieren wir über das gesamte Mandat hinweg volle Kostentransparenz.",
  },
  team: {
    title: "Team",
    lead: "Zwei Anwälte, die selbst gegründet, skaliert und verkauft haben.",
    shared:
      "Es gibt keine getrennten Lebensläufe: Wir haben gemeinsam studiert, promoviert, gegründet und verkauft. Deshalb beraten wir auch gemeinsam.",
    aboutLink: "Unsere Geschichte lesen",
  },
  contactPage: {
    title: "Kontakt",
    lead: "Wende Dich an uns, wenn Du rechtliche Beratung für Dein Unternehmen benötigst.",
    formTitle: "Schreib uns",
    formHint: "Das Formular öffnet Dein E-Mail-Programm mit einer vorbereiteten Nachricht. Es werden keine Daten auf dieser Website gespeichert.",
    name: "Name",
    company: "Unternehmen",
    topic: "Worum geht es?",
    message: "Nachricht",
    send: "E-Mail vorbereiten",
    direct: "Direkt erreichen",
    topics: ["Gründung", "Finanzierungsrunde", "Beteiligungsprogramm", "Verträge und Datenschutz", "Unternehmensverkauf", "Etwas anderes"],
  },
  legal: {
    imprint: "Impressum",
    privacy: "Datenschutz",
  },
  notFound: {
    title: "Diese Szene gibt es nicht.",
    text: "Die Seite wurde nicht gefunden.",
    back: "Zur Startseite",
  },
};

type Copy = typeof de;

const en: Copy = {
  ui: {
    menu: "Menu",
    close: "Close",
    skip: "Skip to content",
    call: "Call",
    write: "Send an email",
    linkedin: "LinkedIn profile",
    scroll: "Scroll",
    langSwitch: "Deutsch",
    rights: "All rights reserved.",
    address: "Address",
    emailLabel: "Email",
    phoneLabel: "Phone",
  },
  footer: {
    line1: "Get in touch if you need legal advice for your company.",
    line2: "We are ready to help you achieve your goals.",
  },
  home: {
    subtitle: "We are lawyers, founders and managing directors.",
    title: "Legal advice from entrepreneurs for entrepreneurs.",
    intro:
      "We are your advisor for all legal and tactical matters that arise in your growth company – from the company's formation to its exit.",
    strengthsTitle: "Our strengths",
    strengthsText:
      "We have experienced topics such as company formation, shareholder agreements, (virtual) participation programs, financing rounds, data protection issues and the sale of companies not only as legal advisors from the sidelines, but as founders and managing directors. We can therefore put ourselves in our clients' shoes and know what's important for you and your company.",
    strengthsLink: "See all expertise",
    partnersTitle: "Two partners. One founding story.",
    partnersLink: "Meet the team",
    standTitle: "What makes us stand out",
    standText:
      "We offer more than just excellent legal advice. We are entrepreneurs and can therefore put ourselves in our clients' shoes. We provide clear recommendations for action that take into account not only the legal but also the strategic and business aspects of the particular case. We offer all this at fair and transparent conditions. There are no surprises when it comes to costs.",
    ctaTitle: "Let's talk about your company.",
    ctaButton: "Get in touch",
  },
  areas: [
    { title: "Commercial and corporate law" },
    { title: "Corporate finance law" },
    { title: "Contract and data protection law" },
  ],
  promises: [
    {
      title: "Excellent legal advice",
      text: "Our strengths lie in commercial and corporate law, financing law, contract law and data protection law. If a mandate involves areas of law in which we cannot provide excellent advice ourselves, we consult partner law firms.",
    },
    {
      title: "Valuable clarity",
      text: "As entrepreneurs, we know that excellent legal advice is only valuable if it results in clear recommendations for action. Our advice always takes into account the strategic and business aspects of the individual matter.",
    },
    {
      title: "Full cost control",
      text: "When it comes to costs, there are no surprises with us. We offer a fixed price for every mandate. If you prefer to be billed on an hourly rate basis, we guarantee full cost transparency throughout the entire mandate.",
    },
  ],
  about: {
    title: "About us",
    lead: "Up to this point, our resumes were similar to those of our fellow lawyers. Then that changed.",
    bio1:
      "We studied law in Frankfurt am Main and Milan. At Berkeley and Oxford, we completed our doctorates on corporate governance and corporate finance. During our legal training and as young professionals, we gained valuable experience in major international law firms over a period of five years.",
    bio2:
      "In 2012, we founded a B2B software startup. As managing directors, we were responsible for all strategic, commercial and legal issues of the venture. From the founding, scaling and internationalization to the sale to a US competitor, we gained a lot of valuable experience. We consistently apply this experience when advising our clients.",
    timelineTitle: "Our path",
    timeline: [
      { when: "Studies", title: "Frankfurt am Main and Milan", text: "Law at two universities, in two legal cultures." },
      { when: "Doctorate", title: "Berkeley and Oxford", text: "Doctoral theses on corporate governance and corporate finance." },
      { when: "Major law firms", title: "More than five years", text: "Legal training and first years in practice at international law firms." },
      { when: "2012", title: "Our own startup", text: "A B2B software company. As managing directors we own strategy, sales and legal." },
      { when: "Growth", title: "Scaling and internationalization", text: "The company grows across borders." },
      { when: "Exit", title: "Sale to a US competitor", text: "The whole journey, from formation to sale, seen from the founders' seat." },
      { when: "Today", title: "Meder & Tal", text: "Legal advice from entrepreneurs for entrepreneurs." },
    ],
    manifesto:
      "We offer more than just excellent legal advice. We are entrepreneurs and can put ourselves in our clients' shoes.",
    teamLink: "Meet the partners",
  },
  expertise: {
    title: "Expertise",
    lead: "We have experienced these topics not only as legal advisors from the sidelines, but as founders and managing directors.",
    areasTitle: "Three areas of law",
    areaTexts: [
      "Formation, articles of association, shareholder agreements and ongoing corporate counsel for your company.",
      "Financing rounds, (virtual) participation programs and the sale of your company, negotiated with a founder's eye.",
      "Contracts that carry your business, and data protection questions solved pragmatically.",
    ],
    journeyTitle: "From formation to exit",
    journeyText: "We support growth companies through every stage. We know these milestones from our own experience.",
    journey: [
      { title: "Formation", text: "Legal form, articles of association and a clean start to build on." },
      { title: "Shareholder agreements", text: "Clear rules between founders and investors, before they matter." },
      { title: "Participation programs", text: "(Virtual) employee participation that retains talent and stays understandable." },
      { title: "Financing rounds", text: "From term sheet to closing, with an understanding of valuation and negotiation." },
      { title: "Contracts and data protection", text: "Contracts that carry daily business, and data protection that fits the business model." },
      { title: "Exit", text: "The sale of your company, advised by lawyers who have sold one themselves." },
    ],
    partnersNote:
      "If a mandate involves areas of law in which we cannot provide excellent advice ourselves, we consult partner law firms.",
    costTitle: "Full cost control",
    costFixed: "Fixed price",
    costFixedText: "We offer a fixed price for every mandate.",
    costHourly: "Hourly rate",
    costHourlyText: "If you prefer to be billed on an hourly basis, we guarantee full cost transparency throughout the entire mandate.",
  },
  team: {
    title: "Team",
    lead: "Two lawyers who have founded, scaled and sold a company themselves.",
    shared:
      "There are no separate resumes: we studied, earned our doctorates, founded and sold together. That's why we advise together, too.",
    aboutLink: "Read our story",
  },
  contactPage: {
    title: "Contact",
    lead: "Get in touch if you need legal advice for your company.",
    formTitle: "Write to us",
    formHint: "The form opens your email program with a prepared message. No data is stored on this website.",
    name: "Name",
    company: "Company",
    topic: "What is it about?",
    message: "Message",
    send: "Prepare email",
    direct: "Reach us directly",
    topics: ["Formation", "Financing round", "Participation program", "Contracts and data protection", "Company sale", "Something else"],
  },
  legal: {
    imprint: "Imprint",
    privacy: "Data protection",
  },
  notFound: {
    title: "This scene doesn't exist.",
    text: "The page could not be found.",
    back: "Back to home",
  },
};

export const copy: Record<Lang, Copy> = { de, en };
