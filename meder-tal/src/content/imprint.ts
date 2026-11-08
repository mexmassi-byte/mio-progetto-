// Imprint, original wording from the content package (medertal.com/impressum).
import type { Lang } from "./site";

export type ImprintEntry = { label: string; value: string[]; href?: string };
export type ImprintSection = { heading?: string; intro?: string; entries?: ImprintEntry[]; paragraphs?: string[] };

export const imprint: Record<Lang, ImprintSection[]> = {
  de: [
    {
      intro: "Angaben zur Partnerschaft, nach § 5 TMG und § 2 DL-InfoV",
      entries: [
        { label: "Name/Rechtsform", value: ["MEDER & TAL Partnerschaft von Rechtsanwälten"] },
        { label: "Sitz", value: ["Via Corsica 15, 16128 Genua, Italien"] },
        { label: "Registrierung", value: ["AG Frankfurt am Main, PR 2015"] },
        { label: "Liste der Partner", value: ["Dr. Manuel Meder", "Dr. Michael Tal"] },
        { label: "E-Mail-Adresse", value: ["Info@MederTal.com"], href: "mailto:info@medertal.com" },
        { label: "Umsatzsteuer-Identifikationsnummer", value: ["DE282750208"] },
        {
          label: "Berufshaftpflichtversicherung",
          value: ["Die Berufshaftpflichtversicherung besteht über die R+V Allgemeine Versicherung AG, Raiffeisenplatz 1, 65189 Wiesbaden."],
        },
      ],
    },
    {
      heading: "Rechtsanwälte",
      paragraphs: [
        "Zuständige Kammer ist die Rechtsanwaltskammer Frankfurt am Main. Die Anschrift der Kammer findet sich unter www.rechtsanwaltskammer.de.",
        "Alle Rechtsanwälte sind in der Bundesrepublik Deutschland zugelassen.",
        "Die maßgeblichen berufsrechtlichen Regelungen sind u.a. die Bundesrechtsanwaltsordnung, die Berufsordnung, die Fachanwaltsordnung, das Rechtsanwaltsvergütungsgesetz und die Berufsregeln der Rechtsanwälte der Europäischen Union. Sie finden sich unter www.brak.de in der Rubrik „Informationspflichten gemäß § 5 TMG“.",
      ],
    },
    {
      heading: "Urheberrecht",
      paragraphs: [
        "Das Urheberrecht an dem Inhalt dieser Webseite oder Teilen davon steht MEDER & TAL oder demjenigen zu, dem MEDER & TAL ein entsprechendes Nutzungsrecht eingeräumt hat.",
        "Einzelne Seiten dieser Webseite dürfen zum ausschließlichen Gebrauch innerhalb Ihres Unternehmens heruntergeladen, vorübergehend gespeichert und/oder gedruckt werden.",
        "Jede andere Vervielfältigung, Übertragung oder Verbreitung jeglichen Inhalts dieser Webseite, insbesondere durch Herunterladen, Speichern oder Drucken, ist ohne die ausdrückliche Einwilligung von MEDER & TAL verboten. Anfragen hierzu richten Sie bitte an Herrn Dr. Manuel Meder (M.Meder@MederTal.com; +49 (0)15142325468).",
      ],
    },
    {
      heading: "Informationen und Haftung",
      paragraphs: [
        "Es wurden alle Anstrengungen unternommen, um die Richtigkeit der auf diesen Webseiten enthaltenen Informationen und Links zu gewährleisten. Jedoch ist jegliche Haftung im Zusammenhang mit der Nutzung der Informationen, der Links oder dem Vertrauen auf deren Richtigkeit ausgeschlossen.",
        "Die auf diesen Webseiten und insbesondere im Mandantenbereich enthaltenen Informationen stellen keine Rechtsberatung dar.",
      ],
    },
    {
      heading: "Anwendbares Recht",
      paragraphs: [
        "Etwaige rechtlichen Hinweise auf dieser Seite sowie alle Fragen und Streitigkeiten im Zusammenhang mit dieser Webseite unterliegen dem Recht der Bundesrepublik Deutschland.",
      ],
    },
  ],
  en: [
    {
      intro:
        "Partnership details in accordance with the German Telemedia Act (Telemediengesetz) and the Directive on Service Information Duties (DL-InfoVO). MEDER & TAL is a partnership of lawyers (Partnerschaft von Rechtsanwälten) under the German Partnership Act (Partnerschaftsgesellschaftsgesetz), a special form of partnership available to individuals rendering professional services.",
      entries: [
        { label: "Registered seat", value: ["Via Corsica 15, 16128 Genoa, Italy"] },
        {
          label: "Registration",
          value: ["Partnership register (Partnerschaftsregister) of the local court (Amtsgericht) of Frankfurt am Main/PR 2015."],
        },
        { label: "List of partners", value: ["Dr. Manuel Meder", "Dr. Michael Tal"] },
        { label: "VAT identification number", value: ["DE282750208"] },
        { label: "Email", value: ["Info@MederTal.com"], href: "mailto:info@medertal.com" },
        {
          label: "Insurance",
          value: ["A professional liability insurance as prescribed under § 59j BRAO exists with R+V Allgemeine Versicherung AG, Raiffeisenplatz 1, 65189 Wiesbaden."],
        },
      ],
    },
    {
      heading: "Regulatory authority / competent bar",
      paragraphs: [
        "The lawyers of MEDER & TAL are members of the Frankfurt bar. Please refer to www.rechtsanwaltskammer.de to obtain the address of the competent bar.",
        "All lawyers are admitted as lawyers (Rechtsanwälte) in the Federal Republic of Germany.",
        "According to the Partnership Act, the personal liability of the partners for obligations of the partnership is limited. Only those partners who have been involved in a certain matter may be personally liable with respect to this matter. Partners whose contributions in this matter have been subordinate will not be personally liable. For details of partner professional liability, please see Section 8 of the German Partnership Act.",
        "For further information that is required to be published pursuant to the German Act on Telecommunications Services (Teledienstegesetz), including information on bar admission and applicable rules of professional conduct, please see our German website.",
      ],
    },
    {
      heading: "Copyright",
      paragraphs: [
        "Copyright in the content of this website or any part thereof is owned by MEDER & TAL or its licensors.",
        "You may download, temporarily store and print one or more of the pages of this website for use within your organisation.",
        "Any other download, storage, printing, copying, transmission or distribution of the content of, or the publications on, this website requires the prior written consent of MEDER & TAL. Please address requests to Dr. Manuel Meder (M.Meder@MederTal.com; +49(0)15142325468).",
      ],
    },
    {
      heading: "Information and waiver of liability",
      paragraphs: [
        "Every effort has been taken to ensure the accuracy of the information on this website. However, any and all liability which might arise from your use of, or reliance on, the information or links contained on the website is excluded.",
        "The information on this site and in the Client Area is general information and does not constitute legal advice. Much of the information is regularly updated, so please compare the date of any printed edition with those included on the website to make sure that you have the latest version.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: ["This legal notice and all issues regarding this website are governed by the laws of the Federal Republic of Germany."],
    },
  ],
};
