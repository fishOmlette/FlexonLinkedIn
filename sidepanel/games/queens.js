import { seededRandom, seededShuffle } from './utils.js';

const QUEENS_COLORS = [
    '#e9d5ff', // Pastel Lavender
    '#bbf7d0', // Pastel Mint
    '#ffedd5', // Pastel Peach
    '#fecdd3', // Pastel Rose
    '#fef08a', // Pastel Lemon
    '#bae6fd', // Pastel Sky
    '#f5d0fe', // Pastel Lilac
    '#fed7aa', // Pastel Apricot
    '#d9f99d'  // Pastel Sage
];

function generateSolvedQueens(N, rand) {
    const queens = []; // array of {row, col}
    
    function isSafe(row, col) {
        for (const q of queens) {
            if (q.row === row || q.col === col) return false;
            if (Math.abs(q.row - row) <= 1 && Math.abs(q.col - col) <= 1) return false;
        }
        return true;
    }
    
    function backtrack(row) {
        if (row === N) return true;
        const cols = seededShuffle(Array(N).fill(0).map((_, i) => i), rand);
        for (const col of cols) {
            if (isSafe(row, col)) {
                queens.push({ row, col });
                if (backtrack(row + 1)) return true;
                queens.pop();
            }
        }
        return false;
    }
    
    if (backtrack(0)) return queens;
    return null;
}

function generateQueensRegions(queens, N, rand) {
    const grid = Array(N).fill(-1).map(() => Array(N).fill(-1));
    queens.forEach((q, idx) => {
        grid[q.row][q.col] = idx;
    });
    
    let unassignedCount = N * N - N;
    const dirs = [
        { r: -1, c: 0 },
        { r: 1, c: 0 },
        { r: 0, c: -1 },
        { r: 0, c: 1 }
    ];
    
    while (unassignedCount > 0) {
        let madeProgress = false;
        
        for (let regionId = 0; regionId < N; regionId++) {
            const regionCells = [];
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    if (grid[r][c] === regionId) {
                        regionCells.push({ r, c });
                    }
                }
            }
            
            const candidates = [];
            const seen = new Set();
            for (const cell of regionCells) {
                for (const dir of dirs) {
                    const nr = cell.r + dir.r;
                    const nc = cell.c + dir.c;
                    if (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] === -1) {
                        const key = `${nr},${nc}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            candidates.push({ r: nr, c: nc });
                        }
                    }
                }
            }
            
            if (candidates.length > 0) {
                const chosen = candidates[Math.floor(rand() * candidates.length)];
                grid[chosen.r][chosen.c] = regionId;
                unassignedCount--;
                madeProgress = true;
            }
        }
        
        if (!madeProgress && unassignedCount > 0) {
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    if (grid[r][c] === -1) {
                        const adjRegions = [];
                        for (const dir of dirs) {
                            const nr = r + dir.r;
                            const nc = c + dir.c;
                            if (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] !== -1) {
                                adjRegions.push(grid[nr][nc]);
                            }
                        }
                        if (adjRegions.length > 0) {
                            grid[r][c] = adjRegions[Math.floor(rand() * adjRegions.length)];
                            unassignedCount--;
                        }
                    }
                }
            }
        }
    }
    
    return grid;
}

function countQueensSolutions(grid, N, limit = 2) {
    let solutionsCount = 0;
    const queens = [];
    
    function isSafe(row, col) {
        for (const q of queens) {
            if (q.row === row || q.col === col) return false;
            if (Math.abs(q.row - row) <= 1 && Math.abs(q.col - col) <= 1) return false;
        }
        const regionId = grid[row][col];
        for (const q of queens) {
            if (grid[q.row][q.col] === regionId) return false;
        }
        return true;
    }
    
    function backtrack(row) {
        if (row === N) {
            solutionsCount++;
            return solutionsCount >= limit;
        }
        for (let col = 0; col < N; col++) {
            if (isSafe(row, col)) {
                queens.push({ row, col });
                if (backtrack(row + 1)) return true;
                queens.pop();
            }
        }
        return false;
    }
    
    backtrack(0);
    return solutionsCount;
}

function generatePlayableQueens(seed, difficulty) {
    let N = 7; // Medium
    if (difficulty === 'easy') N = 6;
    else if (difficulty === 'medium') N = 7;
    else if (difficulty === 'hard') N = 8;
    else if (difficulty === 'expert') N = 9;
    
    let solvedQueens = null;
    let regionsGrid = null;
    let attempts = 0;
    let currentSeedOffset = 0;
    
    while (attempts < 100) {
        const attemptRand = seededRandom(seed + currentSeedOffset);
        solvedQueens = generateSolvedQueens(N, attemptRand);
        if (solvedQueens) {
            regionsGrid = generateQueensRegions(solvedQueens, N, attemptRand);
            if (countQueensSolutions(regionsGrid, N) === 1) {
                break;
            }
        }
        currentSeedOffset += 12345;
        attempts++;
    }
    
    console.log(`[Flex Arcade] Seeded Queens generated. Size: ${N}x${N}, attempts: ${attempts + 1}`);
    return {
        size: N,
        regionsGrid,
        solvedQueens
    };
}

export class QueensGame {
    constructor(seed, difficulty) {
        this.seed = seed;
        this.difficulty = difficulty;
        this.boardState = generatePlayableQueens(seed, difficulty);
        this.userGrid = Array(this.boardState.size).fill(0).map(() => Array(this.boardState.size).fill(0));
        this.selectedCell = null;
        this.containerEl = null;
        this.callbacks = null;
    }

    getTitle() {
        return '👑 Queens';
    }

    getRulesText() {
        return 'Place exactly one queen (crown) in every row, column, and colored region such that no two queens touch (not even diagonally). Click cells to toggle Empty ➔ Cross ➔ Crown!';
    }

    getGamePrefix() {
        return 'qu';
    }

    needsKeyboardControls() {
        return false;
    }

    render(containerEl, callbacks) {
        this.containerEl = containerEl;
        this.callbacks = callbacks;
        this.containerEl.innerHTML = '';

        const N = this.boardState.size;
        const boardWrapper = document.createElement('div');
        boardWrapper.className = 'queens-board';
        boardWrapper.style.setProperty('--queens-size', N);

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const regionId = this.boardState.regionsGrid[r][c];
                const cellVal = this.userGrid[r][c]; // 0: Empty, 1: Cross, 2: Crown

                const cell = document.createElement('div');
                cell.className = 'queens-cell';
                cell.setAttribute('data-row', r);
                cell.setAttribute('data-col', c);

                // Set region sketchy color
                cell.style.backgroundColor = QUEENS_COLORS[regionId % QUEENS_COLORS.length];

                // Draw region borders dynamically
                if (c < N - 1 && this.boardState.regionsGrid[r][c] !== this.boardState.regionsGrid[r][c+1]) {
                    cell.style.borderRight = '3px solid #333';
                }
                if (r < N - 1 && this.boardState.regionsGrid[r][c] !== this.boardState.regionsGrid[r+1][c]) {
                    cell.style.borderBottom = '3px solid #333';
                }

                // Draw sketchy values
                if (cellVal === 1) {
                    cell.classList.add('has-cross');
                } else if (cellVal === 2) {
                    const img = document.createElement('img');
                    img.src = '../assets/crown.svg';
                    img.className = 'queens-crown-img';
                    cell.appendChild(img);

                    // Mistakes validation
                    const isCorrectQueen = this.boardState.solvedQueens.some(q => q.row === r && q.col === c);
                    if (!isCorrectQueen) {
                        cell.classList.add('incorrect');
                    }
                }

                // Click handler
                cell.onclick = () => {
                    this.selectCell(cell, r, c);
                    this.toggleCell(r, c);
                };

                boardWrapper.appendChild(cell);
            }
        }

        this.containerEl.appendChild(boardWrapper);

        // Restore visual selected outline if one was active
        if (this.selectedCell) {
            const activeCellEl = this.containerEl.querySelector(
                `.queens-cell[data-row="${this.selectedCell.r}"][data-col="${this.selectedCell.c}"]`
            );
            if (activeCellEl) {
                activeCellEl.classList.add('selected');
                this.selectedCell.el = activeCellEl;
            }
        }
    }

    selectCell(cellEl, r, c) {
        const prevSelected = this.containerEl.querySelector('.queens-cell.selected');
        if (prevSelected) prevSelected.classList.remove('selected');

        this.selectedCell = { r, c, el: cellEl };
        cellEl.classList.add('selected');
        console.log(`[Flex Arcade] Queens Cell selected: (${r + 1}, ${c + 1})`);

        if (this.callbacks && typeof this.callbacks.onSelect === 'function') {
            this.callbacks.onSelect(r, c);
        }
    }

    toggleCell(r, c) {
        const currentVal = this.userGrid[r][c];
        const newVal = (currentVal + 1) % 3; // Toggle Empty ➔ Cross ➔ Crown ➔ Empty
        this.userGrid[r][c] = newVal;

        this.render(this.containerEl, this.callbacks);

        // Re-focus selection
        const cellEl = this.containerEl.querySelector(`.queens-cell[data-row="${r}"][data-col="${c}"]`);
        if (cellEl) {
            this.selectCell(cellEl, r, c);
        }

        let errorPlaced = false;
        if (newVal === 2) {
            const isCorrectQueen = this.boardState.solvedQueens.some(q => q.row === r && q.col === c);
            if (!isCorrectQueen) {
                errorPlaced = true;
            }
        }

        const solved = this.isSolved();
        
        // Notify the callback on action triggers if required
        if (this.callbacks && typeof this.callbacks.onAction === 'function') {
            this.callbacks.onAction({ errorPlaced, isSolved: solved });
        }
        
        return { errorPlaced, isSolved: solved };
    }

    deselect() {
        if (this.containerEl) {
            const selectedEl = this.containerEl.querySelector('.queens-cell.selected');
            if (selectedEl) selectedEl.classList.remove('selected');
        }
        this.selectedCell = null;
        console.log('[Flex Arcade] Queens deselect executed.');
    }

    handleKeyDown(e) {
        const key = e.key.toLowerCase();
        const N = this.boardState.size;

        // Arrow/WASD Navigation
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
            e.preventDefault();
            let r = 0;
            let c = 0;

            if (this.selectedCell) {
                r = this.selectedCell.r;
                c = this.selectedCell.c;

                if (key === 'arrowup' || key === 'w') r = Math.max(0, r - 1);
                else if (key === 'arrowdown' || key === 's') r = Math.min(N - 1, r + 1);
                else if (key === 'arrowleft' || key === 'a') c = Math.max(0, c - 1);
                else if (key === 'arrowright' || key === 'd') c = Math.min(N - 1, c + 1);
            }

            const newCellEl = this.containerEl.querySelector(`.queens-cell[data-row="${r}"][data-col="${c}"]`);
            if (newCellEl) {
                this.selectCell(newCellEl, r, c);
            }
            return null;
        }

        // Toggle on Space/Enter
        if (key === ' ' || key === 'enter') {
            if (this.selectedCell) {
                e.preventDefault();
                return this.toggleCell(this.selectedCell.r, this.selectedCell.c);
            }
        }
        return null;
    }

    handleNumberInput(val) {
        return null; // Queens doesn't use standard number inputs
    }

    handleReset() {
        console.log('[Flex Arcade] Resetting Queens board...');
        const N = this.boardState.size;
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                this.userGrid[r][c] = 0;
            }
        }
        this.selectedCell = null;
        this.render(this.containerEl, this.callbacks);
    }

    handleHint() {
        console.log('[Flex Arcade] Queens Hint triggered.');
        let foundCell = null;
        for (const q of this.boardState.solvedQueens) {
            if (this.userGrid[q.row][q.col] !== 2) {
                foundCell = { r: q.row, c: q.col, val: 2 };
                break;
            }
        }

        if (foundCell) {
            this.userGrid[foundCell.r][foundCell.c] = 2; // Place Crown
            this.render(this.containerEl, this.callbacks);

            const cellEl = this.containerEl.querySelector(
                `.queens-cell[data-row="${foundCell.r}"][data-col="${foundCell.c}"]`
            );
            if (cellEl) {
                this.selectCell(cellEl, foundCell.r, foundCell.c);
            }

            const solved = this.isSolved();
            return { success: true, isSolved: solved };
        }
        return { success: false, isSolved: this.isSolved() };
    }

    isSolved() {
        const N = this.boardState.size;
        for (const q of this.boardState.solvedQueens) {
            if (this.userGrid[q.row][q.col] !== 2) {
                return false;
            }
        }
        let crownCount = 0;
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (this.userGrid[r][c] === 2) crownCount++;
            }
        }
        return crownCount === N;
    }
}
