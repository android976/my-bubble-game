const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const movesSpan = document.getElementById('moves-left');
const gameOverScreen = document.getElementById('game-over-screen');

// --- НАСТРОЙКИ ---
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

const COLUMN_COUNT = 11; 
const bubbleRadius = gameWidth / COLUMN_COUNT / 2; 

const maxRows = 25; 
const startRows = 5;
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFC300', '#00FFFF'];

// Линия смерти (чуть выше пушки)
const LIMIT_LINE_Y = gameHeight - bubbleRadius * 5; 

// Сложность: каждые 5 выстрелов добавляем ряд
const SHOTS_TO_ADD_ROW = 5; 

let grid = []; 
let particles = []; 
let shotsFired = 0; // Счетчик выстрелов
let isGameOver = false;

// Позиция игрока
let playerX = gameWidth / 2;
let playerY = gameHeight - bubbleRadius * 2; // Опустил пушку ниже

// Координаты мыши/пальца для прицела
let aimX = gameWidth / 2;
let aimY = 0;

let bullet = {
    x: playerX, y: playerY,
    dx: 0, dy: 0,
    speed: 20, // Еще быстрее для динамики
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
        let currentColumns = (r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
        for (let c = 0; c < currentColumns; c++) {
            if (r < startRows) {
                grid[r][c] = { x: 0, y: 0, color: getRandomColor(), active: true };
            } else {
                grid[r][c] = { x: 0, y: 0, color: null, active: false };
            }
        }
    }
}

// Перезапуск игры
window.restartGame = function() {
    isGameOver = false;
    gameOverScreen.classList.add('hidden');
    shotsFired = 0;
    updateMovesUI();
    createGrid();
    reloadGun();
    particles = [];
}

// --- НОВАЯ МЕХАНИКА: СДВИГ РЯДОВ ---
function addNewRow() {
    // 1. Проверяем, не вылезет ли игра за пределы массива
    // Сдвигаем все ряды вниз (начиная с предпоследнего)
    for (let r = maxRows - 1; r > 0; r--) {
        grid[r] = grid[r - 1]; // Копируем ряд сверху
    }

    // 2. Создаем новый верхний ряд (grid[0])
    let newRow = [];
    // Важно: чередование четности рядов меняется при сдвиге
    // Но так как мы просто двигаем данные массива, визуальный сдвиг (shiftX) 
    // рассчитывается в draw() на основе индекса ряда. 
    // Нам нужно просто заполнить ряд правильным количеством шаров.
    
    // В Bubble Shooter при вставке ряда обычно просто меняется "фаза".
    // Упростим: всегда генерим полный ряд или сдвинутый в зависимости от 0-го индекса
    // В нашей реализации r=0 всегда четный (полный).
    
    let currentColumns = COLUMN_COUNT; 
    for (let c = 0; c < currentColumns; c++) {
        newRow[c] = { x: 0, y: 0, color: getRandomColor(), active: true };
    }
    grid[0] = newRow;

    // После добавления ряда нужно проверить Game Over
    checkGameOver();
}

function checkGameOver() {
    // Проверяем, есть ли активные шарики ниже красной линии
    for (let r = 0; r < maxRows; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                // Пересчитываем Y, так как он мог измениться (сдвиг рядов)
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

function updateMovesUI() {
    let left = SHOTS_TO_ADD_ROW - (shotsFired % SHOTS_TO_ADD_ROW);
    movesSpan.innerText = left;
}

// --- ЛОГИКА ---

function shoot() {
    if (bullet.active || isGameOver) return;
    // Блокируем стрельбу, пока падают шары
    if (particles.some(p => p.type === 'fall')) return;

    let angle = Math.atan2(aimY - playerY, aimX - playerX);
    bullet.dx = Math.cos(angle) * bullet.speed;
    bullet.dy = Math.sin(angle) * bullet.speed;
    bullet.active = true;
    
    // Увеличиваем счетчик выстрелов
    shotsFired++;
    updateMovesUI();
}

function update() {
    if (isGameOver) return;

    // Пуля
    if (bullet.active) {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        // Стены
        if (bullet.x - bubbleRadius < 0) {
            bullet.x = bubbleRadius;
            bullet.dx = -bullet.dx;
        }
        if (bullet.x + bubbleRadius > gameWidth) {
            bullet.x = gameWidth - bubbleRadius;
            bullet.dx = -bullet.dx;
        }

        // Потолок
        if (bullet.y - bubbleRadius < 0) {
            bullet.y = bubbleRadius;
            snapBubble();
        } else {
            // Столкновения с шарами
            // Оптимизация: проверяем только ряды, которые могут быть рядом
            for (let r = 0; r < maxRows; r++) {
                // Если ряд пустой или слишком далеко, пропускаем (простая эвристика)
                let rowY = r * (bubbleRadius * 1.74) + bubbleRadius;
                if (Math.abs(bullet.y - rowY) > bubbleRadius * 3) continue;

                for (let c = 0; c < grid[r].length; c++) {
                    let b = grid[r][c];
                    if (b.active) {
                        let dist = Math.sqrt((bullet.x - b.x)**2 + (bullet.y - b.y)**2);
                        if (dist < bubbleRadius * 2) {
                            snapBubble();
                            return; 
                        }
                    }
                }
            }
        }
    }

    // Частицы
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

function snapBubble() {
    bullet.active = false;
    
    let gridY = Math.round((bullet.y - bubbleRadius) / (bubbleRadius * 1.74));
    if (gridY < 0) gridY = 0;
    if (gridY >= maxRows) gridY = maxRows - 1;

    let shiftX = (gridY % 2) * bubbleRadius;
    let gridX = Math.round((bullet.x - bubbleRadius - shiftX) / (bubbleRadius * 2));

    let maxCol = (gridY % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
    if (gridX < 0) gridX = 0;
    if (gridX >= maxCol) gridX = maxCol - 1;

    // Коррекция если занято
    if (grid[gridY][gridX] && grid[gridY][gridX].active) {
        gridY++; 
        shiftX = (gridY % 2) * bubbleRadius;
        gridX = Math.round((bullet.x - bubbleRadius - shiftX) / (bubbleRadius * 2));
    }

    if (grid[gridY] && grid[gridY][gridX]) {
        grid[gridY][gridX].active = true;
        grid[gridY][gridX].color = bullet.color;
        
        let popped = findAndRemoveMatches(gridY, gridX, bullet.color);
        if (popped) {
            dropFloatingBubbles();
        }

        // ПРОВЕРКА НА ДОБАВЛЕНИЕ РЯДА
        // Если счетчик дошел до предела - сдвигаем
        if (shotsFired % SHOTS_TO_ADD_ROW === 0) {
            // Небольшая задержка перед сдвигом, чтобы увидеть результат выстрела
            setTimeout(() => {
                addNewRow();
                dropFloatingBubbles(); // Проверяем, вдруг сдвиг оторвал кого-то (редко, но бывает)
            }, 300);
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

// --- ОТРИСОВКА ---

function drawTrajectory() {
    if (bullet.active || isGameOver) return; // Не рисуем, когда пуля летит

    // Математика прицела
    let angle = Math.atan2(aimY - playerY, aimX - playerX);
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);

    // Симуляция полета луча
    let simX = playerX;
    let simY = playerY;
    
    ctx.beginPath();
    ctx.moveTo(simX, simY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 10]); // Пунктир

    // Делаем 30 шагов (точек) вперед
    for (let i = 0; i < 40; i++) {
        simX += dx * 15; // Длина шага пунктира
        simY += dy * 15;

        // Отскок луча от стен
        if (simX < bubbleRadius || simX > gameWidth - bubbleRadius) {
            dx = -dx;
            simX += dx * 15; // Корректируем, чтобы луч не застрял в стене
        }
        
        // Если луч ушел выше линии смерти, можно прекращать рисовать (для красоты)
        if (simY < 0) break;

        ctx.lineTo(simX, simY);
    }
    
    ctx.stroke();
    ctx.setLineDash([]); // Сброс пунктира
}

function draw() {
    update();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Рисуем "Линию Смерти"
    ctx.beginPath();
    ctx.moveTo(0, LIMIT_LINE_Y);
    ctx.lineTo(gameWidth, LIMIT_LINE_Y);
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Рисуем сетку
    for (let r = 0; r < maxRows; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                let shiftX = (r % 2) * bubbleRadius;
                let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX;
                let y = r * (bubbleRadius * 1.74) + bubbleRadius;
                
                b.x = x; b.y = y; 
                
                // Рисуем кружок
                ctx.beginPath();
                ctx.arc(x, y, bubbleRadius - 1, 0, Math.PI * 2);
                ctx.fillStyle = b.color;
                ctx.fill();
                // Блик
                ctx.beginPath();
                ctx.arc(x - radiusX(0.3), y - radiusX(0.3), bubbleRadius/3, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fill();
            }
        }
    }

    // Хелпер для блика (выше использовал хардкод, тут исправил для красоты)
    function radiusX(mult) { return bubbleRadius * mult; }

    // 3. Частицы
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

    // 4. Траектория
    drawTrajectory();

    // 5. Игрок и следующая пуля
    if (!isGameOver) {
        // Пуля
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bubbleRadius, 0, Math.PI*2);
        ctx.fillStyle = bullet.color;
        ctx.fill();

        // Подсказка следующего цвета
        ctx.beginPath();
        ctx.arc(playerX + bubbleRadius * 3, playerY, bubbleRadius / 2, 0, Math.PI*2);
        ctx.fillStyle = nextColor;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    requestAnimationFrame(draw);
}

// --- УПРАВЛЕНИЕ ---
// Отслеживаем движение мыши/пальца для прицела
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    aimX = e.clientX - rect.left;
    aimY = e.clientY - rect.top;
});

canvas.addEventListener('touchmove', (e) => {
    // e.preventDefault(); // Если нужно блокировать скролл
    const rect = canvas.getBoundingClientRect();
    aimX = e.touches[0].clientX - rect.left;
    aimY = e.touches[0].clientY - rect.top;
}, {passive: false});

// Стрельба по клику/отпусканию
canvas.addEventListener('click', () => shoot());
canvas.addEventListener('touchend', () => shoot());

// --- ЛОГИКА ПОИСКА (оставил без изменений, но она нужна) ---
function findAndRemoveMatches(startR, startC, color) {
    let cluster = [];
    function search(r, c) {
        if (r < 0 || r >= maxRows || c < 0 || c >= grid[r].length) return;
        if (!grid[r][c].active) return;
        if (grid[r][c].color !== color) return;
        let id = r + "-" + c;
        if (cluster.includes(id)) return;
        cluster.push(id);
        let neighbors = getNeighbors(r, c);
        for (let n of neighbors) search(n.r, n.c);
    }
    search(startR, startC);

    if (cluster.length >= 3) {
        for (let id of cluster) {
            let [r, c] = id.split("-").map(Number);
            grid[r][c].active = false;
            particles.push({x: grid[r][c].x, y: grid[r][c].y, color: grid[r][c].color, type: 'pop', scale: 1, alpha: 1});
        }
        return true;
    }
    return false;
}

function dropFloatingBubbles() {
    let visited = new Set();
    // Привязка к потолку (ряд 0)
    for (let c = 0; c < grid[0].length; c++) {
        if (grid[0][c].active) markAttached(0, c, visited);
    }
    for (let r = 0; r < maxRows; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c].active) {
                let id = r + "-" + c;
                if (!visited.has(id)) {
                    let b = grid[r][c];
                    b.active = false;
                    particles.push({x: b.x, y: b.y, color: b.color, type: 'fall', dx: (Math.random()-0.5)*2, dy: 0});
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
        if (n.r >= 0 && n.r < maxRows && n.c >= 0 && n.c < grid[n.r].length) {
            if (grid[n.r][n.c].active) markAttached(n.r, n.c, visited);
        }
    }
}

function getNeighbors(r, c) {
    let offsets;
    if (r % 2 === 0) offsets = [{r:r,c:c-1},{r:r,c:c+1},{r:r-1,c:c-1},{r:r-1,c:c},{r:r+1,c:c-1},{r:r+1,c:c}];
    else offsets = [{r:r,c:c-1},{r:r,c:c+1},{r:r-1,c:c},{r:r-1,c:c+1},{r:r+1,c:c},{r:r+1,c:c+1}];
    return offsets;
}

window.addEventListener('resize', () => location.reload());
createGrid();
draw();
