"""Draft quality gate and Impressum contact extraction."""

from __future__ import annotations

from jarvis.departments.sales.outreach import generate_draft
from jarvis.departments.sales.quality import check_draft, detect_language, extract_contacts

LEAD = {"name": "Zahnarztpraxis Dr. Sperber", "website": "http://www.dr-sperber.de", "city": "München",
        "sector": "dentist", "audit": {"checks": [{"id": "https", "status": "fail", "weight": 15}]}}
GOOD_DE = ("Guten Tag Dr. Sperber,\n\nbei einem Blick auf die Website Ihrer Praxis ist uns aufgefallen, dass sie "
           "noch keine verschlüsselte Verbindung (HTTPS) nutzt und auf dem Smartphone nicht optimal dargestellt "
           "wird. Für Patienten, die online einen Zahnarzt in München suchen, ist das oft der erste Eindruck.\n\n"
           "Wir von VEYRO Web helfen Praxen, ihre Website modern, schnell und mobilfreundlich zu gestalten. "
           "Hätten Sie Interesse an einem kurzen Gespräch von 15 Minuten?\n\nMit freundlichen Grüßen\nMassimiliano")


def test_language_detection():
    assert detect_language(GOOD_DE) == "de"
    assert detect_language("Buongiorno, abbiamo visto il vostro sito e non è adatto al mobile per i clienti") == "it"


def test_good_draft_passes_and_bad_ones_are_caught():
    assert check_draft("email", "de", "Ihre Website", GOOD_DE, LEAD) == []
    italian = GOOD_DE.replace("Guten Tag", "Buongiorno") + " Il vostro sito non è per il cliente e per la ricerca di un dentista con il telefono."
    mixed = check_draft("email", "de", "x", "Buongiorno, il vostro sito non è adatto e la pagina non ha il titolo per il cliente " * 4, LEAD)
    assert any("must be entirely in 'de'" in p for p in mixed)
    assert any("placeholder" in p for p in check_draft("email", "de", "x", GOOD_DE + " [Ihr Name]", LEAD))
    assert any("does not mention" in p for p in check_draft("email", "de", "x", GOOD_DE.replace("Sperber", "Kunde"), LEAD))
    assert any("too short" in p for p in check_draft("email", "de", "x", "Guten Tag.", LEAD))
    assert italian  # silence unused


async def test_bad_model_output_is_rewritten_then_falls_back(llm):
    llm.queue({"subject": "Hi", "body": "Buongiorno, il vostro sito non va bene per il cliente e non ha il titolo."},
              {"subject": "Ihre Website", "body": GOOD_DE})
    subject, body, by = await generate_draft(llm, LEAD, "email", "de", "", "Massimiliano", "VEYRO Web")
    assert body == GOOD_DE and by.endswith("+revisione")
    llm.queue({"body": "x"}, {"body": "y"})
    subject, body, by = await generate_draft(llm, LEAD, "email", "de", "", "Massimiliano", "VEYRO Web")
    assert by == "template" and body.startswith("[VORLAGE")


def test_impressum_extraction():
    text = ("Impressum Zahnarztpraxis Dr. Sperber Leopoldstraße 12 80802 München Inhaber: Dr. med. dent. "
            "Rudolf Sperber Telefon: +49 89 123 456 78 E-Mail: praxis@dr-sperber.de Zuständige Kammer: "
            "Bayerische Landeszahnärztekammer")
    c = extract_contacts(text)
    assert c["emails"] == ["praxis@dr-sperber.de"]
    assert c["phones"] == ["+49 89 123 456 78"]
    assert c["owner"] == "Dr. med. dent. Rudolf Sperber"


def test_owner_without_label_and_contact_links():
    from jarvis.departments.sales.quality import contact_links
    c = extract_contacts("Anschrift Zahnärzte in der Au Dr. med. dent. Hischam Sadek & Kollegen Mariahilfstr. 13")
    assert c["owner"] == "Dr. med. dent. Hischam Sadek"
    links = [{"url": "https://www.x.de/startseite/kontakt/", "text": "Kontakt"},
             {"url": "https://www.x.de/startseite/impressum-datenschutz/", "text": "Impressum"},
             {"url": "https://facebook.com/x/impressum", "text": "fb"}]
    assert contact_links(links, "www.x.de") == ["https://www.x.de/startseite/impressum-datenschutz/",
                                                "https://www.x.de/startseite/kontakt/"]
