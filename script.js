const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- НАСТРОЙКИ ---
// Определяем ширину игрового поля (либо весь экран, либо макс. 480px для ПК)
let gameWidth = window.innerWidth > 480 ? 480 : window.innerWidth;
let gameHeight = window.innerHeight;

canvas.width = gameWidth;
canvas.height = gameHeight;

// Делаем расчет размеров динамическим
const COLUMN_COUNT = 8; // Всегда 8 шариков в ширину
// Радиус шарика = ширина экрана / количество / 2
const bubbleRadius = gameWidth / COLUMN_COUNT / 2; 

// Параметры сетки
const rows = 9; 
const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFC300'];

let grid = []; // Сетка
let playerX = gameWidth / 2;
let playerY = gameHeight - bubbleRadius * 2; // Чуть выше низа
let currentBubbleColor = getRandomColor();

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function getRandomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}

function createGrid() {
    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < COLUMN_COUNT; c++) {
            // Делаем небольшую "пустоту" внизу сетки для красоты, можно убрать условие
            grid[r][c] = { 
                x: 0, 
                y: 0, 
                color: getRandomColor(), 
                active: true 
            };
        }
    }
}

// Рисуем красивый шарик с бликом
function drawCircle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius - 1, 0, Math.PI * 2); // -1 для крошечного зазора
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    // Добавляем блик (светлое пятнышко), чтобы казалось объемным
    ctx.beginPath();
    ctx.arc(x - radius * 0.3, y - radius * 0.3, radius / 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // Полупрозрачный белый
    ctx.fill();
    ctx.closePath();
}

// --- ОСНОВНОЙ ЦИКЛ ОТРИСОВКИ ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем сетку
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < COLUMN_COUNT; c++) {
            let bubble = grid[r][c];
            
            if (bubble.active) {
                // --- ВАЖНАЯ МАТЕМАТИКА СОТ ---
                // Сдвиг по горизонтали для нечетных рядов
                let shiftX = (r % 2) * bubbleRadius;
                
                // Координата X
                let x = c * (bubbleRadius * 2) + bubbleRadius + shiftX;
                
                // Координата Y: ряды должны входить друг в друга.
                // Расстояние между центрами рядов меньше диаметра. 
                // Используем коэффициент 1.74 (это примерно корень из 3)
                let y = r * (bubbleRadius * 1.74) + bubbleRadius;

                // Сохраняем координаты в объект (пригодится для коллизий)
                bubble.x = x;
                bubble.y = y;

                // Проверка: не рисуем шарик, если он вылезает за правый край (из-за сдвига)
                if (x + bubbleRadius <= gameWidth + bubbleRadius) { 
                    drawCircle(x, y, bubbleRadius, bubble.color);
                }
            }
        }
    }

    // Рисуем шарик игрока
    drawCircle(playerX, playerY, bubbleRadius, currentBubbleColor);

    requestAnimationFrame(draw);
}

// --- СТАРТ ---
// Если экран изменили (повернули телефон), перезагружаем страницу для пересчета размеров
window.addEventListener('resize', () => location.reload());

createGrid();
draw();