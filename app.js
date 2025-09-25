// app.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://xwtcasfvetisjaiijtsj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables
let allHeroes = [];
let currentHeroes = [];
let nextHeroes = [];
let votedHeroes = new Set();
let tg = null;
let isVotingInProgress = false;
let currentVotePairId = null;

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

// Initialize Telegram Web App
function initTelegram() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        tg = Telegram.WebApp;
        tg.expand();
        tg.enableClosingConfirmation();
        tg.setHeaderColor('#1a1a2e');
        tg.setBackgroundColor('#1a1a2e');
        tg.BackButton.hide();
        
        tg.onEvent('viewportChanged', (data) => {
            if (data && data.isStateStable && !data.isExpanded) {
                tg.close();
            }
        });

        // Проверяем поддержку вибрации
        if (tg.HapticFeedback) {
            console.log("HapticFeedback supported");
            // Тестовая вибрация при загрузке (очень короткая)
            setTimeout(() => {
                try {
                    tg.HapticFeedback.impactOccurred('light');
                } catch (e) {
                    console.log("HapticFeedback error:", e);
                }
            }, 1000);
        } else {
            console.log("HapticFeedback NOT supported");
        }

        
    } else {
        console.log("Running in browser (not Telegram)");
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

// Load progress
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

// Save progress
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

// Update UI
function updateUI() {
    const scoreElement = document.getElementById('player-score');
    const maxScoreElement = document.getElementById('max-score');
    
    if (scoreElement) scoreElement.textContent = playerScore;
    if (maxScoreElement) maxScoreElement.textContent = maxScore;
    
    updateLivesDisplay();
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
        console.error("Error loading heroes:", error);
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
    
    setTimeout(() => {
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
            resetGame(); // Полный сброс прогресса
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

// Hide all overlays - ТЕПЕРЬ СКРЫВАЕТ ТОЛЬКО ПРИ СМЕНЕ ПАРЫ
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

// Обновляем функцию showVoteResult - УБИРАЕМ старые проценты
function showVoteResult(heroNumber, userWon, selectedRating, otherRating) {
    const selectedHero = heroNumber;
    const otherHero = heroNumber === 1 ? 2 : 1;
    
    const selectedResult = document.getElementById(`hero${selectedHero}-result`);
    const otherResult = document.getElementById(`hero${otherHero}-result`);
    
    if (userWon) {
        showResultImage(selectedResult, 'win'); // Убираем проценты
        showResultImage(otherResult, 'lose');   // Убираем проценты
        
        // Показываем звезды с новыми процентами
        showStarRating(selectedHero, selectedRating, true);
        showStarRating(otherHero, otherRating, false);
    } else {
        showResultImage(selectedResult, 'lose'); // Убираем проценты
        showResultImage(otherResult, 'win');     // Убираем проценты
        
        // Показываем звезды с новыми процентами
        showStarRating(selectedHero, selectedRating, false);
        showStarRating(otherHero, otherRating, true);
    }
}


// Function to show result image with percentage - БЕЗ АВТОМАТИЧЕСКОГО СКРЫТИЯ
function showResultImage(element, type) {
    if (!element) return;
    
    const sprite = element.querySelector('.result-sprite');
    const percentElement = element.querySelector('.result-rating-percent');
    
    if (!sprite) return;
    
    // Set the image
    if (type === 'win') {
        sprite.style.backgroundImage = "url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Win.webp')";
    } else {
        sprite.style.backgroundImage = "url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Lose.webp')";
    }
    
    // Очищаем старые проценты
    if (percentElement) {
        percentElement.textContent = '';
    }
    
    // Show the overlay with animation
    element.className = `hero-result-overlay show ${type}`;
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

// Display heroes - ТЕПЕРЬ СКРЫВАЕТ ПРЕДЫДУЩИЕ ОВЕРЛЕИ ПЕРЕД ПОКАЗОМ НОВЫХ
function displayHeroes() {
    if (!gameActive) return;
    
    isVotingInProgress = false;
    currentVotePairId = null;
    
    // Скрываем оверлеи предыдущей пары ПЕРЕД показом новых героев
    hideAllOverlays();
    
    if (nextHeroes.length === 2) {
        currentHeroes = nextHeroes;
        nextHeroes = [];
    } else {
        currentHeroes = getRandomHeroes();
    }
    
    if (!currentHeroes) return;
    
    preloadNextPair();
    
    currentHeroes.forEach((hero, index) => {
        const heroNum = index + 1;
        const imgElement = document.getElementById(`hero${heroNum}-img`);
        const nameElement = document.getElementById(`hero${heroNum}-name`);
        const publisherElement = document.getElementById(`hero${heroNum}-publisher`);
        const alignmentElement = document.getElementById(`hero${heroNum}-alignment`);
        
        // Set hero image
        imgElement.src = hero.image_url;
        
        // Set hero name with auto-sizing
        nameElement.textContent = hero.name;
        if (hero.name.length > 12) {
            nameElement.style.fontSize = '6px';
        } else if (hero.name.length > 8) {
            nameElement.style.fontSize = '7px';
        } else {
            nameElement.style.fontSize = '8px';
        }
        
        // Set alignment
        const alignment = getHeroAlignment(hero.good_bad);
        alignmentElement.innerHTML = '';
        if (alignment.imageUrl) {
            const alignmentImg = document.createElement('img');
            alignmentImg.src = alignment.imageUrl;
            alignmentImg.alt = alignment.alt;
            alignmentImg.className = 'alignment-image';
            alignmentImg.loading = 'lazy';
            alignmentElement.appendChild(alignmentImg);
        } else {
            alignmentElement.textContent = alignment.alt;
        }
        
        // Set publisher logo
        publisherElement.innerHTML = '';
        if (hero.logo_url) {
            const logoImg = document.createElement('img');
            logoImg.src = hero.logo_url;
            logoImg.alt = hero.publisher || 'Publisher';
            logoImg.className = 'publisher-logo';
            logoImg.loading = 'lazy';
            publisherElement.appendChild(logoImg);
        }
    });
}

// Vote function - УВЕЛИЧИВАЕМ ЗАДЕРЖКУ ДО СМЕНЫ ПАРЫ
async function vote(heroNumber) {
    if (!gameActive || !currentHeroes || currentHeroes.length < 2 || 
        playerLives <= 0 || isVotingInProgress) {
        return;
    }
    
    isVotingInProgress = true;

    // Показываем анимацию выбора
    indicateSelection(heroNumber);
    
    const selectedHero = currentHeroes[heroNumber - 1];
    const otherHero = currentHeroes[heroNumber === 1 ? 1 : 0];
    
    const votePairId = `${selectedHero.id}-${otherHero.id}`;
    
    if (currentVotePairId === votePairId) {
        isVotingInProgress = false;
        return;
    }
    
    currentVotePairId = votePairId;
    
    const userMadeRightChoice = selectedHero.rating > otherHero.rating;
    
    // Показываем результат сразу
    if (userMadeRightChoice) {
        playSmokeAnimation(`hero${heroNumber}-blue-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/BlueSMoke256.webp");
        playSmokeAnimation(`hero${heroNumber === 1 ? 2 : 1}-gray-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/RedSmoke256.webp");
    } else {
        playSmokeAnimation(`hero${heroNumber}-gray-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/RedSmoke256.webp");
        playSmokeAnimation(`hero${heroNumber === 1 ? 2 : 1}-blue-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/BlueSMoke256.webp");
    }
    
    showVoteResult(heroNumber, userMadeRightChoice, selectedHero.rating, otherHero.rating);
    
    // ЗАДЕРЖКА перед начислением очков/жизней
    setTimeout(() => {
        // Начисляем очки/жизни только после задержки
        if (userMadeRightChoice) {
            playerScore++;
            if (tg) tg.HapticFeedback.impactOccurred('heavy');
        } else {
            playerLives--;
            if (tg) tg.HapticFeedback.impactOccurred('medium');
        }
        
        updateUI(); // Обновляем интерфейс
        
        votedHeroes.add(selectedHero.id);
        votedHeroes.add(otherHero.id);
        saveProgress();
        
        updateHeroStatsAsync(selectedHero.id, otherHero.id);
    }, 2500); // Задержка 1.5 секунды
    
    // УВЕЛИЧИВАЕМ ЗАДЕРЖКУ до 3 секунд перед сменой пары
    setTimeout(() => {
        isVotingInProgress = false;
        currentVotePairId = null;
        
        if (playerLives <= 0) {
            gameOver();
        } else if (gameActive) {
            displayHeroes();
        }
    }, 2500); // Увеличено до 3000 мс

    // Виброотдача при выборе
    playHaptic('selection');
    
    if (userMadeRightChoice) {
        playHaptic('correct');
    } else {
        playHaptic('wrong');
    }
}



// Функция показа звезды с рейтингом - ИСПРАВЛЕННАЯ
function showStarRating(heroNumber, rating, isWinner) {
    const starContainer = document.getElementById(`hero${heroNumber}-star-rating`);
    const starImage = starContainer.querySelector('.rating-star');
    const percentElement = starContainer.querySelector('.star-rating-percent');
    
    if (!starContainer || !starImage || !percentElement) return;
    
    // Устанавливаем цвет звезды
    starImage.src = isWinner 
        ? 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/StarBlue.webp'
        : 'https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/StarRed.webp';
    
    // Очищаем старые цифры
    percentElement.innerHTML = '';
    
    // Форматируем рейтинг с запятой и ОБЯЗАТЕЛЬНО добавляем знак %
    const ratingText = `${rating.toFixed(1)}%`.replace('.', ',');
    
    // Всегда используем картинки для цифр
    convertToImageBasedDigits(percentElement, ratingText);
    
    // Показываем звезду
    starContainer.classList.add('show');
    
    // Автоматически скрываем через 2.5 секунды
    setTimeout(() => {
        starContainer.classList.remove('show');
    }, 2500);
}

// Функция для создания цифр из картинок (исправленная)
function convertToImageBasedDigits(element, text) {
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === ',') {
            const commaSpan = document.createElement('span');
            commaSpan.className = 'digit comma';
            commaSpan.style.backgroundImage = `url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Numbers/comma.webp')`;
            element.appendChild(commaSpan);
        } else if (char === '%') {
            const percentSpan = document.createElement('span');
            percentSpan.className = 'digit percent';
            percentSpan.style.backgroundImage = `url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Numbers/percent.webp')`;
            element.appendChild(percentSpan);
        } else if (!isNaN(char) && char !== ' ') {
            const digitSpan = document.createElement('span');
            digitSpan.className = 'digit';
            digitSpan.style.backgroundImage = `url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Numbers/${char}.webp')`;
            element.appendChild(digitSpan);
        }
    }
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
        
        if (winnerFetchError || loserFetchError) {
            console.error("Fetch error:", winnerFetchError || loserFetchError);
            return;
        }
        
        const { error: winnerError } = await supabase
            .from('Heroes_Table')
            .update({ 
                wins: (winnerData.wins || 0) + 1,
                viewers: (winnerData.viewers || 0) + 1
            })
            .eq('id', winnerId);
        
        if (winnerError) console.error("Winner update error:", winnerError);
        
        const { error: loserError } = await supabase
            .from('Heroes_Table')
            .update({ 
                loses: (loserData.loses || 0) + 1,
                viewers: (loserData.viewers || 0) + 1
            })
            .eq('id', loserId);
        
        if (loserError) console.error("Loser update error:", loserError);
            
    } catch (error) {
        console.error("Stats update error:", error);
    }
}

// Smoke animation - FIXED with acceleration
function playSmokeAnimation(elementId, spriteUrl) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    // Полностью сбрасываем стили
    el.style.backgroundImage = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -50%) scale(0.65)';
    el.style.overflow = 'hidden'; // Обеспечиваем обрезку
    
    setTimeout(() => {
        // Устанавливаем спрайт
        el.style.backgroundImage = `url(${spriteUrl})`;
        el.style.backgroundSize = '1280px 1280px';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = '0px 0px';
        el.style.opacity = '1';
        el.style.overflow = 'hidden'; // Обеспечиваем обрезку
        el.classList.add("show");
        
        let frame = 0;
        const frameSize = 256;
        const framesPerRow = 5;
        const totalFrames = 25;
        
        // Разделяем анимацию на две части
        const slowFrames = 10; // Первые 15 кадров - нормальная скорость
        const fastFrames = 15; // Последние 10 кадров - ускоренные
        
        let currentInterval = 60; // Начальная скорость (медленно)
        
        function animateFrame() {
            if (frame >= totalFrames) {
                // Плавное завершение
                setTimeout(() => {
                    el.classList.remove("show");
                    el.style.opacity = '0';
                    setTimeout(() => {
                        el.style.backgroundImage = 'none';
                    }, 200);
                }, 150);
                return;
            }
            
            // Расчет позиции кадра с правильной обрезкой
            const col = frame % framesPerRow;
            const row = Math.floor(frame / framesPerRow);
            
            const x = -col * frameSize;
            const y = -row * frameSize;
            
            // Устанавливаем позицию - важно для избежания моргания
            el.style.backgroundPosition = `${x}px ${y}px`;
            
            // Плавное масштабирование в начале
            if (frame < 2) {
                const scale = 0.65 + (frame * 0.02);
                el.style.transform = `translate(-50%, -50%) scale(${scale})`;
            }
            // Плавное масштабирование в начале
            if (frame > 1) {
                const scale = 1 
                el.style.transform = `translate(-50%, -50%) scale(${scale})`;
            }
            
            frame++;
            
            // Динамическое изменение скорости - ПЛАВНОЕ УСКОРЕНИЕ
            if (frame === slowFrames) {
                // Резкий переход на быструю скорость
                currentInterval = 30;
            } else if (frame > slowFrames && frame < totalFrames - 2) {
                // Плавное дополнительное ускорение
                currentInterval = Math.max(20, 30 - (frame - slowFrames) * 2);
            }
            
            setTimeout(animateFrame, currentInterval);
        }
        
        // Начинаем анимацию
        animateFrame();
        
    }, 30);
}

// Упрощенная функция
function indicateSelection(heroNumber) {
    const container = document.querySelector(`#hero${heroNumber}`).closest('.hero-complete-container');
    if (!container) return;
    
    container.classList.add('selected');
    
    setTimeout(() => {
        container.classList.remove('selected');
    }, 300);
}

// Улучшенная система вибрации
function playHaptic(type) {
    // Сначала пробуем Telegram вибрацию
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
            return; // Если сработало, выходим
        } catch (e) {
            console.log("Telegram haptic failed");
        }
    }
    
    // Fallback: стандартная вибрация браузера (работает везде)
    if (navigator.vibrate) {
        switch(type) {
            case 'selection': navigator.vibrate(30); break;     // Короткий щелчок
            case 'correct': navigator.vibrate(80); break;       // Длинный позитивный
            case 'wrong': navigator.vibrate(150); break;        // Длинный негативный
            case 'game_over': navigator.vibrate([100, 50, 100]); break; // Паттерн проигрыша
            case 'win': navigator.vibrate([50, 30, 50, 30, 50]); break; // Паттерн победы
        }
    }
}

// Game over function
function gameOver() {
    gameActive = false;
    maxScore = Math.max(maxScore, playerScore);
    saveProgress();
    
    document.body.style.opacity = '0.7';
    playHaptic('game_over');
    setTimeout(() => {
        showGameOverPopup();
    }, 1000);
}

// Обработчик для кнопки "Try Again" в Game Over
function showGameOverPopup() {
    gameActive = false;
    maxScore = Math.max(maxScore, playerScore);
    saveProgress();
    
    document.body.style.opacity = '0.7';
    
    setTimeout(() => {
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
        
        document.getElementById('restart-button').addEventListener('click', function() {
            popup.remove();
            resetGame(); // Полный сброс прогресса
        });
    }, 1000);
    
    if (tg) tg.HapticFeedback.notificationOccurred('error');
}

// Reset game
// Reset game - ПОЛНЫЙ СБРОС ПРОГРЕССА
function resetGame() {
    // Полностью сбрасываем весь прогресс
    playerLives = 5;
    playerScore = 0;
    votedHeroes.clear();
    isVotingInProgress = false;
    currentVotePairId = null;
    gameActive = true;
    
    // Очищаем localStorage
    localStorage.removeItem('heroVoteProgress');
    localStorage.removeItem('heroGameStats');
    
    document.body.style.opacity = '1';
    updateUI();
    displayHeroes();
}

// DOM loaded
document.addEventListener("DOMContentLoaded", function() {
    initTelegram();
    loadAllHeroes();
    
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

// Escape handler - ДОБАВЛЯЕМ ПЕРЕЗАГРУЗКУ ПО F5
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
    
    // Добавляем обработку F5 для перезагрузки с полным сбросом (без подтверждения)
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        resetGame(); // Сразу сбрасываем без подтверждения
    }
});

// DOM loaded
document.addEventListener("DOMContentLoaded", function() {
    initTelegram();
    // Всегда сбрасываем игру при загрузке в Telegram
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        resetGame();
    }
    loadAllHeroes();
    
    // Hide unnecessary elements
    const elementsToHide = [
        'header h1',
        'header p',
        '.progress-container',
        '.rating-notice',
        'footer'
    ];
    if (e.key === 'Escape') {
        if (confirm('Exit the game?')) {
            if (tg && tg.close) {
                tg.close();
            } else {
                window.history.back();
            }
        }
    }
    elementsToHide.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) element.style.display = 'none';
    });
});



window.vote = vote;