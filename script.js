const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverScreen = document.getElementById('game-over-screen');

// --- НАСТРОЙКИ ---
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

const COLUMN_COUNT = 11; 
// Коэффициент 0.98 нужен, чтобы шарики визуально не слипались в кашу
const bubbleRadius = (gameWidth / COLUMN_COUNT / 2) * 0.98; 

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

let playerX = gameWidth / 2;
let playerY = gameHeight - bubbleRadius * 2;
let aimX = gameWidth / 2;
let aimY = 0;

let bullet = {
    x: playerX, y: playerY,
    dx: 0, dy: 0,
    speed: 24, // Высокая скорость
    color: getRandomColor(),
    active: false
};

let nextColor = getRandomColor();

// --- СИСТЕМНЫЕ ФУНКЦИИ ---

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

function getColsCount(r) {
    // Четный ряд (0, 2...) - 11 шаров
    // Нечетный ряд (1, 3...) - 10 шаров
    return (r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
}

// Перевод координат Сетки -> в Пиксели
function getPixelCoords(r, c) {
    let shiftX = (r % 2) * bubbleRadius;
    let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX;
    let y = r * (bubbleRadius * 1.74) + bubbleRadius;
    return {x, y};
}

// Перевод Пикселей -> в примерную ячейку Сетки
function getGridCoords(x, y) {
    let gridY = Math.round((y - bubbleRadius) / (bubbleRadius * 1.74));
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
        for (let c = 0; c < cols; c++) {
            if (r < startRows) {
                grid[r][c] = { x: 0, y: 0, color: getRandomColor(), active: true };
            } else {
                grid[r][c] = { x: 0, y: 0, color: null, active: false };
            }
        }
    }
}

window.restartGame = function() {
    isGameOver = false;
    gameOverScreen.classList.add('hidden');
    shotsFired = 0;
    particles = [];
    createGrid();
    reloadGun();
}

// --- ЛОГИКА СДВИГА И GAME OVER ---

function addNewRow() {
    grid.pop(); // Удаляем низ
    let newRow = [];
    // Новый ряд всегда встает на индекс 0 (четный), значит он полный
    for (let c = 0; c < COLUMN_COUNT; c++) {
        newRow[c] = { x: 0, y: 0, color: getRandomColor(), active: true };
    }
    grid.unshift(newRow); // Вставляем верх
    cleanEdges(); // Чистим "хвосты"
    checkGameOver();
}

function cleanEdges() {
    for (let r = 0; r < maxRows; r++) {
        // Если ряд нечетный, у него не может быть 11-го элемента (индекс 10)
        if (r % 2 !== 0) {
            if (grid[r][COLUMN_COUNT - 1]) {
                grid[r][COLUMN_COUNT - 1].active = false;
            }
        }
    }
}

function checkGameOver() {
    for (let r = 0; r < maxRows; r++) {
        let cols = getColsCount(r);
        for (let c = 0; c < cols; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                let coords = getPixelCoords(r, c);
                if (coords.y + bubbleRadius > LIMIT_LINE_Y) {
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

// --- ФИЗИКА (СУБ-ШАГИ) ---

function shoot() {
    if (bullet.active || isGameOver) return;
    if (particles.some(p => p.type === 'fall')) return; // Ждем падения

    let angle = Math.atan2(aimY - playerY, aimX - playerX);
    bullet.dx = Math.cos(angle) * bullet.speed;
    bullet.dy = Math.sin(angle) * bullet.speed;
    bullet.active = true;
    shotsFired++;
}

function update() {
    if (isGameOver) return;

    if (bullet.active) {
        // --- ВАЖНОЕ ИСПРАВЛЕНИЕ: Движение мелкими шагами ---
        // Вместо одного прыжка на 24px, делаем 4 прыжка по 6px.
        // Это гарантирует, что мы не пролетим сквозь стену или шар.
        const STEPS = 4; 
        const stepX = bullet.dx / STEPS;
        const stepY = bullet.dy / STEPS;

        for (let i = 0; i < STEPS; i++) {
            bullet.x += stepX;
            bullet.y += stepY;

            // 1. Проверка Стен
            if (bullet.x - bubbleRadius < 0) {
                bullet.x = bubbleRadius;
                bullet.dx = -bullet.dx; // Рикошет
                // Пересчитываем шаг для оставшейся части цикла
                bullet.dx = bullet.dx; 
                // Выходим из микро-цикла, чтобы пересчитать stepX в следующем кадре, 
                // или просто продолжаем с новым вектором. Для простоты можно прервать шаг:
                break; 
            }
            if (bullet.x + bubbleRadius > gameWidth) {
                bullet.x = gameWidth - bubbleRadius;
                bullet.dx = -bullet.dx;
                break;
            }

            // 2. Проверка Потолка
            if (bullet.y - bubbleRadius < 0) {
                bullet.y = bubbleRadius;
                snapBubble();
                return; // Полная остановка
            }

            // 3. Проверка Столкновений с шарами
            if (checkCollision()) {
                snapBubble();
                return; // Полная остановка
            }
        }
    }

    updateParticles();
}

function checkCollision() {
    // Оптимизация: проверяем только ряды рядом с пулей
    let approxR = Math.floor(bullet.y / (bubbleRadius * 1.74));
    let startR = Math.max(0, approxR - 2);
    let endR = Math.min(maxRows, approxR + 2);

    for (let r = startR; r < endR; r++) {
        let cols = getColsCount(r);
        for (let c = 0; c < cols; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                let p = getPixelCoords(r, c);
                let distSq = (bullet.x - p.x)**2 + (bullet.y - p.y)**2;
                // Используем квадрат расстояния для скорости
                // (2 * radius)^2 - это дистанция касания
                if (distSq < (bubbleRadius * 2 - 2)**2) { // -2 пикселя для мягкости
                    return true;
                }
            }
        }
    }
    return false;
}

// Функция "умного" прилипания
function snapBubble() {
    bullet.active = false;

    // 1. Определяем "идеальную" ячейку, куда попал центр пули
    let coords = getGridCoords(bullet.x, bullet.y);
    let bestR = coords.r;
    let bestC = coords.c;

    // 2. Валидация:
    // Если эта ячейка занята или выходит за пределы, ищем ближайшего ПУСТОГО соседа
    if (!isValidEmpty(bestR, bestC)) {
        let neighbors = getNeighbors(bestR, bestC); // Получаем всех соседей (даже занятых)
        let minDist = Infinity;
        let found = null;

        // Перебираем соседей и ищем пустого, к которому мы ближе всего
        // Также можно добавить саму точку (bestR, bestC) в поиск, если она валидна геометрически
        
        // Расширенный поиск: смотрим сетку 3x3 вокруг примерной точки
        for (let r = bestR - 1; r <= bestR + 1; r++) {
            if(r < 0 || r >= maxRows) continue;
            let cols = getColsCount(r);
            for (let c = 0; c < cols; c++) {
                if (isValidEmpty(r, c)) {
                    let p = getPixelCoords(r, c);
                    let d = (bullet.x - p.x)**2 + (bullet.y - p.y)**2;
                    if (d < minDist) {
                        minDist = d;
                        found = {r, c};
                    }
                }
            }
        }
        
        if (found) {
            bestR = found.r;
            bestC = found.c;
        }
    }

    // Финальная проверка границ
    if (bestR >= 0 && bestR < maxRows) {
        let maxC = getColsCount(bestR);
        if (bestC >= 0 && bestC < maxC) {
            // СТАВИМ ШАРИК
            grid[bestR][bestC] = { 
                x: 0, y: 0, // координаты обновятся при отрисовке
                color: bullet.color, 
                active: true 
            };

            // Логика игры
            let popped = findAndRemoveMatches(bestR, bestC, bullet.color);
            if (popped) {
                dropFloatingBubbles();
            }

            if (shotsFired % SHOTS_TO_ADD_ROW === 0) {
                setTimeout(() => {
                    addNewRow();
                    dropFloatingBubbles();
                }, 250);
            }
        }
    }
    
    checkGameOver();
    reloadGun();
}

function isValidEmpty(r, c) {
    if (r < 0 || r >= maxRows) return false;
    let cols = getColsCount(r);
    if (c < 0 || c >= cols) return false;
    return !grid[r][c].active;
}

// --- ЛОГИКА УДАЛЕНИЯ И ГРАВИТАЦИЯ ---

function findAndRemoveMatches(startR, startC, color) {
    let cluster = [];
    let visited = new Set();
    
    function search(r, c) {
        let id = r + "-" + c;
        if (visited.has(id)) return;
        visited.add(id);

        if (r < 0 || r >= maxRows) return;
        let cols = getColsCount(r);
        if (c < 0 || c >= cols) return;
        
        let b = grid[r][c];
        if (!b || !b.active || b.color !== color) return;

        cluster.push({r, c});
        
        let neighbors = getNeighbors(r, c);
        for (let n of neighbors) search(n.r, n.c);
    }

    search(startR, startC);

    if (cluster.length >= 3) {
        for (let node of cluster) {
            let b = grid[node.r][node.c];
            b.active = false;
            let p = getPixelCoords(node.r, node.c);
            particles.push({
                x: p.x, y: p.y, color: b.color, 
                type: 'pop', scale: 1, alpha: 1
            });
        }
        return true;
    }
    return false;
}

function dropFloatingBubbles() {
    let visited = new Set();
    
    // 1. Ищем корни на потолке
    let cols0 = getColsCount(0);
    for (let c = 0; c < cols0; c++) {
        if (grid[0][c] && grid[0][c].active) {
            markAttached(0, c, visited);
        }
    }

    // 2. Всё, что не привязано к потолку - падает
    for (let r = 0; r < maxRows; r++) {
        let cols = getColsCount(r);
        for (let c = 0; c < cols; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                let id = r + "-" + c;
                if (!visited.has(id)) {
                    b.active = false; // Отцепляем
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

function markAttached(r, c, visited) {
    let id = r + "-" + c;
    if (visited.has(id)) return;
    visited.add(id);

    let neighbors = getNeighbors(r, c);
    for (let n of neighbors) {
        // Проверяем валидность соседа перед рекурсией
        if (n.r >= 0 && n.r < maxRows) {
            let cols = getColsCount(n.r);
            if (n.c >= 0 && n.c < cols) {
                if (grid[n.r][n.c] && grid[n.r][n.c].active) {
                    markAttached(n.r, n.c, visited);
                }
            }
        }
    }
}

function getNeighbors(r, c) {
    let offsets;
    if (r % 2 === 0) { // Четный ряд (полный)
        offsets = [
            {r: r, c: c-1}, {r: r, c: c+1},
            {r: r-1, c: c-1}, {r: r-1, c: c},
            {r: r+1, c: c-1}, {r: r+1, c: c}
        ];
    } else { // Нечетный ряд (сдвинутый)
        offsets = [
            {r: r, c: c-1}, {r: r, c: c+1},
            {r: r-1, c: c}, {r: r-1, c: c+1},
            {r: r+1, c: c}, {r: r+1, c: c+1}
        ];
    }
    return offsets;
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
            let b = grid[r][c];
            if (b && b.active) {
                let p = getPixelCoords(r, c);
                // Сохраняем в объект, хотя getPixelCoords считает на лету (для надежности)
                b.x = p.x; 
                b.y = p.y;
                
                // Рисуем
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

    requestAnimationFrame(draw);
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
