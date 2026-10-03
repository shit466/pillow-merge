const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const Matter=require('./matter.min.js');
for(const version of ['v1','v2']){
  const html=fs.readFileSync(path.join(__dirname,'..',version,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const dataScript=scripts.find(s=>s.startsWith('const PILLOW_STAGES='));
  const stages=JSON.parse(dataScript.slice('const PILLOW_STAGES='.length).replace(/;\s*$/,''));
  assert.equal(stages.length,10);assert.ok(stages.every(s=>s.source!=='12'));
  assert.ok(!html.includes('11个合成阶段'));assert.ok(!html.includes('PillowCollection'));assert.ok(!html.includes('神秘枕头'));
  const scope={Matter};vm.runInNewContext(scripts.find(s=>s.startsWith('/* Original game rules.')),scope);
  const g=new scope.PillowGame.Game(stages);g.start();g.add(9,200,350);g.add(9,201,350);g.step(1/120);
  assert.equal(g.bodies.length,0);assert.equal(g.score,500);assert.equal(g.coins,1);
  assert.throws(()=>g.add(10,200,350),/unavailable/);
  console.log(`PASS ${version}: 10 stages, no withdrawn photo/slot; 10+10 clears; stage 11 rejected.`);
}
