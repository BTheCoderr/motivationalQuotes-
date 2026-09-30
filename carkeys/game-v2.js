
const SUPABASE_URL='https://qmxawzkpxmbhxgqrwnoe.supabase.co';
const SUPABASE_KEY='sb_publishable_sWPTd_gLRR8CtIKlEJDM-A_fiTmF8eH';
const FALLBACK_SONG={slug:'first-gear',title:'First Gear',difficulty:1,bpm:90,duration_ms:43860,note_map:Array.from({length:64},(_,i)=>({time:1800+i*620,lane:[0,1,2,1,0,1,2,3,2,1,0,2,1,3,2,1][i%16]}))};
const FALLBACK_CARS=[
 {slug:'starter-coupe',name:'Starter Coupe',rarity:'common',base_speed:48,handling:62,boost:42},
 {slug:'neon-runner',name:'Neon Runner',rarity:'rare',base_speed:66,handling:58,boost:70},
 {slug:'rhythm-roadster',name:'Rhythm Roadster',rarity:'epic',base_speed:78,handling:76,boost:82},
 {slug:'grand-touring',name:'Grand Touring',rarity:'legendary',base_speed:90,handling:84,boost:94}
];
const CAR_COLORS={'starter-coupe':'#ff66c4','neon-runner':'#67e8ff','rhythm-roadster':'#ffd166','grand-touring':'#7df0a3'};
const PAINTS=['#ff66c4','#67e8ff','#ffd166','#7df0a3','#ffffff','#a78bfa'];
const laneColors=['#67e8ff','#ff66c4','#ffd166','#7df0a3'];
const laneNotes=[261.63,293.66,329.63,349.23];
const laneLabels=['C','D','E','F'];

const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d');
const stage=$('stage'),scoreEl=$('score'),comboEl=$('combo'),speedEl=$('speed'),boostEl=$('boost');
const flashEl=$('flash'),startOverlay=$('startOverlay'),endOverlay=$('endOverlay'),songSelect=$('songSelect');
const songName=$('songName'),bestEl=$('best'),sourceLabel=$('sourceLabel'),modeBadge=$('modeBadge');
const garageModal=$('garageModal'),garageGrid=$('garageGrid'),coinsEl=$('coins'),toastEl=$('toast'),starsEl=$('stars'),unlockEl=$('unlock');

let DPR=Math.min(2,window.devicePixelRatio||1),W=0,H=0;
let songs=[FALLBACK_SONG],cars=FALLBACK_CARS,currentSong=FALLBACK_SONG;
let notes=[],running=false,startTime=0,lastT=0,raf=0;
let score=0,combo=0,bestCombo=0,hits=0,misses=0,speed=0,boost=0,roadOffset=0;
let playerLane=1.5,targetLane=1.5,carLean=0,shake=0,turboMs=0,lastHitAt=0;
let mode=localStorage.getItem('carkeys-mode')||'kid';
let equipped=localStorage.getItem('carkeys-equipped')||'starter-coupe';
let paint=localStorage.getItem('carkeys-paint')||'';
let unlocked=new Set(JSON.parse(localStorage.getItem('carkeys-unlocked')||'["starter-coupe"]'));
let coins=+(localStorage.getItem('carkeys-coins')||0);
let totalStars=+(localStorage.getItem('carkeys-stars')||0);
let races=+(localStorage.getItem('carkeys-races')||0);
let audio=null,engineOsc=null,engineGain=null,beatTimer=null,beatStep=0,sequence=[];
let countingDown=false,paused=false,pauseStarted=0,freePlay=false;
let tutorialMode=false,bossMode=false,roadObjects=[],playerDistance=0,aiDistance=0,aiLane=2,aiTargetLane=2,runCoins=0,jumpMs=0;
let tutorialCallout=null;

function resize(){
 const r=canvas.getBoundingClientRect();W=r.width;H=r.height;
 canvas.width=Math.max(1,Math.floor(W*DPR));canvas.height=Math.max(1,Math.floor(H*DPR));
 ctx.setTransform(DPR,0,0,DPR,0,0);draw(0);
}
window.addEventListener('resize',resize);
function saveMeta(){
 localStorage.setItem('carkeys-mode',mode);
 localStorage.setItem('carkeys-equipped',equipped);
 localStorage.setItem('carkeys-paint',paint);
 localStorage.setItem('carkeys-unlocked',JSON.stringify([...unlocked]));
 localStorage.setItem('carkeys-coins',String(coins));
 localStorage.setItem('carkeys-stars',String(totalStars));
 localStorage.setItem('carkeys-races',String(races));
 coinsEl.textContent=coins;
 if($('homeCoins'))updateHome();
}
function songStarKey(slug){return 'carkeys-song-stars-'+slug}
function bestSongStars(slug){return +(localStorage.getItem(songStarKey(slug))||0)}
function recomputeTotalStars(){
 totalStars=songs.reduce((sum,s)=>sum+bestSongStars(s.slug),0);
 localStorage.setItem('carkeys-stars',String(totalStars));
 return totalStars;
}
function requiredStars(index){return Math.max(0,index*3)}
function refreshSongSelect(){
 recomputeTotalStars();songSelect.innerHTML='';
 songs.forEach((s,i)=>{
  const req=requiredStars(i),o=document.createElement('option');
  o.value=String(i);o.disabled=totalStars<req;
  o.textContent=(o.disabled?'🔒 ':'')+s.title+' · '+(o.disabled?req+'★ needed':'Lv '+s.difficulty);
  songSelect.appendChild(o);
 });
}
function buzz(pattern){try{if(navigator.vibrate)navigator.vibrate(pattern)}catch{}}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function raceDuration(){return tutorialMode?15500:(currentSong.duration_ms||30000)}
function updateHome(){
 if(!$('homeStars'))return;
 recomputeTotalStars();
 $('homeStars').textContent=totalStars+' / '+Math.max(12,songs.length*3)+' ★';
 $('homeCoins').textContent=coins+' 🪙';
 const boss=$('bossBtn');
 if(boss){
  const beaten=localStorage.getItem('carkeys-boss-1')==='1';
  boss.disabled=totalStars<6;
  boss.textContent=beaten?'👑 BOSS BEATEN · RACE AGAIN':(totalStars<6?'👑 BOSS RACE · 6★':'👑 BOSS RACE · READY');
 }
}
function goHome(){
 reset(false);tutorialMode=false;bossMode=false;freePlay=false;
 startOverlay.style.display='none';endOverlay.style.display='none';$('pauseModal').classList.remove('show');
 garageModal.classList.remove('show');$('homeOverlay').style.display='grid';
 $('pauseBtn').style.visibility='hidden';updateHome();draw(0);
}
function openRaceSetup(){
 tutorialMode=false;bossMode=false;freePlay=false;$('homeOverlay').style.display='none';
 startOverlay.style.display='grid';$('pauseBtn').style.visibility='visible';
 modeBadge.classList.remove('raceTypePill');modeBadge.textContent=mode==='kid'?'KID MODE · BIG HITS':'NORMAL MODE';
}
function startTutorial(){
 tutorialMode=true;bossMode=false;freePlay=false;setMode('kid');$('homeOverlay').style.display='none';
 $('pauseBtn').style.visibility='visible';startGame();
}
function startBossRace(){
 recomputeTotalStars();
 if(totalStars<6){toast('Earn 6 stars to challenge the boss 👑');return}
 tutorialMode=false;bossMode=true;freePlay=false;$('homeOverlay').style.display='none';
 $('pauseBtn').style.visibility='visible';startGame();
}
function buildRoadObjects(){
 roadObjects=[];if(freePlay)return;
 const usable=notes.filter((_,i)=>i>2);
 for(let i=3;i<usable.length;i+=4){
  const n=usable[i],safe=n.lane,wrong=(safe+2+(i%2))%4;
  roadObjects.push({type:'coin',lane:safe,time:n.time+40,handled:false});
  roadObjects.push({type:'cone',lane:wrong,time:n.time+40,handled:false});
  if(i%12===3)roadObjects.push({type:'boost',lane:safe,time:n.time+120,handled:false});
  if(i%16===7)roadObjects.push({type:'ramp',lane:safe,time:n.time+180,handled:false});
 }
}
function handleRoadObjects(t){
 for(const o of roadObjects){
  if(o.handled)continue;
  const delta=t-o.time;
  if(delta>260){o.handled=true;continue}
  if(Math.abs(delta)>190||Math.abs(playerLane-o.lane)>.42)continue;
  o.handled=true;
  if(o.type==='coin'){
   runCoins++;score+=300;showFlash('+1 COIN','#ffd166',false);buzz(15);
  }else if(o.type==='boost'){
   boost=Math.min(100,boost+35);turboMs=Math.max(turboMs,1200);score+=450;showFlash('BOOST PAD!','#67e8ff',true);buzz([18,16,28]);
  }else if(o.type==='ramp'){
   jumpMs=720;boost=Math.min(100,boost+15);score+=500;showFlash('JUMP!','#7df0a3',true);buzz([20,20,40]);
  }else if(o.type==='cone'){
   speed=Math.max(mode==='kid'?24:16,speed-(mode==='kid'?7:16));combo=0;shake=10;showFlash(mode==='kid'?'WHOOPS!':'CONE!','#ff8c42',true);buzz([35,20,35]);
  }
 }
}
function updateTutorialCallout(t){
 if(!tutorialMode||!tutorialCallout){if(tutorialCallout)tutorialCallout.style.display='none';return}
 tutorialCallout.style.display='block';
 if(t<3500)tutorialCallout.textContent='🎹 Tap the glowing piano key';
 else if(t<7000)tutorialCallout.textContent='🏎️ Every correct key moves your car into that lane';
 else if(t<11000)tutorialCallout.textContent='🚧 Follow the notes to stay away from cones';
 else tutorialCallout.textContent='🪙 Grab the coins and race to the finish!';
}
function toast(msg){
 toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toast.t);
 toast.t=setTimeout(()=>toastEl.classList.remove('show'),1700);
}
function setMode(next){
 mode=next;saveMeta();
 document.querySelectorAll('.modeChoice').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
 modeBadge.textContent=mode==='kid'?'KID MODE · BIG HITS':'NORMAL MODE';
}
function audioReady(){
 if(!audio) audio=new (window.AudioContext||window.webkitAudioContext)();
 if(audio.state==='suspended') audio.resume();
}
function noteSound(lane,quality){
 audioReady();
 const o=audio.createOscillator(),g=audio.createGain(),f=audio.createBiquadFilter();
 o.type=quality==='perfect'?'triangle':'sine';o.frequency.value=laneNotes[lane];
 f.type='lowpass';f.frequency.value=1400;
 g.gain.setValueAtTime(.18,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.28);
 o.connect(f).connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.3);
}
function drum(type){
 if(!audio)return;
 const now=audio.currentTime;
 if(type==='kick'){
  const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(125,now);o.frequency.exponentialRampToValueAtTime(45,now+.12);g.gain.setValueAtTime(.12,now);g.gain.exponentialRampToValueAtTime(.001,now+.14);o.connect(g).connect(audio.destination);o.start(now);o.stop(now+.15);
 }else{
  const len=Math.floor(audio.sampleRate*.045),buf=audio.createBuffer(1,len,audio.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
  const src=audio.createBufferSource(),g=audio.createGain(),f=audio.createBiquadFilter();src.buffer=buf;f.type='highpass';f.frequency.value=type==='snare'?1800:5000;g.gain.value=type==='snare'?.055:.025;src.connect(f).connect(g).connect(audio.destination);src.start();
 }
}
function startAudio(){
 audioReady();stopAudio();audioReady();
 engineOsc=audio.createOscillator();engineGain=audio.createGain();
 engineOsc.type='sawtooth';engineOsc.frequency.value=52;engineGain.gain.value=.025;
 engineOsc.connect(engineGain).connect(audio.destination);engineOsc.start();
 beatStep=0;const beatMs=60000/currentSong.bpm/2;
 beatTimer=setInterval(()=>{if(!running)return;drum(beatStep%4===0?'kick':(beatStep%4===2?'snare':'hat'));beatStep++;},beatMs);
}
function stopAudio(){
 if(beatTimer){clearInterval(beatTimer);beatTimer=null}
 if(engineOsc){try{engineOsc.stop()}catch{}engineOsc=null}
 engineGain=null;
}
function updateEngine(){
 if(engineOsc&&audio){
  const target=52+speed*.75+(turboMs>0?28:0);
  engineOsc.frequency.setTargetAtTime(target,audio.currentTime,.06);
 }
}
async function loadData(){
 try{
  const headers={apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY};
  const [sr,cr]=await Promise.all([
   fetch(SUPABASE_URL+'/rest/v1/songs?select=slug,title,difficulty,bpm,duration_ms,note_map&active=eq.true&order=difficulty.asc',{headers}),
   fetch(SUPABASE_URL+'/rest/v1/cars?select=slug,name,rarity,base_speed,handling,boost,unlock_level,price_coins&active=eq.true&order=unlock_level.asc',{headers})
  ]);
  if(!sr.ok)throw new Error('songs');
  const sd=await sr.json();if(sd.length)songs=sd;
  if(cr.ok){const cd=await cr.json();if(cd.length)cars=cd}
  sourceLabel.textContent='CarKeys cloud tracks';
 }catch{
  songs=[FALLBACK_SONG];cars=FALLBACK_CARS;sourceLabel.textContent='Offline-ready track';
 }
 refreshSongSelect();
 chooseSong(0);renderGarage();updateHome();
}
function chooseSong(i){
 recomputeTotalStars();
 const req=requiredStars(i);
 if(totalStars<req){
  toast('Earn '+req+' stars to unlock this track');
  songSelect.value=String(Math.max(0,songs.indexOf(currentSong)));
  return;
 }
 currentSong=songs[i]||songs[0];songSelect.value=String(i);songName.textContent=currentSong.title;
 bestEl.textContent=(+(localStorage.getItem('carkeys-best-'+currentSong.slug)||0)).toLocaleString();
 if(running)reset(false);draw(0);
}
function prepare(){
 const tutorialMap=[0,1,2,3,0,2,1,3,0,1,2,3].map((lane,i)=>({time:1900+i*1050,lane}));
 const map=tutorialMode?tutorialMap:(currentSong.note_map||[]);
 notes=map.map((n,i)=>({time:+n.time,lane:+n.lane,hit:false,missed:false,id:i}));
 score=0;combo=0;bestCombo=0;hits=0;misses=0;speed=mode==='kid'?34:28;boost=0;roadOffset=0;
 playerLane=1.5;targetLane=1.5;carLean=0;shake=0;turboMs=0;sequence=[];runCoins=0;jumpMs=0;
 playerDistance=0;aiDistance=bossMode?18:8;aiLane=2;aiTargetLane=2;buildRoadObjects();
 scoreEl.textContent='0';comboEl.textContent='0x';speedEl.textContent=Math.round(speed);boostEl.style.width='0%';
 $('position').textContent=tutorialMode?'GO!':'2nd';$('position').className='';
}
async function startGame(){
 if(countingDown)return;
 prepare();freePlay=false;paused=false;startOverlay.style.display='none';endOverlay.style.display='none';$('homeOverlay').style.display='none';
 modeBadge.classList.remove('practiceBadge','raceTypePill');
 if(tutorialMode){modeBadge.textContent='TUTORIAL · LEARN THE KEYS';modeBadge.classList.add('raceTypePill')}
 else if(bossMode){modeBadge.textContent='BOSS RACE · THE MAESTRO';modeBadge.classList.add('raceTypePill')}
 else modeBadge.textContent=mode==='kid'?'KID MODE · BIG HITS':'NORMAL MODE';
 countingDown=true;audioReady();
 for(const value of ['3','2','1','GO!']){
  flashEl.classList.add('countdownFlash');showFlash(value,value==='GO!'?'#7df0a3':'#ffffff',true);
  if(value==='GO!')buzz([35,30,60]);
  await wait(value==='GO!'?430:620);
 }
 flashEl.classList.remove('countdownFlash');
 if(!countingDown)return;
 countingDown=false;running=true;startTime=performance.now();lastT=startTime;startAudio();
 cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}
function startFreePlay(){
 countingDown=false;tutorialMode=false;bossMode=false;freePlay=true;prepare();paused=false;running=true;
 startOverlay.style.display='none';endOverlay.style.display='none';$('homeOverlay').style.display='none';$('pauseBtn').style.visibility='visible';
 modeBadge.textContent='PIANO PRACTICE · FREE DRIVE';modeBadge.classList.add('practiceBadge');
 startTime=performance.now();lastT=startTime;startAudio();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
 toast('Tap any key — there is no wrong note here 🎹');
}
function reset(showStart=true){
 countingDown=false;paused=false;freePlay=false;running=false;cancelAnimationFrame(raf);stopAudio();prepare();
 modeBadge.classList.remove('practiceBadge');
 modeBadge.textContent=mode==='kid'?'KID MODE · BIG HITS':'NORMAL MODE';
 document.querySelectorAll('.pianoKey').forEach(k=>k.classList.remove('hint'));
 if(showStart){startOverlay.style.display='grid';endOverlay.style.display='none'}draw(0);
}
function pauseGame(){
 if(!running)return;
 paused=true;running=false;pauseStarted=performance.now();cancelAnimationFrame(raf);stopAudio();
 $('pauseTitle').textContent=freePlay?'PIANO PRACTICE':'PAUSED';
 $('pauseText').textContent=freePlay?'Play a few more notes or head back to the start.':'The race clock is stopped.';
 $('quitPracticeBtn').style.display=freePlay?'block':'none';
 $('pauseModal').classList.add('show');
}
function resumeGame(){
 if(!paused)return;
 const now=performance.now();startTime+=now-pauseStarted;lastT=now;paused=false;running=true;
 $('pauseModal').classList.remove('show');startAudio();raf=requestAnimationFrame(loop);
}
function quitPractice(){
 $('pauseModal').classList.remove('show');paused=false;freePlay=false;reset(true);
}
function showFlash(text,color,big){
 flashEl.textContent=text;flashEl.style.color=color;flashEl.style.fontSize=big?'clamp(38px,9vw,70px)':'';
 flashEl.classList.add('show');clearTimeout(showFlash.t);showFlash.t=setTimeout(()=>flashEl.classList.remove('show'),190);
}
function registerSequence(lane,now){
 sequence.push({lane,time:now});sequence=sequence.filter(x=>now-x.time<1900);
 const last=sequence.slice(-4).map(x=>x.lane).join(',');
 if(last==='0,1,2,3'){turboMs=2200;boost=Math.max(boost,75);showFlash('KEY RUSH!','#ffd166',true);toast('C-D-E-F = KEY RUSH 🔥');sequence=[]}
}
function hitLane(lane){
 const key=document.querySelector('.pianoKey[data-lane="'+lane+'"]');
 if(key){key.classList.add('active');key.classList.remove('hint');setTimeout(()=>key.classList.remove('active'),90)}
 if(!running){noteSound(lane,'free');return}
 const now=performance.now();
 if(freePlay){
  noteSound(lane,'perfect');targetLane=lane;speed=Math.min(120,speed+5);boost=Math.min(100,boost+4);
  registerSequence(lane,now);showFlash(laneLabels[lane],laneColors[lane],false);buzz(18);updateHud();return;
 }
 const t=now-startTime,windowMs=mode==='kid'?330:220;
 let target=null,best=9999;
 for(const n of notes){
  if(n.hit||n.missed||n.lane!==lane)continue;
  const d=Math.abs(n.time-t);if(d<best){best=d;target=n}
 }
 if(!target||best>windowMs){
  noteSound(lane,'miss');combo=0;misses++;speed=Math.max(mode==='kid'?26:18,speed-(mode==='kid'?1:6));
  carLean=(Math.random()>.5?1:-1)*.5;showFlash(mode==='kid'?'TRY THE NEXT ONE':'MISS','#ff6b7a',false);
  if(mode!=='kid')buzz(28);updateHud();return;
 }
 target.hit=true;hits++;targetLane=lane;lastHitAt=now;registerSequence(lane,now);
 const perfect=mode==='kid'?105:70,great=mode==='kid'?215:140;
 let add,label,color,q;
 if(best<=perfect){add=1000;label='PERFECT';color='#7df0a3';q='perfect';speed+=mode==='kid'?10:8;boost+=8;shake=6}
 else if(best<=great){add=720;label='GREAT';color='#67e8ff';q='great';speed+=6;boost+=5}
 else{add=480;label='NICE';color='#ffd166';q='good';speed+=4;boost+=3}
 noteSound(lane,q);buzz(q==='perfect'?[18,18,26]:16);combo++;bestCombo=Math.max(bestCombo,combo);score+=Math.round(add*(1+Math.min(combo,30)*.028));
 speed=Math.min(turboMs>0?185:155,speed);boost=Math.min(100,boost);
 if(boost>=100){turboMs=1800;boost=28;showFlash('TURBO!','#ffd166',true);shake=9}
 else showFlash(label,color,false);
 updateHud();
}
function updateHud(){
 scoreEl.textContent=score.toLocaleString();comboEl.textContent=combo+'x';speedEl.textContent=Math.round(speed);boostEl.style.width=boost+'%';
 const pos=$('position');
 if(freePlay||tutorialMode){pos.textContent=freePlay?'FREE':'LEARN';pos.className=''}
 else{const first=playerDistance>=aiDistance;pos.textContent=first?'1st':'2nd';pos.className=first?'positionWin':'positionLose'}
 updateEngine();
}
function calculateStars(){
 const total=Math.max(1,hits+misses),acc=hits/total*100;
 if(mode==='kid'){return acc>=82?3:(acc>=55?2:1)}
 return acc>=90?3:(acc>=72?2:(acc>=50?1:0));
}
function finish(){
 running=false;cancelAnimationFrame(raf);stopAudio();buzz([40,30,70,30,110]);if(tutorialCallout)tutorialCallout.style.display='none';
 const total=Math.max(1,hits+misses),acc=Math.round(hits/total*100),stars=calculateStars();
 const place=playerDistance>=aiDistance?'1st':'2nd';
 if(tutorialMode){
  const firstTime=localStorage.getItem('carkeys-tutorial-done')!=='1';
  if(firstTime){coins+=50;localStorage.setItem('carkeys-tutorial-done','1')}
  $('finalScore').textContent=score.toLocaleString();$('finalAccuracy').textContent=acc+'%';$('finalCombo').textContent=bestCombo+'x';$('finalPlace').textContent='READY';
  starsEl.textContent='★★★';$('endOverlay').querySelector('h2').textContent='TUTORIAL COMPLETE 🎓';
  unlockEl.innerHTML=firstTime?'🎁 <strong>50 coins</strong> for learning the road!':'You know the keys. Time to race!';unlockEl.classList.add('show');
  saveMeta();updateHome();endOverlay.style.display='grid';return;
 }
 races++;coins+=runCoins+stars*35+Math.floor(score/12000)*5;
 if(!bossMode){
  const oldSongStars=bestSongStars(currentSong.slug);
  if(stars>oldSongStars)localStorage.setItem(songStarKey(currentSong.slug),String(stars));
 }
 recomputeTotalStars();
 let unlockedName='';
 if(races>=1&&!unlocked.has('neon-runner')){unlocked.add('neon-runner');unlockedName='Neon Runner'}
 if(totalStars>=6&&!unlocked.has('rhythm-roadster')){unlocked.add('rhythm-roadster');unlockedName='Rhythm Roadster'}
 if(totalStars>=10&&!unlocked.has('grand-touring')){unlocked.add('grand-touring');unlockedName='Grand Touring'}
 if(bossMode&&place==='1st'&&localStorage.getItem('carkeys-boss-1')!=='1'){
  localStorage.setItem('carkeys-boss-1','1');coins+=250;unlockedName='Maestro Trophy + 250 coins';
 }
 saveMeta();refreshSongSelect();renderGarage();updateHome();
 $('finalScore').textContent=score.toLocaleString();$('finalAccuracy').textContent=acc+'%';$('finalCombo').textContent=bestCombo+'x';$('finalPlace').textContent=place;
 starsEl.textContent='★'.repeat(stars)+'☆'.repeat(3-stars);
 $('endOverlay').querySelector('h2').textContent=bossMode?(place==='1st'?'BOSS BEATEN 👑':'THE MAESTRO WINS 🎼'):'FINISH LINE 🏁';
 const bestKey='carkeys-best-'+currentSong.slug,old=+(localStorage.getItem(bestKey)||0);
 if(score>old)localStorage.setItem(bestKey,String(score));bestEl.textContent=Math.max(score,old).toLocaleString();
 if(unlockedName){unlockEl.innerHTML='🔓 <strong>'+unlockedName+'</strong> unlocked in the Garage!';unlockEl.classList.add('show')}else unlockEl.classList.remove('show');
 endOverlay.style.display='grid';
}
function isUnlocked(slug){
 if(slug==='starter-coupe')return true;
 if(slug==='neon-runner')return races>=1||unlocked.has(slug);
 if(slug==='rhythm-roadster')return totalStars>=6||unlocked.has(slug);
 if(slug==='grand-touring')return totalStars>=10||unlocked.has(slug);
 return unlocked.has(slug);
}
function lockText(slug){
 if(slug==='neon-runner')return 'Finish 1 race';
 if(slug==='rhythm-roadster')return 'Earn 6 stars';
 if(slug==='grand-touring')return 'Earn 10 stars';
 return 'Locked';
}
function carEmoji(slug){return slug==='grand-touring'?'🏎️':slug==='rhythm-roadster'?'🚘':slug==='neon-runner'?'🚙':'🚗'}
function renderGarage(){
 garageGrid.innerHTML='';
 cars.forEach(c=>{
  const open=isUnlocked(c.slug);if(open)unlocked.add(c.slug);
  const el=document.createElement('div');el.className='carCard '+(!open?'locked ':'')+(equipped===c.slug?'equipped':'');
  el.innerHTML='<div class="carVisual">'+carEmoji(c.slug)+'</div><h3>'+c.name+'</h3><p>'+c.rarity.toUpperCase()+' · Speed '+c.base_speed+' · Boost '+c.boost+'</p>'+
   (open?'<button class="equipBtn">'+(equipped===c.slug?'EQUIPPED':'DRIVE THIS')+'</button>':'<button class="lockedBtn">🔒 '+lockText(c.slug)+'</button>');
  if(open)el.querySelector('button').onclick=()=>{equipped=c.slug;saveMeta();renderGarage();toast(c.name+' equipped');draw(running?performance.now()-startTime:0)};
  garageGrid.appendChild(el);
 });
 const row=$('paintRow');row.innerHTML='<span>PAINT</span>';
 PAINTS.forEach(p=>{const b=document.createElement('button');b.className='paint '+((paint||CAR_COLORS[equipped])===p?'active':'');b.style.background=p;b.setAttribute('aria-label','Paint color');b.onclick=()=>{paint=p;saveMeta();renderGarage();draw(running?performance.now()-startTime:0)};row.appendChild(b)});
 saveMeta();
}
function currentCarColor(){return paint||CAR_COLORS[equipped]||'#ff66c4'}
function currentCar(){return cars.find(c=>c.slug===equipped)||cars[0]||FALLBACK_CARS[0]}
function loop(now){
 if(!running)return;
 const t=now-startTime,dt=Math.min(42,now-lastT);lastT=now;
 turboMs=Math.max(0,turboMs-dt);const floor=mode==='kid'?26:18;
 speed=Math.max(floor,speed-dt*(turboMs>0?-.006:.0024));
 const car=currentCar(),handling=(car&&car.handling?car.handling:60)/100;
 const ease=Math.min(1,dt*(.009+.014*handling));playerLane+=(targetLane-playerLane)*ease;
 const targetLean=(targetLane-playerLane)*-.85;carLean+=(targetLean-carLean)*Math.min(1,dt*.02);
 roadOffset=(roadOffset+speed*dt*.022)%75;shake*=.84;jumpMs=Math.max(0,jumpMs-dt);
 playerDistance+=speed*dt/1000;
 if(!freePlay&&!tutorialMode){
  const aiBase=bossMode?112:(mode==='kid'?70:88);
  aiDistance+=(aiBase+(currentSong.difficulty||1)*1.7)*dt/1000;
  aiTargetLane=Math.floor((t/1650+(bossMode?1:0))%4);
  aiLane+=(aiTargetLane-aiLane)*Math.min(1,dt*.0028);
 }
 handleRoadObjects(t);updateTutorialCallout(t);
 if(!freePlay){
  for(const n of notes){
   if(!n.hit&&!n.missed&&t-n.time>(mode==='kid'?370:240)){n.missed=true;misses++;combo=0;speed=Math.max(floor,speed-(mode==='kid'?.4:3))}
  }
 }
 document.querySelectorAll('.pianoKey').forEach(k=>k.classList.remove('hint'));
 if(mode==='kid'&&!freePlay){
  const next=notes.find(n=>!n.hit&&!n.missed&&n.time>=t&&n.time-t<850);
  if(next){const k=document.querySelector('.pianoKey[data-lane="'+next.lane+'"]');if(k)k.classList.add('hint')}
 }
 updateHud();draw(t);
 if(!freePlay&&t>raceDuration())finish();else raf=requestAnimationFrame(loop);
}
function rr(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill()}
function draw(t){
 if(!W||!H)return;
 ctx.save();
 if(shake>1)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake*.45);
 ctx.clearRect(-15,-15,W+30,H+30);
 const horizon=H*.28,left=W*.055,roadLeft=W*.09,roadRight=W*.91,hitY=H*.76;
 let sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,turboMs>0?'#2b1952':'#18204a');sky.addColorStop(1,'#090e20');ctx.fillStyle=sky;ctx.fillRect(0,0,W,horizon);
 ctx.fillStyle='#0d1430';
 for(let i=0;i<18;i++){const bw=24+(i%5)*10,bh=30+(i*29%92),x=(i*63)%W;ctx.fillRect(x,horizon-bh,bw,bh);ctx.fillStyle=i%2?'#67e8ff38':'#ff66c42c';for(let yy=horizon-bh+9;yy<horizon-5;yy+=13)ctx.fillRect(x+7,yy,4,5);ctx.fillStyle='#0d1430'}
 ctx.beginPath();ctx.moveTo(W*.37,horizon);ctx.lineTo(W*.63,horizon);ctx.lineTo(roadRight,H);ctx.lineTo(roadLeft,H);ctx.closePath();ctx.fillStyle=turboMs>0?'#19142a':'#151a26';ctx.fill();
 ctx.strokeStyle=turboMs>0?'#ffd16688':'#67e8ff55';ctx.lineWidth=2;ctx.stroke();
 const laneW=(roadRight-roadLeft)/4;
 for(let i=1;i<4;i++){ctx.strokeStyle='#ffffff16';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(W*.37+(W*.26/4)*i,horizon);ctx.lineTo(roadLeft+laneW*i,H);ctx.stroke()}
 for(let y=horizon+(roadOffset%52);y<H;y+=52){const p=(y-horizon)/(H-horizon),half=W*(.13+.31*p);ctx.strokeStyle=turboMs>0?'#ffd16635':'#ffffff18';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(W/2-half,y);ctx.lineTo(W/2+half,y);ctx.stroke()}
 const lineCount=turboMs>0?16:Math.floor(speed/16);
 ctx.strokeStyle=turboMs>0?'#ffd16688':'#67e8ff35';ctx.lineWidth=2;
 for(let i=0;i<lineCount;i++){const x=(i*83+t*.19)%W,y=horizon+((i*127+t*.25)%(H-horizon));ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+12+(speed*.09));ctx.stroke()}
 ctx.shadowBlur=18;ctx.shadowColor='#67e8ff';ctx.strokeStyle='#67e8ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(roadLeft,hitY);ctx.lineTo(roadRight,hitY);ctx.stroke();ctx.shadowBlur=0;
 const travel=mode==='kid'?2850:2350;
 for(const n of notes){
  if(n.hit||n.missed)continue;const d=n.time-t;if(d>travel||d<-400)continue;
  const p=1-d/travel,y=horizon+(hitY-horizon)*p,lx=roadLeft+laneW*(n.lane+.5),sc=.5+.58*p;
  ctx.shadowBlur=12;ctx.shadowColor=laneColors[n.lane];rr(lx-25*sc,y-12*sc,50*sc,24*sc,8*sc,laneColors[n.lane]);ctx.shadowBlur=0;
  if(mode==='kid'){ctx.fillStyle='#07101d';ctx.font='1000 '+Math.max(9,13*sc)+'px system-ui';ctx.textAlign='center';ctx.fillText(laneLabels[n.lane],lx,y+4*sc)}
 }
 const carY=H*.87;
 const objectTravel=mode==='kid'?3200:2700;
 for(const o of roadObjects){
  if(o.handled)continue;const d=o.time-t;if(d>objectTravel||d<-300)continue;
  const p=1-d/objectTravel,y=horizon+(carY-horizon)*p,x=roadLeft+laneW*(o.lane+.5),sc=.45+.65*p;
  ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);
  if(o.type==='coin'){ctx.shadowBlur=14;ctx.shadowColor='#ffd166';ctx.fillStyle='#ffd166';ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#7c5611';ctx.font='1000 12px system-ui';ctx.textAlign='center';ctx.fillText('C',0,4)}
  else if(o.type==='cone'){ctx.fillStyle='#ff8c42';ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(13,14);ctx.lineTo(-13,14);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(-8,1,16,4)}
  else if(o.type==='boost'){ctx.shadowBlur=12;ctx.shadowColor='#67e8ff';ctx.fillStyle='#173d5a';ctx.fillRect(-19,-7,38,14);ctx.fillStyle='#67e8ff';ctx.font='1000 15px system-ui';ctx.textAlign='center';ctx.fillText('⚡',0,6)}
  else{ctx.fillStyle='#7df0a3';ctx.beginPath();ctx.moveTo(-20,12);ctx.lineTo(-13,-9);ctx.lineTo(13,-9);ctx.lineTo(20,12);ctx.closePath();ctx.fill();ctx.fillStyle='#082318';ctx.font='1000 12px system-ui';ctx.textAlign='center';ctx.fillText('↗',0,6)}
  ctx.restore();ctx.shadowBlur=0;
 }
 if(!freePlay&&!tutorialMode){
  const gap=aiDistance-playerDistance, rivalY=Math.max(horizon+45,Math.min(H*.73,H*.60-gap*1.6)),rivalX=roadLeft+laneW*(aiLane+.5);
  ctx.save();ctx.translate(rivalX,rivalY);ctx.scale(.72,.72);ctx.shadowBlur=18;ctx.shadowColor=bossMode?'#ffd166':'#ff6b7a';ctx.fillStyle=bossMode?'#ffd166':'#ff6b7a';
  ctx.beginPath();ctx.moveTo(-34,20);ctx.lineTo(-24,-17);ctx.quadraticCurveTo(0,-35,24,-17);ctx.lineTo(34,20);ctx.quadraticCurveTo(0,29,-34,20);ctx.fill();ctx.fillStyle='#1b2038';ctx.fillRect(-17,-18,34,18);ctx.fillStyle='#fff';ctx.fillRect(-25,10,10,6);ctx.fillRect(15,10,10,6);ctx.restore();ctx.shadowBlur=0;
 }
 const carX=roadLeft+laneW*(playerLane+.5),carColor=currentCarColor(),jumpLift=jumpMs>0?Math.sin((jumpMs/720)*Math.PI)*46:0;
 ctx.save();ctx.translate(carX,carY-jumpLift);ctx.rotate(carLean*.08);
 if(turboMs>0){ctx.shadowBlur=30;ctx.shadowColor='#ffd166';ctx.fillStyle='#ffd166';ctx.beginPath();ctx.moveTo(-15,33);ctx.lineTo(-4,64+Math.random()*14);ctx.lineTo(2,32);ctx.fill();ctx.beginPath();ctx.moveTo(15,33);ctx.lineTo(4,64+Math.random()*14);ctx.lineTo(-2,32);ctx.fill()}
 ctx.shadowBlur=26;ctx.shadowColor=carColor+'bb';ctx.fillStyle=carColor;ctx.beginPath();ctx.moveTo(-43,23);ctx.lineTo(-31,-20);ctx.quadraticCurveTo(0,-44,31,-20);ctx.lineTo(43,23);ctx.quadraticCurveTo(0,35,-43,23);ctx.fill();
 ctx.fillStyle='#172750';ctx.beginPath();ctx.moveTo(-21,-18);ctx.lineTo(-15,-30);ctx.lineTo(15,-30);ctx.lineTo(21,-18);ctx.closePath();ctx.fill();
 ctx.fillStyle='#f9fbff';ctx.fillRect(-32,12,12,7);ctx.fillRect(20,12,12,7);ctx.fillStyle='#07090d';ctx.fillRect(-41,14,10,20);ctx.fillRect(31,14,10,20);ctx.restore();ctx.shadowBlur=0;
 ctx.font='1000 12px system-ui';ctx.textAlign='center';for(let i=0;i<4;i++){ctx.fillStyle=laneColors[i];ctx.fillText(laneLabels[i],roadLeft+laneW*(i+.5),hitY+23)}
 ctx.restore();
}
document.querySelectorAll('.pianoKey').forEach(b=>{
 const lane=+b.dataset.lane;
 b.addEventListener('pointerdown',e=>{e.preventDefault();hitLane(lane)});
});
window.addEventListener('keydown',e=>{
 if(e.repeat)return;const m={a:0,s:1,d:2,f:3};const lane=m[e.key.toLowerCase()];
 if(lane!==undefined)hitLane(lane);if(e.key===' '&&!running)startGame();
});
$('startBtn').onclick=startGame;$('freePlayBtn').onclick=startFreePlay;$('againBtn').onclick=startGame;$('restartBtn').onclick=()=>reset(true);
$('pauseBtn').onclick=pauseGame;$('resumeBtn').onclick=resumeGame;$('quitPracticeBtn').onclick=quitPractice;$('homeFromPause').onclick=goHome;$('homeFromEnd').onclick=goHome;
$('raceMenuBtn').onclick=openRaceSetup;$('tutorialBtn').onclick=startTutorial;$('practiceMenuBtn').onclick=startFreePlay;$('bossBtn').onclick=startBossRace;
$('garageMenuBtn').onclick=()=>{renderGarage();garageModal.classList.add('show')};
$('garageBtn').onclick=()=>{renderGarage();garageModal.classList.add('show')};
$('closeGarage').onclick=()=>garageModal.classList.remove('show');
$('garageFromEnd').onclick=()=>{endOverlay.style.display='none';renderGarage();garageModal.classList.add('show')};
garageModal.addEventListener('click',e=>{if(e.target===garageModal)garageModal.classList.remove('show')});
songSelect.addEventListener('change',()=>chooseSong(+songSelect.value));
document.querySelectorAll('.modeChoice').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pauseGame()});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
tutorialCallout=document.createElement('div');tutorialCallout.className='tutorialCallout';tutorialCallout.style.display='none';stage.appendChild(tutorialCallout);
setMode(mode);saveMeta();resize();prepare();$('pauseBtn').style.visibility='hidden';loadData().then(()=>{draw(0);renderGarage();updateHome()});
