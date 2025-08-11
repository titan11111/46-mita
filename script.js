// ===============================
// 白磁の匙 — クリック進行 / 単一BGMで重複なし / エンドはクリックで停止→リスタート
// 選択肢 after 対応（直後の短いやりとり）/ 会話自然化
// ===============================

// 画像パス
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

// ===== 単一Audioを使い回し（重複再生 完全防止）=====
const bgmEl = new Audio();
bgmEl.loop = true;
bgmEl.preload = 'auto';
let bgmKey = '';

function playBGM(key){
  if (!key || !BGM[key]) return;
  if (bgmKey === key && !bgmEl.paused) return;

  const fadeOut = ()=>new Promise(res=>{
    const id = setInterval(()=>{
      bgmEl.volume = Math.max(0, bgmEl.volume - 0.05);
      if (bgmEl.volume === 0){
        clearInterval(id); res();
      }
    }, 80);
  });

  const fadeIn = ()=>{
    const id = setInterval(()=>{
      if (bgmEl.volume >= 0.55){ clearInterval(id); return; }
      bgmEl.volume = Math.min(0.55, bgmEl.volume + 0.05);
    }, 80);
  };

  fadeOut().then(()=>{
    try{
      bgmEl.pause();
      bgmEl.currentTime = 0;
      bgmEl.src = BGM[key];
      bgmEl.volume = 0;
      bgmEl.play().catch(()=>{});
      bgmKey = key;
      fadeIn();
    }catch(_){}
  });
}

function stopBGM(){
  try{
    bgmEl.pause();
    bgmEl.currentTime = 0;
    bgmEl.src = '';     // 旧ソースを切断：重なり防止の決め手
  }catch(_){}
  bgmKey = '';
}

// 効果音は毎回生成（短いのでOK）
function playSE(key='EVENT_STING'){
  if (!BGM[key]) return;
  const a = new Audio(BGM[key]);
  a.volume = 0.9;
  a.play().catch(()=>{});
}

// ===== DOM =====
const bgEl        = document.getElementById('background');
const speakerEl   = document.getElementById('speakerName');
const mainTextEl  = document.getElementById('mainText');
const choiceArea  = document.getElementById('choiceArea');

const btnLog      = document.getElementById('btnLog');
const btnDebug    = document.getElementById('btnDebug');
const btnReset    = document.getElementById('btnReset');

const logPanel    = document.getElementById('logPanel');
const logContent  = document.getElementById('logContent');
const btnCloseLog = document.getElementById('btnCloseLog');

const dbgEvid   = document.getElementById('dbgEvid');
const dbgTrust  = document.getElementById('dbgTrust');
const dbgShadow = document.getElementById('dbgShadow');
const dbgScenes = document.getElementById('dbgScenes');
const dbgMax    = document.getElementById('dbgMax');

// ===== 状態 =====
let state, isRunning=false;
let inOpening=true, opIndex=0;
let sceneIndex=-1, lineIndex=0;
let isEnding=false;

// 選択後の短いやりとりキュー
let _afterQueue = null;
let _afterNext  = null;

// ===== 初期化 =====
function init(){
  stopBGM();
  state = {
    evid:0, trust:0, shadow:0,
    scenesSeen:0, maxScenes:17,
    visited:new Set(), log:[]
  };
  isRunning=false; inOpening=true; opIndex=-1; sceneIndex=-1; lineIndex=0;
  isEnding=false; _afterQueue=null; _afterNext=null;

  changeBackground(BG.title);
  setText('', 'クリック（タップ）で開始');
  choiceArea.innerHTML='';
  if (logPanel) logPanel.classList.remove('show');
  updateDebug();
}
init();

// ===== クリック（進行） =====
document.getElementById('gameContainer').addEventListener('click', (e)=>{
  if (e.target.closest('button')) return;

  // エンド中：クリックで必ず停止→タイトル
  if (isEnding){
    stopBGM();          // エンド曲を確実停止
    isEnding = false;
    init();             // タイトルへ
    return;
  }

  if (logPanel && logPanel.classList.contains('show')) { toggleLog(false); return; }
  if (!isRunning) { start(); return; }
  if (choiceArea.children.length > 0) return;

  advanceLine();
});

// ===== ボタン =====
if (btnLog)      btnLog.onclick      = (e)=>{ e.stopPropagation(); toggleLog(); };
if (btnCloseLog) btnCloseLog.onclick = (e)=>{ e.stopPropagation(); toggleLog(false); };
if (btnReset)    btnReset.onclick    = (e)=>{ e.stopPropagation(); if(confirm('最初からはじめます。')){ stopBGM(); init(); } };
if (btnDebug && dbgEvid){
  btnDebug.onclick = (e)=>{ e.stopPropagation(); document.getElementById('debugPanel').classList.toggle('hidden'); };
}

// ===== 表示 =====
function changeBackground(path){
  bgEl.style.opacity = 0;
  setTimeout(()=>{ bgEl.style.backgroundImage = `url(${path})`; bgEl.style.opacity = 1; }, 100);
}
function setText(speaker,text){
  speakerEl.textContent = speaker || '';
  mainTextEl.classList.remove('fade'); void mainTextEl.offsetWidth; mainTextEl.classList.add('fade');
  mainTextEl.textContent = text || '';
}
function say(s,t){ setText(s,t); addLog(s||'ナレーション',t); }
function addLog(speaker,text){ state.log.push({speaker,text}); }
function toggleLog(force){
  if (!logPanel) return;
  const on = (typeof force==='boolean')? force : !logPanel.classList.contains('show');
  if (on){ renderLog(); logPanel.classList.add('show'); }
  else   { logPanel.classList.remove('show'); }
}
function renderLog(){
  if (!logContent) return;
  logContent.innerHTML='';
  state.log.forEach(ent=>{
    const d=document.createElement('div'); d.className='log-entry';
    d.innerHTML = `<div class="log-speaker">${ent.speaker}</div><div>${ent.text}</div>`;
    logContent.appendChild(d);
  });
}
function updateDebug(){
  if (!dbgEvid) return;
  dbgEvid.textContent   = state.evid;
  dbgTrust.textContent  = state.trust;
  dbgShadow.textContent = state.shadow;
  dbgScenes.textContent = state.scenesSeen;
  dbgMax.textContent    = state.maxScenes;
}

// ===== スタート =====
function start(){
  stopBGM();
  isRunning = true;
  playBGM('WALTZ_SOFT');
  changeBackground(BG.gate);
  say('', '雨上がりの道を抜け、私は屋敷の門前に立った。');
}

// ===== 進行 =====
function advanceLine(){
  // after キューがあればそれを優先表示
  if (_afterQueue && _afterQueue.length){
    const ln = _afterQueue.shift();
    say(ln.speaker||'', ln.text||'');
    if (_afterQueue.length===0){
      const cb = _afterNext; _afterNext=null; _afterQueue=null;
      cb && cb();
    }
    return;
  }

  if (inOpening) { advanceOpening(); return; }

  const sc = scenes[sceneIndex]; if (!sc) return;
  lineIndex++;
  if (lineIndex < sc.lines.length){
    const ln = sc.lines[lineIndex]; say(ln.speaker||'', ln.text||''); return;
  }
  if (sc.choices && sc.choices.length){
    showChoices(sc, sc.choices);
  } else {
    if (endByFormula('即時判定')) return;
    gotoNextScene();
  }
}

function showChoices(sc, list){
  choiceArea.innerHTML='';
  list.forEach(c=>{
    const b=document.createElement('button');
    b.className='choice-button';
    b.textContent=c.label;
    b.onclick=(e)=>{
      e.stopPropagation();
      choiceArea.innerHTML='';

      applyDelta(c.delta||{});
      addLog(sc.lines[Math.max(0, sc.lines.length-1)].speaker||'', `[選択] ${c.label}`);
      if (c.se) playSE(c.se);

      const proceed = ()=>{
        if (endByFormula('即時判定')) return;
        gotoNextScene();
      };

      if (c.after && c.after.length){
        _afterQueue = c.after.slice();
        _afterNext  = proceed;
        const first = _afterQueue.shift();
        say(first.speaker||'', first.text||'');
        return;
      }
      proceed();
    };
    choiceArea.appendChild(b);
  });
}

// ===== オープニング（会話自然化） =====
const openingLines = [
  { bg: BG.gate,    bgm:'WALTZ_SOFT', s:'',    t:'背の高い塀。湿った土と畳の匂いが混じる。' },
  {                 s:'私',            t:'……こちらで間違いないはず。' },
  { bg: BG.genkan,  s:'奥様',          t:'ようこそ。あなたが新しく来てくださる方ですね。' },
  {                 s:'私',            t:'本日からお世話になります。' },
  {                 s:'奥様',          t:'長く続く方は少ないの。けれど——あなたなら大丈夫でしょう。' },
  {                 s:'私',            t:'……承知しました。' },
  { bg: BG.living,  s:'奥様',          t:'こちらが当主です。' },
  {                 s:'私',            t:'初めまして。炊事・洗濯・掃除は——' },
  {                 s:'当主',          t:'……荷物のことだ。そこに置け。' },
  {                 s:'私',            t:'……失礼しました。' },
  {                 s:'当主',          t:'夜は起きるな。起きると、誰かと目が合う。' },
  {                 s:'私',            t:'誰か、ですか。' },
  {                 s:'当主',          t:'気のせいだと思っておけ。' },
  { bg: BG.kitchen, bgm:'EXPLORE',     s:'奥様', t:'静茶。この方が家政婦さん。' },
  {                 s:'静茶',          t:'……静茶です。よろしく。' },
  {                 s:'私',            t:'よろしくお願いします。' },
  {                 s:'静茶',          t:'部屋は奥です。荷物は軽い方が……いいですよ。' },
  {                 s:'私',            t:'なぜですか。' },
  {                 s:'静茶',          t:'……夜、移動することになるかもしれないので。' },
  { bg: BG.hallway, bgm:'SUSPENSE_LOW', s:'',   t:'廊下の奥で衣擦れ。私以外は誰も動いていないはず。' },
  {                 s:'私',            t:'……どなたか、いらっしゃいますか？' },
  {                 s:'奥様',          t:'気にしなくていいのよ。' },
  {                 s:'静茶',          t:'そこ、よく“薄くなる”んです。壁が、じゃなくて……空気が。' },
  {                 s:'私',            t:'……空気が？' },
  {                 s:'静茶',          t:'向こうと混ざるんですよ。' },
  {                 s:'',              t:'空気が張り詰めた。私は息を浅くする。' }
];
function advanceOpening(){
  opIndex++;
  if (opIndex < openingLines.length){
    const ln = openingLines[opIndex];
    if (ln.bg) changeBackground(ln.bg);
    if (ln.bgm) playBGM(ln.bgm);
    say(ln.s||'', ln.t||''); return;
  }
  inOpening=false; gotoNextScene();
}

// ===== 遷移 =====
function gotoNextScene(){
  if (state.scenesSeen >= state.maxScenes){ endByFormula('規定到達'); return; }

  const pool = scenes.map((_,i)=>i).filter(i=>!state.visited.has(i));
  const idx  = (pool.length>0) ? pool[Math.floor(Math.random()*pool.length)]
                               : Math.floor(Math.random()*scenes.length);

  state.visited.add(idx); state.scenesSeen++;
  sceneIndex = idx; lineIndex = 0;

  const sc = scenes[sceneIndex];
  if (sc.bg)  changeBackground(sc.bg);
  if (sc.bgm) playBGM(sc.bgm);
  const ln = sc.lines[lineIndex]; say(ln.speaker||'', ln.text||'');
  updateDebug();
}

// ===== パラメータ =====
function applyDelta(d){
  if('evid'   in d) state.evid   = Math.max(0, state.evid + d.evid);
  if('trust'  in d) state.trust  = state.trust + d.trust;
  if('shadow' in d) state.shadow = Math.max(0, state.shadow + d.shadow);
  updateDebug();
}
const getE = ()=>state.evid, getT=()=>state.trust, getS=()=>state.shadow;

// ===== 7エンド判定（各エンド+2行＋クリック誘導） =====
function endByFormula(reason){
  const E=getE(), T=getT(), S=getS();

  if(E>=5 && S>=3 && T>=1) return showEnding(1, [
    '来客のための応接。銀のスプーン、写真立て、紙切れ。全員の顔色が変わった。私は湯を沸かしに戻る。',
    '湯気の向こうで、当主は目を細める。静茶は机の下、何かを足で押し止めた。',
    '夜が更けても、庭の灯は一本だけ消えない。——明日、その灯の根元を見に行く。'
  ], 'END_REPRISE', true);

  if(E>=4 && T<=-1) return showEnding(4, [
    '応接の空気は冷え切った。「あなたには、もうお願いできません」玄関で靴紐が震える。',
    '戸の向こうで小さな笑い声。私の声に似ていた。',
    '鍵の音が遠のく。ここで私の役目は終わった。'
  ], 'END_REPRISE', false);

  if(S>=5 && E<3) return showEnding(5, [
    '廊下の端に背の高い影。灯りが揺れ、息が詰まる。冷たい気配が近づいた。',
    '足の裏が畳に吸い付く。声が出ない。',
    '灯が落ちた。そこで記憶は途切れた。'
  ], 'SUSPENSE_LOW', false);

  if(T>=3 && E>=2 && S<=2) return showEnding(6, [
    '証拠は片づけた。来客は笑顔で帰る。奥様と目が合い、静かな重みだけが残る。',
    '卓上に一枚の座布団だけ余ったまま。',
    '——誰の席だったのか。次の朝、私は井戸端から確かめる。'
  ], 'WALTZ_SOFT', true);

  if(T>=2 && S>=3 && E<4) return showEnding(3, [
    '当主の低い声。「お前はよく見ているな」私はただ頷き、茶を注ぐ。',
    '茶柱が立った。誰も口にしないが、それだけで十分だった。',
    '扉の隙間、影が一つ増えた気がする。次に確かめるのは、納戸の棚だ。'
  ], 'SUSPENSE_LOW', true);

  if(T>=1 && S>=4 && E>=1) return showEnding(2, [
    '静茶の囁き。「ここだけの話にしましょう」私は小さく礼をして台所へ戻る。',
    '彼女の袖口は濡れていた。誰かの手を、さっきまで引いていたように。',
    '短い合図を決めた。——次、灯が三度消えたら、裏門へ。'
  ], 'EXPLORE', true);

  if(S>=6) return showEnding(7, [
    '暗がりに裸足の人影。「幽霊だ！」気づけば外にいた。後で分かった。あれは人だった。',
    '門の外で笑い声が背に張り付く。',
    '遠くで風鈴だけが鳴っている。'
  ], 'END_REPRISE', false);

  if(reason==='規定到達'){
    return showEnding(6, [
      '来客は何事もなく帰った。私は道具を拭き直し、戸を静かに閉めた。',
      '余った箸が一本。誰も口にしないが、それだけで十分だった。',
      '明日、箸袋の数を合わせる。——そこで何かが欠けるはず。'
    ], 'WALTZ_SOFT', true);
  }
  return false;
}

function showEnding(no, linesArr, bgmKey, hasHook){
  stopBGM();
  playBGM(bgmKey);

  const body = linesArr.join('\n');
  const tail = hasHook ? '（続きの気配がある）' : '（ここで終わり）';
  const fullText = `${body}\n\n— END ${no} —\n\n${tail}\n\n《 クリックでタイトルに戻る 》`;

  changeBackground(BG.silhouette);
  setText('', fullText);
  choiceArea.innerHTML='';

  isRunning=false;
  isEnding=true;     // クリックで stopBGM()→init()
  return true;
}

// ===== シーン（会話自然化＋ after 追加） =====
const scenes = [
  // 1 応接：匙の向き
  {
    bg: BG.living, bgm:'WALTZ_SOFT',
    lines:[
      {speaker:'私',   text:'スプーンの向きが、さっきと違う。'},
      {speaker:'奥様', text:'それは後で私が。'},
      {speaker:'私',   text:'……磨いておきます。'}
    ],
    choices:[
      {
        label:'磨いて棚に戻す',
        delta:{ trust:+1 },
        after:[
          {speaker:'私',   text:'艶が戻りました。'},
          {speaker:'奥様', text:'助かるわ。光る物は“数”が目立つの。'}
        ]
      },
      {
        label:'ポケットにしまう',
        delta:{ evid:+1, trust:-1 }, se:'EVENT_STING',
        after:[
          {speaker:'私',   text:'一時的に預かります。'},
          {speaker:'奥様', text:'預かるのは結構。でも、戻す場所は同じに。'}
        ]
      }
    ]
  },

  // 2 廊下：足音
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW',
    lines:[
      {speaker:'',     text:'コツ……コツ……。'},
      {speaker:'静茶', text:'……今、向こうで足音がしました。'},
      {speaker:'私',   text:'（反響にしては近い）'}
    ],
    choices:[
      {
        label:'音の方へ行く',
        delta:{ shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'私',   text:'角で途切れています。'},
          {speaker:'静茶', text:'そこ、よく“薄くなる”んです。空気が。'},
          {speaker:'私',   text:'向こうと混ざる、ということ？'},
          {speaker:'静茶', text:'はい。'}
        ]
      },
      {
        label:'作業に戻る',
        delta:{ trust:+1 },
        after:[
          {speaker:'私',   text:'一旦戻ります。'},
          {speaker:'静茶', text:'判断、早いですね。'}
        ]
      }
    ]
  },

  // 3 台所：濡れた紙切れ
  {
    bg: BG.kitchen, bgm:'EXPLORE',
    lines:[
      {speaker:'私',    text:'花瓶の底に……「見ている」の文字。'},
      {speaker:'静茶',  text:'さっきは、ありませんでした。'},
      {speaker:'私',    text:'誰が、いつ置いた？'},
      {speaker:'静茶',  text:'台所にいたのは、私と……あなた、だけ。'}
    ],
    choices:[
      {
        label:'紙を読む',
        delta:{ evid:+1, shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'私',   text:'筆圧が浅い。急いで書いた跡。'},
          {speaker:'静茶', text:'滲みも新しい。今夜のもの。'}
        ]
      },
      {
        label:'捨てる',
        delta:{ trust:+1 },
        after:[
          {speaker:'私',   text:'濡れは拭きます。'},
          {speaker:'静茶', text:'……跡は残りますよ。跡から辿られることも。——それでも？'},
          {speaker:'私',   text:'ええ。'}
        ]
      }
    ]
  },

  // 4 書斎：二つの筆跡
  {
    bg: BG.study, bgm:'EXPLORE',
    lines:[
      {speaker:'私',     text:'買い物リスト……墨が二種類。筆跡も違う。'},
      {speaker:'当主',   text:'……それは、誰に見せるつもりだ。'},
      {speaker:'私',     text:'見せる相手は、まだ決めていません。'}
    ],
    choices:[
      {
        label:'当主に渡す',
        delta:{ trust:+1 },
        after:[
          {speaker:'当主', text:'置いていけ。'},
          {speaker:'私',   text:'記録は私が控えます。'},
          {speaker:'当主', text:'……忘れるな。'}
        ]
      },
      {
        label:'黙って仕舞う',
        delta:{ evid:+1, trust:-1, shadow:+1 },
        after:[
          {speaker:'',     text:'障子がわずかに鳴る。'},
          {speaker:'私',   text:'（視線が増えた）'}
        ]
      }
    ]
  },

  // 5 台所：古い客の噂
  {
    bg: BG.kitchen, bgm:'SUSPENSE_LOW',
    lines:[
      {speaker:'静茶', text:'古い客、知ってます？　声をまねます。'},
      {speaker:'',     text:'廊下から、私の声で「おいで」。'},
      {speaker:'私',   text:'（私の声、なのに違う）'}
    ],
    choices:[
      {
        label:'確かめに行く',
        delta:{ shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'私',   text:'誰もいない。'},
          {speaker:'静茶', text:'声だけ置いていくんですよ、あれ。'}
        ]
      },
      {
        label:'無視する',
        delta:{ trust:+1 },
        after:[
          {speaker:'私',   text:'先に配膳を。'},
          {speaker:'静茶', text:'助かります。逃げ道は確保しておきます。'}
        ]
      }
    ]
  },

  // 6 庭：灯が消える
  {
    bg: BG.dining, bgm:'SUSPENSE_LOW',
    lines:[
      {speaker:'',   text:'庭の灯が奥から手前へ、順に消える。'},
      {speaker:'私', text:'（消す人が近づく順）'},
      {speaker:'',   text:'最後の灯の横に背の高い影。灯芯はまだ温かい。'}
    ],
    choices:[
      {
        label:'外へ出る',
        delta:{ shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'私',   text:'芯の煤が新しい。'},
          {speaker:'奥様', text:'今は追わないで。入る口は一つじゃないの。'}
        ]
      },
      {
        label:'窓を閉めて戻る',
        delta:{ trust:+1 },
        after:[
          {speaker:'奥様', text:'判断が早いわ。'},
          {speaker:'私',   text:'音を減らします。'}
        ]
      }
    ]
  },

  // 7 廊下：反響（afterで「証拠を見せる」の直後会話）
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW',
    lines:[
      {speaker:'奥様', text:'顔色が悪いわね。'},
      {speaker:'',     text:'柱と障子の間で、声が二度返る廊下。'},
      {speaker:'',     text:'耳元で、私の声で「逃げなさい」。'},
      {speaker:'私',   text:'（近すぎる）'}
    ],
    choices:[
      {
        label:'証拠を見せる',
        delta:{ trust:+1, evid:+1 },
        after:[
          {speaker:'私',   text:'足跡は角で途切れます。灯も順に消えた。'},
          {speaker:'奥様', text:'……わかりました。今夜は私が見張ります。あなたは戸を。'}
        ]
      },
      {
        label:'無言で通る',
        delta:{ trust:-1, shadow:+1 },
        after:[
          {speaker:'',     text:'誰も追ってこない。けれど足音だけは増えた。'}
        ]
      }
    ]
  },

  // 8 玄関：靴の数
  {
    bg: BG.genkan, bgm:'EXPLORE',
    lines:[
      {speaker:'私',   text:'靴が、一足多い。'},
      {speaker:'奥様', text:'……（見ないふりで通る）'}
    ],
    choices:[
      {
        label:'揃えて奥へ',
        delta:{ trust:+1 },
        after:[
          {speaker:'私',   text:'泥は乾いていません。'},
          {speaker:'奥様', text:'では、今夜の客ですね。'}
        ]
      },
      {
        label:'誰のか確かめる',
        delta:{ evid:+1, shadow:+1 },
        after:[
          {speaker:'私',   text:'踵がすり減っている。背の高い歩幅。'},
          {speaker:'奥様', text:'……覚えが、ないわ。'}
        ]
      }
    ]
  },

  // 9 洗濯：見知らぬ衣（afterで自然化）
  {
    bg: BG.living, bgm:'EXPLORE',
    lines:[
      {speaker:'私',   text:'干していない衣が混ざっている。'},
      {speaker:'奥様', text:'私のじゃないわ。'}
    ],
    choices:[
      {
        label:'確認して返す',
        delta:{ trust:+1 },
        after:[
          {speaker:'私',   text:'縫い目がほつれていました。直しておきます。'},
          {speaker:'奥様', text:'助かるわ。……それ、昔の人の物。捨てられなくてね。'}
        ]
      },
      {
        label:'タグを調べる',
        delta:{ evid:+1, shadow:+1 },
        after:[
          {speaker:'私',   text:'紙札に名前はない。記号だけ。'},
          {speaker:'静茶', text:'ここは、名前より置き場所が大事なんです。'}
        ]
      }
    ]
  },

  // 10 窓締め（自然化）
  {
    bg: BG.living, bgm:'SUSPENSE_LOW',
    lines:[
      {speaker:'静茶', text:'空気が逃げますから。冷えると足音が響きやすくなる。'},
      {speaker:'',     text:'窓が次々と閉まる。'}
    ],
    choices:[
      {
        label:'従う',
        delta:{ trust:+1 },
        after:[
          {speaker:'静茶', text:'今夜は窓の音でわかります。'},
          {speaker:'私',   text:'合図を決めましょう。'}
        ]
      },
      {
        label:'窓を開ける',
        delta:{ trust:-1, shadow:+1 },
        after:[
          {speaker:'私',   text:'湿気が落ち着きます。'},
          {speaker:'静茶', text:'足音も、入りやすくなりますけど。'}
        ]
      }
    ]
  },

  // 11 鏡：もう一つの肩（自然化）
  {
    bg: BG.mirror, bgm:'SUSPENSE_LOW',
    lines:[
      {speaker:'私',   text:'曇りを拭く。拭いたところに、角度の違う“もう一つの肩”。'},
      {speaker:'',     text:'振り返る。畳の上には誰もいない。'},
      {speaker:'当主', text:'……見えてしまったか。'},
      {speaker:'当主', text:'あれはこの家の「重さ」だ。おまえには、まだ重い。忘れろ。'}
    ],
    choices:[
      {
        label:'鏡を覆う',
        delta:{ trust:+1 },
        after:[
          {speaker:'私',   text:'布を掛けます。'},
          {speaker:'当主', text:'賢い。'}
        ]
      },
      {
        label:'映り込みを記録',
        delta:{ evid:+1, shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'私',   text:'肩幅、角度、柱の線——記録。'},
          {speaker:'当主', text:'……覚えておけ。ただし、口にはするな。忘れたふりをしろ。'}
        ]
      }
    ]
  },

  // 12 配膳：余分な椀
  {
    bg: BG.dining, bgm:'WALTZ_SOFT',
    lines:[
      {speaker:'奥様', text:'念のため、もう一人分を。——昔と同じように。'},
      {speaker:'',     text:'椀が静かに増える。'}
    ],
    choices:[
      {
        label:'黙って揃える',
        delta:{ trust:+1, shadow:+1 },
        after:[
          {speaker:'私',   text:'箸は二度数えます。'},
          {speaker:'奥様', text:'ええ。数は、嘘をつくから。'}
        ]
      },
      {
        label:'数を直す',
        delta:{ trust:-1, evid:+1 },
        after:[
          {speaker:'私',   text:'一つ下げます。'},
          {speaker:'奥様', text:'では、来客は裏から入るでしょうね。'}
        ]
      }
    ]
  },

  // 13 便所：叩く音（自然化）
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW',
    lines:[
      {speaker:'私',   text:'戸を閉める。壁の向こうで三度、乾いた音。'},
      {speaker:'当主', text:'返してはいけない。'},
      {speaker:'私',   text:'合図、なのですか。'},
      {speaker:'当主', text:'音は糸より早い。合図は先に届く。だから返すなと言った。'}
    ],
    choices:[
      {
        label:'同じ回数だけ叩く',
        delta:{ shadow:+2 }, se:'EVENT_STING',
        after:[
          {speaker:'',     text:'コン、コン、コン。'},
          {speaker:'私',   text:'……返ってきません。'},
          {speaker:'当主', text:'今は、な。'}
        ]
      },
      {
        label:'静かに念入りに掃除',
        delta:{ trust:+1, evid:+1 },
        after:[
          {speaker:'私',   text:'床溝に糸。誰かが引いた跡。'},
          {speaker:'当主', text:'向こうにも、こちらの数が聞こえている。'}
        ]
      }
    ]
  },

  // 14 納戸：棚の奥（自然化）
  {
    bg: BG.storage, bgm:'EXPLORE',
    lines:[
      {speaker:'私',   text:'棚の奥、濡れている。'},
      {speaker:'当主', text:'触るな。'},
      {speaker:'私',   text:'なぜ。'},
      {speaker:'当主', text:'乾かない水は、動く。'}
    ],
    choices:[
      {
        label:'一緒に確認',
        delta:{ trust:+1, evid:+1 },
        after:[
          {speaker:'私',   text:'染みの縁だけ乾いている……動いた跡。'},
          {speaker:'当主', text:'見たなら、拭け。気づかれないように。'}
        ]
      },
      {
        label:'放っておく',
        delta:{},
        after:[
          {speaker:'',     text:'濡れた線は、少しずつ棚の外へ。'}
        ]
      }
    ]
  },

  // 15 門：古い鍵
  {
    bg: BG.gate, bgm:'EXPLORE',
    lines:[
      {speaker:'静茶', text:'鍵が出ました。古いものです。'},
      {speaker:'',     text:'渡すべきか、彼女は迷っている。'}
    ],
    choices:[
      {
        label:'受け取る',
        delta:{ evid:+1 },
        after:[
          {speaker:'私',   text:'預かります。裏門の方ですね。'},
          {speaker:'静茶', text:'ええ。開く音は、あちらを呼びますから。'}
        ]
      },
      {
        label:'戻させる',
        delta:{ trust:+1 },
        after:[
          {speaker:'静茶', text:'賛成です。無音の方が、夜は安全。'}
        ]
      }
    ]
  },

  // 16 庭：井戸の底（自然化）
  {
    bg: BG.gate, bgm:'SUSPENSE_LOW',
    lines:[
      {speaker:'私',   text:'風のない水面が波打つ。'},
      {speaker:'静茶', text:'夜は見ない方がいいですよ。深いので。'}
    ],
    choices:[
      {
        label:'桶を下ろして確かめる',
        delta:{ evid:+1, shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'私',   text:'底に触れる前に、引っ張られた感覚。'},
          {speaker:'静茶', text:'上がってくる物と、こちらが上げる物は別です。間違えると、戻れなくなります。'}
        ]
      },
      {
        label:'蓋をして離れる',
        delta:{ trust:+1 },
        after:[
          {speaker:'私',   text:'蓋に小石を置きます。'},
          {speaker:'静茶', text:'いいですね。音で分かる。'}
        ]
      }
    ]
  },

  // 17 玄関：夜半の来客（自然化）
  {
    bg: BG.genkan, bgm:'SUSPENSE_LOW',
    lines:[
      {speaker:'',     text:'真夜中の玄関。戸が二度だけ、遠慮がちに鳴る。'},
      {speaker:'奥様', text:'開けないで。開けると、次はもっと強く来ます。'}
    ],
    choices:[
      {
        label:'内鍵を増やし戸を拭く',
        delta:{ trust:+1, evid:+1 },
        after:[
          {speaker:'私',   text:'蝶番の音は消えました。'},
          {speaker:'奥様', text:'なら、朝まで静かに。'}
        ]
      },
      {
        label:'隙間から外を覗く',
        delta:{ shadow:+2 }, se:'EVENT_STING',
        after:[
          {speaker:'私',   text:'……裸足の踵が一つ、戸に寄り添っている。'},
          {speaker:'奥様', text:'見ると、寄って来ます。'}
        ]
      }
    ]
  },

  // 18 廊下：影絵の正体（軽いギャグ）
  {
    bg: BG.hallway, bgm:'WALTZ_SOFT',
    lines:[
      {speaker:'',     text:'障子に影が三つ。歩幅も高さもバラバラ。'},
      {speaker:'私',   text:'（……また“あの人”か）'},
      {speaker:'静茶', text:'……えい。'}
    ],
    choices:[
      {
        label:'静かに注意する',
        delta:{ trust:+1, shadow:-1 },
        after:[
          {speaker:'',     text:'手拭いを広げる静茶。器用に影絵を畳む。'},
          {speaker:'私',   text:'……ほどほどに。'},
          {speaker:'静茶', text:'練習です。夜の悪い影に負けないように。'}
        ]
      },
      {
        label:'影絵に一つ加える',
        delta:{ trust:+1, evid:+1 },
        after:[
          {speaker:'',     text:'私も手で狐を作る。影が四つ、笑う。'},
          {speaker:'静茶', text:'……負けません。'}
        ]
      }
    ]
  },

  // 19 台所：白磁の艶（豆知識）
  {
    bg: BG.kitchen, bgm:'EXPLORE',
    lines:[
      {speaker:'',     text:'白磁の匙に薄い茶渋。光が鈍い。'},
      {speaker:'奥様', text:'磨き粉は切らしていてね……。'}
    ],
    choices:[
      {
        label:'米のとぎ汁で優しく磨く',
        delta:{ trust:+1, evid:+1 },
        after:[
          {speaker:'私',   text:'艶が戻りました。古い脂も浮きます。'},
          {speaker:'奥様', text:'まあ……次からそれでいきましょう。'}
        ]
      },
      {
        label:'柑橘の皮で油膜を取る',
        delta:{ trust:+1, shadow:-1 },
        after:[
          {speaker:'私',   text:'皮の油で薄く拭きます。'},
          {speaker:'奥様', text:'香りが残るのも、悪くないわね。'}
        ]
      }
    ]
  }
  , // ===== ここから追加シーン（append-only） =====

  // 井戸：映り込みに触れない
  {
    bg: BG.gate, bgm:'SUSPENSE_LOW', // 注釈：洗濯桶を持ち井戸へ。水面は見ないで。
    lines:[
      {speaker:'私', text:'ここで水を汲めばいいんですね。'},
      {speaker:'静茶', text:'はい……水面は見ないで。'},
      {speaker:'私', text:'どうして。'},
      {speaker:'静茶', text:'映るのは、今いる人だけじゃないので。'}
    ],
    choices:[
      {
        label:'黙って水を汲む',
        delta:{ trust:+1 },
        after:[
          {speaker:'私', text:'桶、満たしました。'},
          {speaker:'静茶', text:'音で十分です。'}
        ]
      },
      {
        label:'水面を覗き込む',
        delta:{ evid:+1, shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'私', text:'……微かな笑い声。'},
          {speaker:'静茶', text:'聞こえましたか。'}
        ]
      },
      {
        label:'蓋をして小石で目印を置く',
        delta:{ trust:+1, evid:+1 },
        after:[
          {speaker:'私', text:'次に動いたら分かります。'},
          {speaker:'静茶', text:'いい工夫です。'}
        ]
      }
    ]
  },

  // 風呂場：鏡の呼び声
  {
    bg: BG.mirror, bgm:'SUSPENSE_LOW', // 注釈：湯気。曇った鏡。返事禁止。
    lines:[
      {speaker:'私', text:'鏡が曇ってますね。'},
      {speaker:'静茶', text:'湯気の奥、覗かない方がいいです。'},
      {speaker:'私', text:'ただの鏡でしょう。'},
      {speaker:'静茶', text:'名前を呼ばれたら、返さないで。'}
    ],
    choices:[
      {
        label:'鏡を布で覆う',
        delta:{ trust:+1 },
        after:[
          {speaker:'私', text:'布、掛けました。'},
          {speaker:'静茶', text:'賢いです。'}
        ]
      },
      {
        label:'名を呼ばれても黙る訓練をする',
        delta:{ trust:+1, evid:+1 },
        after:[
          {speaker:'', text:'……（呼ぶ声）'},
          {speaker:'私', text:'返しません。'}
        ]
      },
      {
        label:'曇りを拭き切って確かめる',
        delta:{ shadow:+2 }, se:'EVENT_STING',
        after:[
          {speaker:'私', text:'もう一つの“肩”が、角度違いで。'},
          {speaker:'静茶', text:'重いので、忘れてください。'}
        ]
      }
    ]
  },

  // 便所：紙は左右どちら
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW', // 注釈：和式。棚に紙が二つ。外で二度ノック。
    lines:[
      {speaker:'私', text:'紙、左に置きますね。'},
      {speaker:'静茶', text:'左は……夜に足音が来ます。'},
      {speaker:'私', text:'右だと。'},
      {speaker:'静茶', text:'沈黙です。'}
    ],
    choices:[
      {
        label:'左に置く（足音を囮にする）',
        delta:{ evid:+1, shadow:+1 },
        after:[
          {speaker:'', text:'とん、とん。'},
          {speaker:'私', text:'誘導できます。'}
        ]
      },
      {
        label:'右に置く（静けさを選ぶ）',
        delta:{ trust:+1 },
        after:[
          {speaker:'静茶', text:'静かな方が落ち着きます。'},
          {speaker:'私', text:'注意は増やします。'}
        ]
      },
      {
        label:'中央に置き印を付ける',
        delta:{ evid:+1, trust:-1 },
        after:[
          {speaker:'私', text:'動いたら分かるように。'},
          {speaker:'静茶', text:'……気づかれやすくもなります。'}
        ]
      }
    ]
  },

  // 納戸：手が出る板
  {
    bg: BG.storage, bgm:'EXPLORE', // 注釈：布団の山。奥の板は触らない。
    lines:[
      {speaker:'私', text:'布団を奥に詰めます。'},
      {speaker:'静茶', text:'その奥の板、触らないで。'},
      {speaker:'私', text:'なぜ。'},
      {speaker:'静茶', text:'去年まで、そこから手が出て家事を。'}
    ],
    choices:[
      {
        label:'二人で確認し最小限だけ動かす',
        delta:{ trust:+1, evid:+1 },
        after:[
          {speaker:'私', text:'縁だけ乾き……動いた跡。'},
          {speaker:'静茶', text:'見たなら、拭きます。'}
        ]
      },
      {
        label:'封をして札を貼る',
        delta:{ trust:+1, shadow:-1 },
        after:[
          {speaker:'私', text:'札を。'},
          {speaker:'静茶', text:'音が減ります。'}
        ]
      },
      {
        label:'板の裏を覗く',
        delta:{ shadow:+2 }, se:'EVENT_STING',
        after:[
          {speaker:'', text:'かすかな爪の音。'},
          {speaker:'私', text:'……今日は出たい日。'}
        ]
      }
    ]
  },

  // 玄関：一足多い靴（別案）
  {
    bg: BG.genkan, bgm:'EXPLORE', // 注釈：数が多い。迎えが近い。
    lines:[
      {speaker:'私', text:'靴が一足、多いですね。'},
      {speaker:'当主', text:'触るな。持ち主は迎えに来る。'},
      {speaker:'私', text:'いつです。'},
      {speaker:'当主', text:'近いうちに。'}
    ],
    choices:[
      {
        label:'並べ直して土を払う',
        delta:{ trust:+1 },
        after:[
          {speaker:'私', text:'泥はまだ湿っている。'},
          {speaker:'当主', text:'今夜の客だ。'}
        ]
      },
      {
        label:'白墨で印を付けて様子を見る',
        delta:{ evid:+1, trust:-1 },
        after:[
          {speaker:'私', text:'動けば分かります。'},
          {speaker:'当主', text:'覚えられるぞ。'}
        ]
      },
      {
        label:'戸を二重に施錠して下がる',
        delta:{ trust:+1, shadow:+1 },
        after:[
          {speaker:'', text:'外で砂利が一歩。'},
          {speaker:'当主', text:'迎えが近い。'}
        ]
      }
    ]
  },

  // 台所：夜に切れる包丁
  {
    bg: BG.kitchen, bgm:'SUSPENSE_LOW', // 注釈：研ぎ音。戸が少し開く。
    lines:[
      {speaker:'私', text:'包丁、よく切れますね。'},
      {speaker:'静茶', text:'夜の方が切れ味がいいです。'},
      {speaker:'私', text:'なぜ夜。'},
      {speaker:'静茶', text:'研いでいるのは私じゃなく、もう一人。'}
    ],
    choices:[
      {
        label:'鞘に収め布で巻く',
        delta:{ trust:+1, shadow:-1 },
        after:[
          {speaker:'私', text:'音は止めました。'},
          {speaker:'静茶', text:'安全です。'}
        ]
      },
      {
        label:'研ぎ音の主を確かめに行く',
        delta:{ shadow:+2, evid:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'', text:'金属音が戸の隙間を擦る。'},
          {speaker:'私', text:'人を研いでる音……。'}
        ]
      },
      {
        label:'刃先を紙で試し記録する',
        delta:{ evid:+1, trust:-1 },
        after:[
          {speaker:'私', text:'切断痕、異常に滑らか。'},
          {speaker:'静茶', text:'口にはしないでください。'}
        ]
      }
    ]
  },

  // 書斎：日記が日を作る
  {
    bg: BG.study, bgm:'EXPLORE', // 注釈：古い日記が山。針が一瞬逆回転。
    lines:[
      {speaker:'私', text:'日記がたくさん……。'},
      {speaker:'当主', text:'一日分ずつ、この家が書かせる。'},
      {speaker:'私', text:'書き忘れると。'},
      {speaker:'当主', text:'次の日が来ない。'}
    ],
    choices:[
      {
        label:'今日の空欄を埋めるのを手伝う',
        delta:{ trust:+1 },
        after:[
          {speaker:'私', text:'最低限の事実だけ。'},
          {speaker:'当主', text:'それでいい。'}
        ]
      },
      {
        label:'前任の最終頁を読む',
        delta:{ evid:+1, shadow:+1 },
        after:[
          {speaker:'私', text:'昨日に閉じ込められた記述。'},
          {speaker:'当主', text:'確認はしない方がいい。'}
        ]
      },
      {
        label:'時計を布で覆う',
        delta:{ trust:+1, shadow:-1 },
        after:[
          {speaker:'', text:'針の音が遠のく。'},
          {speaker:'私', text:'揺れは収まりました。'}
        ]
      }
    ]
  },

  // 屋根裏：昨日と明日
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW', // 注釈：埃。時間が重なる。
    lines:[
      {speaker:'私', text:'物音がしたので。'},
      {speaker:'静茶', text:'屋根裏は、昼でも夜です。'},
      {speaker:'私', text:'暗いだけじゃ。'},
      {speaker:'静茶', text:'時間がないんです、ここ。'}
    ],
    choices:[
      {
        label:'梯子を上げて入口を閉じる',
        delta:{ trust:+1 },
        after:[
          {speaker:'私', text:'今は閉じておきます。'},
          {speaker:'静茶', text:'戻れなくなるよりは。'}
        ]
      },
      {
        label:'短時間だけ覗き影を数える',
        delta:{ evid:+1, shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'私', text:'……影が一つ増えました。'},
          {speaker:'静茶', text:'昨日の人か、明日の人。'}
        ]
      },
      {
        label:'糸電話のように糸を垂らす',
        delta:{ evid:+1, trust:-1 },
        after:[
          {speaker:'', text:'糸がぴんと張る。'},
          {speaker:'私', text:'誰かが触っています。'}
        ]
      }
    ]
  },

  // 廊下：外とつながる
  {
    bg: BG.hallway, bgm:'SUSPENSE_LOW', // 注釈：冷たい風。床が空になる向こう。
    lines:[
      {speaker:'私', text:'窓は全部閉まってますよね。'},
      {speaker:'静茶', text:'ええ。でも廊下は外とつながってます。'},
      {speaker:'私', text:'庭ではなく。'},
      {speaker:'静茶', text:'“外”です。'}
    ],
    choices:[
      {
        label:'敷居に塩線を引く',
        delta:{ trust:+1, shadow:-1 },
        after:[
          {speaker:'', text:'風が弱まる。'},
          {speaker:'私', text:'足音が減りました。'}
        ]
      },
      {
        label:'足音の数を刻みで記録する',
        delta:{ evid:+1 },
        after:[
          {speaker:'私', text:'一歩、二歩……増えました。'},
          {speaker:'静茶', text:'廊下が歩いてるんです。'}
        ]
      },
      {
        label:'開口部を一つだけ開け囮にする',
        delta:{ evid:+1, shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'', text:'冷気が一点に集まる。'},
          {speaker:'私', text:'誘導はできています。'}
        ]
      }
    ]
  },

  // 地下室：“置き場所”
  {
    bg: BG.storage, bgm:'SUSPENSE_LOW', // 注釈：湿った階段。奥にランプ。
    lines:[
      {speaker:'私', text:'誰かいますか。'},
      {speaker:'当主', text:'ここは“置き場所”だ。'},
      {speaker:'私', text:'見つけた物と……見つかった人。'},
      {speaker:'当主', text:'元に戻すときもある。'}
    ],
    choices:[
      {
        label:'上に戻る（今は触れない）',
        delta:{ trust:+1 },
        after:[
          {speaker:'当主', text:'正解だ。'},
          {speaker:'私', text:'息が軽くなりました。'}
        ]
      },
      {
        label:'棚の配置を控える',
        delta:{ evid:+1, trust:-1 },
        after:[
          {speaker:'私', text:'戻せるように記録。'},
          {speaker:'当主', text:'覚えられるぞ。'}
        ]
      },
      {
        label:'ランプの奥を覗く',
        delta:{ shadow:+2 }, se:'EVENT_STING',
        after:[
          {speaker:'', text:'誰かの息。'},
          {speaker:'当主', text:'置かれたくないなら、上がれ。'}
        ]
      }
    ]
  },

  // 洗面所：曇り取り（軽い緩和）
  {
    bg: BG.mirror, bgm:'WALTZ_SOFT', // 注釈：朝。洗面器に水。じゃんけんの冗談。
    lines:[
      {speaker:'私', text:'鏡がまた曇ってますね。'},
      {speaker:'静茶', text:'じゃんけんで曇りを取ります。'},
      {speaker:'私', text:'負けたら。'},
      {speaker:'静茶', text:'曇り役です。鏡の向こうで。'}
    ],
    choices:[
      {
        label:'普通に拭く',
        delta:{ trust:+1 },
        after:[
          {speaker:'私', text:'手早く終わらせます。'},
          {speaker:'静茶', text:'助かります。'}
        ]
      },
      {
        label:'曇り役の合図を決める',
        delta:{ evid:+1 },
        after:[
          {speaker:'私', text:'三度叩いたら交代。'},
          {speaker:'静茶', text:'了解です。'}
        ]
      },
      {
        label:'冗談は断り距離を取る',
        delta:{ trust:+1, shadow:-1 },
        after:[
          {speaker:'私', text:'私はそういうのは得意ではありません。'},
          {speaker:'静茶', text:'……では現実的に。'}
        ]
      }
    ]
  },

  // 豆知識1：台所（昆布と夜の濃さ）
  {
    bg: BG.kitchen, bgm: 'EXPLORE', // 注釈：夕食の下ごしらえ
    lines:[
      {speaker:'私', text:'この昆布、やけに黒いですね。'},
      {speaker:'静茶', text:'夜が濃いと、昆布も黒くなるんです。'},
      {speaker:'私', text:'夜が……濃い？'},
      {speaker:'静茶', text:'夜食を探す“客”が多い時は特に。'},
      {speaker:'私', text:'……客？'}
    ],
    choices:[
      {
        label:'料理を続ける',
        delta:{ trust:+1 },
        after:[
          {speaker:'静茶', text:'味は濃いほど持ちます。'},
          {speaker:'私', text:'夜も、ですか。'}
        ]
      },
      {
        label:'火を弱めて様子を見る',
        delta:{ evid:+1, shadow:+1 },
        after:[
          {speaker:'私', text:'……外の足音が増えました。'},
          {speaker:'静茶', text:'匂いは呼びますから。'}
        ]
      },
      {
        label:'調理を中止して戸を閉める',
        delta:{ trust:+1, shadow:-1 },
        after:[
          {speaker:'私', text:'戸は押さえておきます。'},
          {speaker:'静茶', text:'冷めると味は落ちますけど。'}
        ]
      }
    ]
  },

  // 豆知識2：庭（山田）
  {
    bg: BG.dining, bgm: 'EXPLORE', // 注釈：植木の手入れ（庭BGは流用）
    lines:[
      {speaker:'私', text:'この鉢、“山田”って札が……苗の名前ですか？'},
      {speaker:'静茶', text:'人の名前です。元・家政夫の。'},
      {speaker:'私', text:'どうしてここに？'},
      {speaker:'静茶', text:'植木と一緒に、土に混ざってますから。'}
    ],
    choices:[
      {
        label:'札を外して拭う',
        delta:{ evid:+1, shadow:+1 }, se:'EVENT_STING',
        after:[
          {speaker:'静茶', text:'山田さん、怒りますよ。'},
          {speaker:'私', text:'……風が止みました。'}
        ]
      },
      {
        label:'そのままにして水をやる',
        delta:{ trust:+1 },
        after:[
          {speaker:'静茶', text:'植物は喜びますから。'},
          {speaker:'私', text:'……喜んでいるのは植物だけですね。'}
        ]
      },
      {
        label:'土を少し掘って確かめる',
        delta:{ evid:+1, shadow:+2 }, se:'EVENT_STING',
        after:[
          {speaker:'私', text:'白い欠片。……骨？'},
          {speaker:'静茶', text:'見たなら、戻してください。見なかった数に。'}
        ]
      }
    ]
  },

  // 豆知識3：居間（家政婦の歴史）
  {
    bg: BG.living, bgm: 'WALTZ_SOFT', // 注釈：古い写真帳をめくる
    lines:[
      {speaker:'私', text:'この写真、昔の家政婦さん？'},
      {speaker:'当主', text:'百年前から顔は変わらない。'},
      {speaker:'私', text:'……同じ人？'},
      {speaker:'当主', text:'名前を消せば、前任の仕事を引き継ぐ。'}
    ],
    choices:[
      {
        label:'名簿を開く',
        delta:{ evid:+1, trust:-1 },
        after:[
          {speaker:'私', text:'私の名前も……ありますね。'},
          {speaker:'当主', text:'消されなければ、長く務まる。'}
        ]
      },
      {
        label:'写真帳を閉じる',
        delta:{ trust:+1 },
        after:[
          {speaker:'私', text:'知ってしまうと、重そうですから。'},
          {speaker:'当主', text:'賢明だ。'}
        ]
      },
      {
        label:'前任者の欄を探す',
        delta:{ evid:+1, shadow:+1 },
        after:[
          {speaker:'私', text:'前任の印が二重線……消し損ね。'},
          {speaker:'当主', text:'線は消えても、跡は残る。'}
        ]
      }
    ]
  }

// ===== 追加ここまで =====
];

// ===== ここまで =====
