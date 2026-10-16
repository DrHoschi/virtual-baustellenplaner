import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepare, MAIN_SHA } from '../scripts/prepare-separated-pages.mjs';
const frozen = 'd68affb043024f544cb104666f6f93d2c0e52866';
test('two pinned trees, separate identity, unchanged main and runtime', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-test-'));
  try {
    const out = path.join(temp,'site');
    prepare(out, frozen, 'Paket-H', '6');
    const main = JSON.parse(fs.readFileSync(path.join(out,'build-info.json')));
    const dev = JSON.parse(fs.readFileSync(path.join(out,'planner-v2/build-info.json')));
    assert.equal(main.sha, MAIN_SHA);
    assert.equal(dev.sha, frozen);
    assert.equal(dev.branch, 'dev/planner-neuaufbau');
    assert.notEqual(fs.readFileSync(path.join(out,'index.html'),'utf8'), fs.readFileSync(path.join(out,'planner-v2/index.html'),'utf8'));
    const source = execFileSync('git',['show',`${frozen}:planner-v2/src/main.js`],{encoding:'utf8'});
    assert.equal(fs.readFileSync(path.join(out,'planner-v2/src/main.js'),'utf8'), source);
    assert.ok(fs.readFileSync(path.join(out,'planner-v2/index.html'),'utf8').includes(frozen));
    assert.ok(!fs.existsSync(path.join(out,'.github')));
    const paths = execFileSync('git',['ls-tree','-r','--name-only',frozen,'planner-v2'],{encoding:'utf8'}).trim().split('\n');
    for (const file of paths.filter(p => p !== 'planner-v2/index.html' && p !== 'planner-v2/build-info.json')) {
      assert.deepEqual(fs.readFileSync(path.join(out,file)), execFileSync('git',['show',`${frozen}:${file}`],{maxBuffer:64*1024*1024}), file);
    }
    assert.throws(() => prepare(out, frozen, 'H','6'), /must not exist/);
    assert.throws(() => prepare(path.join(temp,'bad'), 'main','H','6'), /Exact/);
    assert.throws(() => prepare(path.join(temp,'empty'), frozen,'','6'), /labels/);
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});
