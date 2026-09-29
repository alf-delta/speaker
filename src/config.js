// Millimetres; X right, Y up, Z toward listener. Front baffle poses refer to
// the flush flange surface, not to the back of the flange. Shared by all views.
export const SOURCES = {
  sub: 'https://www.daytonaudio.com/images/resources/295-460-dayton-audio-rss265hf-4-specifications-46172.pdf',
  mid: 'https://sbacoustics.com/wp-content/uploads/2020/02/5in-SB15NBAC30-8.pdf',
  tweeter: 'https://sbacoustics.com/wp-content/uploads/2020/02/SB26ADC-C000-4.pdf',
  ambient: 'https://www.scan-speak.dk/datasheet/pdf/10f-4424g00.pdf',
  pr: 'https://www.daytonaudio.com/images/resources/295-502--rss315-pr-specification-sheet.pdf',
  dsp: 'https://www.minidsp.com/products/minidsp-in-a-box/minidsp-flex-eight',
  amp: 'https://fosiaudio.com/products/fosi-audio-v3-300w-x2-2-0-channel-hi-fi-stereo-audio-amplifier-with-tpa3255-chip',
  subAmp: 'https://fosiaudio.com/products/fosi-audio-v3-mono-power-amplifier',
  microphone: 'https://www.minidsp.com/products/acoustic-measurement/umik-1',
  crossover: 'https://www.linkwitzlab.com/crossovers.htm',
};
export const SOURCE_LABELS={dsp:'miniDSP Flex Eight',amp:'Fosi V3 stereo',subAmp:'Fosi V3 Mono',microphone:'UMIK-1',crossover:'Linkwitz: кроссоверы'};
export const CONFIG = {
  revision:'03', plywoodDensity:650, box:{w:1360,h:420,d:470}, wall:18, cap:36, back:36,
  front:36, satelliteFront:18, partition:18, feetH:30,
  arcSag:130, bassFaceZ:185, bassChamberWidth:420,
  brace:{frame:30,thickness:18,z:[25,-25]},
  midBox:{w:184,h:300,d:104,x:350,z:122,yawDeg:8,panelW:220},
  ambientBox:{w:112,h:140,d:48,x:590,z:85,yawDeg:35,panelW:148},
  layout:{midY:-62,tweeterY:71},
  // Allowances in litres. Only the 10F's 0.05 L comes from its manufacturer.
  displacement:{sub:2.2,pr:1.0,bassWiring:.1,mid:.45,tweeter:.10,midWiring:.04,ambient:.05,ambientWiring:.02},
  grille:{thickness:2,minClearance:5,pitch:6,hole:5},
  tuningHz:28,subsonicHz:22,subCrossoverHz:130,tweeterCrossoverHz:2300,
  ambientHighpassHz:300,ambientLowpassHz:8000,ambientDelayMs:4,ambientLevelDb:-12,
  bassEq:{frequency:30,gainDb:3,q:1}, // audition/model candidate, not a measured correction
  defaultVolts:20,listenerDist:3000,rearClearance:150,
};
// Depths are conservative total installation envelopes from flush front plane.
// Cutout/rebate clearances are prototype allowances: verify real parts first.
export const DRV = {
  sub:{model:'RSS265HF-4',ohms:4,flange:9.5,od:266,cutout:236,body:235,depth:137,projection:12,fs:25.6,qts:.45,qms:3.06,vas:54,sd:356.3,xmax:12.3,mms:120,cms:.32,re:3.5,le:.96,bl:11.43},
  mid:{model:'SB15NBAC30-8',ohms:8,flange:6.5,od:150,cutout:125,body:123.9,depth:79,projection:5,fs:35.5,qts:.37,qms:4.22,vas:17,sd:82,xmax:5},
  tweeter:{model:'SB26ADC-C000-4',ohms:4,flange:3,od:100,cutout:71,body:70,depth:39,projection:5,fs:680},
  ambient:{model:'10F/4424G00',ohms:4,flange:3.5,od:97.5,cutout:79,body:78,depth:40,projection:3,fs:90,qts:.29,qms:3.2,vas:2,sd:36,xmax:2.6},
  pr:{model:'RSS315-PR',flange:9.6,od:314,cutout:283,body:282,depth:100,projection:10,sd:506.7,xmax:26},
};
export const PR_PROFILES={reference:{label:'RSS315-PR · Mms 300 г / Cms 0,22',mms:300,cms:.22,qms:4.79,fs:21,rms:7.77}};
export const deg=v=>v*Math.PI/180;
export function arcRadius(c=CONFIG){return ((c.box.w/2)**2+c.arcSag**2)/(2*c.arcSag);}
export function arcZ(x,c=CONFIG){const r=arcRadius(c);return c.box.d/2-r+Math.sqrt(r*r-x*x);}
export function transformXZ(x,z,pose){return [pose.x+Math.cos(pose.yaw)*x+Math.sin(pose.yaw)*z,pose.z-Math.sin(pose.yaw)*x+Math.cos(pose.yaw)*z];}
export function bafflePoses(c=CONFIG){return [-1,1].flatMap(side=>[
  {kind:'mid',side,x:side*c.midBox.x,z:c.midBox.z,yaw:-side*deg(c.midBox.yawDeg),w:c.midBox.panelW},
  {kind:'ambient',side,x:side*c.ambientBox.x,z:c.ambientBox.z,yaw:side*deg(c.ambientBox.yawDeg),w:c.ambientBox.panelW},
]);}
export function frontSegments(c=CONFIG){
  const poses=[{kind:'pr',side:0,x:0,z:c.bassFaceZ,yaw:0,w:c.bassChamberWidth+2*c.partition},...bafflePoses(c)].sort((a,b)=>a.x-b.x);
  const segments=poses.map(p=>({...p,a:transformXZ(-p.w/2,0,p),b:transformXZ(p.w/2,0,p)}));
  const edges=[[-c.box.w/2+c.wall,arcZ(c.box.w/2,c)],...segments.flatMap(p=>[p.a,p.b]),[c.box.w/2-c.wall,arcZ(c.box.w/2,c)]];
  const fillers=[];
  for(let i=0;i<edges.length-1;i+=2){const a=edges[i],b=edges[i+1];fillers.push({kind:'filler',a,b,w:Math.hypot(b[0]-a[0],b[1]-a[1]),x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,yaw:-Math.atan2(b[1]-a[1],b[0]-a[0])});}
  return {baffles:segments,fillers};
}
export function chamberFootprint(kind,side=1,c=CONFIG){
  const b=kind==='mid'?c.midBox:c.ambientBox,p=bafflePoses(c).find(p=>p.kind===kind&&p.side===side),t=c.partition;
  return [[-b.w/2-t,0],[b.w/2+t,0],[b.w/2+t,-c.satelliteFront-b.d-t],[-b.w/2-t,-c.satelliteFront-b.d-t]].map(([x,z])=>transformXZ(x,z,p));
}
export function derive(c=CONFIG){
  const ih=c.box.h-2*c.cap,backInner=-c.box.d/2+c.back,frontInner=c.bassFaceZ-c.front,id=frontInner-backInner;
  const braceLiters=c.brace.z.length*(c.bassChamberWidth*ih-(c.bassChamberWidth-2*c.brace.frame)*(ih-2*c.brace.frame))*c.brace.thickness/1e6;
  const grossBass=c.bassChamberWidth*ih*id/1e6,grossMid=c.midBox.w*c.midBox.h*c.midBox.d/1e6,grossAmbient=c.ambientBox.w*c.ambientBox.h*c.ambientBox.d/1e6,s=c.displacement;
  const r=arcRadius(c),a=c.box.w/2;
  const planArea=c.box.w*(c.box.d-r)+a*Math.sqrt(r*r-a*a)+r*r*Math.asin(a/r);
  return {ih,id,backInner,frontInner,braceLiters,grossBass,grossMid,grossAmbient,
    netBass:grossBass-braceLiters-s.sub-s.pr-s.bassWiring,netMid:grossMid-s.mid-s.tweeter-s.midWiring,netAmbient:grossAmbient-s.ambient-s.ambientWiring,
    centerSpacing:c.layout.tweeterY-c.layout.midY,stereoAngle:2*Math.atan(c.midBox.x/(c.listenerDist-c.midBox.z))*180/Math.PI,
    arcRadius:r,planArea,mainAxisCrossing:c.midBox.z+c.midBox.x/Math.tan(deg(c.midBox.yawDeg)),
  };
}
export const DIM=derive();
export function cutList(c=CONFIG){
  const d=derive(c),t=c.partition,rows=[
    {part:'Верх / низ: слои с дугой',qty:4,a:c.box.w,b:c.box.d,t:18,note:`Заготовки; R ${d.arcRadius.toFixed(2)}, стрела ${c.arcSag}`},
    {part:'Задняя стенка: слои',qty:2,a:c.box.w,b:d.ih,t:18,note:'Склеить в 36; отверстие саба и вентиляция боковых отсеков'},
    {part:'Боковины',qty:2,a:d.ih,b:arcZ(c.box.w/2,c)-d.backInner,t:c.wall,note:'Передний торец под дугой'},
    {part:'Перегородки басовой камеры',qty:2,a:d.ih,b:d.id,t,note:'Герметичные стыки'},
    {part:'Центральная панель PR: слои',qty:2,a:c.bassChamberWidth+2*t,b:d.ih,t:18,note:'Склеить в 36'},
    {part:'Распорки баса',qty:c.brace.z.length,a:c.bassChamberWidth,b:d.ih,t:c.brace.thickness,note:`Окно ${c.bassChamberWidth-2*c.brace.frame} × ${d.ih-2*c.brace.frame}`},
  ];
  for(const [name,b] of [['L/R',c.midBox],['Наружные',c.ambientBox]])rows.push(
    {part:`${name}: лицевая панель`,qty:2,a:b.panelW,b:d.ih,t:c.satelliteFront,note:'Локальные размеры наклонной панели'},
    {part:`${name}: боковины камер`,qty:4,a:b.h+2*t,b:b.d+t,t,note:'Размеры в системе своей панели'},
    {part:`${name}: верх / низ камер`,qty:4,a:b.w,b:b.d+t,t,note:'Между боковинами'},
    {part:`${name}: задние стенки камер`,qty:2,a:b.w,b:b.h,t,note:'Между боковинами и крышками'},
  );
  frontSegments(c).fillers.filter(p=>p.x>0).forEach((p,i)=>rows.push({part:`Соединительные щёки ${i+1}, зеркальная пара`,qty:2,a:p.w,b:d.ih,t:18,note:'Лицевая длина; припуск на сопряжение и скосы по месту'}));
  return rows;
}
export const CHANNELS=[
  {out:1,input:'L',driver:'SB15 · L',amp:'V3 №1 · L',band:'130–2300 Гц',delay:'По измерению',level:'По измерению'},
  {out:2,input:'R',driver:'SB15 · R',amp:'V3 №1 · R',band:'130–2300 Гц',delay:'По измерению',level:'По измерению'},
  {out:3,input:'L',driver:'SB26 · L',amp:'V3 №2 · L',band:'От 2300 Гц',delay:'По измерению',level:'По измерению'},
  {out:4,input:'R',driver:'SB26 · R',amp:'V3 №2 · R',band:'От 2300 Гц',delay:'По измерению',level:'По измерению'},
  {out:5,input:'L',driver:'10F · наружный L',amp:'V3 №3 · L',band:'300–8000 Гц',delay:'+4 мс, проба',level:'−12 дБ, проба'},
  {out:6,input:'R',driver:'10F · наружный R',amp:'V3 №3 · R',band:'300–8000 Гц',delay:'+4 мс, проба',level:'−12 дБ, проба'},
  {out:7,input:'0,5 L + 0,5 R',driver:'RSS265 · саб',amp:'V3 Mono',band:'22–130 Гц',delay:'По измерению',level:'По измерению'},
  {out:8,input:'—',driver:'Резерв',amp:'—',band:'Mute',delay:'—',level:'—'},
];
