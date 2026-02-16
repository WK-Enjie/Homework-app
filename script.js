// ==========================================
// 1. GAME VARIABLES
// ==========================================
let allQuestions = []; 
let gameQuestions = []; 
let currentIdx = 0;
let score = 0;
let enemyHP = 100;
let playerHP = 100;
let combo = 0;
let maxCombo = 0;

let questionStartTime;
let timerInterval;
const TIME_LIMIT = 15000; // 15 seconds

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const screens = {
    login: document.getElementById('login-screen'),
    battle: document.getElementById('battle-screen'),
    end: document.getElementById('end-screen')
};

const pinInput = document.getElementById('pin-input');
const startBtn = document.getElementById('start-btn');
const errorMsg = document.getElementById('error-msg');

const scoreDisplay = document.getElementById('score-display');
const enemyHPFill = document.getElementById('enemy-hp-fill');
const playerHPFill = document.getElementById('player-hp-fill');

const playerSprite = document.getElementById('player-sprite');
const nianSprite = document.getElementById('nian-sprite');
const fireball = document.getElementById('fireball'); 
const darkOrb = document.getElementById('dark-orb'); 
const explosion = document.getElementById('explosion');

const comboDisplay = document.getElementById('combo-display');
const critDisplay = document.getElementById('crit-display');
const missDisplay = document.getElementById('miss-display');

const timerFill = document.getElementById('timer-fill');
const qText = document.getElementById('q-text');
const optionsContainer = document.getElementById('options-container');
const qProgress = document.getElementById('q-progress');

// ==========================================
// 3. LISTENERS
// ==========================================
startBtn.addEventListener('click', attemptLogin);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') attemptLogin(); });

// ==========================================
// 4. LOGIN & SETUP
// ==========================================
async function attemptLogin() {
    const pin = pinInput.value.trim();
    if (!pin) {
        showError("Please enter a Mission Code.");
        return;
    }

    try {
        const response = await fetch(`worksheets/${pin}.json`);
        if (!response.ok) throw new Error("Code not found or server error.");
        
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
            allQuestions = data;
            startGame();
        } else {
            throw new Error("File is empty or invalid JSON.");
        }
    } catch (err) {
        showError("Error: " + err.message);
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function startGame() {
    // 1. Shuffle & Select 12
    shuffleArray(allQuestions);
    gameQuestions = allQuestions.slice(0, 12);

    // 2. Reset Stats
    currentIdx = 0;
    score = 0;
    enemyHP = 100;
    playerHP = 100;
    combo = 0;
    
    // 3. Update UI
    updateBars();
    scoreDisplay.textContent = "0";
    screens.login.classList.add('hidden');
    screens.battle.classList.remove('hidden');

    // 4. Load First Question
    loadQuestion();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// ==========================================
// 5. QUESTION LOGIC
// ==========================================
function loadQuestion() {
    // Check Win Condition
    if (currentIdx >= gameQuestions.length) {
        endGame("Victory");
        return;
    }

    const q = gameQuestions[currentIdx];
    
    // UI Updates
    qText.textContent = q.question;
    qProgress.textContent = `QUESTION ${currentIdx + 1} / ${gameQuestions.length}`;
    
    // Hide previous FX
    comboDisplay.classList.add('hidden');
    critDisplay.classList.add('hidden');
    missDisplay.classList.add('hidden');
    
    // Reset Timer
    clearInterval(timerInterval);
    questionStartTime = Date.now();
    timerFill.style.width = '100%';
    timerFill.style.background = '#00e676';
    
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - questionStartTime;
        const remainingPct = Math.max(0, 100 - (elapsed / TIME_LIMIT * 100));
        timerFill.style.width = `${remainingPct}%`;
        
        if(remainingPct < 30) timerFill.style.background = '#d50000';
        
        if (remainingPct <= 0) {
            handleTimeout();
        }
    }, 100);

    // Generate Buttons
    optionsContainer.innerHTML = '';
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.textContent = opt;
        btn.onclick = () => handleAnswer(btn, opt, q.answer);
        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(btn, selected, correct) {
    clearInterval(timerInterval);
    disableButtons();

    if (selected === correct) {
        btn.classList.add('correct');
        const timeTaken = Date.now() - questionStartTime;
        calculatePlayerAttack(timeTaken);
    } else {
        btn.classList.add('wrong');
        // Show correct answer
        const btns = document.querySelectorAll('.opt-btn');
        btns.forEach(b => { if(b.textContent === correct) b.classList.add('correct'); });
        
        triggerEnemyAttack();
    }
}

function handleTimeout() {
    clearInterval(timerInterval);
    disableButtons();
    triggerEnemyAttack();
}

function disableButtons() {
    const btns = document.querySelectorAll('.opt-btn');
    btns.forEach(b => b.disabled = true);
}

// ==========================================
// 6. COMBAT & ANIMATION
// ==========================================

// --- PLAYER TURN ---
function calculatePlayerAttack(timeTaken) {
    combo++;
    if(combo > maxCombo) maxCombo = combo;

    const baseDmg = 100 / gameQuestions.length;
    let speedMult = 1;
    let isCrit = false;
    
    if (timeTaken < 3000) { speedMult = 1.5; isCrit = true; }
    else if (timeTaken > 10000) { speedMult = 0.8; }

    const totalDmg = baseDmg * speedMult * (1 + (combo * 0.1));
    const points = Math.floor(100 * speedMult * (1 + (combo * 0.1)));
    
    score += points;
    scoreDisplay.textContent = score;

    // Trigger Visuals -> Then Trigger Next Question
    performPlayerAnimation(totalDmg, isCrit, () => {
        enemyHP = Math.max(0, enemyHP - totalDmg);
        updateBars();
        goToNextQuestion();
    });
}

function performPlayerAnimation(damage, isCrit, callback) {
    if (combo > 1) {
        comboDisplay.textContent = `COMBO x${combo}!`;
        comboDisplay.classList.remove('hidden');
    }

    fireball.classList.remove('hidden');
    fireball.classList.add('anim-shoot-right');

    // Impact Delay
    setTimeout(() => {
        fireball.classList.add('hidden');
        fireball.classList.remove('anim-shoot-right');

        showExplosion('right');
        nianSprite.classList.add('anim-enemy-hit');
        
        if(isCrit) {
            critDisplay.classList.remove('hidden');
            document.getElementById('game-container').classList.add('anim-shake-screen');
        }

        // Cleanup Delay
        setTimeout(() => {
            nianSprite.classList.remove('anim-enemy-hit');
            document.getElementById('game-container').classList.remove('anim-shake-screen');
            if (callback) callback();
        }, 1000);

    }, 500);
}

// --- ENEMY TURN ---
function triggerEnemyAttack() {
    combo = 0;
    missDisplay.classList.remove('hidden');

    darkOrb.classList.remove('hidden');
    darkOrb.classList.add('anim-shoot-left');

    // Impact Delay
    setTimeout(() => {
        darkOrb.classList.add('hidden');
        darkOrb.classList.remove('anim-shoot-left');

        showExplosion('left');
        playerSprite.classList.add('anim-player-hit');
        document.getElementById('game-container').classList.add('anim-shake-screen');

        playerHP = Math.max(0, playerHP - 25);
        updateBars();

        // Cleanup Delay
        setTimeout(() => {
            playerSprite.classList.remove('anim-player-hit');
            document.getElementById('game-container').classList.remove('anim-shake-screen');
            
            if (playerHP <= 0) {
                endGame("Defeat");
            } else {
                goToNextQuestion();
            }
        }, 1000);

    }, 500);
}

// --- SHARED UTILS ---
function goToNextQuestion() {
    currentIdx++;
    loadQuestion();
}

function showExplosion(side) {
    explosion.style.left = side === 'right' ? '80%' : '10%';
    explosion.classList.remove('hidden');
    setTimeout(() => explosion.classList.add('hidden'), 500);
}

function updateBars() {
    enemyHPFill.style.width = `${enemyHP}%`;
    playerHPFill.style.width = `${playerHP}%`;
    
    if(playerHP < 30) playerHPFill.style.background = 'red';
    else playerHPFill.style.background = 'var(--hp-blue)';
}

// ==========================================
// 7. END GAME
// ==========================================
function endGame(result) {
    screens.battle.classList.add('hidden');
    screens.end.classList.remove('hidden');
    
    const title = document.getElementById('end-title');
    const reason = document.getElementById('end-reason');
    document.getElementById('final-score').textContent = score;

    if (result === "Defeat") {
        title.textContent = "DEFEAT";
        title.style.color = "red";
        reason.textContent = "You were knocked out!";
    } 
    else if (enemyHP <= 5) {
        title.textContent = "VICTORY!";
        title.style.color = "var(--gold)";
        reason.textContent = "The Nian has fled!";
    } 
    else {
        title.textContent = "GAME OVER";
        title.style.color = "#aaa";
        reason.textContent = "The Nian survived.";
    }
}