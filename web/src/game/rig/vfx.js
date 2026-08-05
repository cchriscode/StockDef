import { Helpers } from './helpers.js';
// Canvas VFX layer. Effects are isolated: no character art, drawn with
// globalCompositeOperation="lighter" over the rig.
//   vfxKey(i)      skill effect id for unit index i
//   deathFxKey(i)  death effect id (only units that have one)
//   fxDraw(ctx,W,H,key,phase,dir)   dir = +1 ally (faces +x), -1 enemy (faces -x)
export class Vfx extends Helpers {
  hx(h,a){ const n=parseInt(h.slice(1),16); return "rgba("+(n>>16&255)+","+(n>>8&255)+","+(n&255)+","+Math.max(0,Math.min(1,a))+")"; }
  rnd(i){ const x=Math.sin(i*127.1+i*i*0.017)*43758.5453; return x-Math.floor(x); }
  vfxKey(i){ return ["domeGold","crescentRing","arrowVolley","lanceBeams","goldRing","meteor","boltImpact","successFail","callPut","frostRing","flameStages","coinAbsorb","panicSpread","shortPressure","inflationAura","crashTeleport","hedgeCover","algoScan","titanSkill"][i]; }
  deathFxKey(i){ return ({12:"selfDestruct",16:"shieldShatter"})[i]||null; }
  atkFxKey(i){ return ({7:"cannonShell"})[i]||null; }

  // Some effects must originate at a weapon tip, not at the canvas centre.
  // The host (RigPlayer) registers a resolver that maps a local SVG coord inside
  // a part group to canvas pixels, following the part's live transform.
  //   VFX.setAnchor((lx,ly,partId) => ({x,y}) | null)
  setAnchor(fn){ this._anchor=fn; return this; }
  partPt(lx,ly,id){ try { return this._anchor ? this._anchor(lx,ly,id) : null; } catch(e){ return null; } }

  vRing(ctx,x,y,rx,ry,col,a,lw){ ctx.beginPath(); ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=lw; ctx.ellipse(x,y,Math.max(0.5,rx),Math.max(0.5,ry),0,0,6.2832); ctx.stroke(); }
  vGlow(ctx,x,y,r,col,a){ if(r<=0)return; const g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,this.hx(col,a)); g.addColorStop(0.55,this.hx(col,a*0.35)); g.addColorStop(1,this.hx(col,0)); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill(); }
  vHex(ctx,x,y,r,ry,col,a,lw,fill){ ctx.beginPath(); for(let i=0;i<6;i++){ const t=i/6*6.2832+0.5236, px=x+Math.cos(t)*r, py=y+Math.sin(t)*(ry||r); i?ctx.lineTo(px,py):ctx.moveTo(px,py); } ctx.closePath(); if(fill){ ctx.fillStyle=this.hx(col,a*0.16); ctx.fill(); } ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=lw; ctx.stroke(); }
  vDome(ctx,cx,cy,r,col,a){ ctx.beginPath(); ctx.moveTo(cx-r,cy); for(let x=-r;x<=r;x+=2){ ctx.lineTo(cx+x,cy-Math.sqrt(Math.max(0,1-(x*x)/(r*r)))*r); } ctx.closePath(); ctx.fillStyle=this.hx(col,a*0.14); ctx.fill(); ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=2.6; ctx.stroke(); for(let i=-3;i<=3;i++){ const fx=i/4; ctx.beginPath(); ctx.moveTo(cx+fx*r,cy); ctx.lineTo(cx+fx*r,cy-Math.sqrt(Math.max(0,1-fx*fx))*r); ctx.strokeStyle=this.hx(col,a*0.4); ctx.lineWidth=1.1; ctx.stroke(); } this.vRing(ctx,cx,cy,r,r*0.26,col,a*0.8,2); }
  vCrescent(ctx,cx,cy,r,a0,sw,col,a,lw){ ctx.beginPath(); ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=lw; ctx.arc(cx,cy,Math.max(1,r),a0,a0+sw); ctx.stroke(); }
  vLine(ctx,x0,y0,x1,y1,col,a,lw,fadeIn){ const g=ctx.createLinearGradient(x0,y0,x1,y1); g.addColorStop(0,this.hx(col,fadeIn?0:a)); g.addColorStop(0.5,this.hx(col,a)); g.addColorStop(1,this.hx(col,fadeIn?a:0)); ctx.strokeStyle=g; ctx.lineWidth=lw; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); }
  vDiamond(ctx,x,y,r,col,a){ ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x+r,y); ctx.lineTo(x,y+r); ctx.lineTo(x-r,y); ctx.closePath(); ctx.fillStyle=this.hx(col,a*0.32); ctx.fill(); ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=2.4; ctx.stroke(); }
  vArrow(ctx,x,y,up,col,a,s){ const d=up?-1:1; ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=2.8*s; ctx.beginPath(); ctx.moveTo(x,y-9*s*d); ctx.lineTo(x,y+9*s*d); ctx.moveTo(x-6*s,y+2*s*d); ctx.lineTo(x,y+9*s*d); ctx.lineTo(x+6*s,y+2*s*d); ctx.stroke(); }
  vBolt(ctx,x0,y0,x1,y1,col,a,seed){ ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=3.2; ctx.beginPath(); ctx.moveTo(x0,y0); const n=7; for(let i=1;i<n;i++){ const t=i/n; ctx.lineTo(x0+(x1-x0)*t+(this.rnd(seed+i)-0.5)*26,y0+(y1-y0)*t); } ctx.lineTo(x1,y1); ctx.stroke(); }
  vCrystal(ctx,x,y,r,col,a){ ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x+r*0.42,y); ctx.lineTo(x,y+r*0.5); ctx.lineTo(x-r*0.42,y); ctx.closePath(); ctx.fillStyle=this.hx(col,a*0.6); ctx.fill(); ctx.strokeStyle=this.hx("#EAFBFF",a); ctx.lineWidth=1.2; ctx.stroke(); }
  pCoin(ctx,x,y,r,col,a){ ctx.beginPath(); ctx.ellipse(x,y,r,r*0.5,0,0,6.2832); ctx.fillStyle=this.hx(col,a*0.85); ctx.fill(); ctx.strokeStyle=this.hx("#FFF6D6",a*0.9); ctx.lineWidth=1; ctx.stroke(); }
  pShard(ctx,x,y,r,ang,col,a){ ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(-r,0); ctx.lineTo(0,-r*0.42); ctx.lineTo(r,0); ctx.lineTo(0,r*0.3); ctx.closePath(); ctx.fillStyle=this.hx(col,a); ctx.fill(); ctx.restore(); }
  pSpark(ctx,x,y,r,col,a){ this.vGlow(ctx,x,y,r,col,a); }
  pFlake(ctx,x,y,r,col,a){ ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=1.4; for(let i=0;i<3;i++){ const t=i/3*Math.PI; ctx.beginPath(); ctx.moveTo(x-Math.cos(t)*r,y-Math.sin(t)*r); ctx.lineTo(x+Math.cos(t)*r,y+Math.sin(t)*r); ctx.stroke(); } }

  vSaw(ctx,x,y,rx,ry,col,a,lw,teeth,amp){ ctx.beginPath(); ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=lw;
    const n=teeth*4; for(let i=0;i<=n;i++){ const t=i/n*6.2832, z=1+(i%2?amp:-amp);
      const px=x+Math.cos(t)*rx*z, py=y+Math.sin(t)*ry*z; i?ctx.lineTo(px,py):ctx.moveTo(px,py); } ctx.closePath(); ctx.stroke(); }
  vBracket(ctx,x,y,rx,ry,col,a,lw){ const s=Math.min(rx,ry)*0.42; ctx.strokeStyle=this.hx(col,a); ctx.lineWidth=lw;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{ ctx.beginPath();
      ctx.moveTo(x+sx*rx, y+sy*ry-sy*s); ctx.lineTo(x+sx*rx, y+sy*ry); ctx.lineTo(x+sx*rx-sx*s, y+sy*ry); ctx.stroke(); }); }
  fxDraw(ctx,W,H,key,ph,dir){
    const cx=W*0.5, gy=H*0.78, mid=H*0.5;
    const F=(p)=>Math.max(0,1-p), E=(t)=>1-Math.pow(1-t,3), R=this.rnd.bind(this);
    switch(key){
      case "domeGold": {
        const p=E(Math.min(1,ph/0.55)), fo=F(Math.max(0,(ph-0.62)/0.38));
        const ft=this.partPt(78,190,"shadow")||{x:cx,y:gy};
        const hd=this.partPt(80,30,"head")||{x:cx,y:gy-150};
        const full=Math.max(96,(ft.y-hd.y)*1.16);   // clears the helm crest
        const x=ft.x+dir*8, r=26+p*(full-26);
        this.vDome(ctx,x,ft.y,r,"#F4E2AC",0.75*fo);
        this.vGlow(ctx,x,ft.y-r*0.42,r*0.62,"#C39C4C",0.2*fo);
        for(let i=0;i<6;i++){ const t=(i/6)*3.1416, hr=r*0.72;
          this.vHex(ctx,x+Math.cos(t)*hr*0.5,ft.y-Math.sin(t)*hr*0.72,15,15,"#FFF6D6",0.3*fo,1.3,true); }
        for(let i=0;i<12;i++){ const a=ph*3.4+i/12*6.2832;
          this.pCoin(ctx,x+Math.cos(a)*r*0.95,ft.y-Math.abs(Math.sin(a))*r*0.66-4,4.6,"#F4E2AC",0.9*fo); }
        break; }
      case "crescentRing": {
        for(let k=0;k<4;k++){ const p=(ph+k*0.14)%1, r=14+p*96;
          this.vCrescent(ctx,cx,mid,r,-1.2+p*6.2832,2.4,k%2?"#F4E2AC":"#F4F9FF",0.85*F(p),6-k*1.1);
          this.vCrescent(ctx,cx,mid,r,-1.2+p*6.2832+3.14,1.7,"#F4E2AC",0.45*F(p),3); }
        for(let i=0;i<14;i++){ const p=(ph*1.4+R(i))%1, a=R(i+40)*6.2832, r=30+p*90;
          this.pSpark(ctx,cx+Math.cos(a)*r,mid+Math.sin(a)*r*0.62,3.4,"#F4E2AC",0.8*F(p)); }
        break; }
      case "arrowVolley": {
        const tx=cx+dir*46;
        this.vDiamond(ctx,tx,gy-88+Math.sin(ph*12)*3,11,"#D14A4A",0.95);
        this.vRing(ctx,tx,gy,40,14,"#D14A4A",0.55,2.2);
        const q=(ph*2)%1; this.vRing(ctx,tx,gy,40*(0.4+0.6*q),14*(0.4+0.6*q),"#D14A4A",0.4*F(q),1.6);
        for(let i=0;i<4;i++){ const a=i/4*6.2832+ph*2; this.vLine(ctx,tx+Math.cos(a)*58,gy-14+Math.sin(a)*20,tx,gy-8,"#D14A4A",0.5,1.6,true); }
        for(let i=0;i<9;i++){ const p=(ph*1.5+R(i))%1, ax=tx+(R(i+9)-0.5)*74, ay=-24+p*(gy+30);
          if(ay<gy) this.vLine(ctx,ax+dir*9,ay-30,ax,ay,"#F4F9FF",0.9,2.6);
          else this.pSpark(ctx,ax,gy,7*F((p-0.8)*5),"#F4F9FF",0.6); }
        break; }
      case "lanceBeams": {
        const p=Math.min(1,ph/0.6), fo=F(Math.max(0,(ph-0.6)/0.4));
        const tp=this.partPt(137,15,"halberd")||{x:cx+dir*18,y:mid};
        const x0=tp.x+dir*4, y0=tp.y, len=E(p)*W*0.46;
        for(let i=-2;i<=2;i++){ const y=y0+i*(4+E(p)*17);
          this.vLine(ctx,x0,y0,x0+dir*len,y,i===0?"#F4F9FF":"#C8D8FF",(i===0?0.95:0.55)*fo,i===0?6:2.6); }
        this.vLine(ctx,x0,y0-3,x0+dir*len,y0-3,"#B5A6FF",0.3*fo,1.4);
        this.vLine(ctx,x0,y0+3,x0+dir*len,y0+3,"#FFB5C8",0.3*fo,1.4);
        this.vGlow(ctx,x0,y0,24*fo,"#F4F9FF",0.75*fo);
        break; }
      case "goldRing": {
        const p=E(Math.min(1,ph/0.8));
        this.vRing(ctx,cx,gy,22+p*82,8+p*29,"#F4E2AC",0.8*F(Math.max(0,(ph-0.5)*2)),4);
        this.vRing(ctx,cx,gy,10+p*46,4+p*16,"#FFF6D6",0.5*F(Math.max(0,(ph-0.4)*1.7)),2);
        this.vGlow(ctx,cx,gy-10,54,"#F4E2AC",0.22);
        for(let i=0;i<12;i++){ const t=(ph+R(i))%1, a=(R(i+20)-0.5)*2.2;
          this.pCoin(ctx,cx+Math.sin(a)*46,gy-t*104,4.6,"#F4E2AC",0.95*F(t)); }
        break; }
      case "meteor": {
        if(ph<0.6){ const p=ph/0.6, x=cx+dir*W*0.32-dir*p*W*0.3, y=-34+p*(gy-24);
          this.vLine(ctx,x-dir*46,y-84,x,y,"#FFA53C",0.85,8);
          this.vLine(ctx,x-dir*30,y-56,x,y,"#FFF3B0",0.7,3.4);
          this.vGlow(ctx,x,y,22,"#FFA53C",0.95); this.vGlow(ctx,x,y,11,"#FFF3B0",1);
        } else { const p=(ph-0.6)/0.4, x=cx+dir*6;
          this.vGlow(ctx,x,gy-14,56*(0.45+p*0.85),"#FFA53C",0.9*F(p));
          this.vRing(ctx,x,gy,22+p*88,8+p*26,"#FFF3B0",0.8*F(p),4.4);
          for(let i=0;i<14;i++){ const a=R(i)*6.2832, r=(22+p*72)*(0.5+R(i+7)*0.6);
            this.pSpark(ctx,x+Math.cos(a)*r,gy-Math.abs(Math.sin(a))*r*0.9-p*26,5,"#FFB347",0.8*F(p)); }
          for(let i=0;i<8;i++){ const t=(p+R(i+30))%1; this.pSpark(ctx,x+(R(i)-0.5)*90,gy-t*54,3.2,"#E24E1B",0.55*F(t)); } }
        break; }
      case "boltImpact": {
        const p=(ph*1.6)%1;
        const tp=this.partPt(142,74,"bolt")||{x:cx+dir*W*0.3,y:mid-16};
        const x=tp.x+dir*(10+p*W*0.22), y=tp.y;
        this.vGlow(ctx,x,y,34*(0.35+p),"#F4F9FF",0.9*F(p));
        for(let i=0;i<10;i++){ const a=i/10*6.2832+0.3; this.vLine(ctx,x,y,x+Math.cos(a)*(16+p*44),y+Math.sin(a)*(16+p*44),"#F4E2AC",0.85*F(p),2.6); }
        for(let i=0;i<7;i++){ const t=(p+R(i))%1, a=R(i+5)*3.14; this.pShard(ctx,x-Math.cos(a)*t*54,y+Math.sin(a)*t*30+t*t*30,4,a*3,"#98A3B6",0.7*F(t)); }
        this.vLine(ctx,x-dir*W*0.34,y,x,y,"#F4F9FF",0.35*F(p),2);
        break; }
      case "cannonShell": {
        const mz=this.partPt(130,123,"barrelIn")||{x:cx+dir*46,y:mid};
        const fl=Math.max(0,1-Math.abs(ph-0.34)/0.11);
        if(fl>0){
          this.vGlow(ctx,mz.x+dir*10,mz.y,30*fl,"#FFF3B0",0.95*fl);
          for(let i=0;i<9;i++){ const a=(R(i)-0.5)*1.15, l=(18+R(i+9)*40)*fl;
            this.vLine(ctx,mz.x,mz.y,mz.x+dir*l*Math.cos(a),mz.y+l*Math.sin(a)*0.8,"#FFA53C",0.8*fl,2.6); }
          this.vRing(ctx,mz.x+dir*16,mz.y,26*(1-fl)+8,20*(1-fl)+6,"#FFF3B0",0.5*fl,2);
        }
        const t=(ph-0.32)/0.52;
        if(t>0&&t<1){
          const sx=mz.x+dir*(12+E(t)*W*0.6), sy=mz.y-Math.sin(t*3.1416)*22;
          for(let i=1;i<=6;i++){ const q=t-i*0.04; if(q>0)
            this.pSpark(ctx,mz.x+dir*(12+E(q)*W*0.6),mz.y-Math.sin(q*3.1416)*22,8-i,"#FFA53C",0.42*(1-i/7)); }
          this.vGlow(ctx,sx,sy,15,"#FFF3B0",0.85);
          ctx.save(); ctx.globalCompositeOperation="source-over";
          ctx.beginPath(); ctx.ellipse(sx,sy,9.5,7,0,0,6.2832);
          ctx.fillStyle=this.hx("#2A1B0B",0.98); ctx.fill();
          ctx.strokeStyle=this.hx("#C39C4C",0.95); ctx.lineWidth=1.8; ctx.stroke();
          ctx.beginPath(); ctx.ellipse(sx-dir*2.5,sy-2,3.4,2.4,0,0,6.2832);
          ctx.fillStyle=this.hx("#F4E2AC",0.5); ctx.fill(); ctx.restore();
        }
        break; }
      case "successFail": {
        const good=ph<0.5, p=(ph%0.5)/0.5, col=good?"#6BE08C":"#D14A4A", x=cx+dir*W*0.26;
        this.vRing(ctx,x,gy,18+p*62,7+p*21,col,0.8*F(p),4);
        this.vGlow(ctx,x,gy-8,32*(0.4+p*0.7),col,0.55*F(p));
        for(let i=0;i<6;i++){ const gx=x+(i-2.5)*17, t=(p+R(i)*0.3)%1; this.vArrow(ctx,gx,good?gy-16-t*62:gy-44+t*48,good,col,0.85*F(t),1); }
        if(good){ for(let i=0;i<7;i++){ const t=(p+R(i+9))%1; this.pCoin(ctx,x+(R(i)-0.5)*72,gy-t*70,4,"#F4E2AC",0.9*F(t)); } }
        else { for(let i=0;i<9;i++){ const t=(p+R(i+3))%1; this.pSpark(ctx,x+(R(i)-0.5)*80,gy-26+t*30,3,"#8A8F98",0.5*F(t)); } }
        break; }
      case "callPut": {
        const call=ph<0.5, p=(ph%0.5)/0.5, x=cx+dir*30;
        if(call){ const fo=F(Math.max(0,(p-0.6)/0.4));
          this.vBolt(ctx,x,H*0.1,x-dir*10,gy-6,"#B79CE8",0.9*fo,Math.floor(ph*24));
          this.vBolt(ctx,x+dir*16,H*0.1,x+dir*4,gy-6,"#D9C7FF",0.45*fo,Math.floor(ph*24)+7);
          this.vRing(ctx,x-dir*8,gy,24+p*34,9+p*13,"#B79CE8",0.75*F(p),3);
          for(let i=0;i<6;i++){ const a=i/6*6.2832+ph*4, r=26+p*30; this.vHex(ctx,x-dir*8+Math.cos(a)*r,gy-Math.abs(Math.sin(a))*r*0.3,6,4,"#D9C7FF",0.6*F(p),1.6,false); }
        } else { const q=E(Math.min(1,p/0.7)), fo=F(Math.max(0,(p-0.65)/0.35));
          this.vDome(ctx,x,gy,26+q*60,"#B79CE8",0.7*fo);
          for(let i=0;i<7;i++){ const a=i/7*6.2832, r=26+q*60; this.vHex(ctx,x+Math.cos(a)*r*0.86,gy-Math.abs(Math.sin(a))*r*0.6,9,7,"#D9C7FF",0.5*fo,1.4,true); } }
        break; }
      case "frostRing": {
        const p=E(Math.min(1,ph/0.85)), fo=F(Math.max(0,(ph-0.55)/0.45));
        this.vRing(ctx,cx,gy,20+p*88,7+p*30,"#96D8EC",0.85*fo,4.4);
        this.vRing(ctx,cx,gy,10+p*54,4+p*18,"#EAFBFF",0.5*fo,2);
        ctx.fillStyle=this.hx("#96D8EC",0.1*fo); ctx.beginPath(); ctx.ellipse(cx,gy,20+p*88,7+p*30,0,0,6.2832); ctx.fill();
        for(let i=0;i<10;i++){ const a=i/10*6.2832, r=20+p*88; this.vCrystal(ctx,cx+Math.cos(a)*r,gy-Math.abs(Math.sin(a))*r*0.34,9+p*5,"#96D8EC",0.9*fo); }
        for(let i=0;i<12;i++){ const t=(ph*0.8+R(i))%1; this.pFlake(ctx,cx+(R(i+11)-0.5)*W*0.5,gy-t*120,3.6,"#C9F0FF",0.7*F(t)); }
        break; }
      case "flameStages": {
        const st=Math.min(2,Math.floor(ph*3));
        const cols=[["#FFA53C","#FFD27A"],["#FFE24C","#FFF3B0"],["#FFF7E0","#7FD4FF"]], x0=cx+dir*24;
        for(let i=0;i<22;i++){ const t=(ph*2.2+i/22)%1, y=gy-t*(H*0.52), wob=Math.sin(i*1.7+ph*22)*(8+t*26);
          this.vGlow(ctx,x0+wob,y,17*(1-t*0.5)*(1+st*0.14),cols[st][t<0.5?0:1],0.5*F(t)); }
        this.vGlow(ctx,x0,gy-14,30+st*8,cols[st][0],0.4);
        this.vRing(ctx,cx,gy,34+st*16,12+st*5,cols[st][0],0.5,3);
        for(let i=0;i<10;i++){ const t=(ph*1.6+R(i))%1; this.pSpark(ctx,cx+(R(i+6)-0.5)*90,gy-t*96,3.4,"#FFC061",0.7*F(t)); }
        for(let i=0;i<3;i++){ this.vArrow(ctx,cx-dir*66,gy-18-i*22,true,cols[Math.min(2,i)][0],ph*3>i+0.15?0.9:0.15,0.9); }
        break; }
      case "coinAbsorb": {
        this.vRing(ctx,cx,gy,54,19,"#F4E2AC",0.6,3.4);
        this.vGlow(ctx,cx,gy-8,58,"#F4E2AC",0.2);
        for(let i=0;i<14;i++){ const t=(ph+R(i))%1, a=(R(i+13)-0.5)*2.0, y=gy-t*(H*0.5), x=cx+Math.sin(a)*46*(1-t*0.75);
          this.pCoin(ctx,x,y,4.6*(1-t*0.5),"#F4E2AC",0.95*F(t*1.15));
          if(t>0.72) this.pSpark(ctx,x,y,7*F((t-0.72)/0.28),"#FFF6D6",0.7); }
        break; }
      case "selfDestruct": {
        const p=(ph*1.5)%1;
        this.vGlow(ctx,cx,mid,26*(0.4+p*0.8),"#FF3CAC",0.85*F(p*1.6));
        this.vRing(ctx,cx,mid,16+p*54,16+p*54,"#2DE2E6",0.6*F(p),2.6);
        for(let i=0;i<16;i++){ const a=R(i)*6.2832, sp=0.5+R(i+8)*0.9;
          this.pShard(ctx,cx+Math.cos(a)*p*72*sp,mid+Math.sin(a)*p*46*sp+p*p*46,5*F(p*0.9),a*4+ph*8,"#2DE2E6",0.9*F(p)); }
        for(let i=0;i<6;i++){ const t=(p+R(i+22))%1; this.pSpark(ctx,cx+(R(i)-0.5)*44,mid-t*54,4.5*F(t),"#3A4356",0.4*F(t)); }
        break; }
      case "panicSpread": {
        for(let k=0;k<3;k++){ const t=(ph*1.25+k/3)%1;
          this.vRing(ctx,cx,gy,18+t*W*0.52,7+t*30,"#2DE2E6",0.8*F(t),3.4);
          this.vRing(ctx,cx,gy,10+t*W*0.34,4+t*20,"#EEFEFF",0.35*F(t),1.6); }
        for(let sd=-1;sd<=1;sd+=2){ for(let i=0;i<4;i++){ const t=(ph*1.5+i*0.18)%1, x=cx+sd*(24+t*W*0.42);
          for(let j=0;j<3;j++){ const y=gy-14-j*13;
            this.vLine(ctx,x,y,x+sd*(16+j*5),y,"#2DE2E6",0.75*F(t),2.2,true); } } }
        for(let i=0;i<3;i++){ const px=cx+(i-1)*W*0.24, pu=Math.abs(Math.sin(ph*7+i));
          this.vGlow(ctx,px,gy-6,15+pu*7,"#2DE2E6",0.3+pu*0.25);
          this.vRing(ctx,px,gy,13+pu*6,5+pu*2,"#FF3CAC",0.5+pu*0.3,1.8); }
        this.vGlow(ctx,cx,mid+8,24*(1+0.14*Math.sin(ph*20)),"#FF3CAC",0.4);
        for(let i=0;i<14;i++){ const t=(ph*1.7+R(i))%1;
          this.pSpark(ctx,cx+(R(i+5)-0.5)*W*0.7,gy-t*40,2.4,"#2DE2E6",0.55*F(t)); }
        break; }
      case "shortPressure": {
        const tx=cx+dir*W*0.36, mz=cx+dir*26, lock=E(Math.min(1,ph/0.34));
        if(ph<0.34){ const r=54-lock*30;
          this.vBracket(ctx,tx,mid,r,r*0.92,"#FF3CAC",0.5+lock*0.5,2.8);
          for(let i=0;i<4;i++){ const a=i/4*6.2832+0.7854, d=(1-lock)*90;
            this.vLine(ctx,tx+Math.cos(a)*(d+40),mid+Math.sin(a)*(d+40),tx+Math.cos(a)*30,mid+Math.sin(a)*30,"#FF3CAC",0.6*lock,1.8,true); } }
        else { const q=(ph-0.34)/0.66, pu=Math.abs(Math.sin(ph*22));
          this.vBracket(ctx,tx,mid,24+pu*3,22+pu*3,"#FF3CAC",0.95,3);
          this.vRing(ctx,tx,mid,7+pu*2,7+pu*2,"#FFD6EE",0.9,2);
          for(let k=0;k<3;k++){ const o=(k-1)*4;
            this.vLine(ctx,mz,mid+o,tx-dir*24,mid+o,"#FF3CAC",(0.75-Math.abs(k-1)*0.22)*(0.7+0.3*pu),3.2); }
          for(let i=0;i<10;i++){ const t=(ph*2.2+R(i))%1;
            this.pSpark(ctx,mz+dir*t*(tx-mz-dir*24-mz+mz),mid+(R(i+11)-0.5)*10,2.6,"#FFB3DE",0.7*F(t)); }
          this.vArrow(ctx,tx,mid-44,false,"#FF3CAC",0.55+0.4*pu,1.15);
          this.vGlow(ctx,tx,mid,20+pu*8,"#FF3CAC",0.3);
          const bars=Math.floor(q*4);
          for(let i=0;i<4;i++) this.vLine(ctx,tx-18+i*12,mid+38,tx-18+i*12,mid+38-(i<bars?4:12),"#FF3CAC",i<bars?0.9:0.2,3); }
        this.vGlow(ctx,mz,mid,11*Math.abs(Math.sin(ph*18)),"#FF3CAC",0.6);
        break; }
      case "inflationAura": {
        for(let k=0;k<3;k++){ const t=(ph*0.9+k/3)%1;
          this.vSaw(ctx,cx,gy-t*30,30+t*72,12+t*26,"#C8F03C",0.7*F(t),3,9,0.14); }
        for(let i=0;i<5;i++){ const lit=ph*5>i+0.1, y=gy-28-i*23, sk=1+i*0.11, wob=Math.sin(ph*13+i)*2.4;
          ctx.save(); ctx.translate(cx+wob,y); ctx.scale(sk,1/sk*1.15); ctx.translate(-cx,-y);
          this.vArrow(ctx,cx,y,true,lit?"#C8F03C":"#7A8A3A",lit?0.95:0.16,1.05); ctx.restore();
          if(lit) this.vGlow(ctx,cx+wob,y,12+i*2,"#C8F03C",0.28); }
        const q=(ph*1.3)%1;
        this.vSaw(ctx,cx,gy,44+q*70,17+q*25,"#FF3CAC",0.4*F(q),2,13,0.1);
        for(let i=0;i<12;i++){ const t=(ph*1.2+R(i))%1, s=1+t*1.6;
          this.pSpark(ctx,cx+(R(i+4)-0.5)*W*0.36,gy-t*96,2.4*s,"#C8F03C",0.6*F(t)); }
        this.vGlow(ctx,cx,mid+12,28*(1+0.12*Math.sin(ph*15)),"#C8F03C",0.22);
        break; }
      case "crashTeleport": {
        const ox=cx-dir*W*0.2, nx=cx+dir*W*0.26, N=9;
        const dis=Math.min(1,ph/0.3), tr=this.seg(ph,0.24,0.52), rea=this.seg(ph,0.46,0.84);
        if(dis<1){ for(let i=0;i<N;i++){ const y=mid-54+i*13, sh=E(dis)*(28+R(i)*44);
          this.vLine(ctx,ox-dir*sh*0.2,y,ox+dir*sh,y,"#2DE2E6",0.85*F(dis),2.6,true); } }
        if(tr>0&&tr<1){ const hx0=ox, hx1=ox+(nx-ox)*E(tr);
          this.vLine(ctx,hx0,mid,hx1,mid,"#EEFEFF",0.9,4,true);
          this.vGlow(ctx,hx1,mid,20,"#2DE2E6",0.8); this.vGlow(ctx,hx1,mid,8,"#EEFEFF",1);
          for(let i=0;i<N;i++){ const y=mid-54+i*13;
            this.vLine(ctx,hx1-dir*(30+R(i)*40),y,hx1,y,"#2DE2E6",0.45,1.6,true); } }
        if(rea>0){ for(let i=0;i<N;i++){ const y=mid-54+i*13, sh=(1-E(rea))*(26+R(i+7)*40);
          this.vLine(ctx,nx-dir*sh,y,nx+dir*sh*0.2,y,"#2DE2E6",0.8*rea*F(Math.max(0,(rea-0.7)/0.3)),2.4,true); }
          this.vGlow(ctx,nx,mid,26*rea*F(Math.max(0,(rea-0.6)/0.4)),"#2DE2E6",0.4); }
        ctx.strokeStyle=this.hx("#FF3CAC",0.85); ctx.lineWidth=2.6; ctx.beginPath();
        const steps=7, prog=Math.min(1,ph/0.8);
        for(let i=0;i<=steps*prog;i++){ const t=i/steps, x=ox+(nx-ox)*t, y=mid-40+t*74+(i%2?6:0);
          i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
        ctx.stroke();
        this.vArrow(ctx,nx+dir*16,mid+34,false,"#FF3CAC",0.5+0.4*Math.abs(Math.sin(ph*16)),1);
        for(let i=0;i<16;i++){ const t=(ph*1.9+R(i))%1;
          this.pSpark(ctx,ox+(nx-ox)*t,mid+(R(i+30)-0.5)*76,2.4,"#2DE2E6",0.6*F(t)); }
        break; }
      case "hedgeCover": {
        const bx=cx+dir*30, pulse=Math.min(1,ph/0.2);
        this.vRing(ctx,bx,mid,10+E(pulse)*40,10+E(pulse)*40,"#2DE2E6",0.7*F(pulse),2.6);
        this.vGlow(ctx,bx,mid,20+pulse*10,"#2DE2E6",0.4);
        const spots=[[cx-dir*W*0.2,mid+6,1],[cx+dir*W*0.02,mid-10,0.86],[cx-dir*W*0.36,mid+14,0.78]];
        spots.forEach((s,si)=>{ const st=this.seg(ph,0.16+si*0.12,0.5+si*0.12), sc=s[2]*(34);
          if(st<=0) return;
          const edges=Math.min(6,Math.floor(st*7.2));
          ctx.strokeStyle=this.hx("#2DE2E6",0.9); ctx.lineWidth=2.6; ctx.beginPath();
          for(let i=0;i<=edges;i++){ const t=i/6*6.2832+0.5236, px=s[0]+Math.cos(t)*sc, py=s[1]+Math.sin(t)*sc*0.92;
            i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
          if(edges>=6) ctx.closePath();
          ctx.stroke();
          if(edges>=6){ const hold=this.seg(ph,0.5+si*0.12,1), pu=Math.abs(Math.sin(ph*11+si));
            this.vHex(ctx,s[0],s[1],sc,sc*0.92,"#2DE2E6",0.35+pu*0.3,1.4,true);
            for(let r=0;r<2;r++){ const t=(ph*1.1+r*0.5+si*0.2)%1;
              this.vHex(ctx,s[0],s[1],sc*(1+t*0.5),sc*0.92*(1+t*0.5),"#EEFEFF",0.3*F(t),1.2,false); }
            this.vGlow(ctx,s[0],s[1],sc*0.7,"#2DE2E6",0.13+hold*0.06); }
          this.vLine(ctx,bx,mid,s[0],s[1],"#2DE2E6",0.4*Math.min(1,st*2)*F(Math.max(0,(st-0.6)/0.4)),1.6,true); });
        for(let i=0;i<10;i++){ const t=(ph*1.3+R(i))%1;
          this.pSpark(ctx,bx+(R(i+3)-0.5)*30,mid-t*46,2.6,"#2DE2E6",0.5*F(t)); }
        break; }
      case "algoScan": {
        const cols=7, rows=4, gw=W*0.72, gh=44, gx0=cx-gw/2, gy0=gy-gh+8;
        for(let r=0;r<=rows;r++){ const t=r/rows, y=gy0+t*gh, sp=gw*(0.42+t*0.58);
          this.vLine(ctx,cx-sp/2,y,cx+sp/2,y,"#2DE2E6",0.3,1.2); }
        for(let cI=0;cI<=cols;cI++){ const t=cI/cols-0.5;
          this.vLine(ctx,cx+t*gw*0.42,gy0,cx+t*gw,gy0+gh,"#2DE2E6",0.3,1.2); }
        const sw=(ph*1.4)%1, sx=gx0+sw*gw;
        this.vLine(ctx,sx-(1-sw*0.58)*0,gy0,sx,gy0+gh,"#EEFEFF",0.9,3);
        this.vGlow(ctx,sx,gy0+gh*0.5,26,"#2DE2E6",0.5);
        for(let i=0;i<8;i++) this.pSpark(ctx,sx+(R(i)-0.5)*10,gy0+R(i+2)*gh,2.4,"#EEFEFF",0.7);
        const lockT=this.seg(ph,0.46,0.7);
        if(lockT>0){ const tcx=cx+dir*W*0.19, tcy=gy0+gh*0.66, rr=26-E(lockT)*11, pu=Math.abs(Math.sin(ph*20));
          this.vDiamond(ctx,tcx,tcy,rr,"#FF3CAC",0.6+lockT*0.4);
          if(lockT>=1){ this.vDiamond(ctx,tcx,tcy,rr*(1+pu*0.16),"#FF3CAC",0.35);
            this.vGlow(ctx,tcx,tcy,17+pu*6,"#FF3CAC",0.4);
            for(let i=0;i<4;i++){ const a=i/4*6.2832+0.7854;
              this.vLine(ctx,tcx+Math.cos(a)*(rr+7),tcy+Math.sin(a)*(rr+7),tcx+Math.cos(a)*(rr+18),tcy+Math.sin(a)*(rr+18),"#FF3CAC",0.8,2); }
            this.vLine(ctx,tcx,tcy-rr-14,tcx,mid+16,"#FF3CAC",0.45,1.4,true); } }
        for(let i=0;i<6;i++){ const t=(ph*1.8+R(i+9))%1;
          this.vLine(ctx,cx+(R(i)-0.5)*W*0.5,mid-30+R(i+4)*40,cx+(R(i)-0.5)*W*0.5+9,mid-30+R(i+4)*40,"#2DE2E6",0.6*F(t),1.6); }
        this.vGlow(ctx,cx,mid-6,18*Math.abs(Math.sin(ph*13)),"#2DE2E6",0.35);
        break; }
      case "shieldShatter": {
        const bx=cx+dir*46, p=Math.min(1,ph/0.5);
        this.vHex(ctx,bx,mid,20+p*16,(20+p*16)*0.92,"#2DE2E6",0.8*F(p),3,true);
        for(let i=0;i<11;i++){ const a=R(i)*6.2832, r=E(p)*92*(0.5+R(i+3)*0.8);
          this.vHex(ctx,bx+Math.cos(a)*r,mid+Math.sin(a)*r*0.85+p*p*40,9*F(p*0.8),8*F(p*0.8),"#2DE2E6",0.85*F(p),2,true); }
        for(let i=0;i<9;i++){ const a=R(i+40)*6.2832;
          this.pShard(ctx,bx+Math.cos(a)*p*78,mid+Math.sin(a)*p*58+p*p*40,4.5*F(p),a*3+ph*6,"#FF3CAC",0.7*F(p)); }
        this.vGlow(ctx,bx,mid,30*F(p*1.4),"#2DE2E6",0.4*F(p));
        break; }
      case "titanSkill": {
        const absorb=ph<0.55, ccx=cx+dir*4, ccy=mid-16;
        if(absorb){ const p=ph/0.55;
          this.vGlow(ctx,ccx,ccy,34+Math.sin(ph*16)*6,"#FF3CAC",0.55);
          for(let k=0;k<2;k++){ const t=(p+k*0.5)%1; this.vRing(ctx,ccx,ccy,26+t*34,10+t*14,"#FF3CAC",0.5*F(t),2.4); }
          for(let i=0;i<16;i++){ const t=(ph*1.7+R(i))%1, a=R(i+9)*6.2832+t*3, r=(1-t)*98,
                x=ccx+Math.cos(a)*r, y=ccy+Math.sin(a)*r*0.68;
            if(t<0.62) this.pCoin(ctx,x,y,4.4,"#F4E2AC",0.95);
            else { const q=(t-0.62)/0.38; this.pCoin(ctx,x,y,4.4*(1-q*0.5),"#8A8F98",0.85*F(q)); } }
        } else { const p=(ph-0.55)/0.45;
          for(let k=0;k<3;k++){ const t=(p+k/3)%1; this.vRing(ctx,ccx,ccy,24+t*104,10+t*40,"#FF3CAC",0.8*F(t),4.4); }
          for(let i=0;i<9;i++){ const a=R(i)*6.2832, r=p*92;
            ctx.fillStyle=this.hx("#FF3CAC",0.7*F(p)); ctx.fillRect(ccx+Math.cos(a)*r,ccy+Math.sin(a)*r*0.7,10+R(i+5)*16,3.4); }
          for(let i=0;i<6;i++){ const t=(p+R(i+18))%1; this.vArrow(ctx,ccx+(i-2.5)*30,ccy+18+t*66,false,"#D14A4A",0.85*F(t),1.05); } }
        break; }
      default: break;
    }
  }

  // Convenience: draw whatever this unit+motion needs. Returns true if it drew.
  drawFor(ctx,W,Hh,unitIndex,motion,phase){
    const key = motion==="skill"  ? this.vfxKey(unitIndex)
              : motion==="death"  ? this.deathFxKey(unitIndex)
              : motion==="attack" ? this.atkFxKey(unitIndex) : null;
    if(!key) return false;
    ctx.save();
    ctx.globalCompositeOperation="lighter"; ctx.lineJoin="round"; ctx.lineCap="round";
    this.fxDraw(ctx,W,Hh,key,phase, unitIndex<12?1:-1);
    ctx.restore();
    return true;
  }
}
export const VFX = new Vfx();
// Seconds per loop, per motion.
export const MOTION_PERIODS = { walk:1.0, attack:1.25, hit:0.95, death:3.0, skill:2.0 };
