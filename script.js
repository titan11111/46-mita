// ===============================
// 画像・音声マップ（あなたの .png / mp3 に合わせて最適化）
// ===============================
const BG = {
  title:   'images/ch1_title.png',
  gate:    'images/house_gate.png',
  welcome: 'images/ch1_char_welcome_group.png',
  genkan:  'images/genkan_dark.png',
  living:  'images/living_room_traditional.png',
  kitchen: 'images/kitchen_old.png',
  hallway: 'images/ch1_shoji_eavesdrop.png',   // 夜廊下の雰囲気に流用
  moon:    'images/ch1_title.png',             // 月夜の代替（素材未収ならタイトルを流用）
  spoon:   'images/ch1_porcelain_spoon.png',
  tanzaku: 'images/ch1_windchime_tanzaku.png',
  study:   'images/ch1_study_peek.png',
  dining:  'images/ch1_family_gathering.png',
  discovery: 'images/ch1_body_discovery.png',
  meeting:   'images/ch1_secret_meeting.png',
  storage:   'images/ch1_storage_dryplate.png',
  mirror:    'images/ch1_mirror_crack.png',
  shrine:    'images/ch1_shrine_small.png',
  footprints:'images/ch1_wet_footprints.png',
  attic:     'images/ch1_attic_beams.png',
  silhouette:'images/ch1_shoji_silhouette.png'
};

// BGMは“1本のプレイヤー”で管理（重複再生を防止）
const BGM = {
  WALTZ_SOFT:      'audio/bgm_taisho_waltz_soft.mp3', // 柔らかめ（タイトル/穏やか）
  EXPLORE:         'audio/bgm_explore_ambient.mp3',   // 探索
  SUSPENSE_LOW:    'audio/bgm_suspense_low.mp3',      // 不穏
  END_REPRISE:     'audio/bgm_end_reprise.mp3',       // 章末/余韻
  EVENT_STING:     'audio/bgm_event_sting.mp3'        // ちょい演出（SE的に使用）
};

// 効果音（任意・共通SEに EVENT_STING を流用）
const SE = {
  sting: 'audio/bgm_event_sting.mp3'
};

// ===============================
// BGM プレイヤー（クロスフェード）
// ===============================
let currentBGM = null;
let currentBGMName = '';
let fadeTimer = null;
const bgmVolumeTarget = 0.55;

function playBGM(name) {
  const path = BGM[name];
  if (!path) return;

  // 既に同じ曲なら何もしない
  if (currentBGM && currentBGMName === name) return;

  const next = new Audio(path);
  next.loop = true;
  next.volume = 0;

  // 旧BGMのフェードアウト
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  const prev = currentBGM;

  next.play().catch(()=>{});
  currentBGM = next;
  currentBGMName = name;

  const step = 0.05;
  fadeTimer = setInterval(() => {
    // フェードイン
    if (currentBGM && currentBGM.volume < bgmVolumeTarget) {
      currentBGM.volume = Math.min(bgmVolumeTarget, currentBGM.volume + step);
    }
    // フェードアウト
    if (prev) {
      prev.volume = Math.max(0, prev.volume - step);
      if (prev.volume <= 0) { prev.pause(); }
    }
    // 完了
    if ((!prev || prev.volume <= 0) && currentBGM.volume >= bgmVolumeTarget) {
      clearInterval(fadeTimer); fadeTimer = null;
    }
  }, 100);
}

function stopBGM() {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  if (currentBGM) { currentBGM.pause(); currentBGM = null; currentBGMName = ''; }
}

// 効果音（ワンショット）
function playSE(name) {
  const path = SE[name];
  if (!path) return;
  const a = new Audio(path);
  a.volume = 0.8;
  a.play().catch(()=>{});
}

// ===============================
// ゲーム状態
// ===============================
let gameState = {
  currentScene: 'opening',
  currentStep: 0,
  hk: 0, det: 0, clue: 0, sus: 0,
  flags: { spoon:false, tanzaku:false, dry:false, meet:false, gate_check:false, kitchen_tool:false, question:false },
  isSkipping: false,
  log: []
};

// ===============================
// 実行
// ===============================
function startGame(){ gameState.currentScene='opening'; gameState.currentStep=0; nextStep(); }

function nextStep(){
  if (gameState.isSkipping) return;
  const cur = scripts[gameState.currentScene];
  if (!cur || gameState.currentStep >= cur.length) return;
  executeStep(cur[gameState.currentStep]);
}

function executeStep(step){
  // 背景
  if (step.bg) changeBackground(step.bg);
  // BGM
  if (step.bgm) playBGM(step.bgm);
  // SE
  if (step.se) playSE(step.se);
  // テキスト
  if (step.say) displayText(step.say[0], step.say[1]);
  // 選択肢
  if (step.choice){ displayChoices(step.choice); return; }
  // ジャンプ
  if (step.jump){ gameState.currentScene = step.jump; gameState.currentStep = 0; nextStep(); return; }
  // 任意処理
  if (step.run) step.run();
  // ステ変動
  if (step.add) add(step.add);

  // 自動進行は使わない（クリックでのみ進行）
  gameState.currentStep++;
}

function changeBackground(path){
  const el = document.getElementById('background');
  el.classList.add('fade-out');
  setTimeout(()=>{ el.style.backgroundImage = `url(${path})`; el.classList.remove('fade-out'); }, 200);
}

function displayText(speaker, text){
  document.getElementById('speakerName').textContent = speaker;
  document.getElementById('mainText').innerHTML = text;
  if (text) addToLog(speaker, text);
}

function displayChoices(choices){
  const area = document.getElementById('choiceArea');
  const textArea = document.getElementById('textArea');
  area.innerHTML = ''; textArea.classList.add('choices-active');

  choices.forEach(ch=>{
    const btn = document.createElement('button');
    btn.className = 'choice-button';
    btn.textContent = ch.label;
    btn.onclick = (e)=>{
      e.stopPropagation();
      if (ch.onChoose) ch.onChoose();
      area.innerHTML = ''; textArea.classList.remove('choices-active');
      gameState.currentScene = ch.to;
      gameState.currentStep = 0;
      nextStep();
    };
    area.appendChild(btn);
  });
}

// ステータス
function add(v){
  if (v.hk !== undefined){ gameState.hk = clamp(gameState.hk + v.hk, 0, 10); }
  if (v.det !== undefined){ gameState.det = clamp(gameState.det + v.det, 0, 10); }
  if (v.clue !== undefined){ gameState.clue = Math.max(0, gameState.clue + v.clue); }
  if (v.sus !== undefined){ gameState.sus = clamp(gameState.sus + v.sus, 0, 10); }
  updateHUD();
}
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function updateHUD(){
  document.getElementById('hkValue').textContent = gameState.hk;
  document.getElementById('detValue').textContent = gameState.det;
  document.getElementById('clueValue').textContent = gameState.clue;
  document.getElementById('susValue').textContent = gameState.sus;
  document.getElementById('hkGauge').style.width = (gameState.hk*10)+'%';
  document.getElementById('detGauge').style.width = (gameState.det*10)+'%';
}

// ログ
function addToLog(speaker,text){ gameState.log.push({speaker, text, t:new Date()}); }
function toggleLog(){
  const p = document.getElementById('logPanel');
  if (p.style.display === 'block') { p.style.display='none'; return; }
  p.style.display='block'; displayLog();
}
function displayLog(){
  const c = document.getElementById('logContent'); c.innerHTML='';
  gameState.log.forEach(ent=>{
    const div = document.createElement('div'); div.className='log-entry';
    div.innerHTML = `<div class="log-speaker">${ent.speaker||'ナレーション'}</div><div>${ent.text}</div>`;
    c.appendChild(div);
  });
}

// スキップ（クリック進行なので「オフが通常」）
function toggleSkip(){
  gameState.isSkipping = !gameState.isSkipping;
  document.getElementById('skipBtn').classList.toggle('active', gameState.isSkipping);
  document.getElementById('skipBtn').textContent = gameState.isSkipping ? 'SKIP ON' : 'SKIP';
}

// セーブ/ロード
function saveGame(){ localStorage.setItem('mitaGameSave', JSON.stringify(gameState)); alert('ゲームをセーブしました'); }
function loadGame(){
  const s = localStorage.getItem('mitaGameSave');
  if (!s) return alert('セーブデータがありません');
  gameState = JSON.parse(s); updateHUD(); nextStep(); alert('ゲームをロードしました');
}
function showSettings(){ alert('設定機能は開発中です'); }

// クリックで進行（選択肢/ログ表示中は無効）
document.addEventListener('DOMContentLoaded', ()=>{
  startGame();
  document.getElementById('gameContainer').addEventListener('click', (ev)=>{
    if (ev.target.closest('button')) return;
    const logPanel = document.getElementById('logPanel');
    const choiceArea = document.getElementById('choiceArea');
    if (logPanel && logPanel.style.display === 'block') return;
    if (choiceArea && choiceArea.children.length > 0) return;
    nextStep();
  });
});

// ===============================
// シナリオ（内面描写入り）
// ===============================
const scripts = {
  opening: [
    { bg: BG.gate,  bgm: 'WALTZ_SOFT', say:['', '午後四時過ぎ。山裾に建つ古い屋敷の前で、私は足を止めた。'] },
    {                se: null,         say:['', '（……風もないのに風鈴が鳴っている。誰かが、私の到着を知っている）'] },
    {                se: null,         say:['', '門の奥から、微かな視線を感じる。'] },
    {                                  say:['', '（……歓迎か、警戒か。私は家事だけでなく、“観察”を任されている）'] },
    {                                  say:['', '——私に任されたのは、この家の家事全般と、ある観察だった。'] },
    { jump:'ch1_welcome' }
  ],

  ch1_welcome: [
    { bg: BG.welcome, bgm:'WALTZ_SOFT', say:['奥様','まあ、ようこそ。今日から来てくださる家政婦さんですね'] },
    {                                  say:['', '（……柔らかな声。けれど目の奥は油断がない）'] },
    {                                  say:['当主','……中へ入りなさい。冷える'] },
    {                                  say:['', '（……命令の調子。反応を測られている）'] },
    {                                  say:['静茶','……'] },
    {                                  say:['', '（……口数は少ないが、視線はよく動く）'] },
    { choice:[
      { label:'奥様に従って居間へ向かう', to:'ch1_genkan_normal', onChoose:()=>add({hk:1}) },
      { label:'音のした方へ引き返してみる', to:'ch1_genkan_sound',  onChoose:()=>add({det:1,sus:1}) },
      { label:'玄関の調度品を観察する',     to:'ch1_genkan_observe',onChoose:()=>add({det:1,clue:1}) }
    ] }
  ],

  ch1_genkan_normal: [
    { bg: BG.genkan, say:['', '玄関の奥、暗がりの中に廊下が続く。'] },
    {               say:['', '（……古い家の匂い。物の配置も、人の気配も、順に記憶する）'] },
    { jump:'ch1_living' }
  ],

  ch1_genkan_sound: [
    { bg: BG.genkan, say:['', '足を踏み入れると、背後の門の方で、何かが揺れた音がした。'] },
    {               say:['', '振り返った時には、もう何もない。'] },
    {               say:['', '（……足音を消すのは、私だけとは限らない）'] },
    { run:()=>gameState.flags.gate_check=true },
    { jump:'ch1_living' }
  ],

  ch1_genkan_observe: [
    { bg: BG.genkan, say:['', '玄関には古い花瓶や掛け軸が配置されている。どれも上質だが、配置が微妙に不自然だ。'] },
    {               say:['家政婦','この配置……誰かが最近動かした？'] },
    {               say:['', '（……見栄えのためか、隠すためか）'] },
    { jump:'ch1_living' }
  ],

  ch1_living: [
    { bg: BG.living, bgm:'WALTZ_SOFT', say:['奥様','この家では夜になると廊下を走らないこと。音が響くから'] },
    {                                   say:['', '（……夜の廊下で、隠したい音がある）'] },
    {                                   say:['当主','……それと、二階の西側の部屋には近づくな'] },
    {                                   say:['', '（……“近づくな”は“覗くな”。なら、覗く価値がある）'] },
    { jump:'ch1_kitchen_guide' }
  ],

  ch1_kitchen_guide: [
    { bg: BG.kitchen, bgm:'EXPLORE', say:['奥様','明日の朝は七時に食事をお願いします。献立は……'] },
    {                                 say:['', '（……献立より、出入口と道具の配置。まず環境を押さえる）'] },
    { choice:[
      { label:'台所の勝手口を確認する', to:'ch1_kitchen_door',     onChoose:()=>add({det:1,clue:1}) },
      { label:'調理道具の配置を覚える', to:'ch1_kitchen_tools',    onChoose:()=>add({hk:2}) },
      { label:'奥様に質問をする',       to:'ch1_kitchen_question', onChoose:()=>add({hk:1,sus:1}) }
    ] }
  ],

  ch1_kitchen_door: [
    { say:['', '勝手口の鍵は掛かっているが、土の汚れが新しい。最近誰かが出入りした形跡がある。'] },
    { say:['家政婦','この汚れ……昨日の雨にしては妙ですね。'] },
    { say:['', '（……成人の足、歩幅はやや広い。急ぎ足か、背が高い）'] },
    { jump:'ch1_night_setup' }
  ],

  ch1_kitchen_tools: [
    { say:['', '包丁、まな板、鍋……どれも良く手入れされているが、白磁の匙だけが微妙に位置がずれている。'] },
    { say:['家政婦','明日から、きちんと整理してお手伝いします。'] },
    { say:['', '（……“整理”は擬態。手癖と動線を測るため）'] },
    { run:()=>gameState.flags.kitchen_tool=true },
    { jump:'ch1_night_setup' }
  ],

  ch1_kitchen_question: [
    { say:['家政婦','この家には、他に使用人の方はいらっしゃるのですか？'] },
    { say:['奥様','いえ……あなただけです。静かな家ですから。'] },
    { say:['', '奥様の返事に、微かな躊躇があったような気がした。'] },
    { say:['', '（……“出入りの誰か”については触れなかった）'] },
    { run:()=>gameState.flags.question=true },
    { jump:'ch1_night_setup' }
  ],

  ch1_night_setup: [
    { bg: BG.hallway, bgm:'SUSPENSE_LOW', say:['', '消灯後、廊下を歩いていると、二階の西側から衣擦れの音が聞こえる。'] },
    {                                        say:['', '……誰もいないはずの部屋だ。'] },
    {                                        say:['', '（……禁じられた部屋。禁を設ける理由がある）'] },
    { choice:[
      { label:'音のする方へ行く',  to:'ch1_night_investigate', onChoose:()=>add({det:2,sus:1}) },
      { label:'自室に戻る',        to:'ch1_night_retreat',    onChoose:()=>add({hk:1}) },
      { label:'当主の部屋を訪ねる', to:'ch1_night_ask',        onChoose:()=>add({det:1,sus:2}) }
    ] }
  ],

  ch1_night_investigate: [
    { bg: BG.silhouette, say:['', '二階へ上がると、西側の部屋の障子に人影が映っている。'] },
    {                   say:['', 'だが、ノックをしても返事はない。'] },
    {                   say:['家政婦','……気のせいかもしれません。明日確認しましょう。'] },
    {                   say:['', '（……在室の気配は“いるように見せる”演出か。灯りの向きが不自然）'] },
    { jump:'ch1_morning' }
  ],

  ch1_night_retreat: [
    { bg: BG.moon, say:['', '自室で横になるが、時折廊下を歩く音が聞こえる。'] },
    {          say:['家政婦','古い家ですから……木が軋む音でしょう。'] },
    {          say:['', '（……木だけの音にしては規則的すぎる）'] },
    { jump:'ch1_morning' }
  ],

  ch1_night_ask: [
    { say:['', '当主の部屋を訪ねるが、応答がない。'] },
    { say:['', 'しかし、部屋の中から低い話し声が聞こえる。'] },
    { say:['家政婦','お忙しいようですね……失礼しました。'] },
    { say:['', '（……誰と話していた？ 家族か、外の人間か）'] },
    { jump:'ch1_morning' }
  ],

  ch1_morning: [
    { bg: BG.kitchen, bgm:'EXPLORE', say:['', '翌朝の台所。昨夜とは違い、いくつかの物が微妙に位置を変えている。'] },
    {                               say:['家政婦','整理整頓をしながら、様子を見てみましょう。'] },
    {                               say:['', '（……“片付けた後にまた乱れた”痕が点在）'] },
    { choice:[
      { label:'古い新聞を読む',           to:'ch1_newspaper', onChoose:()=>add({hk:1,clue:1}) },
      { label:'白磁の匙を拭いて観察する', to:'ch1_spoon',     onChoose:()=>add({det:1,clue:1}) },
      { label:'風鈴の短冊を整える',       to:'ch1_tanzaku',   onChoose:()=>add({hk:1,det:1}) }
    ] }
  ],

  ch1_kitchen_2nd: [
    { bg: BG.kitchen, say:['', '最初の作業を終えた。まだ他にも気になる箇所がある。'] },
    { choice:[
      { label:'床下収納を開ける',   to:'ch1_storage',    onChoose:()=>add({det:1,clue:1}) },
      { label:'濡れた足跡を拭き取る', to:'ch1_footprints', onChoose:()=>add({hk:2,clue:1,sus:-1}) },
      { label:'古い鏡を磨く',       to:'ch1_mirror',     onChoose:()=>add({hk:1,det:1}) }
    ] }
  ],

  ch1_kitchen_3rd: [
    { bg: BG.kitchen, say:['', '二つ目の作業も完了した。まだ一つ残っている。'] },
    { choice:[
      { label:'神棚を正しく整える', to:'ch1_shrine',  onChoose:()=>add({hk:2,sus:-1}) },
      { label:'窓からの景色を確認', to:'ch1_window',  onChoose:()=>add({det:1,clue:1}) },
      { label:'調理道具を点検する', to:'ch1_tools',   onChoose:()=>add({hk:1,det:1}) }
    ] }
  ],

  ch1_newspaper: [
    { se:null, say:['', '新聞には、夜半の怪事の記事。時刻と方角の記述が妙に細かい。'] },
    {        say:['家政婦','この記事……この家と関係がありそうです。'] },
    {        say:['', '（……書き手は“音”を知っている調子）'] },
    { run:()=>gameState.flags.meet=true },
    { jump:'ch1_kitchen_2nd' }
  ],

  ch1_spoon: [
    { bg: BG.spoon, se:null, say:['', '美しい白磁の匙。しかし、よく見ると小さな亀裂がある。'] },
    {                     say:['家政婦','割れ目……誰かが急いで扱ったのでしょうか。'] },
    {                     say:['', '（……落下ではなく、捻りの力。焦りの作業）'] },
    { run:()=>gameState.flags.spoon=true },
    { jump:'ch1_kitchen_2nd' }
  ],

  ch1_tanzaku: [
    { bg: BG.tanzaku, se:null, say:['', '短冊には謎めいた詩。二行目だけ墨の濃さが違う。'] },
    {                     say:['家政婦','意図のにおいがします。覚えておきましょう。'] },
    {                     say:['', '（……昨夜の追記。合図か、記録か、牽制か）'] },
    { run:()=>gameState.flags.tanzaku=true },
    { jump:'ch1_kitchen_2nd' }
  ],

  ch1_storage: [
    { bg: BG.storage, say:['', '床板の下から乾板が出てきた。写り込んだ影は、この家の誰とも背丈が違う。'] },
    {                say:['家政婦','この影……屋敷の誰でもありません。'] },
    {                say:['', '（……外の人間。時刻が分かれば、昨夜の音と結べる）'] },
    { run:()=>gameState.flags.dry=true },
    { jump:'ch1_kitchen_3rd' }
  ],

  ch1_footprints: [
    { bg: BG.footprints, say:['', '拭いても拭いても、足跡は勝手に奥へ伸びていく。水気は冷たいのに、風は止んでいる。'] },
    {                      say:['家政婦','……拭き筋が途中で切り替わっています。誰かが向きを変えた。'] },
    { add:{clue:1} },
    {                      say:['', '（……誘導、または脅し。見せるための歩行）'] },
    { jump:'ch1_kitchen_3rd' }
  ],

  ch1_mirror: [
    { bg: BG.mirror, say:['', '鏡面の曇りを拭う。映っているはずのない、長襦袢の肩が一瞬だけ背後に立つ。'] },
    {             say:['家政婦','気配……いえ、拭きムラです。落ち着きましょう。'] },
    { add:{det:1, sus:1} },
    {             say:['', '（……“見せられた錯覚”として記録）'] },
    { jump:'ch1_kitchen_3rd' }
  ],

  ch1_shrine: [
    { bg: BG.shrine, say:['', '供えの向きが家人の習わしと逆。細い灰が一筋、障子の方へ引かれている。'] },
    {              say:['家政婦','並べ直します。……灰の線は合図でしょう。'] },
    { add:{clue:1, sus:-1} },
    {              say:['', '（……廊下の影へ導く印）'] },
    { jump:'ch1_hallway' }
  ],

  ch1_window: [
    { say:['', '窓の外に庭が見える。昨夜は気づかなかったが、庭の石灯籠が倒れている。'] },
    { say:['家政婦','いつ倒れたのでしょうか……風で倒れるような重さではありませんが。'] },
    { add:{clue:1, det:1} },
    { say:['', '（……人が倒した音。“走るな”の理由になる）'] },
    { jump:'ch1_hallway' }
  ],

  ch1_tools: [
    { say:['', '調理道具を一つ一つ点検する。包丁に僅かな錆、まな板に薄い汚れ。正常な使用痕とは異なる。'] },
    { say:['家政婦','手入れは行き届いているのに……何かが足りない。'] },
    { add:{hk:1, clue:1} },
    { say:['', '（……“目的の道具だけ”を急いで扱った痕）'] },
    { jump:'ch1_hallway' }
  ],

  ch1_hallway: [
    { bg: BG.hallway, bgm:'SUSPENSE_LOW', say:['', '夜の廊下。障子の向こうで、月影が一つ増えた気がする。'] },
    {                                         say:['', '（……誰かが灯りを持って動き、背で遮っている）'] },
    { choice:[
      { label:'片づけるふりで近づき、聞き耳を立てる', to:'ch1_listen', onChoose:()=>{ if(gameState.det<2) add({det:1,sus:1}); else add({det:2}); } },
      { label:'音を立てないよう離れる',                 to:'ch1_leave',  onChoose:()=>{ if(gameState.hk>=2) add({hk:1}); else add({sus:1}); } },
      { label:'障子の影を確かめる',                       to:'ch1_shadow', onChoose:()=>add({det:1,clue:1,sus:1}) }
    ] }
  ],

  ch1_listen: [
    { bg: BG.meeting, say:['', 'ささやき声……「二刻前」「西の間」「鈴」。三つの単語だけが繰り返される。'] },
    {               say:['家政婦','耳障りですが、必要な情報です。'] },
    { add:{clue:2} },
    {               say:['', '（……短冊の二行目と結ぶ鍵だ）'] },
    { jump:'ch1_study' }
  ],

  ch1_leave: [
    { say:['家政婦','ここは引き返します。騒がしくしてはいけません。'] },
    { say:['', '（……退く勇気。相手の緊張を緩める）'] },
    { jump:'ch1_study' }
  ],

  ch1_shadow: [
    { bg: BG.silhouette, say:['', '障子の影は、呼吸の合間だけこちらを向く。目が合ったように見えたのは、きっと気のせいだ。'] },
    {                    say:['家政婦','灯りの向きが合いません。誰かが背で隠している。'] },
    {                    say:['', '（……虚に実を隠す）'] },
    { jump:'ch1_study' }
  ],

  ch1_study: [
    { bg: BG.study, say:['静茶','あら、家政婦さん。どちらをお探しですか？'] },
    {               say:['', '（……声は軽い。中立のつもりでも、情報は零れる）'] },
    { choice:[
      { label:'丁寧に事情を説明する', to:'ch1_polite',  onChoose:()=>add({hk:1}) },
      { label:'強引に質問する',       to:'ch1_forceful',onChoose:()=>{ if(gameState.det<4) add({sus:2}); else add({det:1,sus:1}); } },
      { label:'何も言わず立ち去る',   to:'ch1_silent',  onChoose:()=>add({sus:-1,hk:1}) }
    ] }
  ],

  ch1_polite: [
    { say:['静茶','そうですか……分かりました。お力になりましょう。'] },
    { add:{clue:1} },
    { say:['', '（……味方ではないが、道は作る。彼女は“話したい”）'] },
    { jump:'ch1_meeting' }
  ],

  ch1_forceful: [
    { say:['静茶','そのような態度では……協力できません。'] },
    { say:['', '（……押せば閉じる。ここは扉でなく障子。力で破れば音が響く）'] },
    { run:()=>{ if(gameState.sus>3){ gameState.currentScene='bad1'; gameState.currentStep=0; return; } } },
    { jump:'ch1_meeting' }
  ],

  ch1_silent: [
    { say:['', '何も言わず、静かに頭を下げて立ち去る。'] },
    { say:['静茶','……慎重な方ですね。'] },
    { say:['', '（……話さない相手には、話したくなるもの）'] },
    { jump:'ch1_meeting' }
  ],

  ch1_meeting: [
    { bg: BG.dining, bgm:'SUSPENSE_LOW', say:['', '夕餉の卓をはさんで、湯気の向こうに緊張が張る。'] },
    {                                        say:['', '（……言葉の選び方で結論が変わる）'] },
    {                                        say:['当主','……家政婦さん。今日一日で、何を見たか、報告してもらおう'] },
    {                                        say:['', '（……私が観察役であることを承知の口ぶり）'] },
    {                                        say:['奥様','まあまあ、そんなに急かさなくても……。でも、何か気づいたことは？'] },
    {                                        say:['静茶','あの、わたし——'] },
    {                                        say:['当主','静茶'] },
    {                                        say:['静茶','……はい'] },
    { choice:[
      { label:'静かに事実を述べる', to:'ch1_truth',   onChoose:()=>add({hk:1}) },
      { label:'沈黙を保つ',         to:'ch1_silence', onChoose:()=>add({sus:1}) },
      { label:'激しく追及する',     to:'ch1_accuse',  onChoose:()=>add({sus:2,det:1}) }
    ] }
  ],

  ch1_truth: [
    { say:['家政婦','事実をお伝えします。見たこと、揃った証拠に基づいて。'] },
    { say:['', '（……匙の亀裂、短冊の追記、勝手口の土、足跡の反転、灯籠の倒壊、乾板の影）'] },
    { run:()=>{
      const fullSet = gameState.flags.spoon && gameState.flags.tanzaku && gameState.flags.dry;
      if (fullSet && gameState.sus <= 3) { gameState.currentScene='ch1_truth_path'; }
      else if (gameState.sus > 4) { gameState.currentScene='bad2'; }
      else if (gameState.clue >= 3 && gameState.sus <= 2) { gameState.currentScene='ch1_clear'; }
      else { gameState.currentScene='bad1'; }
      gameState.currentStep=0;
    } }
  ],

  ch1_silence: [
    { say:['家政婦','……まだ整っていないところがあります。'] },
    { run:()=>{ if(gameState.sus>4){ gameState.currentScene='bad2'; gameState.currentStep=0; } } },
    { jump:'ch1_clear' }
  ],

  ch1_accuse: [
    { say:['家政婦','ここまでの乱れは、偶然ではありません。'] },
    { run:()=>{
      if (gameState.sus>4) gameState.currentScene='bad2';
      else gameState.currentScene='ch1_clear';
      gameState.currentStep=0;
    } }
  ],

  ch1_truth_path: [
    { bg: BG.discovery, bgm:'END_REPRISE', se:null,
      say:['', '匙の亀裂、短冊の詩、乾板の影、そして濡れた足跡。掃除で整えた順序が、そのまま犯行の動線になっていた。'] },
    { say:['家政婦','理由と時刻、手順が揃いました。これ以上は、乱れを許しません。'] },
    { jump:'ch1_clear' }
  ],

  ch1_clear: [
    { bg: BG.moon, bgm:'END_REPRISE', say:['', '見事に事態は収まった。静けさが戻ってくる。'] },
    {                              say:['家政婦','これで第一章はおしまいです。明日も整えておきます。'] },
    {                              say:['', '第一章クリア！\n\n続きは scripts にシーンを追加してお楽しみください。'] }
  ],

  bad1: [
    { bg: BG.title, bgm:'END_REPRISE', say:['', '疑惑が深まりすぎた。あなたは真相にたどり着けなかった……'] },
    {                              say:['家政婦','配慮が足りませんでした。次は静かに。'] },
    {                              say:['', 'BAD END\n\n最初からやり直してみよう。'] }
  ],

  bad2: [
    { bg: BG.title, bgm:'END_REPRISE', say:['', 'あまりにも疑惑を持たれ、屋敷から追い出されてしまった……'] },
    {                              say:['家政婦','信頼は、道具より大切です。'] },
    {                              say:['', 'BAD END\n\n違うアプローチを試してみよう。'] }
  ]
};
