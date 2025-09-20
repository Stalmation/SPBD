// app.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://xwtcasfvetisjaiijtsj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные
let allHeroes = [];
let currentHeroes = [];
let nextHeroes = [];
let votedHeroes = new Set();
let tg = null;

// Игровые переменные
let playerLives = 5;
let playerScore = 0;
let maxScore = 0;
let gameActive = true;

// Инициализация Telegram Web App
function initTelegram() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        tg = Telegram.WebApp;
        tg.setBackgroundColor('#1a1a2e');
        tg.BackButton.hide();
        console.log("Telegram Web App инициализирован");
    } else {
        console.log("Запуск в браузере (не в Telegram)");
    }
}

// Загрузка прогресса
function loadProgress() {
    try {
        const savedProgress = localStorage.getItem('heroVoteProgress');
        const savedStats = localStorage.getItem('heroGameStats');
        
        if (savedProgress) {
            const parsedProgress = JSON.parse(savedProgress);
            if (Array.isArray(parsedProgress)) {
                votedHeroes = new Set(parsedProgress);
            }
        }
        
        if (savedStats) {
            const stats = JSON.parse(savedStats);
            playerLives = stats.lives || 5;
            playerScore = stats.score || 0;
            maxScore = stats.maxScore || 0;
        }
        
        updateUI();
    } catch (error) {
        console.error("Error loading progress:", error);
        votedHeroes = new Set();
        playerLives = 5;
        playerScore = 0;
    }
}

// Сохранение прогресса
function saveProgress() {
    try {
        localStorage.setItem('heroVoteProgress', JSON.stringify(Array.from(votedHeroes)));
        localStorage.setItem('heroGameStats', JSON.stringify({
            lives: playerLives,
            score: playerScore,
            maxScore: Math.max(maxScore, playerScore)
        }));
        updateUI();
    } catch (error) {
        console.error("Error saving progress:", error);
    }
}

// Обновление интерфейса
function updateUI() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const scoreElement = document.getElementById('player-score');
    const livesElement = document.getElementById('player-lives');
    const maxScoreElement = document.getElementById('max-score');
    
    if (progressFill && progressText) {
        const progress = allHeroes.length > 0 ? (votedHeroes.size / allHeroes.length) * 100 : 0;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${votedHeroes.size}/${allHeroes.length}`;
    }
    
    if (scoreElement) scoreElement.textContent = playerScore;
    if (livesElement) livesElement.textContent = '★'.repeat(playerLives);
    if (maxScoreElement) maxScoreElement.textContent = maxScore;
}

// Загрузка всех героев
async function loadAllHeroes() {
    try {
        let { data, error } = await supabase
            .from("Heroes_Table")
            .select("id, name, image_url, wins, loses, viewers, rating, good_bad, publisher, owner")
            .order('rating', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return;

        allHeroes = data;
        loadProgress();
        startGame();
        
    } catch (error) {
        console.error("Ошибка при загрузке героев:", error);
    }
}

// Начало игры
function startGame() {
    gameActive = true;
    displayHeroes();
    updateUI();
}

// Выбор случайных героев
function getRandomHeroes() {
    if (allHeroes.length < 2) return null;
    
    const availableHeroes = allHeroes.filter(hero => !votedHeroes.has(hero.id));
    
    if (availableHeroes.length < 2) {
        // Все герои пройдены - сбрасываем прогресс
        resetGameProgress();
        return getRandomHeroes();
    }
    
    const randomIndex1 = Math.floor(Math.random() * availableHeroes.length);
    let randomIndex2;
    do {
        randomIndex2 = Math.floor(Math.random() * availableHeroes.length);
    } while (randomIndex1 === randomIndex2);
    
    return [availableHeroes[randomIndex1], availableHeroes[randomIndex2]];
}

// Предзагрузка изображений
function preloadNextPair() {
    const nextPair = getRandomHeroes();
    if (!nextPair) return;
    nextHeroes = nextPair;
    nextPair.forEach(hero => {
        if (hero.image_url) new Image().src = hero.image_url;
        if (hero.owner) new Image().src = hero.owner;
    });
}

// Скрыть все оверлеи и эффекты
function hideAllOverlays() {
    const overlays = document.querySelectorAll('.hero-win-overlay, .hero-lose-overlay');
    overlays.forEach(overlay => overlay.classList.remove('show'));
    
    const smokeEffects = document.querySelectorAll('.smoke-effect');
    smokeEffects.forEach(smoke => smoke.classList.remove('show'));
}

// Получение текста выравнивания героя
function getHeroAlignment(goodBad) {
    switch(goodBad) {
        case 1: return { text: 'GOOD', color: '#4cc9f0' };
        case 2: return { text: 'BAD', color: '#ff6b6b' };
        case 3: return { text: 'TRICKY', color: '#aaaaaa' };
        default: return { text: 'UNKNOWN', color: '#cccccc' };
    }
}

// Отображение героев
function displayHeroes() {
    if (!gameActive) return;
    
    hideAllOverlays();
    
    if (nextHeroes.length === 2) {
        currentHeroes = nextHeroes;
        nextHeroes = [];
    } else {
        currentHeroes = getRandomHeroes();
    }
    
    if (!currentHeroes) return;
    
    preloadNextPair();
    
    // Очищаем проценты
    ['hero1', 'hero2'].forEach(hero => {
        document.getElementById(`${hero}-win-percent`).textContent = '';
        document.getElementById(`${hero}-lose-percent`).textContent = '';
    });
    
    currentHeroes.forEach((hero, index) => {
        const heroNum = index + 1;
        document.getElementById(`hero${heroNum}-img`).src = hero.image_url;
        document.getElementById(`hero${heroNum}-name`).textContent = hero.name;
        
        // Обновляем выравнивание (top right)
        const alignmentElement = document.getElementById(`hero${heroNum}-alignment`);
        const alignment = getHeroAlignment(hero.good_bad);
        alignmentElement.textContent = alignment.text;
        alignmentElement.style.color = alignment.color;
        
        // Обновляем издателя (top left)
        const publisherElement = document.getElementById(`hero${heroNum}-publisher`);
        publisherElement.innerHTML = '';
        if (hero.owner) {
            const logoImg = document.createElement('img');
            logoImg.src = hero.owner;
            logoImg.alt = hero.publisher;
            logoImg.className = 'publisher-logo';
            publisherElement.appendChild(logoImg);
        }
    });
}

// Голосование
async function vote(heroNumber) {
    if (!gameActive || !currentHeroes || currentHeroes.length < 2 || playerLives <= 0) return;
    
    const selectedHero = currentHeroes[heroNumber - 1];
    const otherHero = currentHeroes[heroNumber === 1 ? 1 : 0];
    
    // Проверяем правильность выбора ДО обновления базы
    const userMadeRightChoice = selectedHero.rating > otherHero.rating;
    
    try {
        // Обновляем статистику в базе (только если в Telegram)
        if (tg) {
            await updateHeroStats(selectedHero.id, otherHero.id);
        } else {
            console.log("Локальный режим: данные не сохраняются в базу");
        }
        
        // Обновляем игровую статистику
        if (userMadeRightChoice) {
            playerScore++;
            if (tg) tg.HapticFeedback.impactOccurred('heavy');
        } else {
            playerLives--;
            if (tg) tg.HapticFeedback.impactOccurred('medium');
        }
        
        // Показываем результат
        showVoteResult(heroNumber, userMadeRightChoice, selectedHero.rating, otherHero.rating);
        
        // Сохраняем прогресс
        votedHeroes.add(selectedHero.id);
        votedHeroes.add(otherHero.id);
        saveProgress();
        
        // Переходим к следующей паре или game over
        setTimeout(() => {
            if (playerLives <= 0) {
                gameOver();
            } else if (gameActive) {
                displayHeroes();
            }
        }, 2500); // Увеличили задержку для просмотра процентов
        
    } catch (error) {
        console.error("Ошибка при голосовании:", error);
    }
}

// Обновление статистики героев
async function updateHeroStats(winnerId, loserId) {
    try {
        await supabase
            .from('Heroes_Table')
            .update({ 
                wins: supabase.sql`wins + 1`,
                viewers: supabase.sql`viewers + 1`
            })
            .eq('id', winnerId);
        
        await supabase
            .from('Heroes_Table')
            .update({ 
                loses: supabase.sql`loses + 1`,
                viewers: supabase.sql`viewers + 1`
            })
            .eq('id', loserId);
            
    } catch (error) {
        console.error("Ошибка при обновлении статистики:", error);
    }
}

// Показ результата голосования
function showVoteResult(heroNumber, userWon, selectedRating, otherRating) {
    const selectedHero = heroNumber;
    const otherHero = heroNumber === 1 ? 2 : 1;
    
    if (userWon) {
        document.getElementById(`hero${selectedHero}-win`).classList.add('show');
        document.getElementById(`hero${otherHero}-lose`).classList.add('show');
        document.getElementById(`hero${selectedHero}-win-percent`).textContent = `${selectedRating}%`;
        document.getElementById(`hero${otherHero}-lose-percent`).textContent = `${otherRating}%`;
        
        // Показываем синий дым для победителя
        document.getElementById(`hero${selectedHero}-blue-smoke`).classList.add('show');
        // Показываем серый дым для проигравшего
        document.getElementById(`hero${otherHero}-gray-smoke`).classList.add('show');
    } else {
        document.getElementById(`hero${selectedHero}-lose`).classList.add('show');
        document.getElementById(`hero${otherHero}-win`).classList.add('show');
        document.getElementById(`hero${selectedHero}-lose-percent`).textContent = `${selectedRating}%`;
        document.getElementById(`hero${otherHero}-win-percent`).textContent = `${otherRating}%`;
        
        // Показываем серый дым для неправильного выбора
        document.getElementById(`hero${selectedHero}-gray-smoke`).classList.add('show');
        // Показываем синий дым для правильного героя
        document.getElementById(`hero${otherHero}-blue-smoke`).classList.add('show');
    }
}

// Конец игры
function gameOver() {
    gameActive = false;
    
    // Сохраняем максимальный счет
    maxScore = Math.max(maxScore, playerScore);
    saveProgress();
    
    // Показываем затемнение
    document.body.style.opacity = '0.7';
    
    // Показываем popup
    setTimeout(() => {
        showGameOverPopup();
    }, 1000);
}

function showGameOverPopup() {
    // Создаем popup элемент
    const popup = document.createElement('div');
    popup.className = 'game-over-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <h2>💀 GAME OVER!</h2>
            <p>Your score: <span class="score">${playerScore}</span></p>
            <p>Best score: <span class="best">${maxScore}</span></p>
            <button id="restart-button">🔄 Try Again</button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Обработчик кнопки
    document.getElementById('restart-button').addEventListener('click', function() {
        popup.remove();
        resetGame();
    });
    
    // Вибрация
    if (tg) tg.HapticFeedback.notificationOccurred('error');
}

// Сброс игры (сохраняем только maxScore)
function resetGame() {
    // Сбрасываем только текущую сессию
    playerLives = 5;
    playerScore = 0;
    // votedHeroes.clear(); // НЕ очищаем прогрес голосований!
    gameActive = true;
    
    // Восстанавливаем прозрачность
    document.body.style.opacity = '1';
    
    // Обновляем интерфейс
    updateUI();
    
    // Показываем новых героев
    displayHeroes();
}

// Полный сброс прогресса
function resetGameProgress() {
    playerLives = 5;
    playerScore = 0;
    votedHeroes.clear();
    maxScore = 0;
    localStorage.removeItem('heroVoteProgress');
    localStorage.removeItem('heroGameStats');
    updateUI();
}

// Запуск при загрузке DOM
document.addEventListener("DOMContentLoaded", function() {
    initTelegram();
    loadAllHeroes();
});

window.vote = vote;