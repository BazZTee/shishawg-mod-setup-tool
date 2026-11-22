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
| `widget-setup` | `view-setup` | `setup` | Werkzeugleiste, Personen, Kohle, Extras, Vorschau und Versand als ein Ablauf |
|  |  | `notes` | Eigenständige Schnell-Notizen |
| `widget-quickactions` | `view-quickactions` | `streaminfo` | Streamtitel und Kategorie |
|  |  | `clipping` | Twitch-Clip erstellen und teilen |
|  |  | `library` | Chat-Befehle mit persönlichem Schnellzugriff und zuletzt verwendeten Befehlen |
|  |  | `youtube` | YouTube-Finder und Teilen im Chat |
|  |  | `raid` | Raid suchen, starten und abbrechen |
| `widget-modchat` | `view-modchat` | `teamchat` | Mod-Teamchat, Anwesenheit und 7TV-Eingabe |
|  |  | `publicchat` | Öffentlicher Twitch-/YouTube-Chat |
|  |  | `pinboard` | Kanalbezogene Team-Pinnwand |
|  |  | `watchlist` | Nutzervermerke und Chatter |
|  |  | `markers` | Cutter-Marker und Export |
| `widget-giveaways` | `view-giveaways` | `live` | Konfiguration, Teilnehmer und Gewinner als ein Ablauf |
|  |  | `fulfillment` | Gewinnhistorie, Adressprüfung und Versand als ein Ablauf |
| `widget-qna` | `view-qna` | — | Q&A-Werkzeugleiste kommt automatisch zu jedem ausgewählten Bereich |
|  |  | `onair` | Aktuell On-Air, OBS und Prompter |
|  |  | `inbox` | Fragen-Inbox, Suche, Filter und Moderation |
|  |  | `round` | Fragerunde und Personensteuerung |
| `widget-polls` | `view-polls` | `poll-live` | Laufende Twitch-Umfrage |
|  |  | `poll-manage` | Umfrage erstellen, Schnellvorlagen und gespeicherte Umfragen |
|  |  | `prediction-live` | Laufende Twitch-Vorhersage |
|  |  | `prediction-manage` | Vorhersage erstellen, Schnellvorlagen und gespeicherte Vorhersagen |
| `widget-timer` | `view-stats` | `history` | Protokoll gerauchter Köpfe |
|  |  | `analytics` | Kennzahlen und Ranglisten |
|  |  | `timer` | Live Session- und Kohle-Timer mit zugehöriger OBS-Overlay-Verwaltung |

Gespeicherte alte Funktionskennungen werden beim Laden auf diese sinnvollen Gruppen abgebildet.

Der Bereich `setup` enthält auch „Setup Importieren“. „Von HookahTools (Marv)“ übernimmt Tabaksorten und Prozentanteile eines Live-Mixes aus den letzten 30 Minuten in dieselbe Setup-Ansicht wie das vollständige Modul. Pfeife, Kopf und HMD bleiben erhalten.

## Technische Quelle

Die zentrale Zuordnung steht in `src/renderer/modules/11-dashboard.js` in `CUSTOM_DASHBOARD_CATALOG`. Dynamisch erzeugte Bereiche in `stream-actions.js` und `mod-hq-workspace.js` tragen `data-dashboard-source-feature`. Alle anderen Bereiche werden über ihre bestehenden stabilen IDs oder Klassen zugeordnet.
