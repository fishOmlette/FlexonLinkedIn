import { seededRandom, seededShuffle } from './utils.js';

const SUDOKU_SIZE = 6;
const BLOCK_ROWS = 2;
const BLOCK_COLS = 3;

// Checks if placing num at grid[row][col] is valid
function isSudokuSafe(grid, row, col, num) {
    // Row check
    for (let x = 0; x < SUDOKU_SIZE; x++) {
        if (grid[row][x] === num) return false;
    }
    // Column check
    for (let x = 0; x < SUDOKU_SIZE; x++) {
        if (grid[x][col] === num) return false;
    }
    // Block check (2x3)
    const startRow = row - (row % BLOCK_ROWS);
    const startCol = col - (col % BLOCK_COLS);
    for (let r = 0; r < BLOCK_ROWS; r++) {
        for (let c = 0; c < BLOCK_COLS; c++) {
            if (grid[r + startRow][c + startCol] === num) return false;
        }
    }
    return true;
}

// Generates a fully solved 6x6 Sudoku grid using seeded random
function generateSolvedSudoku(rand) {
    const grid = Array(SUDOKU_SIZE).fill(0).map(() => Array(SUDOKU_SIZE).fill(0));
    
    function fillCell(row, col) {
        if (row === SUDOKU_SIZE - 1 && col === SUDOKU_SIZE) return true;
        if (col === SUDOKU_SIZE) {
            row++;
            col = 0;
        }
        if (grid[row][col] !== 0) return fillCell(row, col + 1);

        const nums = seededShuffle([1, 2, 3, 4, 5, 6], rand);
        for (const num of nums) {
            if (isSudokuSafe(grid, row, col, num)) {
                grid[row][col] = num;
                if (fillCell(row, col + 1)) return true;
                grid[row][col] = 0;
            }
        }
        return false;
    }

    fillCell(0, 0);
    return grid;
}

// Solver that counts the total number of solutions for a grid
function countSolutions(grid, limit = 2) {
    let solutionsCount = 0;
    
    function solve(row, col) {
        if (row === SUDOKU_SIZE - 1 && col === SUDOKU_SIZE) {
            solutionsCount++;
            return solutionsCount >= limit;
        }
        if (col === SUDOKU_SIZE) {
            row++;
            col = 0;
        }
        if (grid[row][col] !== 0) return solve(row, col + 1);

        for (let num = 1; num <= 6; num++) {
            if (isSudokuSafe(grid, row, col, num)) {
                grid[row][col] = num;
                if (solve(row, col + 1)) return true;
                grid[row][col] = 0;
            }
        }
        return false;
    }

    solve(0, 0);
    return solutionsCount;
}

// Generates a playable Sudoku board
function generatePlayableSudoku(seed, difficulty) {
    const rand = seededRandom(seed);
    const solvedGrid = generateSolvedSudoku(rand);
    
    let targetEmptyCells = 16; // Easy (20 clues)
    if (difficulty === 'medium') targetEmptyCells = 20; // Medium (16 clues)
    else if (difficulty === 'hard') targetEmptyCells = 24; // Hard (12 clues)
    else if (difficulty === 'expert') targetEmptyCells = 27; // Expert (9 clues)

    const playableGrid = solvedGrid.map(row => [...row]);
    
    const cellCoords = [];
    for (let r = 0; r < SUDOKU_SIZE; r++) {
        for (let c = 0; c < SUDOKU_SIZE; c++) {
            cellCoords.push({ r, c });
        }
    }
    const shuffledCoords = seededShuffle(cellCoords, rand);

    let cellsEmptied = 0;
    for (const coord of shuffledCoords) {
        if (cellsEmptied >= targetEmptyCells) break;

        const val = playableGrid[coord.r][coord.c];
        playableGrid[coord.r][coord.c] = 0;

        if (countSolutions(playableGrid.map(row => [...row])) === 1) {
            cellsEmptied++;
        } else {
            playableGrid[coord.r][coord.c] = val;
        }
    }

    const fixed = Array(SUDOKU_SIZE).fill(0).map(() => Array(SUDOKU_SIZE).fill(false));
    for (let r = 0; r < SUDOKU_SIZE; r++) {
        for (let c = 0; c < SUDOKU_SIZE; c++) {
            if (playableGrid[r][c] !== 0) {
                fixed[r][c] = true;
            }
        }
    }

    console.log(`[Flex Arcade] Seeded Sudoku grid generated. Clues remaining: ${36 - cellsEmptied}`);
    return {
        playableGrid,
        solutionGrid: solvedGrid,
        fixed
    };
}

export class SudokuGame {
    constructor(seed, difficulty) {
        this.seed = seed;
        this.difficulty = difficulty;
        this.boardState = generatePlayableSudoku(seed, difficulty);
        this.userGrid = this.boardState.playableGrid.map(row => [...row]);
        this.selectedCell = null;
        this.containerEl = null;
        this.callbacks = null;
    }

    getTitle() {
        return '✏️ Mini Sudoku';
    }

    getRulesText() {
        return 'Every row, column, and bold 2x3 block must contain the numbers 1 through 6 exactly once. Empty cells highlight in green on click!';
    }

    getGamePrefix() {
        return 'su';
    }

    needsKeyboardControls() {
        return true;
    }

    render(containerEl, callbacks) {
        this.containerEl = containerEl;
        this.callbacks = callbacks;
        this.containerEl.innerHTML = '';

        const boardWrapper = document.createElement('div');
        boardWrapper.className = 'sudoku-board-6x6';

        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 6; c++) {
                const cellVal = this.userGrid[r][c];
                const isClue = this.boardState.fixed[r][c];

                const cell = document.createElement('div');
                cell.className = 'sudoku-cell';
                cell.setAttribute('data-row', r);
                cell.setAttribute('data-col', c);

                if (isClue) {
                    cell.classList.add('prefilled');
                    cell.innerText = cellVal;
                } else {
                    cell.classList.add('playable');
                    if (cellVal !== 0) {
                        cell.classList.add('user-filled');
                        cell.innerText = cellVal;

                        // Maintain incorrect red glow on rerender if value remains wrong
                        const correctVal = this.boardState.solutionGrid[r][c];
                        if (cellVal !== correctVal) {
                            cell.classList.add('incorrect');
                        }
                    }
                }

                // Add click listener
                cell.onclick = () => {
                    this.selectCell(cell, r, c);
                };

                boardWrapper.appendChild(cell);
            }
        }
        this.containerEl.appendChild(boardWrapper);

        // Restore selected cell visual state on re-render if it was selected
        if (this.selectedCell) {
            const activeCellEl = this.containerEl.querySelector(
                `.sudoku-cell[data-row="${this.selectedCell.r}"][data-col="${this.selectedCell.c}"]`
            );
            if (activeCellEl) {
                activeCellEl.classList.add('selected');
                this.selectedCell.el = activeCellEl;
            }
        }
    }

    selectCell(cellEl, r, c) {
        const prevSelected = this.containerEl.querySelector('.sudoku-cell.selected');
        if (prevSelected) prevSelected.classList.remove('selected');

        this.selectedCell = { r, c, el: cellEl };
        cellEl.classList.add('selected');
        console.log(`[Flex Arcade] Sudoku Cell selected: (${r + 1}, ${c + 1})`);
        
        if (this.callbacks && typeof this.callbacks.onSelect === 'function') {
            this.callbacks.onSelect(r, c);
        }
    }

    deselect() {
        if (this.containerEl) {
            const selectedEl = this.containerEl.querySelector('.sudoku-cell.selected');
            if (selectedEl) selectedEl.classList.remove('selected');
        }
        this.selectedCell = null;
        console.log('[Flex Arcade] Sudoku deselect executed.');
    }

    handleKeyDown(e) {
        const key = e.key.toLowerCase();

        // Arrow/WASD Navigation
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
            e.preventDefault();
            let r = 0;
            let c = 0;

            if (this.selectedCell) {
                r = this.selectedCell.r;
                c = this.selectedCell.c;

                if (key === 'arrowup' || key === 'w') r = Math.max(0, r - 1);
                else if (key === 'arrowdown' || key === 's') r = Math.min(5, r + 1);
                else if (key === 'arrowleft' || key === 'a') c = Math.max(0, c - 1);
                else if (key === 'arrowright' || key === 'd') c = Math.min(5, c + 1);
            }

            const newCellEl = this.containerEl.querySelector(`.sudoku-cell[data-row="${r}"][data-col="${c}"]`);
            if (newCellEl) {
                this.selectCell(newCellEl, r, c);
            }
            return null;
        }

        if (!this.selectedCell) return null;
        const { r, c } = this.selectedCell;
        if (this.boardState.fixed[r][c]) return null;

        if (e.key >= '1' && e.key <= '6') {
            return this.inputNumber(parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
            return this.inputNumber(0);
        }
        return null;
    }

    handleNumberInput(val) {
        if (!this.selectedCell) return null;
        const { r, c } = this.selectedCell;
        if (this.boardState.fixed[r][c]) return null;
        return this.inputNumber(val);
    }

    inputNumber(val) {
        if (!this.selectedCell) return null;
        const { r, c, el } = this.selectedCell;
        
        console.log(`[Flex Arcade] Sudoku Input number ${val} at (${r + 1}, ${c + 1})`);
        this.userGrid[r][c] = val;
        let errorPlaced = false;

        if (val === 0) {
            el.innerText = '';
            el.classList.remove('user-filled', 'incorrect');
        } else {
            el.innerText = val;
            el.classList.add('user-filled');

            const correctVal = this.boardState.solutionGrid[r][c];
            if (val !== correctVal) {
                el.classList.add('incorrect');
                errorPlaced = true;
            } else {
                el.classList.remove('incorrect');
            }
        }

        const solved = this.isSolved();
        return { errorPlaced, isSolved: solved };
    }

    handleReset() {
        console.log('[Flex Arcade] Resetting Sudoku board...');
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 6; c++) {
                if (!this.boardState.fixed[r][c]) {
                    this.userGrid[r][c] = 0;
                }
            }
        }
        this.selectedCell = null;
        this.render(this.containerEl, this.callbacks);
    }

    handleHint() {
        console.log('[Flex Arcade] Sudoku Hint triggered.');
        let foundCell = null;
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 6; c++) {
                if (!this.boardState.fixed[r][c]) {
                    const currentVal = this.userGrid[r][c];
                    const correctVal = this.boardState.solutionGrid[r][c];

                    if (currentVal === 0 || currentVal !== correctVal) {
                        foundCell = { r, c, val: correctVal };
                        break;
                    }
                }
            }
            if (foundCell) break;
        }

        if (foundCell) {
            this.userGrid[foundCell.r][foundCell.c] = foundCell.val;
            this.render(this.containerEl, this.callbacks);

            const cellEl = this.containerEl.querySelector(
                `.sudoku-cell[data-row="${foundCell.r}"][data-col="${foundCell.c}"]`
            );
            if (cellEl) {
                cellEl.classList.add('correct-filled');
                this.selectCell(cellEl, foundCell.r, foundCell.c);
            }

            const solved = this.isSolved();
            return { success: true, isSolved: solved };
        }
        return { success: false, isSolved: this.isSolved() };
    }

    isSolved() {
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 6; c++) {
                if (this.userGrid[r][c] !== this.boardState.solutionGrid[r][c]) {
                    return false;
                }
            }
        }
        return true;
    }
}
