
// Инициализация Telegram Web App
let tg = window.Telegram.WebApp;
tg.expand(); // Раскрываем на весь экран
tg.enableClosingConfirmation(); // Подтверждение закрытия
tg.MainButton.hide(); // Скрываем кнопки
// Полностью скрываем интерфейс (пользователь сможет закрыть жестом)
tg.disableVerticalSwipes = true;

// Тестовая база героев (замени на свою)
const testHeroes = [
    "Бэтмен", "Супермен", "Джокер", "Флэш", 
    "Чудо-женщина", "Аквамен", "Харли Квинн",
    "Киборг", "Зелёный Фонарь", "Марсианский Охотник"
];

// Текущая пара героев
let currentPair = [];

// Инициализация игры
function initGame() {
    // Показываем данные пользователя из Telegram (если есть)
    if (tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        console.log("User:", user.first_name, user.id);
    }
    
    // Выбираем случайную пару героев
    selectRandomPair();
    
    // Показываем героев на экране
    displayHeroes();
}

// Выбор случайной пары героев
function selectRandomPair() {
    // Создаем копию массива и перемешиваем
    const shuffled = [...testHeroes].sort(() => Math.random() - 0.5);
    // Берем первых двух
    currentPair = [shuffled[0], shuffled[1]];
}

// Показ героев на экране
function displayHeroes() {
    document.getElementById('hero1').querySelector('.hero-name').textContent = currentPair[0];
    document.getElementById('hero2').querySelector('.hero-name').textContent = currentPair[1];
}

// Функция голосования
function vote(heroNumber) {
    const winnerIndex = heroNumber - 1;
    const loserIndex = heroNumber === 1 ? 1 : 0;
    
    const winner = currentPair[winnerIndex];
    const loser = currentPair[loserIndex];
    
    // Показываем результат
    showResult(`Ты выбрал: ${winner}!`);
    
    // Здесь будет отправка на сервер
    console.log("Голос принят:", { winner, loser });
    
    // Через 2 секунды показываем новую пару
    setTimeout(() => {
        selectRandomPair();
        displayHeroes();
        hideResult();
    }, 2000);
}

// Показать результат выбора
function showResult(message) {
    const resultElement = document.getElementById('result');
    resultElement.textContent = message;
    resultElement.classList.add('show');
}

// Скрыть результат
function hideResult() {
    const resultElement = document.getElementById('result');
    resultElement.classList.remove('show');
}

// Запуск игры при загрузке страницы
document.addEventListener('DOMContentLoaded', initGame);

// Обработка ошибок
window.addEventListener('error', (e) => {
    console.error('Error:', e.error);
});
