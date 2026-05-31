import { SudokuGame } from './games/sudoku.js';
import { QueensGame } from './games/queens.js';

let activeGameInstance = null;
let currentDifficulty = 'medium';
let timerInterval = null;
let secondsElapsed = 0;
let mistakes = 0;
let maxMistakes = 3;

document.addEventListener('DOMContentLoaded', () => {
    initHubEvents();
    initGameScreenEvents();
    console.log('[Flex Arcade] Central game manager loaded.');
});

// Setup Hub view elements and actions
function initHubEvents() {
    // Difficulty pill buttons
    const diffButtons = document.querySelectorAll('.diff-btn');
    diffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            diffButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.getAttribute('data-diff') || 'medium';
            console.log('[Flex Arcade] Difficulty set to:', currentDifficulty);
        });
    });

    // Game Cards
    const gameCards = document.querySelectorAll('.game-card.active-card');
    gameCards.forEach(card => {
        card.addEventListener('click', () => {
            const gameType = card.getAttribute('data-game');
            if (gameType) {
                startGame(gameType, currentDifficulty);
            }
        });
    });

    // Seed Input
    const playSeedBtn = document.getElementById('play-seed-btn');
    const seedInput = document.getElementById('custom-seed-input');
    if (playSeedBtn && seedInput) {
        playSeedBtn.addEventListener('click', () => {
            const rawSeed = seedInput.value.trim();
            if (rawSeed) {
                startGameWithSeed(rawSeed);
            }
        });
    }
}

// Bind Game view buttons and general key listeners
function initGameScreenEvents() {
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', returnToHub);
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (activeGameInstance) {
                activeGameInstance.handleReset();
            }
        });
    }

    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) {
        hintBtn.addEventListener('click', () => {
            if (activeGameInstance) {
                const result = activeGameInstance.handleHint();
                if (result && result.isSolved) {
                    handleGameWon();
                }
            }
        });
    }

    // Bind virtual numeric controls (for Sudoku)
    const numButtons = document.querySelectorAll('.num-btn');
    numButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseInt(btn.getAttribute('data-val') || '0', 10);
            if (activeGameInstance && typeof activeGameInstance.handleNumberInput === 'function') {
                const result = activeGameInstance.handleNumberInput(val);
                if (result) {
                    processGameActionResult(result);
                }
            }
        });
    });

    // Bind Keyboard Redirects
    window.addEventListener('keydown', (e) => {
        // Forward only if we are inside the active game screen
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen && gameScreen.classList.contains('active') && activeGameInstance) {
            const result = activeGameInstance.handleKeyDown(e);
            if (result) {
                processGameActionResult(result);
            }
        }
    });
}

// Start game using selected type, difficulty, and optional custom seed
function startGame(gameType, difficulty, customSeed = null) {
    const seed = customSeed || Math.floor(Math.random() * 1000000).toString();
    console.log(`[Flex Arcade] Starting game: ${gameType}, difficulty: ${difficulty}, seed: ${seed}`);

    // Clean any residual win/lose overlays
    clearOverlays();

    // Reset game metrics
    mistakes = 0;
    secondsElapsed = 0;

    // Instantiate game logic
    if (gameType === 'sudoku') {
        activeGameInstance = new SudokuGame(seed, difficulty);
    } else if (gameType === 'queens') {
        activeGameInstance = new QueensGame(seed, difficulty);
    } else {
        console.warn('[Flex Arcade] Unsupported game type:', gameType);
        return;
    }

    // Set UI badges and headers
    document.getElementById('game-title').innerText = activeGameInstance.getTitle();
    
    // Set Difficulty Badge
    const diffBadge = document.getElementById('difficulty-badge');
    diffBadge.className = `badge ${difficulty}`;
    diffBadge.innerText = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

    // Set Seed Badge
    const seedPref = activeGameInstance.getGamePrefix() || 'gm';
    document.getElementById('seed-badge').innerText = `${seedPref}${seed}`;

    // Set Error Badge (Hide for games that do not count mistakes like Zip)
    const errBadge = document.getElementById('errors-badge');
    if (activeGameInstance.needsKeyboardControls() && gameType !== 'zip') {
        errBadge.style.display = 'inline-flex';
        errBadge.innerText = `${mistakes}/${maxMistakes}`;
    } else if (gameType === 'queens') {
        // Queens also counts mistakes
        errBadge.style.display = 'inline-flex';
        errBadge.innerText = `${mistakes}/${maxMistakes}`;
    } else {
        errBadge.style.display = 'none';
    }

    // Enable/disable the numeric keyboard section
    const numControls = document.getElementById('keyboard-controls');
    if (activeGameInstance.needsKeyboardControls() && gameType === 'sudoku') {
        numControls.style.display = 'block';
    } else {
        numControls.style.display = 'none';
    }

    // Set Game Rules
    document.getElementById('game-rules-text').innerText = activeGameInstance.getRulesText();

    // Render Board
    const gridContainer = document.getElementById('grid-container');
    activeGameInstance.render(gridContainer, {
        onSelect: (r, c) => {},
        onAction: (result) => {
            processGameActionResult(result);
        }
    });

    // Start Timer
    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
    }, 1000);

    // Transition Screens
    document.getElementById('hub-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
}

// Start game using custom seed (e.g. su4929, qu1284)
function startGameWithSeed(rawSeed) {
    let gameType = '';
    let seedVal = rawSeed;

    if (rawSeed.startsWith('su')) {
        gameType = 'sudoku';
        seedVal = rawSeed.slice(2);
    } else if (rawSeed.startsWith('qu')) {
        gameType = 'queens';
        seedVal = rawSeed.slice(2);
    } else {
        // Fallback: pick currently selected card type
        const activeCard = document.querySelector('.game-card.active-card');
        gameType = activeCard ? activeCard.getAttribute('data-game') : 'sudoku';
    }

    startGame(gameType, currentDifficulty, seedVal);
}

// Handle action callbacks from the game instance
function processGameActionResult(result) {
    if (result.errorPlaced) {
        mistakes++;
        const errBadge = document.getElementById('errors-badge');
        errBadge.innerText = `${mistakes}/${maxMistakes}`;
        
        if (mistakes >= maxMistakes) {
            handleGameOver();
            return;
        }
    }

    if (result.isSolved) {
        handleGameWon();
    }
}

// Timer increments renderer
function updateTimerDisplay() {
    const mins = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
    const secs = (secondsElapsed % 60).toString().padStart(2, '0');
    document.getElementById('timer-text').innerText = `${mins}:${secs}`;
}

// Exit the game screen and restore Game Hub state
function returnToHub() {
    clearInterval(timerInterval);
    activeGameInstance = null;
    clearOverlays();
    
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('hub-screen').classList.add('active');
}

// Remove victory/lose layers
function clearOverlays() {
    const gameScreen = document.getElementById('game-screen');
    const existingOverlays = gameScreen.querySelectorAll('.victory-overlay, .game-over-overlay, .confetti');
    existingOverlays.forEach(overlay => overlay.remove());
}

// Process game-won flow and render dynamic victory overlay
function handleGameWon() {
    clearInterval(timerInterval);
    clearOverlays();

    const gameScreen = document.getElementById('game-screen');
    const overlay = document.createElement('div');
    overlay.className = 'victory-overlay';

    const title = document.createElement('h2');
    title.className = 'victory-title';
    title.innerText = '🏆 Victory!';

    const text = document.createElement('p');
    text.className = 'victory-text';
    const mins = Math.floor(secondsElapsed / 60);
    const secs = secondsElapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs} seconds`;
    text.innerText = `You completed the seed puzzle successfully in ${timeStr} with ${mistakes} mistakes!`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sketchy-btn';
    closeBtn.innerText = 'Back to Hub';
    closeBtn.onclick = returnToHub;

    overlay.appendChild(title);
    overlay.appendChild(text);
    overlay.appendChild(closeBtn);
    gameScreen.appendChild(overlay);

    // Spawn falling sketchy confetti particles
    spawnConfetti(gameScreen);
}

// Process game-over flow and render retry overlay
function handleGameOver() {
    clearInterval(timerInterval);
    clearOverlays();

    const gameScreen = document.getElementById('game-screen');
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';

    const title = document.createElement('h2');
    title.className = 'game-over-title';
    title.innerText = '💥 Game Over';

    const text = document.createElement('p');
    text.className = 'game-over-text';
    text.innerText = `You made 3 critical mistakes on this puzzle. Logic is power, let's try it again!`;

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '10px';

    const retryBtn = document.createElement('button');
    retryBtn.className = 'sketchy-btn';
    retryBtn.innerText = 'Try Again';
    retryBtn.onclick = () => {
        if (activeGameInstance) {
            const currentType = activeGameInstance.getGamePrefix() === 'su' ? 'sudoku' : 'queens';
            startGame(currentType, currentDifficulty, activeGameInstance.seed);
        }
    };

    const backBtn = document.createElement('button');
    backBtn.className = 'sketchy-btn';
    backBtn.innerText = 'Hub';
    backBtn.onclick = returnToHub;

    controls.appendChild(retryBtn);
    controls.appendChild(backBtn);
    
    overlay.appendChild(title);
    overlay.appendChild(text);
    overlay.appendChild(controls);
    gameScreen.appendChild(overlay);
}

// Spawns premium falling confetti particles on win
function spawnConfetti(parentEl) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    for (let i = 0; i < 40; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * -30 - 10}px`;
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Random size and speed parameters
        const size = Math.random() * 6 + 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.animationDuration = `${Math.random() * 1.5 + 1.5}s`;
        particle.style.animationDelay = `${Math.random() * 1.5}s`;
        
        parentEl.appendChild(particle);
    }
}
