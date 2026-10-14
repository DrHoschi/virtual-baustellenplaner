# Paket H – UX / Menüstruktur / Werkzeugkontext

Gate 2 authorized in chat on 2026-10-14. Base: 47d83cfa622e0d859e97687c8f99f7aacd900ac4 on dev/planner-neuaufbau. No main integration.

## Scope

Central transient mode and domain selection, filtered sidebars and viewer geometry, safe pointer dispatch. No additional electrical, camera or measuring features. Existing project geometry and persistence contracts remain authoritative. Visible workarea capture and focus calculations are unchanged.

Modes: select, pan, place object, place camera, draw tray, edit selection, assign cable, measurement evidence. Domain selection: all, objects, cameras, trays, cables. Explicit extra context is read-only and does not alter project layer visibility.

Selection renders a short card; detailed object/camera/tray editors require Edit. FOV is limited to the selected camera in Edit. Tray handles require the selected tray in Edit. Pan dispatch runs before object hit testing. Placement and drawing ignore existing element hits. A nonempty tray draft blocks mode changes until Finish or Cancel.

Cable assignment and measurement evidence reuse existing forms, with measurement fields only in the measurement mode. Background and workarea navigation remain available. Creating a workarea returns to selection without refocusing or altering the saved visible rectangle.

## Verification

Existing browser flows are adapted to explicit Edit and measurement transitions, preserving geometry, measurement and persistence assertions. New modes tests cover both 390x844 and 1180x820 viewports, pan over an object, domain filtering, read-only context, save/reload, tray draft cancellation and editor-only handles. Paket H CI runs all planner-v2 browser specs, including the large-hall workarea regression.

Local syntax/import checks passed. Local browser runner could not start reliably in this environment; remote CI is required before declaring verification complete. No new physical iPhone/iPad evidence is claimed. Gate 3 / freeze remains separate.
