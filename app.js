// Конфигурация Supabase
const SUPABASE_URL = 'https://xwtcasfvetisjaiijtsj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s';

// Глобальные переменные
let allHeroes = [];
let shownHeroes = new Set();
let currentHeroes = [];
let gameCompleted = false;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Инициализация игры...');
    await initializeGame();
    await loadNewBattle();
});

// Инициализация игры
async function initializeGame() {
    try {
        console.log('Загрузка героев из Supabase...');
        
        // Загружаем всех героев из базы
        const response = await fetch(`${SUPABASE_URL}/rest/v1/heroes?select=*`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Статус ответа:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка ответа:', errorText);
            throw new Error(`Ошибка загрузки героев: ${response.status} ${response.statusText}`);
        }
        
        allHeroes = await response.json();
        console.log('Успешно загружено героев:', allHeroes.length);
        console.log('Первые 3 героя:', allHeroes.slice(0, 3));
        
        // Загружаем прогресс из localStorage
        const savedProgress = localStorage.getItem('heroVoteProgress');
        if (savedProgress) {
            try {
                const progress = JSON.parse(savedProgress);
                shownHeroes = new Set(progress.shownHeroes || []);
                console.log('Загружен прогресс:', shownHeroes.size, 'показанных героев');
            } catch (e) {
                console.warn('Ошибка парсинга прогресса:', e);
                shownHeroes = new Set();
            }
        }
        
        updateProgressBar();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showResult('Ошибка подключения к базе данных', 'error');
        
        // Показываем сообщение об ошибке на 3 секунды, затем перезагружаем
        setTimeout(() => {
            location.reload();
        }, 3000);
    }
}

// Загрузка новой битвы
async function loadNewBattle() {
    if (gameCompleted) {
        showCompletionMessage();
        return;
    }
    
    try {
        // Выбираем двух случайных непоказанных героев
        const availableHeroes = allHeroes.filter(hero => !shownHeroes.has(hero.id));
        
        console.log('Доступно героев:', availableHeroes.length);
        
        if (availableHeroes.length < 2) {
            gameCompleted = true;
            showCompletionMessage();
            return;
        }
        
        // Выбираем двух случайных героев
        const randomIndices = getRandomIndices(availableHeroes.length, 2);
        currentHeroes = [
            availableHeroes[randomIndices[0]],
            availableHeroes[randomIndices[1]]
        ];
        
        console.log('Текущая битва:', currentHeroes[0].name, 'vs', currentHeroes[1].name);
        
        // Отображаем героев
        displayHero(1, currentHeroes[0]);
        displayHero(2, currentHeroes[1]);
        
        // Добавляем в показанные
        shownHeroes.add(currentHeroes[0].id);
        shownHeroes.add(currentHeroes[1].id);
        
        // Сохраняем прогресс
        saveProgress();
        updateProgressBar();
        
    } catch (error) {
        console.error('Ошибка загрузки битвы:', error);
        showResult('Ошибка загрузки битвы', 'error');
    }
}

// Отображение героя на карточке
function displayHero(cardNumber, hero) {
    const card = document.getElementById(`hero${cardNumber}`);
    const img = document.getElementById(`hero${cardNumber}-img`);
    const name = document.getElementById(`hero${cardNumber}-name`);
    const rating = document.getElementById(`hero${cardNumber}-rating`);
    const publisher = document.getElementById(`hero${cardNumber}-publisher`);
    
    console.log(`Отображение героя ${cardNumber}:`, hero);
    
    // Устанавливаем изображение (с обработкой ошибок)
    img.onerror = function() {
        console.warn(`Не удалось загрузить изображение: ${hero.image_url}`);
        this.src = 'https://via.placeholder.com/320x220/2a2a4a/ffffff?text=Image+Error';
    };
    
    img.onload = function() {
        console.log(`Изображение загружено: ${hero.image_url}`);
    };
    
    img.src = hero.image_url;
    img.alt = hero.name;
    
    name.textContent = hero.name;
    rating.textContent = `Рейтинг: ${hero.rating || 0}`;
    publisher.textContent = hero.publisher;
    
    // Цвет рамки в зависимости от издателя
    const borderColor = getPublisherColor(hero.publisher);
    card.style.borderColor = borderColor;
}

// Голосование
async function vote(winnerNumber) {
    if (gameCompleted) return;
    
    const winnerIndex = winnerNumber - 1;
    const loserIndex = winnerNumber === 1 ? 1 : 0;
    
    const winner = currentHeroes[winnerIndex];
    const loser = currentHeroes[loserIndex];
    
    try {
        // Показываем результат сразу
        showResult(`${winner.name} побеждает!`, 'success');
        
        // Обновляем статистику (асинхронно, не ждем завершения)
        updateHeroStats(winner.id, { wins: 1, viewers: 1 }).catch(console.error);
        updateHeroStats(loser.id, { loses: 1, viewers: 1 }).catch(console.error);
        
        // Задержка перед следующей битвой
        setTimeout(() => {
            loadNewBattle();
        }, 1500);
        
    } catch (error) {
        console.error('Ошибка голосования:', error);
        showResult('Ошибка сохранения голоса', 'error');
        
        // Все равно продолжаем игру
        setTimeout(() => {
            loadNewBattle();
        }, 1500);
    }
}

// Обновление статистики героя
async function updateHeroStats(heroId, updates) {
    try {
        // Используем более простой подход для обновления
        const response = await fetch(`${SUPABASE_URL}/rest/v1/heroes?id=eq.${heroId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(updates)
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка обновления: ${response.status}`);
        }
        
        console.log(`Статистика героя ${heroId} обновлена`);
        
    } catch (error) {
        console.error('Ошибка обновления статистики:', error);
        throw error;
    }
}

// Вспомогательные функции
function getRandomIndices(max, count) {
    const indices = new Set();
    while (indices.size < count) {
        indices.add(Math.floor(Math.random() * max));
    }
    return Array.from(indices);
}

function getPublisherColor(publisher) {
    const colors = {
        'DC': '#4cc9f0',
        'Marvel': '#ed1d24',
        'Valiant': '#ff6b00',
        'Rebellion': '#8b0000',
        'Dark Horse': '#333333'
    };
    return colors[publisher] || '#4cc9f0';
}

function showResult(message, type) {
    const resultElement = document.getElementById('result');
    resultElement.textContent = message;
    resultElement.className = `result ${type}`;
    resultElement.classList.add('show');
    
    setTimeout(() => {
        resultElement.classList.remove('show');
    }, 2000);
}

function showCompletionMessage() {
    const resultElement = document.getElementById('result');
    resultElement.innerHTML = '🎉 Вы просмотрели всех героев!<br>Игра завершена!';
    resultElement.className = 'result success show';
}

function saveProgress() {
    const progress = {
        shownHeroes: Array.from(shownHeroes),
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('heroVoteProgress', JSON.stringify(progress));
}

function updateProgressBar() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (allHeroes.length > 0) {
        const progress = (shownHeroes.size / allHeroes.length) * 100;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${shownHeroes.size}/${allHeroes.length}`;
    } else {
        progressFill.style.width = '0%';
        progressText.textContent = '0/0';
    }
}

// Добавим функцию для проверки подключения
async function testConnection() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/heroes?select=count`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Подключение к Supabase успешно. Количество героев:', data[0].count);
            return true;
        } else {
            console.error('Ошибка подключения:', response.status);
            return false;
        }
    } catch (error) {
        console.error('Ошибка теста подключения:', error);
        return false;
    }
}

// Запустим проверку подключения при загрузке
testConnection();