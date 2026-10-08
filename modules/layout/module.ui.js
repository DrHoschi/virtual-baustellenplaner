export function getLayoutUI() {
  return {
    tabs: [
      {
        id: "layout",
        title: "Layout",
        icon: "grid",
        panels: ["layout.tools", "layout.layers"]
      }
    ],
    panels: {
      "layout.tools": { type: "toolbox", tools: ["select", "area", "route"] },
      "layout.layers": { type: "layers", layers: ["areas", "objects", "routes"] }
    }
  };
}
