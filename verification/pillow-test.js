const assert=require('node:assert/strict');
const M=require('./matter.min.js');
const {Game,FLOOR}=require('./pillow-engine.js');
const stages=require('./stages.json');
const tick=(g,n)=>{for(let i=0;i<n;i++)g.step(1/120);};
const make=()=>{const g=new Game(stages,{random:()=>.1});g.start();return g;};
assert.equal(stages.length,11);
for(let tier=0;tier<stages.length;tier++){
  const g=make();let events=0;g.onMerge=()=>events++;
  g.add(tier,200,300);g.add(tier,201,300);tick(g,2);
  assert.equal(events,1,`tier ${tier} should merge exactly once`);
  if(tier<stages.length-1){assert.equal(g.bodies.length,1);assert.equal(g.bodies[0].plugin.tier,tier+1);assert.equal(g.score,(tier+1)*(tier+2)/2);}
  else{assert.equal(g.bodies.length,0);assert.equal(g.score,500);assert.equal(g.coins,1);}
}
{
  const g=make();for(let i=0;i<3;i++)g.add(1,200+i,300);tick(g,3);
  assert.equal(g.bodies.length,2,'a piece cannot merge twice in one collision batch');
  assert.deepEqual(g.bodies.map(b=>b.plugin.tier).sort(),[1,2]);
}
{
  const g=make();const a=g.add(0,200,300);const s=stages[0];
  assert.ok(a.parts.length>10,'actual compound geometry');
  const probe=M.Bodies.circle(200-s.w/2+1,300-s.h/2+1,.5);
  assert.equal(M.Query.collides(probe,[a]).length,0,'transparent image corner is not solid');
  tick(g,1100);
  assert.ok(a.bounds.max.y<=FLOOR+2,'floor retains cutout');assert.ok(a.position.y>500,'gravity makes it fall');
  assert.equal(g.state,'running','passing through danger line must not end game');
  g.state='paused';const oldY=a.position.y;tick(g,300);assert.equal(a.position.y,oldY);
  g.reset();assert.equal(g.bodies.length,0);assert.equal(g.score,0);assert.equal(g.state,'ready');
}
{
  const g=make();g.drop(200);assert.equal(g.drop(200),false,'drop cooldown');tick(g,50);assert.ok(g.drop(200));
  tick(g,900);assert.equal(g.highest,1,'sequential same-stage drops should merge on contact');
}
{
  const g=make();g.addScore(4001);assert.equal(g.coins,2);g.addScore(1);assert.equal(g.coins,2);
  g.add(3,200,100);g.add(2,80,600);g.state='revive';assert.equal(g.revive(),true);assert.equal(g.coins,1);assert.equal(g.bodies.length,1);assert.equal(g.state,'running');
}
{
  // A tall static support represents a packed pile reaching the warning line.
  for(const coins of [0,1]){
    const g=make();g.coins=coins;
    M.Composite.add(g.engine.world,M.Bodies.rectangle(210,FLOOR+50,400,1340,{isStatic:true}));
    g.add(0,200,20);tick(g,600);
    assert.equal(g.state,coins?'revive':'over','resting above warning line triggers end or revive');
  }
}
let seed=321;
const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
{
  const g=new Game(stages,{random:rand});g.start();let drops=0;
  for(let i=0;i<14000&&g.state==='running';i++){
    if(i%55===0){g.drop(30+rand()*360);drops++;}g.step(1/120);
    for(const b of g.bodies){assert.ok(Number.isFinite(b.position.x)&&Number.isFinite(b.position.y));const vertices=b.parts.slice(1).flatMap(p=>p.vertices);const maxY=Math.max(...vertices.map(v=>v.y));const minX=Math.min(...vertices.map(v=>v.x));const maxX=Math.max(...vertices.map(v=>v.x));assert.ok(maxY<FLOOR+5,`no floor tunneling: ${maxY}, tier ${b.plugin.tier}, frame ${i}`);assert.ok(minX>-5&&maxX<425,'no wall tunneling');}
  }
  console.log({drops,score:g.score,pieces:g.bodies.length,minY:Math.min(...g.bodies.map(b=>b.bounds.min.y)),maxOver:Math.max(...g.bodies.map(b=>b.plugin.over)),highest:g.highest});assert.ok(g.score>0);assert.ok(['running','over','revive'].includes(g.state));
  console.log(JSON.stringify({stressDrops:drops,score:g.score,pieces:g.bodies.length,state:g.state,highest:g.highest+1}));
}
console.log('PASS: all 11 merge levels, single consumption, transparent corners, gravity/floor, pause/reset, cooldown, real falling merge, rewards/revive, seeded stress/overflow.');
