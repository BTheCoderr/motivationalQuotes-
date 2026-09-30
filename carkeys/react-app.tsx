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
const WORLDS=[
  {
    id:'city',number:1,icon:'🌃',title:'City of Music',storyTitle:'The Night the City Lost Its Music',
    subtitle:'Wake the city one sound at a time.',
    intro:'The lights are dark. The bridge is asleep. Echo Tunnel forgot its song. Your keys can wake everything back up.',
    reward:150,theme:'city',
    scenes:[
      {id:'lights',title:'Wake the Streetlights',icon:'💡',pattern:[0,0,0,0],line:"Let's wake the lights.",success:'Whoa... the lights are waking up!'},
      {id:'bridge',title:'Open the Bridge',icon:'🌉',pattern:[0,1,0,1],line:'The bridge needs our rhythm.',success:'Nice! The bridge is open!'},
      {id:'tunnel',title:'Echo Tunnel',icon:'🔊',pattern:[0,1,2,1],memory:true,line:'Shh... listen.',success:'You got the echo!'},
      {id:'home',title:'Bring Music Home',icon:'✨',pattern:[0,1,2,3],line:'One more melody. Bring the music home!',success:'Look! The whole city is singing!'},
    ]
  },
  {
    id:'forest',number:2,icon:'🌲',title:'Rhythm Forest',storyTitle:'The Animals Forgot the Beat',
    subtitle:'Help the forest remember how to move together.',
    intro:'The Moonlight Parade is tonight, but the animals forgot their rhythm. The road only opens when every beat fits together.',
    reward:200,theme:'forest',
    scenes:[
      {id:'rabbit',title:'Rabbit Steps',icon:'🐇',pattern:[0,0,1,1],line:'Rabbit needs the beat.',success:'There he goes! Two and two!'},
      {id:'woodpecker',title:'Woodpecker Workshop',icon:'🐦',pattern:[2,2,2,2],line:"Let's fix the parade sign.",success:'Four clean knocks!'},
      {id:'owl',title:'Owl Says',icon:'🦉',pattern:[0,2,1,2],memory:true,line:'Shh... Owl has a rhythm.',success:"You got Owl's rhythm!"},
      {id:'parade',title:'Moonlight Parade',icon:'🦊',pattern:[0,0,1,2,2,3],line:"Let's start the parade!",success:'The whole forest is moving!'},
    ]
  }
];

type ProgressState={
  world:number;scene:number;mode:'twin'|'story';started:boolean;
  completedWorlds:string[];completedScenes:string[];stars:number;races:number;
};
const DEFAULT_PROGRESS:ProgressState={world:0,scene:0,mode:'twin',started:false,completedWorlds:[],completedScenes:[],stars:0,races:0};
function loadProgress():ProgressState{
  try{
    const raw=JSON.parse(localStorage.getItem('carkeys2-progress')||'null');
    if(!raw)return DEFAULT_PROGRESS;
    return {...DEFAULT_PROGRESS,...raw,
      completedWorlds:Array.isArray(raw.completedWorlds)?raw.completedWorlds:[],
      completedScenes:Array.isArray(raw.completedScenes)?raw.completedScenes:[]
    };
  }catch{return DEFAULT_PROGRESS}
}

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
function pace(mode:'twin'|'story'|'race'|'piano'='race'){
  if(mode==='twin')return {beat:470,intro:390,sceneCue:360,memory:760,listenDelay:850,clearDelay:2100};
  if(mode==='story')return {beat:390,intro:320,sceneCue:280,memory:650,listenDelay:650,clearDelay:1750};
  if(mode==='piano')return {beat:430,intro:340,sceneCue:300,memory:650,listenDelay:650,clearDelay:1700};
  return {beat:330,intro:280,sceneCue:240,memory:580,listenDelay:550,clearDelay:1500};
}
function startBeat(mode:'twin'|'story'|'race'|'piano'='race'){
  stopBeat();let i=0;const p=pace(mode);
  beatTimer=setInterval(()=>{drum(i%4===0?'kick':i%4===2?'snare':'hat');i++},p.beat);
}
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
  const [worldIndex,setWorldIndex]=useState(0);
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
  const [progress,setProgress]=useState(loadProgress);
  const [resultKind,setResultKind]=useState('story' as 'story'|'race');
  const [resultWorld,setResultWorld]=useState(0);
  const [resultNextWorld,setResultNextWorld]=useState(null as number|null);
  const timers=useRef([] as any[]);
  const world=WORLDS[worldIndex]||WORLDS[0];
  const scene=world.scenes[sceneIndex]||world.scenes[0];
  const car=CARS.find(c=>c.id===selectedCar)||CARS[0];
  const allBuiltComplete=progress.completedWorlds.length>=WORLDS.length;
  const hasContinue=progress.started&&!allBuiltComplete;
  const continueWorld=WORLDS[Math.min(progress.world,WORLDS.length-1)];
  const continueScene=continueWorld.scenes[Math.min(progress.scene,continueWorld.scenes.length-1)];

  function saveProgress(update:(prev:ProgressState)=>ProgressState){setProgress(prev=>{const next=update(prev);try{localStorage.setItem('carkeys2-progress',JSON.stringify(next))}catch{}return next})}
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
  function introMusic(mode:'twin'|'story'|'race'|'piano'='race'){
    const p=pace(mode);
    [0,1,2,3].forEach((n,i)=>later(()=>playNote(n),i*p.intro));
    later(()=>drum('kick'),0);later(()=>drum('hat'),p.intro);later(()=>drum('snare'),p.intro*2);
  }
  function startStory(mode:PlayMode,targetWorld=0,targetScene=0){
    clearTimers();setPlayMode(mode);setWorldIndex(targetWorld);setSceneIndex(targetScene);setStep(0);setMemoryPhase('idle');setPulse(-1);setMessage('');setScreen('play');
    saveProgress(prev=>prev.completedWorlds.includes(WORLDS[targetWorld].id)?prev:{...prev,started:true,world:targetWorld,scene:targetScene,mode});
    startBeat(mode);introMusic(mode);
    speak(targetWorld===0?"Ready? Let's bring the music back.":"Ready? Let's find the forest beat.");
    later(()=>beginScene(targetScene,mode,targetWorld),mode==='twin'?1550:1200);
  }
  function continueAdventure(){startStory(progress.mode,progress.world,progress.scene)}
  function beginScene(index:number,mode=playMode,targetWorld=worldIndex){
    clearTimers();setWorldIndex(targetWorld);setSceneIndex(index);setStep(0);setPulse(-1);setMessage('');
    saveProgress(prev=>prev.completedWorlds.includes(WORLDS[targetWorld].id)?prev:{...prev,started:true,world:targetWorld,scene:index,mode});
    const s=WORLDS[targetWorld].scenes[index],p=pace(mode);
    if(s.memory){setMemoryPhase('listen');speak(s.line);later(()=>playMemory(s,mode),p.listenDelay)}
    else{setMemoryPhase('idle');s.pattern.forEach((n:number,i:number)=>later(()=>playNote(n,true),i*p.sceneCue));later(()=>speak(s.line),mode==='twin'?300:220)}
  }
  function playMemory(s:any,mode:PlayMode=playMode){
    const p=pace(mode);setMemoryPhase('listen');setStep(0);
    s.pattern.forEach((n:number,i:number)=>later(()=>{setPulse(i);playNote(n)},i*p.memory));
    later(()=>{setPulse(-1);setMemoryPhase('copy');setMessage('COPY IT!')},s.pattern.length*p.memory+(mode==='twin'?650:420));
  }
  function completeScene(){
    const key=world.id+':'+scene.id;
    const firstSceneClear=!progress.completedScenes.includes(key);
    if(firstSceneClear)saveProgress(prev=>({...prev,stars:prev.stars+1,completedScenes:[...prev.completedScenes,key]}));
    jingle(sceneIndex===world.scenes.length-1);speak(scene.success);
    if(sceneIndex<world.scenes.length-1){
      const nextScene=sceneIndex+1;
      saveProgress(prev=>({...prev,world:worldIndex,scene:nextScene,mode:playMode,started:true}));
      later(()=>beginScene(nextScene,playMode,worldIndex),pace(playMode).clearDelay);
      return;
    }
    const worldAlreadyDone=progress.completedWorlds.includes(world.id);
    const nextBuilt=worldIndex+1<WORLDS.length?worldIndex+1:null;
    saveProgress(prev=>{
      const completedWorlds=prev.completedWorlds.includes(world.id)?prev.completedWorlds:[...prev.completedWorlds,world.id];
      return {...prev,completedWorlds,world:nextBuilt===null?worldIndex:nextBuilt,scene:0,mode:playMode,started:nextBuilt!==null};
    });
    if(!worldAlreadyDone)setCoins((v:number)=>v+world.reward);
    setResultKind('story');setResultWorld(worldIndex);setResultNextWorld(nextBuilt);
    later(()=>{setScreen('results');stopBeat()},pace(playMode).clearDelay);
  }
  function hitStory(lane:number){
    if(screen!=='play')return;playNote(lane);if(scene.memory&&memoryPhase!=='copy')return;
    const want=scene.pattern[step];
    if(lane!==want){
      setMessage(scene.memory?'HEAR IT AGAIN':'TRY '+NOTES[want]);
      if(scene.memory){setMemoryPhase('listen');later(()=>playMemory(scene,playMode),playMode==='twin'?750:500)}
      return;
    }
    const next=step+1;setStep(next);setMessage('');
    if(next>=scene.pattern.length)completeScene();
  }
  const racePattern=useMemo(()=>[0,1,2,3,1,2,0,3,2,1,0,0,2,3,1,3],[]);
  function startRace(){clearTimers();setRaceStep(0);setRaceScore(0);setRaceCombo(0);setResultKind('race');setScreen('race');startBeat('race');introMusic('race')}
  function hitRace(lane:number){
    playNote(lane);const want=racePattern[raceStep%racePattern.length];
    if(lane===want){
      const next=raceStep+1;setRaceStep(next);setRaceScore((v:number)=>v+100+(raceCombo*10));setRaceCombo((v:number)=>v+1);
      if(next>=racePattern.length){
        jingle(true);later(()=>{stopBeat();setCoins((v:number)=>v+50);saveProgress(prev=>({...prev,races:prev.races+1}));setResultKind('race');setResultNextWorld(null);setScreen('results')},800);
      }
    }else setRaceCombo(0);
  }

  function pianoHit(lane:number){playNote(lane);drum('hat')}
  function openWorldStory(i:number){setWorldIndex(i);setSceneIndex(0);setScreen('story')}
  function continueAfterResult(){if(resultKind==='story'&&resultNextWorld!==null){startStory(playMode,resultNextWorld,0);return}setScreen('map')}

  return <main className={'app '+screen}>
    <TopBar coins={coins} stars={progress.stars} backend={backend} onHome={goHome} compact={screen!=='home'} />
    {screen==='home'&&<Home progress={progress} hasContinue={hasContinue} continueWorld={continueWorld} continueScene={continueScene} onContinue={continueAdventure} onTwin={()=>startStory('twin',0,0)} onStory={()=>setScreen('map')} onRace={startRace} onPiano={()=>{setScreen('piano');startBeat('piano')}} onGarage={()=>setScreen('garage')} />}
    {screen==='map'&&<WorldMap progress={progress} onWorld={openWorldStory} onBack={goHome} />}
    {screen==='story'&&<StoryIntro world={world} completed={progress.completedWorlds.includes(world.id)} onStart={()=>startStory('story',worldIndex,0)} onBack={()=>setScreen('map')} />}
    {screen==='play'&&<PlayScreen mode={playMode} world={world} scene={scene} sceneIndex={sceneIndex} step={step} phase={memoryPhase} pulse={pulse} message={message} car={car} onKey={hitStory} onHome={goHome} />}
    {screen==='race'&&<RaceScreen pattern={racePattern} step={raceStep} score={raceScore} combo={raceCombo} car={car} onKey={hitRace} onHome={goHome} />}
    {screen==='piano'&&<PianoScreen onKey={pianoHit} onHome={goHome} />}
    {screen==='garage'&&<Garage selected={selectedCar} stars={progress.stars} races={progress.races} onSelect={setSelectedCar} onBack={goHome} />}
    {screen==='results'&&<Results kind={resultKind} world={WORLDS[resultWorld]} nextWorld={resultNextWorld===null?null:WORLDS[resultNextWorld]} mode={playMode} onContinue={continueAfterResult} onAgain={()=>resultKind==='race'?startRace():startStory(playMode,resultWorld,0)} onHome={goHome} />}
  </main>

  </main>
}

function TopBar({coins,stars,backend,onHome,compact}:any){
  return <header className={'top '+(compact?'compact':'')}><button className="brand" onClick={onHome}><span className="logoNote">♪</span><span>CARKEYS</span></button><div className="topMeta"><span className={'cloud '+backend}>● {backend==='online'?'ONLINE':backend==='checking'?'CONNECTING':'OFFLINE'}</span><span className="starsMeta">★ {stars}</span><span className="coins">🪙 {coins}</span></div></header>
}
function Home({progress,hasContinue,continueWorld,continueScene,onContinue,onTwin,onStory,onRace,onPiano,onGarage}:any){
  return <section className="homeScreen"><div className="heroWorld"><div className="moon"/><div className="skyline"/><div className="heroRoad"><div className="lane l1"/><div className="lane l2"/><div className="lane l3"/><div className="heroCar"><CarGraphic accent="#53e7ff"/></div></div><div className="heroCopy"><span className="kicker">MUSIC POWERS THE ROAD</span><h1>DRIVE THE<br/><em>ADVENTURE.</em></h1><p>Play the keys. Change the world.</p></div></div>
    <div className="modeDock">
      {hasContinue&&<button className="continueCard" onClick={onContinue}><span>▶</span><div><b>CONTINUE ADVENTURE</b><small>{continueWorld.icon} {continueWorld.title} · {continueScene.title}</small></div><i>KEEP GOING →</i></button>}
      <button className="modeCard twinCard" onClick={onTwin}><span className="modeIcon">⭐</span><b>TWIN MODE</b><small>One thing at a time</small><i>START FRESH →</i></button>
      <button className="modeCard storyCard" onClick={onStory}><span className="modeIcon">📖</span><b>STORY</b><small>{progress.completedWorlds.length}/{WORLDS.length} worlds complete · {progress.stars} ★</small><i>EXPLORE →</i></button>
      <div className="miniModes"><button onClick={onRace}>🏁 <b>Race</b></button><button onClick={onPiano}>🎹 <b>Piano Play</b></button><button onClick={onGarage}>🚗 <b>Garage</b></button></div>
    </div>
  </section>
}
function WorldMap({progress,onWorld,onBack}:any){
  const cityDone=progress.completedWorlds.includes('city'),forestDone=progress.completedWorlds.includes('forest');
  return <section className="panelScreen"><button className="back" onClick={onBack}>← HOME</button><div className="mapHeader"><span>STORY ROAD</span><h2>KEEP THE ADVENTURE GOING.</h2><p>{progress.stars} ★ earned · progress saves automatically</p></div><div className="worldPath">
    <button className={'world active '+(cityDone?'complete':'')} onClick={()=>onWorld(0)}><span>🌃</span><b>CITY OF MUSIC</b><small>{cityDone?'Story complete — replay anytime.':'The city lost its sound.'}</small><i>{cityDone?'✓ COMPLETE':'PLAY STORY →'}</i></button>
    <div className="pathDots">••••••</div>
    <button className={'world '+(cityDone?'active ':'locked ')+(forestDone?'complete':'')} onClick={()=>cityDone&&onWorld(1)}><span>🌲</span><b>RHYTHM FOREST</b><small>{!cityDone?'Finish City of Music first.':forestDone?'Story complete — replay anytime.':'The Moonlight Parade lost its beat.'}</small><i>{!cityDone?'LOCKED':forestDone?'✓ COMPLETE':'PLAY STORY →'}</i></button>
    <div className="pathDots">••••••</div><button className="world locked"><span>⛰️</span><b>NUMBER MOUNTAIN</b><small>Next adventure is being built.</small><i>COMING SOON</i></button>
  </div></section>
}
function StoryIntro({world,completed,onStart,onBack}:any){
  return <section className={'storyIntro theme-'+world.theme}><button className="back" onClick={onBack}>← MAP</button><div className="storyPoster"><div className="storySky"><span className="bigCity">{world.icon}</span><span className="floatingNote n1">♪</span><span className="floatingNote n2">♫</span></div><div className="storyText"><span>STORY {String(world.number).padStart(2,'0')} {completed?'· COMPLETE':''}</span><h2>{world.storyTitle.toUpperCase()}</h2><p>{world.intro}</p><div className="chapterStrip">{world.scenes.map((s:any,i:number)=><span key={s.id}>{s.icon}<small>{i+1}</small></span>)}</div><button className="cta" onClick={onStart}>{completed?'REPLAY THE STORY':'START THE ADVENTURE'} →</button></div></div></section>
}
function PlayScreen({mode,world,scene,sceneIndex,step,phase,pulse,message,car,onKey,onHome}:any){
  const memory=scene.memory;
  return <section className={'gameScreen theme-'+world.theme}><div className="mission"><span>{world.icon} {mode==='twin'?'TWIN MODE':world.title.toUpperCase()} · {sceneIndex+1}/{world.scenes.length}</span><h2>{scene.title}</h2>{memory?<><div className={'stateChip '+phase}>{phase==='listen'?'👂 LISTEN':'🎹 COPY IT!'}</div><ProgressDots total={scene.pattern.length} step={step} pulse={pulse} listening={phase==='listen'} /></>:<><div className="oneAction">{message||<>TAP <b>{NOTES[scene.pattern[Math.min(step,scene.pattern.length-1)]]}</b></>}</div><ProgressDots total={scene.pattern.length} step={step}/></>}</div><WorldStage world={world} scene={scene} step={step} pulse={pulse} phase={phase} car={car}/><PianoKeys onKey={onKey} disabled={memory&&phase==='listen'} highlight={!memory?scene.pattern[Math.min(step,scene.pattern.length-1)]:-1}/><button className="smallHome" onClick={onHome}>⌂</button></section>
}
function WorldStage({world,scene,step,pulse,phase,car}:any){
  const forest=world.theme==='forest';
  return <div className={'worldStage scene-'+scene.id+' '+(forest?'forestStage':'cityStage')}><div className="worldSky"><div className="stars"/><div className={forest?'forestBack':'cityBack'}/></div><div className="road3d"><span className="roadLine a"/><span className="roadLine b"/><span className="roadLine c"/></div>
    {scene.id==='lights'&&<div className="streetlights">{[0,1,2,3].map(i=><span key={i} className={i<step?'on':''}><i/></span>)}</div>}
    {scene.id==='bridge'&&<div className={'bridge '+(step>=2?'leftOpen ':'')+(step>=4?'rightOpen':'')}><span className="tower left"/><span className="deck left"/><span className="deck right"/><span className="tower right"/></div>}
    {scene.id==='tunnel'&&<div className="tunnel">{[0,1,2,3].map(i=><span key={i} className={(phase==='listen'?i===pulse:i<step)?'lit':''} style={{'--c':COLORS[i]}} />)}</div>}
    {scene.id==='home'&&<div className="restoreCity"><span className={step>=1?'on':''}>MUSIC</span><div className={'windows '+(step>=2?'on':'')}>▦ ▦ ▦</div><div className={'speaker '+(step>=3?'on':'')}>◉</div><div className={'musicBurst '+(step>=4?'on':'')}>♪ ♫ ♪</div></div>}
    {forest&&<div className="forestScene">
      {scene.id==='rabbit'&&<><span className="animal big">🐇</span><div className="beatTrail">{scene.pattern.map((_:any,i:number)=><i key={i} className={i<step?'on':''}/>)}</div></>}
      {scene.id==='woodpecker'&&<><span className="animal bird">🐦</span><div className="workSign">{[0,1,2,3].map(i=><i key={i} className={i<step?'on':''}>×</i>)}</div></>}
      {scene.id==='owl'&&<><span className="animal owl">🦉</span><div className="fireflies">{scene.pattern.map((_:any,i:number)=><i key={i} className={(phase==='listen'?i===pulse:i<step)?'on':''} style={{'--c':COLORS[i]}}/>)}</div></>}
      {scene.id==='parade'&&<div className="parade">{['🐇','🐦','🦉','🦊','🦌','🐿️'].map((a,i)=><span key={i} className={i<step?'on':''}>{a}</span>)}</div>}
    </div>}
    <div className="playerCar"><CarGraphic accent={car.accent}/></div>
  </div>
}
function RaceScreen({pattern,step,score,combo,car,onKey,onHome}:any){
  const want=pattern[step%pattern.length];return <section className="gameScreen raceMode"><div className="raceHud"><div><span>SCORE</span><b>{score}</b></div><div><span>COMBO</span><b>{combo}x</b></div><div><span>CHECKPOINT</span><b>{Math.min(step+1,pattern.length)}/{pattern.length}</b></div></div><div className="worldStage scene-race"><div className="worldSky"><div className="stars"/><div className="cityBack"/></div><div className="road3d"><span className="roadLine a"/><span className="roadLine b"/><span className="roadLine c"/></div><div className="raceCue"><small>NEXT KEY</small><b style={{color:COLORS[want]}}>{NOTES[want]}</b></div><div className="playerCar raceCar"><CarGraphic accent={car.accent}/></div></div><PianoKeys onKey={onKey} highlight={want}/><button className="smallHome" onClick={onHome}>⌂</button></section>
}
function PianoScreen({onKey,onHome}:any){
  return <section className="pianoScreen"><div className="freeGlow"><span>🎹 FREE PLAY</span><h2>MAKE THE ROAD SING.</h2><p>No score. No wrong notes. Just play.</p></div><div className="pianoStage"><div className="soundRings"><i/><i/><i/></div><CarGraphic accent="#53e7ff"/></div><PianoKeys onKey={onKey}/><button className="smallHome" onClick={onHome}>⌂</button></section>
}
function Garage({selected,stars,races,onSelect,onBack}:any){
  const unlocked=(i:number)=>i===0||(i===1&&races>=1)||(i===2&&stars>=6)||(i===3&&stars>=10);
  return <section className="panelScreen garage"><button className="back" onClick={onBack}>← HOME</button><div className="mapHeader"><span>GARAGE</span><h2>PICK YOUR RIDE.</h2><p>{stars} ★ · {races} races finished</p></div><div className="carShowcase"><CarGraphic accent={(CARS.find(c=>c.id===selected)||CARS[0]).accent}/></div><div className="carGrid">{CARS.map((car,i)=><button key={car.id} className={(selected===car.id?'selected ':'')+(!unlocked(i)?'locked':'')} onClick={()=>unlocked(i)&&onSelect(car.id)}><i style={{background:car.accent}}/><b>{car.name}</b><small>{unlocked(i)?(selected===car.id?'EQUIPPED':'READY'):car.unlock}</small></button>)}</div></section>
}
function Results({kind,world,nextWorld,onContinue,onAgain,onHome}:any){
  const story=kind==='story';
  return <section className="resultsScreen"><div className="resultBurst">★</div><span>{story?'WORLD COMPLETE':'RACE COMPLETE'}</span><h2>{story?(world.id==='city'?'THE CITY SINGS AGAIN!':'THE PARADE IS MOVING!'):'FINISH LINE!'}</h2><p>{story?(String(world.reward)+' coins earned. Your progress is saved.'):'50 coins earned. Race progress saved.'}</p><div className="resultButtons">{story&&nextWorld&&<button className="cta continueResult" onClick={onContinue}>CONTINUE TO {nextWorld.title.toUpperCase()} →</button>}{story&&!nextWorld&&<button className="cta continueResult" onClick={onContinue}>BACK TO STORY ROAD →</button>}<button className="ghost" onClick={onAgain}>{story?'REPLAY WORLD':'RACE AGAIN'}</button><button className="ghost" onClick={onHome}>HOME</button></div></section>
}

function ProgressDots({total,step,pulse=-1,listening=false}:any){return <div className="progressDots">{Array.from({length:total},(_:any,i:number)=><i key={i} className={(i<step?'done ':'')+(listening&&i===pulse?'pulse':'')}/>)}</div>}
function PianoKeys({onKey,disabled=false,highlight=-1}:any){return <div className={'keys '+(disabled?'disabled':'')}>{NOTES.map((n,i)=><button key={n} disabled={disabled} className={highlight===i?'hint':''} onPointerDown={()=>onKey(i)} style={{'--key':COLORS[i]}}><span>{n}</span><small>{['A','S','D','F'][i]}</small></button>)}</div>}
function CarGraphic({accent}:any){
  return <div className="carArt" style={{'--accent':accent}}>
    <div className="carGlow"/>
    <svg className="carSvg" viewBox="0 0 140 120" aria-hidden="true">
      <ellipse className="carShadow" cx="70" cy="105" rx="48" ry="10"/>
      <rect className="tire tireL" x="18" y="58" width="16" height="42" rx="7"/>
      <rect className="tire tireR" x="106" y="58" width="16" height="42" rx="7"/>
      <path className="bodyMain" d="M28 96 L22 79 Q23 51 42 31 Q54 18 70 18 Q86 18 98 31 Q117 51 118 79 L112 96 Q94 106 70 106 Q46 106 28 96 Z"/>
      <path className="bodyHighlight" d="M37 51 Q51 27 70 27 Q89 27 103 51 L96 56 Q84 44 70 44 Q56 44 44 56 Z"/>
      <path className="rearGlass" d="M45 48 Q55 29 70 29 Q85 29 95 48 L89 61 H51 Z"/>
      <path className="trunk" d="M36 69 Q70 60 104 69 L100 89 Q70 97 40 89 Z"/>
      <rect className="tailLight left" x="34" y="75" width="23" height="10" rx="4"/>
      <rect className="tailLight right" x="83" y="75" width="23" height="10" rx="4"/>
      <rect className="bumper" x="42" y="91" width="56" height="8" rx="4"/>
      <rect className="plateSvg" x="56" y="85" width="28" height="12" rx="2"/>
      <text x="70" y="94" textAnchor="middle" className="plateText">KEYS</text>
      <circle className="exhaust" cx="37" cy="99" r="3"/><circle className="exhaust" cx="103" cy="99" r="3"/>
    </svg>
  </div>
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
