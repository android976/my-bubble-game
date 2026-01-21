const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- НАСТРОЙКИ ---
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

const COLUMN_COUNT = 11; 
const bubbleRadius = gameWidth / COLUMN_COUNT / 2; 

const maxRows = 20; 
const startRows = 5; // Чуть больше рядов для теста
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFC300', '#00FFFF'];

let grid = []; 
// Массив для анимаций (падающие шары, лопающиеся эффекты)
let particles = []; 

let playerX = gameWidth / 2;
let playerY = gameHeight - bubbleRadius * 3;

let bullet = {
    x: playerX, y: playerY,
    dx: 0, dy: 0,
    speed: 18, // Чуть ускорил пулю
    color: getRandomColor(),
    active: false
};

let nextColor = getRandomColor();

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

function createGrid() {
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

function drawCircle(x, y, radius, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha; // Прозрачность
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, radius - 1), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Блик
    ctx.beginPath();
    ctx.arc(x - radius * 0.3, y - radius * 0.3, radius / 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    ctx.restore();
}

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// --- ОСНОВНАЯ ЛОГИКА ---

function shoot(targetX, targetY) {
    if (bullet.active) return;
    // Не даем стрелять, пока идут анимации падения (чтобы не было багов)
    if (particles.some(p => p.type === 'fall')) return;

    let angle = Math.atan2(targetY - playerY, targetX - playerX);
    bullet.dx = Math.cos(angle) * bullet.speed;
    bullet.dy = Math.sin(angle) * bullet.speed;
    bullet.active = true;
}

function update() {
    // 1. Обновляем пулю
    if (bullet.active) {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        if (bullet.x - bubbleRadius < 0) {
            bullet.x = bubbleRadius;
            bullet.dx = -bullet.dx;
        }
        if (bullet.x + bubbleRadius > gameWidth) {
            bullet.x = gameWidth - bubbleRadius;
            bullet.dx = -bullet.dx;
        }

        if (bullet.y - bubbleRadius < 0) {
            bullet.y = bubbleRadius;
            snapBubble();
        } else {
            // Столкновения
            for (let r = 0; r < grid.length; r++) {
                for (let c = 0; c < grid[r].length; c++) {
                    let b = grid[r][c];
                    if (b.active) {
                        let dist = getDistance(bullet.x, bullet.y, b.x, b.y);
                        if (dist < bubbleRadius * 2) {
                            snapBubble();
                            return; 
                        }
                    }
                }
            }
        }
    }

    // 2. Обновляем анимации частиц
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        if (p.type === 'pop') {
            // Эффект лопания: уменьшается и исчезает
            p.scale -= 0.1;
            p.alpha -= 0.1;
            if (p.scale <= 0 || p.alpha <= 0) {
                particles.splice(i, 1); // Удаляем из памяти
            }
        } else if (p.type === 'fall') {
            // Эффект падения: гравитация
            p.dy += 1.5; // Ускорение свободного падения
            p.y += p.dy;
            p.x += p.dx; // Немного инерции вбок
            
            // Если улетел за экран - удаляем
            if (p.y > gameHeight + bubbleRadius) {
                particles.splice(i, 1);
            }
        }
    }
}

function snapBubble() {
    bullet.active = false;
    
    // Определяем ячейку
    let gridY = Math.round((bullet.y - bubbleRadius) / (bubbleRadius * 1.74));
    if (gridY < 0) gridY = 0;
    if (gridY >= maxRows) gridY = maxRows - 1;

    let shiftX = (gridY % 2) * bubbleRadius;
    let gridX = Math.round((bullet.x - bubbleRadius - shiftX) / (bubbleRadius * 2));

    // Коррекция границ
    let maxCol = (gridY % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
    if (gridX < 0) gridX = 0;
    if (gridX >= maxCol) gridX = maxCol - 1;

    // Если занято, пробуем сдвинуть
    if (grid[gridY][gridX] && grid[gridY][gridX].active) {
        gridY++; 
        shiftX = (gridY % 2) * bubbleRadius;
        gridX = Math.round((bullet.x - bubbleRadius - shiftX) / (bubbleRadius * 2));
    }

    if (grid[gridY] && grid[gridY][gridX]) {
        grid[gridY][gridX].active = true;
        grid[gridY][gridX].color = bullet.color;
        
        // Сначала ищем совпадения и лопаем их
        let popped = findAndRemoveMatches(gridY, gridX, bullet.color);
        
        // Если что-то лопнуло, проверяем, не повисли ли куски в воздухе
        if (popped) {
            dropFloatingBubbles();
        }
    }

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

// --- ЛОГИКА УДАЛЕНИЯ ---

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
            let b = grid[r][c];
            b.active = false; // Убираем из сетки
            
            // Добавляем красивую анимацию "ПОП"
            particles.push({
                x: b.x, y: b.y, color: b.color,
                type: 'pop', scale: 1, alpha: 1
            });
        }
        return true; // Возвращаем true, если что-то лопнуло
    }
    return false;
}

// --- ЛОГИКА ГРАВИТАЦИИ (САМОЕ ВАЖНОЕ) ---
function dropFloatingBubbles() {
    // 1. Находим все шарики, которые "привязаны" к потолку
    let floatingCluster = [];
    let visited = new Set();
    
    // Проходим по первому ряду (потолок)
    for (let c = 0; c < grid[0].length; c++) {
        if (grid[0][c].active) {
            markAttached(0, c, visited);
        }
    }

    // 2. Все активные шарики, которые мы НЕ посетили - это островки
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c].active) {
                let id = r + "-" + c;
                if (!visited.has(id)) {
                    // Этот шарик висит в воздухе!
                    let b = grid[r][c];
                    b.active = false; // Убираем из сетки

                    // Добавляем анимацию падения
                    particles.push({
                        x: b.x, y: b.y, color: b.color,
                        type: 'fall', 
                        dx: (Math.random() - 0.5) * 2, // Небольшой разброс в стороны
                        dy: 0 // Начальная скорость падения
                    });
                }
            }
        }
    }
}

// Рекурсивная функция для отметки всех привязанных шаров
function markAttached(r, c, visited) {
    let id = r + "-" + c;
    if (visited.has(id)) return;
    visited.add(id);

    let neighbors = getNeighbors(r, c);
    for (let n of neighbors) {
        if (n.r >= 0 && n.r < maxRows && n.c >= 0 && n.c < grid[n.r].length) {
            if (grid[n.r][n.c].active) {
                markAttached(n.r, n.c, visited);
            }
        }
    }
}

function getNeighbors(r, c) {
    let offsets;
    if (r % 2 === 0) {
        offsets = [{r:r,c:c-1},{r:r,c:c+1},{r:r-1,c:c-1},{r:r-1,c:c},{r:r+1,c:c-1},{r:r+1,c:c}];
    } else {
        offsets = [{r:r,c:c-1},{r:r,c:c+1},{r:r-1,c:c},{r:r-1,c:c+1},{r:r+1,c:c},{r:r+1,c:c+1}];
    }
    return offsets;
}

// --- ОТРИСОВКА ---

function draw() {
    update();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Рисуем сетку
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                let shiftX = (r % 2) * bubbleRadius;
                let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX;
                let y = r * (bubbleRadius * 1.74) + bubbleRadius;
                
                b.x = x; b.y = y; // Обновляем координаты (важно для коллизий)
                drawCircle(x, y, bubbleRadius, b.color);
            }
        }
    }

    // 2. Рисуем частицы (падающие и лопающиеся)
    for (let p of particles) {
        if (p.type === 'pop') {
            drawCircle(p.x, p.y, bubbleRadius * p.scale, p.color, p.alpha);
        } else if (p.type === 'fall') {
            drawCircle(p.x, p.y, bubbleRadius, p.color);
        }
    }

    // 3. Пуля и следующий цвет
    drawCircle(bullet.x, bullet.y, bubbleRadius, bullet.color);
    drawCircle(playerX + bubbleRadius * 3, playerY, bubbleRadius / 2, nextColor);

    requestAnimationFrame(draw);
}

// --- УПРАВЛЕНИЕ ---
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    shoot(e.clientX - rect.left, e.clientY - rect.top);
});
canvas.addEventListener('touchstart', (e) => {
    const rect = canvas.getBoundingClientRect();
    shoot(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
}, {passive: false});

window.addEventListener('resize', () => location.reload());
createGrid();
draw();
