/* =====================================================
   LEVEL UP — Power Up Your Knowledge!
   FIXED: KaTeX auto-render for proper math display
   Handles fractions, powers, surds, dollar signs
   ===================================================== */

// ── Game State ──
let allQuestions = [];
let gameQuestions = [];
let currentIdx = 0;
let score = 0;
let enemyHP = 100;
let playerHP = 100;
let combo = 0;
let maxCombo = 0;
let correctCount = 0;
let playerLevel = 1;
let questionStartTime;
let timerInterval;
let katexReady = false;
const DEFAULT_TIME_LIMIT = 30000;
const TOTAL_QUESTIONS = 12;

// ── DOM References ──
const $ = (id) => document.getElementById(id);

const screens = {
  login:  $('login-screen'),
  battle: $('battle-screen'),
  end:    $('end-screen')
};

const pinInput        = $('pin-input');
const startBtn        = $('start-btn');
const errorMsg        = $('error-msg');
const scoreDisplay    = $('score-display');
const enemyHPFill     = $('enemy-hp-fill');
const playerHPFill    = $('player-hp-fill');
const playerSprite    = $('player-sprite');
const enemySprite     = $('enemy-sprite');
const fireball        = $('fireball');
const enemyProjectile = $('enemy-projectile');
const explosion       = $('explosion');
const comboDisplay    = $('combo-display');
const critDisplay     = $('crit-display');
const missDisplay     = $('miss-display');
const healDisplay     = $('heal-display');
const damageNumber    = $('damage-number');
const levelUpFlash    = $('level-up-flash');
const timerFill       = $('timer-fill');
const qText           = $('q-text');
const optionsContainer= $('options-container');
const qProgress       = $('q-progress');
const particlesEl     = $('particles');

// ── Viewport fix for mobile browsers ──
function fixViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
fixViewportHeight();
window.addEventListener('resize', fixViewportHeight);
window.addEventListener('orientationchange', () => {
  setTimeout(fixViewportHeight, 200);
});

// ═══════════════════════════════════════════
//  KATEX — Wait for it to load
// ═══════════════════════════════════════════

function waitForKaTeX() {
  return new Promise((resolve) => {
    if (typeof katex !== 'undefined' && typeof renderMathInElement === 'function') {
      katexReady = true;
      resolve();
      return;
    }
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (typeof katex !== 'undefined' && typeof renderMathInElement === 'function') {
        clearInterval(check);
        katexReady = true;
        resolve();
      } else if (attempts > 80) {
        clearInterval(check);
        console.warn('KaTeX failed to load — showing raw text');
        resolve();
      }
    }, 100);
  });
}

// ═══════════════════════════════════════════
//  MATH RENDERING — using KaTeX auto-render
//  This properly handles:
//    $\frac{1}{2}$     → fraction
//    $x^{2}$           → power
//    $\sqrt{3}$        → surd
//    $\$400$           → $400 (currency)
//    Spacing between text and math
// ═══════════════════════════════════════════

function renderMathIn(element) {
  if (!katexReady) return;
  try {
    renderMathInElement(element, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false }
      ],
      throwOnError: false,
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
    });
  } catch (e) {
    console.warn('KaTeX render error:', e);
  }
}

function setMathText(element, text) {
  if (!text) { element.textContent = ''; return; }
  // Set as textContent first (safe, preserves all characters)
  element.textContent = text;
  // Then let KaTeX auto-render find and render $...$ blocks
  renderMathIn(element);
}

function normalise(s) {
  return s ? s.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

// ── Audio (Web Audio API — no external files) ──
let audioCtx;
function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) {}
  }
}

function playSound(type) {
  if (!audioCtx) return;
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const t = audioCtx.currentTime;

    switch (type) {
      case 'correct':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, t);
        osc.frequency.setValueAtTime(659, t + 0.08);
        osc.frequency.setValueAtTime(784, t + 0.16);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.35);
        break;
      case 'crit':
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.25);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.35);
        break;
      case 'wrong':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.35);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.35);
        break;
      case 'hit':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t); osc.stop(t + 0.2);
        break;
      case 'heal':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(554, t + 0.1);
        osc.frequency.setValueAtTime(659, t + 0.2);
        osc.frequency.setValueAtTime(880, t + 0.3);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t); osc.stop(t + 0.45);
        break;
      case 'levelup':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, t);
        osc.frequency.setValueAtTime(659, t + 0.1);
        osc.frequency.setValueAtTime(784, t + 0.2);
        osc.frequency.setValueAtTime(1047, t + 0.3);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.start(t); osc.stop(t + 0.6);
        break;
    }
  } catch(e) {}
}

// ── Event Listeners ──
startBtn.addEventListener('click', attemptLogin);
pinInput.addEventListener('keypress', e => { if (e.key === 'Enter') attemptLogin(); });

// Prevent zoom on double-tap (iOS)
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - (document._lastTouch || 0) < 300) e.preventDefault();
  document._lastTouch = now;
}, { passive: false });

// ═══════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════

async function attemptLogin() {
  initAudio();
  const pin = pinInput.value.trim();
  if (!pin) { showError("Please enter a Quest Code."); return; }

  startBtn.disabled = true;
  startBtn.textContent = "⏳ Loading…";

  try {
    // Wait for KaTeX to be ready
    await waitForKaTeX();

    const res = await fetch(`worksheets/${pin}.json`);
    if (!res.ok) throw new Error("Quest not found! Check your code.");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0)
      throw new Error("Quest file is empty or invalid.");
    allQuestions = data;
    startGame();
  } catch (err) {
    showError(err.message);
    startBtn.disabled = false;
    startBtn.textContent = "⚔️ BEGIN QUEST";
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  setTimeout(() => errorMsg.classList.add('hidden'), 4000);
}

// ═══════════════════════════════════════════
//  GAME START
// ═══════════════════════════════════════════

function startGame() {
  shuffle(allQuestions);
  gameQuestions = allQuestions.slice(0, Math.min(TOTAL_QUESTIONS, allQuestions.length));
  currentIdx = 0;
  score = 0;
  enemyHP = 100;
  playerHP = 100;
  combo = 0;
  maxCombo = 0;
  correctCount = 0;
  playerLevel = 1;

  updateBars();
  scoreDisplay.textContent = '0';
  screens.login.classList.add('hidden');
  screens.battle.classList.remove('hidden');
  loadQuestion();
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// ═══════════════════════════════════════════
//  QUESTION LOADING
// ═══════════════════════════════════════════

function loadQuestion() {
  if (currentIdx >= gameQuestions.length) { endGame('Victory'); return; }

  const q = gameQuestions[currentIdx];
  const questionText = q.question ? q.question.trim() : 'Loading quest…';

  // ★ Set text then render math ★
  setMathText(qText, questionText);

  qProgress.textContent = `QUEST ${currentIdx + 1} / ${gameQuestions.length}`;
  hideFloats();

  // Timer
  clearInterval(timerInterval);
  questionStartTime = Date.now();
  const limit = (q.time || DEFAULT_TIME_LIMIT / 1000) * 1000;

  timerFill.style.width = '100%';
  timerFill.style.background = 'var(--hp-green)';

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - questionStartTime;
    const pct = Math.max(0, 100 - elapsed / limit * 100);
    timerFill.style.width = `${pct}%`;
    if (pct < 25)       timerFill.style.background = 'var(--hp-red)';
    else if (pct < 55)  timerFill.style.background = '#ff8800';
    if (pct <= 0) handleTimeout();
  }, 80);

  // Build options
  optionsContainer.innerHTML = '';
  if (q.options && Array.isArray(q.options)) {
    const answerRaw = q.answer ? q.answer.trim() : '';
    q.options.forEach(opt => {
      const raw = opt ? opt.trim() : '';
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.dataset.raw = raw;

      // ★ Set text then render math ★
      setMathText(btn, raw);

      btn.onclick = () => handleAnswer(btn, raw, answerRaw);
      optionsContainer.appendChild(btn);
    });
  }

  updateDragon();
}

function hideFloats() {
  [comboDisplay, critDisplay, missDisplay, healDisplay, damageNumber, levelUpFlash]
    .forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('anim-float-up');
    });
}

function updateDragon() {
  if (enemyHP > 75)      enemySprite.textContent = '🐉';
  else if (enemyHP > 50) enemySprite.textContent = '🐲';
  else if (enemyHP > 25) enemySprite.textContent = '🔥🐲';
  else                   enemySprite.textContent = '☠️🐲';
}

// ═══════════════════════════════════════════
//  ANSWER HANDLING
// ═══════════════════════════════════════════

function handleAnswer(btn, selected, correct) {
  clearInterval(timerInterval);
  disableAll();

  if (normalise(selected) === normalise(correct)) {
    btn.classList.add('correct');
    correctCount++;
    playSound('correct');
    const timeTaken = Date.now() - questionStartTime;
    calcAttack(timeTaken);
  } else {
    btn.classList.add('wrong');
    playSound('wrong');
    document.querySelectorAll('.opt-btn').forEach(b => {
      if (normalise(b.dataset.raw) === normalise(correct)) b.classList.add('correct');
    });
    triggerEnemyAttack();
  }
}

function handleTimeout() {
  clearInterval(timerInterval);
  disableAll();
  playSound('wrong');

  const q = gameQuestions[currentIdx];
  const correctRaw = q.answer ? q.answer.trim() : '';
  document.querySelectorAll('.opt-btn').forEach(b => {
    if (normalise(b.dataset.raw) === normalise(correctRaw)) b.classList.add('correct');
  });

  missDisplay.textContent = '⏰ TIME UP!';
  missDisplay.classList.remove('hidden');
  triggerEnemyAttack();
}

function disableAll() {
  document.querySelectorAll('.opt-btn').forEach(b => { b.disabled = true; b.onclick = null; });
}

// ═══════════════════════════════════════════
//  PLAYER ATTACK
// ═══════════════════════════════════════════

function calcAttack(timeTaken) {
  combo++;
  if (combo > maxCombo) maxCombo = combo;

  const baseDmg = 100 / gameQuestions.length;
  let speedMult = 1;
  let isCrit = false;

  if      (timeTaken < 3000) { speedMult = 1.6; isCrit = true; }
  else if (timeTaken < 5000) { speedMult = 1.25; }
  else if (timeTaken > DEFAULT_TIME_LIMIT * 0.8) { speedMult = 0.8; }

  const comboMult = 1 + combo * 0.12;
  const totalDmg  = baseDmg * speedMult * comboMult;
  const pts       = Math.floor(100 * speedMult * comboMult);

  score += pts;
  scoreDisplay.textContent = score;

  // Level up every 3 correct
  const newLevel = Math.floor(correctCount / 3) + 1;
  if (newLevel > playerLevel) {
    playerLevel = newLevel;
    showLevelUp();
  }

  // Heal every 5 combo streak
  if (combo > 0 && combo % 5 === 0) {
    playerHP = Math.min(100, playerHP + 20);
    showFloat(healDisplay, '✨ POWER HEAL +20 HP!');
    playSound('heal');
  }

  doPlayerAnim(totalDmg, isCrit, () => {
    enemyHP = Math.max(0, enemyHP - totalDmg);
    updateBars();
    if (enemyHP <= 0) endGame('Victory');
    else nextQ();
  });
}

function showLevelUp() {
  playSound('levelup');
  levelUpFlash.textContent = `⬆️ LEVEL ${playerLevel}!`;
  levelUpFlash.classList.remove('hidden', 'anim-float-up');
  void levelUpFlash.offsetWidth;
  levelUpFlash.classList.add('anim-float-up');
  levelUpFlash.classList.remove('hidden');

  const burst = document.createElement('div');
  burst.className = 'level-up-burst';
  $('arena').appendChild(burst);
  setTimeout(() => burst.remove(), 850);

  spawnParticles('center', '#ffd700', 18);

  setTimeout(() => {
    levelUpFlash.classList.add('hidden');
    levelUpFlash.classList.remove('anim-float-up');
  }, 1400);
}

function doPlayerAnim(dmg, isCrit, cb) {
  if (combo > 1) {
    comboDisplay.textContent = `⚡ COMBO x${combo}!`;
    comboDisplay.classList.remove('hidden');
  }

  fireball.textContent = isCrit ? '☄️' : '🔥';
  fireball.classList.remove('hidden', 'anim-shoot-right');
  void fireball.offsetWidth;
  fireball.classList.add('anim-shoot-right');

  setTimeout(() => {
    fireball.classList.add('hidden');
    fireball.classList.remove('anim-shoot-right');

    if (isCrit) playSound('crit');
    else playSound('hit');

    showExplosion('right');
    spawnParticles('right', isCrit ? '#ffdd00' : '#ff8800', isCrit ? 14 : 8);
    enemySprite.classList.add('anim-enemy-hit');

    damageNumber.textContent = `−${Math.round(dmg)}`;
    damageNumber.style.right = '15%';
    damageNumber.style.left  = 'auto';
    damageNumber.style.color = isCrit ? '#ffdd00' : '#ff5544';
    damageNumber.classList.remove('hidden', 'anim-float-up');
    void damageNumber.offsetWidth;
    damageNumber.classList.add('anim-float-up');

    if (isCrit) {
      critDisplay.textContent = pick([
        '⚡ CRITICAL!', '💥 DEVASTATING!',
        '🌟 BRILLIANT!', '🔥 SUPERB!'
      ]);
      critDisplay.classList.remove('hidden');
      flashScreen();
      $('game-container').classList.add('anim-shake-screen');
    }

    setTimeout(() => {
      enemySprite.classList.remove('anim-enemy-hit');
      $('game-container').classList.remove('anim-shake-screen');
      cb && cb();
    }, 750);
  }, 380);
}

// ═══════════════════════════════════════════
//  ENEMY ATTACK
// ═══════════════════════════════════════════

function triggerEnemyAttack() {
  combo = 0;

  if (!missDisplay.textContent || missDisplay.classList.contains('hidden')) {
    missDisplay.textContent = pick([
      '💀 WRONG!', '❌ MISS!', '😱 OUCH!', '💔 INCORRECT!'
    ]);
  }
  missDisplay.classList.remove('hidden');

  enemyProjectile.textContent = pick(['💀', '🔥', '⚡', '☠️']);
  enemyProjectile.classList.remove('hidden', 'anim-shoot-left');
  void enemyProjectile.offsetWidth;
  enemyProjectile.classList.add('anim-shoot-left');

  setTimeout(() => {
    enemyProjectile.classList.add('hidden');
    enemyProjectile.classList.remove('anim-shoot-left');

    playSound('hit');
    showExplosion('left');
    spawnParticles('left', '#ff3344', 10);
    playerSprite.classList.add('anim-player-hit');
    $('game-container').classList.add('anim-shake-screen');

    const dmg = 25;
    playerHP = Math.max(0, playerHP - dmg);
    updateBars();

    damageNumber.textContent = `−${dmg}`;
    damageNumber.style.left  = '8%';
    damageNumber.style.right = 'auto';
    damageNumber.style.color = '#ff3344';
    damageNumber.classList.remove('hidden', 'anim-float-up');
    void damageNumber.offsetWidth;
    damageNumber.classList.add('anim-float-up');

    setTimeout(() => {
      playerSprite.classList.remove('anim-player-hit');
      $('game-container').classList.remove('anim-shake-screen');
      if (playerHP <= 0) endGame('Defeat');
      else nextQ();
    }, 750);
  }, 380);
}

function nextQ() {
  setTimeout(() => { currentIdx++; loadQuestion(); }, 350);
}

// ═══════════════════════════════════════════
//  VISUAL EFFECTS
// ═══════════════════════════════════════════

function showExplosion(side) {
  explosion.style.left = side === 'right' ? '70%' : '12%';
  explosion.style.top  = '40%';
  explosion.classList.remove('hidden');
  setTimeout(() => explosion.classList.add('hidden'), 450);
}

function spawnParticles(side, color, count = 8) {
  let cx;
  if      (side === 'right')  cx = 73;
  else if (side === 'left')   cx = 15;
  else                        cx = 50;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = 3 + Math.random() * 5;
    p.style.width  = size + 'px';
    p.style.height = size + 'px';
    p.style.left = cx + '%';
    p.style.top  = (35 + Math.random() * 20) + '%';
    p.style.background = color;
    p.style.boxShadow  = `0 0 ${size}px ${color}`;
    p.style.setProperty('--px', `${(Math.random()-0.5)*140}px`);
    p.style.setProperty('--py', `${(Math.random()-0.5)*140}px`);
    particlesEl.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

function flashScreen() {
  const f = document.createElement('div');
  f.className = 'flash-overlay';
  $('arena').appendChild(f);
  setTimeout(() => f.remove(), 350);
}

function showFloat(el, txt) {
  el.textContent = txt;
  el.classList.remove('hidden', 'anim-float-up');
  void el.offsetWidth;
  el.classList.add('anim-float-up');
  el.classList.remove('hidden');
  setTimeout(() => {
    el.classList.add('hidden');
    el.classList.remove('anim-float-up');
  }, 1300);
}

// ═══════════════════════════════════════════
//  HP BARS
// ═══════════════════════════════════════════

function updateBars() {
  enemyHPFill.style.width  = Math.max(0, enemyHP) + '%';
  playerHPFill.style.width = Math.max(0, playerHP) + '%';

  playerHPFill.style.background = playerHP < 30
    ? 'linear-gradient(90deg,#880000,var(--hp-red))'
    : 'linear-gradient(90deg,#1d4ed8,var(--cyan))';

  enemyHPFill.style.background = enemyHP < 30
    ? 'linear-gradient(90deg,#440000,#880000)'
    : 'linear-gradient(90deg,#cc2233,#ff5544)';
}

// ═══════════════════════════════════════════
//  END GAME
// ═══════════════════════════════════════════

function endGame(result) {
  clearInterval(timerInterval);

  setTimeout(() => {
    screens.battle.classList.add('hidden');
    screens.end.classList.remove('hidden');

    const title  = $('end-title');
    const reason = $('end-reason');
    const icon   = $('end-icon');
    $('final-score').textContent = score;
    $('final-combo').textContent = maxCombo;

    const answered = Math.min(currentIdx + 1, gameQuestions.length);
    const acc = answered > 0 ? Math.round(correctCount / answered * 100) : 0;
    $('final-accuracy').textContent = acc + '%';

    if (result === 'Defeat') {
      icon.textContent  = '💀';
      title.textContent = 'QUEST FAILED';
      title.style.color = 'var(--hp-red)';
      reason.textContent = 'The dragon was too powerful! Study harder and try again! 🐲';
    } else if (enemyHP <= 0) {
      icon.textContent  = '🏆';
      title.textContent = 'DRAGON SLAIN!';
      title.style.color = 'var(--gold)';
      reason.textContent = 'Your knowledge defeated the dragon! You levelled up! ⚔️✨';
    } else if (enemyHP <= 25) {
      icon.textContent  = '⚔️';
      title.textContent = 'QUEST COMPLETE!';
      title.style.color = 'var(--gold)';
      reason.textContent = 'The dragon retreats, badly wounded! Great effort! 🐲💨';
    } else {
      icon.textContent  = '🐲';
      title.textContent = 'QUEST UNFINISHED';
      title.style.color = '#94a3b8';
      reason.textContent = 'The dragon escaped. Keep learning and come back stronger! 📚';
    }
  }, 500);
}

// ── Utilities ──
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
