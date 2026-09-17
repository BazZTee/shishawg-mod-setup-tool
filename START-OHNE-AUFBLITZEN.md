# Start direkt mit der neuen Oberfläche

Stand: 10. September 2026 · separate Chat-GPT-Testfassung · Version 7.3.0

Das Fenster wird zunächst unsichtbar erstellt. Sobald die Darstellungsskripte fertig sind, die Schriften bereitstehen und zwei Zeichenzyklen durchlaufen wurden, wird es angezeigt. Es gibt keine feste Wartezeit und keine Abhängigkeit von einer Twitch-Anmeldung oder anderen Online-Antworten.

Die bisherige HTML-Grundansicht wird während des Aufbaus zusätzlich ausgeblendet. Dieser Schutz wird auch beim Neuladen wieder freigegeben. Falls die Oberfläche tatsächlich nicht geladen oder aufgebaut werden kann, wird der Startfehler gemeldet, anstatt eine unvollständige Oberfläche zu zeigen. Ein bereits geschlossenes Fenster wird nicht nachträglich eingeblendet.

## Umfang

Geändert wurden die Fenstererstellung in `main.js` und die Einbindung in `index.html`. Hinzu kamen die beiden Darstellungshelfer `startup-window.js` und `startup-presentation.js`. 38 von 40 zuvor vorhandenen Quelldateien bleiben bytegenau unverändert, darunter alle Fachmodule, Dienst-Dateien, der IPC-Vertrag und die bisherigen Gestaltungsskripte.

Alle 41 erfassten Originaldateien im ursprünglichen Downloads-Ordner bleiben unverändert. Die Arbeiten betreffen ausschließlich die getrennte Chat-GPT-Testkopie.

## Prüfung

67 Funktionstests einschließlich Startfreigabe, vorzeitigem Schließen und Ladefehlern sind bestanden. Die Offline-Bedienprüfung verwendet den produktiven Startschutz mit der echten verpackten Oberfläche. An dessen Freigabepunkt wird sofort eine Bildschirmaufnahme erstellt, bevor die übrigen Bedienprüfungen beginnen. Zusätzlich wird das Neuladen geprüft.

Online-Dienste werden dabei durch lokale Antworten ersetzt; es werden keine echten Twitch- oder Telegram-Nachrichten versendet. Der Start wartet nicht darauf, dass nachladende Konto- oder Profildaten bereits angezeigt werden.

Die portable EXE liegt weiterhin unter `dist\ShishaWG-Mod-Setup-Tool-Portable-7.3.0-test-chat-gpt.exe` in der Testkopie und als identische Kopie im Ausgabeordner. `Vorschau-Erster-Fensterinhalt.png` zeigt den geprüften Freigabezeitpunkt. Die vorhandene Videovorschau der Bedienanimationen bleibt gültig; sie ist keine Aufnahme des Programmstarts.


127 Offline-Bedienprüfungen sind auch mit der tatsächlich verpackten Oberfläche bestanden, ohne Renderer-Fehler. 26 zentrale Paketdateien stimmen bytegenau mit den Quellen überein. Die portable EXE hat die Archivprüfung bestanden.

