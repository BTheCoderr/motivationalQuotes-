declare const React: any;
declare const ReactDOM: any;
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }

const {useEffect,useMemo,useRef,useState}=React;
const NOTES=['C','D','E','F'];
const FREQ=[261.63,293.66,329.63,349.23];
const COLORS=['#ff3f86','#ffd62f','#48db3f','#a34bf4'];
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
      {id:'lights',title:'Wake the Lights',icon:'💡',pattern:[0,0,0,0],line:"Let's wake the lights.",success:'Whoa... the lights are waking up!'},
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
function speak(_text:string){
  // Browser speech synthesis is intentionally disabled. It sounded robotic on iPhone.
  // Guide voice calls remain in the story flow so we can replace them with real audio assets later.
}

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
  useEffect(()=>(()=>{clearTimers();stopBeat()}),[]);
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
    {screen==='home'&&<Home coins={coins} progress={progress} hasContinue={hasContinue} continueWorld={continueWorld} continueScene={continueScene} onContinue={continueAdventure} onTwin={()=>startStory('twin',0,0)} onStory={()=>setScreen('map')} onRace={startRace} onPiano={()=>{setScreen('piano');startBeat('piano')}} onGarage={()=>setScreen('garage')} />}
    {screen==='map'&&<WorldMap progress={progress} onWorld={openWorldStory} onBack={goHome} onGarage={()=>setScreen('garage')} />}
    {screen==='story'&&<StoryIntro world={world} completed={progress.completedWorlds.includes(world.id)} onStart={()=>startStory('story',worldIndex,0)} onBack={()=>setScreen('map')} onGarage={()=>setScreen('garage')} />}
    {screen==='play'&&<PlayScreen mode={playMode} world={world} scene={scene} sceneIndex={sceneIndex} step={step} phase={memoryPhase} pulse={pulse} message={message} car={car} onKey={hitStory} onHome={goHome} onGarage={()=>setScreen('garage')} />}
    {screen==='race'&&<RaceScreen pattern={racePattern} step={raceStep} score={raceScore} combo={raceCombo} car={car} onKey={hitRace} onHome={goHome} onGarage={()=>setScreen('garage')} />}
    {screen==='piano'&&<PianoScreen onKey={pianoHit} onHome={goHome} onGarage={()=>setScreen('garage')} />}
    {screen==='garage'&&<Garage selected={selectedCar} stars={progress.stars} races={progress.races} onSelect={setSelectedCar} onBack={goHome} />}
    {screen==='results'&&<Results kind={resultKind} world={WORLDS[resultWorld]} nextWorld={resultNextWorld===null?null:WORLDS[resultNextWorld]} mode={playMode} onContinue={continueAfterResult} onAgain={()=>resultKind==='race'?startRace():startStory(playMode,resultWorld,0)} onHome={goHome} />}
  </main>
}


function KidLogo({small=false}:any){
  return <div className={'kidLogo '+(small?'small':'')} aria-label="CarKeys">
    <i>♪</i><span className="l1">C</span><span className="l2">a</span><span className="l3">r</span><span className="l4">K</span><span className="l5">e</span><span className="l6">y</span><span className="l7">s</span><b>♪</b>
    <em><u/><u/><u/></em>
  </div>
}

function TopBar({coins,stars,backend,onHome,compact}:any){
  return <header className={'top '+(compact?'compact':'')}>
    <button className="brand" onClick={onHome} aria-label="CarKeys home"><KidLogo small/></button>
    <div className="topMeta"><span className={'cloud '+backend}>● {backend==='online'?'READY':backend==='checking'?'CONNECTING':'OFFLINE'}</span><span className="starsMeta">⭐ {stars}</span><span className="coins">🪙 {coins}</span></div>
  </header>
}

function Home({coins,progress,hasContinue,continueWorld,continueScene,onContinue,onTwin,onStory,onRace,onPiano,onGarage}:any){
  return <section className="ckHome">
    <div className="ckSky">
      <div className="statPill star">⭐ <b>{progress.stars}</b></div>
      <div className="statPill coin">🪙 <b>{coins}</b></div>
      <button className="gearBtn" aria-label="Settings">⚙</button>
      <KidLogo/>
      <span className="floatNote n1">♪</span><span className="floatNote n2">♫</span><span className="floatNote n3">♪</span>
      <div className="cityMusicSign">CITY<br/><small>of</small><br/>MUSIC</div>
      <div className="cityWorld">
        <div className="cityBlocks"><i/><i/><i/><i/><i/><i/><i/></div>
        <div className="musicArch">♪</div>
        <div className="homeTrack"><span/><span/><span/></div>
        <div className="homeCar"><CarGraphic accent="#23a8ff"/></div>
        <div className="collectibles"><i>🪙</i><i>🪙</i><i>★</i></div>
      </div>
    </div>

    <div className="ckHomeMenu">
      <button className="megaPlay" onClick={hasContinue?onContinue:onTwin}>
        <span className="playDisc">▶</span>
        <strong>{hasContinue?'CONTINUE ADVENTURE':'PLAY'}</strong>
        {hasContinue&&<small>{continueWorld.title} · {continueScene.title}</small>}
      </button>

      <div className="modeGrid topModes">
        <button className="modeTile twin" onClick={onTwin}><span>🚙🚗</span><b>TWIN MODE</b></button>
        <button className="modeTile story" onClick={onStory}><span>📖</span><b>STORY MODE</b></button>
      </div>
      <div className="modeGrid bottomModes">
        <button className="modeTile race" onClick={onRace}><span>🏁</span><b>RACE</b></button>
        <button className="modeTile piano" onClick={onPiano}><span>🎹</span><b>PIANO PLAY</b></button>
        <button className="modeTile garageTile" onClick={onGarage}><span>🏠</span><b>GARAGE</b></button>
      </div>
    </div>
  </section>
}

function WorldMap({progress,onWorld,onBack,onGarage}:any){
  const cityDone=progress.completedWorlds.includes('city'),forestDone=progress.completedWorlds.includes('forest');
  return <section className="ckMap">
    <div className="mapHead"><button className="roundBack" onClick={onBack}>←</button><KidLogo small/><button className="purpleGarage" onClick={onGarage}>🏠<small>Garage</small></button></div>
    <div className="mapRoad">
      <div className="mapIsland cityIsland">
        <div className="mapCity"><div className="tinyCar"><CarGraphic accent="#23a8ff"/></div><span className="mapArch">♪</span></div>
        <button className="worldCard cityCard" onClick={()=>onWorld(0)}>
          <b>CITY OF <em>MUSIC</em></b>
          <span className="worldStars">{cityDone?'⭐⭐⭐':'⭐⭐☆'}</span>
          <i>{cityDone?'REPLAY':'PLAY'} ▶</i>
        </button>
      </div>
      <div className="mapConnector"><i/><i/></div>
      <div className="mapIsland forestIsland">
        <div className="forestArt"><span>🌳</span><b>🦌</b><b>🦉</b><i>♪</i></div>
        <button className={'worldCard forestCard '+(cityDone?'open':'locked')} onClick={()=>cityDone&&onWorld(1)}>
          <b>RHYTHM <em>FOREST</em></b>
          <span className="worldStars">{forestDone?'⭐⭐⭐':'☆☆☆'}</span>
          <i>{cityDone?(forestDone?'REPLAY':'PLAY ▶'):'🔒'}</i>
        </button>
      </div>
      <div className="mapConnector snow"><i/><i/></div>
      <div className="mapIsland mountainIsland">
        <div className="mountainArt">⛰️</div>
        <div className="worldCard mountainCard locked"><b>NUMBER <em>MOUNTAIN</em></b><span className="worldStars">☆☆☆</span><i>🔒 COMING SOON</i></div>
      </div>
    </div>
  </section>
}

function StoryIntro({world,completed,onStart,onBack,onGarage}:any){
  return <section className={'ckStoryIntro theme-'+world.theme}>
    <div className="mapHead"><button className="roundBack" onClick={onBack}>←</button><KidLogo small/><button className="purpleGarage" onClick={onGarage}>🏠<small>Garage</small></button></div>
    <div className="storyHero">
      <div className="storyWorldIcon">{world.icon}</div>
      <span>STORY {String(world.number).padStart(2,'0')}</span>
      <h2>{world.title.toUpperCase()}</h2>
      <h3>{world.storyTitle}</h3>
      <div className="chapterRoad">{world.scenes.map((s:any,i:number)=><i key={s.id}><b>{s.icon}</b><small>{i+1}</small></i>)}</div>
      <button className="megaPlay storyPlay" onClick={onStart}><span className="playDisc">▶</span><strong>{completed?'PLAY AGAIN':'START STORY'}</strong></button>
    </div>
  </section>
}

function PlayScreen({mode,world,scene,sceneIndex,step,phase,pulse,message,car,onKey,onHome,onGarage}:any){
  const memory=scene.memory;
  const next=NOTES[scene.pattern[Math.min(step,scene.pattern.length-1)]];
  return <section className={'ckPlay theme-'+world.theme}>
    <div className="gameHead"><KidLogo small/><button className="purpleGarage" onClick={onGarage}>🏠<small>Garage</small></button></div>
    <div className="missionBoard">
      <div className="missionPic">{scene.icon}</div>
      <div className="missionWords">
        <h2>{scene.title.toUpperCase()}</h2>
        {memory
          ? <div className={'tapPrompt '+phase}>{phase==='listen'?'👂 LISTEN':'🎹 COPY IT!'}</div>
          : <div className="tapPrompt">{message||<>TAP <b>{next}</b></>}</div>}
        <ProgressDots total={scene.pattern.length} step={step} pulse={pulse} listening={memory&&phase==='listen'} />
      </div>
    </div>
    <div className="gameWorldWrap">
      <button className="pauseOrb" onClick={onHome}>Ⅱ</button>
      <div className="worldSign">{world.title}</div>
      <WorldStage key={world.id+'-'+scene.id} world={world} scene={scene} step={step} pulse={pulse} phase={phase} car={car}/>
    </div>
    <PianoKeys onKey={onKey} disabled={memory&&phase==='listen'} highlight={!memory?scene.pattern[Math.min(step,scene.pattern.length-1)]:-1}/>
  </section>
}



function WorldStage({world,scene,step,pulse,phase,car}:any){
  const forest=world.theme==='forest';
  return <div className={'worldStage ckWorld moving scene-'+scene.id+' step-'+step+' '+(forest?'forestStage':'cityStage')}>
    <div className="worldSky"><div className={forest?'forestBack':'cityBack'}/></div>
    <div className="musicDecor"><i>♪</i><i>♫</i><i>♪</i></div>
    <div className="road3d"><div className="roadFlow"/><span className="edge left"/><span className="edge right"/></div>
    <div className="motionCoins"><i>🪙</i><i>🪙</i><i>🪙</i></div>

    {scene.id==='lights'&&<div className="streetlights">{[0,1,2,3].map(i=><span key={i} className={i<step?'on':''}><i/><b style={{background:COLORS[i]}}>{NOTES[i]}</b></span>)}</div>}
    {scene.id==='bridge'&&<div className={'bridge '+(step>=2?'leftOpen ':'')+(step>=4?'rightOpen':'')}><span className="tower left"/><span className="deck left"/><span className="water">⛵　⛵</span><span className="deck right"/><span className="tower right"/></div>}
    {scene.id==='tunnel'&&<div className="tunnel">{[0,1,2,3].map(i=><span key={i} className={(phase==='listen'?i===pulse:i<step)?'lit':''} style={{'--c':COLORS[i]}} />)}</div>}
    {scene.id==='home'&&<div className="restoreCity"><span className={step>=1?'on':''}>♪</span><div className={'windows '+(step>=2?'on':'')}>▦ ▦ ▦</div><div className={'speaker '+(step>=3?'on':'')}>◉</div><div className={'musicBurst '+(step>=4?'on':'')}>♪ ♫ ★</div></div>}

    {forest&&<div className="forestScene">
      {scene.id==='rabbit'&&<><span className="animal big">🐇</span><div className="beatTrail">{scene.pattern.map((_:any,i:number)=><i key={i} className={i<step?'on':''}/>)}</div></>}
      {scene.id==='woodpecker'&&<><span className="animal bird">🐦</span><div className="workSign">{[0,1,2,3].map(i=><i key={i} className={i<step?'on':''}>★</i>)}</div></>}
      {scene.id==='owl'&&<><span className="animal owl">🦉</span><div className="fireflies">{scene.pattern.map((_:any,i:number)=><i key={i} className={(phase==='listen'?i===pulse:i<step)?'on':''} style={{'--c':COLORS[i]}}/>)}</div></>}
      {scene.id==='parade'&&<div className="parade">{['🐇','🐦','🦉','🦊','🦌','🐿️'].map((a,i)=><span key={i} className={i<step?'on':''}>{a}</span>)}</div>}
    </div>}
    <div className="playerCar" key={scene.id+'-'+step}><CarGraphic accent={car.accent}/></div>
  </div>
}



function RaceScreen({pattern,step,score,combo,car,onKey,onHome,onGarage}:any){
  const want=pattern[step%pattern.length];
  return <section className="ckPlay raceMode">
    <div className="gameHead"><KidLogo small/><button className="purpleGarage" onClick={onGarage}>🏠<small>Garage</small></button></div>
    <div className="raceMission"><span>🏁 {Math.min(step+1,pattern.length)}/{pattern.length}</span><b>NEXT <em style={{color:COLORS[want]}}>{NOTES[want]}</em></b><small>⭐ {score}</small></div>
    <div className="gameWorldWrap"><button className="pauseOrb" onClick={onHome}>Ⅱ</button><div className="worldSign">City of Music</div>
      <div className="worldStage ckWorld moving scene-race"><div className="worldSky"><div className="cityBack"/></div><div className="musicDecor"><i>♪</i><i>♫</i><i>★</i></div><div className="road3d"><div className="roadFlow fast"/></div><div className="motionCoins fast"><i>🪙</i><i>🪙</i><i>🪙</i></div><div className="playerCar raceCar" key={'race-'+step}><CarGraphic accent={car.accent}/></div></div>
    </div>
    <PianoKeys onKey={onKey} highlight={want}/>
  </section>
}

function PianoScreen({onKey,onHome,onGarage}:any){
  return <section className="ckPlay pianoMode">
    <div className="gameHead"><KidLogo small/><button className="purpleGarage" onClick={onGarage}>🏠<small>Garage</small></button></div>
    <div className="raceMission freeMission"><b>🎹 FREE PLAY</b><small>MAKE THE ROAD SING</small></div>
    <div className="gameWorldWrap"><button className="pauseOrb" onClick={onHome}>⌂</button><div className="worldSign">City of Music</div>
      <div className="pianoStage ckWorld"><div className="worldSky"><div className="cityBack"/></div><div className="soundRings"><i/><i/><i/></div><div className="pianoCar"><CarGraphic accent="#23a8ff"/></div></div>
    </div>
    <PianoKeys onKey={onKey}/>
  </section>
}

function Garage({selected,stars,races,onSelect,onBack}:any){
  const unlocked=(i:number)=>i===0||(i===1&&races>=1)||(i===2&&stars>=6)||(i===3&&stars>=10);
  return <section className="ckGarage">
    <div className="garageHeader"><div className="garageTitle">★ GARAGE ♪</div><button className="garageDone" onClick={onBack}>← DONE</button></div>
    <div className="garageCards">
      {CARS.map((car,i)=>{
        const open=unlocked(i),equipped=selected===car.id;
        return <button key={car.id} className={'carCard '+car.id+' '+(!open?'locked':'')} onClick={()=>open&&onSelect(car.id)} disabled={!open}>
          <h3>{car.name}</h3><small>{car.rarity} · Speed {car.speed} · Boost {car.boost}</small>
          <div className="cardCar"><CarGraphic accent={car.accent}/></div>
          <b className={equipped?'equipped':''}>{equipped?'✓ EQUIPPED':open?'DRIVE THIS CAR':'🔒 '+car.unlock}</b>
        </button>
      })}
    </div>
    <div className="paintBar"><b>🖌️ PAINT</b><div>{['#ff4f9a','#53d5ff','#ffd44f','#65e63d','#fff','#a952ef'].map(x=><i key={x} style={{background:x}}/>)}</div></div>
    <div className="garageProgress">⭐ {stars}　🏁 {races}</div>
  </section>
}

function Results({kind,world,nextWorld,onContinue,onAgain,onHome}:any){
  const story=kind==='story';
  return <section className="ckResults">
    <KidLogo small/>
    <div className="resultStar">★</div>
    <span>{story?'WORLD COMPLETE':'RACE COMPLETE'}</span>
    <h2>{story?(world.id==='city'?'THE CITY SINGS AGAIN!':'THE PARADE IS MOVING!'):'FINISH LINE!'}</h2>
    <p>{story?(String(world.reward)+' coins earned!'):'50 coins earned!'}</p>
    {story&&nextWorld&&<button className="megaPlay resultContinue" onClick={onContinue}><span className="playDisc">▶</span><strong>NEXT ADVENTURE</strong></button>}
    {story&&!nextWorld&&<button className="megaPlay resultContinue" onClick={onContinue}><span className="playDisc">▶</span><strong>STORY ROAD</strong></button>}
    <div className="resultMini"><button onClick={onAgain}>↻ PLAY AGAIN</button><button onClick={onHome}>⌂ HOME</button></div>
  </section>
}


function ProgressDots({total,step,pulse=-1,listening=false}:any){return <div className="progressDots">{Array.from({length:total},(_:any,i:number)=><i key={i} className={(i<step?'done ':'')+(listening&&i===pulse?'pulse':'')}/>)}</div>}
function PianoKeys({onKey,disabled=false,highlight=-1}:any){return <div className={'keys '+(disabled?'disabled':'')}>{NOTES.map((n,i)=><button key={n} disabled={disabled} className={highlight===i?'hint':''} onPointerDown={()=>onKey(i)} style={{'--key':COLORS[i]}}><span>{n}</span><small>{['A','S','D','F'][i]}</small></button>)}</div>}
function CarGraphic({accent}:any){
  const car=CARS.find(c=>c.accent===accent)||CARS[0];
  return <div className="carArt" style={{'--accent':car.accent}}><div className="carGlow"/><img className="carImage" src={car.image} alt="" draggable="false"/></div>
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
