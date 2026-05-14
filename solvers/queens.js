export async function solve() {
    console.log('[Flex on LinkedIn] Queens solver started');
    try {
        const board = parseBoard();
        if (!board) {
            console.warn('[Flex on LinkedIn] Could not parse board');
            return false;
        }

        const solution = findSolution(board);
        if (solution) {
            await applySolution(solution, board.cells);
            return true;
        } else {
            console.warn('[Flex on LinkedIn] No solution found');
            return false;
        }
    } catch (error) {
        console.error('[Flex on LinkedIn] Queens solver encountered an error:', error);
        return false;
    }
}

function parseBoard() {
    const workspace = document.querySelector('main#workspace') || document.querySelector('.queens-grid');
    if (!workspace) return null;

    const cellElements = Array.from(workspace.querySelectorAll('div[aria-label*="cell"]'));
    if (cellElements.length === 0) return null;

    const size = Math.sqrt(cellElements.length);
    const cells = [];
    const regions = new Map();

    cellElements.forEach((el, idx) => {
        const row = Math.floor(idx / size);
        const col = idx % size;
        
        // Extract region color from aria-label
        // Example: "Empty cell of color Lavender, row 1, column 1"
        const ariaLabel = el.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/color\s+([\w\s]+?)(?:,|$)/i);
        const regionId = match ? match[1].trim() : `region-${idx}`; // Unique fallback per cell if color not found

        cells.push({ el, row, col, regionId });
        
        if (!regions.has(regionId)) regions.set(regionId, []);
        regions.get(regionId).push({ row, col });
    });


    return { size, cells, regions: Array.from(regions.keys()) };
}

function findSolution(board) {
    const { size } = board;
    const queens = []; // Array of {row, col}

    function isSafe(row, col) {
        for (const q of queens) {
            if (q.row === row || q.col === col) return false;
            if (Math.abs(q.row - row) <= 1 && Math.abs(q.col - col) <= 1) return false;
        }

        const cell = board.cells.find(c => c.row === row && c.col === col);
        if (!cell) return false;
        
        const regionId = cell.regionId;
        for (const q of queens) {
            const qCell = board.cells.find(c => c.row === q.row && c.col === q.col);
            if (qCell && qCell.regionId === regionId) return false;
        }

        return true;
    }


    function backtrack(row) {
        if (row === size) return true;
        for (let col = 0; col < size; col++) {
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

async function applySolution(solution, cellElements) {
    for (const q of solution) {
        try {
            const cell = cellElements.find(c => c.row === q.row && c.col === q.col);
            if (cell && cell.el) {
                let ariaLabel = cell.el.getAttribute('aria-label') || '';
                
                if (ariaLabel.toLowerCase().includes('empty')) {
                    await robustClick(cell.el); // Becomes Cross
                    await new Promise(r => setTimeout(r, 100));
                    await robustClick(cell.el); // Becomes Queen
                } else if (ariaLabel.toLowerCase().includes('cross')) {
                    await robustClick(cell.el); // Becomes Queen
                }
                
                cell.el.style.outline = '3px solid #22c55e';
                await new Promise(r => setTimeout(r, 50));
            }
        } catch (e) {
            console.error('[Flex on LinkedIn] Error applying solution to cell:', e);
        }
    }
}


