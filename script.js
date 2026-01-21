const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- НАСТРОЙКИ ---
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

const COLUMN_COUNT = 11; 
const bubbleRadius = gameWidth / COLUMN_COUNT / 2; 

const rows = 4; 
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFC300', '#00FFFF'];

let grid = []; 

// --- ПАРАМЕТРЫ ИГРОКА И ПУЛИ ---
let playerX = gameWidth / 2;
let playerY = gameHeight - bubbleRadius * 3;

// Объект пули
let bullet = {
    x: playerX,
    y: playerY,
    dx: 0,         // Скорость по X
    dy: 0,         // Скорость по Y
    speed: 15,     // Как быстро летит (можно менять)
    color: getRandomColor(),
    active: false  // Летит прямо сейчас или нет?
};

// Переменная для следующего цвета (чтобы видеть, какой будет потом)
let nextColor = getRandomColor();

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

function createGrid() {
    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        let currentColumns = (r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);
        for (let c = 0; c < currentColumns; c++) {
            grid[r][c] = { 
                x: 0, y: 0, 
                color: getRandomColor(), 
                active: true 
            };
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

// --- ОБРАБОТКА ВЫСТРЕЛА ---
function shoot(targetX, targetY) {
    // Если пуля уже летит, не даем стрелять второй раз
    if (bullet.active) return;

    // 1. Считаем угол стрельбы (математика: арктангенс)
    // Угол между точкой клика и позицией пушки
    let angle = Math.atan2(targetY - playerY, targetX - playerX);

    // 2. Рассчитываем скорость по X и Y на основе угла
    bullet.dx = Math.cos(angle) * bullet.speed;
    bullet.dy = Math.sin(angle) * bullet.speed;

    bullet.active = true;
}

// --- ОБНОВЛЕНИЕ СОСТОЯНИЯ (ФИЗИКА) ---
function update() {
    if (bullet.active) {
        // Двигаем пулю
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        // 1. Отскок от стен (Левая и Правая)
        if (bullet.x - bubbleRadius < 0) {
            bullet.x = bubbleRadius; // Возвращаем в пределы
            bullet.dx = -bullet.dx;  // Меняем направление скорости на противоположное
        }
        if (bullet.x + bubbleRadius > gameWidth) {
            bullet.x = gameWidth - bubbleRadius;
            bullet.dx = -bullet.dx;
        }

        // 2. Временная остановка у потолка
        if (bullet.y - bubbleRadius < 0) {
            resetBullet();
        }
    }
}

function resetBullet() {
    bullet.active = false;
    bullet.x = playerX;
    bullet.y = playerY;
    bullet.dx = 0;
    bullet.dy = 0;
    
    // Меняем цвета
    bullet.color = nextColor;
    nextColor = getRandomColor();
}

// --- ОТРИСОВКА ---
function draw() {
    update(); // Сначала считаем физику

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем сетку
    for (let r = 0; r < grid.length; r++) {
        let currentRowLength = grid[r].length;
        for (let c = 0; c < currentRowLength; c++) {
            let b = grid[r][c];
            if (b && b.active) {
                let shiftX = (r % 2) * bubbleRadius;
                let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX;
                let y = r * (bubbleRadius * 1.74) + bubbleRadius;
                
                // Сохраняем координаты для будущих проверок
                b.x = x;
                b.y = y;

                drawCircle(x, y, bubbleRadius, b.color);
            }
        }
    }

    // Рисуем нашу пулю
    drawCircle(bullet.x, bullet.y, bubbleRadius, bullet.color);

    // Можно нарисовать следующий цвет где-то в уголке (маленький подсказчик)
    drawCircle(playerX + bubbleRadius * 3, playerY, bubbleRadius / 2, nextColor);

    requestAnimationFrame(draw);
}

// --- УПРАВЛЕНИЕ ---
// Слушаем клик мышкой или касание пальцем
canvas.addEventListener('click', (e) => {
    // Получаем координаты клика относительно холста
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    shoot(x, y);
});

// Добавляем поддержку тапа для телефонов (иногда click работает с задержкой)
canvas.addEventListener('touchstart', (e) => {
    // e.preventDefault(); // Можно раскомментировать, если экран дергается
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    shoot(x, y);
}, {passive: false});

// --- СТАРТ ---
window.addEventListener('resize', () => location.reload());
createGrid();
draw();
