import * as THREE from 'three';
import {CONFIG as C,DIM as D,DRV,arcZ,bafflePoses,frontSegments,transformXZ} from './config.js';
import {createMaterials} from './materials.js';
import {createDriver} from './drivers.js';

export function panelGeometry(w,h,t,holes=[]){
  const s=new THREE.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();
  for(const hole of holes){const p=new THREE.Path(),x=hole.x??0,y=hole.y??0;
    if(hole.w){p.moveTo(x-hole.w/2,y-hole.h/2);p.lineTo(x-hole.w/2,y+hole.h/2);p.lineTo(x+hole.w/2,y+hole.h/2);p.lineTo(x+hole.w/2,y-hole.h/2);p.closePath();}
    else p.absarc(x,y,hole.r,0,2*Math.PI,true);s.holes.push(p);
  }
  const g=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false,curveSegments:48});g.translate(0,0,-t/2);return g;
}
export function capGeometry(thickness=18){
  const s=new THREE.Shape(),{w,d}=C.box;s.moveTo(-w/2,-d/2);s.lineTo(w/2,-d/2);
  for(let i=0;i<=128;i++){const x=w/2-w*i/128;s.lineTo(x,arcZ(x));}s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:false,curveSegments:1});g.rotateX(Math.PI/2);return g;
}
// Signed tetrahedra give material volume after mounting holes, before joint
// trimming. The density is an explicit assumption in the UI/report.
export function materialVolumeM3(panels){
  let total=0;
  for(const panel of panels){
    const a=panel.geometry.attributes.position.array;let volume=0;
    for(let i=0;i<a.length;i+=9){const ax=a[i],ay=a[i+1],az=a[i+2],bx=a[i+3],by=a[i+4],bz=a[i+5],cx=a[i+6],cy=a[i+7],cz=a[i+8];volume+=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx);}
    total+=Math.abs(volume/6)/1e9;
  }
  return total;
}
export function createCabinet(){
  const root=new THREE.Group(),shell=new THREE.Group(),inside=new THREE.Group(),front=new THREE.Group(),rear=new THREE.Group(),top=new THREE.Group(),lids=new THREE.Group(),electronics=new THREE.Group();
  const panels=[],mounts=[],chambers=[],mats=createMaterials(THREE);
  const wood=new THREE.MeshStandardMaterial({color:0xbfa889,roughness:.78});
  const edge=new THREE.MeshStandardMaterial({color:0xd1bc97,roughness:.9});
  const face=new THREE.MeshStandardMaterial({color:0x343e3a,roughness:.69,metalness:.04});
  const cheeks=new THREE.MeshStandardMaterial({color:0x515953,roughness:.83});
  root.add(shell,inside,front,rear,top,lids,electronics);
  function panel(parent,w,h,t,pos=[0,0,0],rot=[0,0,0],holes=[],material=wood,name='panel'){
    const m=new THREE.Mesh(panelGeometry(w,h,t,holes),material);m.name=name;m.position.set(...pos);m.rotation.set(...rot);m.castShadow=m.receiveShadow=true;parent.add(m);panels.push(m);return m;
  }
  function poseGroup(parent,p){const g=new THREE.Group();g.position.set(p.x,0,p.z);g.rotation.y=p.yaw;parent.add(g);return g;}
  function baffle(parent,w,h,t,drivers,name){
    const levels=[...new Set([t,...drivers.map(p=>DRV[p.kind].flange),0])].sort((a,b)=>b-a);
    for(let i=0;i<levels.length-1;i++){
      const depth=(levels[i]+levels[i+1])/2;
      panel(parent,w,h,levels[i]-levels[i+1],[0,0,-depth],[0,0,0],drivers.map(p=>({x:p.x??0,y:p.y??0,r:(depth<DRV[p.kind].flange?DRV[p.kind].od+1:DRV[p.kind].cutout)/2})),face,name);
    }
    for(const p of drivers){const obj=createDriver(p.kind,mats);obj.position.set(p.x??0,p.y??0,0);obj.traverse(x=>{if(x.isMesh)x.castShadow=true;});parent.add(obj);mounts.push({kind:p.kind,object:obj});}
  }
  const {w,h,d}=C.box,t=C.partition;
  for(const y of [h/2,-h/2+C.cap])for(let layer=0;layer<2;layer++){
    const m=new THREE.Mesh(capGeometry(18),layer===0?wood:edge);m.position.y=y-layer*18;m.castShadow=m.receiveShadow=true;(y>0?top:shell).add(m);panels.push(m);
  }
  // Fine lines describe the plywood laminations along the continuous arc.
  for(const sign of [-1,1])for(let i=1;i<12;i++){
    const points=Array.from({length:97},(_,j)=>{const x=-w/2+w*j/96;return new THREE.Vector3(x,sign*(h/2-i*3),arcZ(x)+.1);});
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8e795e,transparent:true,opacity:.3}));(sign>0?top:shell).add(line);
  }
  const sideDepth=arcZ(w/2)-D.backInner;
  for(const side of [-1,1]){
    panel(shell,sideDepth,D.ih,C.wall,[side*(w/2-C.wall/2),0,D.backInner+sideDepth/2],[0,Math.PI/2,0],[],wood,'side');
    panel(inside,D.id,D.ih,t,[side*(C.bassChamberWidth/2+t/2),0,(D.frontInner+D.backInner)/2],[0,Math.PI/2,0],[],edge,'bass partition');
  }
  for(const z of C.brace.z)panel(inside,C.bassChamberWidth,D.ih,C.brace.thickness,[0,0,z],[0,0,0],[{w:C.bassChamberWidth-2*C.brace.frame,h:D.ih-2*C.brace.frame}],edge,'bass brace');
  const center=poseGroup(front,{x:0,z:C.bassFaceZ,yaw:0});baffle(center,C.bassChamberWidth+2*t,D.ih,C.front,[{kind:'pr'}],'PR baffle');
  // Subwoofer is on the rear. Ventilation only opens the non-acoustic wings.
  const back=poseGroup(rear,{x:0,z:-d/2,yaw:Math.PI});
  const vents=[];for(const side of [-1,1])for(const y of [-139,139])for(const dy of [-10,0,10])vents.push({x:side*470,y:y+dy,w:240,h:5});
  for(const [from,to] of [[C.back,DRV.sub.flange],[DRV.sub.flange,0]])panel(back,w,D.ih,from-to,[0,0,-(from+to)/2],[0,0,0],[{r:(to===0?DRV.sub.od+1:DRV.sub.cutout)/2},...vents],face,'rear');
  const sub=createDriver('sub',mats);back.add(sub);mounts.push({kind:'sub',object:sub});
  for(const p of bafflePoses()){
    const b=p.kind==='mid'?C.midBox:C.ambientBox,g=poseGroup(front,p),box=poseGroup(inside,p),lid=poseGroup(lids,p);
    baffle(g,p.w,D.ih,C.satelliteFront,p.kind==='mid'?[{kind:'mid',y:C.layout.midY},{kind:'tweeter',y:C.layout.tweeterY}]:[{kind:'ambient'}],`${p.kind} baffle`);
    const cz=-C.satelliteFront-(b.d+t)/2;
    for(const side of [-1,1]){
      panel(box,b.d+t,b.h+2*t,t,[side*(b.w/2+t/2),0,cz],[0,Math.PI/2,0],[],edge,`${p.kind} side`);
      panel(side>0?lid:box,b.w,b.d+t,t,[0,side*(b.h/2+t/2),cz],[Math.PI/2,0,0],[],wood,`${p.kind} lid`);
    }
    panel(box,b.w,b.h,t,[0,0,-C.satelliteFront-b.d-t/2],[0,0,0],[],wood,`${p.kind} back`);
    chambers.push({kind:p.kind,side:p.side,pose:p,group:box});
  }
  for(const p of frontSegments().fillers){const g=poseGroup(front,p);panel(g,p.w,D.ih,C.satelliteFront,[0,0,-C.satelliteFront/2],[0,0,0],[],cheeks,'front return');}
  const footMat=new THREE.MeshStandardMaterial({color:0x252927,roughness:.8});
  for(const x of [-w/2+80,w/2-80])for(const z of [-d/2+75,arcZ(w/2)-50]){const foot=new THREE.Mesh(new THREE.CylinderGeometry(22,24,C.feetH,32),footMat);foot.position.set(x,-h/2-C.feetH/2,z);shell.add(foot);}
  // Electronics: nominal cases, low-voltage PSUs external. Cable/thermal
  // clearances remain fabrication checks, not deducted from acoustic volumes.
  const cases=[
    {name:'Flex Eight',x:-340,y:-110,z:-119,w:180,h:41,d:150},
    {name:'V3 1',x:350,y:-105,z:-126,w:166,h:36,d:105},
    {name:'V3 2',x:350,y:-40,z:-126,w:166,h:36,d:105},
    {name:'V3 3',x:350,y:25,z:-126,w:166,h:36,d:105},
    {name:'V3 Mono',x:-530,y:-105,z:-130,w:150,h:45,d:105},
  ];
  const em=new THREE.MeshStandardMaterial({color:0x52676c,roughness:.6,metalness:.25});
  for(const e of cases){const m=new THREE.Mesh(new THREE.BoxGeometry(e.w,e.h,e.d),em);m.position.set(e.x,e.y,e.z);m.name=e.name;electronics.add(m);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x95a7a3}));m.add(edges);}
  const grille=new THREE.Group();root.add(grille);
  const points=[],uv=[],indices=[],N=160;
  for(let i=0;i<=N;i++){const x=-w/2+w*i/N;for(const y of [-D.ih/2+3,D.ih/2-3]){points.push(x,y,arcZ(x)-C.grille.thickness);uv.push(i/N,y/D.ih+.5);}}
  for(let i=0;i<N;i++){const a=2*i;indices.push(a,a+2,a+1,a+2,a+3,a+1);}
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(points,3));gg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));gg.setIndex(indices);gg.computeVertexNormals();
  const gm=new THREE.MeshStandardMaterial({color:0x343b38,roughness:.62,metalness:.32,side:THREE.DoubleSide,transparent:true,depthWrite:false});
  // Perforations for appearance only; fabrication drawing does not export holes.
  gm.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 grillPos;').replace('#include <begin_vertex>','#include <begin_vertex>\ngrillPos=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 grillPos;').replace('#include <alphamap_fragment>','#include <alphamap_fragment>\nvec2 cell=mod(grillPos.xy,6.0)-vec2(3.0); float aa=max(length(fwidth(grillPos.xy))*.65,.03); float cover=smoothstep(2.5-aa,2.5+aa,length(cell)); cover=mix(cover,.455,clamp((aa-1.0)/3.0,0.0,1.0)); diffuseColor.a*=cover; if(diffuseColor.a<.015) discard;');};
  const screen=new THREE.Mesh(gg,gm);grille.add(screen);grille.visible=false;
  // Orientation axes, not simulated acoustic beams.
  const axes=new THREE.Group();root.add(axes);
  for(const p of bafflePoses()){
    const origin=new THREE.Vector3(p.x,0,p.z+5),dir=new THREE.Vector3(Math.sin(p.yaw),0,Math.cos(p.yaw));
    axes.add(new THREE.ArrowHelper(dir,origin,p.kind==='mid'?380:300,p.kind==='mid'?0x4c8072:0xb8894e,24,11));
  }
  axes.visible=false;
  const blueprint=new THREE.Group(),lm=new THREE.LineBasicMaterial({color:0x52787d});root.updateMatrixWorld(true);
  for(const p of panels){const line=new THREE.LineSegments(new THREE.EdgesGeometry(p.geometry,25),lm);line.applyMatrix4(p.matrixWorld);blueprint.add(line);}
  for(const m of mounts){const r=DRV[m.kind].od/2,points=Array.from({length:97},(_,i)=>new THREE.Vector3(r*Math.cos(i*Math.PI/48),r*Math.sin(i*Math.PI/48),0));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),lm);line.applyMatrix4(m.object.matrixWorld);blueprint.add(line);}
  root.add(blueprint);blueprint.visible=false;
  let mode='solid',showGrille=false,showAxes=false;
  function refresh(){const bp=mode==='blueprint',cut=mode==='cutaway',explode=mode==='exploded';
    for(const g of [shell,inside,front,rear,top,lids,electronics])g.visible=!bp;
    top.visible=!bp&&!cut;front.visible=!bp&&!cut;lids.visible=!bp&&!cut;
    front.position.z=explode?185:0;rear.position.z=explode?-130:0;top.position.y=explode?140:0;
    grille.visible=showGrille&&mode==='solid';axes.visible=showAxes&&mode!=='exploded';blueprint.visible=bp;
  }
  return {root,panels,mounts,chambers,cases,setMode(value){mode=value;refresh();},setGrille(value){showGrille=value;refresh();},setAxes(value){showAxes=value;refresh();}};
}
