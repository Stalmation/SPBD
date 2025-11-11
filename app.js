
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
const MAX_GAME_BONUS = 10; // Сила голоса максимальная за одну игру
const BONUS_PER_GAME_PAIR = 10;

// Константа для количества жизней
const INITIAL_PLAYER_LIVES = 5; // ← ДОБАВЬТЕ ЭТУ КОНСТАНТУ

// ==================== КОНСТАНТЫ ДЛЯ БУСТОВ ====================
const MAX_VISIBLE_LIVES = 5; // Максимальное количество отображаемых жизней

// ==================== ПЕРЕМЕННЫЕ ДЛЯ БУСТОВ ====================
let extraLives = 0; // Дополнительные жизни (сверх 5)
let powerBoost = 0; // Временный буст силы голоса для текущей игры
let tablePrefixes = new Map(); // Будет хранить префиксы таблиц

// Добавьте после констант в начале app.js
const HORIZONTAL_FLIP_EXCLUSIONS = [
    'Superman', 'Superboy', 
    'Supergirl', 'Invisible Woman',
    'Winter-Soldier',  'Mr. Fantastic', 'Human Torch', 'Thing', 'Amanda Waller', 'Krypto', 'Robin', 'Damian Wayne','Riddler','Bat In The Sun'
    // Добавьте другие имена как они есть в базе
];

let memeImageCache = new Map(); // Кеш для рандомных изображений мемов
// Добавьте глобальные переменные
let enabledTables = [];

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


// МИНИМАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ:
let memeSettings = {
    enabled: false, // самое важное - по умолчанию мемы выключены
    chance: 0,
    perGame: 0, 
    season: 'default'
};
let allMemes = [];
let memeCardsToAdd = 0;


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
    'bat in the sun': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/bits.webp',
    'bat_in_the_sun': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/bits.webp',
    'Dynamite': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/Dynamite.webp',
    'Burlyman': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/Burlyman.webp',
    'Skybound': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/Skybound.webp',
    'Titan': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/Titan.webp',
    
};


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

        // Устанавливаем позицию
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';

        // === КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: УСТАНАВЛИВАЕМ ПЕРЕМЕННЫЕ ДЛЯ АНИМАЦИИ ===
        const baseOffset = window.innerWidth <= 480 ? 60 : 
                        window.innerWidth <= 768 ? 80 : 100;

        const offsetX = (Math.random() - 0.5) * baseOffset;
        const offsetY = (Math.random() - 0.5) * baseOffset;

        particle.style.setProperty('--offset-x', offsetX);
        particle.style.setProperty('--offset-y', offsetY);

        // === АНИМАЦИЯ ДЛЯ БУСТОВ ===
        if (value.includes('⭐') || value.includes('⚡')) {
            particle.classList.add('large');
            // НЕ ПЕРЕОПРЕДЕЛЯЕМ transform — анимация сама его меняет
            particle.style.animation = 'bubbleFloat 2.5s ease-out forwards';
        }

        // Адаптивные размеры
        const screenWidth = window.innerWidth;
        let sizeClass = '';
        if (screenWidth <= 360) {
            sizeClass = 'size-small';
        } else if (screenWidth <= 480) {
            const sizes = ['size-small', '', 'size-small'];
            sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
        } else if (screenWidth <= 768) {
            const sizes = ['size-small', '', ''];
            sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
        } else {
            const sizes = ['size-small', '', 'size-large'];
            sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
        }

        if (sizeClass) {
            particle.classList.add(sizeClass);
        }

        // Прозрачность и длительность
        const startOpacity = 0.7 + Math.random() * 0.3;
        const moveDuration = screenWidth <= 480 ? 1.0 : 
                            screenWidth <= 768 ? 1.2 : 1.5;

        particle.style.opacity = startOpacity;
        particle.style.animationDuration = moveDuration + 's';

        this.emitter.appendChild(particle);

        // Исчезновение
        const fadeStartTime = (Math.random() * 0.8 + 0.4) * 1000;
        const fadeDuration = (Math.random() * 0.5 + 0.3) * 1000;
        const totalLifeTime = fadeStartTime + fadeDuration;

        AnimationManager.setTimeout(() => {
            particle.style.transition = `opacity ${fadeDuration}ms ease-out`;
            particle.style.opacity = '0';
        }, fadeStartTime);

        AnimationManager.setTimeout(() => {
            if (particle.parentNode === this.emitter) {
                this.emitter.removeChild(particle);
            }
        }, totalLifeTime);
    },
    
    emitFromPoint(x, y, count = 4, text = '+1', options = {}) {
    const { isBoost = false } = options;
    const textStr = String(text);

    // === ЕСЛИ ЭТО БУСТ — БЛОКИРУЕМ ВСЁ, ЧТО НЕ СОДЕРЖИТ ⭐ ИЛИ ⚡ ===
    if (isBoost && !textStr.includes('⭐') && !textStr.includes('⚡')) {
        return; // Блокируем +1, +5, +10 и т.д.
    }

    // === ЕСЛИ ЭТО НЕ БУСТ — БЛОКИРУЕМ ВСЁ С ⭐ ИЛИ ⚡ (на всякий случай) ===
    if (!isBoost && (textStr.includes('⭐') || textStr.includes('⚡'))) {
        return; // Защита от ошибок
    }

    // === Показываем только разрешённые частицы ===
    for (let i = 0; i < count; i++) {
        const randomDelay = Math.random() * 100;
        AnimationManager.setTimeout(() => {
            this.createParticle(x, y, textStr);
        }, i * 20 + randomDelay);
    }
},
    
    // Очистка всех частиц
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

// ==================== ОБНОВЛЕННАЯ ФУНКЦИЯ CALCULATE VOTE POWER ====================
function calculateVotePower() {
    checkDailyBonus();
    
    // ПРИМЕНЯЕМ ЛИМИТ К ОБЩЕЙ СИЛЕ ГОЛОСА (включая временный буст)
    const totalPowerWithoutLimit = dailyVotePower + gameVotePower + powerBoost;
    totalVotePower = Math.min(totalPowerWithoutLimit, MAX_GAME_BONUS);
    
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

// ==================== ОБНОВЛЕННАЯ ФУНКЦИЯ UPDATE GAME VOTE POWER ====================
function updateGameVotePower() {
    // Каждые BONUS_PER_GAME_PAIR угаданных пар добавляем +1 к игровой силе
    const newGamePower = Math.floor(pairsGuessed / BONUS_PER_GAME_PAIR);
    
    // ПРИМЕНЯЕМ ЛИМИТ MAX_GAME_BONUS
    if (newGamePower !== gameVotePower) {
        gameVotePower = Math.min(newGamePower, MAX_GAME_BONUS);
        calculateVotePower();
    }
}

// ==================== ОБНОВЛЕННАЯ ФУНКЦИЯ RESETGAMEVOTEPOWER ====================
function resetGameVotePower() {
    gameVotePower = 0;
    powerBoost = 0; // Сбрасываем временный буст
    pairsGuessed = 0;
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

// ==================== ФУНКЦИЯ ЗАГРУЗКИ ПРЕФИКСОВ ====================
async function loadTablePrefixes() {
    try {
        const { data, error } = await supabase
            .from("table_prefixes")
            .select("table_name, prefix");
            
        if (error) throw error;
        
        tablePrefixes.clear();
        if (data) {
            data.forEach(item => {
                tablePrefixes.set(item.table_name, item.prefix);
            });
        }
        
        console.log('Loaded table prefixes:', Object.fromEntries(tablePrefixes));
        
    } catch (error) {
        console.error("Ошибка загрузки префиксов таблиц:", error);
        // Fallback префиксы
        tablePrefixes.set('Heroes_Table', 'hero_');
        tablePrefixes.set('Memes_Table', 'meme_');
        tablePrefixes.set('Star_Wars_Table', 'sw_');
        tablePrefixes.set('Video_Games_Table', 'vg_');
        tablePrefixes.set('Mortal_Kombat_Table', 'mk_');
    }
}

// Save progress - ТОЛЬКО ДЛЯ МАКСИМАЛЬНОГО СЧЕТА
function saveProgress() {
    try {
        localStorage.setItem('heroGameStats', JSON.stringify({
            maxScore: Math.max(maxScore, playerScore),
            totalGames: totalGames,                    // ← ДОЛЖНО сохраняться
            totalPairsGuessed: totalPairsGuessedOverall, // ← ДОЛЖНО сохраняться  
            totalPairsShown: totalPairsShownOverall     // ← ДОЛЖНО сохраняться
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

// ==================== ОБНОВЛЕННАЯ ФУНКЦИЯ UPDATE LIVES DISPLAY ====================
function updateLivesDisplay() {
    const globalLives = document.getElementById('global-lives');
    if (!globalLives) return;

    globalLives.innerHTML = '';

    const visibleLives = Math.min(playerLives, MAX_VISIBLE_LIVES);

    for (let i = 0; i < visibleLives; i++) {
        const star = document.createElement('div');
        star.className = 'life-star';
        globalLives.appendChild(star);
    }

    // Показываем +X только если есть extraLives И playerLives === 5
    if (extraLives > 0 && playerLives >= MAX_VISIBLE_LIVES) {
        const extraIndicator = document.createElement('div');
        extraIndicator.className = 'extra-lives-indicator';
        extraIndicator.textContent = `+${extraLives}`;
        extraIndicator.classList.add('extra-indicator');
        globalLives.appendChild(extraIndicator);
    }
}

// ==================== ОБНОВЛЕННАЯ ФУНКЦИЯ ADD LIVES ====================
function addLives(amount) {
    if (amount <= 0) return;

    const livesBefore = playerLives;

    if (playerLives < MAX_VISIBLE_LIVES) {
        const space = MAX_VISIBLE_LIVES - playerLives;
        const toMain = Math.min(amount, space);
        playerLives += toMain;
        amount -= toMain;
    }

    if (amount > 0) {
        extraLives += amount;
    }

    const addedToVisible = playerLives > livesBefore;
    const addedCount = Math.min(playerLives - livesBefore, MAX_VISIBLE_LIVES);

    if (addedToVisible && addedCount > 0) {
        animateLifeAddition(addedCount);
    } else {
        updateLivesDisplay(); // только если ничего не анимируем
    }
}


// ==================== ДОБАВИМ ФУНКЦИЮ ДЛЯ ПРОВЕРКИ СТРУКТУРЫ МЕМОВ ====================
function checkMemeStructure() {
    console.log('=== CHECKING MEME STRUCTURE ===');
    if (allMemes.length > 0) {
        const sampleMeme = allMemes[0];
        console.log('Sample meme structure:', Object.keys(sampleMeme));
        console.log('Sample meme:', sampleMeme);
        
        // Проверим есть ли мемы с бустами
        const memesWithBoosts = allMemes.filter(meme => 
            meme.extra_life !== undefined || meme.power_boost !== undefined
        );
        console.log('Memes with boosts:', memesWithBoosts.length);
        if (memesWithBoosts.length > 0) {
            console.log('First meme with boosts:', memesWithBoosts[0]);
        }
    }
}




// ==================== ИСПРАВЛЕННАЯ АНИМАЦИЯ ДОБАВЛЕНИЯ ЖИЗНЕЙ ====================
function animateLifeAddition(count) {
    const globalLives = document.getElementById('global-lives');
    if (!globalLives || count <= 0) return;

    // СНАЧАЛА ДОБАВЛЯЕМ ЗВЁЗДЫ В DOM (чтобы анимация видела)
    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'life-star life-star-adding';
        globalLives.appendChild(star);

        // Анимация появления
        AnimationManager.setTimeout(() => {
            star.classList.remove('life-star-adding');
        }, 50);
    }

    // Через 300мс — убираем класс добавления и обновляем +X
    AnimationManager.setTimeout(() => {
        updateLivesDisplay();
    }, 350);
}

// Get publisher logo URL
function getPublisherLogoUrl(publisherName) {
    if (!publisherName) return null;
    
    const lowerName = publisherName.toLowerCase().trim();
    return PUBLISHER_LOGOS[lowerName] || null;
}

async function loadAllHeroes() {
    try {
        // Загружаем префиксы таблиц
        await loadTablePrefixes();
        // Загружаем включенные таблицы
        await loadEnabledTables();
        
        console.log('=== LOADING HEROES DEBUG ===');
        console.log('Enabled tables:', enabledTables);
        console.log('Table prefixes:', Object.fromEntries(tablePrefixes));
        
        let allHeroesFromTables = [];
        
        // Загружаем героев из всех включенных таблиц
        for (const tableName of enabledTables) {
            if (tableName === 'Memes_Table') continue;
            
            console.log(`Loading from table: ${tableName}`);
            
            try {
                const prefix = tablePrefixes.get(tableName) || 'def_';
                
                // Пробуем загрузить с image_urls
                let query = supabase
                    .from(tableName)
                    .select("id, name, image_url, image_urls, rating, good_bad, publisher");
                
                const { data, error } = await query;
                    
                if (error) {
                    // Если ошибка из-за отсутствующей колонки, пробуем без image_urls
                    if (error.code === '42703' && error.message.includes('image_urls')) {
                        console.log(`Column image_urls not found in ${tableName}, loading without it`);
                        const { data: dataWithoutUrls, error: errorWithoutUrls } = await supabase
                            .from(tableName)
                            .select("id, name, image_url, rating, good_bad, publisher");
                            
                        if (errorWithoutUrls) {
                            console.error(`Error loading from ${tableName} without image_urls:`, errorWithoutUrls);
                            continue;
                        }
                        
                        if (dataWithoutUrls && dataWithoutUrls.length > 0) {
                            const heroesWithSource = dataWithoutUrls.map(hero => ({
                                ...hero,
                                source_table: tableName,
                                // ГЕНЕРИРУЕМ ID С ПРЕФИКСОМ
                                id: `${prefix}${hero.id}`,
                                originalId: hero.id, // Сохраняем оригинальный ID для обновления
                                logo_url: getPublisherLogoUrl(hero.publisher),
                                image_urls: null
                            }));
                            
                            allHeroesFromTables = allHeroesFromTables.concat(heroesWithSource);
                            console.log(`✅ Loaded ${heroesWithSource.length} heroes from ${tableName} (with prefix: ${prefix})`);
                        }
                    } else {
                        console.error(`Error loading from ${tableName}:`, error);
                        continue;
                    }
                } else if (data && data.length > 0) {
                    // Успешно загрузили с image_urls
                    const heroesWithSource = data.map(hero => ({
                        ...hero,
                        source_table: tableName,
                        // ГЕНЕРИРУЕМ ID С ПРЕФИКСОМ
                        id: `${prefix}${hero.id}`,
                        originalId: hero.id, // Сохраняем оригинальный ID для обновления
                        logo_url: getPublisherLogoUrl(hero.publisher),
                        // Используем случайное изображение из массива если есть
                        image_url: hero.image_urls && Array.isArray(hero.image_urls) && hero.image_urls.length > 0 
                            ? hero.image_urls[Math.floor(Math.random() * hero.image_urls.length)]
                            : hero.image_url
                    }));
                    
                    allHeroesFromTables = allHeroesFromTables.concat(heroesWithSource);
                    console.log(`✅ Loaded ${heroesWithSource.length} heroes from ${tableName} (with prefix: ${prefix})`);
                } else {
                    console.log(`❌ No data found in table: ${tableName}`);
                }
                
            } catch (tableError) {
                console.error(`❌ Critical error loading from ${tableName}:`, tableError);
            }
        }
        
        console.log('=== FINAL HEROES COUNT ===');
        console.log('Total heroes loaded:', allHeroesFromTables.length);
        console.log('Distribution by table:', 
            allHeroesFromTables.reduce((acc, hero) => {
                acc[hero.source_table] = (acc[hero.source_table] || 0) + 1;
                return acc;
            }, {})
        );
        
        allHeroes = allHeroesFromTables;
        
        // Fallback если ни одна таблица не загрузилась
        if (allHeroes.length === 0) {
            console.log('No heroes loaded from enabled tables, using Heroes_Table as fallback');
            try {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('Heroes_Table')
                    .select("id, name, image_url, rating, good_bad, publisher");
                    
                if (!fallbackError && fallbackData) {
                    const prefix = tablePrefixes.get('Heroes_Table') || 'hero_';
                    allHeroes = fallbackData.map(hero => ({
                        ...hero,
                        source_table: 'Heroes_Table',
                        id: `${prefix}${hero.id}`,
                        originalId: hero.id,
                        logo_url: getPublisherLogoUrl(hero.publisher),
                        image_urls: null
                    }));
                    console.log(`✅ Loaded ${allHeroes.length} heroes from Heroes_Table fallback`);
                }
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        }
        
        if (allHeroes.length === 0) {
            throw new Error('No heroes available from any table');
        }
        
        loadProgress();
        startGame();
        
    } catch (error) {
        console.error("Critical error loading heroes:", error);
        showErrorMessage("Failed to load game data. Please try again later.");
    }
}

// app.js - ОБНОВЛЯЕМ функцию loadMemeSettings
async function loadMemeSettings() {
    try {
        const { data, error } = await supabase
            .from("meme_settings")
            .select("setting_key, setting_value");
            
        if (error) {
            console.error("Error loading meme settings:", error);
            // Устанавливаем безопасные значения по умолчанию
            memeSettings = {
                enabled: false, // по умолчанию выключено!
                chance: 0.25,
                perGame: 1,
                season: 'default'
            };
            return;
        }
        
        // Инициализируем настройки значениями из базы
        memeSettings = {
            enabled: false, // по умолчанию false!
            chance: 0.25,
            perGame: 1,
            season: 'default'
        };
        
        if (data) {
            data.forEach(setting => {
                switch(setting.setting_key) {
                    case 'meme_enabled':
                        memeSettings.enabled = setting.setting_value === 'true';
                        break;
                    case 'meme_chance_per_game':
                        memeSettings.chance = parseFloat(setting.setting_value) || 0.25;
                        break;
                    case 'memes_per_game':
                        memeSettings.perGame = parseInt(setting.setting_value) || 1;
                        break;
                    case 'season_per_game':
                        memeSettings.season = setting.setting_value || 'default';
                        break;
                }
            });
        }
        
        console.log('Loaded meme settings:', memeSettings);
        
    } catch (error) {
        console.error("Ошибка загрузки настроек мемов:", error);
        // В случае ошибки устанавливаем безопасные значения по умолчанию
        memeSettings = {
            enabled: false,
            chance: 0.25,
            perGame: 1,
            season: 'default'
        };
    }
}

// ИЛИ более простое решение, если все дефолтные мемы имеют season = 'default'
async function loadAllMemes() {
    try {
        if (!memeSettings.enabled) {
            console.log('Memes disabled in settings');
            return;
        }

        let query = supabase
            .from("Memes_Table")
            .select("id, name, image_url, image_urls, rating, chance, season, extra_life, power_boost")
            .eq('season', memeSettings.season); // ВСЕГДА фильтруем по сезону

        const { data, error } = await query;
        if (error) throw error;
        
        allMemes = data || [];
        console.log('Loaded memes for season:', memeSettings.season, 'count:', allMemes.length);
        
    } catch (error) {
        console.error("Ошибка загрузки мемов:", error);
        allMemes = [];
    }
}

function getRandomMemeImage(meme) {
    // Приоритет: используем image_urls если есть и не пустой
    if (meme.image_urls && Array.isArray(meme.image_urls) && meme.image_urls.length > 0) {
        const randomIndex = Math.floor(Math.random() * meme.image_urls.length);
        return meme.image_urls[randomIndex];
    }
    
    // Fallback: используем старую image_url
    return meme.image_url;
}

// Добавьте функцию для получения случайного мема по редкости
function getRandomMemeByRarity(rarity) {
    const filteredMemes = allMemes.filter(meme => meme.chance === rarity);
    if (filteredMemes.length === 0) return null;
    
    return filteredMemes[Math.floor(Math.random() * filteredMemes.length)];
}

// Добавьте функцию для выбора случайного мема
function getRandomMeme() {
    if (allMemes.length === 0) return null;
    
    const rand = Math.random();
    let rarity;
    
    if (rand < 0.7) {
        rarity = 'Rare'; // 70% шанс
    } else if (rand < 0.9) {
        rarity = 'Epic'; // 20% шанс
    } else {
        rarity = 'Legend'; // 10% шанс
    }
    
    return getRandomMemeByRarity(rarity) || allMemes[Math.floor(Math.random() * allMemes.length)];
}


function startGame() {
    gameActive = true;
    gameStartTime = Date.now();
    sessionId = generateSessionId();
    //displayHeroes();
    updateUI();
}

function getRandomHeroes() {
    if (allHeroes.length < 2) return null;

    // ПЕРЕМЕШИВАЕМ ТОЛЬКО ПРИ ПЕРВОМ ВЫЗОВЕ В ИГРЕ
    if (!window.shuffledHeroes || window.shuffledHeroes.length < 2 || !window.initialShuffleDone) {
        console.log('=== CREATING NEW DECK FROM ALL TABLES WITH MEMES ===');
        
        // ПРАВИЛЬНОЕ ПЕРЕМЕШИВАНИЕ - Fisher-Yates shuffle
        window.shuffledHeroes = [...allHeroes];
        for (let i = window.shuffledHeroes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [window.shuffledHeroes[i], window.shuffledHeroes[j]] = 
            [window.shuffledHeroes[j], window.shuffledHeroes[i]];
        }
        
        console.log('Base heroes in deck:', window.shuffledHeroes.length);
        
        // ДОБАВЛЯЕМ МЕМЫ В КОЛОДУ ТОЛЬКО ОДИН РАЗ
        if (memeSettings.enabled && allMemes.length > 0) {
            // Проверяем шанс добавления мемов в эту игру
            if (Math.random() < memeSettings.chance) {
                memeCardsToAdd = memeSettings.perGame;
                console.log(`Adding ${memeCardsToAdd} memes to deck`);
                
                // Добавляем мемы в случайные позиции ОДИН РАЗ
                for (let i = 0; i < memeCardsToAdd; i++) {
                    const meme = getRandomMeme();
                    if (meme) {
                        // Безопасная позиция для вставки
                        const randomPosition = Math.floor(Math.random() * (window.shuffledHeroes.length - 10)) + 5;
                        const safePosition = Math.max(0, Math.min(randomPosition, window.shuffledHeroes.length - 1));
                        
                        const memeCard = {
                            ...meme,
                            id: `meme_${meme.id}`,
                            originalMemeId: meme.id,
                            isMeme: true,
                            shouldFlip: true,
                            logo_url: null,
                            chance: meme.chance || 'Rare',
                            season: meme.season || 'default',
                            source_table: 'Memes_Table',
                            image_url: getRandomMemeImage(meme)
                        };
                        window.shuffledHeroes.splice(safePosition, 0, memeCard);
                        console.log('Added meme:', memeCard.name, 'at position:', safePosition);
                    }
                }
            } else {
                console.log('No memes added to deck (chance failed)');
                memeCardsToAdd = 0;
            }
        } else {
            console.log('Memes disabled or no memes available');
            memeCardsToAdd = 0;
        }
        
        // Определяем отражение для каждого героя (из всех таблиц)
        window.shuffledHeroes.forEach(hero => {
            if (!hero.isMeme) {
                hero.shouldFlip = shouldFlipHero(hero);
            }
        });
        
        // ПРАВИЛЬНЫЙ ПОДСЧЕТ
        console.log('=== FINAL DECK COMPOSITION ===');
        console.log('Final deck size:', window.shuffledHeroes.length);
        console.log('Regular heroes:', window.shuffledHeroes.filter(h => !h.isMeme).length);
        console.log('Memes:', window.shuffledHeroes.filter(h => h.isMeme).length);
        console.log('Distribution by table:', 
            window.shuffledHeroes.reduce((acc, hero) => {
                const type = hero.isMeme ? 'Meme' : hero.source_table;
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {})
        );

        window.currentHeroIndex = 0;
        window.initialShuffleDone = true;
    }
    
    // Если дошли до конца массива - показываем экран завершения
    if (window.currentHeroIndex >= window.shuffledHeroes.length - 1) {
        console.log('Deck exhausted, showing completion screen');
        //showCompletionScreen();
        return null;
    }
    
    // Берем последовательно пары из перемешанного массива (все таблицы вместе)
    const selected = [
        window.shuffledHeroes[window.currentHeroIndex],
        window.shuffledHeroes[window.currentHeroIndex + 1]
    ];
    
    console.log('Selected pair:', {
        index: window.currentHeroIndex,
        hero1: { 
            name: selected[0].name, 
            source: selected[0].source_table,
            isMeme: selected[0].isMeme 
        },
        hero2: { 
            name: selected[1].name, 
            source: selected[1].source_table,
            isMeme: selected[1].isMeme 
        }
    });
    
    window.currentHeroIndex += 2;
    
    
    return selected;
}

function showCompletionScreen() {
    const texts = getText('COMPLETION');
    
    const totalVotes = votedHeroes.size;
    const correctVotes = playerScore;
    const gameWinRate = totalVotes > 0 ? ((correctVotes / totalVotes) * 100).toFixed(1) : 0;

    // Функция для определения цвета винрейта
    const getWinRateColor = (winRate) => {
        const rate = parseFloat(winRate);
        if (rate >= 75) return '#ffd700'; // золотой
        if (rate >= 50) return '#00de00'; // зеленый
        if (rate >= 25) return '#4cc9f0'; // синий
        return '#ffffff'; // белый
    };

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
                    <span class="popup-stat-value" style="color: ${getWinRateColor(gameWinRate)}">${gameWinRate}%</span>
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

// Упрощаем функцию загрузки включенных таблиц
async function loadEnabledTables() {
    try {
        const { data, error } = await supabase
            .from("enabled_tables")
            .select("table_name, enabled")
            .eq("enabled", true);
            
        if (error) throw error;
        
        enabledTables = data ? data.map(item => item.table_name) : ['Heroes_Table'];
        console.log('Enabled tables:', enabledTables);
        
    } catch (error) {
        console.error("Ошибка загрузки включенных таблиц:", error);
        enabledTables = ['Heroes_Table']; // fallback
    }
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

// Обновите функцию getHeroAlignment для мемов
function getHeroAlignment(goodBad, isMeme, memeRarity) {
    if (isMeme) {
        // Убедитесь что memeRarity передается корректно
        const actualRarity = memeRarity || 'Rare'; // значение по умолчанию
        
        let imageUrl, alt;
        switch(actualRarity) {
            case 'Rare':
                imageUrl = 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Rare.webp';
                alt = 'RARE';
                break;
            case 'Epic':
                imageUrl = 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Epic.webp';
                alt = 'EPIC';
                break;
            case 'Legend':
                imageUrl = 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Legend.webp';
                alt = 'LEGEND';
                break;
            default:
                imageUrl = 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Rare.webp';
                alt = 'RARE';
        }
        
        return { imageUrl, alt };
    }
    
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

// Обновите функцию displayHeroes для отображения мемов
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
        if (!currentHeroes) {
            showCompletionScreen();
            return;
        }
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

        

        if (hero.isMeme) {
            // Для мемов тоже применяем случайное отражение, но можно исключить какие-то
            if (shouldFlipHero(hero)) {
                imgElement.style.transform = 'scaleX(-1)';
            } else {
                imgElement.style.transform = 'scaleX(1)';
            }
        } else {
            if (hero.shouldFlip) {
                imgElement.style.transform = 'scaleX(-1)';
            } else {
                imgElement.style.transform = 'scaleX(1)';
            }
        }
        
        // Set hero name с оптимизацией
        if (nameElement) {
            nameElement.textContent = hero.name;
            if (hero.name.length > 15) {
                nameElement.style.fontSize = 'clamp(14px, 3vw, 20px)';
            } else if (hero.name.length > 10) {
                nameElement.style.fontSize = 'clamp(16px, 4vw, 24px)';
            } else {
                nameElement.style.fontSize = 'clamp(18px, 5vw, 28px)';
            }
        }

        
        
        // В функции displayHeroes - ПЕРЕДАВАЙТЕ ФАКТИЧЕСКОЕ ЗНАЧЕНИЕ РЕДКОСТИ
        if (alignmentElement) {
            const alignment = getHeroAlignment(
                hero.good_bad, 
                hero.isMeme, 
                hero.isMeme ? hero.chance : undefined // Передаем фактическую редкость из базы
            );
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
        
        // Set publisher logo - у мемов нет логотипов
        if (publisherElement) {
            publisherElement.innerHTML = '';
            if (hero.logo_url && !hero.isMeme) {
                const logoImg = document.createElement('img');
                logoImg.src = hero.logo_url;
                logoImg.alt = hero.publisher || 'Publisher';
                logoImg.className = 'publisher-logo';
                logoImg.loading = 'lazy';
                publisherElement.appendChild(logoImg);
            }
        }
    });

    // Применяем стили для мемов (после того как все элементы уже созданы)
    currentHeroes.forEach((hero, index) => {
        const heroNum = index + 1;
        
        try {
            const cardElement = document.getElementById(`hero${heroNum}`);
            const nameElement = document.getElementById(`hero${heroNum}-name`);
            
            if (hero.isMeme) {
                console.log(`Applying meme styles to hero ${heroNum}: ${hero.name}`);
                
                if (cardElement) {
                    cardElement.classList.add('meme-card');
                    console.log('Meme card class added');
                }
                
                if (nameElement) {
                    nameElement.classList.add('meme-name');
                    console.log('Meme name class added');
                }
                
                
            } else {
                if (cardElement) cardElement.classList.remove('meme-card');
                if (nameElement) nameElement.classList.remove('meme-name');
                
                // Убираем индикатор мема
                if (cardElement) {
                    const indicator = cardElement.querySelector('.meme-indicator');
                    if (indicator) indicator.remove();
                }
            }
        } catch (error) {
            console.error('Error applying meme styles:', error);
        }
    });

}

// ==================== ИСПРАВЛЕННАЯ ФУНКЦИЯ ГОЛОСОВАНИЯ ====================
async function vote(heroNumber) {
    if (!gameActive || !currentHeroes || currentHeroes.length < 2 || 
        playerLives <= 0 || isVotingInProgress) {
        return;
    }
    
    isVotingInProgress = true;
    
    // ПОЛУЧАЕМ КООРДИНАТЫ КЛИКА ИЗ EVENT
    let clickX, clickY;
    if (event) {
        clickX = event.clientX || (event.touches && event.touches[0].clientX);
        clickY = event.clientY || (event.touches && event.touches[0].clientY);
    }
    
    indicateSelection(heroNumber);
    
    const selectedHero = currentHeroes[heroNumber - 1];
    const otherHero = heroNumber === 1 ? currentHeroes[1] : currentHeroes[0];
    
    const votePairId = `${selectedHero.id}-${otherHero.id}-${selectedHero.isMeme ? 'meme' : 'hero'}`;
    
    if (currentVotePairId === votePairId) {
        isVotingInProgress = false;
        return;
    }
    
    currentVotePairId = votePairId;
    
    // ОБНОВЛЕННОЕ СРАВНЕНИЕ: ЕСЛИ РАЗНИЦА МЕНЕЕ 0.1 - ПОБЕЖДАЕТ ИГРОК
    const ratingDifference = Math.abs(selectedHero.rating - otherHero.rating);
    const userMadeRightChoice = ratingDifference < 0.1 ? true : selectedHero.rating > otherHero.rating;
    
    currentGamePairsShown++;
    
    if (userMadeRightChoice) {
        votePowerPairs++; 
    }
    
    playHaptic('selection');
    
    // ПРИМЕНЯЕМ БУСТЫ ЕСЛИ ЭТО МЕМ С БУСТАМИ И ПОЛЬЗОВАТЕЛЬ ВЫИГРАЛ
    if (userMadeRightChoice && selectedHero.isMeme) {
        const hasBoosts = selectedHero.extra_life !== undefined || selectedHero.power_boost !== undefined;
        console.log('Should apply boosts:', hasBoosts);
        
        if (hasBoosts) {
            // ЗАПОМИНАЕМ БУСТ ДЛЯ ПРИМЕНЕНИЯ СРАЗУ
            AnimationManager.setTimeout(() => {
                applyBoostEffects(selectedHero, clickX, clickY);
            }, 100);
        }
    }
    
    // ОБНОВЛЯЕМ СИЛУ ГОЛОСА ПЕРЕД АНИМАЦИЕЙ
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

    // Анимация цифр с СИЛОЙ ГОЛОСА в месте клика
    if (clickX && clickY) {
        AnimationManager.setTimeout(() => {
            ScoreEmitter.emitFromPoint(clickX, clickY, 4, `+${currentPower}`);
        }, 0);
    }
    
    // ОБРАБОТКА ПОТЕРИ ЖИЗНИ (только для игровой логики)
    if (!userMadeRightChoice) {
        AnimationManager.setTimeout(() => {
            let animateLoss = false;

            if (extraLives > 0) {
                extraLives--;
            } else if (playerLives > 0) {
                playerLives--;
                animateLoss = true;
            }

            if (animateLoss) {
                updateLivesWithAnimation();
                playHaptic('wrong');
            } else {
                updateLivesDisplay();
            }

            updateUI();
        }, HERO_DISPLAY_DURATION - 500);
    }

    // Обновляем статистику с СИЛОЙ ГОЛОСА
    AnimationManager.setTimeout(() => {
        if (userMadeRightChoice) {
            playerScore += currentPower;
            pairsGuessed++;
            updateUI();
            updateGameVotePower();
        }
        
        votedHeroes.add(selectedHero.id);
        votedHeroes.add(otherHero.id);
        saveProgress();
        
        // ==================== КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: ВСЕГДА ЗАПИСЫВАЕМ ПОБЕДУ ВЫБРАННОМУ ГЕРОЮ ====================
        // Независимо от исхода игры, выбранный герой получает победу, невыбранный - поражение
        const winnerId = selectedHero.id;  // ВСЕГДА тот, кого выбрал игрок
        const loserId = otherHero.id;      // ВСЕГДА тот, кого не выбрали
        
        updateHeroStatsAsync(winnerId, loserId, currentPower);
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


function applyBoostEffects(boostMeme, clickX, clickY) {
    if (!boostMeme) return;

    console.log('BOOST:', boostMeme); // ← ОТЛАДКА

    if (boostMeme.extra_life) {
        addLives(boostMeme.extra_life);
        ScoreEmitter.emitFromPoint(clickX, clickY, 3, `+${boostMeme.extra_life}⭐`, { isBoost: true });
    }

    if (boostMeme.power_boost) {
        powerBoost += boostMeme.power_boost;
        calculateVotePower();
        ScoreEmitter.emitFromPoint(clickX, clickY, 3, `+${boostMeme.power_boost}⚡`, { isBoost: true });
    }

    playHaptic('correct');
}

// ==================== ОБНОВЛЕННАЯ ФУНКЦИЯ SHOW STAR RATING ====================
function showStarRating(heroNumber, rating, isWinner) {
    const starContainer = document.getElementById(`hero${heroNumber}-star-rating`);
    const starImage = starContainer.querySelector('.rating-star');
    const percentElement = starContainer.querySelector('.star-rating-percent');
    
    if (!starContainer || !starImage || !percentElement) return;
    
    starImage.src = isWinner 
        ? 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/StarBlue.webp'
        : 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/StarRed.webp';
    
    percentElement.innerHTML = '';
    
    // ПРЕОБРАЗУЕМ РЕЙТИНГ В ЦЕЛОЕ ЧИСЛО И ДОБАВЛЯЕМ ЗНАК ПРОЦЕНТОВ
    const ratingText = Math.round(rating).toString();
    
    // Создаем цифры и добавляем значок процентов
    convertToImageBasedDigitsWithPercent(percentElement, ratingText);
    
    starContainer.classList.remove('show', 'hiding');
    
    AnimationManager.setTimeout(() => {
        starContainer.classList.add('show');
    }, 50);
}

// ==================== НОВАЯ ФУНКЦИЯ ДЛЯ ЦИФР СО ЗНАКОМ ПРОЦЕНТОВ ====================
function convertToImageBasedDigitsWithPercent(element, text) {
    const fragment = document.createDocumentFragment();
    
    // Добавляем цифры
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (!isNaN(char) && char !== ' ') {
            const digitSpan = document.createElement('span');
            digitSpan.className = 'digit';
            digitSpan.style.backgroundImage = `url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Numbers/${char}.webp')`;
            fragment.appendChild(digitSpan);
        }
    }
    
    // Добавляем значок процентов
    const percentSpan = document.createElement('span');
    percentSpan.className = 'digit percent';
    percentSpan.style.backgroundImage = `url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Numbers/percent.webp')`;
    fragment.appendChild(percentSpan);
    
    // Один раз обновляем DOM
    element.appendChild(fragment);
}

// ==================== ОБНОВЛЕННАЯ ФУНКЦИЯ UPDATE LIVES WITH ANIMATION ====================
// ==================== ИСПРАВЛЕННАЯ ФУНКЦИЯ UPDATE LIVES WITH ANIMATION ====================
function updateLivesWithAnimation() {
    const globalLives = document.getElementById('global-lives');
    if (!globalLives) return;

    const targetStars = Math.min(playerLives, MAX_VISIBLE_LIVES);

    // УДАЛЯЕМ ВСЕ ЗВЁЗДЫ (это быстро, т.к. их всего 5)
    const currentStars = globalLives.querySelectorAll('.life-star');
    const starsToRemove = currentStars.length - targetStars;

    // АНИМИРУЕМ УДАЛЕНИЕ, ЕСЛИ НУЖНО
    if (starsToRemove > 0) {
        playHaptic('wrong');

        for (let i = 0; i < starsToRemove; i++) {
            const starToRemove = currentStars[currentStars.length - 1 - i];
            if (starToRemove) {
                starToRemove.classList.add('life-star-removing');
                AnimationManager.setTimeout(() => {
                    if (starToRemove.parentNode === globalLives) {
                        globalLives.removeChild(starToRemove);
                    }
                }, HERO_DISPLAY_DURATION-500);
            }
        }
    }

    // ДОБАВЛЯЕМ НОВЫЕ ЗВЁЗДЫ, ЕСЛИ НУЖНО (например, после буста)
    const starsToAdd = targetStars - (currentStars.length - starsToRemove);
    if (starsToAdd > 0) {
        animateLifeAddition(starsToAdd);
        return; // animateLifeAddition сам вызовет updateLivesDisplay
    }

    // ВСЕГДА обновляем отображение (включая +X)
    AnimationManager.setTimeout(() => {
        updateLivesDisplay();
    }, starsToRemove > 0 ? 350 : 0);
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

// ==================== ИСПРАВЛЕННАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ СТАТИСТИКИ ====================
async function updateHeroStatsAsync(winnerId, loserId, votePower = 1) {
    try {
        console.log('=== UPDATE STATS START ===');
        console.log('Raw inputs:', { winnerId, loserId, votePower });
        
        // ПРОСТАЯ ФУНКЦИЯ ОПРЕДЕЛЕНИЯ ИСТОЧНИКА ПО ПРЕФИКСУ
        const findHeroSource = (heroId) => {
            // Для мемов
            if (heroId.startsWith('meme_')) {
                return {
                    table: 'Memes_Table',
                    isMeme: true,
                    cleanId: heroId.replace('meme_', '')
                };
            }
            
            // Для других таблиц - ищем по префиксам
            for (const [tableName, prefix] of tablePrefixes) {
                if (heroId.startsWith(prefix)) {
                    return {
                        table: tableName,
                        isMeme: false,
                        cleanId: heroId.replace(prefix, '')
                    };
                }
            }
            
            // Если префикс не найден, пробуем найти в текущих героях
            const heroInCurrent = [...currentHeroes, ...allHeroes].find(h => h.id === heroId);
            if (heroInCurrent) {
                return {
                    table: heroInCurrent.source_table,
                    isMeme: heroInCurrent.isMeme || false,
                    cleanId: heroInCurrent.originalId || heroInCurrent.id
                };
            }
            
            // Fallback
            console.warn(`Could not determine table for ID: ${heroId}, using Heroes_Table`);
            return {
                table: 'Heroes_Table',
                isMeme: false,
                cleanId: heroId
            };
        };

        const winnerInfo = findHeroSource(winnerId);
        const loserInfo = findHeroSource(loserId);

        console.log('Winner info:', winnerInfo);
        console.log('Loser info:', loserInfo);

        // ОБНОВЛЯЕМ ПОБЕДИТЕЛЯ (ВСЕГДА выбранный герой)
        if (winnerInfo.isMeme) {
            // ОБНОВЛЯЕМ МЕМ-ПОБЕДИТЕЛЬ
            console.log('Updating winner MEME:', winnerInfo.cleanId);
            
            const { data: winnerData, error: winnerFetchError } = await supabase
                .from('Memes_Table')
                .select('wins, loses, viewers')
                .eq('id', winnerInfo.cleanId)
                .single();
            
            if (winnerFetchError) {
                console.error('Error fetching winner meme:', winnerFetchError);
            } else {
                console.log('Winner meme current stats:', winnerData);
                
                const { error: winnerError } = await supabase
                    .from('Memes_Table')
                    .update({ 
                        wins: (parseFloat(winnerData.wins || 0)) + parseFloat(votePower),
                        viewers: (parseFloat(winnerData.viewers || 0)) + 1
                    })
                    .eq('id', winnerInfo.cleanId);
                
                if (winnerError) {
                    console.error('Error updating winner meme:', winnerError);
                } else {
                    console.log('✅ Successfully updated winner meme');
                }
            }
        } else {
            // ОБНОВЛЯЕМ ГЕРОЯ-ПОБЕДИТЕЛЯ ИЗ ЛЮБОЙ ТАБЛИЦЫ
            console.log(`Updating winner HERO from ${winnerInfo.table}:`, winnerInfo.cleanId);
            
            const { data: winnerData, error: winnerFetchError } = await supabase
                .from(winnerInfo.table)
                .select('wins, viewers')
                .eq('id', winnerInfo.cleanId)
                .single();
            
            if (winnerFetchError) {
                console.error(`Error fetching winner from ${winnerInfo.table}:`, winnerFetchError);
            } else {
                console.log(`Winner from ${winnerInfo.table} current stats:`, winnerData);
                
                const { error: winnerError } = await supabase
                    .from(winnerInfo.table)
                    .update({ 
                        wins: (parseFloat(winnerData.wins || 0)) + parseFloat(votePower),
                        viewers: (parseFloat(winnerData.viewers || 0)) + 1
                    })
                    .eq('id', winnerInfo.cleanId);
                
                if (winnerError) {
                    console.error(`Error updating winner in ${winnerInfo.table}:`, winnerError);
                } else {
                    console.log(`✅ Successfully updated winner in ${winnerInfo.table}`);
                }
            }
        }

        // ОБНОВЛЯЕМ ПРОИГРАВШЕГО (ВСЕГДА невыбранный герой)
        if (loserInfo.isMeme) {
            // ОБНОВЛЯЕМ МЕМ-ПРОИГРАВШЕГО
            console.log('Updating loser MEME:', loserInfo.cleanId);
            
            const { data: loserData, error: loserFetchError } = await supabase
                .from('Memes_Table')
                .select('wins, loses, viewers')
                .eq('id', loserInfo.cleanId)
                .single();
            
            if (loserFetchError) {
                console.error('Error fetching loser meme:', loserFetchError);
            } else {
                console.log('Loser meme current stats:', loserData);
                
                const { error: loserError } = await supabase
                    .from('Memes_Table')
                    .update({ 
                        loses: (parseFloat(loserData.loses || 0)) + parseFloat(votePower),
                        viewers: (parseFloat(loserData.viewers || 0)) + 1
                    })
                    .eq('id', loserInfo.cleanId);
                
                if (loserError) {
                    console.error('Error updating loser meme:', loserError);
                } else {
                    console.log('✅ Successfully updated loser meme');
                }
            }
        } else {
            // ОБНОВЛЯЕМ ГЕРОЯ-ПРОИГРАВШЕГО ИЗ ЛЮБОЙ ТАБЛИЦЫ
            console.log(`Updating loser HERO from ${loserInfo.table}:`, loserInfo.cleanId);
            
            const { data: loserData, error: loserFetchError } = await supabase
                .from(loserInfo.table)
                .select('loses, viewers')
                .eq('id', loserInfo.cleanId)
                .single();
            
            if (loserFetchError) {
                console.error(`Error fetching loser from ${loserInfo.table}:`, loserFetchError);
            } else {
                console.log(`Loser from ${loserInfo.table} current stats:`, loserData);
                
                const { error: loserError } = await supabase
                    .from(loserInfo.table)
                    .update({ 
                        loses: (parseFloat(loserData.loses || 0)) + parseFloat(votePower),
                        viewers: (parseFloat(loserData.viewers || 0)) + 1
                    })
                    .eq('id', loserInfo.cleanId);
                
                if (loserError) {
                    console.error(`Error updating loser in ${loserInfo.table}:`, loserError);
                } else {
                    console.log(`✅ Successfully updated loser in ${loserInfo.table}`);
                }
            }
        }

        console.log('=== UPDATE STATS COMPLETE ===');
        
    } catch (error) {
        console.error("❌ Critical error in updateHeroStatsAsync:", error);
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

function playHaptic(type = 'light') {
    if (!tg || !tg.HapticFeedback) return;

    try {
        // Поддерживаемые типы:
        // 'light', 'medium', 'heavy', 'rigid', 'soft'
        const style = type === 'correct' ? 'light' :
                     type === 'wrong' ? 'medium' :
                     type === 'selection' ? 'soft' :
                     type === 'game_over' ? 'heavy' : 'light';

        tg.HapticFeedback.impactOccurred(style);
    } catch (e) {
        console.warn('Haptic failed:', e);
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

    // Функция для определения цвета винрейта
    const getWinRateColor = (winRate) => {
        const rate = parseFloat(winRate);
        if (rate >= 75) return '#ffd700'; // золотой
        if (rate >= 50) return '#00de00'; // зеленый
        if (rate >= 25) return '#4cc9f0'; // синий
        return '#ffffff'; // белый
    };

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
                    <span class="popup-stat-value" style="color: ${getWinRateColor(gameWinRate)}">${gameWinRate}%</span>
                </div>
                <div class="popup-stat-item">
                    <span class="popup-stat-label">${texts.OVERALL_WINRATE}:</span>
                    <span class="popup-stat-value" style="color: ${getWinRateColor(overallWinRate)}">${overallWinRate}%</span>
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



// ==================== ОБНОВИМ ФУНКЦИЮ RESETGAME ДЛЯ ВЫЗОВА ПРОВЕРКИ ====================
// app.js - ОБНОВЛЯЕМ resetGame для работы с таблицами
function resetGame() {
    // ОЧИЩАЕМ ВСЕ ПОПАПЫ ПЕРЕД НОВОЙ ИГРОЙ
    document.querySelectorAll('.universal-popup').forEach(popup => popup.remove());
    
    // ✅ СБРАСЫВАЕМ ТОЛЬКО ТЕКУЩУЮ ИГРУ:
    playerLives = INITIAL_PLAYER_LIVES;
    playerScore = 0;
    pairsGuessed = 0;
    currentGamePairsShown = 0;
    memeCardsToAdd = 0;
    extraLives = 0;
    powerBoost = 0;
   
    // ✅ СБРАСЫВАЕМ ПРОГРЕСС ГОЛОСОВАНИЯ:
    votedHeroes.clear();
    isVotingInProgress = false;
    currentVotePairId = null;
    gameActive = true;
    
    // ✅ СБРАСЫВАЕМ ИГРОВУЮ СИЛУ ГОЛОСА:
    resetGameVotePower();
    
    // ✅ ПЕРЕЗАГРУЖАЕМ ДАННЫЕ ИЗ ВСЕХ ВКЛЮЧЕННЫХ ТАБЛИЦ:
    Promise.all([loadAllHeroes(), loadAllMemes()]).then(() => {
        // ✅ СБРАСЫВАЕМ КЕШ ГЕРОЕВ ДЛЯ НОВОЙ ИГРЫ:
        window.shuffledHeroes = null;
        window.currentHeroIndex = 0;
        window.initialShuffleDone = false;
        
        // ПРОВЕРЯЕМ СТРУКТУРУ
        checkMemeStructure();
        
        AnimationManager.clearAll();
        ScoreEmitter.clear();
        
        updateUI();
        displayHeroes();
    });
}


/// Обновите обработчик DOMContentLoaded
document.addEventListener("DOMContentLoaded", function() {
    initTelegram();

    calculateVotePower();
    
    // Загружаем настройки в правильном порядке
    loadMemeSettings().then(() => {
        return loadTablePrefixes(); // Загружаем префиксы ПЕРВЫМИ
    }).then(() => {
        return loadEnabledTables(); // Затем таблицы
    }).then(() => {
        return loadAllMemes(); // Затем мемы
    }).then(() => {
        // ВСЕГДА сбрасываем игру при загрузке
        resetGame();
        loadAllHeroes(); // Герои загружаются последними
        initNetworkMonitoring();
    });

    // Проверяем первый запуск
    const firstRunCompleted = localStorage.getItem(FIRST_RUN_KEY);
    
    setTimeout(() => {
        if (!firstRunCompleted) {
            showCopyrightDisclaimer();
            localStorage.setItem(FIRST_RUN_KEY, 'true');
        } else {
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
    
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        // Полная перезагрузка вместо resetGame
        location.reload();
    }
});

window.vote = vote;