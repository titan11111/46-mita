// ===============================
// 白磁の匙 — 7エンド（数式判定）＋画像/BGM対応
// ===============================

// 画像
const BG = {
  title:      'images/ch1_title.png',
  gate:       'images/house_gate.png',
  genkan:     'images/genkan_dark.png',
  living:     'images/living_room_traditional.png',
  kitchen:    'images/kitchen_old.png',
  hallway:    'images/ch1_shoji_eavesdrop.png',
  silhouette: 'images/ch1_shoji_silhouette.png',
  spoon:      'images/ch1_porcelain_spoon.png',
  study:      'images/ch1_study_peek.png',
  dining:     'images/ch1_family_gathering.png',
  storage:    'images/ch1_storage_dryplate.png',
  mirror:     'images/ch1_mirror_crack.png',
  shrine:     'images/ch1_shrine_small.png',
  footprints: 'images/ch1_wet_footprints.png'
};

// BGM/SE
const BGM = {
  WALTZ_SOFT:   'audio/bgm_taisho_waltz_soft.mp3',
  EXPLORE:      'audio/bgm_explore_ambient.mp3',
  SUSPENSE_LOW: 'audio/bgm_suspense_low.mp3',
  END_REPRISE:  'audio/bgm_end_reprise.mp3',
  EVENT_STING:  'audio/bgm_event_sting.mp3'
};

// DOM
const bgEl = document.getElementById('background');
const speakerEl = document.getElementById('speakerName');
const mainTextEl = document.getElementById('mainText');
const choiceArea = document.getElementById('choiceArea');
const dbg = {
  panel: document.getElementById('debugPanel'),
  evid: document.getElementById('dbgEvid'),
  trust: document.getElementById('dbgTrust'),
  shadow: document.getElementById('dbgShadow'),
  scenes: document.getElementById('dbgScenes'),
  max: document.getElementById('dbgMax')
};
const logPanel = document.getElementById('logPanel');
const logContent = document.getElementById('logContent');

// UI
document.getElementById('btnDebug').onclick = ()=> dbg.panel.classList.toggle('hidden');
document.getElementById('btnLog').onclick = ()=> { logPanel.classList.remove('hidden'); renderLog(); };
document.getElementById('btnCloseLog').onclick = ()=> logPanel.classList.add('hidden');
document.getElementById('btnReset').onclick = ()=> { if(confirm('最初からはじめます。')) init(); };
document.getElementById('gameContainer').addEventListener('click', (e)=>{
  if (e.target.closest('button')) return;
  if (choiceArea.children.length===0 && !isRunning) start();
});

// BGMプレイヤ（重複防止＋クロスフェード）
let currentBGM=null, currentBGMName='', fadeTimer=null;
const BGM_VOL=0.55;

function playBGM(name){
  const src = BGM[name];
  if(!src) return;
  if(currentBGM && currentBGMName===name) return; // 同曲なら何もしない

  const next = new Audio(src);
  next.loop = true; next.volume = 0;

  const prev = currentBGM;
  if(fadeTimer){ clearInterval(fadeTimer); fadeTimer=null; }

  next.play().catch(()=>{});
  currentBGM = next; currentBGMName = name;

  const step = 0.05;
  fadeTimer = setInterval(()=>{
    if(currentBGM && currentBGM.volume < BGM_VOL){
      currentBGM.volume = Math.min(BGM_VOL, currentBGM.volume + step);
    }
    if(prev){
      prev.volume = Math.max(0, prev.volume - step);
      if(prev.volume<=0){ prev.pause(); }
    }
    if((!prev || prev.volume<=0) && currentBGM.volume>=BGM_VOL){
      clearInterval(fadeTimer); fadeTimer=null;
    }
  }, 120);
}
function stopBGM(){
  if(fadeTimer){ clearInterval(fadeTimer); fadeTimer=null; }
  if(currentBGM){ currentBGM.pause(); currentBGM=null; currentBGMName=''; }
}
function playSE(name='EVENT_STING'){
  const src = BGM[name]; if(!src) return;
  const a = new Audio(src); a.volume = 0.9; a.play().catch(()=>{});
}

// 状態
let state, isRunning=false;

function init(){
  state = {
    evid:0, trust:0, shadow:0,
    scenesSeen:0,
    maxScenes: 10,           // ここを増やせば更に長く遊べる
    visited: new Set(),
    log: []
  };
  isRunning=false;
  changeBackground(BG.title);
  setText('', 'クリックまたはタップで開始');
  choiceArea.innerHTML='';
  updateDebug();
  logContent.innerHTML='';
  logPanel.classList.add('hidden');
  stopBGM();
}
init();

function start(){
  isRunning=true;
  changeBackground(BG.gate);
  playBGM('WALTZ_SOFT');
  say('', '午後四時過ぎ。山裾の屋敷の前で、私は足を止めた。風もないのに風鈴が鳴っている。');
  waitThen(nextScene, 900);
}

function nextScene(){
  // 終了チェック
  if (state.scenesSeen >= state.maxScenes) { endByFormula('規定到達'); return; }

  // 未訪問優先で20シーンから抽選
  const pool = scenes.map((_,i)=>i).filter(i=>!state.visited.has(i));
  const idx = (pool.length>0)? choice(pool) : Math.floor(Math.random()*scenes.length);
  state.visited.add(idx);
  state.scenesSeen++;
  updateDebug();
  playScene(scenes[idx]);
}

function playScene(sc){
  if(sc.bg) changeBackground(sc.bg);
  if(sc.bgm) playBGM(sc.bgm);
  say(sc.speaker||'', sc.text);
  showChoices(sc.choices.map(c => ({
    label: c.label,
    run: ()=>{
      applyDelta(c.delta||{});
      addLog(sc.speaker||'', `[選択] ${c.label}`);
      if (endByFormula('即時判定')) return; // いつでもエンドへ
      if (c.se) playSE(c.se);
      waitThen(nextScene, 280);
    }
  })));
}

function showChoices(list){
  choiceArea.innerHTML='';
  list.forEach(item=>{
    const b=document.createElement('button');
    b.className='choice-button fade';
    b.textContent=item.label;
    b.onclick=(e)=>{ e.stopPropagation(); choiceArea.innerHTML=''; item.run(); };
    choiceArea.appendChild(b);
  });
}

function say(speaker, text){
  setText(speaker, text);
  addLog(speaker||'ナレーション', text);
}
function setText(speaker, text){
  speakerEl.textContent = speaker;
  mainTextEl.classList.remove('fade'); void mainTextEl.offsetWidth; mainTextEl.classList.add('fade');
  mainTextEl.textContent = text;
}
function changeBackground(path){
  bgEl.style.opacity = 0;
  setTimeout(()=>{
    bgEl.style.backgroundImage = `url(${path})`;
    bgEl.style.opacity = 1;
  }, 150);
}

function waitThen(fn, t){ setTimeout(fn, t); }
function addLog(speaker,text){ state.log.push({speaker,text}); }
function renderLog(){
  logContent.innerHTML='';
  state.log.forEach(ent=>{
    const d=document.createElement('div'); d.className='log-entry';
    d.innerHTML = `<div class="log-speaker">${ent.speaker}</div><div>${ent.text}</div>`;
    logContent.appendChild(d);
  });
}

function applyDelta(d){
  if('evid' in d) state.evid = Math.max(0, state.evid + d.evid);
  if('trust' in d) state.trust = state.trust + d.trust;
  if('shadow' in d) state.shadow = Math.max(0, state.shadow + d.shadow);
  updateDebug();
}
function updateDebug(){
  dbg.evid.textContent = state.evid;
  dbg.trust.textContent = state.trust;
  dbg.shadow.textContent = state.shadow;
  dbg.scenes.textContent = state.scenesSeen;
  dbg.max.textContent = state.maxScenes;
}

// 7エンド数式判定（順番重要）
function endByFormula(reason){
  const E=state.evid, T=state.trust, S=state.shadow;

  if(E>=5 && S>=3 && T>=1) return showEnding(1,
    '来客のために整えた応接室。銀のスプーン、写真立て、紙切れ。全員の顔色が変わった。何も言わずに湯を沸かしに戻る。', 'END_REPRISE'); // 修正: 誤って分割されていた文字列を修正

  if(E>=4 && T<=-1) return showEnding(4,
    '応接の空気は氷のように冷たくなった。「あなたには、もうお願いできません」玄関で靴紐が震えた。', 'END_REPRISE');

  if(S>=5 && E<3) return showEnding(5,
    '廊下に立つ背の高い影。灯りが揺れ、息が詰まる。冷たい気配に包まれ、意識が遠のいた。', 'SUSPENSE_LOW');

  if(T>=3 && E>=2 && S<=2) return showEnding(6,
    '証拠は片づけた。来客は笑顔で帰る。奥様と短く目が合う。胸の奥に静かな重みだけが残った。', 'WALTZ_SOFT');

  if(T>=2 && S>=3 && E<4) return showEnding(3,
    '当主の低い声。「お前はよく見ているな」私はただ頷き、茶を注いだ。', 'SUSPENSE_LOW');

  if(T>=1 && S>=4 && E>=1) return showEnding(2,
    '静茶の囁き。「ここだけの話にしましょう」私は小さく礼をして台所へ戻った。', 'EXPLORE');

  if(S>=6) return showEnding(7,
    '暗がりに裸足の人影。「幽霊だ！」気づけば裸足のまま外にいた。後で分かった。あれは人だった。', 'END_REPRISE');

  // 終了条件未達。規定到達のときは強制でEND7に寄せないよう、上の分岐が優先
  if(reason==='規定到達'){
    // どれにも該当しない場合は、雰囲気の良い余韻エンドに落とす
    return showEnding(6,
      '来客は何事もなく帰った。私は道具を拭き直し、戸を静かに閉めた。', 'WALTZ_SOFT');
  }
  return false;
}

function showEnding(no, text, bgmKey){
  playBGM(bgmKey);
  changeBackground(BG.silhouette);
  setText('', `${text}\n\n— END ${no} —`);
  choiceArea.innerHTML='';
  isRunning=false;
  return true;
}

function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// ===============================
// シーン20（人の不自然な言動中心）
// ===============================
const scenes = [
  // 1 応接：スプーン
  {
    bg: BG.living, bgm:'WALTZ_SOFT', speaker:'',
    text:'応接のテーブル。銀のスプーンの向きがさっきと違う。奥様は扉から「それは後で私が」。',
    choices:[
      { label:'磨いて棚に戻す',   delta:{ trust:+1 } },
      { label:'ポケットにしまう', delta:{ evid:+1, trust:-1 }, se:'EVENT_STING' }
    ]
  },
  // 2 廊下の足音
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW', speaker:'',
    text:'廊下の奥で「コツ…コツ…」。静茶は口を半開きのまま固まっている。',
    choices:[
      { label:'音の方へ行く', delta:{ shadow:+1 }, se:'EVENT_STING' },
      { label:'作業に戻る',   delta:{ trust:+1 } }
    ]
  },
  // 3 花瓶の紙
  {
    bg: BG.kitchen, bgm:'EXPLORE', speaker:'',
    text:'花瓶の底に濡れた紙切れ。「見ている」の文字が滲む。風はないのに花が揺れる。',
    choices:[
      { label:'紙を読む', delta:{ evid:+1, shadow:+1 } },
      { label:'捨てる',   delta:{ trust:+1 } }
    ]
  },
  // 4 書斎：写真の裏
  {
    bg: BG.study, bgm:'EXPLORE', speaker:'',
    text:'写真立ての裏から買い物リスト。背後で当主の声。「それは…誰に見せる？」',
    choices:[
      { label:'当主に渡す',     delta:{ trust:+1 } },
      { label:'黙って仕舞う',   delta:{ evid:+1, trust:-1, shadow:+1 } }
    ]
  },
  // 5 台所：声まね
  {
    bg: BG.kitchen, bgm:'SUSPENSE_LOW', speaker:'静茶',
    text:'「古い客って知ってます？ 真夜中に台所で、誰かの声をまねるんです」廊下から私の声が「おいで」。',
    choices:[
      { label:'確かめに行く', delta:{ shadow:+1 }, se:'EVENT_STING' },
      { label:'無視する',     delta:{ trust:+1 } }
    ]
  },
  // 6 客間：灯が消える
  {
    bg: BG.dining, bgm:'SUSPENSE_LOW', speaker:'',
    text:'庭の灯が一つずつ消える。残り一つの横に背の高い影。',
    choices:[
      { label:'外へ出る',        delta:{ shadow:+1 } },
      { label:'窓を閉めて戻る',  delta:{ trust:+1 } }
    ]
  },
  // 7 廊下：奥様の囁き
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW', speaker:'奥様',
    text:'「顔色が悪いわね」柔らかな笑み。だが耳元で、私の声で「逃げなさい」。',
    choices:[
      { label:'証拠を見せる', delta:{ trust:+1, evid:+1 } },
      { label:'無言で通る',   delta:{ trust:-1, shadow:+1 } }
    ]
  },
  // 8 台所：鍵の引き出し
  {
    bg: BG.kitchen, bgm:'EXPLORE', speaker:'',
    text:'鍵の引き出しがわずかに開いている。中に黄ばんだ封筒。',
    choices:[
      { label:'開ける', delta:{ evid:+1, shadow:+1 }, se:'EVENT_STING' },
      { label:'閉める', delta:{ trust:+1 } }
    ]
  },
  // 9 玄関：靴が一足多い
  {
    bg: BG.genkan, bgm:'EXPLORE', speaker:'',
    text:'玄関の靴が一足多い。奥様は見ないふりで通り過ぎる。',
    choices:[
      { label:'揃えて奥へ', delta:{ trust:+1 } },
      { label:'誰のか確かめる', delta:{ evid:+1, shadow:+1 } }
    ]
  },
  // 10 食器棚：枚数が合わない
  {
    bg: BG.living, bgm:'WALTZ_SOFT', speaker:'',
    text:'奥様はお皿の枚数を何度も数え直す。結果は同じなのに首を傾げる。',
    choices:[
      { label:'記録しておく', delta:{ evid:+1 } },
      { label:'気にせず進む', delta:{ } }
    ]
  },
  // 11 洗濯：干してない衣
  {
    bg: BG.living, bgm:'EXPLORE', speaker:'',
    text:'取り込んだ洗濯物に、干していない衣が混ざっていた。「私のじゃない」と奥様。',
    choices:[
      { label:'確認して返す', delta:{ trust:+1 } },
      { label:'タグを調べる', delta:{ evid:+1, shadow:+1 } }
    ]
  },
  // 12 庭：当主が塩を撒く
  {
    bg: BG.gate, bgm:'EXPLORE', speaker:'当主',
    text:'当主が庭に塩を撒く。「昨日と同じ場所じゃない」小声でつぶやく。',
    choices:[
      { label:'理由を聞く',     delta:{ trust:-1, shadow:+1 } },
      { label:'黙って掃除する', delta:{ trust:+1 } }
    ]
  },
  // 13 時計：止まっているのに
  {
    bg: BG.hallway, bgm:'WALTZ_SOFT', speaker:'奥様',
    text:'廊下の時計は止まっているのに、奥様は時刻を言い当てる。',
    choices:[
      { label:'驚かず頷く', delta:{ trust:+1 } },
      { label:'理由を尋ねる', delta:{ trust:-1, shadow:+1 } }
    ]
  },
  // 14 部屋締切
  {
    bg: BG.living, bgm:'SUSPENSE_LOW', speaker:'静茶',
    text:'静茶が勝手に部屋を締め切る。「空気が逃げるから」',
    choices:[
      { label:'従う',     delta:{ trust:+1 } },
      { label:'窓を開ける', delta:{ trust:-1, shadow:+1 } }
    ]
  },
  // 15 物置：棚の奥
  {
    bg: BG.storage, bgm:'EXPLORE', speaker:'当主',
    text:'当主が棚の奥を何度も覗く。中には何もない。',
    choices:[
      { label:'一緒に確認', delta:{ trust:+1, evid:+1 } },
      { label:'放っておく', delta:{ } }
    ]
  },
  // 16 鏡：知らない肩
  {
    bg: BG.mirror, bgm:'SUSPENSE_LOW', speaker:'',
    text:'鏡面を拭くと、背後に知らない肩が映る。「それは…おまえには重い」',
    choices:[
      { label:'渡す',         delta:{ trust:+1 } },
      { label:'ポケットに入れる', delta:{ evid:+1, trust:-1, shadow:+1 } }
    ]
  },
  // 17 配膳：一人分多い
  {
    bg: BG.dining, bgm:'WALTZ_SOFT', speaker:'奥様',
    text:'夕食の配膳で一人分多く用意させられる。「念のため」',
    choices:[
      { label:'黙って揃える', delta:{ trust:+1, shadow:+1 } },
      { label:'数を直す',     delta:{ trust:-1, evid:+1 } }
    ]
  },
  // 18 廊下：見えない誰かに会釈
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW', speaker:'静茶',
    text:'静茶が見えない誰かに会釈。こちらに気づくと話題を変える。',
    choices:[
      { label:'誰かいたか聞く', delta:{ trust:-1, shadow:+1 } },
      { label:'見なかったふり', delta:{ trust:+1 } }
    ]
  },
  // 19 庭：掘り返す
  {
    bg: BG.gate, bgm:'EXPLORE', speaker:'静茶',
    text:'静茶が地面を掘り返し、古い鍵を見つける。渡すか迷っている。',
    choices:[
      { label:'受け取る',   delta:{ evid:+1 } },
      { label:'戻させる',   delta:{ trust:+1 } }
    ]
  },
  // 20 低い声
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW', speaker:'',
    text:'配膳中、見知らぬ低い声が「それは私のだ」。周りには誰もいない。',
    choices:[
      { label:'手を止める',   delta:{ shadow:+2 }, se:'EVENT_STING' },
      { label:'無視して続ける', delta:{ trust:+1 } }
    ]
  }
];
