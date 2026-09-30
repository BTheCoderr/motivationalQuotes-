(()=>{
const STORIES=window.CARKEYS_STORIES||[];
const labels=['C','D','E','F'];
const $=id=>document.getElementById(id);
let active=false,selected=null,sceneIndex=0,step=0,locked=false,box=null,mistakes=0;
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
function cleanupStory(){
  active=false;locked=false;mistakes=0;clearGlow();stopSpeech();
  if(box)box.style.display='none';
  try{freePlay=false}catch{}
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
      '<button class="worldPlay" '+(!unlocked||story.comingSoon?'disabled':'')+'>'+status+'</button>';
    const btn=card.querySelector('button');
    if(unlocked&&!story.comingSoon)btn.onclick=()=>selectStory(story.id);
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
  box.style.display='block';
  box.innerHTML='<div class="storyMissionTop"><span>'+s.icon+' CHAPTER '+(sceneIndex+1)+'/'+selected.scenes.length+'</span><b>'+s.name.toUpperCase()+'</b></div>'+
    '<div class="storyMissionText">'+s.prompt+'</div>'+
    '<div class="storyDots">'+s.pattern.map((n,i)=>'<span class="'+(i<step?'done':i===step?'now':'')+'">'+labels[n]+'</span>').join('')+'</div>';
  clearGlow();
  if(!locked&&(s.guide||mistakes>=2)&&!s.listenFirst)glow(s.pattern[step],true);
}
function demoPattern(){
  const s=selected.scenes[sceneIndex];
  locked=true;clearGlow();
  const text=box?.querySelector('.storyMissionText');
  if(text)text.textContent=s.listenFirst?'Listen… remember the sound.':'Watch and listen. The road is giving you a clue.';
  s.pattern.forEach((n,i)=>tone(n,i*500));
  setTimeout(()=>{
    locked=false;step=0;
    if(text)text.textContent=s.listenFirst?'Your turn. Play the echo back!':s.prompt;
    renderMission();
    if(s.listenFirst)clearGlow();
  },s.pattern.length*500+450);
}
function beginScene(){
  step=0;locked=false;mistakes=0;renderMission();
  const s=selected.scenes[sceneIndex];
  musicalLine(s.prompt,s.pattern);
  if(s.listenFirst)setTimeout(demoPattern,900);
}
function celebrate(){
  const s=selected.scenes[sceneIndex];
  locked=true;clearGlow();
  try{showFlash(sceneIndex===selected.scenes.length-1?'STORY CLEAR!':'MISSION CLEAR!','#ffd166',true)}catch{}
  speak(s.success,.92,1.18);
  const text=box?.querySelector('.storyMissionText');if(text)text.textContent=s.success;
  box?.querySelectorAll('.storyDots span').forEach(x=>x.className='done');
  setTimeout(()=>{
    if(sceneIndex<selected.scenes.length-1){sceneIndex++;beginScene()}
    else finishStory();
  },2200);
}
function finishStory(){
  active=false;locked=false;clearGlow();stopSpeech();if(box)box.style.display='none';
  try{running=false;cancelAnimationFrame(raf);stopAudio()}catch{}
  const first=!isDone(selected.id);
  localStorage.setItem(doneKey(selected.id),'1');
  if(first){
    try{coins+=(selected.reward?.coins||100);saveMeta()}catch{}
  }
  try{showFlash('ADVENTURE COMPLETE!','#7df0a3',true)}catch{}
  speak(selected.finishText,.9,1.14);
  const reward=first?'🎁 <strong>'+selected.reward.label+' + '+selected.reward.coins+' coins!</strong>':'✨ <strong>Story complete!</strong>';
  setTimeout(()=>{
    $('finalScore').textContent='STORY';
    $('finalAccuracy').textContent=selected.scenes.length+'/'+selected.scenes.length;
    $('finalCombo').textContent='HERO';
    $('finalPlace').textContent='CLEAR';
    $('stars').textContent='★★★★';
    $('unlock').innerHTML=reward+' '+selected.finishText;
    $('unlock').classList.add('show');
    $('endOverlay').querySelector('h2').textContent=selected.finishTitle;
    $('endOverlay').style.display='grid';
    if(!previousAgain)previousAgain=$('againBtn').onclick;
    $('againBtn').textContent='PLAY STORY AGAIN';
    $('againBtn').onclick=startSelectedStory;
    renderMap();
  },1100);
}
function storyHit(lane){
  if(!active||locked)return false;
  const s=selected.scenes[sceneIndex],want=s.pattern[step];
  try{noteSound(lane,lane===want?'perfect':'miss')}catch{}
  if(lane===want){
    glow(want,false);step++;
    try{
      targetLane=lane;speed=Math.min(132,speed+8);score+=600;boost=Math.min(100,boost+8);
      updateHud();buzz(18);
    }catch{}
    if(step>=s.pattern.length)celebrate();else renderMission();
  }else{
    mistakes++;
    try{showFlash(mistakes>=2?'HERE’S A CLUE':'LISTEN AGAIN','#67e8ff',false);buzz(25)}catch{}
    step=0;renderMission();
    if(s.listenFirst||mistakes>=2)setTimeout(demoPattern,450);
  }
  return true;
}
function startSelectedStory(){
  if(!selected)return;
  hideAllStoryScreens();$('homeOverlay').style.display='none';$('endOverlay').style.display='none';
  active=true;sceneIndex=0;step=0;locked=false;mistakes=0;
  $('pauseBtn').style.visibility='visible';
  try{
    tutorialMode=false;bossMode=false;freePlay=true;prepare();running=true;
    startTime=performance.now();lastT=startTime;startAudio();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
    modeBadge.textContent='STORY MODE · '+selected.mapTitle.toUpperCase();
    modeBadge.classList.add('raceTypePill');
  }catch{}
  const refrain=selected.id==='city-music'?'Keys in the night, wheels on the road. Find every sound and bring music home.':'Step with the forest, beat by beat. Help every animal find their feet.';
  musicalLine(refrain,[0,1,2,3]);
  setTimeout(beginScene,1150);
}
function bind(){
  ensureBox();
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
  renderMap();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();