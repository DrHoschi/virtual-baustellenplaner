# PATCH_assemblylab_cabletype_classifier_hotfix_v1

## Zweck

Korrigiert die automatische Kabelpunkt-Klassifizierung im AssemblyLab.

Vorher wurden Anschlüsse mit Signalen wie `L1/L2/L3/PE` oder `U/V/W/PE` teilweise als reiner `PE / Potentialausgleich` erkannt, weil die Textsuche nach `PE` zu früh ausgeführt wurde.

## Korrektur

Die Klassifizierung prüft jetzt zuerst eindeutige Port-Keys und technische Hauptfunktionen:

- `PWR_400V_IN`, `PWR_400V_OUT` → `power_400v`
- `MOTOR_OUT`, `MOTOR_POWER_IN` → `motor`
- `STO_IN`, `SAFETY_PANEL_OUT` → `safety_sto`
- `PN_IN`, `PN_OUT` → `profinet`
- `CTRL_24V_IN`, `BRAKE_IN` → `dc_24v`
- `SENSOR_24V`, `SENSOR_SIGNAL` → `sensor`
- `PE`, `PA` → `pe_pa`

Erst danach erfolgt die allgemeine Textsuche nach PE/PA.

## Wichtig beim Test

Nach dem Einspielen bitte bei einer bestehenden Baugruppe:

1. `Kabelpunkte neu` drücken.
2. `Kabelliste neu` drücken.
3. `Export Kabelliste JSON` drücken.
4. Prüfen:
   - 400V Einspeisung ist `power_400v`, nicht `pe_pa`.
   - Motorabgang / Motor Leistung ist `motor`, nicht `pe_pa`.
   - Bedienpult / Safety Ausgang ist `safety_sto`, nicht `pe_pa`.
   - echte PE/PA-Ports bleiben `pe_pa`.

## Dateien

- `ui/panels/WorkareaPanel.js`
