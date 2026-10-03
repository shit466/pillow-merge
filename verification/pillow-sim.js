// Deterministic visible-board player: it sees current tier and silhouettes only.
// No spawning high tiers, direct merges, score edits or future random knowledge.
const fs=require('node:fs');
const {Game,W,WALL,FLOOR,DROP,LIMIT,clamp}=require('./pillow-engine.js');
const source=require('./stages-v1.json');
function rng(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
function scaleStages(scales){return source.map((s,i)=>{let f=scales[i]||1;return {...s,w:s.w*f,h:s.h*f,parts:s.parts.map(p=>p.map(v=>v*f))};});}
function choose(g,noise){
  const s=g.stages[g.current];const min=WALL+s.w/2+1,max=W-WALL-s.w/2-1;
  const xs=[];for(let x=min;x<=max;x+=12)xs.push(x);
  for(const b of g.bodies)if(b.plugin.tier===g.current)xs.push(clamp(b.position.x,min,max));
  let best=-Infinity,selected=W/2;
  for(const x of xs){
    let height=FLOOR-s.h/2,target=null;
    for(const b of g.bodies){
      if(b.bounds.min.x>x+s.w/2||b.bounds.max.x<x-s.w/2)continue;
      for(const p of b.parts.slice(1))for(const [cx,cy,r] of s.parts){const dx=x+cx-p.position.x,R=r+p.circleRadius;
        if(Math.abs(dx)>=R)continue;
        const y=p.position.y-cy-Math.sqrt(R*R-dx*dx);
        if(y<height){height=y;target=b;}
      }
    }
    const match=target&&target.plugin.tier===g.current;
    let rating=height*.9;
    if(match){rating+=580+g.current*45;
      const next=g.current+1;
      for(const b of g.bodies)if(b.plugin.tier===next)rating+=Math.max(0,110-Math.hypot(b.position.x-x,b.position.y-height))*.8;
    }
    if(height<LIMIT+s.h/2)rating-=600+(LIMIT+s.h/2-height)*4;
    // Slightly sort small stages across the tray when there is no exposed match.
    if(!match)rating-=Math.abs(x-(55+g.current*93))*.12;
    rating+=noise()*3;
    if(rating>best){best=rating;selected=x;}
  }
  return selected;
}
function run(seed,scales,limit=1300){
  const g=new Game(scaleStages(scales),{random:rng(seed)}),noise=rng(seed^0x12345678);
  const trace=[];let revives=0,hit11=false,first11=null;g.start();const began=Date.now();
  for(let turn=0;turn<limit;turn++){
    if(g.state==='revive'){g.revive();revives++;}
    if(g.state!=='running')break;
    const tier=g.current,x=choose(g,noise),pre=g.score;
    g.drop(x);
    // Allow physical movement, including sideways rolling, before the next aim.
    let n=0;for(;n<240&&g.state==='running';n++){g.step(1/120);if(n>120&&g.bodies.every(b=>b.speed<.12))break;}
    if(g.highest===10&&!hit11){hit11=true;first11={drop:turn+1,score:g.score};}
    trace.push({turn:turn+1,tier:tier+1,x:+x.toFixed(2),steps:n+1,score:g.score,highest:g.highest+1,state:g.state});
  }
  const result={seed,score:g.score,highest:g.highest+1,hit11,first11,drops:trace.length,revives,state:g.state,seconds:+g.time.toFixed(1),wallSeconds:+((Date.now()-began)/1000).toFixed(1)};
  return {result,trace};
}
if(require.main===module){const seed=Number(process.argv[2]||104),scales=JSON.parse(process.argv[3]||'[1,1,1,1,1,1,1,1,1,1,1]');const out=process.argv[4];const data=run(seed,scales);if(out)fs.writeFileSync(out,JSON.stringify({scales,...data},null,2));console.log(JSON.stringify(data.result));}
module.exports={run,choose,scaleStages,rng};
