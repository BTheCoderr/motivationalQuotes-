(()=>{
const STORIES=window.CARKEYS_STORIES||[];
const labels=['C','D','E','F'];
const $=id=>document.getElementById(id);
let active=false,selected=null,sceneIndex=0,step=0,locked=false,box=null,mistakes=0,runToken=0,twinMode=false,memoryPhase='idle';
let previousAgain=null;

function doneKey(id){return 'carkeys-story-done-'+id}
function isDone(id){return localStorage.getItem(doneKey(id))==='1'}
function isUnlocked(story){
  if(!story||!story.unlock||story.unlock.type==='always')return true;
  if(story.unlock.type==='story')return isDone(story.unlock.id);
  return false;
}
function stopSpeech(){try{speechSynthesis.cancel()}catch{}}
function speak(text,rate=.92,pitch=1.1){
  if(!text)return;
  try{
    stopSpeech();
    const u=new SpeechSynthesisUtterance(text);
    u.rate=rate;u.pitch=pitch;u.volume=.92;
    speechSynthesis.speak(u);
  }catch{}
}
function tone(lane,delay=0){
  setTimeout(()=>{try{noteSound(lane,'perfect')}catch{}},delay);
}
function musicalLine(text,pattern=[0,1,2,3]){
  pattern.slice(0,4).forEach((lane,i)=>tone(lane,i*360));
  setTimeout(()=>speak(text,.9,1.15),120);
}
function ensureBox(){
  if(box)return;
  box=document.createElement('div');
  box.className='storyMission';
  box.style.display='none';
  document.getElementById('stage').appendChild(box);
}
function clearGlow(){
  document.querySelectorAll('.pianoKey').forEach(k=>k.classList.remove('storyHint'));
}
function glow(lane,on=true){
  const k=document.querySelector('.pianoKey[data-lane="'+lane+'"]');
  if(k)k.classList.toggle('storyHint',on);
}
function hideAllStoryScreens(){
  if($('worldMapOverlay'))$('worldMapOverlay').style.display='none';
  if($('storyOverlay'))$('storyOverlay').style.display='none';
}
function restoreGameChrome(){
  window.CARKEYS_STORY_UI=null;
  memoryPhase='idle';
  document.body.classList.remove('storyPlaying','storyListening');
  if($('songSelect'))$('songSelect').style.display='';
  if($('storyFooter'))$('storyFooter').style.display='none';
  if($('boostLabel'))$('boostLabel').textContent='BOOST';
  if($('sourceLabel'))$('sourceLabel').style.display='';
  if($('modeBadge'))$('modeBadge').style.display='';
  document.querySelector('.bottom')?.classList.remove('storyMode');
  try{updateHud()}catch{}
}
function syncStoryChrome(){
  if(!active||!selected)return;
  const s=selected.scenes[sceneIndex];
  const short=(selected.mapTitle||'STORY').replace(/\s+/g,' ').toUpperCase();
  window.CARKEYS_STORY_UI={
    active:true,
    chapter:(sceneIndex+1)+'/'+selected.scenes.length,
    pattern:s.listenFirst&&memoryPhase==='listen'?'LISTEN':Math.min(step,s.pattern.length)+'/'+s.pattern.length,
    worldShort:short.length>10?short.split(' ')[0]:short
  };
  if($('songSelect'))$('songSelect').style.display='none';
  if($('storyFooter')){
    $('storyFooter').style.display='flex';
    $('storyFooterWorld').textContent=selected.mapTitle.toUpperCase();
    $('storyFooterChapter').textContent='STORY '+String(selected.number||1).padStart(2,'0')+' · ADVENTURE IN PROGRESS';
  }
  if($('boostLabel'))$('boostLabel').textContent='MUSIC';
  if($('sourceLabel'))$('sourceLabel').style.display='none';
  if($('modeBadge'))$('modeBadge').style.display='none';
  document.body.classList.add('storyPlaying');
  document.querySelector('.bottom')?.classList.add('storyMode');
  try{updateHud()}catch{}
}
function setStoryRoadPattern(){
  if(!active||!selected)return;
  const s=selected.scenes[sceneIndex];
  if(s.listenFirst&&!twinMode){try{notes=[]}catch{};return}
  let elapsed=0;
  try{elapsed=Math.max(0,performance.now()-startTime)}catch{}
  const base=elapsed+(twinMode?900:1050);
  try{
    if(twinMode){
      notes=step<s.pattern.length?[{time:base,lane:s.pattern[step],hit:false,missed:false,id:'twin-'+sceneIndex+'-'+step}]:[];
    }else{
      notes=s.pattern.map((lane,i)=>({time:base+i*640,lane,hit:i<step,missed:false,id:'story-'+sceneIndex+'-'+i}));
    }
  }catch{}
}
function cleanupStory(){
  runToken++;active=false;locked=false;mistakes=0;clearGlow();stopSpeech();
  if(box){box.style.display='none';box.classList.remove('twinMission')}
  try{notes=[];freePlay=false}catch{}
  twinMode=false;window.CARKEYS_TWIN_MODE=false;document.body.classList.remove('twinPlaying');
  restoreGameChrome();
  if(previousAgain&&$('againBtn'))$('againBtn').onclick=previousAgain;
  if($('againBtn'))$('againBtn').textContent='RACE AGAIN';
}
function openMap(){
  cleanupStory();
  $('homeOverlay').style.display='none';
  $('startOverlay').style.display='none';
  $('endOverlay').style.display='none';
  $('storyOverlay').style.display='none';
  renderMap();
  $('worldMapOverlay').style.display='grid';
  $('pauseBtn').style.visibility='hidden';
}
function renderMap(){
  const map=$('worldMap');if(!map)return;
  map.innerHTML='';
  STORIES.forEach((story,i)=>{
    const unlocked=isUnlocked(story),complete=isDone(story.id);
    const card=document.createElement('div');
    card.className='worldCard '+(!unlocked?'locked ':'')+(complete?'complete ':'')+(story.comingSoon?'soon ':'');
    const status=complete?'✓ COMPLETE':story.comingSoon?'COMING SOON':unlocked?'PLAY STORY':'LOCKED';
    const lockCopy=!unlocked&&story.unlock?.type==='story'?'Finish the previous world first.':'';
    card.innerHTML='<div class="worldRoad">'+story.icon+'</div>'+
      '<div class="worldNum">WORLD '+story.number+'</div>'+
      '<h3>'+story.mapTitle+'</h3>'+
      '<p>'+story.subtitle+'</p>'+
      (lockCopy?'<small>'+lockCopy+'</small>':'')+
      '<button class="worldPlay">'+status+'</button>';
    const btn=card.querySelector('button');
    btn.onclick=()=>{
      if(!unlocked){try{toast('Finish the previous world first 🔒')}catch{};return}
      if(story.comingSoon){try{toast('This road is still being built 🚧')}catch{};return}
      selectStory(story.id);
    };
    map.appendChild(card);
    if(i<STORIES.length-1){
      const road=document.createElement('div');road.className='mapConnector';road.textContent='•••';map.appendChild(road);
    }
  });
}
function selectStory(id){
  const story=STORIES.find(s=>s.id===id);
  if(!story||!isUnlocked(story)){try{toast('Finish the previous world first 🔒')}catch{}return}
  if(story.comingSoon){try{toast('This road is still being built 🚧')}catch{}return}
  selected=story;
  $('worldMapOverlay').style.display='none';
  $('storyEyebrow').textContent='STORY '+String(story.number).padStart(2,'0')+' · '+story.mapTitle.toUpperCase();
  $('storyTitle').innerHTML=story.title.toUpperCase().replace(/ (THE|ITS|A|OF) /,'<br>$&').replace(story.mapTitle.toUpperCase(),'<span>'+story.mapTitle.toUpperCase()+'</span>');
  $('storyIntro').textContent=story.intro;
  $('storyChapters').innerHTML=(story.scenes||[]).map((s,i)=>
    '<div><b>'+s.icon+' '+(i+1)+' · '+s.name.toUpperCase()+'</b><small>'+storySceneMissionCopy(s)+'</small></div>'
  ).join('');
  $('storyStartBtn').textContent=isDone(story.id)?'PLAY AGAIN':'START THE STORY';
  $('storyOverlay').style.display='grid';
}
function storySceneMissionCopy(scene){
  if(scene.listenFirst)return 'Listen. Remember. Answer.';
  if(scene.skill==='counting in twos')return 'Move in pairs.';
  if(scene.skill==='counting in fours')return 'Build four steady beats.';
  return scene.prompt;
}
function renderMission(){
  ensureBox();
  const s=selected.scenes[sceneIndex];
  const memoryMode=!!s.listenFirst;
  box.style.display='block';
  box.classList.toggle('twinMission',twinMode);
  if(twinMode){
    const next=step<s.pattern.length?labels[s.pattern[step]]:'★';
    box.innerHTML='<div class="twinMissionIcon">'+s.icon+'</div>'+
      '<div class="twinMissionTitle">'+s.name.toUpperCase()+'</div>'+
      '<div class="twinMissionText">'+(locked?'LISTEN…':'TAP <b>'+next+'</b>')+'</div>';
  }else if(memoryMode){
    const listening=memoryPhase==='listen';
    box.innerHTML='<div class="storyMissionTop"><span>'+s.icon+' CHAPTER '+(sceneIndex+1)+'/'+selected.scenes.length+'</span><b>'+s.name.toUpperCase()+'</b></div>'+
      '<div class="memoryState '+(listening?'listen':'repeat')+'">'+(listening?'👂 LISTEN':'🎹 YOUR TURN')+'</div>'+
      '<div class="storyMissionText">'+(listening?'Remember the 4 sounds.':'Play the 4 sounds back.')+'</div>'+
      '<div class="storyDots memoryDots">'+s.pattern.map((n,i)=>'<span class="'+(!listening&&i<step?'done':'')+'">•</span>').join('')+'</div>';
  }else{
    box.innerHTML='<div class="storyMissionTop"><span>'+s.icon+' CHAPTER '+(sceneIndex+1)+'/'+selected.scenes.length+'</span><b>'+s.name.toUpperCase()+'</b></div>'+
      '<div class="storyMissionText">'+s.prompt+'</div>'+
      '<div class="storyDots">'+s.pattern.map((n,i)=>'<span class="'+(i<step?'done':i===step?'now':'')+'">'+labels[n]+'</span>').join('')+'</div>';
  }
  clearGlow();syncStoryChrome();
  if(!locked&&(twinMode||s.guide||mistakes>=2)&&(!s.listenFirst||twinMode)&&step<s.pattern.length)glow(s.pattern[step],true);
}
function demoPattern(){
  if(!active||!selected)return;
  const token=runToken,s=selected.scenes[sceneIndex];
  locked=true;memoryPhase=s.listenFirst?'listen':'idle';clearGlow();
  document.body.classList.toggle('storyListening',!!s.listenFirst);
  try{notes=[]}catch{}
  renderMission();
  const dots=()=>box?.querySelectorAll('.memoryDots span')||[];
  s.pattern.forEach((n,i)=>{
    setTimeout(()=>{
      if(!active||token!==runToken)return;
      const all=dots();all.forEach(x=>x.classList.remove('now'));
      if(all[i])all[i].classList.add('now');
      tone(n,0);
    },i*560);
  });
  setTimeout(()=>{
    if(!active||token!==runToken)return;
    locked=false;step=0;memoryPhase=s.listenFirst?'repeat':'idle';
    document.body.classList.remove('storyListening');
    renderMission();setStoryRoadPattern();
    if(s.listenFirst)clearGlow();
  },s.pattern.length*560+500);
}
function beginScene(){
  if(!active||!selected)return;
  step=0;mistakes=0;
  const s=selected.scenes[sceneIndex];
  memoryPhase=s.listenFirst?'listen':'idle';
  locked=!!s.listenFirst;
  renderMission();
  if(s.listenFirst){try{notes=[]}catch{}}
  else setStoryRoadPattern();
  if(twinMode){
    speak(s.listenFirst?'Listen first. Then copy the sounds.':s.name+'. Tap '+labels[s.pattern[0]]+'.',.92,1.12);
  }else if(!s.listenFirst){
    musicalLine(s.prompt,s.pattern);
  }
  if(s.listenFirst)setTimeout(demoPattern,twinMode?450:650);
}
function celebrate(){
  if(!active||!selected)return;
  const token=runToken,s=selected.scenes[sceneIndex];
  locked=true;clearGlow();step=s.pattern.length;syncStoryChrome();try{notes=[]}catch{}
  try{showFlash(sceneIndex===selected.scenes.length-1?'STORY CLEAR!':'MISSION CLEAR!','#ffd166',true)}catch{}
  speak(s.success,.92,1.18);
  const text=box?.querySelector('.storyMissionText');if(text)text.textContent=s.success;
  box?.querySelectorAll('.storyDots span').forEach(x=>x.className='done');
  setTimeout(()=>{
    if(!active||token!==runToken)return;
    if(sceneIndex<selected.scenes.length-1){sceneIndex++;beginScene()}
    else finishStory();
  },twinMode?1050:2200);
}
function finishStory(){
  active=false;locked=false;clearGlow();stopSpeech();if(box)box.style.display='none';
  try{running=false;cancelAnimationFrame(raf);stopAudio()}catch{}
  const first=!isDone(selected.id);
  localStorage.setItem(doneKey(selected.id),'1');
  if(first){
    try{coins+=(selected.reward?.coins||100);saveMeta()}catch{}
  }
  try{showFlash(twinMode?'YOU DID IT!':'ADVENTURE COMPLETE!','#7df0a3',true)}catch{}
  speak(twinMode?'You did it! You brought the music back!':selected.finishText,.9,1.14);
  const reward=first?'🎁 <strong>'+selected.reward.label+' + '+selected.reward.coins+' coins!</strong>':'✨ <strong>Story complete!</strong>';
  setTimeout(()=>{
    $('finalScore').textContent='STORY';
    $('finalAccuracy').textContent=selected.scenes.length+'/'+selected.scenes.length;
    $('finalCombo').textContent='HERO';
    $('finalPlace').textContent='CLEAR';
    $('stars').textContent='★★★★';
    $('unlock').innerHTML=twinMode?(reward+' You saved the city!'):(reward+' '+selected.finishText);
    $('unlock').classList.add('show');
    $('endOverlay').querySelector('h2').textContent=twinMode?'YOU SAVED THE CITY! 🌟':selected.finishTitle;
    $('endOverlay').style.display='grid';
    if(!previousAgain)previousAgain=$('againBtn').onclick;
    $('againBtn').textContent=twinMode?'PLAY AGAIN':'PLAY STORY AGAIN';
    $('againBtn').onclick=startSelectedStory;
    renderMap();
  },twinMode?700:1100);
}
function storyHit(lane){
  if(!active||locked)return false;
  try{if(!running||paused)return false}catch{}
  const s=selected.scenes[sceneIndex],want=s.pattern[step];
  try{noteSound(lane,lane===want?'perfect':'miss')}catch{}
  if(lane===want){
    glow(want,false);
    try{if(notes&&notes[step])notes[step].hit=true}catch{}
    step++;
    try{
      targetLane=lane;speed=Math.min(132,speed+8);score+=600;boost=Math.min(100,boost+8);
      updateHud();buzz(18);
    }catch{}
    if(step>=s.pattern.length)celebrate();else{renderMission();setStoryRoadPattern()}
  }else{
    mistakes++;
    if(twinMode){
      try{showFlash('TRY '+labels[want],'#67e8ff',false);buzz(20)}catch{}
      renderMission();setStoryRoadPattern();glow(want,true);
    }else if(s.listenFirst){
      try{showFlash('LET’S HEAR IT AGAIN','#67e8ff',false);buzz(25)}catch{}
      step=0;memoryPhase='listen';locked=true;renderMission();
      setTimeout(demoPattern,500);
    }else{
      try{showFlash(mistakes>=2?'HERE’S A CLUE':'TRY AGAIN','#67e8ff',false);buzz(25)}catch{}
      step=0;renderMission();setStoryRoadPattern();
      if(mistakes>=2)setTimeout(demoPattern,450);
    }
  }
  return true;
}
function startSelectedStory(){
  if(!selected)return;
  runToken++;const token=runToken;
  hideAllStoryScreens();$('homeOverlay').style.display='none';$('endOverlay').style.display='none';
  active=true;sceneIndex=0;step=0;locked=false;mistakes=0;
  window.CARKEYS_TWIN_MODE=twinMode;document.body.classList.toggle('twinPlaying',twinMode);
  $('pauseBtn').style.visibility='visible';
  try{
    tutorialMode=false;bossMode=false;freePlay=true;prepare();notes=[];running=true;
    startTime=performance.now();lastT=startTime;
    window.CARKEYS_STORY_UI={active:true,chapter:'1/'+selected.scenes.length,pattern:'0/'+selected.scenes[0].pattern.length,worldShort:selected.mapTitle.toUpperCase().split(' ')[0]};
    syncStoryChrome();
    startAudio();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
    modeBadge.textContent='STORY MODE · '+selected.mapTitle.toUpperCase();
    modeBadge.classList.add('raceTypePill');
  }catch{}
  const refrain=selected.id==='city-music'?'Keys in the night, wheels on the road. Find every sound and bring music home.':'Step with the forest, beat by beat. Help every animal find their feet.';
  if(twinMode){
    speak('Let’s go! Help the city find its music.',.94,1.15);
    setTimeout(()=>{if(active&&token===runToken)beginScene()},650);
  }else{
    musicalLine(refrain,[0,1,2,3]);
    setTimeout(()=>{if(active&&token===runToken)beginScene()},1150);
  }
}
function startTwinMode(){
  if(!STORIES.length)return;
  selected=STORIES[0];twinMode=true;window.CARKEYS_TWIN_MODE=true;
  startSelectedStory();
}
function bind(){
  ensureBox();
  if($('twinModeBtn'))$('twinModeBtn').onclick=startTwinMode;
  if($('storyMenuBtn'))$('storyMenuBtn').onclick=openMap;
  if($('mapBackBtn'))$('mapBackBtn').onclick=()=>{cleanupStory();$('worldMapOverlay').style.display='none';$('homeOverlay').style.display='grid';try{updateHome()}catch{}};
  if($('storyBackBtn'))$('storyBackBtn').onclick=()=>{$('storyOverlay').style.display='none';renderMap();$('worldMapOverlay').style.display='grid'};
  if($('storyStartBtn'))$('storyStartBtn').onclick=startSelectedStory;
  document.querySelectorAll('.pianoKey').forEach(b=>b.addEventListener('pointerdown',e=>{
    if(active){e.stopImmediatePropagation();e.preventDefault();storyHit(+b.dataset.lane)}
  },true));
  window.addEventListener('keydown',e=>{
    if(!active||e.repeat)return;
    const m={a:0,s:1,d:2,f:3},lane=m[e.key.toLowerCase()];
    if(lane!==undefined){e.stopImmediatePropagation();e.preventDefault();storyHit(lane)}
  },true);
  ['homeFromPause','homeFromEnd'].forEach(id=>{
    if($(id))$(id).addEventListener('click',()=>{cleanupStory();hideAllStoryScreens()},true);
  });
  if($('pauseBtn'))$('pauseBtn').addEventListener('click',()=>{
    if(!active)return;
    setTimeout(()=>{
      if(!$('pauseModal').classList.contains('show'))return;
      $('pauseTitle').textContent='STORY PAUSED';
      $('pauseText').textContent='The adventure is waiting right here.';
      $('quitPracticeBtn').style.display='none';
    },0);
  });
  if($('restartBtn'))$('restartBtn').addEventListener('click',e=>{
    if(!active)return;
    e.preventDefault();e.stopImmediatePropagation();
    runToken++;active=false;clearGlow();stopSpeech();
    try{running=false;cancelAnimationFrame(raf);stopAudio()}catch{}
    setTimeout(startSelectedStory,20);
  },true);
  renderMap();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();