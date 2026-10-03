/* Original game rules. Physics: Matter.js 0.20.0 (MIT). */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./matter.min.js'));else root.PillowGame=factory(root.Matter);})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  const W=420,H=700,WALL=10,FLOOR=689,LIMIT=142,DROP=65;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class Game {
    constructor(stages,{random=Math.random,onMerge=()=>{},onChange=()=>{}}={}){
      this.stages=stages;this.random=random;this.onMerge=onMerge;this.onChange=onChange;
      this.engine=M.Engine.create({enableSleeping:true,positionIterations:8,velocityIterations:6});
      this.engine.gravity.y=1.9;this.pending=[];
      const collect=e=>{for(const p of e.pairs){let a=p.bodyA.parent,b=p.bodyB.parent;if(a.plugin.pillow&&b.plugin.pillow&&a.plugin.tier===b.plugin.tier)this.pending.push([a,b]);}};
      M.Events.on(this.engine,'collisionStart',collect);M.Events.on(this.engine,'collisionActive',collect);
      this.reset();
    }
    // Only stages 1–4 can be dropped: 40%, 25%, 20%, 15% respectively.
    pick(){const x=this.random();return x<.40?0:x<.65?1:x<.85?2:3;}
    reset(){M.Composite.clear(this.engine.world,false);M.Engine.clear(this.engine);
      M.Composite.add(this.engine.world,[M.Bodies.rectangle(-20,300,60,2000,{isStatic:true}),M.Bodies.rectangle(W+20,300,60,2000,{isStatic:true}),M.Bodies.rectangle(W/2,FLOOR+40,W+120,80,{isStatic:true})]);
      this.bodies=[];this.pending=[];this.score=0;this.coins=0;this.awarded=0;this.highest=0;this.current=this.pick();this.next=this.pick();this.wait=0;this.time=0;this.state='ready';this.onChange(this);
    }
    start(){this.state='running';}
    add(tier,x,y,{angle=0}={}){
      if(!Number.isInteger(tier)||tier<0||tier>=this.stages.length)throw new RangeError('Stage is unavailable');
      const s=this.stages[tier];x=clamp(x,WALL+s.w/2+1,W-WALL-s.w/2-1);
      const parts=s.parts.map(([cx,cy,r])=>M.Bodies.circle(cx,cy,r,{friction:.45,restitution:.07},16));
      const body=M.Body.create({parts,friction:.45,frictionStatic:.7,frictionAir:.013,restitution:.07,sleepThreshold:60,slop:.15});
      const cx=body.position.x,cy=body.position.y;
      body.plugin={pillow:true,tier,offset:{x:-cx,y:-cy},born:this.time,over:0};
      M.Body.setMass(body,Math.max(.4,s.w*s.h/2200));
      M.Body.setPosition(body,{x:x+cx,y:y+cy});
      if(angle)M.Body.setAngle(body,angle);
      M.Composite.add(this.engine.world,body);this.bodies.push(body);return body;
    }
    drop(x){if(this.state!=='running'||this.wait>0)return false;
      const b=this.add(this.current,x,DROP);this.current=this.next;this.next=this.pick();this.wait=.38;this.onChange(this);return b;
    }
    remove(b){M.Composite.remove(this.engine.world,b);this.bodies=this.bodies.filter(x=>x!==b);for(const other of this.bodies){M.Sleeping.set(other,false);other.plugin.supported=false;}}
    addScore(n){this.score+=n;const earned=Math.floor(this.score/2000);this.coins+=earned-this.awarded;this.awarded=earned;}
    merge(a,b){if(!this.bodies.includes(a)||!this.bodies.includes(b)||a.plugin.tier!==b.plugin.tier)return false;
      const tier=a.plugin.tier,x=(a.position.x+b.position.x)/2,y=(a.position.y+b.position.y)/2;
      this.remove(a);this.remove(b);
      if(tier+1<this.stages.length){const s=this.stages[tier+1];this.add(tier+1,x,Math.min(y,FLOOR-s.h/2-1));this.highest=Math.max(this.highest,tier+1);this.addScore((tier+1)*(tier+2)/2);}
      else{this.addScore(500);this.coins++;}
      this.onMerge({x,y,tier,top:tier===this.stages.length-1});this.onChange(this);return true;
    }
    revive(){if(this.state!=='revive'||this.coins<1)return false;this.coins--;
      for(const b of [...this.bodies])if(b.bounds.min.y<LIMIT)this.remove(b);
      for(const b of this.bodies){b.plugin.over=0;M.Sleeping.set(b,false);}this.state='running';this.wait=.5;this.onChange(this);return true;
    }
    step(dt=1/120){if(this.state!=='running')return;this.time+=dt;this.wait=Math.max(0,this.wait-dt);this.pending=[];
      M.Engine.update(this.engine,dt*1000);
      // Project the actual compound circles back inside the tray. Many overlapping
      // parts can otherwise accumulate a little penetration under a heavy stack.
      for(const b of this.bodies){
        let left=Infinity,right=-Infinity,bottom=-Infinity;
        for(const p of b.parts.slice(1)){const r=p.circleRadius;left=Math.min(left,p.position.x-r);right=Math.max(right,p.position.x+r);bottom=Math.max(bottom,p.position.y+r);}
        const dx=left<WALL?WALL-left:right>W-WALL?W-WALL-right:0,dy=bottom>FLOOR?FLOOR-bottom:0;
        if(dx||dy){M.Body.translate(b,{x:dx,y:dy});M.Body.setVelocity(b,{x:dx?0:b.velocity.x,y:dy?Math.min(0,b.velocity.y):b.velocity.y});}
        if(Math.abs(b.velocity.x)>12||Math.abs(b.velocity.y)>12)M.Body.setVelocity(b,{x:clamp(b.velocity.x,-12,12),y:clamp(b.velocity.y,-12,12)});
      }
      for(const [a,b] of this.pending)this.merge(a,b);
      // Only supported, slow pieces count toward overflow, never a falling preview.
      const present=new Set(this.bodies),supported=new Set(),edges=[];
      for(const p of this.engine.pairs.list){if(!p.isActive)continue;const a=p.bodyA.parent,b=p.bodyB.parent;
        if(present.has(a)&&b.isStatic&&b.position.y>FLOOR)supported.add(a);
        if(present.has(b)&&a.isStatic&&a.position.y>FLOOR)supported.add(b);
        if(present.has(a)&&present.has(b))edges.push([a,b]);
      }
      // Matter drops contact pairs once bodies sleep; retain their last support.
      for(const b of this.bodies)if(b.bounds.max.y>FLOOR-2||(b.isSleeping&&b.plugin.supported))supported.add(b);
      for(let i=0;i<this.bodies.length;i++){let changed=false;for(const [a,b] of edges){if(supported.has(a)&&!supported.has(b)){supported.add(b);changed=true;}if(supported.has(b)&&!supported.has(a)){supported.add(a);changed=true;}}if(!changed)break;}
      for(const b of this.bodies){b.plugin.supported=supported.has(b);const danger=b.bounds.min.y<LIMIT&&b.plugin.supported&&this.time-b.plugin.born>.75&&b.speed<2.3;
        b.plugin.over=danger?b.plugin.over+dt:Math.max(0,b.plugin.over-dt*2);
        if(b.plugin.over>1.5){this.state=this.coins?'revive':'over';this.onChange(this);break;}
      }
    }
  }
  return {Game,W,H,WALL,FLOOR,LIMIT,DROP,clamp};
});
