/**
 * ProjectAssetsPanel.js
 * PATCH_ui_thumbnails_refined_v1
 * - Thumbnail size: 96px
 * - Layout: thumbnail left, content right
 * - No store logic changed
 */

// Rendering snippet example:
function renderThumbnail(slot) {
  const img = document.createElement("img");
  img.className = "pa-thumb";
  img.src = slot?.thumbnail?.dataUrl || "";
  return img;
}
