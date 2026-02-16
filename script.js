// --- Game State ---
let questions = [];
let currentIdx = 0;
let score = 0;
let nianHP = 100;
let combo = 0;
let maxCombo = 0;

// Timing
let questionStartTime;
let timerInterval;
const TIME_LIMIT = 15000; // 15 seconds per question

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    battle: document.getElementById('battle-screen'),
    end: document.getElementById('end-screen')
};

const pinInput = document.getElementById('pin-input');
const startBtn = document.getElementById('start-btn');
const errorMsg = document.getElementById('error-msg');

// Game UI Elements
const nianSprite = document.getElementById('nian-sprite');
const hpFill = document.getElementById('hp-bar-fill');
const fireball = document.getElementById('fireball');
const explosion = document.getElementById('explosion');
const comboDisplay = document.getElementById('combo-display');
const critDisplay = document.getElementById('crit-display');
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
    if (!pin) {
        showError("Please enter a Mission Code.");
        return;
    }

    try {
        // Attempt to fetch the file based on the PIN
        const response = await fetch(`worksheets/${pin}.json`);
        
        if (!response.ok) {
            if(response.status === 404) throw new Error("Worksheet not found.");
            throw new Error("Network error.");
        }

        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
            questions = data;
            startGame();
        } else {
            throw new Error("Invalid JSON format in file.");
        }

    } catch (err) {
        console.error(err);
        showError(`Error: ${err.message} (Check the 'worksheets' folder)`);
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function startGame() {
    screens.login.classList.add('hidden');
    screens.battle.classList.remove('hidden');
    
    // Reset Game Stats
    currentIdx = 0;
    score = 0;
    nianHP = 100;
    combo = 0;
    maxCombo = 0;
    
    updateHP(100);
    scoreDisplay.textContent = "0";
    loadQuestion();
}

function loadQuestion() {
    // Check for Win Condition
    if (currentIdx >= questions.length) {
        endGame();
        return;
    }

    const q = questions[currentIdx];
    qText.textContent = q.question;
    qProgress.textContent = `QUESTION ${currentIdx + 1} / ${questions.length}`;
    
    // Reset Round UI
    comboDisplay.classList.add('hidden');
    critDisplay.classList.add('hidden');
    
    // Setup Timer
    clearInterval(timerInterval);
    questionStartTime = Date.now();
    timerFill.style.width = '100%';
    timerFill.style.background = '#00e676'; // Green
    
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - questionStartTime;
        const remainingPct = Math.max(0, 100 - (elapsed / TIME_LIMIT * 100));
        timerFill.style.width = `${remainingPct}%`;
        
        // Color changes based on urgency
        if(remainingPct < 30) timerFill.style.background = '#d50000'; // Red
        else if(remainingPct < 60) timerFill.style.background = '#ff9100'; // Orange
        
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
    // Stop Timer & Lock Buttons
    clearInterval(timerInterval);
    const btns = document.querySelectorAll('.opt-btn');
    btns.forEach(b => b.disabled = true);

    if (selected === correct) {
        btn.classList.add('correct');
        const timeTaken = Date.now() - questionStartTime;
        calculateAttack(timeTaken);
    } else {
        btn.classList.add('wrong');
        // Show correct answer
        btns.forEach(b => { if(b.textContent === correct) b.classList.add('correct'); });
        
        // Reset Combo
        combo = 0;
        setTimeout(nextQuestion, 1500);
    }
}

function calculateAttack(timeTaken) {
    combo++;
    if(combo > maxCombo) maxCombo = combo;

    // Calculate Damage
    const baseDmg = 100 / questions.length;
    let speedMult = 1;
    let isCrit = false;
    
    if (timeTaken < 3000) { // Fast Answer (<3s)
        speedMult = 1.5;
        isCrit = true;
    } else if (timeTaken > 10000) { // Slow Answer (>10s)
        speedMult = 0.8;
    }

    // Damage Formula
    const totalDmg = baseDmg * speedMult * (1 + (combo * 0.1));
    const points = Math.floor(100 * speedMult * (1 + (combo * 0.1)));
    
    score += points;
    scoreDisplay.textContent = score;

    performAttackAnimation(totalDmg, isCrit);
}

function performAttackAnimation(damage, isCrit) {
    // 1. Combo Text
    if (combo > 1) {
        comboDisplay.textContent = `COMBO x${combo}!`;
        comboDisplay.classList.remove('hidden');
    }

    // 2. Fireball Launch
    fireball.classList.remove('hidden');
    fireball.classList.add('anim-shoot');

    // 3. Impact Event (Timing matches CSS animation)
    setTimeout(() => {
        fireball.classList.add('hidden');
        fireball.classList.remove('anim-shoot');

        // Explosion Sprite
        explosion.classList.remove('hidden');
        setTimeout(() => explosion.classList.add('hidden'), 500);

        // Nian Hit Reaction
        nianSprite.classList.add('anim-hit');
        
        // Crit Shake
        if(isCrit) {
            critDisplay.classList.remove('hidden');
            document.getElementById('game-container').classList.add('anim-shake-screen');
        }

        // Apply HP Damage
        nianHP = Math.max(0, nianHP - damage);
        updateHP(nianHP);

        // Cleanup & Next
        setTimeout(() => {
            nianSprite.classList.remove('anim-hit');
            document.getElementById('game-container').classList.remove('anim-shake-screen');
            nextQuestion();
        }, 1000);

    }, 500);
}

function updateHP(val) {
    hpFill.style.width = `${val}%`;
}

function nextQuestion() {
    currentIdx++;
    loadQuestion();
}

function endGame() {
    screens.battle.classList.add('hidden');
    screens.end.classList.remove('hidden');
    
    const title = document.getElementById('end-title');
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-combo').textContent = maxCombo;

    if (nianHP <= 5) { // Margin of error for floats
        title.textContent = "VICTORY!";
        title.style.color = "var(--gold)";
        title.style.textShadow = "0 0 20px var(--red)";
    } else {
        title.textContent = "GAME OVER";
        title.style.color = "#d50000";
        title.style.textShadow = "none";
    }
}