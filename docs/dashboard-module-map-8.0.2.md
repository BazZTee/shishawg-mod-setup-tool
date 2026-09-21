# Mein Dashboard: Modul- und Feature-Zuordnung (8.0.2)

## Grundsatz

Das persönliche Dashboard verwendet die vorhandene Modulansicht selbst. Es erzeugt keine zweite, verkleinerte Kopie. Eingabefelder, Live-Zustände, Schaltflächen und Ereignisbehandlung bleiben deshalb dieselben wie in der jeweiligen Vollansicht.

- **Gesamtes Modul** dockt die unveränderte Modulansicht an.
- **Ausgewählte Funktionen** dockt dieselbe Modulansicht an und blendet nicht gewählte Bereiche aus.
- Beim Verlassen des Dashboards wird die Ansicht an ihre ursprüngliche Stelle zurückgesetzt.
- Ein Feature-Code bezeichnet einen sichtbaren Funktionsbereich, keine neu programmierte Ersatzfunktion.

## Zuordnung

| Modul-Code | Vollansicht | Feature-Code | Bereich |
| --- | --- | --- | --- |
| `widget-setup` | `view-setup` | `toolbar` | Werkzeugleiste, Import, Zurücksetzen und weitere Optionen |
|  |  | `notes` | Schnell-Notizen |
|  |  | `persons` | Personen-Setups mit Pfeife, Kopf, HMD und Tabak |
|  |  | `extras` | Kohle, Zusatzinformation und Promo-Befehl |
|  |  | `command` | Befehlsvorschau, Kopieren und Twitch-Versand |
| `widget-quickactions` | `view-quickactions` | `streaminfo` | Streamtitel und Kategorie |
|  |  | `clipping` | Twitch-Clip erstellen und teilen |
|  |  | `favorites` | Persönlicher Schnellzugriff und zuletzt verwendete Befehle |
|  |  | `youtube` | YouTube-Finder und Teilen im Chat |
|  |  | `commands` | Chat-Befehlsbibliothek |
|  |  | `raid` | Raid suchen, starten und abbrechen |
| `widget-modchat` | `view-modchat` | `teamchat` | Mod-Teamchat, Anwesenheit und 7TV-Eingabe |
|  |  | `publicchat` | Öffentlicher Twitch-/YouTube-Chat |
|  |  | `pinboard` | Kanalbezogene Team-Pinnwand |
|  |  | `watchlist` | Nutzervermerke und Chatter |
|  |  | `markers` | Cutter-Marker und Export |
| `widget-giveaways` | `view-giveaways` | `configuration` | Giveaway konfigurieren, starten und stoppen |
|  |  | `winner` | Gezogener Gewinner und Schnellaktionen |
|  |  | `participants` | Teilnehmer-Pool |
|  |  | `history` | Gewinne und Versandstatus |
|  |  | `addresses` | Geschützte Adressprüfung und Versand |
| `widget-qna` | `view-qna` | `tools` | Q&A-Werkzeugleiste, Einstellungen und Zusatzaktionen |
|  |  | `onair` | Aktuell On-Air, OBS und Prompter |
|  |  | `inbox` | Fragen-Inbox, Suche, Filter und Moderation |
|  |  | `round` | Fragerunde und Personensteuerung |
| `widget-polls` | `view-polls` | `poll-live` | Laufende Twitch-Umfrage |
|  |  | `poll-presets` | Umfrage-Schnellvorlagen |
|  |  | `poll-create` | Neue Umfrage erstellen |
|  |  | `poll-saved` | Gespeicherte Umfragen |
|  |  | `prediction-live` | Laufende Twitch-Vorhersage |
|  |  | `prediction-presets` | Vorhersage-Schnellvorlagen |
|  |  | `prediction-create` | Neue Vorhersage erstellen |
|  |  | `prediction-saved` | Gespeicherte Vorhersagen |
| `widget-timer` | `view-stats` | `history` | Protokoll gerauchter Köpfe |
|  |  | `analytics` | Kennzahlen und Ranglisten |
|  |  | `timer` | Live Session- und Kohle-Timer |
|  |  | `overlay` | OBS-Overlay-Verwaltung |

## Technische Quelle

Die zentrale Zuordnung steht in `src/renderer/modules/11-dashboard.js` in `CUSTOM_DASHBOARD_CATALOG`. Dynamisch erzeugte Bereiche in `stream-actions.js` und `mod-hq-workspace.js` tragen `data-dashboard-source-feature`. Alle anderen Bereiche werden über ihre bestehenden stabilen IDs oder Klassen zugeordnet.
