// --- Game State ---
let questions = [];
let currentIdx = 0;
let score = 0;
let enemyHP = 100;
let playerHP = 100;
let combo = 0;
let maxCombo = 0;

// Timing
let questionStartTime;
let timerInterval;
const TIME_LIMIT = 15000; // 15 seconds

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    battle: document.getElementById('battle-screen'),
    end: document.getElementById('end-screen')
};

const pinInput = document.getElementById('pin-input');
const startBtn = document.getElementById('start-btn');
const errorMsg = document.getElementById('error-msg');

// UI Elements
const playerSprite = document.getElementById('player-sprite');
const nianSprite = document.getElementById('nian-sprite');
const enemyHPFill = document.getElementById('enemy-hp-fill');
const playerHPFill = document.getElementById('player-hp-fill');

const fireball = document.getElementById('fireball'); // Player Projectile
const darkOrb = document.getElementById('dark-orb'); // Enemy Projectile
const explosion = document.getElementById('explosion');

const comboDisplay = document.getElementById('combo-display');
const critDisplay = document.getElementById('crit-display');
const missDisplay = document.getElementById('miss-display');

const timerFill = document.getElementById('timer-fill');
const scoreDisplay = document.getElementById('score-display');
const qText = document.getElementById('q-text');
const optionsContainer = document.getElementById('options-container');
const qProgress = document.getElementById('q-progress');

// --- Event Listeners ---
startBtn.addEventListener('click', attemptLogin);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') attemptLogin(); });

// --- Core Logic ---

async function attemptLogin() {
    const pin = pinInput.value.trim();
    if (!pin) { showError("Please enter a Mission Code."); return; }

    try {
        const response = await fetch(`worksheets/${pin}.json`);
        if (!response.ok) throw new Error("Worksheet not found.");
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
            questions = data;
            startGame();
        } else {
            throw new Error("Invalid JSON format.");
        }
    } catch (err) {
        showError(`Error: ${err.message}`);
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function startGame() {
    screens.login.classList.add('hidden');
    screens.battle.classList.remove('hidden');
    
    currentIdx = 0;
    score = 0;
    enemyHP = 100;
    playerHP = 100;
    combo = 0;
    
    updateBars();
    scoreDisplay.textContent = "0";
    loadQuestion();
}

function loadQuestion() {
    if (currentIdx >= questions.length) {
        endGame("Victory");
        return;
    }

    const q = questions[currentIdx];
    qText.textContent = q.question;
    qProgress.textContent = `QUESTION ${currentIdx + 1} / ${questions.length}`;
    
    // Reset Round UI
    comboDisplay.classList.add('hidden');
    critDisplay.classList.add('hidden');
    missDisplay.classList.add('hidden');
    
    // Timer Logic
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
            handleTimeout(); // Time ran out!
        }
    }, 100);

    // Buttons
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
        // Highlight correct
        const btns = document.querySelectorAll('.opt-btn');
        btns.forEach(b => { if(b.textContent === correct) b.classList.add('correct'); });
        
        triggerEnemyAttack(); // Wrong answer = Get Hit
    }
}

function handleTimeout() {
    clearInterval(timerInterval);
    disableButtons();
    triggerEnemyAttack(); // Timeout = Get Hit
}

function disableButtons() {
    const btns = document.querySelectorAll('.opt-btn');
    btns.forEach(b => b.disabled = true);
}

// --- Player Attack ---
function calculatePlayerAttack(timeTaken) {
    combo++;
    if(combo > maxCombo) maxCombo = combo;

    const baseDmg = 100 / questions.length;
    let speedMult = 1;
    let isCrit = false;
    
    if (timeTaken < 3000) { speedMult = 1.5; isCrit = true; }
    else if (timeTaken > 10000) { speedMult = 0.8; }

    const totalDmg = baseDmg * speedMult * (1 + (combo * 0.1));
    const points = Math.floor(100 * speedMult * (1 + (combo * 0.1)));
    
    score += points;
    scoreDisplay.textContent = score;

    performPlayerAnimation(totalDmg, isCrit);
}

function performPlayerAnimation(damage, isCrit) {
    if (combo > 1) {
        comboDisplay.textContent = `COMBO x${combo}!`;
        comboDisplay.classList.remove('hidden');
    }

    fireball.classList.remove('hidden');
    fireball.classList.add('anim-shoot-right');

    setTimeout(() => {
        fireball.classList.add('hidden');
        fireball.classList.remove('anim-shoot-right');

        showExplosion('right');
        nianSprite.classList.add('anim-enemy-hit');
        
        if(isCrit) {
            critDisplay.classList.remove('hidden');
            document.getElementById('game-container').classList.add('anim-shake-screen');
        }

        enemyHP = Math.max(0, enemyHP - damage);
        updateBars();

        setTimeout(() => {
            nianSprite.classList.remove('anim-enemy-hit');
            document.getElementById('game-container').classList.remove('anim-shake-screen');
            nextQuestion();
        }, 1000);
    }, 500);
}

// --- Enemy Attack (The Counter) ---
function triggerEnemyAttack() {
    combo = 0; // Break combo
    missDisplay.classList.remove('hidden'); // Show "Missed!"

    // 1. Launch Dark Orb
    darkOrb.classList.remove('hidden');
    darkOrb.classList.add('anim-shoot-left');

    setTimeout(() => {
        darkOrb.classList.add('hidden');
        darkOrb.classList.remove('anim-shoot-left');

        // 2. Hit Player
        showExplosion('left');
        playerSprite.classList.add('anim-player-hit');
        document.getElementById('game-container').classList.add('anim-shake-screen');

        // 3. Take Damage (Fixed 25% for arcade difficulty)
        playerHP = Math.max(0, playerHP - 25);
        updateBars();

        setTimeout(() => {
            playerSprite.classList.remove('anim-player-hit');
            document.getElementById('game-container').classList.remove('anim-shake-screen');
            
            if (playerHP <= 0) {
                endGame("Defeat");
            } else {
                nextQuestion();
            }
        }, 1000);

    }, 500);
}

function showExplosion(side) {
    explosion.style.left = side === 'right' ? '80%' : '10%';
    explosion.classList.remove('hidden');
    setTimeout(() => explosion.classList.add('hidden'), 500);
}

function updateBars() {
    enemyHPFill.style.width = `${enemyHP}%`;
    playerHPFill.style.width = `${playerHP}%`;
    
    // Critical health color
    if(playerHP < 30) playerHPFill.style.background = 'red';
}

function nextQuestion() {
    currentIdx++;
    loadQuestion();
}

function endGame(result) {
    screens.battle.classList.add('hidden');
    screens.end.classList.remove('hidden');
    
    const title = document.getElementById('end-title');
    const reason = document.getElementById('end-reason');
    document.getElementById('final-score').textContent = score;

    if (result === "Victory" && enemyHP <= 5) {
        title.textContent = "VICTORY!";
        title.style.color = "var(--gold)";
        reason.textContent = "The Nian has fled!";
    } else if (result === "Defeat") {
        title.textContent = "DEFEAT";
        title.style.color = "red";
        reason.textContent = "You were knocked out!";
    } else {
        title.textContent = "GAME OVER";
        title.style.color = "#aaa";
        reason.textContent = "The Nian survived.";
    }
}