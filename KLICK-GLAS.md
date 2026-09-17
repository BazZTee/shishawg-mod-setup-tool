# Glasbewegung bei Auswahlwechseln

Stand: 9. September 2026 · getrennte Chat-GPT-Testkopie · Version 7.3.0

- Beim Überfahren erscheint weiterhin eine dezente Glasfläche direkt am jeweiligen Menüpunkt. Die aktive Auswahl bewegt sich dadurch nicht.
- Erst wenn die bestehende Navigation tatsächlich zu einer anderen Seite wechselt, gleitet die kräftige Auswahlfläche dorthin. Ihre Breite passt sich unterwegs an Symbol und Text an. Der Übergang dauert etwa 220–300 Millisekunden.
- Schnelle weitere Auswahlwechsel lenken die laufende Bewegung von ihrer sichtbaren Position um. Ein erneuter Klick auf die aktuelle Seite löst keine zusätzliche Bewegung aus.
- Werkzeuge, die nur ein Dialogfenster öffnen, verschieben die Modul-Auswahl nicht. Die bestehenden Zugangsvoraussetzungen der Navigation bleiben erhalten. Auch Tastatur- und andere reguläre Seitenwechsel verwenden die Auswahlbewegung.
- Reduzierte Bewegung überspringt den Flug. Größenänderungen und Scrollen beenden ihn an der tatsächlich ausgewählten Position.
- Die zuletzt ergänzten Aufklappanimationen, Glas-Schalter und die Randbeleuchtung bleiben bestehen.

## Funktionsschutz

36 von 38 vorhandenen Quelldateien sind gegenüber dem vorherigen Stand bytegenau unverändert. Angepasst wurden nur die Einbindung in `index.html` und die optischen Regeln in `liquid-motion.css`. Neu ist `liquid-selection.js`, das ausschließlich die vorhandene Auswahl beobachtet und ihre Darstellung animiert. Es löst selbst keine Navigation oder Fachaktion aus und speichert keine Anwendungszustände.

Alle 41 erfassten Dateien des Originalprojekts bleiben unverändert. Die Fachmodule, Main-Prozess-Dateien, Abhängigkeiten, bisherige Navigation und Inhaltsanimationen wurden nicht geändert.

## Fehlerdialog aus dem Screenshot

Der angegebene Stacktrace stammt aus `scripts/qa/keyboard-debug.cjs`, einem inzwischen entfernten Prüfskript. Der Fehler `EPIPE: broken pipe, write` trat bei dessen Konsolenausgabe nach Verlust der Ausgabeverbindung auf. Bei der Prozessprüfung war keine Instanz dieses Skripts mehr aktiv. Es war nicht Bestandteil der ausgelieferten EXE.

Das reguläre Electron-Prüfprogramm schreibt seine Ergebnisse jetzt in Dateien; sein übergeordnetes Startprogramm übernimmt die Konsolenausgabe. Die Anwendung selbst benötigt dafür keine Änderung.

## Lieferung

Die aktuelle EXE liegt im `dist`-Ordner unter `C:\Users\BazZTee\Downloads\SWG Mod Setup Tool Chat GPT` sowie als identische Kopie im Ausgabeordner. Dateiname: `ShishaWG-Mod-Setup-Tool-Portable-7.3.0-test-chat-gpt.exe`.

Die Videovorschau zeigt neben Hover und Randbeleuchtung jetzt auch echte Klicks mit gleitender Auswahl. Die Funktionsprüfung verwendet lokale Dienst-Antworten und sperrt Netzwerkzugriffe; echte Twitch-/Telegram-Sendungen oder Cloud-Schreibvorgänge werden dabei nicht ausgelöst.


108 Offline-Bedienprüfungen sind auch mit der tatsächlich verpackten Oberfläche bestanden, ohne Renderer-Fehler. 23 zentrale Paketdateien stimmen bytegenau mit den Quellen überein. Die portable EXE hat die Archivprüfung bestanden.

