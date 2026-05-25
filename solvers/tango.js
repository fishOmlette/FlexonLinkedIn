export async function solve() {
    console.log('[Flex on LinkedIn] Tango solver started');
    try {
        const board = parseBoard();
        if (!board) {
            console.error('[Flex on LinkedIn] Could not parse Tango board');
            return false;
        }

        console.log('[Flex on LinkedIn] Parsed board:', board);

        // Try leaked solution (V1) first
        const leaked1D = tryGetLeakedSolution();
        if (leaked1D && Array.isArray(leaked1D) && leaked1D.length === board.size * board.size) {
            // Check conflicts with fixed cells to avoid applying stale solutions from previous games
            let hasConflict = false;
            for (let i = 0; i < leaked1D.length; i++) {
                const r = Math.floor(i / board.size);
                const c = i % board.size;
                const val = leaked1D[i];
                if (val === null) {
                    hasConflict = true;
                    break;
                }
                if (board.fixed[r][c] && board.grid[r][c] !== val) {
                    hasConflict = true;
                    break;
                }
            }

            if (!hasConflict) {
                console.log('[Flex on LinkedIn] Valid leaked 1D solution found!', leaked1D);
                const size = board.size;
                const solution2D = Array.from({ length: size }, () => Array(size).fill(null));
                for (let i = 0; i < leaked1D.length; i++) {
                    const r = Math.floor(i / size);
                    const c = i % size;
                    solution2D[r][c] = leaked1D[i];
                }
                console.log('[Flex on LinkedIn] Applying leaked solution:', solution2D);
                await applySolution(solution2D, board);
                return true;
            } else {
                console.warn('[Flex on LinkedIn] Leaked solution invalid or has conflicts. Falling back to local solver.');
            }
        }

        console.log('[Flex on LinkedIn] Leaked solution not found or empty. Running local solver...');
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
        const raw = JSON.parse(substring.replaceAll('\\', ''));
        if (!Array.isArray(raw)) return null;
        
        return raw.map(x => {
            if (x === 'LotkaCellValue_ZERO' || x === 0) return 0; // Sun
            if (x === 'LotkaCellValue_ONE' || x === 1) return 1;  // Moon
            return null;
        });
    } catch (e) {
        console.warn('[Flex on LinkedIn] Failed to extract leaked solution:', e);
        return null;
    }
}

function getPresetCellIndexes() {
    try {
        const script = document.getElementById('rehydrate-data');
        if (!script || !script.textContent) return null;
        
        const content = script.textContent;
        const indicator = '\\"presetCellIdxes\\"';
        const anchor = content.indexOf(indicator);
        if (anchor < 0) return null;
        
        const start = content.indexOf('[', anchor + indicator.length);
        const end = content.indexOf(']', start);
        if (start < 0 || end < 0) return null;
        
        const substring = content.substring(start, end + 1);
        const parsed = JSON.parse(substring.replaceAll('\\', ''));
        return Array.isArray(parsed) ? new Set(parsed) : null;
    } catch (e) {
        console.warn('[Flex on LinkedIn] Failed to extract preset cell indexes:', e);
        return null;
    }
}

function parseBoard() {
    const gridContainer = document.querySelector('[data-testid="interactive-grid"]') || document.querySelector('[class*="interactive-grid"]') || document.querySelector('.lotka-grid') || document.querySelector('main');
    if (!gridContainer) {
        console.error('Interactive grid not found');
        return null;
    }

    const cellElements = Array.from(gridContainer.querySelectorAll('[data-cell-idx], div[id^="tango-cell-"], div[class*="cell"]'));
    if (cellElements.length === 0) {
        console.error('No cells found');
        return null;
    }

    // Extract unique cells with indices robustly
    const parsedCells = [];
    cellElements.forEach((el) => {
        let idx = null;
        const cellIdxAttr = el.getAttribute('data-cell-idx');
        if (cellIdxAttr !== null && cellIdxAttr !== undefined) {
            idx = parseInt(cellIdxAttr);
        } else {
            const idMatch = el.id.match(/(?:tango-cell-|cell-)(\d+)/);
            if (idMatch) idx = parseInt(idMatch[1]);
        }
        if (idx !== null && !isNaN(idx)) {
            // Avoid duplicates if multiple selectors matched the same element
            if (!parsedCells.some(c => c.idx === idx)) {
                parsedCells.push({ el, idx });
            }
        }
    });

    if (parsedCells.length === 0) return null;

    // Grid size determination
    const totalCells = parsedCells.length;
    const size = Math.sqrt(totalCells);
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    const fixed = Array.from({ length: size }, () => Array(size).fill(false));
    const cells = [];

    // Parse preset cells from hydration payload first as a primary source of truth
    const presetSet = getPresetCellIndexes();

    parsedCells.forEach(({ el, idx }) => {
        const r = Math.floor(idx / size);
        const c = idx % size;

        let val = null;
        // Search inside cell for any SVG or IMG representation of sun/moon
        const symbolEl = el.querySelector('svg[aria-label], img[aria-label]') || el.querySelector('svg, img');
        if (symbolEl) {
            const label = (symbolEl.getAttribute('aria-label') || '').toLowerCase();
            const idAttr = (symbolEl.getAttribute('id') || '').toLowerCase();
            const testId = (symbolEl.getAttribute('data-testid') || '').toLowerCase();
            
            if (label.includes('sun') || idAttr.includes('sun') || testId.includes('sun')) {
                val = 0; // Sun
            } else if (label.includes('moon') || idAttr.includes('moon') || testId.includes('moon')) {
                val = 1; // Moon
            }
        }
        
        grid[r][c] = val;

        // Determine if preset (fixed cell)
        const isPreset = presetSet ? presetSet.has(idx) : (
            el.getAttribute('aria-disabled') === 'true' || 
            el.classList.contains('lotka-cell--locked') || 
            el.classList.contains('locked') || 
            el.hasAttribute('disabled')
        );

        fixed[r][c] = isPreset;
        cells.push({ el, r, c });
    });

    // Parse constraints
    const constraints = [];
    parsedCells.forEach(({ el, idx }) => {
        const r = Math.floor(idx / size);
        const c = idx % size;

        const cellRect = el.getBoundingClientRect();
        const svgs = el.querySelectorAll('svg');
        
        svgs.forEach(svg => {
            const testId = (svg.getAttribute('data-testid') || '').toLowerCase();
            const ariaLabel = (svg.getAttribute('aria-label') || '').toLowerCase();
            const classList = Array.from(svg.classList || []).join(' ').toLowerCase();

            let type = null;
            if (testId.includes('equal') || ariaLabel.includes('equal') || classList.includes('equal')) {
                type = 'equal';
            } else if (testId.includes('cross') || testId.includes('x') || ariaLabel.includes('cross') || ariaLabel.includes('x') || classList.includes('cross')) {
                type = 'cross';
            }

            if (type) {
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

async function resetBoard(board) {
    try {
        const buttons = Array.from(document.querySelectorAll('button'));
        const resetBtn = buttons.find(btn => {
            const text = btn.innerText.toLowerCase();
            return text.includes('reset') || btn.getAttribute('data-testid')?.includes('reset') || btn.getAttribute('aria-label')?.toLowerCase().includes('reset');
        });
        if (resetBtn) {
            console.log('[Flex on LinkedIn] Reset button found! Clicking it...');
            await robustClick(resetBtn);
            await new Promise(r => setTimeout(r, 300));
        } else {
            console.log('[Flex on LinkedIn] Reset button not found, falling back to manual cell clicking.');
            for (let r = 0; r < board.size; r++) {
                for (let c = 0; c < board.size; c++) {
                    if (board.fixed[r][c]) continue;
                    
                    const cellInfo = board.cells.find(cell => cell.r === r && cell.c === c);
                    if (!cellInfo) continue;
                    
                    // Click until blank
                    let maxClicks = 3;
                    while (maxClicks-- > 0) {
                        const symbolEl = cellInfo.el.querySelector('svg[aria-label], img[aria-label]') || cellInfo.el.querySelector('svg, img');
                        let currentVal = null;
                        if (symbolEl && symbolEl.getAttribute('aria-label')) {
                            const label = (symbolEl.getAttribute('aria-label') || '').toLowerCase();
                            if (label.includes('sun')) currentVal = 0;
                            else if (label.includes('moon')) currentVal = 1;
                        }
                        if (currentVal === null) break;
                        await robustClick(cellInfo.el);
                        await new Promise(r => setTimeout(r, 50));
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[Flex on LinkedIn] Failed to reset board:', e);
    }
}

async function applySolution(solution, board) {
    console.log('[Flex on LinkedIn] Resetting the board to clear old drawings...');
    await resetBoard(board);

    for (let r = 0; r < board.size; r++) {
        for (let c = 0; c < board.size; c++) {
            if (board.fixed[r][c]) continue;

            try {
                const targetVal = solution[r][c];
                const cellInfo = board.cells.find(cell => cell.r === r && cell.c === c);
                if (!cellInfo) continue;

                // Cycle starting from Empty: Click 1 time for Sun, 2 times for Moon
                let clicksNeeded = 0;
                if (targetVal === 0) {
                    clicksNeeded = 1;
                } else if (targetVal === 1) {
                    clicksNeeded = 2;
                }

                for (let i = 0; i < clicksNeeded; i++) {
                    await robustClick(cellInfo.el);
                    await new Promise(r => setTimeout(r, 80));
                }
                
                cellInfo.el.style.outline = '2px solid #22c55e';
            } catch (e) {
                console.error('[Flex on LinkedIn] Error applying solution to cell:', e);
            }
        }
    }
}
