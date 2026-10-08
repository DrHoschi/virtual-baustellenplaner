# Parameter-Pack: Rollenbahn + Quer-Verschiebewagen (Heavy, vB)

Enthält JSON-Dateien, um das neue GLB sauber im Baustellenplaner-Projekt zu parametrieren.

## Inhalte

- `data/params/rollerbahn_transferwagen_heavy_vB_5p5x1p8.params.json`
  - Default-Parameter (Maße, Fahrweg, Sensoren) + GLB-Node-Mapping (TransferCar_*, RailPart_*).

- `data/schema-addons/properties.schemas.transfercar.addon.json`
  - Addon-Block, den du in `data/properties.schemas.json` unter `types` einfügen kannst,
    damit im **Properties-Panel** ein eigener Typ `conveyor.transfercar` verfügbar ist.

- `data/params/objects.template.transfercar.json`
  - Beispiel-Objekt (Template), das du später in `projects/<ID>/data/objects.json` ablegen kannst,
    sobald echte Objektpersistenz im Workarea aktiv ist.

## Einpflege-Hinweise (kurz)

1) Parameterdatei ablegen:
- Empfohlen: `data/params/…` (neuer Ordner, klar getrennt)

2) Schema-Addon:
- In `data/properties.schemas.json` unter `types` einfügen.

3) (Optional) GLB Parent-Node
- Aktuell liegen alle Nodes direkt unter `world`.
- Das Mapping nutzt daher den Prefix `TransferCar_`.
- Später kann man im GLB eine Parent-Node `TransferCar` anlegen → dann reicht ein Transform.
