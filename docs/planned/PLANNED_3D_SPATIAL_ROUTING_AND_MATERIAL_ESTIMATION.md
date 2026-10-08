# Virtual Baustellenplaner – Planned 3D Spatial Routing & Material Estimation

**Status: PLANNED / IDEA RECORDED / NOT AUTHORIZED FOR IMPLEMENTATION**

This note records a future capability only. It does not authorize implementation or modify the current development sequence.

## Core Idea

The 3D viewer should later allow the user to sketch an installation intent directly in the scene, especially with touch/Pencil input on iPad. The drawn stroke is not required to be the exact technical route. It expresses where a cable, line, hose or similar installation should travel.

The planner then derives a technically plausible editable 3D route/spline from known scene geometry and domain data.

## Example: MOVIFIT to MOVIFIT

Candidate workflow:

`Select connection A → draw approximate route with Pencil → select connection B → assisted routing → preview 3D spline → manually fine-adjust handles/segments → calculate material length`

If a known cable tray is close to the intended route, the planner may propose:

`MOVIFIT A → connection reserve → suitable tray entry → route along tray network → suitable tray exit → MOVIFIT B → connection reserve`

The user remains authoritative and can adjust the generated route in 3D, especially the free segments between device and tray.

## Routing Knowledge

Future routing may use known scene/domain information such as:

- connection/socket positions on equipment
- cable tray geometry and usable routing corridor/centerline
- tray junctions, entries and exits
- permitted/forbidden routing regions
- start/end device types
- installation-specific parameters
- manually placed route handles or mandatory waypoints

The same core concept may later support cables, network lines, hoses, pneumatic lines, pipes or other routed installation media. Each domain can supply its own rules rather than hardcoding cable-specific behavior into the geometric routing core.

## Parameter / Elektroplaner Integration

Equipment or connection definitions may provide additional material parameters. Example: a MOVIFIT connection may require a defined cable reserve from gland/connection into the device.

Candidate calculation:

`3D route length + start reserve + end reserve + other defined installation reserves = technical required length`

A project/material-specific configurable allowance may then be applied, for example 10 percent where appropriate. The allowance must be data/configuration driven, not globally hardcoded.

## Material Estimation Output

The resulting route should be usable as structured data, not only as a visual line. Candidate outputs include:

- start/end connection IDs
- route/spline control points
- tray segments used
- free-routing segments
- segment lengths
- total geometric length
- connection reserves
- configured allowance
- final material quantity/length

This can later feed material lists and electrical planning calculations.

## Direct 3D Input vs Screenshot

A screenshot/reference image may be useful in some workflows, but it is not the primary requirement for this capability. When the real 3D scene is available, direct drawing/tracing inside the viewer is preferred because camera, scene geometry and object coordinates are already known.

## Shared Geometry Foundation

CyberMotion's planned Reference Plane / Trace and the Baustellenplaner's assisted routing may share low-level geometry concepts such as points, polylines, splines, projection and editable handles. They remain different domain capabilities:

- CyberMotion: reference/trace → editable sketch/geometry
- Baustellenplaner: user route intent → domain-aware 3D installation route → length/material data

The shared concepts should not force the two applications into one workflow.

## Interaction / Device Direction

The capability should be designed with iPad/Pencil use as a first-class interaction. Touch/Pencil drawing, selection and 3D fine adjustment must be reconciled separately for iPhone/iPad/desktop responsive layouts before implementation.

## Guardrails

- PLANNED only; no implementation authorization.
- Current Baustellenplaner development remains unchanged.
- User-drawn input expresses intent; generated routing must remain previewable and editable.
- Automatic tray routing must never silently overwrite manual routing decisions.
- Material reserves and percentage allowances are configurable domain/project data.
- Exact routing algorithms, graph contracts, spline representation and UI require separate future reconciliation.