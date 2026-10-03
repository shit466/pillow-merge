(() => {
  'use strict';
  const stages=PILLOW_STAGES,{Game,W,H,WALL,FLOOR,LIMIT,DROP,clamp}=PillowGame;
  const $=id=>document.getElementById(id),canvas=$('board'),ctx=canvas.getContext('2d');
  let images=[],loaded=false,aim=W/2,particles=[],labels=[],last=0,acc=0,best=0,highest=0;
  const debug=new URLSearchParams(location.search).has('inspect');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{}};}
  try{best=Number(storage.getItem('pillow-v2-best'))||0;}catch{}
  function updateHud(g){
    if(!g)return;
    if(g.score>best){best=g.score;try{storage.setItem('pillow-v2-best',String(best));}catch{}}
    $('score').textContent=g.score.toLocaleString();$('best').textContent=best.toLocaleString();$('revives').textContent=g.coins;
    $('next').textContent=stages[g.next].name;$('next-image').src=stages[g.next].image;
    $('progress').textContent=`本局最高 ${g.highest+1} / ${stages.length} 阶`;
    for(const [i,card] of Array.from($('chain').children).entries())card.classList.toggle('reached',i<=g.highest);
    if(g.state==='over')show('💤','再抱一次枕头',`这次获得 ${g.score} 分，合到了第 ${g.highest+1} 阶。`,'再玩一次');
    if(g.state==='revive')show('🪙','还能救一下',`消耗一枚复活币，移走警戒线以上的角色。剩余 ${g.coins} 枚。`,'使用复活币',true);
  }
  function show(icon,title,text,button,secondary=false){$('overlay-icon').textContent=icon;$('overlay-title').textContent=title;$('overlay-text').textContent=text;$('start').textContent=button;$('secondary').hidden=!secondary;$('overlay').hidden=false;}
  const game=new Game(stages,{onChange:updateHud,onMerge:({x,y,tier,top})=>{
    labels.push({x,y,text:top?'最高阶合成 +500':`${stages[tier+1].name} +${(tier+1)*(tier+2)/2}`,life:1.15});
    if(!reduced)for(let i=0;i<12;i++){const a=Math.random()*Math.PI*2,v=40+Math.random()*100;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,life:.6,color:['#ef88aa','#bda4df','#efc777'][i%3]});}
  }});
  for(const [i,s] of stages.entries()){
    const button=document.createElement('button');button.className='stage-card';button.type='button';button.title=`查看第 ${i+1} 阶：${s.name}`;
    const image=document.createElement('img');image.src=s.image;image.alt=s.name;
    const text=document.createElement('span');text.textContent=`${String(i+1).padStart(2,'0')} · ${s.name}`;
    button.append(image,text);$('chain').append(button);
    button.addEventListener('click',()=>{if(game.state==='running')pause();$('portrait-image').src=s.image;$('portrait-title').textContent=`第 ${i+1} 阶 · ${s.name}`;$('portrait').showModal();});
  }
  $('portrait-close').addEventListener('click',()=>$('portrait').close());
  $('portrait').addEventListener('click',e=>{if(e.target===$('portrait'))$('portrait').close();});
  updateHud(game);
  function reset(){if(!loaded)return;particles=[];labels=[];game.reset();game.start();aim=W/2;acc=0;last=performance.now();$('overlay').hidden=true;$('pause').textContent='暂停';$('pause').setAttribute('aria-label','暂停游戏');}
  function pause(){if(!loaded)return;if(game.state==='running'){game.state='paused';show('⏸','休息一下','这些枕头会在这里等你。','继续游戏');$('pause').textContent='继续';$('pause').setAttribute('aria-label','继续游戏');}else if(game.state==='paused'){game.state='running';$('overlay').hidden=true;last=performance.now();acc=0;$('pause').textContent='暂停';$('pause').setAttribute('aria-label','暂停游戏');}}
  $('start').addEventListener('click',()=>{if(game.state==='paused')pause();else if(game.state==='revive'){game.revive();$('overlay').hidden=true;}else reset();});
  $('secondary').addEventListener('click',()=>{game.state='over';updateHud(game);});
  $('pause').addEventListener('click',pause);$('reset').addEventListener('click',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.state==='running')pause();});
  function drop(){if($('portrait').open)return;game.drop(aim);}
  let pointer=null;
  const setAim=e=>{const r=canvas.getBoundingClientRect();aim=(e.clientX-r.left)*W/r.width;};
  canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;pointer=e.pointerId;setAim(e);canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(e.isPrimary)setAim(e);});
  canvas.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;pointer=null;setAim(e);drop();});
  canvas.addEventListener('pointercancel',()=>{pointer=null;});
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||$('portrait').open||/BUTTON|INPUT/.test(e.target.tagName))return;
    if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(!e.repeat)drop();}
    if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();aim=clamp(aim+(e.code==='ArrowLeft'?-18:18),0,W);}
    if(e.code==='KeyP')pause();
  });
  function sprite(tier,x,y,angle=0,offset={x:0,y:0},alpha=1){const s=stages[tier],im=images[tier];if(!im)return;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;
    ctx.drawImage(im,...s.crop,offset.x-s.w/2,offset.y-s.h/2,s.w,s.h);ctx.restore();
  }
  function draw(){
    const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==W*dpr){canvas.width=W*dpr;canvas.height=H*dpr;}ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);const gradient=ctx.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#fffaf5');gradient.addColorStop(1,'#ffe6eb');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#e9cbd566';for(let x=25;x<W;x+=28)for(let y=165;y<FLOOR;y+=28){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle=game.bodies.some(b=>b.plugin.over>.2)?'#e86a80':'#deb5c3';ctx.lineWidth=1.5;ctx.setLineDash([6,7]);ctx.beginPath();ctx.moveTo(WALL,LIMIT);ctx.lineTo(W-WALL,LIMIT);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#b58a9b';ctx.font='11px sans-serif';ctx.textAlign='right';ctx.fillText('别让枕头堆过这条线',W-18,LIMIT-10);
    ctx.fillStyle='#e8b6c7';ctx.fillRect(0,FLOOR,W,H-FLOOR);
    if(game.state==='running'&&loaded){const s=stages[game.current],x=clamp(aim,WALL+s.w/2+1,W-WALL-s.w/2-1);
      ctx.strokeStyle='#d993afa0';ctx.setLineDash([3,8]);ctx.beginPath();ctx.moveTo(x,DROP+s.h/2+10);ctx.lineTo(x,FLOOR);ctx.stroke();ctx.setLineDash([]);
      sprite(game.current,x,DROP,0,undefined,game.wait>0?.3:.85);
      ctx.font='11px sans-serif';ctx.fillStyle='#ad7c93';ctx.textAlign='left';ctx.fillText(`${game.current+1} 阶 · ${stages[game.current].name}`,18,23);
    }
    if(game.bodies.length===0&&game.state==='running'){ctx.fillStyle='#b5839966';ctx.font='600 20px sans-serif';ctx.textAlign='center';ctx.fillText('让相同的枕头相遇',W/2,405);ctx.font='13px sans-serif';ctx.fillText('移动瞄准 · 松手落下',W/2,433);}
    for(const b of game.bodies){sprite(b.plugin.tier,b.position.x,b.position.y,b.angle,b.plugin.offset);
      if(debug){ctx.strokeStyle='#06a08a';ctx.lineWidth=.7;for(const p of b.parts.slice(1)){ctx.beginPath();p.vertices.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.stroke();}}
    }
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.6);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    for(const t of labels){ctx.globalAlpha=Math.min(1,t.life*2);ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#fffaf5';ctx.strokeText(t.text,clamp(t.x,80,W-80),t.y);ctx.fillStyle='#a7597c';ctx.fillText(t.text,clamp(t.x,80,W-80),t.y);}ctx.globalAlpha=1;
    if(game.bodies.some(b=>b.plugin.over>.2)){ctx.fillStyle='#f0567216';ctx.fillRect(0,0,W,LIMIT);}
  }
  let statusTick=0;
  function frame(now){const dt=Math.min(.05,(now-last)/1000||0);last=now;
    if(game.state==='running'){
      acc+=dt;let count=0;while(acc>=1/120&&count++<8){game.step(1/120);acc-=1/120;}
      for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=230*dt;}particles=particles.filter(p=>p.life>0);
      for(const t of labels){t.life-=dt;t.y-=25*dt;}labels=labels.filter(t=>t.life>0);
    }else acc=0;
    statusTick+=dt;if(statusTick>.25){statusTick=0;canvas.dataset.pieces=game.bodies.length;canvas.dataset.state=game.state;canvas.dataset.highest=game.highest+1;}
    draw();requestAnimationFrame(frame);
  }
  $('start').disabled=true;$('start').textContent='正在准备枕头…';
  Promise.all(stages.map(s=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=s.image;}))).then(result=>{images=result;loaded=true;$('start').disabled=false;$('start').textContent='开始合成';}).catch(()=>{$('overlay-text').textContent='图片未能完整载入，请重新打开游戏文件。';$('start').textContent='素材加载失败';});
  requestAnimationFrame(frame);
})();
