declare const React: any;
declare const ReactDOM: any;
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }

const {useEffect,useMemo,useRef,useState}=React;
const NOTES=['C','D','E','F'];
const FREQ=[261.63,293.66,329.63,349.23];
const COLORS=['#53e7ff','#bfff5b','#ffd45d','#ff6cc8'];
const CARS=[
  {id:'starter',name:'Starter Coupe',unlock:'Ready',accent:'#53e7ff'},
  {id:'neon',name:'Neon Runner',unlock:'Finish 1 race',accent:'#8f7cff'},
  {id:'rhythm',name:'Rhythm Roadster',unlock:'Earn 6 stars',accent:'#ff6cc8'},
  {id:'grand',name:'Grand Touring',unlock:'Earn 10 stars',accent:'#ffd45d'},
];
const SCENES=[
  {id:'lights',title:'Wake the Streetlights',icon:'💡',pattern:[0,0,0,0],line:"Let's wake the lights.",success:'Whoa... the lights are waking up!'},
  {id:'bridge',title:'Open the Bridge',icon:'🌉',pattern:[0,1,0,1],line:'The bridge needs our rhythm.',success:'Nice! The bridge is open!'},
  {id:'tunnel',title:'Echo Tunnel',icon:'🔊',pattern:[0,1,2,1],memory:true,line:'Shh... listen.',success:'You got the echo!'},
  {id:'home',title:'Bring Music Home',icon:'✨',pattern:[0,1,2,3],line:'One more melody. Bring the music home!',success:'Look! The whole city is singing!'},
];

type AppScreen='home'|'map'|'story'|'play'|'race'|'piano'|'garage'|'results';
type PlayMode='twin'|'story';

let audioCtx:any=null;
let beatTimer:any=null;
function ctx(){
  if(!audioCtx)audioCtx=new ((window as any).AudioContext||(window as any).webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  return audioCtx;
}
function playNote(lane:number,soft=false){
  const a=ctx(); const o=a.createOscillator(); const g=a.createGain(); const f=a.createBiquadFilter();
  o.type=soft?'sine':'triangle'; o.frequency.value=FREQ[lane]; f.type='lowpass'; f.frequency.value=soft?1000:1700;
  const now=a.currentTime; g.gain.setValueAtTime(soft?.09:.16,now); g.gain.exponentialRampToValueAtTime(.001,now+.34);
  o.connect(f).connect(g).connect(a.destination);o.start(now);o.stop(now+.36);
}
function drum(type:'kick'|'hat'|'snare'){try{
  const a=ctx(),now=a.currentTime;
  if(type==='kick'){const o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.setValueAtTime(120,now);o.frequency.exponentialRampToValueAtTime(45,now+.12);g.gain.setValueAtTime(.10,now);g.gain.exponentialRampToValueAtTime(.001,now+.15);o.connect(g).connect(a.destination);o.start();o.stop(now+.16);return}
  const len=Math.floor(a.sampleRate*.05),buf=a.createBuffer(1,len,a.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*(1-i/len);
  const src=a.createBufferSource(),g=a.createGain(),f=a.createBiquadFilter();src.buffer=buf;f.type='highpass';f.frequency.value=type==='snare'?1700:4800;g.gain.value=type==='snare'?.045:.022;src.connect(f).connect(g).connect(a.destination);src.start();
}catch{}}
function startBeat(){stopBeat();let i=0;beatTimer=setInterval(()=>{drum(i%4===0?'kick':i%4===2?'snare':'hat');i++},320)}
function stopBeat(){if(beatTimer){clearInterval(beatTimer);beatTimer=null}}
function jingle(win=false){const seq=win?[0,1,2,3,2,3]:[0,2,3];seq.forEach((n,i)=>setTimeout(()=>playNote(n),i*140));}
function chooseVoice(){try{
  const voices=speechSynthesis.getVoices().filter((v:any)=>/^en/i.test(v.lang||''));
  const preferred=['samantha','ava','allison','zoe','nicky','jamie','reed','sandy','alex','aria','jenny'];
  const ranked=voices.map((v:any)=>{const n=(v.name||'').toLowerCase();let score=v.localService?20:0;if((v.lang||'').toLowerCase()==='en-us')score+=20;if(/premium|enhanced|natural/.test(n))score+=50;const p=preferred.findIndex(x=>n.includes(x));if(p>=0)score+=70-p;if(/compact|espeak|festival/.test(n))score-=100;return{v,score}}).sort((a:any,b:any)=>b.score-a.score);
  return ranked[0]&&ranked[0].score>25?ranked[0].v:null;
}catch{return null}}
function speak(text:string){try{const voice=chooseVoice();if(!voice)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.voice=voice;u.lang=voice.lang||'en-US';u.rate=.94;u.pitch=1.02;u.volume=.76;speechSynthesis.speak(u)}catch{}}

function App(){
  const [screen,setScreen]=useState('home' as AppScreen);
  const [playMode,setPlayMode]=useState('twin' as PlayMode);
  const [sceneIndex,setSceneIndex]=useState(0);
  const [step,setStep]=useState(0);
  const [memoryPhase,setMemoryPhase]=useState('idle' as 'idle'|'listen'|'copy');
  const [pulse,setPulse]=useState(-1);
  const [message,setMessage]=useState('');
  const [coins,setCoins]=useState(()=>Number(localStorage.getItem('carkeys2-coins')||'0'));
  const [selectedCar,setSelectedCar]=useState(()=>localStorage.getItem('carkeys2-car')||'starter');
  const [raceStep,setRaceStep]=useState(0);
  const [raceScore,setRaceScore]=useState(0);
  const [raceCombo,setRaceCombo]=useState(0);
  const [backend,setBackend]=useState('checking' as 'checking'|'online'|'offline');
  const timers=useRef([] as any[]);
  const scene=SCENES[sceneIndex];
  const car=CARS.find(c=>c.id===selectedCar)||CARS[0];

  function later(fn:()=>void,ms:number){const id=setTimeout(fn,ms);timers.current.push(id);return id}
  function clearTimers(){timers.current.forEach(clearTimeout);timers.current=[]}
  useEffect(()=>()=>{clearTimers();stopBeat();try{speechSynthesis.cancel()}catch{}},[]);
  useEffect(()=>{try{speechSynthesis.getVoices();(speechSynthesis as any).onvoiceschanged=()=>speechSynthesis.getVoices()}catch{}},[]);
  useEffect(()=>{
    fetch('https://qmxawzkpxmbhxgqrwnoe.supabase.co/rest/v1/cars?select=id&limit=1',{headers:{apikey:'sb_publishable_sWPTd_gLRR8CtIKlEJDM-A_fiTmF8eH'}})
      .then(r=>setBackend(r.ok?'online':'offline')).catch(()=>setBackend('offline'));
  },[]);
  useEffect(()=>{localStorage.setItem('carkeys2-coins',String(coins))},[coins]);
  useEffect(()=>{localStorage.setItem('carkeys2-car',selectedCar)},[selectedCar]);

  function goHome(){clearTimers();stopBeat();try{speechSynthesis.cancel()}catch{};setMessage('');setScreen('home')}
  function introMusic(){[0,1,2,3].forEach((n,i)=>later(()=>playNote(n),i*260));later(()=>drum('kick'),0);later(()=>drum('hat'),260);later(()=>drum('snare'),520)}
  function startStory(mode:PlayMode){clearTimers();setPlayMode(mode);setSceneIndex(0);setStep(0);setMemoryPhase('idle');setPulse(-1);setMessage('');setScreen('play');startBeat();introMusic();speak("Ready? Let's bring the music back.");later(()=>beginScene(0,mode),1050)}
  function beginScene(index:number,mode=playMode){clearTimers();setSceneIndex(index);setStep(0);setPulse(-1);setMessage('');const s=SCENES[index];if(s.memory){setMemoryPhase('listen');speak(s.line);later(()=>playMemory(s),500)}else{setMemoryPhase('idle');s.pattern.forEach((n,i)=>later(()=>playNote(n,true),i*180));later(()=>speak(s.line),180)}}
  function playMemory(s:any){setMemoryPhase('listen');setStep(0);s.pattern.forEach((n:number,i:number)=>later(()=>{setPulse(i);playNote(n)},i*520));later(()=>{setPulse(-1);setMemoryPhase('copy');setMessage('COPY IT!')},s.pattern.length*520+330)}
  function hitStory(lane:number){if(screen!=='play')return;playNote(lane);if(scene.memory&&memoryPhase!=='copy')return;const want=scene.pattern[step];if(lane!==want){setMessage(scene.memory?'HEAR IT AGAIN':'TRY '+NOTES[want]);if(scene.memory){setMemoryPhase('listen');later(()=>playMemory(scene),420)}return}const next=step+1;setStep(next);setMessage('');if(next>=scene.pattern.length){jingle(sceneIndex===SCENES.length-1);speak(scene.success);if(sceneIndex===SCENES.length-1){later(()=>{setCoins((v:number)=>v+150);setScreen('results');stopBeat()},1450)}else later(()=>beginScene(sceneIndex+1),1450)}}
  function startRace(){clearTimers();setRaceStep(0);setRaceScore(0);setRaceCombo(0);setScreen('race');startBeat();introMusic()}
  const racePattern=useMemo(()=>[0,1,2,3,1,2,0,3,2,1,0,0,2,3,1,3],[]);
  function hitRace(lane:number){playNote(lane);const want=racePattern[raceStep%racePattern.length];if(lane===want){setRaceStep((v:number)=>v+1);setRaceScore((v:number)=>v+100+(raceCombo*10));setRaceCombo((v:number)=>v+1);if(raceStep+1>=racePattern.length){jingle(true);later(()=>{stopBeat();setCoins((v:number)=>v+50);setScreen('results')},800)}}else setRaceCombo(0)}
  function pianoHit(lane:number){playNote(lane);drum('hat')}

  return <main className={'app '+screen}>
    <TopBar coins={coins} backend={backend} onHome={goHome} compact={screen!=='home'} />
    {screen==='home'&&<Home onTwin={()=>startStory('twin')} onStory={()=>setScreen('map')} onRace={startRace} onPiano={()=>{setScreen('piano');startBeat()}} onGarage={()=>setScreen('garage')} />}
    {screen==='map'&&<WorldMap onCity={()=>setScreen('story')} onBack={goHome} />}
    {screen==='story'&&<StoryIntro onStart={()=>startStory('story')} onBack={()=>setScreen('map')} />}
    {screen==='play'&&<PlayScreen mode={playMode} scene={scene} sceneIndex={sceneIndex} step={step} phase={memoryPhase} pulse={pulse} message={message} car={car} onKey={hitStory} onHome={goHome} />}
    {screen==='race'&&<RaceScreen pattern={racePattern} step={raceStep} score={raceScore} combo={raceCombo} car={car} onKey={hitRace} onHome={goHome} />}
    {screen==='piano'&&<PianoScreen onKey={pianoHit} onHome={goHome} />}
    {screen==='garage'&&<Garage selected={selectedCar} onSelect={setSelectedCar} onBack={goHome} />}
    {screen==='results'&&<Results mode={playMode} onAgain={()=>playMode==='twin'||playMode==='story'?startStory(playMode):startRace()} onHome={goHome} />}
  </main>
}

function TopBar({coins,backend,onHome,compact}:any){return <header className={'top '+(compact?'compact':'')}><button className="brand" onClick={onHome}><span className="logoNote">♪</span><span>CARKEYS</span></button><div className="topMeta"><span className={'cloud '+backend}>● {backend==='online'?'ONLINE':backend==='checking'?'CONNECTING':'OFFLINE'}</span><span className="coins">🪙 {coins}</span></div></header>}
function Home({onTwin,onStory,onRace,onPiano,onGarage}:any){return <section className="homeScreen"><div className="heroWorld"><div className="moon"/><div className="skyline"/><div className="heroRoad"><div className="lane l1"/><div className="lane l2"/><div className="lane l3"/><div className="heroCar"><CarGraphic accent="#53e7ff"/></div></div><div className="heroCopy"><span className="kicker">MUSIC POWERS THE ROAD</span><h1>DRIVE THE<br/><em>ADVENTURE.</em></h1><p>Play the keys. Change the world.</p></div></div><div className="modeDock"><button className="modeCard twinCard" onClick={onTwin}><span className="modeIcon">⭐</span><b>TWIN MODE</b><small>One thing at a time</small><i>PLAY →</i></button><button className="modeCard storyCard" onClick={onStory}><span className="modeIcon">📖</span><b>STORY</b><small>Save the City of Music</small><i>EXPLORE →</i></button><div className="miniModes"><button onClick={onRace}>🏁 <b>Race</b></button><button onClick={onPiano}>🎹 <b>Piano Play</b></button><button onClick={onGarage}>🚗 <b>Garage</b></button></div></div></section>}
function WorldMap({onCity,onBack}:any){return <section className="panelScreen"><button className="back" onClick={onBack}>← HOME</button><div className="mapHeader"><span>STORY ROAD</span><h2>WHERE SHOULD WE DRIVE?</h2></div><div className="worldPath"><button className="world active" onClick={onCity}><span>🌃</span><b>CITY OF MUSIC</b><small>The city lost its sound.</small><i>PLAY STORY →</i></button><div className="pathDots">••••••</div><button className="world locked"><span>🌲</span><b>RHYTHM FOREST</b><small>Finish City of Music first.</small><i>LOCKED</i></button><div className="pathDots">••••••</div><button className="world locked"><span>⛰️</span><b>NUMBER MOUNTAIN</b><small>Coming soon.</small><i>SOON</i></button></div></section>}
function StoryIntro({onStart,onBack}:any){return <section className="storyIntro"><button className="back" onClick={onBack}>← MAP</button><div className="storyPoster"><div className="storySky"><span className="bigCity">🌃</span><span className="floatingNote n1">♪</span><span className="floatingNote n2">♫</span></div><div className="storyText"><span>STORY 01</span><h2>THE NIGHT THE CITY<br/><em>LOST ITS MUSIC</em></h2><p>The lights are dark. The bridge is asleep. Echo Tunnel forgot its song. Your keys can wake everything back up.</p><button className="cta" onClick={onStart}>START THE ADVENTURE →</button></div></div></section>}
function PlayScreen({mode,scene,sceneIndex,step,phase,pulse,message,car,onKey,onHome}:any){const memory=scene.memory;return <section className="gameScreen"><div className="mission"><span>{scene.icon} {mode==='twin'?'TWIN MODE':'STORY'} · {sceneIndex+1}/4</span><h2>{scene.title}</h2>{memory?<><div className={'stateChip '+phase}>{phase==='listen'?'👂 LISTEN':'🎹 COPY IT!'}</div><ProgressDots total={scene.pattern.length} step={step} pulse={pulse} listening={phase==='listen'} /></>:<><div className="oneAction">{message||<>TAP <b>{NOTES[scene.pattern[Math.min(step,scene.pattern.length-1)]]}</b></>}</div><ProgressDots total={scene.pattern.length} step={step}/></>}</div><WorldStage scene={scene} step={step} pulse={pulse} phase={phase} car={car}/><PianoKeys onKey={onKey} disabled={memory&&phase==='listen'} highlight={!memory?scene.pattern[Math.min(step,scene.pattern.length-1)]:-1}/><button className="smallHome" onClick={onHome}>⌂</button></section>}
function WorldStage({scene,step,pulse,phase,car}:any){return <div className={'worldStage scene-'+scene.id}><div className="worldSky"><div className="stars"/><div className="cityBack"/></div><div className="road3d"><span className="roadLine a"/><span className="roadLine b"/><span className="roadLine c"/></div>{scene.id==='lights'&&<div className="streetlights">{[0,1,2,3].map(i=><span key={i} className={i<step?'on':''}><i/></span>)}</div>}{scene.id==='bridge'&&<div className={'bridge '+(step>=2?'leftOpen ':'')+(step>=4?'rightOpen':'')}><span className="tower left"/><span className="deck left"/><span className="deck right"/><span className="tower right"/></div>}{scene.id==='tunnel'&&<div className="tunnel">{[0,1,2,3].map(i=><span key={i} className={(phase==='listen'?i===pulse:i<step)?'lit':''} style={{'--c':COLORS[i]}} />)}</div>}{scene.id==='home'&&<div className="restoreCity"><span className={step>=1?'on':''}>MUSIC</span><div className={'windows '+(step>=2?'on':'')}>▦ ▦ ▦</div><div className={'speaker '+(step>=3?'on':'')}>◉</div><div className={'musicBurst '+(step>=4?'on':'')}>♪ ♫ ♪</div></div>}<div className="playerCar"><CarGraphic accent={car.accent}/></div></div>}
function RaceScreen({pattern,step,score,combo,car,onKey,onHome}:any){const want=pattern[step%pattern.length];return <section className="gameScreen raceMode"><div className="raceHud"><div><span>SCORE</span><b>{score}</b></div><div><span>COMBO</span><b>{combo}x</b></div><div><span>CHECKPOINT</span><b>{Math.min(step+1,pattern.length)}/{pattern.length}</b></div></div><div className="worldStage scene-race"><div className="worldSky"><div className="stars"/><div className="cityBack"/></div><div className="road3d"><span className="roadLine a"/><span className="roadLine b"/><span className="roadLine c"/></div><div className="raceCue"><small>NEXT KEY</small><b style={{color:COLORS[want]}}>{NOTES[want]}</b></div><div className="playerCar raceCar"><CarGraphic accent={car.accent}/></div></div><PianoKeys onKey={onKey} highlight={want}/><button className="smallHome" onClick={onHome}>⌂</button></section>}
function PianoScreen({onKey,onHome}:any){return <section className="pianoScreen"><div className="freeGlow"><span>🎹 FREE PLAY</span><h2>MAKE THE ROAD SING.</h2><p>No score. No wrong notes. Just play.</p></div><div className="pianoStage"><div className="soundRings"><i/><i/><i/></div><CarGraphic accent="#53e7ff"/></div><PianoKeys onKey={onKey}/><button className="smallHome" onClick={onHome}>⌂</button></section>}
function Garage({selected,onSelect,onBack}:any){return <section className="panelScreen garage"><button className="back" onClick={onBack}>← HOME</button><div className="mapHeader"><span>GARAGE</span><h2>PICK YOUR RIDE.</h2></div><div className="carShowcase"><CarGraphic accent={(CARS.find(c=>c.id===selected)||CARS[0]).accent}/></div><div className="carGrid">{CARS.map((car,i)=><button key={car.id} className={selected===car.id?'selected':''} onClick={()=>i===0?onSelect(car.id):null}><i style={{background:car.accent}}/><b>{car.name}</b><small>{i===0?'READY':car.unlock}</small></button>)}</div></section>}
function Results({mode,onAgain,onHome}:any){return <section className="resultsScreen"><div className="resultBurst">★</div><span>ADVENTURE COMPLETE</span><h2>{mode==='twin'?'YOU SAVED THE CITY!':'THE CITY SINGS AGAIN!'}</h2><p>Music is back on the road.</p><div className="resultButtons"><button className="cta" onClick={onAgain}>PLAY AGAIN</button><button className="ghost" onClick={onHome}>HOME</button></div></section>}
function ProgressDots({total,step,pulse=-1,listening=false}:any){return <div className="progressDots">{Array.from({length:total},(_:any,i:number)=><i key={i} className={(i<step?'done ':'')+(listening&&i===pulse?'pulse':'')}/>)}</div>}
function PianoKeys({onKey,disabled=false,highlight=-1}:any){return <div className={'keys '+(disabled?'disabled':'')}>{NOTES.map((n,i)=><button key={n} disabled={disabled} className={highlight===i?'hint':''} onPointerDown={()=>onKey(i)} style={{'--key':COLORS[i]}}><span>{n}</span><small>{['A','S','D','F'][i]}</small></button>)}</div>}
function CarGraphic({accent}:any){return <div className="carArt" style={{'--accent':accent}}><div className="carGlow"/><div className="carShell"><div className="glass"/><i className="light l"/><i className="light r"/><span className="plate">KEYS</span></div><i className="wheel wl"/><i className="wheel wr"/></div>}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
