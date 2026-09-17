# Bewegter Liquid-Effekt

Ergänzung zur Blue-Glass-Testfassung · 9. September 2026

Die Seitenleiste besitzt jetzt eine gemeinsame bewegliche Glashervorhebung. Sie folgt dem Mauszeiger von Eintrag zu Eintrag, zieht weich nach und verformt sich während der Bewegung leicht. Beim Verlassen der Navigation kehrt sie zum aktuell geöffneten Modul zurück. Die aktuelle Auswahl bleibt auch während des Hovers erkennbar.

Auf den Modulkarten der Übersicht und auf den Arbeitsflächen folgen Lichtreflexe und eine beleuchtete Glaskante dem Mauszeiger. Die Reflexe laufen weich nach und verblassen beim Verlassen. Texte und Bedienelemente werden dabei nicht bewegt oder verzerrt. Auch dynamisch erzeugte Dashboard-Widgets erhalten den Effekt.

Die dekorativen Flächen fangen keine Klicks ab. Die Einstellung „Animationen reduzieren“ und die entsprechende Systemeinstellung werden berücksichtigt. Für reduzierte Transparenz gibt es eine ruhigere Darstellung. Ein gemeinsamer Animationsablauf läuft nur während einer Veränderung und stoppt im Ruhezustand; unsichtbare Fenster pausieren ihn.

## Unveränderte Anwendung

Im Vergleich zur vorherigen Blue-Glass-Fassung sind 32 von 33 bestehenden Quelldateien bytegenau unverändert. Lediglich `src/renderer/index.html` bindet zwei neue Darstellungsdateien ein:

- `src/renderer/liquid-motion.js`
- `src/renderer/liquid-motion.css`

Sämtliche vorhandenen Fachlogiken, die elf Renderer-Module, die generierte `renderer.js`, die bestehende Navigation, die bisherigen Design-Dateien und der gesamte Main-Prozess bleiben unverändert. Der neue Effekt verändert keine Fachdaten und ruft keine Dienste auf. Die 41 erfassten Originaldateien im ursprünglichen Download-Ordner sind ebenfalls unverändert.

## Prüfung und Vorschau

Abschluss: **73 Offline-Bedienprüfungen bestanden, keine Renderer-Fehler.** Dabei ist auch geprüft, dass der neue Animationsablauf im Ruhezustand keine weiteren Animationsbilder anfordert. 19 zentrale verpackte Dateien stimmen bytegenau mit den Quellen überein. Die portable EXE hat die Archivintegritätsprüfung bestanden.

Die Prüfung verwendet die tatsächlich verpackte Electron-Oberfläche mit lokalen Testantworten. Neben den bisherigen Bedienprüfungen werden echte Mausereignisse im unsichtbaren Testfenster erzeugt: Zwischenposition der bewegten Navigationsfläche, Ankunft am Ziel, Rückkehr zur Auswahl, Verlauf und Verblassen der Kartenreflexe, Durchreichen echter Klicks, eingeklappte Navigation und reduzierte Bewegung.

`Liquid-Effekt-Vorschau.mp4` zeigt eine Aufnahme der tatsächlich laufenden Oberfläche mit lokalen Beispieldaten. Der weiße Kreis markiert ausschließlich für die Vorschau die simulierte Mausposition. Die Glaseffekte stammen unverändert aus der Anwendung.

Die EXE heißt weiterhin `ShishaWG-Mod-Setup-Tool-Portable-7.3.0-test-chat-gpt.exe` und liegt im `dist`-Ordner der getrennten Chat-GPT-Projektkopie sowie im Ausgabeordner. Vor dem Vergleich eine laufende ältere Testfassung regulär schließen und die aktualisierte EXE starten.
