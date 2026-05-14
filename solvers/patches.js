export async function solve() {
    console.log('[Flex on LinkedIn] Patches solver started');
    try {
        const board = parseBoard();
        if (!board) {
            console.warn('[Flex on LinkedIn] Could not parse board');
            return false;
        }

        const solution = findSolution(board);
        if (solution) {
            await applySolution(solution, board);
            return true;
        } else {
            console.warn('[Flex on LinkedIn] No solution found');
            return false;
        }
    } catch (error) {
        console.error('[Flex on LinkedIn] Patches solver encountered an error:', error);
        return false;
    }
}

function parseBoard() {
    const workspace = document.querySelector('main#workspace');
    if (!workspace) return null;

    const cellElements = Array.from(workspace.querySelectorAll('[data-testid^="cell-"]'));
    if (cellElements.length === 0) return null;

    let maxRow = 0, maxCol = 0;
    const cellsRaw = [];

    cellElements.forEach((el) => {
        const ariaLabel = el.getAttribute('aria-label') || '';
        const coordMatch = ariaLabel.match(/Row\s+(\d+),\s+column\s+(\d+)/i);
        if (!coordMatch) return;

        const row = parseInt(coordMatch[1]) - 1;
        const col = parseInt(coordMatch[2]) - 1;
        maxRow = Math.max(maxRow, row);
        maxCol = Math.max(maxCol, col);

        let clue = null;
        // Check if it's a clue cell (either by aria-label or by presence of clue-number)
        const clueNumEl = el.querySelector('[data-testid*="clue-number"]');
        const shapeAttr = el.getAttribute('data-shape');

        if (clueNumEl || ariaLabel.toLowerCase().includes('clue')) {
            let type = 'freeform';
            if (shapeAttr) {
                if (shapeAttr.includes('SQUARE')) type = 'square';
                else if (shapeAttr.includes('TALL')) type = 'tall rectangle';
                else if (shapeAttr.includes('WIDE')) type = 'wide rectangle';
            } else {
                const typeMatch = ariaLabel.match(/(square|tall rectangle|wide rectangle|freeform)\s+clue/i);
                if (typeMatch) type = typeMatch[1].toLowerCase();
            }

            const sizeMatch = ariaLabel.match(/(\d+)\s+cells/i);
            let targetSize = sizeMatch ? parseInt(sizeMatch[1]) : 0;
            if (targetSize === 0 && clueNumEl) {
                targetSize = parseInt(clueNumEl.innerText.trim());
            }
            if (isNaN(targetSize)) targetSize = 0;
            
            clue = { row, col, type, targetSize };
        }
        cellsRaw.push({ el, row, col, clue });
    });

    const rows = maxRow + 1;
    const cols = maxCol + 1;
    const grid = Array(rows).fill(0).map(() => Array(cols).fill(null));
    const clues = [];

    cellsRaw.forEach(c => {
        grid[c.row][c.col] = c;
        if (c.clue) clues.push(c.clue);
    });

    console.log(`Flex on LinkedIn: Parsed ${rows}x${cols} grid with ${clues.length} clues.`);
    clues.forEach((c, i) => console.log(`  Clue ${i+1}: (${c.row+1}, ${c.col+1}) ${c.type}, size ${c.targetSize}`));
    
    return { rows, cols, grid, clues };
}

function findSolution(board) {
    const { rows, cols, clues, grid } = board;
    const solutionGrid = Array(rows).fill(0).map(() => Array(cols).fill(null));
    const regions = [];

    function canPlace(shape) {
        for (const cell of shape) {
            if (cell.row < 0 || cell.row >= rows || cell.col < 0 || cell.col >= cols) return false;
            if (solutionGrid[cell.row][cell.col] !== null) return false;
        }
        
        let clueCount = 0;
        for (const cell of shape) {
            if (grid[cell.row][cell.col].clue) clueCount++;
        }
        return clueCount === 1;
    }

    function place(shape, val) {
        for (const cell of shape) solutionGrid[cell.row][cell.col] = val;
    }

    function getPossibleShapes(clue) {
        const shapes = [];
        const { row, col, type, targetSize } = clue;
        
        const sizesToTry = targetSize > 0 ? [targetSize] : [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16];

        for (const size of sizesToTry) {
            for (let h = 1; h <= size; h++) {
                if (size % h !== 0) continue;
                const w = size / h;

                if (type === 'square' && w !== h) continue;
                if (type === 'tall rectangle' && h <= w) continue;
                if (type === 'wide rectangle' && w <= h) continue;

                for (let rOff = 0; rOff < h; rOff++) {
                    for (let cOff = 0; cOff < w; cOff++) {
                        const startR = row - rOff;
                        const startC = col - cOff;
                        
                        if (startR < 0 || startR + h > rows || startC < 0 || startC + w > cols) continue;

                        const shape = [];
                        for (let r = 0; r < h; r++) {
                            for (let c = 0; c < w; c++) {
                                shape.push({ row: startR + r, col: startC + c });
                            }
                        }
                        shapes.push(shape);
                    }
                }
            }
        }
        return shapes;
    }

    function backtrack(clueIdx) {
        if (clueIdx === clues.length) {
            const coveredCount = solutionGrid.flat().filter(c => c !== null).length;
            const totalCells = rows * cols;
            if (coveredCount === totalCells) return true;
            return false;
        }

        const clue = clues[clueIdx];
        const possibleShapes = getPossibleShapes(clue);

        for (const shape of possibleShapes) {
            if (canPlace(shape)) {
                place(shape, clueIdx);
                regions.push({ clue, shape });
                if (backtrack(clueIdx + 1)) return true;
                regions.pop();
                place(shape, null);
            }
        }
        return false;
    }

    clues.sort((a, b) => {
        const score = (c) => (c.type === 'freeform' ? 0 : 2) + (c.targetSize || 0);
        return score(b) - score(a);
    });

    if (backtrack(0)) return regions;
    
    // If we get here, try logging why it failed
    const coveredCount = solutionGrid.flat().filter(c => c !== null).length;
    console.warn(`Flex on LinkedIn: Backtracking failed. Covered ${coveredCount}/${rows * cols} cells.`);
    return null;
}

async function simulateDrag(startEl, endEl) {
    if (!startEl || !endEl) return;
    try {
        const common = { bubbles: true, cancelable: true, view: window, pointerId: 1, isPrimary: true, button: 0, buttons: 1 };
        const getCenter = (el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };

        const dispatch = (el, type, x, y, extra = {}) => {
            if (!el) return;
            const props = { ...common, clientX: x, clientY: y, ...extra };
            el.dispatchEvent(new PointerEvent('pointer' + type, props));
            el.dispatchEvent(new MouseEvent('mouse' + type, props));
        };

        const start = getCenter(startEl);
        const end = getCenter(endEl);

        dispatch(startEl, 'over', start.x, start.y);
        dispatch(startEl, 'enter', start.x, start.y);
        dispatch(startEl, 'down', start.x, start.y);
        await new Promise(r => setTimeout(r, 100));

        // intermediate moves for stability
        const steps = 3;
        for (let i = 1; i <= steps; i++) {
            const currX = start.x + (end.x - start.x) * (i / steps);
            const currY = start.y + (end.y - start.y) * (i / steps);
            const target = document.elementFromPoint(currX, currY) || startEl;
            dispatch(target, 'move', currX, currY);
            await new Promise(r => setTimeout(r, 50));
        }

        dispatch(endEl, 'move', end.x, end.y);
        await new Promise(r => setTimeout(r, 100));
        dispatch(endEl, 'up', end.x, end.y, { buttons: 0 });
        dispatch(endEl, 'out', end.x, end.y, { buttons: 0 });
        dispatch(endEl, 'leave', end.x, end.y, { buttons: 0 });
    } catch (e) {
        console.warn('[Flex on LinkedIn] simulateDrag failed:', e);
    }
}

async function applySolution(solution, board) {
    console.log(`Flex on LinkedIn: Applying solution with ${solution.length} patches...`);
    
    for (const region of solution) {
        const rows = region.shape.map(s => s.row);
        const cols = region.shape.map(s => s.col);
        const minR = Math.min(...rows), maxR = Math.max(...rows);
        const minC = Math.min(...cols), maxC = Math.max(...cols);

        const corner1 = board.grid[minR][minC];
        const corner2 = board.grid[maxR][maxC];
        
        if (corner1 && corner2) {
            console.log(`  Dragging patch from (${minR+1}, ${minC+1}) to (${maxR+1}, ${maxC+1})`);
            await simulateDrag(corner1.el, corner2.el);
            await new Promise(r => setTimeout(r, 300));
        }
    }
}

