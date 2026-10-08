# Baugruppen- und Varianten-System V1

## Grundidee

Für die Anlage **KP 62 Pufferspeicher Audi** sollen Hauptkomponenten nicht jedes Mal neu gebaut werden. Stattdessen gibt es wenige Master-Baugruppen mit Maximalausbau.

Beispiele:

```text
Master-Rollenbahn Max
Master-Verschiebewagen Max
Master-Heber Max
Master-Rollenbogen
```

Aus diesen Master-Baugruppen werden konkrete Instanzen in der Workarea erzeugt.

```text
Template      = Baukasten / Master
Variant       = Ausstattung / Konfiguration
Instance      = konkrete platzierte Baugruppe
Component     = Unterteil der Baugruppe
Port          = Anschlussstelle
Connection    = Verbindung zwischen zwei Ports
BOM           = Stückliste
```

## Warum diese Struktur wichtig ist

Eine Rollenbahn kann später viele Varianten haben:

```text
- einfache Rollenbahn
- Rollenbahn mit Sensoren rechts
- Rollenbahn mit Sensoren links
- Rollenbahn mit Sensoren beidseitig
- Rollenbahn mit Stopper
- Rollenbahn mit MOVIFIT
- Rollenbahn mit Wartungsschalter
```

Trotzdem soll es nur einen gepflegten Master geben. Die Variante entscheidet, welche Teile wirklich aktiv sind.

## Template

Ein Template beschreibt, was grundsätzlich möglich ist.

Beispiel:

```json
{
  "id": "template.roller-conveyor.max.v1",
  "family": "rollenbahn",
  "components": [],
  "ports": [],
  "variants": []
}
```

## Variant

Eine Variante beschreibt, welche Komponenten aktiv sind.

```json
{
  "id": "rb.bidirectional.both_sides",
  "label": "Beide Richtungen - Sensoren beidseitig",
  "enabledComponents": [
    "frame",
    "rollers",
    "drive_motor_right",
    "movifit",
    "sensor_stop_forward_right",
    "sensor_slow_forward_right",
    "sensor_stop_backward_left",
    "sensor_slow_backward_left"
  ]
}
```

## Instance

Eine Instanz ist das konkrete Objekt in der Workarea.

```json
{
  "id": "asm-...",
  "templateId": "template.roller-conveyor.max.v1",
  "variantId": "rb.bidirectional.both_sides",
  "name": "RB-6201",
  "x": 0,
  "y": 0,
  "rotation": 0
}
```

## Ports

Ports sind technische Anschlusspunkte.

Beispiele:

```text
400V_IN
PE
MOTOR_OUT
SENSOR_STOP_FWD
SENSOR_SLOW_FWD
NETWORK_IN
NETWORK_OUT
```

Damit kann später ein Kabel-/Verbindungsmodus entstehen:

```text
ES-Schrank / Abgang 400V → Wartungsschalter → MOVIFIT → Motor
MOVIFIT DI1 → Sensor Stop Vorwärts
MOVIFIT DI2 → Sensor Schnell/Langsam
```

## Stückliste

Die Stückliste wird aus aktiven Komponenten erzeugt. Inaktive Komponenten des Masters zählen nicht.

Dadurch kann eine Rollenbahn mit beidseitiger Sensorik automatisch mehr Sensoren und Kabelpunkte enthalten als eine einfache Rollenbahn.

## Nächster sinnvoller UI-Schritt

Nach diesem Grundpatch sollte als nächstes kommen:

```text
PATCH_workarea_assembly_insert_and_variant_panel_v1
```

Darin würden wir:

1. Im Workarea-Assets-Tab eine Kategorie „Baugruppen“ anzeigen.
2. Master-Rollenbahn, Master-Verschiebewagen, Master-Heber auswählbar machen.
3. Beim Einfügen eine Assembly-Instance erzeugen.
4. Im rechten Panel Variante, Name, Fördergruppe, Motorseite, Sensorseite ändern.
5. Stückliste live berechnen.
