window.CARKEYS_STORIES = [
  {
    id: 'city-music',
    number: 1,
    icon: '🌃',
    mapTitle: 'City of Music',
    title: 'The Night the City Lost Its Music',
    subtitle: 'Wake the city one sound at a time.',
    intro: 'The city has gone quiet. Streetlights are dark, the bridge is asleep, and the Echo Tunnel has forgotten its song.',
    theme: 'city',
    unlock: { type: 'always' },
    reward: { coins: 150, label: 'City Story Star' },
    finishTitle: 'THE CITY SINGS AGAIN 🌃🎶',
    finishText: 'You brought the music home. The whole city can sing again!',
    scenes: [
      { name:'Wake the Streetlights', icon:'💡', skill:'steady beat', prompt:'The streetlights are asleep. Give them four steady sparks.', pattern:[0,0,0,0], success:'Four sparks! The whole block is glowing.', guide:true },
      { name:'Open the Bridge', icon:'🌉', skill:'sequence', prompt:'The bridge remembers two sounds. Build its code in order.', pattern:[0,1,0,1], success:'C-D, C-D! The bridge is moving again.', guide:true },
      { name:'Echo Tunnel', icon:'🔊', skill:'auditory memory', prompt:'The tunnel will sing once. Listen, remember, then answer it.', pattern:[0,1,2,1], success:'You remembered the echo. The tunnel found its voice!', listenFirst:true },
      { name:'Bring Music Home', icon:'✨', skill:'pattern transfer', prompt:'One last melody can wake the whole city. Bring every sound home.', pattern:[0,1,2,3], success:'C-D-E-F! The city has its music back.', guide:false }
    ]
  },
  {
    id: 'rhythm-forest',
    number: 2,
    icon: '🌲',
    mapTitle: 'Rhythm Forest',
    title: 'The Animals Forgot the Beat',
    subtitle: 'Help the forest remember how to move together.',
    intro: 'The animals are ready for the Moonlight Parade, but everyone forgot their rhythm. The road through the forest only opens when the beats fit together.',
    theme: 'forest',
    unlock: { type:'story', id:'city-music' },
    reward: { coins: 200, label: 'Forest Rhythm Badge' },
    finishTitle: 'THE PARADE IS MOVING 🌲🥁',
    finishText: 'You brought the animals back together. The whole forest found the beat!',
    scenes: [
      { name:'Rabbit Steps', icon:'🐇', skill:'counting in twos', prompt:'Rabbit moves two steps at a time. Give him two matching beats, twice.', pattern:[0,0,1,1], success:'Two and two! Rabbit is back on the trail.', guide:true },
      { name:'Woodpecker Workshop', icon:'🐦', skill:'counting in fours', prompt:'The woodpecker needs four even knocks to fix the parade sign.', pattern:[2,2,2,2], success:'Four clean knocks. The sign is fixed!', guide:true },
      { name:'Owl Says', icon:'🦉', skill:'working memory', prompt:'Owl has a secret night rhythm. Listen first, then copy it.', pattern:[0,2,1,2], success:'You copied Owl perfectly. The moon path is open!', listenFirst:true },
      { name:'Moonlight Parade', icon:'🦊', skill:'grouping + sequence', prompt:'Everybody has a part. Put the animal beats together and lead the parade.', pattern:[0,0,1,2,2,3], success:'The rhythm fits! The Moonlight Parade can begin.', guide:false }
    ]
  },
  {
    id:'number-mountain',
    number:3,
    icon:'⛰️',
    mapTitle:'Number Mountain',
    title:'The Missing Lift Codes',
    subtitle:'Coming next: patterns, groups, and number missions.',
    intro:'The mountain lifts have lost their number codes.',
    theme:'mountain',
    comingSoon:true,
    unlock:{type:'story',id:'rhythm-forest'}
  },
  {
    id:'word-harbor',
    number:4,
    icon:'⚓',
    mapTitle:'Word Harbor',
    title:'The Harbor of Mixed-Up Words',
    subtitle:'Coming next: sounds, rhymes, and word clues.',
    intro:'The harbor signs have scrambled their sounds.',
    theme:'harbor',
    comingSoon:true,
    unlock:{type:'story',id:'number-mountain'}
  },
  {
    id:'space-beat',
    number:5,
    icon:'🚀',
    mapTitle:'Space Beat',
    title:'The Lost Signal',
    subtitle:'Coming next: memory, logic, and musical codes.',
    intro:'A signal from deep space needs a musical decoder.',
    theme:'space',
    comingSoon:true,
    unlock:{type:'story',id:'word-harbor'}
  }
];