/* VICE Capital Inc. — browser adaptation of supplied VICESYSTEM SOLACE v10.6.
 * MPL-2.0, as declared by the supplied System source. No orders are submitted.
 * Every snapshot uses closed standard OHLC bars only. Native-platform parity
 * still requires comparison against the same TradingView feed and bar history.
 */
(function(root){
 'use strict';
 const defaults=Object.freeze({mode:'Auto',modeLookback:true,structuralLookback:1000,lbScalp:250,lbIntraday:500,lbSwing:2000,
  holdLevels:false,wickProof:true,accCloses:2,accATR:.5,breakCloses:1,whipsaw:true,countTests:true,dtPullATR:1,dtMinBars:5,
  exhOn:true,exhSrc:'Stochastic',oscMirror:true,exhLen:14,oscIntLen:14,exhSmooth:1,exhUpper:95,exhLower:5,intUpper:90,intLower:10,
  exhWindow:3,zoneArmMacro:true,fracDimCloses:1,fracBrightCloses:2,engulfCounts:true,flipConfirmBars:2,useVolFilter:false,volMult:1.5,
  intArmMode:'Zone exit or retest held',intPlace:true,sweepRequireClose:true,mtfEnabled:true,chochDetect:true,macroNeckPct:5,chochNeckPct:5,
  intNeckBase:'Internal',stopATR:.5,minRR:10,autoBuffer:true,hideThinRR:true,extendBars:40,tfSeconds:3600,originExpiryBars:60});
 const numeric=(v,d,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
 function options(input={}){
  const o={...defaults,...input};
  for(const k of ['structuralLookback','lbScalp','lbIntraday','lbSwing'])o[k]=Math.round(numeric(o[k],defaults[k],50,5000));
  for(const k of ['accCloses','breakCloses','fracDimCloses','fracBrightCloses','flipConfirmBars'])o[k]=Math.round(numeric(o[k],defaults[k],1,10));
  o.exhSmooth=Math.round(numeric(o.exhSmooth,1,1,50));o.dtMinBars=Math.round(numeric(o.dtMinBars,5,1,500));o.originExpiryBars=Math.round(numeric(o.originExpiryBars,60,3,500));
  o.accATR=numeric(o.accATR,.5,0,5);o.stopATR=numeric(o.stopATR,.5,.1,20);o.minRR=numeric(o.minRR,10,1,100);
  o.exhLen=Math.round(numeric(o.exhLen,14,2,5000));o.oscIntLen=Math.round(numeric(o.oscIntLen,14,2,5000));
  o.lookback=o.modeLookback?({Scalp:o.lbScalp,Intraday:o.lbIntraday,Swing:o.lbSwing}[o.mode]||o.structuralLookback):o.structuralLookback;
  const m=o.tfSeconds/60;o.touchTol={Scalp:.25,Intraday:.20,Swing:.15}[o.mode]??(m<=1?.25:m<=5?.22:m<=15?.20:m<=60?.18:m<=240?.15:.12);
  return o;
 }
 class Extreme {
  constructor(high){this.high=high;this.q=[];this.head=0;}
  add(i,v,origin,length){const q=this.q;while(q.length>this.head&&(this.high?q[q.length-1].v<=v:q[q.length-1].v>=v))q.pop();q.push({i,v,origin});while(q[this.head]?.i<=i-length)this.head++;if(this.head>2048){this.q=q.slice(this.head);this.head=0;}return this.q[this.head];}
 }
 class Accepted {
  constructor(high){this.high=high;this.pending=0;this.extreme=null;this.queue=new Extreme(high);}
  step(b,i,ref,origin,a,length,o){let v=this.high?b.h:b.l,at=i,accepted=false;
   if(o.wickProof&&ref!=null){
    if(this.high?b.c>ref:b.c<ref){this.pending++;if(!this.extreme||(this.high?v>this.extreme.v:v<this.extreme.v))this.extreme={v,at:i};
     if(this.pending>=o.accCloses||(o.accATR>0&&a>0&&(this.high?b.c>=ref+o.accATR*a:b.c<=ref-o.accATR*a))){accepted=true;v=this.extreme.v;at=this.extreme.at;this.pending=0;this.extreme=null;}
     else{v=ref;at=origin;}
    }else{this.pending=0;this.extreme=null;if(this.high?v>=ref:v<=ref){v=ref;at=origin;}}
   }
   return {...this.queue.add(i,v,at,length),accepted,pending:this.pending};
  }
 }
 const mean=(xs,count)=>{const a=xs.filter(Number.isFinite).slice(-count);return a.length===count?a.reduce((s,v)=>s+v,0)/count:null;};
 function engulf(bars,i,high){const b=bars[i],p=bars[i-1];return !!p&&(high?b.c<b.o&&p.c>p.o&&b.o>=p.c&&b.c<=p.o:b.c>b.o&&p.c<p.o&&b.o<=p.c&&b.c>=p.o);}
 function rejection(bars,i,level,high,origin,a,o,vol){
  if(a>0)for(let q=0;q<=Math.min(400,i);q++){const b=bars[i-q];if(!(high?b.h>=level-o.touchTol*a:b.l<=level+o.touchTol*a))continue;
   let start=q;while(start>=0&&!(high?bars[i-start].c<level:bars[i-start].c>level))start--;
   let closes=0;for(let k=start;k>=0;k--){if(high?bars[i-k].c<level:bars[i-k].c>level)closes++;else break;}
   if(closes>=o.flipConfirmBars&&(!o.useVolFilter||b.v>(vol[i-q]??Infinity)*o.volMult))return q;
  }
  return Math.max(0,Math.min(4999,i,i-origin));
 }
 function fractal(bars,i,level,high,back,o){let closes=0,eng=false;for(let q=Math.min(back,4998,i);q>=1;q--){if(high?bars[i-q].c<level:bars[i-q].c>level)closes++;if(o.engulfCounts&&engulf(bars,i-q,high))eng=true;if(closes>=o.fracBrightCloses||eng)return 2;}return closes>=o.fracDimCloses?1:0;}
 function retest(s,b,i,level,origin,high,a,o){let held=false;const tol=o.touchTol*a;
  if(o.countTests&&a>0&&s.level===level&&s.away&&i-s.at>=o.dtMinBars&&(high?b.h>=level-tol&&b.c<level:b.l<=level+tol&&b.c>level)){s.count++;s.at=i;s.away=false;held=s.count>=2;}
  if(s.level!==level){s.level=level;s.count=1;s.at=origin;s.away=false;}
  if(a>0&&(high?b.l<=level-o.dtPullATR*a:b.h>=level+o.dtPullATR*a))s.away=true;
  return held;
 }
 function oscillator(bars,i,len,lo,hi,o,values,cciValues){let raw=null;
  if(o.exhSrc==='CCI'){
   if(i+1>=len){const ps=bars.slice(i-len+1,i+1).map(b=>(b.h+b.l+b.c)/3),avg=ps.reduce((s,v)=>s+v,0)/len,dev=ps.reduce((s,v)=>s+Math.abs(v-avg),0)/len;
    const cci=dev>0?(ps[len-1]-avg)/(.015*dev):null;cciValues.push(cci);const hist=cciValues.slice(-len).filter(Number.isFinite);const max=Math.max(...hist),min=Math.min(...hist);if(cci!=null&&max>min)raw=100*(cci-min)/(max-min);
   }else cciValues.push(null);
  }else if(!o.oscMirror){let h=-Infinity,l=Infinity;for(let j=Math.max(0,i-len+1);j<=i;j++){h=Math.max(h,bars[j].h);l=Math.min(l,bars[j].l);}if(h>l)raw=100*(bars[i].c-l)/(h-l);}
  else if(hi>lo)raw=100*(bars[i].c-lo)/(hi-lo);
  values.push(raw);return mean(values.slice(-o.exhSmooth*2),o.exhSmooth);
 }
 function gapAt(bars,i,s,a,o){if(!(a>0))return null;const minutes=o.tfSeconds/60,scan=minutes<=3?120:minutes<=15?72:minutes<=60?48:24,minATR=minutes<=3?.10:minutes<=15?.13:minutes<=60?.18:.26;
  const bull=!s.sellArmed,p=s.pivot,target=s.sellArmed?s.last.F0:s.last.F100;
  for(let q=3;q<=Math.min(scan,i,i-p.origin);q++){const b1=bars[i-q],b3=bars[i-q+2];let top,bottom;
   if(bull&&b1.h<b3.l-minATR*a){top=b3.l;bottom=b1.h;}else if(!bull&&b1.l>b3.h+minATR*a){top=b1.l;bottom=b3.h;}else continue;
   let filled=false;const offsets=q===3?[0,1]:Array.from({length:q-3},(_,k)=>q-3-k);for(const k of offsets){if(bull?bars[i-k].l<=bottom:bars[i-k].h>=top){filled=true;break;}}
   if(filled)continue;const tol=.5*a;
   if(bull?(bottom>p.level+tol||bottom<Math.min(target,p.level)-tol||top>p.level+tol):(top<p.level-tol||top>Math.max(target,p.level)+tol||bottom<p.level-tol))continue;
   return {top,bottom,from:i-q,bull};
  }return null;
 }
 // Confirmed-close, wick-origin authority. The pivot/CHOCH engine below remains intact.
 // Origin side may change ONLY after an independently qualified opposite pole
 // touch, explicit structural invalidation or expiry; candle position is not a side.
 function originStep(prior,bar,prev,index,poles,atr,o){
  const events=[],touchTol=Number.isFinite(atr)&&atr>0?o.touchTol*atr:0;
  let origin=prior.origin,serial=prior.serial||0;
  const floor=Number.isFinite(poles.lo)?poles.lo:null;
  const roof=Number.isFinite(poles.hi)?poles.hi:null;
  const fPrev=Number.isFinite(poles.loPrev)?poles.loPrev:null;
  const rPrev=Number.isFinite(poles.hiPrev)?poles.hiPrev:null;
  const valid=floor!=null&&roof!=null&&roof>floor&&atr>0;
  if(!valid)return {origin:null,serial,events};
  // Touch is exact, not merely proximity to a broad zone.
  const fTouch=(fPrev!=null&&bar.l<=fPrev)||(floor!=null&&bar.l<=floor);
  const rTouch=(rPrev!=null&&bar.h>=rPrev)||(roof!=null&&bar.h>=roof);
  const age=origin?index-origin.bar:0;
  if(origin&&(age>o.originExpiryBars||(origin.side==='LONG'?
     bar.c<origin.level-o.accATR*atr:bar.c>origin.level+o.accATR*atr))){
    events.push({i:index,type:'MACRO_ORIGIN_INVALIDATED',side:origin.side,price:origin.level,serial:origin.serial});
    origin=null;
  }
  // Intrabar ordering is unknowable on a double-touch candle. Do not invent it.
  const unambiguous=fTouch!==rTouch;
  const side=fTouch?'LONG':'SHORT';
  if(unambiguous&&(!origin||origin.side!==side)){
    serial++;
    origin={side,pole:side==='LONG'?'F0':'F100',targetPole:side==='LONG'?'F100':'F0',
      level:side==='LONG'?floor:roof,wick:side==='LONG'?bar.l:bar.h,
      target:side==='LONG'?roof:floor,stop:side==='LONG'?bar.l-o.stopATR*atr:bar.h+o.stopATR*atr,bar:index,time:bar.t,
      structuralVersion:serial,serial,stage:'TOUCHED',armedAt:null,confirmedAt:null,
      expiresAt:index+o.originExpiryBars,entryEligible:false,rr:null};
    events.push({i:index,type:'MACRO_ORIGIN_TOUCHED',side,price:origin.level,serial});
  }
  if(origin&&origin.stage==='TOUCHED'){
    // The first 2-3 completed candles can ARM; no forward-looking right bars.
    // Stochastic 99/1 and 2/3 LWMA remain downstream confirmation tools.
    const offset=index-origin.bar;
    const favorable=origin.side==='LONG'?bar.c>origin.level:bar.c<origin.level;
    const directional=origin.side==='LONG'?
      bar.c>bar.o&&(!prev||bar.c>=prev.c):
      bar.c<bar.o&&(!prev||bar.c<=prev.c);
    const lowerWick=Math.min(bar.o,bar.c)-bar.l,upperWick=bar.h-Math.max(bar.o,bar.c);
    const wickReject=origin.side==='LONG'?lowerWick>=Math.max(atr*.15,Math.abs(bar.c-bar.o)*.5):upperWick>=Math.max(atr*.15,Math.abs(bar.c-bar.o)*.5);
    if(offset<=3&&favorable&&(directional||wickReject&&(!prev||(origin.side==='LONG'?bar.c>=prev.c:bar.c<=prev.c)))){
      origin={...origin,stage:'ARMED',armedAt:index};
      events.push({i:index,type:'MACRO_ORIGIN_ARMED',side:origin.side,price:origin.level,serial:origin.serial});
    }
  }
  if(origin){
    const stop=origin.stop; // immutable risk geometry; changing ATR never rewrites the originating stop
    const entry=origin.level, target=origin.target;
    const risk=origin.side==='LONG'?entry-stop:stop-entry;
    const reward=origin.side==='LONG'?target-entry:entry-target;
    const rr=risk>0&&reward>0?reward/risk:0;
    const inZone=origin.side==='LONG'?bar.l<=entry+touchTol&&bar.c>=origin.level:
      bar.h>=entry-touchTol&&bar.c<=origin.level;
    // ARM is information, not an entry or broker order.
    origin={...origin,stop,entry,target,rr,entryEligible:origin.stage==='ARMED'&&inZone&&rr>=o.minRR};
  }
  return {origin,serial,events};
 }
 function run(input,config={},ltf=[]){
  const o=options(config),now=config.now??Date.now(),duration=o.tfSeconds*1000;
  const closes=b=>config.timeframe==='1mo'?Date.UTC(new Date(b.t).getUTCFullYear(),new Date(b.t).getUTCMonth()+1,1):b.t+duration;
  const bars=input.filter(b=>b.closed!==false&&(b.closed===true||!Number.isFinite(b.t)||closes(b)<=now));
  if(bars.some((b,i)=>![b.o,b.h,b.l,b.c].every(Number.isFinite)||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c)||i&&b.t<=bars[i-1].t))throw Error('SOLACE requires ordered valid standard OHLC candles');
  const A=[],vol=[],trs=[],hiSide=new Accepted(true),loSide=new Accepted(false),rHi=new Extreme(true),rLo=new Extreme(false),snapshots=[],events=[],fractals=[],f0=[],f100=[],f0History=[],f100History=[],fractalKeys=new Set();
  let hi=null,lo=null,hOrigin=0,lOrigin=0,hiBrk=0,loBrk=0,hFrom=0,lFrom=0,prevOsc=null,prevInt=null,zTop=null,zBot=null,hTouch=-Infinity,lTouch=-Infinity,hExh=-Infinity,lExh=-Infinity,zoneArm=0,hiSweep=-Infinity,loSweep=-Infinity;
  let pivot=null,visitLo=null,visitHi=null,armSeq=0,ichDone=-1,mch={given:false,sell:false,level:null};
  let macroOriginState={origin:null,serial:0};
  const ht={},lt={},it={},macroValues=[],intValues=[],cciM=[],cciI=[],vols=[],ltfHi=new Extreme(true),ltfLo=new Extreme(false);let ltfIndex=0,lh=null,ll=null;
  for(let i=0;i<bars.length;i++){
   const b=bars[i],previous=bars[i-1],hiPrev=hi,loPrev=lo;const tr=previous?Math.max(b.h-b.l,Math.abs(b.h-previous.c),Math.abs(b.l-previous.c)):b.h-b.l;trs.push(tr);
   const a=i<13?null:i===13?trs.reduce((s,x)=>s+x,0)/14:(A[i-1]*13+tr)/14;A.push(a);vols.push(b.v);vol.push(mean(vols.slice(-20),20));
   const n=Math.min(o.lookback,Math.max(1,i)),H=hiSide.step(b,i,hi,hOrigin,a,n,o),L=loSide.step(b,i,lo,lOrigin,a,n,o);
   hiBrk=hi!=null&&b.c>hi?hiBrk+1:0;loBrk=lo!=null&&b.c<lo?loBrk+1:0;
   const hiBroken=hi!=null&&(o.wickProof?H.accepted:hiBrk>=o.breakCloses),loBroken=lo!=null&&(o.wickProof?L.accepted:loBrk>=o.breakCloses);
   if(hiBroken){events.push({i,type:'BROKEN',side:'F100',price:hi});hi=null;hiBrk=0;}
   if(loBroken){events.push({i,type:'BROKEN',side:'F0',price:lo});lo=null;loBrk=0;}
   if(!o.wickProof&&o.whipsaw){if(hi!=null&&b.h>hi&&b.c<hi)hi=b.h;if(lo!=null&&b.l<lo&&b.c>lo)lo=b.l;}
   if(!o.holdLevels||hi==null||H.v>hi){hi=H.v;hOrigin=H.origin;}
   if(!o.holdLevels||lo==null||L.v<lo){lo=L.v;lOrigin=L.origin;}
   if(hi!==hiPrev){if(hiPrev!=null)f100History.push({price:hiPrev,from:hFrom,to:i});hFrom=i;}
   if(lo!==loPrev){if(loPrev!=null)f0History.push({price:loPrev,from:lFrom,to:i});lFrom=i;}
   const hRetest=retest(ht,b,i,hiPrev,hOrigin,true,a,o),lRetest=retest(lt,b,i,loPrev,lOrigin,false,a,o);
   if(ht.level!==hi){ht.level=hi;ht.count=1;ht.at=hOrigin;ht.away=a>0&&b.l<=hi-o.dtPullATR*a;}
   if(lt.level!==lo){lt.level=lo;lt.count=1;lt.at=lOrigin;lt.away=a>0&&b.h>=lo+o.dtPullATR*a;}
   const osc=oscillator(bars,i,o.oscMirror?o.lookback:o.exhLen,lo,hi,o,macroValues,cciM),tol=a>0?o.touchTol*a:0;
   if(hiPrev!=null&&a>0&&(b.h>=hiPrev-tol||(zTop!=null&&b.h>=zTop)))hTouch=i;
   if(loPrev!=null&&a>0&&(b.l<=loPrev+tol||(zBot!=null&&b.l<=zBot)))lTouch=i;
   const exhShort=o.exhOn&&osc!=null&&prevOsc!=null&&prevOsc>=o.exhUpper&&osc<o.exhUpper&&hiPrev!=null&&b.c<hiPrev&&i-hTouch<=o.exhWindow&&i-hExh>o.exhWindow;
   const exhLong=o.exhOn&&osc!=null&&prevOsc!=null&&prevOsc<=o.exhLower&&osc>o.exhLower&&loPrev!=null&&b.c>loPrev&&i-lTouch<=o.exhWindow&&i-lExh>o.exhWindow;
   if(hiBroken&&zoneArm===1||loBroken&&zoneArm===-1)zoneArm=0;
   if(exhShort){hExh=i;zoneArm=1;}if(exhLong){lExh=i;zoneArm=-1;}
   zTop=lo+(hi-lo)*o.exhUpper/100;zBot=lo+(hi-lo)*o.exhLower/100;
   const hBack=rejection(bars,i,hi,true,hOrigin,a,o,vol),lBack=rejection(bars,i,lo,false,lOrigin,a,o,vol),hf=fractal(bars,i,hi,true,hBack,o),lf=fractal(bars,i,lo,false,lBack,o);
   let sell=hBack<=lBack;if(hf>=2&&lf<2)sell=true;if(lf>=2&&hf<2)sell=false;if(o.zoneArmMacro&&zoneArm)sell=zoneArm===1;
   macroOriginState=originStep(macroOriginState,b,previous,i,{loPrev,hiPrev,lo,hi},a,o);
   events.push(...macroOriginState.events);
   // Confirmed originating structural pole outranks later displacement/fractals.
   // It cannot be relabeled TOP on a bullish advance without an F100 touch.
   if(macroOriginState.origin)sell=macroOriginState.origin.side==='SHORT';
   const rollH=rHi.add(i,b.h,i,Math.min(100,Math.max(1,i))),rollL=rLo.add(i,b.l,i,Math.min(100,Math.max(1,i)));
   const oldPivot=pivot?{...pivot}:null,irLo=o.wickProof&&pivot?.type===-1?pivot.level:rollL.v,irHi=o.wickProof&&pivot?.type===1?pivot.level:rollH.v;
   const io=oscillator(bars,i,o.oscMirror?100:o.oscIntLen,irLo,irHi,o,intValues,cciI),inLo=io!=null&&io<=o.intLower,inHi=io!=null&&io>=o.intUpper,wasLo=prevInt!=null&&prevInt<=o.intLower,wasHi=prevInt!=null&&prevInt>=o.intUpper,upX=io!=null&&wasLo&&io>o.intLower,dnX=io!=null&&wasHi&&io<o.intUpper;
   if(inLo&&!wasLo||((inLo||upX)&&(!visitLo||b.l<visitLo.v)))visitLo={v:b.l,at:i};
   if(inHi&&!wasHi||((inHi||dnX)&&(!visitHi||b.h>visitHi.v)))visitHi={v:b.h,at:i};
   let disarm=false;
   if(!o.wickProof&&pivot){const beyond=pivot.type===-1?b.c<pivot.level:b.c>pivot.level;if(beyond&&pivot.armed){disarm=true;pivot.armed=false;pivot.touched=true;pivot.closes=0;}if(a>0&&(pivot.type===-1?b.c<pivot.level-2*a:b.c>pivot.level+2*a))pivot=null;}
   if(sell&&pivot?.type===1||!sell&&pivot?.type===-1)pivot=null;
   if(!pivot){const r=sell?rollL:rollH;pivot={type:sell?-1:1,level:r.v,origin:r.origin,from:i,armed:false,touched:r.origin===i,closes:0,pending:0,excursion:null,touch:-Infinity,armedAt:null};}
   if(!o.wickProof&&!pivot.armed){const r=pivot.type===-1?rollL:rollH;if(pivot.type===-1?r.v<pivot.level-tol:r.v>pivot.level+tol){pivot.level=r.v;pivot.origin=r.origin;pivot.from=i;pivot.touched=r.origin===i;pivot.closes=0;}}
   const p=pivot,high=p.type===1;
   if(o.wickProof){const beyond=high?b.c>p.level:b.c<p.level;
    if(beyond){p.pending++;const x=high?b.h:b.l;if(!p.excursion||(high?x>p.excursion.v:x<p.excursion.v))p.excursion={v:x,at:i};disarm=p.armed;p.armed=false;p.touched=true;p.closes=0;
     if(p.pending>=o.accCloses||(o.accATR>0&&a>0&&(high?b.c>=p.level+o.accATR*a:b.c<=p.level-o.accATR*a))){p.level=p.excursion.v;p.origin=p.excursion.at;p.from=i;p.touched=p.origin===i;p.pending=0;p.excursion=null;}
    }else{p.pending=0;p.excursion=null;}
   }
   if(it.type!==p.type){Object.assign(it,{level:null,type:p.type,away:false});}
   const iRetest=retest(it,b,i,p.level,p.origin,high,a,o),izLo=irLo+(irHi-irLo)*o.intLower/100,izHi=irLo+(irHi-irLo)*o.intUpper/100;
   if(high?(b.h>=p.level-tol||b.h>=izHi):(b.l<=p.level+tol||b.l<=izLo))p.touch=i;
   const byTouch=['Touch + closes (FIX 8)','Any of them'].includes(o.intArmMode),byZone=['Zone exit or retest held','Zone exit (oscillator)','Any of them'].includes(o.intArmMode),byRetest=['Zone exit or retest held','Retest held (double bottom / top)','Any of them'].includes(o.intArmMode);
   let armedNow=false,zoneNow=false;
   if(!p.armed){if(i>p.origin&&(high?b.h>=p.level-tol:b.l<=p.level+tol))p.touched=true;if(byZone&&(high?inHi:inLo))p.touched=true;
    const inside=high?b.c<p.level:b.c>p.level;
    if(p.touched&&byTouch){p.closes=inside?p.closes+1:0;if(p.closes>=o.flipConfirmBars||(inside&&o.engulfCounts&&engulf(bars,i,high)))p.armed=true;}
    if(byRetest&&!p.armed&&iRetest)p.armed=true;
    if(byZone&&!p.armed&&(high?dnX:upX)&&i-p.touch<=o.exhWindow&&inside){p.armed=true;p.touched=true;zoneNow=true;const visit=high?visitHi:visitLo;if(o.intPlace&&visit&&(!o.wickProof||(high?visit.v<p.level:visit.v>p.level))){p.level=visit.v;p.origin=visit.at;p.from=i;}}
    armedNow=p.armed;if(armedNow){armSeq++;p.armedAt=i;}
   }
   if(it.level!==p.level){it.level=p.level;it.count=1;it.at=p.origin;it.away=false;}if(a>0&&(high?b.l<=p.level-o.dtPullATR*a:b.h>=p.level+o.dtPullATR*a))it.away=true;
   const cutoff=closes(b);while(ltfIndex<ltf.length&&ltf[ltfIndex].t+(config.ltfSeconds||60)*1000<=cutoff){const l=ltf[ltfIndex];if(l.closed!==false){lh=ltfHi.add(ltfIndex,l.h,ltfIndex,o.lookback);ll=ltfLo.add(ltfIndex,l.l,ltfIndex,o.lookback);}ltfIndex++;}
   p.confluence=!!(o.mtfEnabled&&a>0&&lh&&ll&&Math.abs(p.level-(high?lh.v:ll.v))<=.25*a);p.tests=it.count;
   const sweepLow=a>0&&oldPivot?.type===1&&i-oldPivot.origin<=500&&oldPivot.level>loPrev&&b.l<loPrev-tol*.05&&(!o.sweepRequireClose||b.c>loPrev)&&b.c>=loPrev-tol;
   const sweepHigh=a>0&&oldPivot?.type===-1&&i-oldPivot.origin<=500&&oldPivot.level<hiPrev&&b.h>hiPrev+tol*.05&&(!o.sweepRequireClose||b.c<hiPrev)&&b.c<=hiPrev+tol;
   const confirmedHigh=o.exhOn&&(sweepHigh&&i-hExh<=o.exhWindow||exhShort&&i-hiSweep<=o.exhWindow),confirmedLow=o.exhOn&&(sweepLow&&i-lExh<=o.exhWindow||exhLong&&i-loSweep<=o.exhWindow);
   if(sweepHigh)hiSweep=i;if(sweepLow)loSweep=i;
   const range=Math.max(1e-9,hi-lo),irange=o.wickProof?(high?p.level-rollL.v:rollH.v-p.level):rollH.v-rollL.v;
   const neck=p.level+(high?-1:1)*Math.max(1e-9,o.intNeckBase==='Macro'?range:irange)*o.chochNeckPct/100,macroNeck=sell?hi-range*o.macroNeckPct/100:lo+range*o.macroNeckPct/100;
   const prevNeck=hiPrev!=null&&loPrev!=null?(sell?hiPrev-(hiPrev-loPrev)*o.macroNeckPct/100:loPrev+(hiPrev-loPrev)*o.macroNeckPct/100):null;
   const macroCh=o.chochDetect&&previous&&prevNeck!=null&&(sell?b.c<prevNeck&&previous.c>=prevNeck:b.c>prevNeck&&previous.c<=prevNeck)&&(!mch.given||mch.sell!==sell||mch.level!==(sell?hiPrev:loPrev));
   if(macroCh)mch={given:true,sell,level:sell?hiPrev:loPrev};
   const intCh=o.chochDetect&&p.armed&&(high?b.c<neck:b.c>neck)&&ichDone!==armSeq;if(intCh)ichDone=armSeq;
   const stopDist=a==null?null:o.stopATR*a,buffer=stopDist!=null?(o.autoBuffer?(range-o.minRR*stopDist)/(range*(1+o.minRR)):.10):null;
   function plan(side,entry,stop,target,from){const risk=Math.abs(entry-stop),rr=risk>0?Math.abs(target-entry)/risk:0;return {side,entry,stop,target,rr,qualified:rr>=o.minRR-.05,from};}
   let macro=buffer>0?plan(sell?'SELL':'BUY',(sell?hi:lo)+(sell?-1:1)*range*buffer,(sell?hi:lo)+(sell?1:-1)*stopDist,sell?lo:hi,sell?hFrom:lFrom):null;
   let inside=p.armed&&stopDist!=null?plan(high?'SELL':'BUY',p.level,p.level+(high?1:-1)*stopDist,high?lo:hi,Math.max(p.from,p.armedAt)):null;
   if(o.hideThinRR){if(!macro?.qualified)macro=null;if(!inside?.qualified)inside=null;}
   const add=(condition,type,side,price)=>{if(condition)events.push({i,type,side,price});};
   add(hRetest,'RETEST','F100',hi);add(lRetest,'RETEST','F0',lo);add(iRetest,'INTERNAL_RETEST',high?'HIGH':'LOW',p.level);add(armedNow,'INTERNAL_ARMED',high?'HIGH':'LOW',p.level);add(disarm,'INTERNAL_DISARMED',oldPivot?.type===1?'HIGH':'LOW',oldPivot?.level);add(exhShort,'EXHAUSTION','F100',hi);add(exhLong,'EXHAUSTION','F0',lo);add(confirmedHigh,'CONFIRMED_SWEEP','F100',hi);add(confirmedLow,'CONFIRMED_SWEEP','F0',lo);add(intCh,'INTERNAL_CHOCH',high?'BEAR':'BULL',neck);add(macroCh,'MACRO_CHOCH',sell?'BEAR':'BULL',macroNeck);
   const currentFractals=[];if(hf)currentFractals.push({bar:hOrigin,confirmedAt:i,side:'HIGH',price:hi,confirmed:hf===2});if(lf)currentFractals.push({bar:lOrigin,confirmedAt:i,side:'LOW',price:lo,confirmed:lf===2});
   for(const f of currentFractals){const key=f.bar+':'+f.side+':'+f.price;if(f.confirmed&&!fractalKeys.has(key)){fractals.push({...f});fractalKeys.add(key);}}
   const snapshot={index:i,time:b.t,params:o,atrValue:a,sellArmed:sell,macroOrigin:macroOriginState.origin?{...macroOriginState.origin}:null,osc,internalOsc:io,zone:{top:zTop,bottom:zBot},pivot:{...p},
    last:{F0:lo,F100:hi,b0:lOrigin,b100:hOrigin,f0From:lFrom,f100From:hFrom,src0:'system',src100:'system',zTol:tol,close:b.c,atHigh:b.h>=hi-tol,atLow:b.l<=lo+tol,position:hi>lo?100*(b.c-lo)/(hi-lo):null,hiTests:ht.count,loTests:lt.count,hiPending:H.pending,loPending:L.pending},
    internal:{hi:high?p.level:null,lo:high?null:p.level,hiBar:high?p.origin:-1,loBar:high?-1:p.origin,from:p.from},internalArmed:{hi:high&&p.armed,lo:!high&&p.armed},
    choch:{dir:p.armed?(high?-1:1):0,level:p.armed?neck:null,bar:p.armed?Math.max(p.from,p.armedAt):-1,confirmed:p.armed&&ichDone===armSeq},macroChoch:{dir:sell?-1:1,level:macroNeck,bar:sell?hFrom:lFrom,confirmed:mch.given&&mch.sell===sell&&mch.level===(sell?hi:lo)},trade:{macro,internal:inside},fractals:currentFractals};
   snapshots.push(snapshot);f0.push(lo);f100.push(hi);prevOsc=osc;prevInt=io;
  }
  if(bars.length){f0History.push({price:lo,from:lFrom,to:bars.length,open:true});f100History.push({price:hi,from:hFrom,to:bars.length,open:true});}
  const result={version:'10.6',params:o,snapshots,f0,f100,atr:A,f0History,f100History,events,allFractals:fractals,pivots:[],markers:[],last:null,internal:{},trade:{},choch:{dir:0}};
  Object.assign(result,snapshots.at(-1)||{});if(result.last)result.gap=gapAt(bars,bars.length-1,result,A.at(-1),o);
  result.closedBars=bars;result.sourceBars=input.length;return result;
 }
 function at(result,end){const s=result.snapshots[Math.min(end,result.snapshots.length)-1];if(!s)return {...result,last:null,internal:{},trade:{},choch:{dir:0},fractals:[]};const r={...result,...s};r.gap=gapAt(result.closedBars,s.index,s,s.atrValue,result.params);return r;}
 function rayStart(from,start,end,xAt){return !Number.isFinite(from)||from>=end?null:xAt(Math.max(start,from));}
 const api={defaults,options,run,at,rayStart,Accepted,originStep};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ViceSolaceSystem=api;
})(typeof window==='undefined'?globalThis:window);
