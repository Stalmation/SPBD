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
    await initializeGame();
    await loadNewBattle();
});

// Инициализация игры
async function initializeGame() {
    try {
        // Загружаем всех героев из базы
        const response = await fetch(`${SUPABASE_URL}/rest/v1/heroes?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка загрузки героев: ${response.status} ${response.statusText}`);
        }
        
        allHeroes = await response.json();
        console.log('Загружено героев:', allHeroes.length);
        
        // Загружаем прогресс из localStorage
        const savedProgress = localStorage.getItem('heroVoteProgress');
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            shownHeroes = new Set(progress.shownHeroes || []);
            updateProgressBar();
        }
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showResult('Ошибка загрузки данных', 'error');
        
        // Заглушка для тестирования
        allHeroes = [
            {id: 1, name: 'Batman', image_url: 'https://via.placeholder.com/320x220/2a2a4a/ffffff?text=Batman', publisher: 'DC', rating: 95},
            {id: 2, name: 'Superman', image_url: 'https://via.placeholder.com/320x220/2a2a4a/ffffff?text=Superman', publisher: 'DC', rating: 98},
            {id: 3, name: 'Spider-Man', image_url: 'https://via.placeholder.com/320x220/2a2a4a/ffffff?text=Spider-Man', publisher: 'Marvel', rating: 92},
            {id: 4, name: 'Iron Man', image_url: 'https://via.placeholder.com/320x220/2a2a4a/ffffff?text=Iron+Man', publisher: 'Marvel', rating: 90}
        ];
        updateProgressBar();
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
        
        console.log('Текущие герои:', currentHeroes);
        
        // Отображаем героев
        displayHero(1, currentHeroes[0]);
        displayHero(2, currentHeroes[1]);
        
        // Отмечаем показ и обновляем статистику
        try {
            await trackHeroShow(currentHeroes[0].id);
            await trackHeroShow(currentHeroes[1].id);
        } catch (error) {
            console.warn('Не удалось обновить статистику показа:', error);
        }
        
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
    
    // Устанавливаем изображение (с обработкой ошибок)
    img.onerror = function() {
        this.src = 'https://via.placeholder.com/320x220/2a2a4a/ffffff?text=Image+Not+Found';
        console.warn(`Не удалось загрузить изображение для: ${hero.name}`);
    };
    img.src = hero.image_url || 'https://via.placeholder.com/320x220/2a2a4a/ffffff?text=No+Image';
    
    name.textContent = hero.name || 'Неизвестный герой';
    rating.textContent = `Рейтинг: ${hero.rating || 0}`;
    publisher.textContent = hero.publisher || 'Неизвестно';
    
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
        // Обновляем статистику
        await sendVote(winner.id, loser.id);
        
        // Показываем результат
        showResult(`${winner.name} побеждает!`, 'success');
        
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

// Отправка голоса
async function sendVote(winnerId, loserId) {
    try {
        await Promise.all([
            updateHeroStats(winnerId, { wins: 1, viewers: 1 }),
            updateHeroStats(loserId, { loses: 1, viewers: 1 })
        ]);
    } catch (error) {
        console.warn('Не удалось сохранить голос:', error);
        throw error;
    }
}

// Отслеживание показа героя
async function trackHeroShow(heroId) {
    try {
        await updateHeroStats(heroId, { shows: 1 });
    } catch (error) {
        console.warn('Не удалось обновить статистику показа:', error);
        throw error;
    }
}

// Обновление статистики героя
async function updateHeroStats(heroId, updates) {
    try {
        // Получаем текущие значения
        const response = await fetch(`${SUPABASE_URL}/rest/v1/heroes?id=eq.${heroId}`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка получения данных: ${response.status}`);
        }
        
        const currentData = await response.json();
        if (currentData.length === 0) {
            throw new Error(`Герой с ID ${heroId} не найден`);
        }
        
        const currentStats = currentData[0];
        const newStats = {};
        
        // Обновляем значения
        for (const [key, value] of Object.entries(updates)) {
            newStats[key] = (currentStats[key] || 0) + value;
        }
        
        // Отправляем обновление
        const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/heroes?id=eq.${heroId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(newStats)
        });
        
        if (!updateResponse.ok) {
            throw new Error(`Ошибка обновления: ${updateResponse.status}`);
        }
        
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
    
    const progress = (shownHeroes.size / allHeroes.length) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${shownHeroes.size}/${allHeroes.length}`;
}