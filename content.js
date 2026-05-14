console.log('[Flex on LinkedIn] Content script loaded. Extension ID:', chrome.runtime?.id || 'unknown');

const getAssetURL = (name) => {
    try {
        return chrome.runtime.getURL(`assets/${name}.svg`);
    } catch (e) {
        console.warn('[Flex on LinkedIn] Could not get asset URL', e);
        return '';
    }
};

// Inject Floating Solve Button
function injectSolveButton() {
    if (document.getElementById('linkedin-flex-floating-container')) return;
    
    console.log('[Flex on LinkedIn] Injecting solve button...');
    const container = document.createElement('div');
    container.id = 'linkedin-flex-floating-container';
    container.className = 'sketchy-container';
    
    const faceImg = document.createElement('img');
    faceImg.id = 'linkedin-flex-face';
    faceImg.src = getAssetURL('excited');
    faceImg.className = 'sketchy-face';
    
    const btn = document.createElement('button');
    btn.id = 'linkedin-flex-floating-btn';
    btn.className = 'sketchy-solve-btn';
    btn.innerText = 'Solve';
    
    let isSolving = false;
    let animationInterval = null;

    function startFaceAnimation() {
        const faces = ['excited', 'panic', 'furrowed', 'neutral'].map(getAssetURL);
        let i = 0;
        animationInterval = setInterval(() => {
            faceImg.src = faces[i % faces.length];
            i++;
        }, 200);
    }

    function stopFaceAnimation(finalFaceName) {
        if (animationInterval) clearInterval(animationInterval);
        faceImg.src = getAssetURL(finalFaceName);
    }

    container.onclick = async () => {
        if (isSolving) return;
        isSolving = true;
        btn.disabled = true;
        container.classList.add('solving');
        btn.innerText = 'Solving...';
        
        faceImg.src = getAssetURL('excited');
        await new Promise(r => setTimeout(r, 600));

        startFaceAnimation();

        const gameType = detectGame();
        console.log('[Flex on LinkedIn] Solving game type:', gameType);
        let success = false;
        
        try {
            if (gameType === 'queens') success = await solveQueens();
            else if (gameType === 'sudoku') success = await solveSudoku();
            else if (gameType === 'patches') success = await solvePatches();
            else if (gameType === 'zip') success = await solveZip();
            else if (gameType === 'tango') success = await solveTango();
        } catch (e) {
            console.error('[Flex on LinkedIn] Solver error', e);
        }

        stopFaceAnimation(success ? 'happy' : 'confused');
        
        if (success) {
            btn.innerText = 'Solved!';
            container.classList.add('solved');
        } else {
            btn.innerText = 'Failed';
            container.classList.add('failed');
        }

        setTimeout(() => {
            btn.innerText = 'Solve';
            btn.disabled = false;
            container.classList.remove('solving', 'solved', 'failed');
            faceImg.src = getAssetURL('excited');
            isSolving = false;
        }, 3000);
    };

    container.appendChild(faceImg);
    container.appendChild(btn);
    document.body.appendChild(container);
}

function detectGame() {
    const url = window.location.href;
    
    // Only show on specific game pages
    if (url.includes('/queens') || url.includes('/mini-sudoku') || url.includes('/patches') || url.includes('/zip') || url.includes('/tango')) {
        const workspace = document.querySelector('main#workspace');
        const queensGrid = document.querySelector('.queens-grid');
        const sudokuGrid = document.querySelector('.sudoku-grid') || document.querySelector('.sudoku-board-container');
        const tangoGrid = document.querySelector('.tango-grid-container') || document.querySelector('[class*="tango-grid"]');
        
        if (workspace || queensGrid || sudokuGrid || tangoGrid) {
            if (url.includes('/queens')) return 'queens';
            if (url.includes('/mini-sudoku')) return 'sudoku';
            if (url.includes('/patches')) return 'patches';
            if (url.includes('/zip')) return 'zip';
            if (url.includes('/tango')) return 'tango';
        }
    }
    return 'unknown';
}


// Initial check and observer to handle SPA navigation
function init() {
    const gameType = detectGame();
    if (gameType !== 'unknown') {
        injectSolveButton();
    } else {
        const existing = document.getElementById('linkedin-flex-floating-container');
        if (existing) {
            existing.remove();
        }
    }
}

// Watch for URL changes or DOM changes that might indicate game load
const observer = new MutationObserver(init);
observer.observe(document.body, { childList: true, subtree: true });
init();

async function solveQueens() {
    console.log('[Flex on LinkedIn] Solving Queens...');
    try {
        const url = chrome.runtime.getURL('solvers/queens.js');
        const solver = await import(url);
        return await solver.solve();
    } catch (e) {
        console.error('[Flex on LinkedIn] Error loading Queens solver', e);
        return false;
    }
}

async function solveSudoku() {
    console.log('[Flex on LinkedIn] Solving Sudoku...');
    try {
        const url = chrome.runtime.getURL('solvers/sudoku.js');
        const solver = await import(url);
        return await solver.solve();
    } catch (e) {
        console.error('[Flex on LinkedIn] Error loading Sudoku solver', e);
        return false;
    }
}

async function solvePatches() {
    console.log('[Flex on LinkedIn] Solving Patches...');
    try {
        const url = chrome.runtime.getURL('solvers/patches.js');
        const solver = await import(url);
        return await solver.solve();
    } catch (e) {
        console.error('[Flex on LinkedIn] Error loading Patches solver', e);
        return false;
    }
}

async function solveZip() {
    console.log('[Flex on LinkedIn] Solving Zip...');
    try {
        const url = chrome.runtime.getURL('solvers/zip.js');
        console.log('[Flex on LinkedIn] Importing Zip solver from:', url);
        const solver = await import(url);
        return await solver.solve();
    } catch (e) {
        console.error('[Flex on LinkedIn] Error loading Zip solver', e);
        return false;
    }
}

async function solveTango() {
    console.log('[Flex on LinkedIn] Solving Tango...');
    try {
        const url = chrome.runtime.getURL('solvers/tango.js');
        const solver = await import(url);
        return await solver.solve();
    } catch (e) {
        console.error('[Flex on LinkedIn] Error loading Tango solver', e);
        return false;
    }
}
