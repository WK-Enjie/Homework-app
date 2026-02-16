// --- Game State ---
let questions = [];
let currentIdx = 0;
let score = 0;
let nianHP = 100;
const damagePerHit = 20; // Will be calculated dynamically based on Q count

// --- DOM Elements ---
const screens = {
    login: document.getElementById('login-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen')
};

const pinInput = document.getElementById('pin-input');
const startBtn = document.getElementById('start-btn');
const errorMsg = document.getElementById('error-msg');
const restartBtn = document.getElementById('restart-btn');

// Game UI
const nianElem = document.getElementById('nian');
const healthFill = document.getElementById('health-bar-fill');
const projectile = document.getElementById('projectile');
const explosion = document.getElementById('explosion');
const qText = document.getElementById('question-text');
const optionsGrid = document.getElementById('options-grid');
const progressInd = document.getElementById('progress-indicator');
const scoreInd = document.getElementById('score-indicator');

// --- Event Listeners ---
startBtn.addEventListener('click', attemptLogin);
restartBtn.addEventListener('click', () => location.reload());

pinInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptLogin();
});

// --- Functions ---

async function attemptLogin() {
    const pin = pinInput.value.trim();
    if (!pin) return;

    // Path to the JSON file
    const filePath = `worksheets/${pin}.json`;

    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error("File not found");
        
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
            questions = data;
            startGame();
        } else {
            showError("Invalid JSON structure.");
        }
    } catch (err) {
        showError("Invalid PIN. Make sure the file exists.");
        console.error(err);
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function startGame() {
    // Switch screens
    screens.login.classList.remove('active');
    screens.game.classList.add('active');
    screens.game.classList.remove('hidden');

    // Reset stats
    currentIdx = 0;
    score = 0;
    nianHP = 100;
    
    updateHealthUI();
    loadQuestion();
}

function updateHealthUI() {
    healthFill.style.width = `${nianHP}%`;
    if(nianHP <= 30) healthFill.style.backgroundColor = '#ff4d4d';
    else healthFill.style.backgroundColor = '#D90429';
}

function loadQuestion() {
    if (currentIdx >= questions.length) {
        endGame(true);
        return;
    }

    const q = questions[currentIdx];
    
    // Update Text
    qText.textContent = q.question;
    progressInd.textContent = `Question ${currentIdx + 1}/${questions.length}`;
    scoreInd.textContent = `Score: ${score}`;

    // Generate Buttons
    optionsGrid.innerHTML = '';
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.textContent = opt;
        btn.onclick = () => handleAnswer(btn, opt, q.answer);
        optionsGrid.appendChild(btn);
    });
}

function handleAnswer(btn, selected, correct) {
    // Disable buttons
    const allBtns = document.querySelectorAll('.opt-btn');
    allBtns.forEach(b => b.disabled = true);

    if (selected === correct) {
        btn.classList.add('correct');
        score += 100;
        performAttack();
    } else {
        btn.classList.add('wrong');
        // Highlight correct answer
        allBtns.forEach(b => {
            if(b.textContent === correct) b.classList.add('correct');
        });
        // Nian gets closer (visual effect) or simply move next
        setTimeout(nextQuestion, 1500);
    }
}

function performAttack() {
    // 1. Reset projectile position
    projectile.classList.remove('hidden');
    projectile.classList.add('throw-anim');

    // 2. Wait for animation to hit Nian (approx 600ms)
    setTimeout(() => {
        projectile.classList.add('hidden');
        projectile.classList.remove('throw-anim');
        
        // Show explosion
        explosion.classList.remove('hidden');
        
        // Nian takes damage
        nianElem.classList.add('nian-hit');
        const dmg = 100 / questions.length;
        nianHP = Math.max(0, nianHP - dmg);
        updateHealthUI();

        // 3. Cleanup after impact
        setTimeout(() => {
            explosion.classList.add('hidden');
            nianElem.classList.remove('nian-hit');
            nextQuestion();
        }, 500);
    }, 600);
}

function nextQuestion() {
    currentIdx++;
    loadQuestion();
}

function endGame(victory) {
    screens.game.classList.remove('active');
    screens.game.classList.add('hidden');
    
    screens.end.classList.add('active');
    screens.end.classList.remove('hidden');

    const title = document.getElementById('end-title');
    const msg = document.getElementById('end-message');
    
    if (nianHP <= 5) { // Allowance for rounding errors
        title.textContent = "VICTORY!";
        title.style.color = "#D90429";
        msg.textContent = "You drove the Nian away with your knowledge!";
    } else {
        title.textContent = "GAME OVER";
        title.style.color = "#555";
        msg.textContent = "The Nian is still here... try again!";
    }
    
    document.getElementById('final-score').textContent = score;
}