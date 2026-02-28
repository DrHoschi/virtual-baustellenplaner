/**
 * WorkareaPanel.js
 * PATCH_ui_thumbnails_refined_v1
 * - Sidebar thumbnails: 80px
 * - Reduced padding
 * - No scene logic changed
 */

function renderSidebarThumb(slot) {
  const img = document.createElement("img");
  img.className = "wa-thumb";
  img.src = slot?.thumbnail?.dataUrl || "";
  return img;
}
