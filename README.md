# Laundry Pilot Card

[![HACS](https://github.com/RF1705/laundry-pilot-card/actions/workflows/hacs.yml/badge.svg)](https://github.com/RF1705/laundry-pilot-card/actions/workflows/hacs.yml)
[![GitHub Downloads](https://img.shields.io/github/downloads/RF1705/laundry-pilot-card/total)](https://github.com/RF1705/laundry-pilot-card/releases)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-rf1705-ffdd00?logo=buy-me-a-coffee&logoColor=000000)](https://buymeacoffee.com/rf1705)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Eine Lovelace-Karte für Waschmaschinen in Home Assistant. **Waschpilot** bietet eine manuelle Programmauswahl, einen lokalen Programmassistenten und eine Laufansicht mit animierter Trommel.

Das erste Geräteprofil unterstützt Samsung über [LocalThings](https://github.com/mbillow/localthings). Die konkreten Programme und Bedienelemente hängen von den Entitäten deiner Maschine ab.

## Installation

### Über HACS installieren

1. Öffne HACS und wähle im Menü **Benutzerdefinierte Repositories**.
2. Füge `https://github.com/RF1705/laundry-pilot-card` mit der Kategorie **Dashboard** hinzu.
3. Lade **Laundry Pilot Card** herunter und lade das Dashboard neu.

Falls du die Ressource manuell eintragen musst, verwende `/hacsfiles/laundry-pilot-card/laundry-pilot-card.js` mit dem Typ **JavaScript-Modul**.

### Manuelle Installation

Lade `laundry-pilot-card.js` aus einem [Release](https://github.com/RF1705/laundry-pilot-card/releases) herunter, kopiere sie nach `www/` und registriere `/local/laundry-pilot-card.js` als **JavaScript-Modul**.

## Kartenkonfiguration

Füge eine manuelle Karte hinzu. Wenn deine Programmentität beispielsweise `select.samsung_washer_cycle` heißt, verwende `samsung_washer` als Präfix.

```yaml
type: custom:laundry-pilot-card
title: Waschmaschine
prefix: samsung_washer
```

| Option | Typ | Beschreibung |
| --- | --- | --- |
| `title` | Text | Kartentitel. Standard ist „Waschpilot“. |
| `prefix` | Text | Gemeinsamer Teil der LocalThings-Entitäts-IDs. Aktiviert das Samsung-Profil. |
| `entities` | Zuordnung | Überschreibt einzelne Entitäten. Ohne Präfix ist mindestens `entities.cycle` erforderlich. |
| `programs` | Zuordnung von Listen | Ordnet Wäschekategorien die Rohwerte der Programmauswahl zu. |

### Abweichende Entitäten und weitere Hersteller

Die Karte kann über explizite Entitäten konfiguriert werden. Dieses Beispiel zeigt das Schema für eine andere Integration. Passe die IDs und die Rohwerte an deine Maschine an.

```yaml
type: custom:laundry-pilot-card
entities:
  cycle: select.washer_program
  running: binary_sensor.washer_running
  phase: sensor.washer_phase
  finish: sensor.washer_finish
  start: button.washer_start
programs:
  daily: [mixed]
  cotton: [cottons]
  wool: [wool]
```

Für jedes Programm werden die Rohwerte in `attributes.options` der Programmentität unter **Entwicklerwerkzeuge → Zustände** geprüft. Unterstützte Kategorien sind `daily`, `cotton`, `denim`, `sports`, `towels`, `delicates` und `wool`. Werte mit führenden Nullen in YAML bitte als Text schreiben.

Optionale Rollen sind `temperature`, `rinses`, `spin` und `soil` (jeweils `select`), `intensive` (`switch`), `operation` und `phase` (Sensoren mit LocalThings-Zustandswerten), `finish` (Zeitstempel), `remaining` (Dauer), `progress` (0–100), `running` und `remote` (Binärsensoren) sowie `start`, `pause`, `resume` und `stop` (Schaltflächen). Für abweichende Statuswerte lässt sich in Home Assistant ein Templatesensor dazwischenschalten.

## Bedienung

- **Waschprogramm wählen** öffnet die verfügbaren Programme. Nach dem Übernehmen bleiben die verfügbaren Programmeinstellungen sichtbar.
- **Programm empfehlen lassen** fragt nach Wäscheart und Verschmutzungsgrad. Die Empfehlung startet die Maschine erst über die separate Schaltfläche **Starten**. Pflegeetiketten vor dem Start prüfen.
- **Während des Waschgangs** zeigt die Karte Phase, Restlaufzeit, voraussichtliches Ende und, falls verfügbar, den gemeldeten Fortschritt. Die Trommelanimation berücksichtigt die Systemeinstellung für reduzierte Bewegung.
- **Fernsteuerung** muss an der Maschine freigegeben sein, wenn die Integration den Smart-Control-Status bereitstellt.

## Releases

Beim Veröffentlichen eines GitHub-Releases prüft der Workflow die JavaScript-Datei am Release-Tag und hängt sie als `laundry-pilot-card.js` an. Der Workflow kann für bestehende Releases auch manuell gestartet werden.

## Support

[buymeacoffee.com/rf1705](https://buymeacoffee.com/rf1705)

## Lizenz

[MIT](LICENSE)
