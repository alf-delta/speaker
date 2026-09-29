import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG as C, DIM as D, DRV, PR_PROFILES, SOURCES, SOURCE_LABELS, CHANNELS, cutList } from './config.js';
import { bassSummary, bassSweep, tunePR, sealed } from './acoustics.js';
import { createCabinet, materialVolumeM3 } from './cabinet.js';
const $=id=>document.getElementById(id);
const fmt=(v,d=1)=>v.toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
$('box-size').textContent=`${C.box.w} × ${C.box.h} × ${C.box.d}`;
$('chamber-list').innerHTML=[
  ['#42685b','RSS265HF-4 + RSS315-PR','Саб сзади · пассивник спереди',D.netBass,1],
  ['#b78b52','SB15NBAC + SB26ADC','Основные L/R · внутрь на 8°',D.netMid,2],
  ['#7a8d9a','Scan-Speak 10F/4424G00','На фронте · наружу на 35°',D.netAmbient,2],
].map(([color,title,note,v,qty])=>`<div class="chamber-row"><span class="dot" style="background:${color}"></span><div><strong>${title}</strong><small>${note}</small></div><div class="volume">${fmt(v,qty===1?1:2)} <small>л${qty===2?' / шт.':''}</small></div></div>`).join('');

$('bass-tuning').textContent=C.tuningHz;
$('band-targets').textContent=`${C.subCrossoverHz} / ${C.tweeterCrossoverHz}`;
let resizeScene=()=>{}, currentPage='model';
for(const button of document.querySelectorAll('[data-page]')) button.addEventListener('click',()=>{
  currentPage=button.dataset.page;
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b===button);if(b===button)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==`page-${currentPage}`);
  resizeScene();
});

function initializeScene() {
  const viewport=$('viewport'), scene=new THREE.Scene(); scene.background=new THREE.Color(0xeeeee7);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.setAttribute('aria-label','3D-модель корпуса. Вращение и масштабирование мышью.');
  viewport.prepend(renderer.domElement);
  const labels=new CSS2DRenderer(); labels.domElement.className='label-layer'; viewport.append(labels.domElement);
  const camera=new THREE.PerspectiveCamera(37,1,1,12000), controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=550;controls.maxDistance=5000;controls.maxPolarAngle=Math.PI*.95;
  const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.05).texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf9fbff,0x8c8b75,2.1));
  const key=new THREE.DirectionalLight(0xfff7e6,3.2);key.position.set(-400,1100,700);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-1000,right:1000,top:800,bottom:-800,near:100,far:3000});key.shadow.bias=-.0005;scene.add(key);
  const fill=new THREE.DirectionalLight(0xe5efff,1.7);fill.position.set(800,500,-400);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20000,20000),new THREE.ShadowMaterial({opacity:.10}));floor.rotation.x=-Math.PI/2;floor.position.y=-C.box.h/2-C.feetH;floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(2100,42,0xc4cebe,0xd9dfd0);grid.position.y=floor.position.y-.1;grid.material.transparent=true;grid.material.opacity=.37;scene.add(grid);
  const cabinet=createCabinet();scene.add(cabinet.root);
  $('wood-mass').textContent=`≈ ${fmt(materialVolumeM3(cabinet.panels)*C.plywoodDensity,0)} кг фанеры`;
  $('grille').addEventListener('change',e=>cabinet.setGrille(e.target.checked));
  $('axes').addEventListener('change',e=>cabinet.setAxes(e.target.checked));
  const dimensions=new THREE.Group();scene.add(dimensions);
  const lineMat=new THREE.LineBasicMaterial({color:0x81947e});
  function dimension(p1,p2,text,axis='y') {
    const group=new THREE.Group();dimensions.add(group);
    const a=new THREE.Vector3(...p1),b=new THREE.Vector3(...p2),mid=a.clone().lerp(b,.5);
    const points=[a,b];
    for(const p of [a,b]) {const lo=p.clone(),hi=p.clone();lo[axis]-=7;hi[axis]+=7;points.push(lo,hi);}
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),lineMat));
    const el=document.createElement('div');el.className='dimension-label';el.textContent=text;const label=new CSS2DObject(el);label.position.copy(mid);group.add(label);return group;
  }
  const {w,h,d}=C.box;
  dimension([-w/2,-h/2-75,d/2+35],[w/2,-h/2-75,d/2+35],`${w} мм`);
  const heightDimension=dimension([w/2+65,-h/2,d/2],[w/2+65,h/2,d/2],`${h} мм`,'x');
  dimension([w/2+65,-h/2-40,-d/2],[w/2+65,-h/2-40,d/2],`${d} мм`);
  const chamberLabels=new THREE.Group();scene.add(chamberLabels);chamberLabels.visible=false;
  const labelData=[
    [`БАС · ${fmt(D.netBass)} л`,0,95,-15],
    [`L · ${fmt(D.netMid,2)} л`,-C.midBox.x,130,C.midBox.z-65],
    [`R · ${fmt(D.netMid,2)} л`,C.midBox.x,130,C.midBox.z-65],
    [`10F · ${fmt(D.netAmbient,2)} л`,-C.ambientBox.x,95,C.ambientBox.z-25],
    [`10F · ${fmt(D.netAmbient,2)} л`,C.ambientBox.x,95,C.ambientBox.z-25],
  ];
  for(const [text,x,y,z] of labelData) {const el=document.createElement('div');el.className='chamber-label';el.textContent=text;const label=new CSS2DObject(el);label.position.set(x,y,z);label.visible=false;chamberLabels.add(label);}
  let view='iso', mode='solid', lastFitFactor=1;
  function setCamera(name) {
    view=name;heightDimension.visible=name!=='top';
    const positions={iso:[1050,760,1800],front:[0,0,2200],rear:[850,570,-1950],top:[0,2300,.01]};
    const aspect=viewport.clientWidth/Math.max(1,viewport.clientHeight), factor=Math.max(1,1.25/aspect);
    lastFitFactor=factor;camera.position.set(...positions[name]).multiplyScalar(factor);controls.target.set(0,-10,0);controls.update();
    document.querySelectorAll('[data-camera]').forEach(b=>{b.classList.toggle('active',b.dataset.camera===name);b.setAttribute('aria-pressed',String(b.dataset.camera===name));});
  }
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.camera)));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
    mode=b.dataset.mode;cabinet.setMode(mode);chamberLabels.visible=mode==='cutaway';chamberLabels.traverse(o=>{if(o.isCSS2DObject)o.visible=mode==='cutaway';});
    if(mode==='cutaway'&&view==='front')setCamera('iso');
    document.querySelectorAll('[data-mode]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
  }));
  $('dimensions').addEventListener('change',e=>{dimensions.visible=e.target.checked;dimensions.traverse(o=>{if(o.isCSS2DObject)o.visible=e.target.checked;});});
  resizeScene=()=>{const width=viewport.clientWidth,height=viewport.clientHeight;if(!width||!height)return;camera.aspect=width/height;const fitFactor=Math.max(1,1.25/camera.aspect);camera.position.sub(controls.target).multiplyScalar(fitFactor/lastFitFactor).add(controls.target);lastFitFactor=fitFactor;camera.updateProjectionMatrix();renderer.setSize(width,height);labels.setSize(width,height);};
  new ResizeObserver(()=>{resizeScene();}).observe(viewport);
  resizeScene();setCamera('iso');$('model-loading').hidden=true;
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('model-loading').textContent='3D-контекст потерян. Перезагрузи страницу; расчёт и чертёж доступны во вкладке «Сборка».';$('model-loading').hidden=false;});
  renderer.setAnimationLoop(()=>{if(currentPage!=='model'||document.hidden)return;controls.update();renderer.render(scene,camera);labels.render(scene,camera);});
}
try {initializeScene();} catch(error) {
  console.error(error);$('model-loading').textContent='Не удалось запустить WebGL. Расчёт, ведомость деталей и размерный чертёж доступны во вкладках «Акустика» и «Сборка».';
  document.querySelectorAll('[data-mode],[data-camera],#dimensions,#grille,#axes').forEach(b=>b.disabled=true);
}

// SVG graphs are drawn from the same electro-mechanical model used in the report.
function graph(series,{min,max,ticks,lines=[],unit}) {
  const W=760,H=206,L=42,R=42,T=14,B=31;
  const x=f=>L+Math.log(f/10)/Math.log(20)*(W-L-R), y=v=>T+(max-v)/(max-min)*(H-T-B);
  const grids=ticks.map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#d9ddd3"/><text x="${L-9}" y="${y(v)+3}" text-anchor="end">${v}</text>`).join('');
  const xticks=[10,20,30,50,100,200].map(f=>`<line x1="${x(f)}" y1="${T}" x2="${x(f)}" y2="${H-B}" stroke="#e2e5db"/><text x="${x(f)}" y="${H-11}" text-anchor="middle">${f}</text>`).join('');
  const limitLines=lines.map(l=>`<line x1="${L}" y1="${y(l.value)}" x2="${W-R}" y2="${y(l.value)}" stroke="${l.color}" stroke-dasharray="5 5"/><text x="${W-R+6}" y="${y(l.value)+3}" fill="${l.color}">${l.label}</text>`).join('');
  const paths=series.map(s=>`<path d="${s.points.map((p,i)=>`${i?'L':'M'}${x(p.f).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.dashed?1.4:2.2}" ${s.dashed?'stroke-dasharray="5 5"':''}/>`).join('');
  const clipId=min<0?'response-clip':'excursion-clip';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit}" style="font:10px sans-serif;fill:#778274"><defs><clipPath id="${clipId}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}"/></clipPath></defs>${grids}${xticks}${limitLines}<g clip-path="url(#${clipId})">${paths}</g></svg>`;
}
$('voltage').value=C.defaultVolts;
function updateCalculation() {
  const volts=Number($('voltage').value),profile=PR_PROFILES.reference,protection=$('protection').checked,eq=$('bass-eq').checked;
  $('voltage-value').textContent=`${fmt(volts,volts%1?1:0)} В RMS`;
  const options={volts,profile,protection,eq},s=bassSummary(options),pr=tunePR(D.netBass,C.tuningHz,profile),raw=bassSweep({...options,protection:false});
  $('tuning-stats').innerHTML=[['Объём баса',`${fmt(D.netBass,2)} л`],['F₃ модели',s.f3?`${fmt(s.f3)} Гц`:'—'],['Добавить к PR',`≈ ${fmt(pr.addedGrams,0)} г`],['Полная Mms PR',`${fmt(pr.totalGrams,0)} г`],['Ход сабвуфера',`${fmt(s.maxSub)} / ${fmt(DRV.sub.xmax)} мм`],['Ход PR',`${fmt(s.maxPR)} / ${DRV.pr.xmax} мм`]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const over=s.maxSub>DRV.sub.xmax||s.maxPR>DRV.pr.xmax;
  $('excursion-status').classList.toggle('warning',over);
  $('excursion-status').textContent=over?'Превышен Xmax. Уменьши напряжение или включи защитный ФВЧ.':`В пределах Xmax в этой модели. Расчётная граница по ходу ≈ ${fmt(s.excursionVolts)} В RMS; это не готовая настройка лимитера.`;
  $('response-chart').innerHTML=graph([
    {points:raw.map(p=>({f:p.f,v:p.spl-s.reference})),color:'#89958c',dashed:true},
    {points:s.curve.map(p=>({f:p.f,v:p.spl-s.reference})),color:'#2f6258'},
  ],{min:-36,max:6,ticks:[-30,-20,-10,0],lines:[{value:-3,label:'−3',color:'#b38d53'}],unit:'Прогноз относительного НЧ-отклика, дБ, от 10 до 200 Гц'});
  const ymax=Math.max(30,Math.ceil(Math.max(s.maxSub,s.maxPR)/5)*5);
  $('excursion-chart').innerHTML=graph([
    {points:s.curve.map(p=>({f:p.f,v:p.subMm})),color:'#2f6258'},
    {points:s.curve.map(p=>({f:p.f,v:p.prMm})),color:'#ad7640'},
  ],{min:0,max:ymax,ticks:[0,Math.round(ymax/4),Math.round(ymax/2),Math.round(3*ymax/4)],lines:[{value:DRV.sub.xmax,label:'12,3',color:'#658d7d'},{value:DRV.pr.xmax,label:'26',color:'#b79571'}],unit:'Пиковый ход сабвуфера и пассивного излучателя в мм'});
}
for(const id of ['bass-eq','voltage','protection']) $(id).addEventListener('input',updateCalculation);
updateCalculation();
const mid=sealed(DRV.mid,D.netMid),amb=sealed(DRV.ambient,D.netAmbient);
function notes(id,items) {$(id).innerHTML=items.map(([title,text])=>`<article><h3>${title}</h3><p>${text}</p></article>`).join('');}
notes('acoustic-notes',[
  ['Камеры и демпфирование',`SB15: Qtc ≈ ${fmt(mid.qtc,2)}, Fc ≈ ${fmt(mid.fc,0)} Гц. 10F: Qtc ≈ ${fmt(amb.qtc,2)}, Fc ≈ ${fmt(amb.fc,0)} Гц. Объёмы после вычетов; влияние наполнителя уточняется измерением.`],
  ['Разделы — акустические цели',`${C.subCrossoverHz} Гц между сабом и SB15; ${C.tweeterCrossoverHz} Гц между SB15 и SB26. Цель — LR4 с учётом собственных откликов. Межцентровое расстояние ${D.centerSpacing} мм. Задний саб согласуется по измеренной фазе.`],
  ['Пространство с возможностью сравнения',`10F направлены наружу на ${C.ambientBox.yawDeg}°. Пробная полоса ${C.ambientHighpassHz}–${C.ambientLowpassHz} Гц, уровень −12 дБ, дополнительная задержка 4 мс. Пресет без наружных каналов нужен для сравнения разборчивости. Эффект зависит от отражений комнаты.`],
]);
$('cut-list').innerHTML=cutList().map(r=>`<tr><td>${r.part}<small class="row-note">${r.note}</small></td><td>${fmt(r.a,1)} × ${fmt(r.b,1)} × ${r.t}</td><td>${r.qty}</td></tr>`).join('');
$('channel-list').innerHTML=CHANNELS.map(r=>`<tr><td>${r.out}</td><td>${r.input}</td><td>${r.driver}</td><td>${r.amp}</td><td>${r.band}</td><td>${r.delay}</td></tr>`).join('');
$('component-list').innerHTML=Object.entries(DRV).map(([key,d])=>`<tr><td><a href="${SOURCES[key]}" target="_blank" rel="noopener">${d.model} ↗</a></td><td>${['mid','tweeter','ambient'].includes(key)?2:1}</td><td>${d.ohms?d.ohms+' Ом':'PR'}</td><td>Ø${fmt(d.od,1)}</td><td>Ø${d.cutout}</td><td>${d.depth}</td></tr>`).join('');
$('download-cutlist').addEventListener('click',()=>{
  const content='Деталь\tКоличество\tРазмер A, мм\tРазмер B, мм\tТолщина, мм\tПримечание\n'+cutList().map(r=>[r.part,r.qty,r.a,r.b,r.t,r.note].join('\t')).join('\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+content],{type:'text/tab-separated-values;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='monoblock-cut-list.tsv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
notes('build-notes',[
  ['Семь каналов усиления', 'miniDSP Flex Eight: 8 аналоговых выходов, 7 используются. Три Fosi V3 — основные СЧ, ВЧ и наружная пара; V3 Mono — саб. БП 32 В / 5 А для стерео и 48 В / 5 А для Mono остаются снаружи. Для измерений — UMIK-1.'],
  ['Дуга и защита',`Верх и низ — по 2 × 18 мм; дуга R ${fmt(D.arcRadius,1)} мм, стрела ${C.arcSag} мм. Перед ней перфорированная металлическая решётка; зазор проверен по заявленному ходу. Размеры проёмов и выборок предварительные, крепёж переносится с головок.`],
  ['Установка под телевизором',`Высота с опорами ${C.box.h+C.feetH} мм. За сабвуфером заложен стартовый зазор ${C.rearClearance} мм. Боковые отсеки изолированы от акустических камер; габариты электроники показаны для компоновки. Проводку, разъёмы и охлаждение уточнить на прототипе.`],
]);
$('source-links').innerHTML=Object.entries(SOURCES).map(([k,url])=>`<a href="${url}" target="_blank" rel="noopener">${DRV[k]?.model??SOURCE_LABELS[k]} ↗</a>`).join('');
