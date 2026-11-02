// Evidence aggregation only. Never edits game state, source or user storage.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir='reports/final-audit/';
const read=f=>JSON.parse(fs.readFileSync(dir+f,'utf8'));
const all=read('all-final.json'),classic=read('browser-results.json'),endings=read('ui-results.json'),long=read('endurance.json'),release=read('release-audit.json');
assert.equal(all.version,'2.0.0-rc.4');
assert.equal(all.counts.tests,515);assert.equal(all.counts.pass,515);assert.equal(all.counts.fail,0);assert.equal(all.counts.skipped,0);
assert.equal(classic.classic.length,20);assert.ok(classic.classic.every(r=>r.status==='PASS'&&r.stars===3));assert.deepEqual(classic.errors,[]);
assert.equal(endings.length,5);assert.equal(new Set(endings.map(r=>r.ending)).size,5);assert.ok(endings.every(r=>r.status==='PASS'));
for(const f of ['operations.json','pages.json','beginner-browser.json','story-ui.json','audio-results.json'])assert.equal(read(f).status,'PASS',f);
assert.equal(long.status,'PASS');assert.equal(long.phases.length,4);assert.ok(long.elapsedSeconds>=900);assert.deepEqual(long.errors,[]);
assert.equal(release.status,'STATIC CHECKS PASS');assert.ok(release.runtimeUnchanged.every(r=>r.unchanged));
const documents=['AUDIT_REPORT.md','TEST_RESULTS.md','PERFORMANCE.md','IPHONE_CHECKLIST.md','OPEN_ISSUES.md','RELEASE_READINESS.md'];
for(const f of documents){const text=fs.readFileSync(dir+f,'utf8');assert.ok(!text.includes('\r'),f+' must use LF');for(const m of text.matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:|#)/.test(m[1]))continue;assert.ok(fs.existsSync(path.resolve(dir,m[1])),f+' missing '+m[1]);}}
const performance=long.phases.map(p=>({kind:p.kind,actions:p.actions,fps:[Math.min(...p.samples.map(r=>r.fps)),Math.max(...p.samples.map(r=>r.fps))],drawFps:[Math.min(...p.samples.map(r=>r.drawFps)),Math.max(...p.samples.map(r=>r.drawFps))],heapDelta:p.heapDelta,domDelta:p.domDelta,initial:p.initial,final:p.final}));
const result={version:all.version,verdict:'CONDITIONAL',tests:all.counts,classic:'20 real UI clears, all 3 stars',endings:'5 real UI arrivals',runtime:'unchanged from audit start',enduranceSeconds:long.elapsedSeconds,performance,unverified:['iPhone final acceptance','OS audio/share and heat','ownership and public license'],documents};
fs.writeFileSync(dir+'audit-final.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
