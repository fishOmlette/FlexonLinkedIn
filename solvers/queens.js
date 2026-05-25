export async function solve() {
    console.log('[Flex on LinkedIn] Queens solver started');
    try {
        const board = parseBoard();
        if (!board) {
            console.warn('[Flex on LinkedIn] Could not parse board');
            return false;
        }

        // Try leaked solution (V1) first
        const leaked = tryGetLeakedSolution();
        if (leaked && Array.isArray(leaked) && leaked.length === board.size) {
            // Validate mathematical correctness of leaked solution to avoid applying stale payload from previous SPA sessions
            let isValidLeaked = true;
            const size = board.size;
            
            const seenRows = new Set();
            const seenCols = new Set();
            const seenRegions = new Set();
            
            for (const q of leaked) {
                if (!q || typeof q.row !== 'number' || typeof q.col !== 'number') {
                    isValidLeaked = false;
                    break;
                }
                if (q.row < 0 || q.row >= size || q.col < 0 || q.col >= size) {
                    isValidLeaked = false;
                    break;
                }
                if (seenRows.has(q.row) || seenCols.has(q.col)) {
                    isValidLeaked = false;
                    break;
                }
                seenRows.add(q.row);
                seenCols.add(q.col);
                
                const cell = board.cells.find(c => c.row === q.row && c.col === q.col);
                if (!cell || seenRegions.has(cell.regionId)) {
                    isValidLeaked = false;
                    break;
                }
                seenRegions.add(cell.regionId);
            }
            
            if (isValidLeaked) {
                for (let i = 0; i < leaked.length; i++) {
                    for (let j = i + 1; j < leaked.length; j++) {
                        const q1 = leaked[i];
                        const q2 = leaked[j];
                        if (Math.abs(q1.row - q2.row) <= 1 && Math.abs(q1.col - q2.col) <= 1) {
                            isValidLeaked = false;
                            break;
                        }
                    }
                    if (!isValidLeaked) break;
                }
            }

            if (isValidLeaked) {
                console.log('[Flex on LinkedIn] Valid leaked solution found!', leaked);
                await applySolution(leaked, board.cells);
                return true;
            } else {
                console.warn('[Flex on LinkedIn] Leaked Queens solution invalid or conflicts with board. Falling back to backtracking solver.');
            }
        }

        console.log('[Flex on LinkedIn] Leaked solution not found or empty. Running backtracking solver...');
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

function tryGetLeakedSolution() {
    try {
        const script = document.getElementById('rehydrate-data');
        if (!script || !script.textContent) return null;
        
        const content = script.textContent;
        const indicator = '\\"solution\\"';
        const anchor = content.indexOf(indicator);
        if (anchor < 0) return null;
        
        const start = content.indexOf('[', anchor + indicator.length);
        const end = content.indexOf(']', start);
        if (start < 0 || end < 0) return null;
        
        const substring = content.substring(start, end + 1);
        const parsed = JSON.parse(substring.replaceAll('\\', ''));
        return parsed;
    } catch (e) {
        console.warn('[Flex on LinkedIn] Failed to extract leaked solution:', e);
        return null;
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


