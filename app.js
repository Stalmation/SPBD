// app.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://xwtcasfvetisjaiijtsj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s";

// Константы для управления таймингами
const HERO_DISPLAY_DURATION = 3000;
const SMOKE_ANIMATION_DURATION = 1250;
// Добавьте после констант в начале файла (после SMOKE_ANIMATION_DURATION)
const NETWORK_CHECK_TIMEOUT = 10000;
// Добавьте в начало файла с другими константами
const DISCLAIMER_SHOWN_KEY = 'disclaimerShown';
const RULES_SHOWN_KEY = 'rulesShown';

// Константы для силы голоса
const MAX_DAILY_BONUS = 5;
const MAX_GAME_BONUS = 20;
const BONUS_PER_GAME_PAIR = 10;

// Константа для количества жизней
const INITIAL_PLAYER_LIVES = 5; // ← ДОБАВЬТЕ ЭТУ КОНСТАНТУ

// Добавьте после констант в начале app.js
const HORIZONTAL_FLIP_EXCLUSIONS = [
    'Superman', 'Superboy', 
    'Supergirl', 'Invisible Woman',
    'Winter Soldier',  'Mr. Fantastic', 'Human Torch', 'Thing'
    // Добавьте другие имена как они есть в базе
];

// Переменные для статистики
let gameStartTime = null;
let sessionId = null;

const FIRST_RUN_KEY = 'firstRunCompleted';

// Переменные силы голоса
let dailyVotePower = 1;
let gameVotePower = 0;
let totalVotePower = 1;
let lastPlayDate = null;
let pairsGuessed = 0; // ← ДОБАВИТЬ ЭТУ ПЕРЕМЕННУЮ
//let totalPairsShown = 0;   // ← ДОБАВИТЬ ТОЛЬКО ЭТУ: показанные пары в текущей игре
let votePowerPairs = 0; // ← ДОБАВЬТЕ ЭТУ СТРОКУ       // ОБЩЕЕ количество показанных пар (все игры)
let currentGamePairsShown = 0;  // ТОЛЬКО для текущей игры

let totalGames = 0;
let totalPairsGuessedOverall = 0;
let totalPairsShownOverall = 0;


const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Менеджер анимаций для предотвращения утечек памяти
const AnimationManager = {
    timeouts: new Set(),
    frames: new Set(),
    smokeAnimations: new Set(),
    
    setTimeout(callback, delay) {
        const timeoutId = setTimeout(() => {
            callback();
            this.timeouts.delete(timeoutId);
        }, delay);
        this.timeouts.add(timeoutId);
        return timeoutId;
    },
    
    requestAnimationFrame(callback) {
        const frameId = requestAnimationFrame(() => {
            callback();
            this.frames.delete(frameId);
        });
        this.frames.add(frameId);
        return frameId;
    },
    
    addSmokeAnimation(animationId) {
        this.smokeAnimations.add(animationId);
    },
    
    removeSmokeAnimation(animationId) {
        this.smokeAnimations.delete(animationId);
    },
    
    clearAll() {
        this.timeouts.forEach(timeout => clearTimeout(timeout));
        this.frames.forEach(frame => cancelAnimationFrame(frame));
        this.smokeAnimations.clear();
        this.timeouts.clear();
        this.frames.clear();
    }
};

// Global variables
let allHeroes = [];
let currentHeroes = [];
let nextHeroes = [];
let votedHeroes = new Set();

let tg = null;
let isVotingInProgress = false;
let currentVotePairId = null;
let networkErrorShown = false;
// Game variables
let playerLives = INITIAL_PLAYER_LIVES;
let playerScore = 0;
let maxScore = 0;
let gameActive = true;



// Publisher logo mapping
const PUBLISHER_LOGOS = {
    'dc': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/dc.webp',
    'marvel': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/marvel.webp',
    'valiant': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/valiant.webp',
    'rebellion': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/rebellion.webp',
    'dark horse': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/dark_horse.webp',
    'dark_horse': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/dark_horse.webp',
    'Bat in the sun': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/bits.webp',
};


// Эмиттер цифр для анимации силы голоса
// Эмиттер цифр для анимации силы голоса
// Эмиттер цифр для анимации силы голоса
const ScoreEmitter = {
    emitter: null,
    
    init() {
        this.emitter = document.getElementById('score-emitter');
        if (!this.emitter) {
            this.emitter = document.createElement('div');
            this.emitter.id = 'score-emitter';
            this.emitter.className = 'score-emitter';
            document.body.appendChild(this.emitter);
        }
    },
    
    // Создание частицы с анимацией разлета
    createParticle(x, y, value) {
        if (!this.emitter) this.init();
    
    const particle = document.createElement('div');
    particle.className = 'score-particle';
    particle.textContent = value;
    
    // Позиционирование в месте клика
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';

    // Адаптивные размеры в зависимости от экрана
    const screenWidth = window.innerWidth;
    let sizeClass = '';
    
    if (screenWidth <= 360) {
        // Очень маленькие экраны - минимальные размеры
        sizeClass = 'size-small';
    } else if (screenWidth <= 480) {
        // Маленькие телефоны
        const sizes = ['size-small', '', 'size-small'];
        sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
    } else if (screenWidth <= 768) {
        // Телефоны и маленькие планшеты
        const sizes = ['size-small', '', ''];
        sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
    } else {
        // Планшеты и десктопы
        const sizes = ['size-small', '', 'size-large'];
        sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
    }
    
    if (sizeClass) {
        particle.classList.add(sizeClass);
    }
    
    // Адаптивное смещение в зависимости от размера экрана
    const baseOffset = screenWidth <= 480 ? 60 : 
                      screenWidth <= 768 ? 80 : 100;
    
    const offsetX = (Math.random() - 0.5) * baseOffset;
    const offsetY = (Math.random() - 0.5) * baseOffset;
    
    // Случайная начальная прозрачность
    const startOpacity = 0.7 + Math.random() * 0.3;
    
    // Адаптивная длительность анимации
    const moveDuration = screenWidth <= 480 ? 1.0 : 
                        screenWidth <= 768 ? 1.2 : 1.5;
    
    // Индивидуальные параметры для исчезновения
    const fadeStartTime = (Math.random() * 0.8 + 0.4) * 1000;
    const fadeDuration = (Math.random() * 0.5 + 0.3) * 1000;
    const totalLifeTime = fadeStartTime + fadeDuration;

    // Устанавливаем CSS переменные
    particle.style.setProperty('--offset-x', offsetX);
    particle.style.setProperty('--offset-y', offsetY);
    particle.style.opacity = startOpacity;
    particle.style.animationDuration = moveDuration + 's';

    this.emitter.appendChild(particle);

    // Запускаем исчезновение в случайное время
    AnimationManager.setTimeout(() => {
        particle.style.transition = `opacity ${fadeDuration}ms ease-out`;
        particle.style.opacity = '0';
    }, fadeStartTime);
        
        // Удаление после полного исчезновения
        AnimationManager.setTimeout(() => {
            if (particle.parentNode === this.emitter) {
                this.emitter.removeChild(particle);
            }
        }, totalLifeTime);
    },
    
    // Остальной код без изменений...
    emitFromPoint(x, y, count = 4, text = '+1') { // Добавляем параметр text
        for (let i = 0; i < count; i++) {
            const randomDelay = Math.random() * 100;
            
            AnimationManager.setTimeout(() => {
                this.createParticle(x, y, text); // Используем переданный текст
            }, i * 20 + randomDelay);
        }
    },
    
    clear() {
        if (this.emitter) {
            this.emitter.innerHTML = '';
        }
    }
};

function shouldFlipHero(hero) {
    // Прямое сравнение без lower case
    for (const excludedName of HORIZONTAL_FLIP_EXCLUSIONS) {
        if (hero.name.includes(excludedName)) {
            return false;
        }
    }
    
    // 50% шанс для остальных
    return Math.random() > 0.5;
}


// ==================== СТАТИСТИКА ====================



// Функция генерации ID сессии
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Функция сохранения статистики
async function saveGameStats(completionType) {
    try {
        const gameDuration = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
        
        // Информация о устройстве и стране
        const country = await getUserCountry();
        const userAgent = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        
        const gameStats = {
            user_id: tg?.initDataUnsafe?.user?.id || null,
            session_id: sessionId,
            total_votes: votedHeroes.size,
            game_duration: gameDuration,
            user_agent: isMobile ? 'mobile' : 'desktop',
            country_code: country
        };

        // Сохраняем сессию
        const { error: sessionError } = await supabase
            .from('game_sessions')
            .insert([gameStats]);

        // Сохраняем активность голосований
        await saveVoteActivity();
        
        // Обновляем статистику игрока
        await updatePlayerStats();
        
    } catch (error) {
        // Тихий fail - статистика не должна ломать игру
    }
}

// Сохраняем активность голосований
async function saveVoteActivity() {
    const userId = tg?.initDataUnsafe?.user?.id;
    if (!userId) return;

    try {
        const { error } = await supabase
            .from('vote_activity')
            .insert([{
                user_id: userId,
                votes_count: votedHeroes.size,
                created_at: new Date().toISOString().split('T')[0]
            }]);
    } catch (error) {
        // Тихий fail
    }
}

// Статистика игрока
async function updatePlayerStats() {
    const userId = tg?.initDataUnsafe?.user?.id;
    if (!userId) return;

    try {
        // Проверяем существующего игрока
        const { data: existingPlayer, error: fetchError } = await supabase
            .from('player_sessions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (fetchError || !existingPlayer) {
            // Новый игрок
            const { error: insertError } = await supabase
                .from('player_sessions')
                .insert([{
                    user_id: userId,
                    first_seen: new Date().toISOString().split('T')[0],
                    last_seen: new Date().toISOString().split('T')[0],
                    total_games: 1,
                    total_score: playerScore,
                    best_score: playerScore
                }]);
        } else {
            // Обновляем существующего
            const { error: updateError } = await supabase
                .from('player_sessions')
                .update({
                    last_seen: new Date().toISOString().split('T')[0],
                    total_games: (existingPlayer.total_games || 0) + 1,
                    total_score: (existingPlayer.total_score || 0) + playerScore,
                    best_score: Math.max(existingPlayer.best_score || 0, playerScore)
                })
                .eq('user_id', userId);
        }
    } catch (error) {
        // Тихий fail
    }
}

// Получение страны пользователя
async function getUserCountry() {
    try {
        // Для Telegram Web App
        if (tg?.initDataUnsafe?.user?.language_code) {
            const lang = tg.initDataUnsafe.user.language_code;
            return lang.split('-')[1] || lang;
        }
        return 'unknown';
    } catch (error) {
        return 'unknown';
    }
}



// Initialize Telegram Web App
function initTelegram() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        tg = Telegram.WebApp;
        
        // ВСЕГДА расширяем на полный экран
        tg.expand();
        
        // Добавляем класс для специфичных стилей
        document.body.classList.add('tg-webapp');
        
        // Даем время на инициализацию перед расширением
        setTimeout(() => {
            tg.expand();
            
            // Дополнительное расширение через небольшой таймаут
            setTimeout(() => {
                if (!tg.isExpanded) {
                    tg.expand();
                }
            }, 200);
        }, 100);
        
        tg.enableClosingConfirmation();
        tg.setHeaderColor('#1a1a2e');
        tg.setBackgroundColor('#1a1a2e');
        tg.BackButton.hide();
        
        tg.onEvent('viewportChanged', (data) => {
            if (data && data.isStateStable && !data.isExpanded) {
                // Автоматически расширяемся обратно
                setTimeout(() => {
                    tg.expand();
                }, 50);
            }
        });
    } else {
        setupBrowserExit();
    }
}



function setupBrowserExit() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (confirm('Exit the game?')) {
                window.history.back();
            }
        }
    });
}

// Функции для управления силой голоса
function calculateVotePower() {
    checkDailyBonus();
    totalVotePower = dailyVotePower + gameVotePower;
    return totalVotePower;
}

function checkDailyBonus() {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('lastPlayDate');
    
    if (!savedDate) {
        // Первый запуск
        dailyVotePower = 1;
        lastPlayDate = today;
        localStorage.setItem('lastPlayDate', today);
        localStorage.setItem('dailyVotePower', '1');
        return;
    }
    
    if (savedDate === today) {
        // Уже играли сегодня - восстанавливаем силу
        dailyVotePower = parseInt(localStorage.getItem('dailyVotePower')) || 1;
    } else {
        // Новый день - проверяем последовательность
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toDateString();
        
        if (savedDate === yesterdayString) {
            // Играли вчера - увеличиваем бонус
            dailyVotePower = Math.min((parseInt(localStorage.getItem('dailyVotePower')) || 1) + 1, MAX_DAILY_BONUS);
        } else {
            // Пропустили день - сбрасываем до 1
            dailyVotePower = 1;
        }
        
        lastPlayDate = today;
        localStorage.setItem('lastPlayDate', today);
        localStorage.setItem('dailyVotePower', dailyVotePower.toString());
    }
}

// Функции для управления силой голоса - ЗАМЕНИТЬ функцию
function updateGameVotePower() {
    // Каждые BONUS_PER_GAME_PAIR угаданных пар добавляем +1 к игровой силе
    const newGamePower = Math.floor(pairsGuessed / BONUS_PER_GAME_PAIR);
    
    if (newGamePower !== gameVotePower) {
        gameVotePower = Math.min(newGamePower, MAX_GAME_BONUS);
        calculateVotePower();
    }
}

function resetGameVotePower() {
    gameVotePower = 0;
    pairsGuessed = 0; // ← ДОБАВИТЬ сброс счетчика пар
    calculateVotePower();
}

// Умный мониторинг сети
function initNetworkMonitoring() {
    // Слушаем нативные события браузера
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Проверяем при взаимодействии с пользователем
    document.addEventListener('click', debouncedNetworkCheck);
    document.addEventListener('touchstart', debouncedNetworkCheck);
    
    // Периодическая проверка только при активной сессии
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            checkNetworkWithTimeout();
        }
    }, 30000); // 1 раз в 30 секунд
}

// Обработчик появления сети
function handleOnline() {
    if (networkErrorShown) {
        hideNetworkError();
        // Автоматическое восстановление
        if (gameActive && !currentHeroes.length) {
            displayHeroes();
        }
    }
    networkErrorShown = false;
}

// Обработчик потери сети
function handleOffline() {
    if (!networkErrorShown) {
        showNetworkError();
    }
}

// Проверка сети с таймаутом
function checkNetworkWithTimeout() {
    if (!navigator.onLine && !networkErrorShown) {
        setTimeout(() => {
            if (!navigator.onLine && document.visibilityState === 'visible') {
                showNetworkError();
            }
        }, 2000);
    }
}

// Задержка для избежания частых проверок
function debouncedNetworkCheck() {
    if (networkErrorShown) return;
    
    clearTimeout(window.networkDebounce);
    window.networkDebounce = setTimeout(() => {
        if (!navigator.onLine && !networkErrorShown) {
            showNetworkError();
        }
    }, 1000);
}

function showNetworkError() {
    if (document.querySelector('.universal-popup.active') || networkErrorShown) return;
    
    networkErrorShown = true;
    const texts = getText('NETWORK_ERROR');
    
    const popup = document.createElement('div');
    popup.className = 'universal-popup popup-network-error active';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-network-error-icon">📶</div>
            <h2>${texts.TITLE}</h2>
            <p>${texts.DESCRIPTION}</p>
            <p style="font-size: 14px; margin-top: 10px; opacity: 0.8;">
                ${texts.SUBTEXT}
            </p>
            <button id="popup-understand-network">${texts.BUTTON}</button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    document.getElementById('popup-understand-network').addEventListener('click', function() {
        popup.remove();
        networkErrorShown = false;
    });
    
    document.querySelectorAll('.hero-card').forEach(card => {
        card.style.pointerEvents = 'none';
    });
}

// Функция скрытия ошибки сети
function hideNetworkError() {
    const popup = document.querySelector('.popup-network-error');
    if (popup) {
        popup.remove();
        networkErrorShown = false;
    }
    
    // Восстанавливаем игровые элементы
    document.querySelectorAll('.hero-card').forEach(card => {
        card.style.pointerEvents = '';
    });
}

function loadProgress() {
    try {
        const savedStats = localStorage.getItem('heroGameStats');
        
        if (savedStats) {
            const stats = JSON.parse(savedStats);
            
            // Восстанавливаем общую статистику
            maxScore = stats.maxScore || 0;
            totalGames = stats.totalGames || 0;
            totalPairsGuessedOverall = stats.totalPairsGuessed || 0;
            totalPairsShownOverall = stats.totalPairsShown || 0;
        } else {
            // Если данных нет — инициализируем нулями
            maxScore = 0;
            totalGames = 0;
            totalPairsGuessedOverall = 0;
            totalPairsShownOverall = 0;
        }

        // Сбрасываем только текущую игру
        playerLives = INITIAL_PLAYER_LIVES;
        playerScore = 0;
        pairsGuessed = 0;
        currentGamePairsShown = 0;
        votedHeroes = new Set();

        updateUI();
    } catch (error) {
        console.error("Ошибка при загрузке прогресса:", error);

        playerLives = INITIAL_PLAYER_LIVES;
        playerScore = 0;
        pairsGuessed = 0;
        currentGamePairsShown = 0;
        votedHeroes = new Set();

        maxScore = 0;
        totalGames = 0;
        totalPairsGuessedOverall = 0;
        totalPairsShownOverall = 0;
    }
}


// Save progress - ТОЛЬКО ДЛЯ МАКСИМАЛЬНОГО СЧЕТА
function saveProgress() {
    try {
        localStorage.setItem('heroGameStats', JSON.stringify({
            maxScore: Math.max(maxScore, playerScore)
        }));
        updateUI();
    } catch (error) {
        // Убраны console.log для продакшена
    }
}

function updateUI() {
    const scoreElement = document.getElementById('player-score');
    if (scoreElement) scoreElement.textContent = playerScore;
    
    if (!isVotingInProgress) {
        updateLivesDisplay();
    }
}

function updateLivesDisplay() {
    const globalLives = document.getElementById('global-lives');
    
    if (globalLives) {
        globalLives.innerHTML = '';
        
        for (let i = 0; i < playerLives; i++) {
            const star = document.createElement('div');
            star.className = 'life-star';
            globalLives.appendChild(star);
        }
    }
}

// Get publisher logo URL
function getPublisherLogoUrl(publisherName) {
    if (!publisherName) return null;
    
    const lowerName = publisherName.toLowerCase().trim();
    return PUBLISHER_LOGOS[lowerName] || null;
}

// Load all heroes
// Load all heroes
async function loadAllHeroes() {
    try {
        let { data, error } = await supabase
            .from("Heroes_Table")
            .select("id, name, image_url, rating, good_bad, publisher");
            

        if (error) throw error;
        if (!data || data.length === 0) return;

        allHeroes = data.map(hero => ({
            ...hero,
            logo_url: getPublisherLogoUrl(hero.publisher)
        }));
        
        loadProgress();
        startGame();
        
    } catch (error) {
       
    }
}

function startGame() {
    gameActive = true;
    gameStartTime = Date.now();
    sessionId = generateSessionId();
    displayHeroes();
    updateUI();
}

function getRandomHeroes() {
    if (allHeroes.length < 2) return null;

    // ОДИН РАЗ перемешиваем массив в начале игры
    if (!window.shuffledHeroes || window.shuffledHeroes.length < 2 || !window.initialShuffleDone) {
        window.shuffledHeroes = [...allHeroes].sort(() => Math.random() - 0.5);
        
        // ДОБАВЛЯЕМ ЗДЕСЬ: определяем отражение для каждого героя при перемешивании
        window.shuffledHeroes.forEach(hero => {
            hero.shouldFlip = shouldFlipHero(hero);
        });
        
        window.currentHeroIndex = 0;
        window.initialShuffleDone = true;
    }
    
    // Если дошли до конца массива - показываем экран завершения
    if (window.currentHeroIndex >= window.shuffledHeroes.length - 1) {
        showCompletionScreen();
        return null;
    }
    
    // Берем последовательно пары из перемешанного массива
    const selected = [
        window.shuffledHeroes[window.currentHeroIndex],
        window.shuffledHeroes[window.currentHeroIndex + 1]
    ];
    
    window.currentHeroIndex += 2;
    
    return selected;
}

// Обновить showCompletionScreen
function showCompletionScreen() {
    const texts = getText('COMPLETION');
    
    const totalVotes = votedHeroes.size;
    const correctVotes = playerScore;
    const gameWinRate = totalVotes > 0 ? ((correctVotes / totalVotes) * 100).toFixed(1) : 0;

    const popup = document.createElement('div');
    popup.className = 'universal-popup active';
    popup.innerHTML = `
        <div class="popup-content">
            <h2>${texts.TITLE}</h2>
            <p>${texts.DESCRIPTION}</p>
            <div class="popup-stats-container">
                <div class="popup-stat-item">
                    <span class="popup-stat-label">${texts.SCORE}:</span>
                    <span class="popup-stat-value score">${playerScore}</span>
                </div>
                <div class="popup-stat-item">
                    <span class="popup-stat-label">${texts.BEST}:</span>
                    <span class="popup-stat-value best">${maxScore}</span>
                </div>
                <div class="popup-stat-item">
                    <span class="popup-stat-label">${texts.GAME_WINRATE}:</span>
                    <span class="popup-stat-value">${correctVotes}/${totalVotes} (${gameWinRate}%)</span>
                </div>
            </div>
            <button id="popup-complete-restart">${texts.BUTTON}</button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    document.getElementById('popup-complete-restart').addEventListener('click', function() {
        popup.remove();
        resetGame();
    });

    saveGameStats('completion');
    playHaptic('win');
}


// Preload next pair
function preloadNextPair() {
    const nextPair = getRandomHeroes();
    if (!nextPair) return;
    nextHeroes = nextPair;
    nextPair.forEach(hero => {
        if (hero.image_url) new Image().src = hero.image_url;
        if (hero.logo_url) new Image().src = hero.logo_url;
    });
}

// Hide all overlays
function hideAllOverlays() {
    const overlays = document.querySelectorAll('.hero-result-overlay');
    const starContainers = document.querySelectorAll('.star-rating-container');
    
    overlays.forEach(overlay => {
        overlay.classList.remove('show', 'win', 'lose');
        const percentElement = overlay.querySelector('.result-rating-percent');
        if (percentElement) percentElement.textContent = '';
        const sprite = overlay.querySelector('.result-sprite');
        if (sprite) sprite.style.backgroundImage = '';
    });
    
    starContainers.forEach(container => {
        container.classList.remove('show');
        const percentElement = container.querySelector('.star-rating-percent');
        if (percentElement) {
            percentElement.textContent = '';
            percentElement.innerHTML = '';
        }
    });
    
    const smokeEffects = document.querySelectorAll('.smoke-effect');
    smokeEffects.forEach(smoke => smoke.classList.remove('show'));
}

// Оптимизированная функция показа результатов
function showVoteResult(heroNumber, userWon, selectedRating, otherRating) {
    const selectedHero = heroNumber;
    const otherHero = heroNumber === 1 ? 2 : 1;
    
    const selectedResult = document.getElementById(`hero${selectedHero}-result`);
    const otherResult = document.getElementById(`hero${otherHero}-result`);
    
    if (userWon) {
        showResultImage(selectedResult, 'win');
        showResultImage(otherResult, 'lose');
        
        showStarRating(selectedHero, selectedRating, true);
        showStarRating(otherHero, otherRating, false);
    } else {
        showResultImage(selectedResult, 'lose');
        showResultImage(otherResult, 'win');
        
        showStarRating(selectedHero, selectedRating, false);
        showStarRating(otherHero, otherRating, true);
    }
}

// Оптимизированная функция скрытия анимаций
function hideAnimations() {
    AnimationManager.requestAnimationFrame(() => {
        const overlays = document.querySelectorAll('.hero-result-overlay.show');
        const starContainers = document.querySelectorAll('.star-rating-container.show');
        
        overlays.forEach(overlay => {
            overlay.classList.remove('show');
            overlay.classList.add('hiding');
        });
        
        starContainers.forEach(container => {
            container.classList.remove('show');
            container.classList.add('hiding');
        });
        
        AnimationManager.setTimeout(() => {
            overlays.forEach(overlay => overlay.classList.remove('hiding'));
            starContainers.forEach(container => container.classList.remove('hiding'));
        }, 600);
    });
}

// Оптимизированная функция показа изображения результата
function showResultImage(element, type) {
    if (!element) return;
    
    const sprite = element.querySelector('.result-sprite');
    const percentElement = element.querySelector('.result-rating-percent');
    
    if (!sprite) return;
    
    if (type === 'win') {
        sprite.style.backgroundImage = "url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Win.webp')";
    } else {
        sprite.style.backgroundImage = "url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Lose.webp')";
    }
    
    if (percentElement) {
        percentElement.textContent = '';
    }
    
    element.className = `hero-result-overlay show ${type}`;
    
    AnimationManager.setTimeout(() => {
        element.classList.add('show');
    }, 50);
}

// Get hero alignment
function getHeroAlignment(goodBad) {
    switch(goodBad) {
        case 1: return { 
            imageUrl: 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/hero.webp',
            alt: 'HERO'
        };
        case 2: return { 
            imageUrl: 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/evil.webp',
            alt: 'EVIL'
        };
        case 3: return { 
            imageUrl: 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/anti_hero.webp',
            alt: 'ANTI HERO'
        };
        default: return { 
            imageUrl: null,
            alt: 'UNKNOWN'
        };
    }
}

// Оптимизированная функция отображения героев
function displayHeroes() {
    if (!gameActive) return;
    
    isVotingInProgress = false;
    currentVotePairId = null;
    
    // Очищаем все анимации
    AnimationManager.clearAll();
    
    // Скрываем все анимации
    hideAllOverlays();
    hideAnimations();
    
    if (nextHeroes.length === 2) {
        currentHeroes = nextHeroes;
        nextHeroes = [];
    } else {
        currentHeroes = getRandomHeroes();
    }
    
    if (!currentHeroes) return;
    
    preloadNextPair();
    
    // Используем DocumentFragment для батч-обновления DOM
    currentHeroes.forEach((hero, index) => {
        const heroNum = index + 1;
        const imgElement = document.getElementById(`hero${heroNum}-img`);
        const nameElement = document.getElementById(`hero${heroNum}-name`);
        const publisherElement = document.getElementById(`hero${heroNum}-publisher`);
        const alignmentElement = document.getElementById(`hero${heroNum}-alignment`);
        
        // Set hero image
        if (imgElement) imgElement.src = hero.image_url;

        // Используем предопределенное значение shouldFlip
        if (hero.shouldFlip) {
            imgElement.style.transform = 'scaleX(-1)';
        } else {
            imgElement.style.transform = 'scaleX(1)';
        }
        
        // Set hero name с оптимизацией
        if (nameElement) {
            nameElement.textContent = hero.name;
            // ВОЗВРАЩАЕМ рабочие inline стили
            if (hero.name.length > 15) {
                nameElement.style.fontSize = 'clamp(14px, 3vw, 20px)';
            } else if (hero.name.length > 10) {
                nameElement.style.fontSize = 'clamp(16px, 4vw, 24px)';
            } else {
                nameElement.style.fontSize = 'clamp(18px, 5vw, 28px)';
            }
        }
        
        // Set alignment
        if (alignmentElement) {
            const alignment = getHeroAlignment(hero.good_bad);
            alignmentElement.innerHTML = '';
            if (alignment.imageUrl) {
                const alignmentImg = document.createElement('img');
                alignmentImg.src = alignment.imageUrl;
                alignmentImg.alt = alignment.alt;
                alignmentImg.className = 'alignment-image';
                alignmentImg.loading = 'lazy';
                alignmentElement.appendChild(alignmentImg);
            }
        }
        
        // Set publisher logo
        if (publisherElement) {
            publisherElement.innerHTML = '';
            if (hero.logo_url) {
                const logoImg = document.createElement('img');
                logoImg.src = hero.logo_url;
                logoImg.alt = hero.publisher || 'Publisher';
                logoImg.className = 'publisher-logo';
                logoImg.loading = 'lazy';
                publisherElement.appendChild(logoImg);
            }
        }
    });
}

// Оптимизированная функция голосования
async function vote(heroNumber) {
    if (!gameActive || !currentHeroes || currentHeroes.length < 2 || 
        playerLives <= 0 || isVotingInProgress) {
        return;
    }
    
    isVotingInProgress = true;
    indicateSelection(heroNumber);
    
    const selectedHero = currentHeroes[heroNumber - 1];
    const otherHero = heroNumber === 1 ? currentHeroes[1] : currentHeroes[0];
    
    const votePairId = `${selectedHero.id}-${otherHero.id}`;
    
    if (currentVotePairId === votePairId) {
        isVotingInProgress = false;
        return;
    }
    
    currentVotePairId = votePairId;
    
    const userMadeRightChoice = selectedHero.rating > otherHero.rating;
    
    //totalPairsShown++;       // Общая статистика (все игры)
    currentGamePairsShown++; // Только текущая игра
    
    if (userMadeRightChoice) {
        votePowerPairs++; 
    }
    
    playHaptic('selection');
    
    // Обновляем силу голоса перед анимацией
    updateGameVotePower();
    const currentPower = totalVotePower;
    
    // Анимация с текущей силой голоса
    AnimationManager.setTimeout(() => {
        if (userMadeRightChoice) {
            playSmokeAnimation(`hero${heroNumber}-blue-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/BlueSMoke256.webp");
            playSmokeAnimation(`hero${heroNumber === 1 ? 2 : 1}-gray-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/RedSmoke256.webp");
            playHaptic('correct');
        } else {
            playSmokeAnimation(`hero${heroNumber}-gray-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/RedSmoke256.webp");
            playSmokeAnimation(`hero${heroNumber === 1 ? 2 : 1}-blue-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/BlueSMoke256.webp");
            playHaptic('wrong');
        }
    }, 0);
    
    showVoteResult(heroNumber, userMadeRightChoice, selectedHero.rating, otherHero.rating);

    // Анимация цифр с СИЛОЙ ГОЛОСА
    if (event) {
        const clickX = event.clientX || event.touches[0].clientX;
        const clickY = event.clientY || event.touches[0].clientY;
        
        AnimationManager.setTimeout(() => {
            ScoreEmitter.emitFromPoint(clickX, clickY, 4, `+${currentPower}`);
        }, 0);
    }
    
    // УБИРАЕМ ДУБЛИРОВАНИЕ - оставляем только ОДИН таймаут для обновления жизней
    AnimationManager.setTimeout(() => {
        if (!userMadeRightChoice) {
            playerLives--;
            updateLivesWithAnimation();
            updateUI();
        }
    }, HERO_DISPLAY_DURATION - 500);

    // Обновляем статистику с СИЛОЙ ГОЛОСА
    AnimationManager.setTimeout(() => {
        if (userMadeRightChoice) {
            // ДОБАВЛЯЕМ ОЧКИ ПО СИЛЕ ГОЛОСА
            playerScore += currentPower;
            pairsGuessed++; // ← ДОБАВИТЬ ЭТУ СТРОКУ: увеличиваем счетчик пар
            updateUI();
            // Обновляем игровую силу после увеличения счета
            updateGameVotePower();
        }
        
        votedHeroes.add(selectedHero.id);
        votedHeroes.add(otherHero.id);
        saveProgress();
        
        // ОБНОВЛЯЕМ СТАТИСТИКУ В БАЗУ: ВСЕГДА записываем победу выбранному герою
        updateHeroStatsAsync(selectedHero.id, otherHero.id, currentPower);
    }, HERO_DISPLAY_DURATION);
    
    AnimationManager.setTimeout(() => {
        hideAnimations();
    }, HERO_DISPLAY_DURATION - 500);
    
    AnimationManager.setTimeout(() => {
        isVotingInProgress = false;
        currentVotePairId = null;
        
        if (playerLives <= 0) {
            AnimationManager.setTimeout(() => {
                gameOver();
            }, 500);
        } else if (gameActive) {
            displayHeroes();
        }
    }, HERO_DISPLAY_DURATION);
}

// Оптимизированная функция показа звездного рейтинга
function showStarRating(heroNumber, rating, isWinner) {
    const starContainer = document.getElementById(`hero${heroNumber}-star-rating`);
    const starImage = starContainer.querySelector('.rating-star');
    const percentElement = starContainer.querySelector('.star-rating-percent');
    
    if (!starContainer || !starImage || !percentElement) return;
    
    starImage.src = isWinner 
        ? 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/StarBlue.webp'
        : 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/StarRed.webp';
    
    percentElement.innerHTML = '';
    
    const ratingText = `${rating.toFixed(1)}`.replace('.', ',');
    convertToImageBasedDigits(percentElement, ratingText);
    
    starContainer.classList.remove('show', 'hiding');
    
    AnimationManager.setTimeout(() => {
        starContainer.classList.add('show');
    }, 50);
}

// Оптимизированная функция обновления жизней
function updateLivesWithAnimation() {
    const globalLives = document.getElementById('global-lives');
    if (!globalLives) return;
    
    const lifeStars = globalLives.querySelectorAll('.life-star');
    if (lifeStars.length > 0) {
        const lastLifeStar = lifeStars[lifeStars.length - 1];
        
        // Используем CSS transitions вместо JS анимаций
        lastLifeStar.classList.remove('life-star-removing');
        
        // Принудительный reflow только один раз
        void lastLifeStar.offsetWidth;
        
        lastLifeStar.classList.add('life-star-removing');
        
        AnimationManager.setTimeout(() => {
            if (lastLifeStar.parentNode === globalLives && lastLifeStar.classList.contains('life-star-removing')) {
                globalLives.removeChild(lastLifeStar);
            }
        }, 400);
    }
}

// Оптимизированная функция создания цифр из картинок
function convertToImageBasedDigits(element, text) {
    // Создаем DocumentFragment для батч-вставки
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const digitSpan = document.createElement('span');
        
        if (char === ',' || char === '.') {
            digitSpan.className = 'digit comma';
            digitSpan.style.backgroundImage = `url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Numbers/dot.webp')`;
        } else if (!isNaN(char) && char !== ' ') {
            digitSpan.className = 'digit';
            digitSpan.style.backgroundImage = `url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Numbers/${char}.webp')`;
        }
        
        fragment.appendChild(digitSpan);
    }
    
    // Один раз обновляем DOM
    element.appendChild(fragment);
}

// Async stats update
async function updateHeroStatsAsync(winnerId, loserId, votePower = 1) {
    try {
        const { data: winnerData, error: winnerFetchError } = await supabase
            .from('Heroes_Table')
            .select('wins, viewers')
            .eq('id', winnerId)
            .single();
            
        const { data: loserData, error: loserFetchError } = await supabase
            .from('Heroes_Table')
            .select('loses, viewers')
            .eq('id', loserId)
            .single();
        
        if (winnerFetchError || loserFetchError) return;
        
        const { error: winnerError } = await supabase
            .from('Heroes_Table')
            .update({ 
                wins: (winnerData.wins || 0) + votePower, // Умножаем на силу голоса
                viewers: (winnerData.viewers || 0) + 1
            })
            .eq('id', winnerId);
        
        const { error: loserError } = await supabase
            .from('Heroes_Table')
            .update({ 
                loses: (loserData.loses || 0) + votePower, // Умножаем на силу голоса
                viewers: (loserData.viewers || 0) + 1
            })
            .eq('id', loserId);
            
    } catch (error) {
        // Убраны console.log для продакшена
    }
}

// Оптимизированная анимация дыма с использованием CSS анимаций
function playSmokeAnimation(elementId, spriteUrl) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const animationId = `${elementId}-${Date.now()}`;
    AnimationManager.addSmokeAnimation(animationId);
    
    // Сбрасываем стили
    el.style.backgroundImage = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -50%) scale(0.65)';
    
    AnimationManager.setTimeout(() => {
        if (!AnimationManager.smokeAnimations.has(animationId)) return;
        
        el.style.backgroundImage = `url(${spriteUrl})`;
        el.style.backgroundSize = '1280px 1280px';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = '0px 0px';
        el.style.opacity = '1';
        el.classList.add("show");
        
        let frame = 0;
        const frameSize = 256;
        const framesPerRow = 5;
        const totalFrames = 25;
        
        const slowFrames = 10;
        const fastFrames = 15;
        
        const slowFrameTime = 60;
        const fastFrameTime = 30;
        
        let currentInterval = slowFrameTime;
        
        function animateFrame() {
            if (!AnimationManager.smokeAnimations.has(animationId) || frame >= totalFrames) {
                AnimationManager.removeSmokeAnimation(animationId);
                AnimationManager.setTimeout(() => {
                    el.classList.remove("show");
                    el.style.opacity = '0';
                    AnimationManager.setTimeout(() => {
                        el.style.backgroundImage = 'none';
                    }, 200);
                }, HERO_DISPLAY_DURATION - 300 - (totalFrames * (slowFrameTime + fastFrameTime) / 2));
                return;
            }
            
            const col = frame % framesPerRow;
            const row = Math.floor(frame / framesPerRow);
            
            const x = -col * frameSize;
            const y = -row * frameSize;
            
            // Используем transform для hardware acceleration
            el.style.backgroundPosition = `${x}px ${y}px`;
            
            // Оптимизация для разных размеров экранов
            if (window.innerWidth >= 769) {
                if (frame < 2) {
                    const scale = 0.50 + (frame * 0.03);
                    el.style.transform = `translate(-50%, -55%) scale(${scale})`;
                }
                if (frame > 1) {
                    el.style.transform = `translate(-50%, -50%) scale(1.3)`;
                }
            } else {
                if (frame < 2) {
                    const scale = 0.40 + (frame * 0.02);
                    el.style.transform = `translate(-50%, -55%) scale(${scale})`;
                }
                if (frame > 1) {
                    el.style.transform = `translate(-50%, -50%) scale(0.8)`;
                }
            }
            
            frame++;
            
            if (frame === slowFrames) {
                currentInterval = fastFrameTime;
            }
            
            // Используем менеджер анимаций для предотвращения утечек
            AnimationManager.setTimeout(animateFrame, currentInterval);
        }
        
        animateFrame();
        
    }, 50);
}

function indicateSelection(heroNumber) {
    const container = document.querySelector(`#hero${heroNumber}`).closest('.hero-complete-container');
    if (!container) return;
    
    container.classList.add('selected');
    
    AnimationManager.setTimeout(() => {
        container.classList.remove('selected');
    }, 300);
}

// Улучшенная функция вибрации
function playHaptic(type) {
    if (tg && tg.HapticFeedback) {
        try {
            switch(type) {
                case 'selection': 
                    tg.HapticFeedback.impactOccurred('light');
                    break;
                case 'correct':
                    tg.HapticFeedback.impactOccurred('heavy');
                    break;
                case 'wrong':
                    tg.HapticFeedback.impactOccurred('medium');
                    break;
                case 'game_over':
                    tg.HapticFeedback.notificationOccurred('error');
                    break;
                case 'win':
                    tg.HapticFeedback.notificationOccurred('success');
                    break;
            }
            return;
        } catch (e) {
            // Fallback silently
        }
    }
    
    if (navigator.vibrate) {
        switch(type) {
            case 'selection': navigator.vibrate(50); break;
            case 'correct': navigator.vibrate([50, 30, 50]); break;
            case 'wrong': navigator.vibrate(100); break;
            case 'game_over': navigator.vibrate([100, 50, 100]); break;
            case 'win': navigator.vibrate([50, 30, 50, 30, 50]); break;
        }
    }
}

// Обновить showCopyrightDisclaimer - убрать автоматический показ правил
function showCopyrightDisclaimer() {
    setTimeout(() => {
        const texts = getText('DISCLAIMER');
        const popup = document.createElement('div');
        popup.className = 'universal-popup active';
        popup.innerHTML = `
            <div class="popup-content">
                <h2>${texts.TITLE}</h2>
                <div class="popup-disclaimer-content">
                    <div class="popup-disclaimer-text">
                        ${texts.LEGAL}
                    </div>
                    <div class="popup-rights-notice">
                        ${texts.RIGHTS_HOLDERS}
                    </div>
                </div>
                <button id="popup-understand-button">${texts.BUTTON}</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        document.getElementById('popup-understand-button').addEventListener('click', function() {
            popup.remove();
            document.body.style.opacity = '1';
            // ПОСЛЕ ДИСКЛЕЙМЕРА ПОКАЗЫВАЕМ ПРАВИЛА (только при первом запуске)
            setTimeout(() => {
                showRulesPopup();
            }, 0);
        });
    }, 0);
}

// Обновить showRulesPopup - убрать авто-показ
function showRulesPopup() {
    setTimeout(() => {
        if (document.querySelector('.universal-popup.active')) return;
        
        const texts = getText('RULES');
        const popup = document.createElement('div');
        popup.className = 'universal-popup active';
        popup.innerHTML = `
            <div class="popup-content">
                <h2>${texts.TITLE}</h2>
                <div class="popup-rules-content">
                    <div class="popup-rules-text">
                        ${texts.RULES_LIST}
                    </div>
                </div>
                <button id="popup-rules-button">${texts.BUTTON}</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        document.getElementById('popup-rules-button').addEventListener('click', function() {
            popup.remove();
            document.body.style.opacity = '1';
        });
    }, 50);
}

function showGameOverPopup() {
    const texts = getText('GAME_OVER');
    
    // Текущая игра
    const gamePairsGuessed = pairsGuessed;
    const gamePairsTotal = currentGamePairsShown;
    const gameWinRate = gamePairsTotal > 0 
        ? ((gamePairsGuessed / gamePairsTotal) * 100).toFixed(1) 
        : 0;
    
    // Обновляем общие данные
    totalGames += 1;
    totalPairsGuessedOverall += gamePairsGuessed;
    totalPairsShownOverall += gamePairsTotal;
    maxScore = Math.max(maxScore, playerScore);

    // Пересчёт общего винрейта
    const overallWinRate = totalPairsShownOverall > 0 
        ? ((totalPairsGuessedOverall / totalPairsShownOverall) * 100).toFixed(1) 
        : 0;
    
    // Сохраняем в localStorage
    localStorage.setItem('heroGameStats', JSON.stringify({
        maxScore: maxScore,
        totalGames: totalGames,
        totalPairsGuessed: totalPairsGuessedOverall,
        totalPairsShown: totalPairsShownOverall
    }));

    // Создание popup
    const popup = document.createElement('div');
    popup.className = 'universal-popup active';
    popup.innerHTML = `
        <div class="popup-content">
            <h2>${texts.TITLE}</h2>
            <div class="popup-stats-container">
                <div class="popup-stat-item">
                    <span class="popup-stat-label">${texts.SCORE}:</span>
                    <span class="popup-stat-value score">${playerScore}</span>
                </div>
                <div class="popup-stat-item">
                    <span class="popup-stat-label">${texts.BEST}:</span>
                    <span class="popup-stat-value best">${maxScore}</span>
                </div>
                <div class="popup-stat-item">
                    <span class="popup-stat-label">${texts.GAME_WINRATE}:</span>
                    <span class="popup-stat-value">${gamePairsGuessed}/${gamePairsTotal} (${gameWinRate}%)</span>
                </div>
                <div class="popup-stat-item">
                    <span class="popup-stat-label">${texts.OVERALL_WINRATE}:</span>
                    <span class="popup-stat-value">${totalPairsGuessedOverall}/${totalPairsShownOverall} (${overallWinRate}%)</span>
                </div>
                <div class="popup-stat-item">
                    <span class="popup-stat-label">${texts.TOTAL_GAMES}:</span>
                    <span class="popup-stat-value">${totalGames}</span>
                </div>
            </div>
            <button id="popup-restart-button">${texts.BUTTON}</button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    document.getElementById('popup-restart-button').addEventListener('click', function() {
        popup.remove();
        resetGame();
    });
    
    playHaptic('game_over');
}

// Обнови функцию gameOver
function gameOver() {
    gameActive = false;
    maxScore = Math.max(maxScore, playerScore);
    saveProgress();
    
    // Сохраняем статистику
    saveGameStats('game_over');
    
    playHaptic('game_over');
    AnimationManager.setTimeout(() => {
        showGameOverPopup();
    }, 1000);
}

function resetGame() {
    // ОЧИЩАЕМ ВСЕ ПОПАПЫ ПЕРЕД НОВОЙ ИГРОЙ
    document.querySelectorAll('.universal-popup').forEach(popup => popup.remove());
    
    playerLives = INITIAL_PLAYER_LIVES;
    playerScore = 0;
    pairsGuessed = 0;
    votePowerPairs = 0;
    currentGamePairsShown = 0; // ← Сбрасываем только для текущей игры!
   
    votedHeroes.clear();
    isVotingInProgress = false;
    currentVotePairId = null;
    gameActive = true;
    
    resetGameVotePower();
    
    // ФИКС: ПОЛНОСТЬЮ сбрасываем кеш перемешанных героев для новой игры
    window.shuffledHeroes = null;
    window.currentHeroIndex = 0;
    window.initialShuffleDone = false;
    
    localStorage.removeItem('heroVoteProgress');
    
    AnimationManager.clearAll();
    ScoreEmitter.clear();
    
    updateUI();
    displayHeroes();
}


// Обновите обработчик DOMContentLoaded
document.addEventListener("DOMContentLoaded", function() {
    initTelegram();

    // ИНИЦИАЛИЗИРУЕМ СИЛУ ГОЛОСА ПЕРЕД СБРОСОМ ИГРЫ
    calculateVotePower();
    
    // ВСЕГДА сбрасываем игру при загрузке (анти-читерство)
    resetGame();
    loadAllHeroes();
    initNetworkMonitoring();

    // Проверяем первый запуск
    const firstRunCompleted = localStorage.getItem(FIRST_RUN_KEY);
    
    setTimeout(() => {
        if (!firstRunCompleted) {
            showCopyrightDisclaimer();
            // Помечаем что первый запуск завершен
            localStorage.setItem(FIRST_RUN_KEY, 'true');
        } else {
            // Если уже запускались - сразу показываем игру
            document.body.style.opacity = '1';
        }
    }, 1000);

    
    
    ScoreEmitter.init();

    // Hide unnecessary elements
    const elementsToHide = [
        'header h1',
        'header p',
        '.progress-container',
        '.rating-notice',
        'footer'
    ];
    
    elementsToHide.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) element.style.display = 'none';
    });
});



// Escape handler
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (confirm('Exit the game?')) {
            if (tg && tg.close) {
                tg.close();
            } else {
                window.history.back();
            }
        }
    }
    
    // F5 для перезагрузки с полным сбросом
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        resetGame();
    }
});

window.vote = vote;