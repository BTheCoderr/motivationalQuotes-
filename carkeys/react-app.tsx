declare const React: any;
declare const ReactDOM: any;
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }

const {useEffect,useMemo,useRef,useState}=React;
const NOTES=['C','D','E','F'];
const FREQ=[261.63,293.66,329.63,349.23];
const COLORS=['#ff4f88','#ffd43d','#54d846','#9a4cf1'];
const CARS=[
  {id:'starter',name:'Starter Coupe',unlock:'Ready',accent:'#23a8ff',image:'/assets/cars/starter.webp',rarity:'COMMON',speed:48,boost:42},
  {id:'neon',name:'Neon Runner',unlock:'Finish 1 race',accent:'#8b35ff',image:'/assets/cars/neon.webp',rarity:'RARE',speed:66,boost:70},
  {id:'rhythm',name:'Rhythm Roadster',unlock:'Earn 6 stars',accent:'#ff4fa3',image:'/assets/cars/rhythm.webp',rarity:'EPIC',speed:78,boost:82},
  {id:'grand',name:'Grand Touring',unlock:'Earn 10 stars',accent:'#ffbe18',image:'/assets/cars/grand.webp',rarity:'LEGENDARY',speed:90,boost:94},
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
      {id:'tunnel',title:'Echo Tunnel',icon:'🔊',pattern:[0,1,2,1],line:'Shh... listen.',success:'You got the echo!'},
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
      {id:'owl',title:'Owl Says',icon:'🦉',pattern:[0,2,1,2],line:'Shh... Owl has a rhythm.',success:"You got Owl's rhythm!"},
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
  if(mode==='twin')return {beat:520,intro:300,sceneCue:260,memory:650,listenDelay:450,clearDelay:900};
  if(mode==='story')return {beat:440,intro:260,sceneCue:230,memory:620,listenDelay:400,clearDelay:760};
  if(mode==='piano')return {beat:460,intro:260,sceneCue:230,memory:620,listenDelay:400,clearDelay:760};
  return {beat:360,intro:230,sceneCue:210,memory:560,listenDelay:350,clearDelay:650};
}
function startBeat(mode:'twin'|'story'|'race'|'piano'='race'){
  stopBeat();let i=0;const p=pace(mode);
  beatTimer=setInterval(()=>{drum(i%4===0?'kick':i%4===2?'snare':'hat');i++},p.beat);
}
function stopBeat(){if(beatTimer){clearInterval(beatTimer);beatTimer=null}}
function jingle(win=false){const seq=win?[0,1,2,3,2,3]:[0,2,3];seq.forEach((n,i)=>setTimeout(()=>playNote(n),i*140));}
function speak(_text:string){/* intentionally silent: keep music, remove browser robot voice */}

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
  const [driveLane,setDriveLane]=useState(1);
  const [hitPulse,setHitPulse]=useState(0);
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
  useEffect(()=>()=>{clearTimers();stopBeat()},[]);
  useEffect(()=>{
    fetch('https://qmxawzkpxmbhxgqrwnoe.supabase.co/rest/v1/cars?select=id&limit=1',{headers:{apikey:'sb_publishable_sWPTd_gLRR8CtIKlEJDM-A_fiTmF8eH'}})
      .then(r=>setBackend(r.ok?'online':'offline')).catch(()=>setBackend('offline'));
  },[]);
  useEffect(()=>{localStorage.setItem('carkeys2-coins',String(coins))},[coins]);
  useEffect(()=>{localStorage.setItem('carkeys2-car',selectedCar)},[selectedCar]);

  function goHome(){clearTimers();stopBeat();setMessage('');setScreen('home')}
  function introMusic(mode:'twin'|'story'|'race'|'piano'='race'){
    const p=pace(mode);
    [0,1,2,3].forEach((n,i)=>later(()=>playNote(n),i*p.intro));
    later(()=>drum('kick'),0);later(()=>drum('hat'),p.intro);later(()=>drum('snare'),p.intro*2);
  }
  function startStory(mode:PlayMode,targetWorld=0,targetScene=0){
    clearTimers();setPlayMode(mode);setWorldIndex(targetWorld);setSceneIndex(targetScene);setStep(0);setMemoryPhase('idle');setPulse(-1);setMessage('');setScreen('play');
    saveProgress(prev=>prev.completedWorlds.includes(WORLDS[targetWorld].id)?prev:{...prev,started:true,world:targetWorld,scene:targetScene,mode});
    startBeat(mode);introMusic(mode);
    setDriveLane(1);
    later(()=>beginScene(targetScene,mode,targetWorld),320);
  }
  function continueAdventure(){startStory(progress.mode,progress.world,progress.scene)}
  function beginScene(index:number,mode=playMode,targetWorld=worldIndex){
    clearTimers();setWorldIndex(targetWorld);setSceneIndex(index);setStep(0);setPulse(-1);setMessage('');setMemoryPhase('idle');
    saveProgress(prev=>prev.completedWorlds.includes(WORLDS[targetWorld].id)?prev:{...prev,started:true,world:targetWorld,scene:index,mode});
    const s=WORLDS[targetWorld].scenes[index];
    later(()=>playNote(s.pattern[0],true),180);
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
    if(screen!=='play')return;
    setDriveLane(lane);setHitPulse((v:number)=>v+1);playNote(lane);
    try{(navigator as any).vibrate?.(18)}catch{}
    const want=scene.pattern[Math.min(step,scene.pattern.length-1)];
    if(lane!==want){
      setMessage('TRY '+NOTES[want]);
      later(()=>setMessage(''),420);
      return;
    }
    drum('kick');
    const next=step+1;setStep(next);setMessage(next>=scene.pattern.length?'NICE! ⭐':'');
    if(next<scene.pattern.length)later(()=>playNote(scene.pattern[next],true),150);
    if(next>=scene.pattern.length)completeScene();
  }
  const racePattern=useMemo(()=>[0,1,2,3,1,2,0,3],[]);

  function startRace(){clearTimers();setRaceStep(0);setRaceScore(0);setRaceCombo(0);setResultKind('race');setScreen('race');startBeat('race');introMusic('race')}
  function hitRace(lane:number){
    setDriveLane(lane);setHitPulse((v:number)=>v+1);playNote(lane);
    try{(navigator as any).vibrate?.(14)}catch{}
    const want=racePattern[Math.min(raceStep,racePattern.length-1)];
    if(lane!==want){setRaceCombo(0);return}
    drum('kick');
    const next=raceStep+1;setRaceStep(next);setRaceScore((v:number)=>v+100+(raceCombo*10));setRaceCombo((v:number)=>v+1);
    if(next>=racePattern.length){
      jingle(true);
      later(()=>{stopBeat();setCoins((v:number)=>v+50);saveProgress(prev=>({...prev,races:prev.races+1}));setResultKind('race');setResultNextWorld(null);setScreen('results')},600);
    }
  }

  function pianoHit(lane:number){setDriveLane(lane);setHitPulse((v:number)=>v+1);playNote(lane);drum('hat')}
  function openWorldStory(i:number){startStory('story',i,0)}
  function continueAfterResult(){if(resultKind==='story'&&resultNextWorld!==null){startStory(playMode,resultNextWorld,0);return}setScreen('map')}

  return <main className={'app '+screen}>
    <TopBar coins={coins} stars={progress.stars} backend={backend} onHome={goHome} compact={screen!=='home'} />
    {screen==='home'&&<Home progress={progress} hasContinue={hasContinue} continueWorld={continueWorld} continueScene={continueScene} onContinue={continueAdventure} onTwin={()=>startStory('twin',0,0)} onStory={()=>setScreen('map')} onRace={startRace} onPiano={()=>{setScreen('piano');startBeat('piano')}} onGarage={()=>setScreen('garage')} />}
    {screen==='map'&&<WorldMap progress={progress} onWorld={openWorldStory} onBack={goHome} />}
    {screen==='play'&&<PlayScreen mode={playMode} world={world} scene={scene} sceneIndex={sceneIndex} step={step} message={message} car={car} lane={driveLane} hitPulse={hitPulse} onKey={hitStory} onHome={goHome} />}
    {screen==='race'&&<RaceScreen pattern={racePattern} step={raceStep} car={car} lane={driveLane} hitPulse={hitPulse} onKey={hitRace} onHome={goHome} />}
    {screen==='piano'&&<PianoScreen car={car} lane={driveLane} hitPulse={hitPulse} onKey={pianoHit} onHome={goHome} />}
    {screen==='garage'&&<Garage selected={selectedCar} stars={progress.stars} races={progress.races} onSelect={setSelectedCar} onBack={goHome} />}
    {screen==='results'&&<Results kind={resultKind} world={WORLDS[resultWorld]} nextWorld={resultNextWorld===null?null:WORLDS[resultNextWorld]} mode={playMode} onContinue={continueAfterResult} onAgain={()=>resultKind==='race'?startRace():startStory(playMode,resultWorld,0)} onHome={goHome} />}
  </main>
}

function TopBar({coins,stars,backend,onHome,compact}:any){
  return <header className={'top '+(compact?'compact':'')}><button className="brand" onClick={onHome} aria-label="CarKeys home"><span className="logoNote">♪</span><span className="brandWord">CarKeys</span></button><div className="topMeta"><span className="starsMeta">⭐ {stars}</span><span className="coins">🪙 {coins}</span></div></header>
}

function Home({progress,hasContinue,continueWorld,continueScene,onContinue,onTwin,onStory,onRace,onPiano,onGarage}:any){
  return <section className="homeScreen simpleCoreHome">
    <div className="heroWorld">
      <div className="moon"/><div className="skyline"/>
      <div className="heroRoad"><div className="lane l1"/><div className="lane l2"/><div className="lane l3"/><div className="heroCar"><CarGraphic accent="#23a8ff"/></div></div>
      <div className="heroCopy"><span className="kicker">MUSIC POWERS THE CAR</span><h1>CARKEYS</h1><p>Tap the keys. Drive the adventure.</p></div>
    </div>
    <div className="coreMenu">
      <button className="corePlay" onClick={hasContinue?onContinue:onTwin}><span>▶</span><div><b>{hasContinue?'KEEP PLAYING':'PLAY'}</b><small>{hasContinue?continueScene.title:'Easy adventure for Twin'}</small></div></button>
      <div className="coreModes">
        <button onClick={onStory}><span>🗺️</span><b>STORY ROAD</b></button>
        <button onClick={onRace}><span>🏁</span><b>RACE</b></button>
        <button onClick={onPiano}><span>🎹</span><b>JUST PLAY</b></button>
        <button onClick={onGarage}><span>🚗</span><b>GARAGE</b></button>
      </div>
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
function PlayScreen({mode,world,scene,sceneIndex,step,message,car,lane,hitPulse,onKey,onHome}:any){
  const target=scene.pattern[Math.min(step,scene.pattern.length-1)];
  const done=step>=scene.pattern.length;
  return <section className={'driveScreen '+(world.theme==='forest'?'forestDrive':'cityDrive')}>
    <div className="driveStageWrap">
      <WorldStage world={world} scene={scene} step={step} car={car} lane={lane} target={target} hitPulse={hitPulse}/>
      <button className="driveHome" onClick={onHome} aria-label="Home">⌂</button>
      <div className="driveMission">
        <span>{scene.icon} {scene.title.toUpperCase()}</span>
        <b className={done?'done':''}>{done?'NICE! ⭐':message||<>TAP <em>{NOTES[target]}</em></>}</b>
        <ProgressDots total={scene.pattern.length} step={step}/>
      </div>
    </div>
    <PianoKeys onKey={onKey} disabled={done} highlight={done?-1:target}/>
  </section>
}

function WorldStage({world,scene,step,car,lane,target,hitPulse}:any){
  const forest=world.theme==='forest';
  const laneX=[24,41,59,76];
  return <div className={'worldStage driveWorld scene-'+scene.id+' '+(forest?'forestStage':'cityStage')}>
    <div className="worldSky"><div className={forest?'forestBack':'cityBack'}/></div>
    <div className="road3d movingRoad"><div className="roadDash"/></div>
    {target!==undefined&&<div key={scene.id+'-'+step} className={'roadTarget target-'+target} style={{'--target':COLORS[target]}}><b>{NOTES[target]}</b></div>}

    {scene.id==='lights'&&<div className="streetlights">{[0,1,2,3].map(i=><span key={i} className={i<step?'on':''}><i/></span>)}</div>}
    {scene.id==='bridge'&&<div className={'bridge '+(step>=2?'leftOpen ':'')+(step>=4?'rightOpen':'')}><span className="tower left"/><span className="deck left"/><span className="deck right"/><span className="tower right"/></div>}
    {scene.id==='tunnel'&&<div className="tunnel">{[0,1,2,3].map(i=><span key={i} className={i<step?'lit':''} style={{'--c':COLORS[i]}} />)}</div>}
    {scene.id==='home'&&<div className="restoreCity"><span className={step>=1?'on':''}>♪</span><div className={'windows '+(step>=2?'on':'')}>▦ ▦ ▦</div><div className={'speaker '+(step>=3?'on':'')}>◉</div><div className={'musicBurst '+(step>=4?'on':'')}>♪ ♫ ★</div></div>}
    {forest&&<div className="forestScene">
      {scene.id==='rabbit'&&<><span className="animal big">🐇</span><div className="beatTrail">{scene.pattern.map((_:any,i:number)=><i key={i} className={i<step?'on':''}/>)}</div></>}
      {scene.id==='woodpecker'&&<><span className="animal bird">🐦</span><div className="workSign">{[0,1,2,3].map(i=><i key={i} className={i<step?'on':''}>★</i>)}</div></>}
      {scene.id==='owl'&&<><span className="animal owl">🦉</span><div className="fireflies">{scene.pattern.map((_:any,i:number)=><i key={i} className={i<step?'on':''} style={{'--c':COLORS[i]}}/>)}</div></>}
      {scene.id==='parade'&&<div className="parade">{['🐇','🐦','🦉','🦊'].map((a,i)=><span key={i} className={i<step?'on':''}>{a}</span>)}</div>}
    </div>}

    <div key={'car-'+hitPulse+'-'+step} className="playerCar driveCar" style={{left:laneX[lane]+'%'}}><CarGraphic accent={car.accent}/><i className="carBoost"/></div>
  </div>
}

function RaceScreen({pattern,step,car,lane,hitPulse,onKey,onHome}:any){
  const done=step>=pattern.length;
  const target=pattern[Math.min(step,pattern.length-1)];
  const laneX=[24,41,59,76];
  return <section className="driveScreen raceDrive">
    <div className="driveStageWrap">
      <div className="worldStage driveWorld cityStage">
        <div className="worldSky"><div className="cityBack"/></div>
        <div className="road3d movingRoad fast"><div className="roadDash"/></div>
        {!done&&<div key={'race-target-'+step} className={'roadTarget fastTarget target-'+target} style={{'--target':COLORS[target]}}><b>{NOTES[target]}</b></div>}
        <div key={'race-car-'+hitPulse+'-'+step} className="playerCar driveCar raceCar" style={{left:laneX[lane]+'%'}}><CarGraphic accent={car.accent}/><i className="carBoost"/></div>
      </div>
      <button className="driveHome" onClick={onHome} aria-label="Home">⌂</button>
      <div className="driveMission"><span>🏁 RACE</span><b className={done?'done':''}>{done?'FINISH! ⭐':<>TAP <em>{NOTES[target]}</em></>}</b><ProgressDots total={pattern.length} step={step}/></div>
    </div>
    <PianoKeys onKey={onKey} disabled={done} highlight={done?-1:target}/>
  </section>
}

function PianoScreen({car,lane,hitPulse,onKey,onHome}:any){
  const laneX=[24,41,59,76];
  return <section className="driveScreen pianoDrive">
    <div className="driveStageWrap">
      <div className="worldStage driveWorld cityStage">
        <div className="worldSky"><div className="cityBack"/></div>
        <div className="road3d movingRoad"><div className="roadDash"/></div>
        <div key={'piano-car-'+hitPulse} className="playerCar driveCar" style={{left:laneX[lane]+'%'}}><CarGraphic accent={car.accent}/><i className="carBoost"/></div>
      </div>
      <button className="driveHome" onClick={onHome} aria-label="Home">⌂</button>
      <div className="driveMission free"><span>🎹 JUST PLAY</span><b>MAKE THE CAR SING</b></div>
    </div>
    <PianoKeys onKey={onKey}/>
  </section>
}

function Garage({selected,stars,races,onSelect,onBack}:any){
  const unlocked=(i:number)=>i===0||(i===1&&races>=1)||(i===2&&stars>=6)||(i===3&&stars>=10);
  return <section className="panelScreen garage cleanRewardGarage"><button className="back bubbleBack" onClick={onBack}>← DONE</button><div className="mapHeader garageTitle"><span>YOUR CARS</span><h2>GARAGE</h2></div><div className="carGrid">{CARS.map((car,i)=><button key={car.id} className={'carCard '+(selected===car.id?'selected ':'')+(!unlocked(i)?'locked':'')} onClick={()=>unlocked(i)&&onSelect(car.id)} style={{'--accent':car.accent}}><div className="carCardArt"><CarGraphic accent={car.accent}/></div><b>{car.name}</b><small>{unlocked(i)?(selected===car.id?'✓ EQUIPPED':'PICK THIS CAR'):'🔒 '+car.unlock}</small></button>)}</div></section>
}

function Results({kind,world,nextWorld,onContinue,onAgain,onHome}:any){
  const story=kind==='story';
  return <section className="resultsScreen"><div className="resultBurst">★</div><span>{story?'WORLD COMPLETE':'RACE COMPLETE'}</span><h2>{story?(world.id==='city'?'THE CITY SINGS AGAIN!':'THE PARADE IS MOVING!'):'FINISH LINE!'}</h2><p>{story?(String(world.reward)+' coins earned. Your progress is saved.'):'50 coins earned. Race progress saved.'}</p><div className="resultButtons">{story&&nextWorld&&<button className="cta continueResult" onClick={onContinue}>CONTINUE TO {nextWorld.title.toUpperCase()} →</button>}{story&&!nextWorld&&<button className="cta continueResult" onClick={onContinue}>BACK TO STORY ROAD →</button>}<button className="ghost" onClick={onAgain}>{story?'REPLAY WORLD':'RACE AGAIN'}</button><button className="ghost" onClick={onHome}>HOME</button></div></section>
}

function ProgressDots({total,step,pulse=-1,listening=false}:any){return <div className="progressDots">{Array.from({length:total},(_:any,i:number)=><i key={i} className={(i<step?'done ':'')+(listening&&i===pulse?'pulse':'')}/>)}</div>}
function PianoKeys({onKey,disabled=false,highlight=-1}:any){return <div className={'keys '+(disabled?'disabled':'')}>{NOTES.map((n,i)=><button key={n} disabled={disabled} className={highlight===i?'hint':''} onPointerDown={()=>onKey(i)} style={{'--key':COLORS[i]}}><span>{n}</span></button>)}</div>}

function CarGraphic({accent}:any){
  const car=CARS.find(c=>c.accent===accent)||CARS[0];
  return <div className="carArt" style={{'--accent':car.accent}}><div className="carGlow"/><img className="carImage" src={car.image} alt="" draggable="false"/></div>
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
