const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverScreen = document.getElementById('game-over-screen');

// --- НАСТРОЙКИ ---
// Ограничиваем ширину для ПК, но на мобильных берем весь экран
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

const COLUMN_COUNT = 11; 
// Радиус с небольшим зазором (0.98), чтобы шары визуально разделялись
const bubbleRadius = (gameWidth / COLUMN_COUNT / 2) * 0.98; 

const maxRows = 30; // Максимальное кол-во рядов в памяти
const startRows = 5; // Сколько рядов в начале
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFC300', '#00FFFF'];

// Линия проигрыша (немного выше пушки)
const LIMIT_LINE_Y = gameHeight - bubbleRadius * 5; 
const SHOTS_TO_ADD_ROW = 5; 

// --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
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
    speed: 25, // Скорость полета
    color: getRandomColor(),
    active: false
};

let nextColor = getRandomColor();

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

function createGrid() {
    grid = [];
    for (let r = 0; r < maxRows; r++) {
        grid[r] = [];
        // Четный ряд (0, 2) - 11 колонок, Нечетный (1, 3) - 10 колонок
        let cols = (r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
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

// --- ЛОГИКА СДВИГА РЯДОВ ---
function addNewRow() {
    // Удаляем последний ряд (который уходит вниз за пределы памяти)
    grid.pop();

    // Создаем новый ряд для верха
    let newRow = [];
    // Новый ряд всегда встает на позицию 0 (Четную), поэтому делаем его полным
    for (let c = 0; c < COLUMN_COUNT; c++) {
        newRow[c] = { x: 0, y: 0, color: getRandomColor(), active: true };
    }

    // Вставляем сверху
    grid.unshift(newRow);

    // ВАЖНО: При сдвиге данные смещаются.
    // То, что было в ряду 0 (11 шаров), попадает в ряд 1 (где место только для 10).
    // Функция cleanEdges обрезает лишние шары справа.
    cleanEdges();

    checkGameOver();
}

function cleanEdges() {
    for (let r = 0; r < maxRows; r++) {
        // Если ряд нечетный (сдвинутый), он короче
        if (r % 2 !== 0) {
            // Если есть 11-й элемент (индекс 10), выключаем его
            if (grid[r][COLUMN_COUNT - 1]) {
                grid[r][COLUMN_COUNT - 1].active = false;
            }
        }
    }
}

function checkGameOver() {
    for (let r = 0; r < maxRows; r++) {
        let cols = (r % 2 === 0) ? COLUMN_COUNT : COLUMN_COUNT - 1;
        for (let c = 0; c < cols; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                // Вычисляем актуальную Y координату
                let y = r * (bubbleRadius * 1.74) + bubbleRadius;
                if (y + bubbleRadius > LIMIT_LINE_Y) {
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

// --- ФИЗИКА ИГРЫ ---

function shoot() {
    if (bullet.active || isGameOver) return;
    // Ждем пока упадут предыдущие, чтобы не было багов с гравитацией
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
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        // Отскок от стен
        if (bullet.x - bubbleRadius < 0) {
            bullet.x = bubbleRadius;
            bullet.dx = -bullet.dx;
        }
        if (bullet.x + bubbleRadius > gameWidth) {
            bullet.x = gameWidth - bubbleRadius;
            bullet.dx = -bullet.dx;
        }

        // Попадание в потолок
        if (bullet.y - bubbleRadius < 0) {
            bullet.y = bubbleRadius;
            snapBubble();
        } else {
            // Попадание в другие шары
            // Проверяем только те ряды, которые рядом с пулей
            let approximateRow = Math.round((bullet.y - bubbleRadius) / (bubbleRadius * 1.74));
            let startR = Math.max(0, approximateRow - 2);
            let endR = Math.min(maxRows, approximateRow + 2);

            for (let r = startR; r < endR; r++) {
                let cols = (r % 2 === 0) ? COLUMN_COUNT : COLUMN_COUNT - 1;
                for (let c = 0; c < cols; c++) {
                    let b = grid[r][c];
                    if (b && b.active) {
                        let dist = Math.sqrt((bullet.x - b.x)**2 + (bullet.y - b.y)**2);
                        if (dist < bubbleRadius * 2) { // 2 радиуса = диаметр касания
                            snapBubble();
                            return; 
                        }
                    }
                }
            }
        }
    }

    // Анимация частиц
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if (p.type === 'pop') {
            p.scale -= 0.1;
            p.alpha -= 0.1;
            if (p.scale <= 0) particles.splice(i, 1);
        } else if (p.type === 'fall') {
            p.dy += 1.5; // Гравитация
            p.y += p.dy;
            p.x += p.dx;
            if (p.y > gameHeight + bubbleRadius) particles.splice(i, 1);
        }
    }
}

function snapBubble() {
    bullet.active = false;
    
    // Определяем ячейку сетки
    let gridY = Math.round((bullet.y - bubbleRadius) / (bubbleRadius * 1.74));
    if (gridY < 0) gridY = 0;
    if (gridY >= maxRows) gridY = maxRows - 1;

    let shiftX = (gridY % 2) * bubbleRadius;
    let gridX = Math.round((bullet.x - bubbleRadius - shiftX) / (bubbleRadius * 2));

    // Проверка границ колонок
    let maxCol = (gridY % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
    if (gridX < 0) gridX = 0;
    if (gridX >= maxCol) gridX = maxCol - 1;

    // Если место занято, пробуем ячейку чуть ниже или сбоку (простая защита от наложения)
    if (grid[gridY][gridX] && grid[gridY][gridX].active) {
         // В данной реализации просто прерываемся, чтобы не ломать логику,
         // или можно попробовать найти ближайшего свободного соседа.
         // Для простоты оставим как есть - игрок промахнулся пикселем.
    }

    // Записываем шарик
    if (!grid[gridY][gridX]) grid[gridY][gridX] = {x:0,y:0,color:null,active:false};
    
    // Если все ок - ставим шарик
    if (!grid[gridY][gridX].active) {
        grid[gridY][gridX].active = true;
        grid[gridY][gridX].color = bullet.color;
        
        // 1. Проверяем совпадения цветов
        let popped = findAndRemoveMatches(gridY, gridX, bullet.color);
        
        // 2. Если что-то лопнуло, проверяем гравитацию
        if (popped) {
            dropFloatingBubbles();
        }

        // 3. Сдвиг рядов каждые N выстрелов
        if (shotsFired % SHOTS_TO_ADD_ROW === 0) {
            setTimeout(() => {
                addNewRow();
                dropFloatingBubbles(); // Проверка на случай отрыва при сдвиге
            }, 250);
        }
    }
    
    checkGameOver();
    reloadGun();
}

function reloadGun() {
    bullet.x = playerX;
    bullet.y = playerY;
    bullet.dx = 0;
    bullet.dy = 0;
    bullet.color = nextColor;
    nextColor = getRandomColor();
}

// --- ПОИСК СОВПАДЕНИЙ И ГРАВИТАЦИЯ ---

function findAndRemoveMatches(startR, startC, color) {
    let cluster = [];
    let visited = new Set();
    
    function search(r, c) {
        let id = r + "-" + c;
        if (visited.has(id)) return;
        visited.add(id);

        if (r < 0 || r >= maxRows) return;
        
        let cols = (r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
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
            // Анимация взрыва
            particles.push({
                x: b.x, y: b.y, 
                color: b.color, 
                type: 'pop', scale: 1, alpha: 1
            });
        }
        return true;
    }
    return false;
}

function dropFloatingBubbles() {
    let visited = new Set();
    
    // 1. Ищем все шарики, привязанные к потолку (ряд 0)
    for (let c = 0; c < COLUMN_COUNT; c++) {
        if (grid[0][c] && grid[0][c].active) {
            markAttached(0, c, visited);
        }
    }

    // 2. Все активные шарики, которые мы НЕ посетили - падают
    for (let r = 0; r < maxRows; r++) {
        let cols = (r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
        for (let c = 0; c < cols; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                let id = r + "-" + c;
                if (!visited.has(id)) {
                    // Падает
                    b.active = false;
                    particles.push({
                        x: b.x, y: b.y, color: b.color, 
                        type: 'fall', 
                        dx: (Math.random()-0.5) * 5, // Разлет в стороны
                        dy: 0
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
        if (n.r >= 0 && n.r < maxRows) {
            let maxC = (n.r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
            if (n.c >= 0 && n.c < maxC) {
                if (grid[n.r][n.c] && grid[n.r][n.c].active) {
                    markAttached(n.r, n.c, visited);
                }
            }
        }
    }
}

function getNeighbors(r, c) {
    let offsets;
    // Логика соседей для гексагональной сетки
    if (r % 2 === 0) {
        // Четный ряд
        offsets = [
            {r: r, c: c-1}, {r: r, c: c+1},
            {r: r-1, c: c-1}, {r: r-1, c: c},
            {r: r+1, c: c-1}, {r: r+1, c: c}
        ];
    } else {
        // Нечетный ряд (сдвинутый)
        offsets = [
            {r: r, c: c-1}, {r: r, c: c+1},
            {r: r-1, c: c}, {r: r-1, c: c+1},
            {r: r+1, c: c}, {r: r+1, c: c+1}
        ];
    }
    return offsets;
}

// --- ОТРИСОВКА ---

function drawTrajectory() {
    if (bullet.active || isGameOver) return;

    let angle = Math.atan2(aimY - playerY, aimX - playerX);
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    let simX = playerX, simY = playerY;
    
    ctx.beginPath();
    ctx.moveTo(simX, simY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Тусклая линия
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 15]); 

    // Рисуем пунктир
    for (let i = 0; i < 60; i++) {
        simX += dx * 15;
        simY += dy * 15;
        // Отскок
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
        let cols = (r % 2 === 0) ? COLUMN_COUNT : COLUMN_COUNT - 1;
        for (let c = 0; c < cols; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                // Математика координат для отрисовки
                let shiftX = (r % 2) * bubbleRadius;
                let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX;
                let y = r * (bubbleRadius * 1.74) + bubbleRadius;
                
                // Сохраняем координаты
                b.x = x; b.y = y; 
                
                ctx.beginPath();
                ctx.arc(x, y, bubbleRadius - 1, 0, Math.PI * 2);
                ctx.fillStyle = b.color;
                ctx.fill();
                
                // Блик
                ctx.beginPath();
                ctx.arc(x - bubbleRadius*0.3, y - bubbleRadius*0.3, bubbleRadius/3, 0, Math.PI*2);
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
        // Пуля
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bubbleRadius, 0, Math.PI*2);
        ctx.fillStyle = bullet.color;
        ctx.fill();

        // Подсказка след. цвета
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

// --- УПРАВЛЕНИЕ ---
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    aimX = e.clientX - rect.left;
    aimY = e.clientY - rect.top;
});
canvas.addEventListener('touchmove', (e) => {
    // e.preventDefault() не нужен благодаря CSS touch-action
    const rect = canvas.getBoundingClientRect();
    aimX = e.touches[0].clientX - rect.left;
    aimY = e.touches[0].clientY - rect.top;
}, {passive: false});

canvas.addEventListener('click', () => shoot());
canvas.addEventListener('touchend', () => shoot());

// Перезагрузка страницы при повороте
window.addEventListener('resize', () => location.reload());

// Старт
createGrid();
draw();
