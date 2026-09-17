# Ruhige Navigation und weiche Übergänge

Stand: 9. September 2026 · separate Chat-GPT-Testfassung · Version 7.3.0

## Änderungen

- Der aktive Menüpunkt behält eine kräftigere Glasfläche. Andere Einträge blenden beim Überfahren eine dezente eigene Glasfläche ein und beim Verlassen wieder aus. Es gibt keinen nachziehenden Kasten mehr. Zwischenräume können deshalb kein Hin- und Herspringen auslösen.
- Die Glasflächen passen zu Symbol und Text; die ursprünglichen größeren Klickflächen bleiben erhalten. Eingeklappt passen sie zu den Symbolknöpfen.
- Die Seitenleiste gleitet beim Einklappen und Ausklappen in ihre neue Breite. Beschriftungen und Abstände gehen mit der Bewegung mit.
- Notizen, Promo-Felder, optionale Glas-/Bowl-Felder und Dashboard-Module öffnen und schließen über ungefähr eine Viertelsekunde. Gemessen wird die tatsächliche Inhaltshöhe, ohne feste Maximalhöhe für die Zusatzfelder.
- Erneutes Klicken während einer laufenden Bewegung kehrt diese von der gerade sichtbaren Höhe aus um. Das funktioniert auch bei Dashboard-Modulen, deren ursprüngliche Steuerung die Elemente beim Umschalten neu erzeugt.
- Die Einstellung für reduzierte Bewegung und die entsprechende Systemeinstellung werden berücksichtigt. Laufende Inhaltsanimationen werden beim Aktivieren sofort abgeschlossen.
- Die mausabhängige Randbeleuchtung der Module sowie die Glas-Schalter bleiben erhalten. Der entfernte Ring im Inneren der Module bleibt entfernt.

## Funktionsschutz

Die vorhandenen Steuerungen bestimmen weiterhin Auswahl, Auf-/Zuklappzustand und Speicherung. Die neue Darstellung liest diese Zustände und animiert nur die resultierende Geometrie. Sie ersetzt keine Fachfunktion und sendet keine Nachrichten.

Der SHA256-Abgleich bestätigt: 33 von 36 bereits vorhandenen Quelldateien der Testkopie sind unverändert. Nur `index.html`, `liquid-motion.js` und `liquid-motion.css` wurden angepasst; `disclosure-motion.js` und `disclosure-motion.css` kamen als Darstellungsdateien hinzu. Insbesondere die elf Fachmodule, die erzeugte `renderer.js`, die Main-Prozess-Dateien, die Workspace-Steuerung und die Abhängigkeiten wurden in dieser Überarbeitung nicht verändert.

Alle 41 erfassten Dateien im ursprünglichen Projektordner sind ebenfalls unverändert. Gearbeitet wurde ausschließlich unter `C:\Users\BazZTee\Downloads\SWG Mod Setup Tool Chat GPT`.

## Einordnung der Glasoptik

Apple beschreibt Liquid Glass als kontextabhängige Gestaltung für unterschiedliche Bedienelemente. Für diese Electron-Seitenleiste verwenden wir eine eigenständige Umsetzung mit dauerhafter Auswahl und lokalem Hover. Sie ist an dieser Gestaltung orientiert und verwendet keine native Apple-Komponente. [Apple: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/).

## Prüfung und Lieferung

63 bestehende Funktionstests und 101 Offline-Bedienprüfungen sind bestanden. In der tatsächlich verpackten Oberfläche wurden keine Renderer-Fehler erfasst. Geprüft wurden auch Zwischenstände in beiden Bewegungsrichtungen, schnelle Richtungswechsel, echte Maus- und Enter-Eingaben sowie reduzierte Bewegung. 22 zentrale Paketdateien stimmen bytegenau mit den Quellen überein; die EXE besteht die Archivprüfung. Die konkreten Ergebnisse der fertigen Fassung stehen in `Bedienpruefung.json` und `Integritaetspruefung.json`. Die Oberfläche wird in Electron mit lokalen Dienst-Antworten geprüft; Netzwerkzugriffe sind dabei gesperrt. Echte Twitch- oder Telegram-Sendungen und Cloud-Schreibvorgänge sind nicht Teil dieser Prüfung.

Die portable EXE liegt im `dist`-Ordner der Testkopie und als identische Kopie im Ausgabeordner. Ihr Name lautet weiterhin `ShishaWG-Mod-Setup-Tool-Portable-7.3.0-test-chat-gpt.exe`.

`Liquid-Effekt-Vorschau.mp4` zeigt die verpackte Oberfläche einschließlich Menü-Hover, Randbeleuchtung, Glas-Umschaltern und Ein-/Ausklappen. Der normale Mauszeiger wird nur für die Aufnahme eingeblendet.

Dieser Bericht ergänzt die früheren Rework-Berichte; die frühere Beschreibung einer wandernden Navigationskapsel ist durch diese Fassung ersetzt.

