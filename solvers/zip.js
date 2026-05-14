export async function solve() {
    console.log('[Flex on LinkedIn] Zip solver started');
    try {
        const board = parseBoard();
        if (!board) {
            console.warn('[Flex on LinkedIn] Could not parse board');
            return false;
        }

        const solution = findPath(board);
        if (solution) {
            await applyPath(solution, board);
            return true;
        } else {
            console.warn('[Flex on LinkedIn] No path found');
            return false;
        }
    } catch (error) {
        console.error('[Flex on LinkedIn] Zip solver encountered an error:', error);
        return false;
    }
}

function parseBoard() {
    const workspace = document.querySelector('main#workspace');
    if (!workspace) return null;

    const cellElements = Array.from(workspace.querySelectorAll('[data-testid^="cell-"]'));
    if (cellElements.length === 0) return null;

    // Detect grid size
    let maxIdx = 0;
    cellElements.forEach(el => {
        const testId = el.getAttribute('data-testid');
        if (!testId) return;
        const idMatch = testId.match(/cell-(\d+)/);
        if (idMatch) maxIdx = Math.max(maxIdx, parseInt(idMatch[1]));
    });

    const totalCells = maxIdx + 1;
    const size = Math.sqrt(totalCells);
    // Use Math.round to handle minor float issues if grid isn't perfectly square but totalCells is correct
    const cols = Math.round(size);
    const rows = Math.round(totalCells / cols);

    const grid = Array(totalCells).fill(null);
    const clues = new Map();

    cellElements.forEach(el => {
        const testId = el.getAttribute('data-testid');
        if (!testId) return;
        const idMatch = testId.match(/cell-(\d+)/);
        if (!idMatch) return;
        const idx = parseInt(idMatch[1]);
        const row = Math.floor(idx / cols);
        const col = idx % cols;

        let value = null;
        const ariaLabel = el.getAttribute('aria-label') || '';
        const numberMatch = ariaLabel.match(/Number (\d+)/i);
        if (numberMatch) {
            value = parseInt(numberMatch[1]);
            clues.set(value, idx);
        }

        grid[idx] = { el, idx, row, col, value };
    });

    console.log(`Flex on LinkedIn: Parsed ${rows}x${cols} grid with ${clues.size} clues.`);
    return { rows, cols, grid, clues, totalCells };
}

function findPath(board) {
    const { rows, cols, grid, clues, totalCells } = board;
    const visited = new Set();
    const path = [];
    const maxClue = Math.max(...clues.keys());

    function getNeighbors(idx) {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const neighbors = [];
        if (r > 0) neighbors.push(idx - cols);
        if (r < rows - 1) neighbors.push(idx + cols);
        if (c > 0) neighbors.push(idx - 1);
        if (c < cols - 1) neighbors.push(idx + 1);
        return neighbors;
    }

    function backtrack(currIdx, nextTargetValue) {
        if (visited.size === totalCells) {
            console.log('Flex on LinkedIn: All cells visited! Checking final clue sequence...');
            return nextTargetValue > maxClue;
        }

        const neighbors = getNeighbors(currIdx);
        
        for (const nIdx of neighbors) {
            if (!visited.has(nIdx)) {
                const cell = grid[nIdx];
                
                // If this cell is a clue
                if (cell.value !== null) {
                    if (cell.value === nextTargetValue) {
                        visited.add(nIdx);
                        path.push(nIdx);
                        if (backtrack(nIdx, nextTargetValue + 1)) return true;
                        path.pop();
                        visited.delete(nIdx);
                    }
                    // Else: skip (can't visit clue out of order)
                } else {
                    // It's an empty cell
                    // Check if we ARE allowed to visit an empty cell now
                    // (We can't skip a clue if it's the next target)
                    visited.add(nIdx);
                    path.push(nIdx);
                    if (backtrack(nIdx, nextTargetValue)) return true;
                    path.pop();
                    visited.delete(nIdx);
                }
            }
        }
        return false;
    }

    const startIdx = clues.get(1);
    if (startIdx === undefined) {
        console.error('Flex on LinkedIn: Clue #1 not found!');
        return null;
    }

    visited.add(startIdx);
    path.push(startIdx);

    console.log('Flex on LinkedIn: Starting pathfinding from clue #1...');
    if (backtrack(startIdx, 2)) {
        console.log('Flex on LinkedIn: Path found!');
        return path;
    }
    return null;
}

async function applyPath(path, board) {
    console.log(`[Flex on LinkedIn] Applying path with ${path.length} cells...`);
    
    if (path.length < 2) return;

    try {
        const common = { bubbles: true, cancelable: true, view: window, pointerId: 1, isPrimary: true, button: 0, buttons: 1 };
        const getCenter = (el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };

        const dispatch = (el, type, x, y, extra = {}) => {
            const target = el || document.elementFromPoint(x, y) || document.body;
            if (!target) return;
            const props = { ...common, clientX: x, clientY: y, ...extra };
            target.dispatchEvent(new PointerEvent('pointer' + type, props));
            target.dispatchEvent(new MouseEvent('mouse' + type, props));
        };

        const startEl = board.grid[path[0]].el;
        if (!startEl) throw new Error("Start element not found");
        const start = getCenter(startEl);

        console.log('[Flex on LinkedIn] Starting continuous drag with interpolation...');
        
        // Start drag
        dispatch(startEl, 'over', start.x, start.y);
        dispatch(startEl, 'enter', start.x, start.y);
        dispatch(startEl, 'down', start.x, start.y);
        await new Promise(r => setTimeout(r, 100));

        // Move through path with interpolation between each cell
        for (let i = 0; i < path.length - 1; i++) {
            const currIdx = path[i];
            const nextIdx = path[i+1];
            
            const currPos = getCenter(board.grid[currIdx].el);
            const nextPos = getCenter(board.grid[nextIdx].el);

            // Intermediate steps between adjacent cells
            const steps = 2; 
            for (let s = 1; s <= steps; s++) {
                const interX = currPos.x + (nextPos.x - currPos.x) * (s / steps);
                const interY = currPos.y + (nextPos.y - currPos.y) * (s / steps);
                
                dispatch(null, 'move', interX, interY);
                await new Promise(r => setTimeout(r, 30));
            }
        }

        // Release at end
        const endEl = board.grid[path[path.length - 1]].el;
        if (!endEl) throw new Error("End element not found");
        const end = getCenter(endEl);

        dispatch(endEl, 'up', end.x, end.y, { buttons: 0 });
        dispatch(endEl, 'out', end.x, end.y, { buttons: 0 });
        dispatch(endEl, 'leave', end.x, end.y, { buttons: 0 });
        
        console.log('[Flex on LinkedIn] Drag complete.');
    } catch (e) {
        console.error('[Flex on LinkedIn] Error applying path:', e);
    }
}
