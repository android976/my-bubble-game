const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverScreen = document.getElementById('game-over-screen');

// --- НАСТРОЙКИ ---
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

const COLUMN_COUNT = 11; 
// Чуть уменьшаем радиус (0.98), чтобы был микро-зазор
const bubbleRadius = (gameWidth / COLUMN_COUNT / 2) * 0.98; 
const ROW_HEIGHT = bubbleRadius * 1.74;

const maxRows = 30; 
const startRows = 5;
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFC300', '#00FFFF'];

const LIMIT_LINE_Y = gameHeight - bubbleRadius * 5; 
const SHOTS_TO_ADD_ROW = 5; 

// --- СОСТОЯНИЕ ---
let grid = []; 
let particles = []; 
let shotsFired = 0; 
let isGameOver = false;
let animationId = null;

let playerX = gameWidth / 2;
let playerY = gameHeight - bubbleRadius * 2;
let aimX = gameWidth / 2;
let aimY = 0;

let bullet = {
    x: playerX, y: playerY,
    dx: 0, dy: 0,
    speed: 24, 
    color: getRandomColor(),
    active: false
};

let nextColor = getRandomColor();

// --- СИСТЕМНЫЕ ФУНКЦИИ ---

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

// ГЛАВНАЯ ФУНКЦИЯ КОЛИЧЕСТВА КОЛОНОК
function getColsCount(r) {
    // Четный ряд (0, 2...): 11 колонок (индексы 0..10)
    // Нечетный ряд (1, 3...): 10 колонок (индексы 0..9)
    return (r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
}

// Безопасное получение шарика
function getBubble(r, c) {
    if (r < 0 || r >= maxRows) return null;
    let cols = getColsCount(r);
    if (c < 0 || c >= cols) return null;
    if (!grid[r]) return null;
    return grid[r][c];
}

function getPixelCoords(r, c) {
    let shiftX = (r % 2) * bubbleRadius;
    let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX;
    let y = r * ROW_HEIGHT + bubbleRadius;
    return {x, y};
}

function getGridCoords(x, y) {
    let gridY = Math.round((y - bubbleRadius) / ROW_HEIGHT);
    let shiftX = (gridY % 2) * bubbleRadius;
    let gridX = Math.round((x - bubbleRadius - shiftX) / (bubbleRadius * 2));
    return {r: gridY, c: gridX};
}

// --- ИНИЦИАЛИЗАЦИЯ ---

function createGrid() {
    grid = [];
    for (let r = 0; r < maxRows; r++) {
        grid[r] = [];
        let cols = getColsCount(r);
        for (let c = 0; c < COLUMN_COUNT; c++) { // Создаем с запасом, но активируем по cols
            if (c < cols && r < startRows) {
                grid[r][c] = { color: getRandomColor(), active: true };
            } else {
                grid[r][c] = { color: null, active: false };
            }
        }
    }
}

window.restartGame = function() {
    isGameOver = false;
    gameOverScreen.classList.add('hidden');
    shotsFired = 0;
    particles = [];
    bullet.active = false;
    createGrid();
    reloadGun();
    if (animationId) cancelAnimationFrame(animationId);
    draw();
}

function addNewRow() {
    grid.pop(); 
    let newRow = [];
    for (let c = 0; c < COLUMN_COUNT; c++) {
        newRow[c] = { color: getRandomColor(), active: true };
    }
    grid.unshift(newRow); 
    
    // После сдвига обязательно чистим края и проверяем гравитацию
    cleanEdges();
    dropFloatingBubbles(); 
    checkGameOver();
}

function cleanEdges() {
    for (let r = 0; r < maxRows; r++) {
        let maxCols = getColsCount(r);
        // Всё, что за пределами допустимых колонок, должно быть выключено
        for (let c = maxCols; c < COLUMN_COUNT; c++) {
            if (grid[r][c]) grid[r][c].active = false;
        }
    }
}

function checkGameOver() {
    for (let r = 0; r < maxRows; r++) {
        let cols = getColsCount(r);
        for (let c = 0; c < cols; c++) {
            let b = getBubble(r, c);
            if (b && b.active) {
                let p = getPixelCoords(r, c);
                if (p.y + bubbleRadius > LIMIT_LINE_Y) {
                    doGameOver();
                    return;
                }
            }
        }
    }
}

function doGameOver() {
    isGameOver = true;
    gameOverScreen.classList.remove('hidden');
}

// --- ФИЗИКА ---

function shoot() {
    if (bullet.active || isGameOver) return;
    if (particles.some(p => p.type === 'fall')) return; 

    let angle = Math.atan2(aimY - playerY, aimX - playerX);
    bullet.dx = Math.cos(angle) * bullet.speed;
    bullet.dy = Math.sin(angle) * bullet.speed;
    bullet.active = true;
    shotsFired++;
}

function update() {
    if (isGameOver) return;

    if (bullet.active) {
        const STEPS = 5; // Больше шагов для точности
        const stepX = bullet.dx / STEPS;
        const stepY = bullet.dy / STEPS;

        for (let i = 0; i < STEPS; i++) {
            bullet.x += stepX;
            bullet.y += stepY;

            // Стены
            if (bullet.x - bubbleRadius < 0) {
                bullet.x = bubbleRadius;
                bullet.dx = Math.abs(bullet.dx);
            }
            if (bullet.x + bubbleRadius > gameWidth) {
                bullet.x = gameWidth - bubbleRadius;
                bullet.dx = -Math.abs(bullet.dx);
            }

            // Потолок
            if (bullet.y - bubbleRadius < 0) {
                bullet.y = bubbleRadius;
                snapBubble();
                return; 
            }

            // Столкновения
            if (checkCollision()) {
                snapBubble();
                return;
            }
        }
    }

    updateParticles();
}

function checkCollision() {
    let approxR = Math.floor(bullet.y / ROW_HEIGHT);
    let startR = Math.max(0, approxR - 2);
    let endR = Math.min(maxRows, approxR + 2);

    for (let r = startR; r < endR; r++) {
        let cols = getColsCount(r);
        for (let c = 0; c < cols; c++) {
            let b = getBubble(r, c);
            if (b && b.active) {
                let p = getPixelCoords(r, c);
                let distSq = (bullet.x - p.x)**2 + (bullet.y - p.y)**2;
                // Чуть строже допуск (-5)
                if (distSq < (bubbleRadius * 2 - 5)**2) { 
                    return true;
                }
            }
        }
    }
    return false;
}

function snapBubble() {
    bullet.active = false;

    // 1. Ищем идеальное место
    let coords = getGridCoords(bullet.x, bullet.y);
    let bestR = coords.r;
    let bestC = coords.c;

    // 2. Если место занято или невалидно, ищем ближайшую свободную
    if (!isValidEmpty(bestR, bestC)) {
        let minDist = Infinity;
        let found = null;

        // Поиск в радиусе 1 ячейки
        for (let r = bestR - 1; r <= bestR + 1; r++) {
            let cols = getColsCount(r);
            // Важно: проверяем c от -1 до cols, чтобы покрыть края
            for (let c = -1; c <= cols; c++) {
                if (isValidEmpty(r, c)) {
                    let p = getPixelCoords(r, c);
                    let distSq = (bullet.x - p.x)**2 + (bullet.y - p.y)**2;
                    if (distSq < minDist) {
                        minDist = distSq;
                        found = {r, c};
                    }
                }
            }
        }
        if (found) { bestR = found.r; bestC = found.c; }
    }

    // 3. ФИНАЛЬНАЯ КОРРЕКЦИЯ (FIX ФАНТОМОВ)
    // Если мы попытались вставить в 10-ю колонку нечетного ряда, сдвигаем влево
    if (bestR >= 0 && bestR < maxRows) {
        let maxCols = getColsCount(bestR);
        if (bestC >= maxCols) bestC = maxCols - 1;
        if (bestC < 0) bestC = 0;
    }

    // Ставим шар
    let targetBubble = getBubble(bestR, bestC);
    
    // Если ячейка нашлась и она пустая
    if (targetBubble && !targetBubble.active) {
        targetBubble.active = true;
        targetBubble.color = bullet.color;
        
        // Сразу после вставки считаем совпадения
        let popped = findAndRemoveMatches(bestR, bestC, bullet.color);
        
        // Если лопнули, запускаем гравитацию
        if (popped) {
            dropFloatingBubbles();
        }

        // Логика сдвига
        if (shotsFired % SHOTS_TO_ADD_ROW === 0) {
            setTimeout(() => {
                addNewRow();
            }, 250);
        }
    } else {
        // Защита от зависания, если место не найдено
        console.log("Место не найдено, сброс");
    }
    
    checkGameOver();
    reloadGun();
}

function isValidEmpty(r, c) {
    if (r < 0 || r >= maxRows) return false;
    let cols = getColsCount(r);
    if (c < 0 || c >= cols) return false; // Строгая проверка границ
    let b = grid[r][c];
    return (b && !b.active);
}

// --- ЛОГИКА УДАЛЕНИЯ (BFS) ---

function findAndRemoveMatches(startR, startC, color) {
    let cluster = [];
    let visited = new Set();
    let queue = [{r: startR, c: startC}];
    visited.add(startR + "-" + startC);

    while (queue.length > 0) {
        let {r, c} = queue.shift();
        let b = getBubble(r, c);
        
        if (b && b.active && b.color === color) {
            cluster.push({r, c});

            let neighbors = getNeighbors(r, c);
            for (let n of neighbors) {
                let id = n.r + "-" + n.c;
                if (!visited.has(id)) {
                    let nb = getBubble(n.r, n.c);
                    if (nb && nb.active && nb.color === color) {
                        visited.add(id);
                        queue.push(n);
                    }
                }
            }
        }
    }

    if (cluster.length >= 3) {
        for (let node of cluster) {
            let b = getBubble(node.r, node.c);
            if (b) {
                b.active = false;
                let p = getPixelCoords(node.r, node.c);
                particles.push({
                    x: p.x, y: p.y, color: b.color, 
                    type: 'pop', scale: 1, alpha: 1
                });
            }
        }
        return true;
    }
    return false;
}

// --- ГРАВИТАЦИЯ (ИСПРАВЛЕННАЯ) ---
function dropFloatingBubbles() {
    let visited = new Set();
    let queue = [];

    // 1. Сбор корней (первый ряд)
    let cols0 = getColsCount(0);
    for (let c = 0; c < cols0; c++) {
        let b = getBubble(0, c);
        if (b && b.active) {
            queue.push({r: 0, c: c});
            visited.add("0-" + c);
        }
    }

    // 2. BFS по соседям
    while (queue.length > 0) {
        let {r, c} = queue.shift();
        let neighbors = getNeighbors(r, c);
        
        for (let n of neighbors) {
            let id = n.r + "-" + n.c;
            if (!visited.has(id)) {
                let nb = getBubble(n.r, n.c);
                if (nb && nb.active) {
                    visited.add(id);
                    queue.push(n);
                }
            }
        }
    }

    // 3. Падение всех непосещенных
    for (let r = 0; r < maxRows; r++) {
        let cols = getColsCount(r);
        for (let c = 0; c < cols; c++) {
            let b = getBubble(r, c);
            if (b && b.active) {
                let id = r + "-" + c;
                if (!visited.has(id)) {
                    b.active = false; 
                    let p = getPixelCoords(r, c);
                    particles.push({
                        x: p.x, y: p.y, color: b.color, 
                        type: 'fall', 
                        dx: (Math.random()-0.5) * 6, dy: 0
                    });
                }
            }
        }
    }
}

// --- ПОЛУЧЕНИЕ ВАЛИДНЫХ СОСЕДЕЙ ---
function getNeighbors(r, c) {
    let offsets;
    // Сдвиги для четных и нечетных рядов разные
    if (r % 2 === 0) { // Четный (11 кол)
        offsets = [[0,-1], [0,1], [-1,-1], [-1,0], [1,-1], [1,0]];
    } else { // Нечетный (10 кол)
        offsets = [[0,-1], [0,1], [-1,0], [-1,1], [1,0], [1,1]];
    }

    let result = [];
    for (let o of offsets) {
        let nr = r + o[0];
        let nc = c + o[1];
        // Проверяем валидность СРАЗУ здесь
        if (nr >= 0 && nr < maxRows) {
            let ncols = getColsCount(nr);
            if (nc >= 0 && nc < ncols) {
                result.push({r: nr, c: nc});
            }
        }
    }
    return result;
}

// --- ОТРИСОВКА ---

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if (p.type === 'pop') {
            p.scale -= 0.1;
            p.alpha -= 0.1;
            if (p.scale <= 0) particles.splice(i, 1);
        } else if (p.type === 'fall') {
            p.dy += 1.5;
            p.y += p.dy;
            p.x += p.dx;
            if (p.y > gameHeight + bubbleRadius) particles.splice(i, 1);
        }
    }
}

function drawTrajectory() {
    if (bullet.active || isGameOver) return;

    let angle = Math.atan2(aimY - playerY, aimX - playerX);
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    let simX = playerX, simY = playerY;
    
    ctx.beginPath();
    ctx.moveTo(simX, simY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 15]); 

    for (let i = 0; i < 60; i++) {
        simX += dx * 15;
        simY += dy * 15;
        if (simX < bubbleRadius || simX > gameWidth - bubbleRadius) {
            dx = -dx;
            simX += dx * 15;
        }
        if (simY < 0) break;
        ctx.lineTo(simX, simY);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

function draw() {
    try {
        update();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Линия смерти
        ctx.beginPath();
        ctx.moveTo(0, LIMIT_LINE_Y);
        ctx.lineTo(gameWidth, LIMIT_LINE_Y);
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Сетка
        for (let r = 0; r < maxRows; r++) {
            let cols = getColsCount(r);
            for (let c = 0; c < cols; c++) {
                let b = getBubble(r, c);
                if (b && b.active) {
                    let p = getPixelCoords(r, c);
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, bubbleRadius - 1, 0, Math.PI * 2);
                    ctx.fillStyle = b.color;
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(p.x - bubbleRadius*0.3, p.y - bubbleRadius*0.3, bubbleRadius/3, 0, Math.PI*2);
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fill();
                }
            }
        }

        // Частицы
        for (let p of particles) {
            if (p.type === 'pop') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, bubbleRadius * p.scale, 0, Math.PI*2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fill();
                ctx.globalAlpha = 1;
            } else if (p.type === 'fall') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, bubbleRadius, 0, Math.PI*2);
                ctx.fillStyle = p.color;
                ctx.fill();
            }
        }

        drawTrajectory();

        if (!isGameOver) {
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bubbleRadius, 0, Math.PI*2);
            ctx.fillStyle = bullet.color;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(playerX + bubbleRadius * 3, playerY, bubbleRadius / 2, 0, Math.PI*2);
            ctx.fillStyle = nextColor;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    } catch (e) {
        console.error(e);
        bullet.active = false;
    }

    animationId = requestAnimationFrame(draw);
}

function reloadGun() {
    bullet.x = playerX;
    bullet.y = playerY;
    bullet.dx = 0;
    bullet.dy = 0;
    bullet.color = nextColor;
    nextColor = getRandomColor();
}

// УПРАВЛЕНИЕ
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    aimX = e.clientX - rect.left;
    aimY = e.clientY - rect.top;
});
canvas.addEventListener('touchmove', (e) => {
    const rect = canvas.getBoundingClientRect();
    aimX = e.touches[0].clientX - rect.left;
    aimY = e.touches[0].clientY - rect.top;
}, {passive: false});

canvas.addEventListener('click', () => shoot());
canvas.addEventListener('touchend', () => shoot());

window.addEventListener('resize', () => location.reload());

createGrid();
draw();
