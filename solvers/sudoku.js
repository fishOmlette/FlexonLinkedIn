export async function solve() {
    console.log('[Flex on LinkedIn] Sudoku solver started');
    try {
        const board = parseBoard();
        if (!board) {
            console.warn('[Flex on LinkedIn] Could not parse board');
            return false;
        }

        if (solveSudoku(board.grid)) {
            await applySolution(board.grid, board.cells);
            return true;
        } else {
            console.warn('[Flex on LinkedIn] No solution found');
            return false;
        }
    } catch (error) {
        console.error('[Flex on LinkedIn] Sudoku solver encountered an error:', error);
        return false;
    }
}

function parseBoard() {
    const gridEl = document.querySelector('.sudoku-grid') || document.querySelector('.sudoku-board-container') || document.querySelector('main');
    if (!gridEl) return null;

    const cellElements = Array.from(gridEl.querySelectorAll('.sudoku-cell'));
    if (cellElements.length === 0) return null;


    const size = 6;
    const grid = [];
    const cells = [];

    cellElements.forEach((el, idx) => {
        const row = Math.floor(idx / size);
        const col = idx % size;
        if (!grid[row]) grid[row] = [];
        
        const valText = el.innerText.trim();
        const val = parseInt(valText) || 0;
        grid[row][col] = val;
        cells.push({ el, row, col });
    });

    return { grid, cells };
}

function solveSudoku(grid) {
    const size = 6;
    
    function isSafe(row, col, num) {
        for (let x = 0; x < size; x++) if (grid[row][x] === num) return false;
        for (let x = 0; x < size; x++) if (grid[x][col] === num) return false;

        const startRow = row - (row % 2);
        const startCol = col - (col % 3);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                if (grid[i + startRow][j + startCol] === num) return false;
            }
        }
        return true;
    }

    function findEmpty() {
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (grid[r][c] === 0) return [r, c];
            }
        }
        return null;
    }

    const empty = findEmpty();
    if (!empty) return true;

    const [row, col] = empty;
    for (let num = 1; num <= 6; num++) {
        if (isSafe(row, col, num)) {
            grid[row][col] = num;
            if (solveSudoku(grid)) return true;
            grid[row][col] = 0;
        }
    }
    return false;
}

async function robustClick(element) {
    if (!element) return;
    try {
        const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
        for (const name of events) {
            element.dispatchEvent(new MouseEvent(name, {
                bubbles: true,
                cancelable: true,
                view: window
            }));
            await new Promise(r => setTimeout(r, 10));
        }
    } catch (e) {
        console.warn('[Flex on LinkedIn] robustClick failed:', e);
    }
}

async function applySolution(grid, cells) {
    console.log('[Flex on LinkedIn] Applying solution...');

    for (const cell of cells) {
        try {
            const val = grid[cell.row][cell.col];
            // Check content inside .sudoku-cell-content or the cell itself
            const contentEl = cell.el.querySelector('.sudoku-cell-content') || cell.el;
            const currentValText = contentEl.innerText.trim();
            const currentVal = parseInt(currentValText) || 0;
            
            if (currentVal === 0) {
                // Click the cell first to activate it
                await robustClick(cell.el);
                await new Promise(r => setTimeout(r, 100));
                
                // Find the number button using data-number attribute
                const btn = document.querySelector(`.sudoku-input-button[data-number="${val}"]`);
                if (btn) {
                    await robustClick(btn);
                    await new Promise(r => setTimeout(r, 150));
                } else {
                    console.warn('[Flex on LinkedIn] Could not find button for number', val);
                }
            }
        } catch (e) {
            console.error('[Flex on LinkedIn] Error applying solution to cell:', e);
        }
    }
    console.log('[Flex on LinkedIn] Solution applied!');
}



