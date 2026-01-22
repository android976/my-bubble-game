const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverScreen = document.getElementById('game-over-screen');
const gameOverContent = document.getElementById('game-over-content'); // Контент для промокодов
const scoreEl = document.getElementById('score-val');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');

// --- НАСТРОЙКИ ---
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

const COLUMN_COUNT = 11; 
const bubbleRadius = (gameWidth / COLUMN_COUNT / 2) * 0.96; 
const ROW_HEIGHT = bubbleRadius * Math.sqrt(3);

const GRID_REAL_WIDTH = COLUMN_COUNT * (bubbleRadius * 2);
const OFFSET_X = (gameWidth - GRID_REAL_WIDTH) / 2;

const maxRows = 30; 
const startRows = 9; 
const SHOTS_TO_ADD_ROW = 5; 

// 8 Цветов
const colors = [
    '#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFC300', '#00FFFF', '#ff9f43', '#c8d6e5'
];

const LIMIT_LINE_Y = gameHeight - bubbleRadius * 5; 

// --- СОСТОЯНИЕ ---
let grid = []; 
let particles = []; 
let isGameOver = false;
let isGameStarted = false;
let animationId = null;

// Смещение сетки (0 или 1). Определяет, сдвинут ли ряд.
let rowOffset = 0; 

let score = 0; 
let shotsFired = 0;

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

startBtn.addEventListener('click', () => {
    isGameStarted = true;
    startScreen.classList.add('hidden');
});

// --- СИСТЕМНЫЕ ФУНКЦИИ ---

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

// ГЛАВНАЯ ФУНКЦИЯ ТИПА РЯДА
// 0 = Широкий (11 шаров, прижат влево)
// 1 = Узкий (10 шаров, сдвинут вправо)
function getRowType(r) {
    return (r + rowOffset) % 2;
}

function getColsCount(r) {
    return getRowType(r) === 0 ? COLUMN_COUNT : (COLUMN_COUNT - 1);
}

function getPixelCoords(r, c) {
    let isNarrow = getRowType(r) === 1;
    let shiftX = isNarrow ? bubbleRadius : 0; // Сдвигаем на радиус, если узкий ряд
    
    let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX + OFFSET_X;
    let y = r * ROW_HEIGHT + bubbleRadius;
    return {x, y};
}

function getGridCoords(x, y) {
    let gridY = Math.round((y - bubbleRadius) / ROW_HEIGHT);
    
    let isNarrow = getRowType(gridY) === 1;
    let shiftX = isNarrow ? bubbleRadius : 0;
    
    let gridX = Math.round((x - OFFSET_X - bubbleRadius - shiftX) / (bubbleRadius * 2));
    return {r: gridY, c: gridX};
}

function getBubble(r, c) {
    if (r < 0 || r >= maxRows) return null;
    if (!grid[r]) return null;
    let cols = getColsCount(r);
    if (c < 0 || c >= cols) return null;
    return grid[r][c];
}

function addScore(points) {
    score += points;
    scoreEl.innerText = score;
}

// --- ПРОМОКОДЫ (ФИНАЛ) ---
function doGameOver() {
    isGameOver = true;
    gameOverScreen.classList.remove('hidden');

    let htmlContent = '';

    if (score < 1000) {
        htmlContent = `
            <h1>УВЫ...</h1>
            <p class="subtitle">Вы набрали ${score} очков.<br>Этого мало для подарка.</p>
            <button onclick="restartGame()">ПОПРОБОВАТЬ ЕЩЕ</button>
        `;
    } else {
        let promoCode = '';
        let rollName = '';
        let condition = '';

        if (score >= 3000) {
            promoCode = 'ФИЛА';
            rollName = 'Филадельфия лайт';
            condition = 'при заказе от 1000₽';
        } else if (score >= 2000) {
            promoCode = 'КРАБ';
            rollName = 'Темпура с крабом';
            condition = 'при заказе от 1300₽';
        } else { 
            promoCode = 'МАКИ';
            rollName = 'Маки с лососем';
            condition = 'при заказе от 1500₽';
        }

        htmlContent = `
            <h1 style="color: #2ed573;">ПОЗДРАВЛЯЕМ!</h1>
            <p class="subtitle">Вы выиграли:<br><b>${rollName}</b></p>
            
            <div class="promo-box">
                <span class="promo-label">Ваш промокод:</span>
                <span class="promo-code">${promoCode}</span>
                <span class="promo-condition">${condition}</span>
            </div>

            <button onclick="restartGame()">ИГРАТЬ ЕЩЕ</button>
        `;
    }

    if (gameOverContent) gameOverContent.innerHTML = htmlContent;
}

// --- ИГРОВОЙ ЦИКЛ ---

function createGrid() {
    grid = [];
    rowOffset = 0; // Сброс сдвига
    
    for (let r = 0; r < maxRows; r++) {
        grid[r] = [];
        let cols = getColsCount(r);
        for (let c = 0; c < COLUMN_COUNT; c++) { 
            let isActive = (c < cols && r < startRows);
            let color = getRandomColor();
            if (isActive && c > 0 && grid[r][c-1].color === color) {
                if (Math.random() > 0.3) color = getRandomColor();
            }
            grid[r][c] = { 
                color: isActive ? color : null, 
                active: isActive 
            };
        }
    }
}

window.restartGame = function() {
    isGameOver = false;
    gameOverScreen.classList.add('hidden');
    score = 0;
    shotsFired = 0;
    scoreEl.innerText = "0";
    particles = [];
    bullet.active = false;
    createGrid();
    reloadGun();
    if (animationId) cancelAnimationFrame(animationId);
    draw();
}

// --- ДОБАВЛЕНИЕ РЯДА (ПЛАВАЮЩАЯ СЕТКА) ---
function addNewRow() {
    grid.pop(); 
    
    // Инвертируем смещение: то, что было "широким", станет "узким" и наоборот
    rowOffset = 1 - rowOffset; 
    
    let newRowCols = getColsCount(0); // Получаем ширину для нового 0-го ряда
    let newRow = [];
    
    for (let c = 0; c < COLUMN_COUNT; c++) {
        let active = c < newRowCols;
        let color = getRandomColor();
        // Защита от горизонтальных совпадений
        if (c > 0 && newRow[c-1]?.color === color) color = getRandomColor();
        
        newRow[c] = { 
            color: active ? color : null, 
            active: active 
        };
    }
    
    grid.unshift(newRow); 
    
    // ПРОВЕРЯЕМ ГРАВИТАЦИЮ (Вдруг сдвиг оторвал кусок)
    dropFloatingBubbles(); 
    checkGameOver();
}

function checkWin() {
    let hasBubbles = false;
    for (let r = 0; r < maxRows; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c].active) {
                hasBubbles = true;
                break;
            }
        }
    }
    if (!hasBubbles) {
        addScore(1000);
        doGameOver(); // Победа = Финал с призом
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

// --- ФИЗИКА ---

function shoot() {
    if (!isGameStarted || bullet.active || isGameOver) return;
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
        const STEPS = 5; 
        const stepX = bullet.dx / STEPS;
        const stepY = bullet.dy / STEPS;

        for (let i = 0; i < STEPS; i++) {
            bullet.x += stepX;
            bullet.y += stepY;

            if (bullet.x - bubbleRadius < 0) {
                bullet.x = bubbleRadius;
                bullet.dx = Math.abs(bullet.dx);
            }
            if (bullet.x + bubbleRadius > gameWidth) {
                bullet.x = gameWidth - bubbleRadius;
                bullet.dx = -Math.abs(bullet.dx);
            }

            if (bullet.y - bubbleRadius < 0) {
                bullet.y = bubbleRadius;
                snapBubble();
                return; 
            }

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
                if (distSq < (bubbleRadius * 2 - 4)**2) { 
                    return true;
                }
            }
        }
    }
    return false;
}

function snapBubble() {
    bullet.active = false;

    let coords = getGridCoords(bullet.x, bullet.y);
    let bestR = coords.r;
    let bestC = coords.c;

    if (!isValidEmpty(bestR, bestC)) {
        let minDist = Infinity;
        let found = null;

        for (let r = bestR - 1; r <= bestR + 1; r++) {
            let cols = getColsCount(r);
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

    if (bestR >= 0 && bestR < maxRows) {
        let maxCols = getColsCount(bestR);
        if (bestC >= maxCols) bestC = maxCols - 1;
        if (bestC < 0) bestC = 0;
    }

    let targetBubble = getBubble(bestR, bestC);
    
    if (targetBubble && !targetBubble.active) {
        targetBubble.active = true;
        targetBubble.color = bullet.color;
        
        let popped = findAndRemoveMatches(bestR, bestC, bullet.color);
        if (popped) {
            dropFloatingBubbles();
        }

        if (shotsFired % SHOTS_TO_ADD_ROW === 0) {
            setTimeout(() => {
                addNewRow();
            }, 300);
        }
    }
    
    checkWin(); 
    checkGameOver();
    reloadGun();
}

function isValidEmpty(r, c) {
    let b = getBubble(r, c);
    return (b !== null && !b.active);
}

// --- УДАЛЕНИЕ ---

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
                addScore(10);
            }
        }
        return true;
    }
    return false;
}

// --- ГРАВИТАЦИЯ (ИСПРАВЛЕНА: учитывает rowOffset) ---
function dropFloatingBubbles() {
    let visited = new Set();
    let queue = [];

    // Потолок (ряд 0)
    let cols0 = getColsCount(0);
    for (let c = 0; c < cols0; c++) {
        let b = getBubble(0, c);
        if (b && b.active) {
            queue.push({r: 0, c: c});
            visited.add("0-" + c);
        }
    }

    // BFS
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

    // Падение
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
                    addScore(20);
                }
            }
        }
    }
}

// --- ВАЖНЕЙШЕЕ ИСПРАВЛЕНИЕ: Соседи зависят от rowOffset ---
function getNeighbors(r, c) {
    let offsets;
    
    // Проверяем тип ряда ЧЕРЕЗ ФУНКЦИЮ, которая учитывает сдвиг
    // 0 = Широкий (11), 1 = Узкий (10)
    let isNarrow = getRowType(r) === 1;

    if (!isNarrow) { 
        // Если ряд ШИРОКИЙ (11 шаров)
        offsets = [[0,-1], [0,1], [-1,-1], [-1,0], [1,-1], [1,0]];
    } else { 
        // Если ряд УЗКИЙ (10 шаров)
        offsets = [[0,-1], [0,1], [-1,0], [-1,1], [1,0], [1,1]];
    }

    let result = [];
    for (let o of offsets) {
        let nr = r + o[0];
        let nc = c + o[1];
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
    if (!isGameStarted || bullet.active || isGameOver) return; 

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

        ctx.beginPath();
        ctx.moveTo(0, LIMIT_LINE_Y);
        ctx.lineTo(gameWidth, LIMIT_LINE_Y);
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);

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
        reloadGun();
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
