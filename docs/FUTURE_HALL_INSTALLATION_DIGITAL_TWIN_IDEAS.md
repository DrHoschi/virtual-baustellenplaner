# Future Concept – Hall Installation Planning, Digital Twin & Emergency Viewer

Status: IDEA / FUTURE OPTION – NOT IMPLEMENTED
Date: 2026-09-08

This document records product ideas only. It does not authorize implementation and must not interfere with the current Workarea/UI migration.

## 1. Product direction

Extend the modular Baustellenplaner from detailed conveyor/assembly planning with a simpler hall-installation workflow for electrical/security installation projects.

Core principle: easy 2D planning on selected real mounting planes, while every object and route remains located in one authoritative 3D hall coordinate system.

## 2. Hall installation planning

Potential future block: `BP-HI – Hall Installation Planning`.

### BP-HI01 – Spatial Installation Model Foundation

Future contract candidate:

`3D hall -> mounting planes -> device instances -> ports -> route points -> shared XYZ world`

Possible mounting planes include:
- wall inside/outside,
- wall viewed from either side,
- ceiling/floor,
- structural beam/support surfaces,
- other explicitly defined installation planes.

The user should normally place objects and draw routes in a frontal 2D view of the selected plane. Internally every placement and route point must resolve to an unambiguous 3D position/orientation.

## 3. Technical asset library / Asset Lab

Build a reusable manufacturer/article-number based library over time.

Examples:
- thermal/fire-detection cameras,
- conventional cameras,
- network switches,
- cabinets,
- power supplies,
- sensors,
- plastic conduit,
- pipe fittings,
- Keddy/beam clamps and other mounting hardware.

Possible asset data:
- manufacturer and exact article number,
- GLB/3D representation,
- physical dimensions and mounting reference,
- technical ports/connectors,
- electrical/network properties relevant to planning,
- camera field-of-view data where applicable,
- compatible accessories and mounting parts.

CyberMotion may remain the detailed model-authoring tool; Baustellenplaner consumes approved assets and handles project placement, installation relationships and quantities.

## 4. Port-based cable planning

Devices should expose stable technical ports, e.g. `SW01/P01` and `CAM01/ETH`.

A cable is a connection between explicit source/target ports plus an editable routed path.

The route may consist of multiple 2D sections on different mounting planes. Plane transitions must preserve the same real 3D transition point so the complete route can be reconstructed and measured in XYZ space.

Target outcome:
- accurate geometric route length,
- explicit endpoint/service reserves,
- controlled rounding/cutting rules,
- cable cut list,
- less unnecessary cable reserve and waste,
- pre-cut, labelled and bundled installation sets.

Do not require automatic routing initially. Manual deterministic routing is sufficient for the first usable version.

## 5. Installation material calculation

Route sections may later carry an installation method such as:
- plastic conduit,
- beam/Keddy clamps,
- wall clips,
- cable tray,
- other mounting systems.

From route geometry and configurable spacing/rules the planner may derive quantities for conduit, connectors, bends, clamps and related installation material.

## 6. 3D Project Viewer

Planning and presentation should be separate modes using the same project data.

The 3D viewer should allow a finished hall project to be inspected and demonstrated without requiring the user to edit it in free 3D.

Potential functions:
- navigate through the hall,
- select installed equipment,
- show identifiers and technical relationships,
- visualize cable/routes when useful,
- export/share an appropriate project representation,
- customer-facing read-only viewer option.

## 7. Camera View

A camera asset should be more than a visual model. A project camera instance may contain:
- exact XYZ mounting position,
- orientation,
- mounting height/reference,
- horizontal/vertical field of view,
- relevant manufacturer/model data.

The viewer may provide `Open Camera View`, positioning the virtual viewer at the planned camera pose to approximate what the installed camera should see. A visible frustum/coverage cone may optionally be shown in the hall view.

For thermal/fire-detection cameras this can support planning and later operational visualization.

## 8. Digital Twin / Operations layer

Potential future block: `BP-DT – Digital Twin & Operations Viewer`.

Keep live data separate from authoritative static planning data. A stable project instance ID maps to a real device through an adapter/integration layer.

Possible live states:
- online/offline,
- alarm,
- temperature/thermal values where supported,
- device-specific measurements/events.

Example future behavior: a real camera raises an alarm -> its project instance is highlighted -> viewer focuses the location -> operator can open the planned camera view and/or an integrated real device feed if supported.

No specific manufacturer API/protocol is assumed here. Integration must be evaluated from exact device/article data later.

## 9. Emergency / Fire Brigade Viewer

Potential optional module: `BP-EM – Emergency Viewer`.

Purpose: provide a deliberately simple, read-only emergency view derived from the maintained project/digital twin.

Potential capabilities:
- show the alarm/fire location in the 3D building/hall context,
- highlight the affected camera/device/zone,
- provide building orientation,
- show relevant access/approach information where authoritative project data exists,
- jump directly to affected area/camera view,
- expose only emergency-relevant information rather than the full planning UI.

Important: route guidance must never invent a safe or passable route. Any future emergency routing/navigation requires authoritative, maintained data about entrances, barriers, hazards, accessibility and current conditions. The viewer is decision support, not a replacement for emergency procedures or incident command.

Product/licensing idea: this emergency/read-only module could potentially be made available free of charge to authorized fire/rescue services while commercial planning, maintenance and operations modules remain licensed. This is a business option, not a committed licensing decision.

## 10. Modular product concept

Possible long-term module separation:
- Core Project / Spatial Model
- Asset Lab / Technical Library
- Hall Installation Planning
- Cable & Material Planning
- 3D Project Viewer
- Camera Planning / Camera View
- Digital Twin / Live Operations
- Emergency / Fire Brigade Viewer

A customer installation should only enable modules it needs. All modules should consume the same stable project/asset identities rather than maintaining incompatible copies of geometry or device data.

## 11. Commercial/service concept

Possible model:
- customer receives an always-current project/viewer,
- customer can maintain permitted simple data itself,
- specialist changes/assets can be maintained as a paid service,
- reusable manufacturer/article assets grow into a technical library,
- planning software and optional operational modules may later be offered through subscription/licensing.

No pricing or licensing model is decided by this document.

## 12. Current implementation boundary

NOT IMPLEMENTED by this document.

Do not start Digital Twin, emergency integration, automatic routing, live camera integration or material automation while the current UI/Workarea migration is active merely because they are documented here.

Before implementation, reconcile the current repository and define a narrow contract for the first block. The intended first foundation is the shared spatial model: hall + mounting planes + device instances + ports + route points + unambiguous XYZ transformation.
