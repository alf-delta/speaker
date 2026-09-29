import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONFIG as C,DIM as D,DRV,PR_PROFILES,CHANNELS,derive,arcZ,arcRadius,bafflePoses,frontSegments,transformXZ,chamberFootprint,cutList} from '../src/config.js';
import {AIR,sealed,tunePR,bassAt,bassSummary,peakingGain} from '../src/acoustics.js';
import {createCabinet,capGeometry} from '../src/cabinet.js';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
// Independent separating-axis test: positive gap means disjoint polygons.
function separation(a,b){let gap=-Infinity;for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz),axis=[-dz/len,dx/len];
  const A=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),B=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);
  gap=Math.max(gap,Math.min(...B)-Math.max(...A),Math.min(...A)-Math.max(...B));
}return gap;}

test('air volume ledger uses actual rectangular chambers, braces and separate allowances',()=>{
  close(D.grossBass,420*348*348/1e6);close(D.braceLiters,2*(420*348-360*288)*18/1e6);close(D.netBass,46.0344);
  close(D.netMid,5.1508);close(D.netAmbient,.68264);
  const changed=derive({...C,bassFaceZ:C.bassFaceZ+10});close(changed.netBass-D.netBass,420*348*10/1e6);
  const wider=derive({...C,box:{...C.box,w:C.box.w+100}});close(wider.netBass,D.netBass); // decorative wings cannot inflate bass volume
});
test('circular caps recover exact sag and their mesh volume agrees with the analytic arc area',()=>{
  const R=arcRadius();close(arcZ(0),235);close(arcZ(680),105);close(arcZ(-680),105);
  for(const x of [-680,-300,0,150,680])close(x*x+(arcZ(x)-(235-R))**2,R*R,1e-7);
  const g=capGeometry(),p=g.attributes.position.array;let volume=0;
  for(let i=0;i<p.length;i+=9){const [ax,ay,az,bx,by,bz,cx,cy,cz]=p.slice(i,i+9);volume+=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx);}
  close(Math.abs(volume/6)/(D.planArea*18),1,3e-5);
});
test('main axes point inward and ambience axes outward, all four panels remain on the front',()=>{
  for(const p of bafflePoses()){
    assert.ok(p.z>0);assert.ok(Math.cos(p.yaw)>0);
    assert.ok((p.kind==='mid'?-1:1)*p.side*Math.sin(p.yaw)>0);
    for(const [x,z] of [transformXZ(-p.w/2,0,p),transformXZ(p.w/2,0,p)])assert.ok(z<arcZ(x));
  }
  const {baffles,fillers}=frontSegments();assert.equal(baffles.length,5);assert.equal(fillers.length,6);
  close(baffles[2].z,C.bassFaceZ);assert.ok(D.mainAxisCrossing>2500&&D.mainAxisCrossing<2800);
});
test('all rotated chamber enclosures fit inside the cap and do not collide with one another or bass walls',()=>{
  const bass=[[-228,D.backInner],[228,D.backInner],[228,C.bassFaceZ],[-228,C.bassFaceZ]];
  const polygons=bafflePoses().map(p=>chamberFootprint(p.kind,p.side));
  for(let i=0;i<polygons.length;i++){
    assert.ok(separation(polygons[i],bass)>5,`bass collision ${i}`);
    for(const [x,z] of polygons[i]){assert.ok(Math.abs(x)<C.box.w/2-C.wall);assert.ok(z>D.backInner);assert.ok(z<arcZ(x));}
    for(let j=i+1;j<polygons.length;j++)assert.ok(separation(polygons[i],polygons[j])>5,`chambers ${i},${j} collide`);
  }
});
test('flanges, rear envelopes, braces and grille retain physical clearance',()=>{
  assert.ok(D.centerSpacing-(DRV.mid.od+DRV.tweeter.od)/2>=8);
  assert.ok(C.layout.midY-DRV.mid.od/2>=-C.midBox.h/2);assert.ok(C.layout.tweeterY+DRV.tweeter.od/2<=C.midBox.h/2);
  assert.ok(DRV.pr.od<D.ih);assert.ok(DRV.sub.od<D.ih);
  assert.ok(C.satelliteFront+C.midBox.d-DRV.mid.depth>=25);assert.ok(C.satelliteFront+C.ambientBox.d-DRV.ambient.depth>=25);
  assert.ok(Math.min(...C.brace.z)-C.brace.thickness/2-(-C.box.d/2+DRV.sub.depth)>=25);
  assert.ok(C.bassFaceZ-DRV.pr.depth-Math.max(...C.brace.z)-C.brace.thickness/2>=25);
  const faces=[{kind:'pr',x:0,z:C.bassFaceZ,yaw:0},...bafflePoses()];
  for(const p of faces)for(const kind of p.kind==='mid'?['mid','tweeter']:[p.kind])for(let i=0;i<181;i++){
    const d=DRV[kind],localX=d.od/2*Math.cos(i*Math.PI/90),[x,z]=transformXZ(localX,d.projection+(d.xmax??0),p);
    assert.ok(arcZ(x)-C.grille.thickness-z>=C.grille.minClearance,`grille hits ${kind}`);
  }
});
test('sealed reference case and PR stiffness independently recover their expected poles',()=>{
  const s=sealed({fs:40,qts:.5,vas:10},10);close(s.qtc,Math.SQRT1_2);close(s.f3,s.fc);
  const p=PR_PROFILES.reference;
  for(const liters of [35,D.netBass,55])for(const hz of [24,28,32]){
    const t=tunePR(liters,hz,p),sp=DRV.pr.sd/1e4,k=1/(p.cms/1e3)+AIR.rho*AIR.c**2*sp**2/(liters/1e3);
    close(Math.sqrt(k/(t.totalGrams/1000))/(2*Math.PI),hz);close(t.totalGrams-p.mms,t.addedGrams);close(t.rms,7.77);
  }
});
test('electromechanical solver preserves voltage scaling and LR4 high-pass response',()=>{
  for(const eq of [false,true])for(const frequency of [15,28,60,100,200]){
    const a=bassAt(frequency,{volts:1,eq}),b=bassAt(frequency,{volts:2,eq});close(b.subMm,2*a.subMm);close(b.prMm,2*a.prMm);close(b.spl-a.spl,20*Math.log10(2));
  }
  const a=bassAt(C.subsonicHz,{protection:false}),b=bassAt(C.subsonicHz);close(b.subMm/a.subMm,.5);close(b.spl-a.spl,-20*Math.log10(2));
});
test('optional EQ increases displacement consistently and reduces remaining voltage headroom',()=>{
  close(peakingGain(30,C.bassEq),10**(3/20));close(peakingGain(30,{...C.bassEq,gainDb:0}),1);
  const base=bassSummary(),eq=bassSummary({eq:true}),over=bassSummary({eq:true,volts:40});
  assert.ok(base.f3>34&&base.f3<35);assert.ok(eq.f3>29&&eq.f3<31);
  assert.ok(eq.maxSub>base.maxSub&&eq.maxPR>base.maxPR);assert.ok(eq.excursionVolts<base.excursionVolts);
  assert.ok(eq.maxSub<DRV.sub.xmax&&eq.maxPR<DRV.pr.xmax);assert.ok(over.maxSub>DRV.sub.xmax);
  assert.ok(bassSummary({protection:false}).maxSub>DRV.sub.xmax);
});
test('3D mounting transforms match the rear sub / front PR and rotated satellite configuration',()=>{
  const m=createCabinet();m.root.updateMatrixWorld(true);assert.equal(m.mounts.length,8);assert.equal(m.chambers.length,4);
  for(const mount of m.mounts){const pos=mount.object.getWorldPosition(mount.object.position.clone()),e=mount.object.matrixWorld.elements;
    if(mount.kind==='sub'){close(pos.z,-235);assert.ok(e[10]<-.99);}
    else{assert.ok(pos.z>0);assert.ok(e[10]>0);if(mount.kind==='pr')close(pos.z,185);}
  }
  for(const row of cutList())for(const key of ['a','b','t','qty'])assert.ok(row[key]>0);
  for(const p of m.panels){p.geometry.computeBoundingBox();const bb=p.geometry.boundingBox;for(const axis of ['x','y','z'])assert.ok(Number.isFinite(bb.min[axis])&&bb.max[axis]>bb.min[axis]);}
  for(const mode of ['solid','cutaway','exploded','blueprint']){m.setMode(mode);m.setGrille(true);m.setAxes(true);}
  m.setMode('solid');m.root.updateMatrixWorld(true);
});
test('DSP mapping uses exactly seven active outputs and one muted reserve',()=>{
  assert.deepEqual(CHANNELS.map(r=>r.out),[1,2,3,4,5,6,7,8]);assert.equal(CHANNELS.filter(r=>r.amp!=='—').length,7);assert.equal(CHANNELS[6].input,'0,5 L + 0,5 R');assert.equal(CHANNELS[7].band,'Mute');
});
test('generated report, drawing and manifest describe the current revision',async()=>{
  const json=JSON.parse(await readFile(new URL('../public/components.json',import.meta.url),'utf8'));
  close(json.derived.netBass,D.netBass);assert.equal(json.drivers.ambient.model,DRV.ambient.model);
  for(const name of ['engineering.md','drawings.svg']){const content=await readFile(new URL('../public/'+name,import.meta.url),'utf8');assert.ok(content.includes('REV.03'));assert.ok(!/RSS210|DS315-PR|CX120|RS125|RST28/.test(content));}
});
