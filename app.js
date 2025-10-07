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
let playerLives = 5;
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
    'dark_horse': 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Owner/dark_horse.webp'
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
    emitFromPoint(x, y, count = 4) {
        for (let i = 0; i < count; i++) {
            const randomDelay = Math.random() * 100;
            
            AnimationManager.setTimeout(() => {
                this.createParticle(x, y, '+1');
            }, i * 20 + randomDelay);
        }
    },
    
    clear() {
        if (this.emitter) {
            this.emitter.innerHTML = '';
        }
    }
};





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

// Функция показа ошибки сети
function showNetworkError() {
    if (document.querySelector('.network-error-popup') || networkErrorShown) return;
    
    networkErrorShown = true;
    
    const popup = document.createElement('div');
    popup.className = 'network-error-popup';
    popup.innerHTML = `
        <div class="network-error-content">
            <div class="network-error-icon">📶</div>
            <h3>Internet Lost</h3>
            <p>Check your connection</p>
            <p style="font-size: 12px; margin-top: 10px; opacity: 0.8;">
                Reconnecting automatically...
            </p>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Блокируем игровые элементы
    document.querySelectorAll('.hero-card').forEach(card => {
        card.style.pointerEvents = 'none';
    });
}

// Функция скрытия ошибки сети
function hideNetworkError() {
    const popup = document.querySelector('.network-error-popup');
    if (popup) {
        popup.style.animation = 'slideOutUp 0.3s ease-in forwards';
        setTimeout(() => {
            popup.remove();
            networkErrorShown = false;
        }, 300);
    }
    
    // Восстанавливаем игровые элементы
    document.querySelectorAll('.hero-card').forEach(card => {
        card.style.pointerEvents = '';
    });
}

// Load progress - ТОЛЬКО ДЛЯ МАКСИМАЛЬНОГО СЧЕТА
function loadProgress() {
    try {
        const savedStats = localStorage.getItem('heroGameStats');
        
        if (savedStats) {
            const stats = JSON.parse(savedStats);
            maxScore = stats.maxScore || 0;
        }
        
        // ПРИ ПЕРЕЗАГРУЗКЕ ВСЕГДА СБРАСЫВАЕМ ТЕКУЩИЙ ПРОГРЕСС
        playerLives = 5;
        playerScore = 0;
        votedHeroes = new Set();
        
        updateUI();
    } catch (error) {
        playerLives = 5;
        playerScore = 0;
        votedHeroes = new Set();
        maxScore = 0;
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
async function loadAllHeroes() {
    try {
        let { data, error } = await supabase
            .from("Heroes_Table")
            .select("id, name, image_url, wins, loses, viewers, rating, good_bad, publisher")
            .order('rating', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return;

        allHeroes = data.map(hero => ({
            ...hero,
            logo_url: getPublisherLogoUrl(hero.publisher)
        }));
        
        loadProgress();
        startGame();
        
    } catch (error) {
        // Убраны console.log для продакшена
    }
}

// Start game
function startGame() {
    gameActive = true;
    displayHeroes();
    updateUI();
}

// Get random heroes
function getRandomHeroes() {
    if (allHeroes.length < 2) return null;
    
    const availableHeroes = allHeroes.filter(hero => !votedHeroes.has(hero.id));
    
    if (availableHeroes.length < 2) {
        showCompletionScreen();
        return null;
    }
    
    const randomIndex1 = Math.floor(Math.random() * availableHeroes.length);
    let randomIndex2;
    do {
        randomIndex2 = Math.floor(Math.random() * availableHeroes.length);
    } while (randomIndex1 === randomIndex2);
    
    return [availableHeroes[randomIndex1], availableHeroes[randomIndex2]];
}

// Обработчик для кнопки "Play Again" в Completion Screen
function showCompletionScreen() {
    gameActive = false;
    maxScore = Math.max(maxScore, playerScore);
    saveProgress();
    
    document.body.style.opacity = '0.7';
    
    AnimationManager.setTimeout(() => {
        const popup = document.createElement('div');
        popup.className = 'game-over-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <h2>🎉 CONGRATULATIONS!</h2>
                <p>You've rated all ${allHeroes.length} heroes!</p>
                <p>Your final score: <span class="score">${playerScore}</span></p>
                <p>Best score: <span class="best">${maxScore}</span></p>
                <button id="complete-restart-button">🔄 Play Again</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        document.getElementById('complete-restart-button').addEventListener('click', function() {
            popup.remove();
            resetGame();
        });
    }, 1000);
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
// Оптимизированная функция голосования
async function vote(heroNumber) {
    if (!gameActive || !currentHeroes || currentHeroes.length < 2 || 
        playerLives <= 0 || isVotingInProgress) {
        return;
    }
    
    isVotingInProgress = true;

    indicateSelection(heroNumber);

    
    
    const selectedHero = currentHeroes[heroNumber - 1];
    
    // ИСПРАВЛЕНИЕ: только одно объявление otherHero
    const otherHero = heroNumber === 1 ? currentHeroes[1] : currentHeroes[0];
    
    const votePairId = `${selectedHero.id}-${otherHero.id}`;
    
    if (currentVotePairId === votePairId) {
        isVotingInProgress = false;
        return;
    }
    
    currentVotePairId = votePairId;
    
    const userMadeRightChoice = selectedHero.rating > otherHero.rating;
    
    playHaptic('selection');
    
    // Запускаем дым с оптимизацией
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

    // Анимация цифр из МЕСТА КЛИКА
    if (event) {
        const clickX = event.clientX || event.touches[0].clientX;
        const clickY = event.clientY || event.touches[0].clientY;
        
        AnimationManager.setTimeout(() => {
            ScoreEmitter.emitFromPoint(clickX, clickY, 5); // 4 частицы
        }, 0);
    }
    
    AnimationManager.setTimeout(() => {
        if (!userMadeRightChoice) {
            playerLives--;
            updateLivesWithAnimation();
            updateUI();
        }
    }, HERO_DISPLAY_DURATION - 500);

    AnimationManager.setTimeout(() => {
        if (userMadeRightChoice) {
            playerScore++;
            updateUI();
        }
        
        votedHeroes.add(selectedHero.id);
        votedHeroes.add(otherHero.id);
        saveProgress();
        
        updateHeroStatsAsync(selectedHero.id, otherHero.id);
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
async function updateHeroStatsAsync(winnerId, loserId) {
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
                wins: (winnerData.wins || 0) + 1,
                viewers: (winnerData.viewers || 0) + 1
            })
            .eq('id', winnerId);
        
        const { error: loserError } = await supabase
            .from('Heroes_Table')
            .update({ 
                loses: (loserData.loses || 0) + 1,
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

// Обновите функцию показа дисклеймера
function showCopyrightDisclaimer() {
    // Проверяем, показывался ли уже дисклеймер
    const disclaimerShown = localStorage.getItem(DISCLAIMER_SHOWN_KEY);
    
    if (disclaimerShown === 'true') {
        // Если уже показывался - просто продолжаем игру
        document.body.style.opacity = '1';
        return;
    }
    
    // Если первый запуск - показываем дисклеймер
    AnimationManager.setTimeout(() => {
        const texts = getText('DISCLAIMER');
        const popup = document.createElement('div');
        popup.className = 'game-over-popup copyright-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <h2>${texts.TITLE}</h2>
                
                <div class="disclaimer-content">
                    <div class="disclaimer-text">
                        ${texts.LEGAL}
                    </div>

                    <div class="rights-notice">
                        ${texts.RIGHTS_HOLDERS}
                    </div>
                </div>

                <button id="understand-button">${texts.BUTTON}</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        document.getElementById('understand-button').addEventListener('click', function() {
            // Сохраняем факт показа дисклеймера
            localStorage.setItem(DISCLAIMER_SHOWN_KEY, 'true');
            popup.remove();
            document.body.style.opacity = '1';
        });
    }, 500);
}

// Game over function
function gameOver() {
    gameActive = false;
    maxScore = Math.max(maxScore, playerScore);
    saveProgress();
    
    document.body.style.opacity = '0.7';
    playHaptic('game_over');
    AnimationManager.setTimeout(() => {
        showGameOverPopup();
    }, 1000);
}

function showGameOverPopup() {
    gameActive = false;
    maxScore = Math.max(maxScore, playerScore);
    saveProgress();
    
    document.body.style.opacity = '0.7';
    
    AnimationManager.setTimeout(() => {
        const popup = document.createElement('div');
        popup.className = 'game-over-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <h2>GAME OVER</h2>
                <p>Your score: <span class="score">${playerScore}</span></p>
                <p>Best score: <span class="best">${maxScore}</span></p>
                <button id="restart-button">🔄 Try Again</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        document.getElementById('restart-button').addEventListener('click', function() {
            popup.remove();
            resetGame();
        });
    }, 1000);
    
    if (tg) tg.HapticFeedback.notificationOccurred('error');
}

// Reset game - ПОЛНЫЙ СБРОС ПРОГРЕССА ПРИ КАЖДОМ ЗАПУСКЕ
function resetGame() {
    // Всегда полный сброс прогресса
    playerLives = 5;
    playerScore = 0;
    votedHeroes.clear();
    isVotingInProgress = false;
    currentVotePairId = null;
    gameActive = true;
    
    // Очищаем localStorage от прогресса (но оставляем максимальный счет)
    localStorage.removeItem('heroVoteProgress');
    
    // Очищаем все анимации
    AnimationManager.clearAll();

    // Очищаем эмиттер цифр
    ScoreEmitter.clear();
    
    document.body.style.opacity = '1';
    updateUI();
    displayHeroes();
}

// DOM loaded
document.addEventListener("DOMContentLoaded", function() {
    initTelegram();
    
    // ВСЕГДА сбрасываем игру при загрузке (анти-читерство)
    resetGame();
    loadAllHeroes();
    initNetworkMonitoring();

    setTimeout(() => {
        showCopyrightDisclaimer();
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