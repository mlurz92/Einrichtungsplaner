# Recherche-Notizen Katalog (Stand Okt. 2026)

Quellen: westwing.de, ikea.com/de, jysk.de (Kategorieseiten und Produktseiten, abgerufen 23.10.2026),
Tylko-Produktfeed (schema.org-JSON-LD über moebel.ladendirekt.de, da tylko.com per Cloudflare gesperrt ist),
lampe.de (Produkt-Sitemap → Produktseiten mit JSON-LD und Attributtabelle; Designmarken, nur Innenleuchten),
Samsung-Datenblätter The Frame LS03F/LS03FW (Maße mit/ohne Standfuß),
hoeffner.de (Esstisch-Listen → Artikelseiten mit Datenblatt, `scrape_hoeffner.py`, 24.10.2026),
boconcept.com/de-de (Esstische, Standardkonfiguration mit JSON-LD und Maßfeldern, `scrape_boconcept.py`, 24.10.2026),
delife.de (komplettes Sortiment über die Produkt-Sitemap, 7.145 Artikelseiten = je Ausführung eine Seite mit JSON-LD,
Ausführungs-Wähler und „Alle Produktdetails im Überblick“, `scrape_delife.py`, Bezugsfarben aus den Freisteller-Fotos
`delife_colors.py`, 24.10.2026; Daten in `data/delife_products.json`, `data/delife_colors.json`),
sowie die vier Möblierungskonzepte WE 13 (Preise 14./15.10.2026).

Westwing-Listen (Auszug, Name | Preis | Farbe | Pfad) sind in `westwing_*.txt` abgelegt;
Maße stammen von den jeweiligen Produktseiten bzw. den Konzept-Produktlisten.
