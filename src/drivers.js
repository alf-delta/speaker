import * as THREE from 'three';
import {DRV} from './config.js';
// Schematic internals; outer flange and installation envelope follow config.
// Every origin is the flush front face. Basket geometry is not a CNC template.
export function makeRing(outerD,innerD,thickness,mat){
  const s=new THREE.Shape();s.absarc(0,0,outerD/2,0,Math.PI*2,false);
  const hole=new THREE.Path();hole.absarc(0,0,innerD/2,0,Math.PI*2,true);s.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:false,curveSegments:48});g.translate(0,0,-thickness);
  return new THREE.Mesh(g,mat);
}
function disk(r,depth,z,mat){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,48).rotateX(Math.PI/2),mat);m.position.z=z;return m;}
function dome(radius,z,mat,flatten=.4){const g=new THREE.SphereGeometry(radius,48,20,0,2*Math.PI,0,Math.PI/2);g.rotateX(Math.PI/2);const m=new THREE.Mesh(g,mat);m.position.z=z;m.scale.z=flatten;return m;}
function cone(inner,outer,depth,mat){
  const points=Array.from({length:17},(_,i)=>{const t=i/16;return new THREE.Vector2(inner+(outer-inner)*t,depth*(1-t)**1.25);});
  const g=new THREE.LatheGeometry(points,64);g.rotateX(-Math.PI/2);return new THREE.Mesh(g,mat);
}
function screws(group,r,count,mat){for(let i=0;i<count;i++){const a=2*Math.PI*i/count+(count===4?Math.PI/4:0),m=disk(2.3,1,.4,mat);m.position.x=r*Math.cos(a);m.position.y=r*Math.sin(a);group.add(m);}}
export function createDriver(kind,mats){
  const d=DRV[kind],g=new THREE.Group();g.name=d.model;g.userData={kind,depth:d.depth,od:d.od};
  const front=mats.matMetal,coneMat=kind==='ambient'?mats.matConeBlack:mats.matConeAlum;
  if(kind==='tweeter'){
    g.add(makeRing(d.od,29,d.flange,front),dome(13,1,mats.matConeAlum,.3));
    // Phase shield of SB26ADC; protective grille is a separate cabinet part.
    const shield=new THREE.Mesh(new THREE.BoxGeometry(7,29,2),front);shield.position.z=6;g.add(shield);
    g.add(disk(34,(d.depth-d.flange),-(d.depth+d.flange)/2,mats.matAccent));screws(g,44.25,4,mats.matFastener);
    return g;
  }
  const inner=d.cutout/2-4,roll=kind==='sub'||kind==='pr'?10:kind==='mid'?5:3.5;
  g.add(makeRing(d.od,d.cutout-3,d.flange,front));
  const surround=new THREE.Mesh(new THREE.TorusGeometry(inner-roll,roll,16,72),mats.matRubber);surround.position.z=0;surround.scale.z=d.projection/roll;g.add(surround);
  const depth=kind==='pr'?22:kind==='sub'?33:kind==='mid'?20:13;
  const capR=kind==='pr'?45:kind==='sub'?43:kind==='mid'?24:13;
  g.add(cone(capR*.65,inner-roll,depth,coneMat),dome(capR,-depth+2,coneMat,.26));
  const basket=new THREE.Mesh(new THREE.CylinderGeometry(inner-4,inner*.56,Math.max(16,d.depth-35),12,1,true).rotateX(Math.PI/2),mats.matMetal);
  basket.position.z=-(d.depth-35)/2-d.flange;g.add(basket);
  if(kind==='pr'){
    g.add(disk(28,14,-d.depth+12,mats.matAccent));
    const rod=disk(4,25,-d.depth+12,mats.matFastener);g.add(rod);
  }else{
    const magR=kind==='sub'?78:kind==='mid'?50:26;
    g.add(disk(magR,kind==='sub'?44:20,-d.depth+(kind==='sub'?22:10),mats.matAccent));
  }
  screws(g,d.od/2-(kind==='sub'||kind==='pr'?9:6),kind==='sub'||kind==='pr'?8:4,mats.matFastener);
  return g;
}
