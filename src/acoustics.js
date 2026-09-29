import { CONFIG, DIM, DRV, PR_PROFILES } from './config.js';
export const AIR = { rho:1.18, c:343 };
export function sealed(driver, liters) {
  const ratio=Math.sqrt(1+driver.vas/liters), fc=driver.fs*ratio, qtc=driver.qts*ratio;
  const a=1/qtc**2-2;
  return {fc,qtc,f3:fc*Math.sqrt((a+Math.sqrt(a*a+4))/2)};
}
export function tunePR(liters=DIM.netBass,hz=CONFIG.tuningHz,profile=PR_PROFILES.reference) {
  const cms=profile.cms/1000, sd=DRV.pr.sd/10000;
  const stiffness=1/cms+AIR.rho*AIR.c**2*sd**2/(liters/1000);
  const totalGrams=stiffness/(2*Math.PI*hz)**2*1000;
  return {totalGrams,addedGrams:totalGrams-profile.mms,
    sagMm:totalGrams/1000*9.80665*cms*1000,
    freeHz:1/(2*Math.PI*Math.sqrt(totalGrams/1000*cms)),
    rms:profile.rms??(2*Math.PI*profile.fs*(profile.mms/1000)/profile.qms)};
}
// Coupled driver / PR / compliant, leaky air volume. Complex e^(jwt) notation.
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
const scale=(a,k)=>[a[0]*k,a[1]*k];
const div=(a,b)=>scale(mul(a,[b[0],-b[1]]),1/(b[0]**2+b[1]**2));
const abs=a=>Math.hypot(...a);
// Analog peaking EQ magnitude; the DSP implementation must be measured later.
export function peakingGain(f,{frequency,gainDb,q}) {
  const r=f/frequency,A=10**(gainDb/40);
  return Math.hypot(1-r*r,A*r/q)/Math.hypot(1-r*r,r/(A*q));
}
export function bassAt(f,{liters=DIM.netBass,hz=CONFIG.tuningHz,volts=CONFIG.defaultVolts,profile=PR_PROFILES.reference,protection=true,eq=false,ql=10}={}) {
  const w=2*Math.PI*f, s=DRV.sub, pr=tunePR(liters,hz,profile);
  const sd=s.sd/10000, sp=DRV.pr.sd/10000, cab=liters/1000/(AIR.rho*AIR.c**2);
  const rLeak=ql/(2*Math.PI*hz*cab), zBox=div([1,0],[1/rLeak,w*cab]);
  const ze=[s.re,w*s.le/1000];
  const zm=[2*Math.PI*s.fs*s.mms/1000/s.qms,w*s.mms/1000-1/(w*s.cms/1000)];
  const zp=[pr.rms,w*pr.totalGrams/1000-1/(w*profile.cms/1000)];
  const a=add(add(zm,div([s.bl**2,0],ze)),scale(zBox,sd**2));
  const b=scale(zBox,sd*sp), d=add(zp,scale(zBox,sp**2));
  // LR4 HP: two cascaded Butterworth sections, each Q=1/sqrt(2).
  const hp=protection ? 1/(1+(CONFIG.subsonicHz/f)**4) : 1;
  const gain=eq?peakingGain(f,CONFIG.bassEq):1;
  const force=div([s.bl*volts*hp*gain,0],ze), det=sub(mul(a,d),mul(b,b));
  const vs=div(mul(force,d),det), vp=scale(div(mul(force,b),det),-1);
  const u=add(scale(vs,sd),scale(vp,sp));
  const pressure=AIR.rho*w*abs(u)/(2*Math.PI); // coherent 2π at 1 m
  return {f,spl:20*Math.log10(Math.max(pressure,1e-12)/20e-6),
    subMm:Math.SQRT2*abs(vs)/w*1000,prMm:Math.SQRT2*abs(vp)/w*1000};
}
export function bassSweep(options={}) {
  return Array.from({length:321},(_,i)=>bassAt(10*20**(i/320),options));
}
export function bassSummary(options={}) {
  const curve=bassSweep(options), reference=bassAt(100,options).spl;
  let f3=null;
  for(let i=1;i<curve.length;i++) if(curve[i-1].spl<reference-3 && curve[i].spl>=reference-3) {
    const t=(reference-3-curve[i-1].spl)/(curve[i].spl-curve[i-1].spl);
    f3=curve[i-1].f*(curve[i].f/curve[i-1].f)**t; break;
  }
  const maxSub=Math.max(...curve.map(p=>p.subMm)), maxPR=Math.max(...curve.map(p=>p.prMm));
  return {f3,maxSub,maxPR,reference,curve,
    excursionVolts:(options.volts??CONFIG.defaultVolts)*Math.min(DRV.sub.xmax/maxSub,DRV.pr.xmax/maxPR)};
}
