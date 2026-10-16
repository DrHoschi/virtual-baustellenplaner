import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export const MAIN_SHA = 'be0061f6cca67c30adee8b476e8ea0265707ab18';
export const TEST_BRANCH = 'dev/planner-neuaufbau';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function prepare(output, sha, blockId, testBuild) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Exact lowercase SHA required');
  if (!blockId?.trim() || !testBuild?.trim()) throw new Error('Build labels required');
  if (fs.existsSync(output)) throw new Error('Output must not exist');
  if (git('rev-parse', `${sha}^{commit}`) !== sha) throw new Error('Commit mismatch');
  if (git('rev-parse', 'refs/remotes/origin/main') !== MAIN_SHA) throw new Error('Main changed: reconciliation required');
  execFileSync('git', ['merge-base', '--is-ancestor', sha, `origin/${TEST_BRANCH}`]);
  // Export two exact source trees; never copy a working tree or previous deployment.
  fs.mkdirSync(output, { recursive: true });
  const extract = (ref, target, subtree) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-archive-'));
    try {
      const archive = path.join(temp, 'source.tar');
      execFileSync('git', ['archive', '--output', archive, ref, ...(subtree ? [subtree] : [])]);
      execFileSync('tar', ['-xf', archive, '-C', target]);
    } finally { fs.rmSync(temp, {recursive:true,force:true}); }
  };
  extract(MAIN_SHA, output);
  if (fs.existsSync(path.join(output, 'planner-v2'))) throw new Error('Main owns reserved test path');
  extract(sha, output, 'planner-v2');
  for (const p of ['.github']) fs.rmSync(path.join(output, p), { recursive: true, force: true });
  const info = (branch, source, block, build) => ({ branch, sha: source, shortSha: source.slice(0,8), blockId: block, testBuild: build, deployedAt: new Date().toISOString() });
  const primary = info('main', MAIN_SHA, 'MAIN', 'stable');
  const test = info(TEST_BRANCH, sha, blockId, testBuild);
  fs.writeFileSync(path.join(output, 'build-info.json'), JSON.stringify(primary, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'planner-v2/build-info.json'), JSON.stringify(test, null, 2) + '\n');
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  const entry = path.join(output, 'planner-v2/index.html');
  let html = fs.readFileSync(entry, 'utf8');
  if (!html.includes('id="build-id"') || !fs.existsSync(path.join(output,'planner-v2/src/main.js'))) throw new Error('Test entry missing');
  // Static, artifact-bound identity remains visible even if metadata fetch fails.
  const identity = `NEUAUFBAU · ${blockId} · TESTBUILD ${testBuild} · ${sha.slice(0,8)}`;
  html = html.replace(/(<p[^>]*id="build-id"[^>]*>)[\s\S]*?(<\/p>)/, `$1${escapeHtml(identity)}$2`);
  html = html.replace('</h1>', `</h1><details id="deployment-identity" style="font-size:11px;overflow-wrap:anywhere;max-width:100%"><summary>Builddetails</summary><div>Branch: ${escapeHtml(TEST_BRANCH)}</div><div>SHA: ${sha}</div><div>Build: ${escapeHtml(blockId)} / ${escapeHtml(testBuild)}</div></details>`);
  fs.writeFileSync(entry, html);
  // The main entry must remain byte-identical to its pinned source.
  if (fs.readFileSync(path.join(output,'index.html'),'utf8') !== execFileSync('git',['show',`${MAIN_SHA}:index.html`],{encoding:'utf8'})) throw new Error('Main entry changed');
  console.log(JSON.stringify({main:primary,test},null,2));
}
if (process.argv[1] === new URL(import.meta.url).pathname) prepare(...process.argv.slice(2));
