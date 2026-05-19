# PATCH_assemblylab_ports_v1

## Ziel

Dieser Patch erweitert AssemblyLab/Baugruppen um rollenbasierte Ports bzw. Anschlusspunkte. Er baut auf `PATCH_assemblylab_bom_v1` auf.

## Enthaltene Datei

- `ui/panels/WorkareaPanel.js`
- `docs/PATCH_assemblylab_ports_v1_README.md`

## Fachlicher Inhalt

Bauteile bekommen jetzt automatisch Port-Vorlagen abhängig von ihrer Rolle:

### Steuerung / MOVIFIT

- 400V Einspeisung
- 24V DC Versorgung
- STO / Safety Eingang
- Bedienpult / Safety Ausgang
- Motorabgang
- Profinet IN
- Profinet OUT

Hinweis: Der Bedienpult-/Safety-Ausgang ist bewusst als Startmodell enthalten, weil später die Sicherheitsbereiche und Bedienpulte verkabelt/zugeordnet werden sollen.

### Antrieb / Motor

- Motor Leistung
- Bremse 24V optional
- PE / Potentialausgleich

### Sensor

- Sensor 24V
- Sensorsignal

### Wartungsschalter

- 400V Eingang
- 400V Ausgang
- PE / Potentialausgleich

### Klemmkasten / Verteiler

- Klemmpunkt 400V
- Klemmpunkt 24V
- Klemmpunkt Safety/STO

### Rahmen / Stütze / Schutz

- PE / Potentialausgleich optional

## Speicherung

Ports werden gespeichert unter:

- `component.ports[]`
- `componentRefs[].portCount`
- `assembly.instance.ports[]`

Damit sind sie reload-sicher und können später für Kabelpunkte/Kabellisten verwendet werden.

## Anzeige

Im Properties-Panel einer ausgewählten Baugruppe werden jetzt angezeigt:

- Port-Anzahl in der Kopfzeile
- Port-Zusammenfassung je Bauteil
- eigener Abschnitt `Ports / Anschlusspunkte`

## Checks

Geprüft:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.

## Einspielreihenfolge

1. `PATCH_assemblylab_v1`
2. `PATCH_assemblylab_mobile_polish_v1`
3. `PATCH_assemblylab_properties_v1`
4. `PATCH_assemblylab_properties_hotfix_v1`
5. `PATCH_assemblylab_component_roles_v1`
6. `PATCH_assemblylab_bom_v1`
7. `PATCH_assemblylab_ports_v1`
