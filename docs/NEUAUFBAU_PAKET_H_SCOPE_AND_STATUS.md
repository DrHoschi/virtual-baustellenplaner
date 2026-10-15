# Paket H – UX / Menüstruktur / Werkzeugkontext

Gate 2 authorized in chat on 2026-10-14. Base: 47d83cfa622e0d859e97687c8f99f7aacd900ac4 on dev/planner-neuaufbau. No main integration.

## Scope

Central transient mode and domain selection, filtered sidebars and tool-specific viewer geometry, with persistent camera/FOV context, safe pointer dispatch. No additional electrical, camera or measuring features. Existing project geometry and persistence contracts remain authoritative. Visible workarea capture and focus calculations are unchanged.

The toolbar has one central Fachgruppe selection and a second Tätigkeit selection. Tätigkeiten are filtered by Fachgruppe; the default shows objects only. Editing is offered once on the selected element. The duplicate tool buttons and extra-context checklist are removed. The build label reads the actual build metadata instead of a hard-coded Paket E-Fix label.

On phones, Objektbaum and Eigenschaften start collapsed and open on demand. Ground plan upload, calibration and area dimensions sit inside one collapsed Projekteinstellungen section. Desktop panels remain open. No additional electrical, camera or measurement features are introduced.

Selection renders a short card; detailed object/camera/tray editors require Edit. Camera symbols and every configured FOV stay visible in the viewer regardless of the active Fachgruppe, activity, or selected camera (unless their project layer is explicitly hidden). This is contextual plan geometry, not an extra tool panel; camera editing remains gated by selection and Edit. Tray handles require the selected tray in Edit. Pan dispatch runs before object hit testing. Placement and drawing ignore existing element hits. A nonempty tray draft blocks mode changes until Finish or Cancel.

Cable assignment and measurement evidence reuse existing forms, with measurement fields only in the measurement mode. Background and workarea navigation remain available. Creating a workarea returns to selection without refocusing or altering the saved visible rectangle.

## Verification

Browser flows use the central selectors and selected-element editor while preserving geometry, measurement and persistence assertions. Modes tests cover both 390x844 and 1180x820 viewports, a single tool bar, filtered activities, mobile disclosures, pan over an object, save/reload, tray draft cancellation and editor-only handles. Paket H CI runs all planner-v2 browser specs, including calibration and the large-hall workarea regression.

Exact-head Paket H CI passed on d68affb043024f544cb104666f6f93d2c0e52866: syntax and import checks succeeded; all 32 Playwright browser tests passed. TEST-DEPLOY-01 run #43 published Packet-H · TESTBUILD 5 from that exact SHA successfully. The user manually confirmed that cameras are visible again; the specific device/browser was not stated, so no broader iPhone/iPad evidence is claimed. Gate 3 completion/evidence/freeze is documented separately. main remains unchanged.
