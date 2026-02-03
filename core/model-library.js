let cache = null;

export async function loadLibraries() {
  if (cache) return cache;
  const [models, presets] = await Promise.all([
    fetch("./data/library.models.json").then(r=>r.json()),
    fetch("./data/presets.halls.json").then(r=>r.json())
  ]);
  cache = { models, presets };
  return cache;
}