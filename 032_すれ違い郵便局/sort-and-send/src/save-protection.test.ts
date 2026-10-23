import { describe, it, expect } from 'vitest';
import { createProgressStore, memoryStorage, productionProgressKey as key, freshProgress } from './progress';
import { SaveCoordinator } from './save-coordinator';
import { createLabStore, productionLabKey } from './lab';
import { resetProgressAndLab, recordRunOutcome } from './lab-integration';
import { stages } from './stage';
import ratings from './generated/stage-ratings.json';
import { isSolverSummary } from './scoring';
import { simulate } from './simulation';
import { stageFingerprint } from './fingerprint';
const ids = stages.map(s => s.id);
const summaries = (ratings as unknown[]).filter(isSolverSummary);
describe('AUD-001 independent recovery', () => {
  it('keeps normal stars, IDs and settings around bad values, then saves safely', () => {
    const storage = memoryStorage();
    storage.setItem(key, JSON.stringify({ ...freshProgress(ids), bestStars: { '01':3, '02':9, '03':2 }, clearedStageIds:['01',null,'03'], unlockedStageIds:['01',5,'03'], settings:{sfx:false,bgm:true,volume:2,reducedMotion:true} }));
    const p=createProgressStore(ids,storage);
    expect(p.data.bestStars).toEqual({'01':3,'03':2}); expect(p.data.clearedStageIds).toEqual(['01','03']);
    expect(p.data.settings).toEqual({sfx:false,bgm:true,volume:.35,reducedMotion:true});
    p.recordResult('02',true,1); const reload=createProgressStore(ids,storage);
    expect(reload.data.bestStars).toEqual({'01':3,'02':1,'03':2}); expect(reload.isUnlocked('04')).toBe(true);
  });
  it('does not turn stars alone into invented clears',()=>{
    const s=memoryStorage();s.setItem(key,JSON.stringify({...freshProgress(ids),bestStars:{'03':3},clearedStageIds:'bad'}));
    const p=createProgressStore(ids,s);expect(p.data.bestStars['03']).toBe(3);expect(p.data.clearedStageIds).toEqual([]);expect(p.isUnlocked('04')).toBe(false);
  });
  it.each(['{','null','{"schemaVersion":98}'])('protects opaque root %s',raw=>{
    const s=memoryStorage();s.setItem(key,raw);const p=createProgressStore(ids,s);p.recordResult('01',true,3);p.setSettings({...p.data.settings,sfx:false});expect(p.reset(true)).toBe(false);expect(s.getItem(key)).toBe(raw);
  });
  it('loads legacy schema1 without loss or eager migration',()=>{
    const s=memoryStorage(),raw=JSON.stringify({...freshProgress(ids),bestStars:{'01':3},clearedStageIds:['01']});s.setItem(key,raw);
    const p=createProgressStore(ids,s);expect(p.data.bestStars['01']).toBe(3);expect(s.getItem(key)).toBe(raw);p.recordResult('01',true,2);expect(createProgressStore(ids,s).data.bestStars['01']).toBe(3);
  });
});
describe('AUD-002 coordinated saves and generations',()=>{
  it('merges old A star2 with B star3 and independent clears',()=>{
    const s=memoryStorage(),a=createProgressStore(ids,s),b=createProgressStore(ids,s);
    a.recordResult('01',true,2);b.recordResult('01',true,3);b.recordResult('02',true,1);a.recordResult('03',true,2);
    const p=createProgressStore(ids,s);expect(p.data.bestStars).toEqual({'01':3,'02':1,'03':2});expect(p.isUnlocked('04')).toBe(true);
  });
  it('synchronizes external storage updates without saving stale settings',()=>{
    const s=memoryStorage(),a=createProgressStore(ids,s),b=createProgressStore(ids,s);a.recordResult('01',true,3);b.sync();expect(b.data.bestStars['01']).toBe(3);
    a.setSettings({...a.data.settings,bgm:true});b.setSettings({...b.data.settings,sfx:false});expect(createProgressStore(ids,s).data.settings).toMatchObject({bgm:true,sfx:false});
  });
  it('protects an unknown schema replaced after startup',()=>{
    const s=memoryStorage(),a=createProgressStore(ids,s);const raw='{"schemaVersion":99,"keep":true}';s.setItem(key,raw);a.recordResult('01',true,3);a.setSettings({...a.data.settings,sfx:false});expect(s.getItem(key)).toBe(raw);
  });
  it('fences old tabs after reset, permits reload and preserves settings',()=>{
    const s=memoryStorage(),a=createProgressStore(ids,s),b=createProgressStore(ids,s);a.recordResult('01',true,3);a.setSettings({...a.data.settings,bgm:true});expect(a.reset(true)).toBe(true);
    b.recordResult('01',true,3);b.setSettings({...b.data.settings,sfx:false});expect(b.status).toBe('stale-generation');const p=createProgressStore(ids,s);expect(p.data.bestStars).toEqual({});expect(p.data.settings.bgm).toBe(true);p.recordResult('01',true,1);expect(createProgressStore(ids,s).data.bestStars['01']).toBe(1);
  });
  it('blocks both LAB resurrection and unsafe reset in an old tab',()=>{
    const s=memoryStorage(),a=createProgressStore(ids,s),b=createProgressStore(ids,s),lab=createLabStore(stages,summaries,s);
    for(const id of ids)a.recordResult(id,true,1);b.sync();const config={a:['L','R'] as ('L'|'R')[]};const result=simulate(stages[0],config);
    recordRunOutcome(a,lab,stages[0],stageFingerprint(stages[0]),config,result,3);expect(lab.view().records).toHaveLength(1);
    expect(resetProgressAndLab(a,lab,true).ok).toBe(true);recordRunOutcome(b,lab,stages[0],stageFingerprint(stages[0]),config,result,3);expect(lab.view().records).toHaveLength(0);expect(resetProgressAndLab(b,lab,true).ok).toBe(false);
  });
  it('leaves a durable pending reset on LAB failure and can resume after reload',()=>{
    const s=memoryStorage(),p=createProgressStore(ids,s);p.recordResult('01',true,3);let fail=true;
    const lab=createLabStore(stages,summaries,{getItem:k=>s.getItem(k),setItem:(k,v)=>{if(fail)throw Error('quota');s.setItem(k,v);}});
    expect(resetProgressAndLab(p,lab,true).ok).toBe(false);expect(p.data.bestStars['01']).toBe(3);const reload=createProgressStore(ids,s);expect(reload.status).toBe('reset-pending');reload.recordResult('02',true,3);expect(reload.data.bestStars['02']).toBeUndefined();fail=false;expect(resetProgressAndLab(reload,lab,true).ok).toBe(true);expect(reload.data.bestStars).toEqual({});
  });
  it('without locks denies persistence and destructive reset',async()=>{
    const s=memoryStorage(),coordinator=new SaveCoordinator(),p=createProgressStore(ids,s,key,()=>coordinator.held);
    await coordinator.run(()=>p.recordResult('01',true,3));expect(p.status).toBe('read-only');expect(s.getItem(key)).toBeNull();expect(p.reset(true)).toBe(false);
  });
  it('serializes near simultaneous tabs with an exclusive lock manager',async()=>{
    let tail=Promise.resolve();const locks={request:(_n: unknown,_o: unknown,fn:()=>unknown)=>{const next=tail.then(fn);tail=next.then(()=>undefined);return next;}} as unknown as Pick<LockManager,'request'>;
    const s=memoryStorage(),ca=new SaveCoordinator(locks),cb=new SaveCoordinator(locks),a=createProgressStore(ids,s,key,()=>ca.held),b=createProgressStore(ids,s,key,()=>cb.held);
    await Promise.all([ca.run(()=>a.recordResult('01',true,2)),cb.run(()=>b.recordResult('01',true,3)),ca.run(()=>a.recordResult('02',true,1))]);expect(createProgressStore(ids,s).data.bestStars).toEqual({'01':3,'02':1});expect(ca.held||cb.held).toBe(false);
  });
  it('keeps LAB bytes independent during progress recovery',()=>{
    const s=memoryStorage();s.setItem(productionLabKey,'{"schemaVersion":99,"keep":1}');s.setItem(key,JSON.stringify({...freshProgress(ids),settings:{sfx:false}}));const p=createProgressStore(ids,s);p.recordResult('01',true,3);expect(s.getItem(productionLabKey)).toBe('{"schemaVersion":99,"keep":1}');
  });
  it('detects failed writes, preserves stored records and restores on reload',()=>{
    const s=memoryStorage(),first=createProgressStore(ids,s);first.recordResult('01',true,3);const raw=s.getItem(key);
    const p=createProgressStore(ids,{getItem:k=>s.getItem(k),setItem(){throw Error('quota');}});p.recordResult('02',true,1);expect(p.status).toBe('unavailable');expect(s.getItem(key)).toBe(raw);expect(createProgressStore(ids,s).data.bestStars['01']).toBe(3);
  });
  it('a lock request rejection never falls back to an unguarded persistent write',async()=>{
    const locks={request:()=>Promise.reject(Error('denied'))} as unknown as Pick<LockManager,'request'>;
    const c=new SaveCoordinator(locks),s=memoryStorage(),p=createProgressStore(ids,s,key,()=>c.held);
    await c.run(()=>p.recordResult('01',true,3));expect(p.status).toBe('read-only');expect(s.getItem(key)).toBeNull();
  });
});
