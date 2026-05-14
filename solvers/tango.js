export async function solve() {
    console.log('[Flex on LinkedIn] Tango solver started');
    try {
        const board = parseBoard();
        if (!board) {
            console.error('[Flex on LinkedIn] Could not parse Tango board');
            return false;
        }

        console.log('[Flex on LinkedIn] Parsed board:', board);
        const solution = findSolution(board);
        
        if (solution) {
            console.log('[Flex on LinkedIn] Solution found:', solution);
            await applySolution(solution, board);
            return true;
        } else {
            console.error('[Flex on LinkedIn] No solution found');
            return false;
        }
    } catch (error) {
        console.error('[Flex on LinkedIn] Tango solver encountered an error:', error);
        return false;
    }
}

function parseBoard() {
    const gridContainer = document.querySelector('[data-testid="interactive-grid"]');
    if (!gridContainer) {
        console.error('Interactive grid not found');
        return null;
    }

    const cellElements = Array.from(gridContainer.querySelectorAll('div[id^="tango-cell-"]'));
    if (cellElements.length === 0) {
        console.error('No cells found');
        return null;
    }

    // Grid size from style or count
    const totalCells = cellElements.length;
    const size = Math.sqrt(totalCells);
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    const fixed = Array.from({ length: size }, () => Array(size).fill(false));
    const cells = [];

    cellElements.forEach((el) => {
        const idMatch = el.id.match(/tango-cell-(\d+)/);
        if (!idMatch) return;
        const idx = parseInt(idMatch[1]);
        const r = Math.floor(idx / size);
        const c = idx % size;

        let val = null;
        const symbolSvg = el.querySelector('svg[data-testid="cell-one"]');
        if (symbolSvg) {
            const label = (symbolSvg.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('sun')) val = 0;
            else if (label.includes('moon')) val = 1;
        }
        
        grid[r][c] = val;
        // ONLY mark as fixed if it's disabled (official pre-placed piece)
        fixed[r][c] = el.getAttribute('aria-disabled') === 'true';
        cells.push({ el, r, c });
    });

    // Parse constraints
    const constraints = [];
    cellElements.forEach((el) => {
        const idMatch = el.id.match(/tango-cell-(\d+)/);
        if (!idMatch) return;
        const idx = parseInt(idMatch[1]);
        const r = Math.floor(idx / size);
        const c = idx % size;

        const cellRect = el.getBoundingClientRect();
        const svgs = el.querySelectorAll('svg');
        
        svgs.forEach(svg => {
            const testId = svg.getAttribute('data-testid');
            if (testId === 'edge-equal' || testId === 'edge-cross') {
                const type = testId === 'edge-equal' ? 'equal' : 'cross';
                const svgRect = svg.getBoundingClientRect();
                
                // Relative position to cell center
                const relX = svgRect.left + svgRect.width / 2 - (cellRect.left + cellRect.width / 2);
                const relY = svgRect.top + svgRect.height / 2 - (cellRect.top + cellRect.height / 2);

                if (relX > 20 && c + 1 < size) {
                    constraints.push({ r1: r, c1: c, r2: r, c2: c + 1, type });
                } else if (relX < -20 && c - 1 >= 0) {
                    constraints.push({ r1: r, c1: c, r2: r, c2: c - 1, type });
                } else if (relY > 20 && r + 1 < size) {
                    constraints.push({ r1: r, c1: c, r2: r + 1, c2: c, type });
                } else if (relY < -20 && r - 1 >= 0) {
                    constraints.push({ r1: r, c1: c, r2: r - 1, c2: c, type });
                }
            }
        });
    });

    console.log('Final parsed constraints:', constraints);
    return { size, grid, fixed, constraints, cells };
}

function findSolution(board) {
    const { size, constraints, grid: initialGrid, fixed } = board;
    const grid = initialGrid.map((row, r) => row.map((val, c) => fixed[r][c] ? val : null));

    function isValid(r, c, val) {
        // Rule: No three consecutive same symbols
        // Horizontal
        if (c >= 2 && grid[r][c - 1] === val && grid[r][c - 2] === val) return false;
        if (c + 2 < size && grid[r][c + 1] === val && grid[r][c + 2] === val) return false;
        if (c >= 1 && c + 1 < size && grid[r][c - 1] === val && grid[r][c + 1] === val) return false;

        // Vertical
        if (r >= 2 && grid[r - 1][c] === val && grid[r - 2][c] === val) return false;
        if (r + 2 < size && grid[r + 1][c] === val && grid[r + 2][c] === val) return false;
        if (r >= 1 && r + 1 < size && grid[r - 1][c] === val && grid[r + 1][c] === val) return false;

        // Rule: Balanced suns/moons in row/col
        let rowCount = 0;
        let colCount = 0;
        for (let i = 0; i < size; i++) {
            if (grid[r][i] === val) rowCount++;
            if (grid[i][c] === val) colCount++;
        }
        if (rowCount >= size / 2) return false;
        if (colCount >= size / 2) return false;

        // Rule: Constraints
        for (const cons of constraints) {
            const { r1, c1, r2, c2, type } = cons;
            if ((r1 === r && c1 === c) || (r2 === r && c2 === c)) {
                const otherR = r1 === r && c1 === c ? r2 : r1;
                const otherC = r1 === r && c1 === c ? c2 : c1;
                const otherVal = grid[otherR][otherC];
                
                if (otherVal !== null) {
                    if (type === 'equal' && val !== otherVal) return false;
                    if (type === 'cross' && val === otherVal) return false;
                }
            }
        }

        return true;
    }

    function backtrack(idx) {
        if (idx === size * size) {
            // Final check: each row and column must have exactly size/2 of each
            for (let i = 0; i < size; i++) {
                let rSum = 0, cSum = 0;
                for (let j = 0; j < size; j++) {
                    rSum += grid[i][j];
                    cSum += grid[j][i];
                }
                if (rSum !== size / 2 || cSum !== size / 2) return false;
            }
            return true;
        }

        const r = Math.floor(idx / size);
        const c = idx % size;

        if (board.fixed[r][c]) {
            return backtrack(idx + 1);
        }

        for (let val of [0, 1]) {
            if (isValid(r, c, val)) {
                grid[r][c] = val;
                if (backtrack(idx + 1)) return true;
                grid[r][c] = null;
            }
        }

        return false;
    }

    if (backtrack(0)) return grid;
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

async function applySolution(solution, board) {
    for (let r = 0; r < board.size; r++) {
        for (let c = 0; c < board.size; c++) {
            if (board.fixed[r][c]) continue;

            try {
                const targetVal = solution[r][c];
                const cellInfo = board.cells.find(cell => cell.r === r && cell.c === c);
                if (!cellInfo) continue;

                // Current state
                let currentVal = null;
                const symbolSvg = cellInfo.el.querySelector('svg[data-testid="cell-one"]');
                if (symbolSvg) {
                    const label = (symbolSvg.getAttribute('aria-label') || '').toLowerCase();
                    if (label.includes('sun')) currentVal = 0;
                    else if (label.includes('moon')) currentVal = 1;
                }

                // Cycle: Empty -> 0 (Sun) -> 1 (Moon) -> Empty
                let clicksNeeded = 0;
                if (currentVal === null) {
                    clicksNeeded = targetVal === 0 ? 1 : 2;
                } else if (currentVal === 0) {
                    clicksNeeded = targetVal === 1 ? 1 : 2;
                } else if (currentVal === 1) {
                    clicksNeeded = targetVal === 0 ? 2 : 0;
                }

                for (let i = 0; i < clicksNeeded; i++) {
                    await robustClick(cellInfo.el);
                    await new Promise(r => setTimeout(r, 50));
                }
                
                cellInfo.el.style.outline = '2px solid #22c55e';
            } catch (e) {
                console.error('[Flex on LinkedIn] Error applying solution to cell:', e);
            }
        }
    }
}
