const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- НАСТРОЙКИ ---
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

const COLUMN_COUNT = 11; 
const bubbleRadius = gameWidth / COLUMN_COUNT / 2; 

// Увеличим количество рядов в памяти, чтобы было куда стрелять вниз
const maxRows = 20; 
const startRows = 4;
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFC300', '#00FFFF'];

let grid = []; 

let playerX = gameWidth / 2;
let playerY = gameHeight - bubbleRadius * 3;

let bullet = {
    x: playerX,
    y: playerY,
    dx: 0, dy: 0,
    speed: 15,
    color: getRandomColor(),
    active: false
};

let nextColor = getRandomColor();

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

function createGrid() {
    // Создаем пустую сетку на много рядов вперед
    for (let r = 0; r < maxRows; r++) {
        grid[r] = [];
        let currentColumns = (r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
        for (let c = 0; c < currentColumns; c++) {
            // Заполняем только первые startRows рядов
            if (r < startRows) {
                grid[r][c] = { x: 0, y: 0, color: getRandomColor(), active: true };
            } else {
                grid[r][c] = { x: 0, y: 0, color: null, active: false };
            }
        }
    }
}

function drawCircle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
    
    // Блик
    ctx.beginPath();
    ctx.arc(x - radius * 0.3, y - radius * 0.3, radius / 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    ctx.closePath();
}

// Расстояние между двумя точками (теорема Пифагора)
function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// --- ОСНОВНАЯ ЛОГИКА ---

function shoot(targetX, targetY) {
    if (bullet.active) return;

    let angle = Math.atan2(targetY - playerY, targetX - playerX);
    bullet.dx = Math.cos(angle) * bullet.speed;
    bullet.dy = Math.sin(angle) * bullet.speed;
    bullet.active = true;
}

function update() {
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

        // Потолок (теперь это тоже прилипание)
        if (bullet.y - bubbleRadius < 0) {
            bullet.y = bubbleRadius; // Ставим ровно к потолку
            snapBubble();
            return;
        }

        // Проверка столкновений с другими шарами
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                let b = grid[r][c];
                if (b.active) {
                    let dist = getDistance(bullet.x, bullet.y, b.x, b.y);
                    // Если расстояние меньше двух радиусов - они коснулись
                    if (dist < bubbleRadius * 2) {
                        snapBubble();
                        return; // Прерываем функцию, пуля остановилась
                    }
                }
            }
        }
    }
}

// Функция "Прилипания" - самая сложная математика
function snapBubble() {
    bullet.active = false;

    // 1. Вычисляем, в какую ячейку сетки (ряд и колонка) попал шарик
    // Y: Делим координату Y на высоту ряда (radius * 1.74)
    let gridY = Math.round((bullet.y - bubbleRadius) / (bubbleRadius * 1.74));
    
    if (gridY < 0) gridY = 0; // Защита от выхода за верхний край
    if (gridY >= maxRows) gridY = maxRows - 1;

    // X: Учитываем сдвиг ряда
    let shiftX = (gridY % 2) * bubbleRadius;
    let gridX = Math.round((bullet.x - bubbleRadius - shiftX) / (bubbleRadius * 2));

    // Корректировка границ
    let maxCol = (gridY % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
    if (gridX < 0) gridX = 0;
    if (gridX >= maxCol) gridX = maxCol - 1;

    // Если ячейка уже занята (бывает при быстром полете), ищем ближайшую свободную
    if (grid[gridY][gridX] && grid[gridY][gridX].active) {
        // Простой хак: если место занято, пробуем строку ниже (ближе к игроку)
        gridY++; 
        // Пересчитываем X для новой строки
        shiftX = (gridY % 2) * bubbleRadius;
        gridX = Math.round((bullet.x - bubbleRadius - shiftX) / (bubbleRadius * 2));
    }

    // Записываем шарик в сетку (если массив существует)
    if (grid[gridY] && grid[gridY][gridX]) {
        grid[gridY][gridX].active = true;
        grid[gridY][gridX].color = bullet.color;
        
        // 2. После прилипания проверяем совпадения
        findAndRemoveMatches(gridY, gridX, bullet.color);
    }

    // Готовим новую пулю
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

// --- ПОИСК И УДАЛЕНИЕ СОВПАДЕНИЙ ---

function findAndRemoveMatches(startR, startC, color) {
    let cluster = []; // Сюда будем складывать найденные шарики
    
    // Вспомогательная функция для рекурсивного поиска
    function search(r, c) {
        // Проверки на границы и валидность
        if (r < 0 || r >= maxRows || c < 0 || c >= grid[r].length) return;
        if (!grid[r][c].active) return;
        if (grid[r][c].color !== color) return;
        
        // Если этот шарик уже есть в кластере, пропускаем
        let id = r + "-" + c;
        if (cluster.includes(id)) return;

        // Добавляем в кластер
        cluster.push(id);

        // Ищем соседей. Соседи в гексагональной (сотовой) сетке зависят от четности ряда
        let neighbors = getNeighbors(r, c);
        
        for (let n of neighbors) {
            search(n.r, n.c);
        }
    }

    search(startR, startC);

    // Если нашли 3 или больше шариков одного цвета
    if (cluster.length >= 3) {
        for (let id of cluster) {
            let [r, c] = id.split("-").map(Number);
            grid[r][c].active = false; // Лопаем шарик
        }
    }
}

// Получение координат соседей (математика сот)
function getNeighbors(r, c) {
    let offsets;
    
    // Для четных рядов (0, 2, 4...)
    if (r % 2 === 0) {
        offsets = [
            {r: r, c: c-1}, {r: r, c: c+1},     // Слева, Справа
            {r: r-1, c: c-1}, {r: r-1, c: c},   // Сверху-Слева, Сверху-Справа
            {r: r+1, c: c-1}, {r: r+1, c: c}    // Снизу-Слева, Снизу-Справа
        ];
    } else {
        // Для нечетных рядов (1, 3, 5...) - они сдвинуты
        offsets = [
            {r: r, c: c-1}, {r: r, c: c+1},
            {r: r-1, c: c}, {r: r-1, c: c+1},
            {r: r+1, c: c}, {r: r+1, c: c+1}
        ];
    }
    return offsets;
}

// --- ОТРИСОВКА ---

function draw() {
    update();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем сетку
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                let shiftX = (r % 2) * bubbleRadius;
                let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX;
                let y = r * (bubbleRadius * 1.74) + bubbleRadius;
                
                // Сохраняем координаты для коллизий
                b.x = x;
                b.y = y;

                drawCircle(x, y, bubbleRadius, b.color);
            }
        }
    }

    // Пуля
    drawCircle(bullet.x, bullet.y, bubbleRadius, bullet.color);
    
    // Следующий цвет (подсказка)
    drawCircle(playerX + bubbleRadius * 3, playerY, bubbleRadius / 2, nextColor);

    requestAnimationFrame(draw);
}

// --- УПРАВЛЕНИЕ ---
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    shoot(x, y);
});

canvas.addEventListener('touchstart', (e) => {
    // e.preventDefault(); 
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    shoot(x, y);
}, {passive: false});

// Старт
window.addEventListener('resize', () => location.reload());
createGrid();
draw();
