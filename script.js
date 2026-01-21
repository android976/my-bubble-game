const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- НАСТРОЙКИ ---
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

// 1. Уменьшаем размер шаров, увеличивая количество колонок
// Было 8, ставим 11. Чем больше число, тем мельче шарики.
const COLUMN_COUNT = 11; 
const bubbleRadius = gameWidth / COLUMN_COUNT / 2; 

// 2. Делаем 4 ряда со старта
const rows = 4; 
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFC300', '#00FFFF']; // Добавил голубой цвет

let grid = []; 
let playerX = gameWidth / 2;
let playerY = gameHeight - bubbleRadius * 3; // Чуть поднял пушку
let currentBubbleColor = getRandomColor();

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

function createGrid() {
    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        // 3. Логика "Сот": 
        // Если ряд четный (0, 2...) -> полный набор шариков
        // Если ряд нечетный (1, 3...) -> на 1 шарик меньше, чтобы влезли в границы
        let currentColumns = (r % 2 === 0) ? COLUMN_COUNT : (COLUMN_COUNT - 1);

        for (let c = 0; c < currentColumns; c++) {
            grid[r][c] = { 
                x: 0, 
                y: 0, 
                color: getRandomColor(), 
                active: true 
            };
        }
    }
}

// Рисование шарика с бликом
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

// --- ОТРИСОВКА ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < grid.length; r++) {
        // Определяем, сколько шариков должно быть в этом ряду
        // (нужно для цикла отрисовки, так как массив может быть разреженным)
        let currentRowLength = grid[r].length;

        for (let c = 0; c < currentRowLength; c++) {
            let bubble = grid[r][c];
            
            if (bubble && bubble.active) {
                // Сдвиг для нечетных рядов (точно на радиус)
                let shiftX = (r % 2) * bubbleRadius;
                
                // Координата X
                // Для четных: 0, 2r, 4r... + радиус (центр)
                // Для нечетных: сдвиг + 0, 2r... + радиус
                let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX;
                
                // Координата Y (ряды входят друг в друга)
                let y = r * (bubbleRadius * 1.74) + bubbleRadius;

                // Обновляем координаты в памяти
                bubble.x = x;
                bubble.y = y;

                drawCircle(x, y, bubbleRadius, bubble.color);
            }
        }
    }

    // Рисуем шарик игрока
    drawCircle(playerX, playerY, bubbleRadius, currentBubbleColor);

    requestAnimationFrame(draw);
}

// --- СТАРТ ---
window.addEventListener('resize', () => {
    // Перезагрузка при повороте экрана, чтобы пересчитать размеры
    location.reload(); 
});

createGrid();
draw();
