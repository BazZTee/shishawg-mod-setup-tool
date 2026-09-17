# ShishaWG Mod Setup Tool — Blue Glass

Stand: 9. September 2026 · Version 7.3.0 · separate Testfassung „test-chat-gpt“

Die Anwendung verwendet jetzt ein durchgängiges dunkelblaues Design mit transparenten Navigationsflächen, hellblauen Akzenten, feinen Lichtkanten und ruhigeren Inhaltsbereichen. Die Seitenleiste bleibt erhalten. Die Bearbeitungsflächen wurden neu angeordnet und zahlreiche verschachtelte Rahmen aufgelöst.

## Unveränderte Funktionen und Logiken

Dieser Durchgang verändert ausschließlich die Darstellung. Ein SHA256-Abgleich mit dem Stand unmittelbar vor dem Blue-Glass-Umbau bestätigt:

- Von 31 bestehenden Dateien im Quellordner sind 29 bytegenau unverändert.
- Geändert wurden ausschließlich `src/renderer/index.html` (Einbindung der neuen Gestaltung) und `src/renderer/styles.css` (bestehende Akzentfarben).
- Neu hinzugekommen sind `src/renderer/glass.css` und `src/renderer/glass.js`.
- Alle elf Fachmodule, die daraus erzeugte `renderer.js`, die bestehende Navigation in `workspace.js`, sämtliche Main-Prozess-Dateien, die IPC-Schnittstelle und die weiteren vorhandenen Quelldateien bleiben unverändert.
- Die neue Präsentationsdatei verschiebt vorhandene Oberflächenelemente und passt Überschriften und dekorative Symbole an. Bestehende Eingabefelder, IDs und Ereignishandler werden weiterverwendet. Sie ruft keine Online-Dienste auf und verändert keine Fachdaten.
- Paketversion, Abhängigkeiten, Anmeldung, Persistenz, Twitch-/OBS-/Cloud-/Telegram-Abläufe wurden in diesem Durchgang nicht geändert.

Die 41 zuvor erfassten Dateien des Originalprojekts unter `C:\Users\BazZTee\Downloads\SWG Mod Setup Tool` sind ebenfalls unverändert. Die Arbeit liegt ausschließlich unter `C:\Users\BazZTee\Downloads\SWG Mod Setup Tool Chat GPT`.

## Gestaltung nach Bereich

| Bereich | Umsetzung |
| --- | --- |
| Übersicht | Größere horizontale Moduleinträge, klare Einführung und Verbindungsübersicht. |
| Setup | Zusammenhängende Bearbeitungsfläche für Personen und Ergänzungen. Live-Vorschau und Notizen in einer eigenen Spalte. Keine feste Befehlsleiste über den Eingabefeldern. |
| Stream-Aktionen | Titel/Kategorie, Raid und Videos in einer Hauptspalte; Clip und Chat-Befehle in einem Nebenbereich. |
| Mod-HQ & Chat | Durchgehender Chatbereich mit abgesetzter Eingabe, daneben Marker und Watchlist mit flacheren Abschnitten. |
| Giveaways & Adressen | Einheitliche Flächen für Konfiguration, Teilnehmer, Gewinner und Versand. Aufgelöste Unterrahmen bei Filtern und Chat-Benachrichtigungen. |
| Fragen & Antworten | On-Air-Bereich über der Arbeitsfläche, darunter Fragen-Inbox und ergänzende Moderationsbereiche. |
| Umfragen & Vorhersagen | Formular links, Live-Status und Schnellvorlagen rechts; gemeinsame segmentierte Navigation. |
| Statistiken & Timer | Einheitliche Kennzahlen, Tabellen und Ranglisten; blauer Glasstil für die Session-Leiste. |
| Persönliches Dashboard | Neue Oberflächen und Bedienelemente bei unverändertem Widget-, Größen-, Sperr- und Verschiebeverhalten. |
| Dialoge und Werkzeuge | Angepasste Suche, Einstellungen, Profile, Katalog, Menüs und Eingaben. Profilabschnitte ohne zusätzliche Kartenrahmen. |

Statusfarben und fachlich relevante Farben können weiterhin abweichen, beispielsweise bei Erfolgsmeldungen, Personenfarben und der tatsächlichen Twitch-Chat-Vorschau. Die vorhandene Einstellung für reduzierte Animationen bleibt wirksam.

## Prüfung

- **63 bestehende Tests bestanden**, einschließlich des Vergleichs von **240 Setup-Kombinationen** mit der ursprünglichen Befehlsausgabe.
- **61 Offline-Bedienprüfungen bestanden**, anschließend nochmals mit der tatsächlich verpackten Oberfläche in `app.asar`.
- **Keine Renderer-Fehler** in diesem Prüfablauf.
- **419 ursprüngliche Bedienelement-IDs weiterhin vorhanden.**
- Alle Module bei 1440 × 960 und 960 × 700 geprüft; keine horizontale Überbreite der Ansichten im geprüften Ablauf.
- Zehn Personen, Erreichbarkeit der letzten Person, Live-Vorschau, Kopieren, simuliertes Senden, Session-Start, Kohlewechsel und Abschlussdialog geprüft.
- Notizen ein-/ausblenden, Importmenü, Promo-Felder, Vorhersagen, Analysen, Suchnavigation, Startansicht, kompakte Darstellung und reduzierte Bewegung geprüft.
- Katalog- und Profilverwaltung geöffnet und visuell geprüft.
- **23 Bildschirmaufnahmen** aus dem abschließenden Prüflauf erstellt; ausgewählte Ansichten werden mitgeliefert.
- **17 zentrale verpackte Dateien** bytegenau mit den Quellen verglichen; die neuen Gestaltungsdateien sind enthalten, Testdaten sind nicht im Anwendungspaket.
- Die erzeugte portable EXE wurde erfolgreich mit 7-Zip auf Archivintegrität geprüft.

Die Bedienprüfungen verwenden das echte Electron-Fenster und die echte isolierte Renderer-Schnittstelle, aber ausschließlich lokale Testantworten. HTTP-/HTTPS-/WebSocket-Verbindungen sind dabei blockiert. Echte Twitch-Anmeldungen, Nachrichten, Telegram-Versand und Cloud-Schreibvorgänge wurden damit nicht erneut live getestet. Die optische Umsetzung ist von Liquid Glass inspiriert; sie ist keine native Apple-Materialimplementierung. Die Darstellungsleistung auf anderer Hardware wurde nicht vermessen.

## Dateien und Start

Die portable EXE liegt im `dist`-Ordner der getrennten Projektkopie:

`C:\Users\BazZTee\Downloads\SWG Mod Setup Tool Chat GPT\dist\ShishaWG-Mod-Setup-Tool-Portable-7.3.0-test-chat-gpt.exe`

Eine identische Kopie wird im Ausgabeordner bereitgestellt. Die EXE direkt starten; eine Installation ist nicht erforderlich. Eine bereits gestartete ältere Testfassung zuvor regulär schließen, damit beim Vergleich die neue Fassung sichtbar ist.

Die seit dem ersten Rework bestehende Trennung der lokalen Einstellungen vom Original bleibt erhalten. Diese Blue-Glass-Fassung verwendet denselben lokalen Datenbereich wie die vorherige Chat-GPT-Testfassung. Bereits dort gespeicherte Testeinstellungen können weiterverwendet werden. Nach einer Anmeldung arbeiten die Online-Funktionen weiterhin mit denselben echten Diensten wie zuvor.

Das Quellcode-ZIP enthält Quellen, Tests, Dokumentation und Build-Skripte, aber keine `node_modules`, Build-Caches oder weiteren EXE-Kopien. In der vollständigen getrennten Projektkopie lassen sich die vorhandenen Befehle `npm test` und `npm run dist:test` weiter verwenden.
