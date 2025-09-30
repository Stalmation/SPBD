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
let animationTimeouts = [];

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
    
    // Запланировать скрытие анимаций через 2 секунды (перед появлением новой пары)
    animationTimeouts.push(setTimeout(() => {
        hideAnimations();
    }, 2000));
}

// Новая функция для скрытия анимаций с реверсом
function hideAnimations() {
    // Скрываем оверлеи с анимацией исчезновения
    const overlays = document.querySelectorAll('.hero-result-overlay.show');
    overlays.forEach(overlay => {
        overlay.classList.remove('show');
        overlay.classList.add('hiding');
    });
    
    // Скрываем звезды с анимацией исчезновения
    const starContainers = document.querySelectorAll('.star-rating-container.show');
    starContainers.forEach(container => {
        container.classList.remove('show');
        container.classList.add('hiding');
    });
    
    // Убираем класс hiding после завершения анимации
    setTimeout(() => {
        overlays.forEach(overlay => overlay.classList.remove('hiding'));
        starContainers.forEach(container => container.classList.remove('hiding'));
    }, 300);
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
    
    // Очищаем таймауты анимаций
    animationTimeouts.forEach(timeout => clearTimeout(timeout));
    animationTimeouts = [];
    
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
    
    currentHeroes.forEach((hero, index) => {
        const heroNum = index + 1;
        const imgElement = document.getElementById(`hero${heroNum}-img`);
        const nameElement = document.getElementById(`hero${heroNum}-name`);
        const publisherElement = document.getElementById(`hero${heroNum}-publisher`);
        const alignmentElement = document.getElementById(`hero${heroNum}-alignment`);
        
        // Set hero image
        if (imgElement) imgElement.src = hero.image_url;
        
        // Set hero name with improved font handling
        if (nameElement) {
            nameElement.textContent = hero.name;
            // Упрощаем авто-размер шрифта
            if (hero.name.length > 15) {
                nameElement.style.fontSize = '5px';
            } else if (hero.name.length > 10) {
                nameElement.style.fontSize = '6px';
            } else {
                nameElement.style.fontSize = '7px';
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

// Vote function - УВЕЛИЧИВАЕМ ЗАДЕРЖКУ ДО СМЕНЫ ПАРЫ
async function vote(heroNumber) {
    if (!gameActive || !currentHeroes || currentHeroes.length < 2 || 
        playerLives <= 0 || isVotingInProgress) {
        return;
    }
    
    isVotingInProgress = true;

    // Очищаем предыдущие таймауты анимаций
    animationTimeouts.forEach(timeout => clearTimeout(timeout));
    animationTimeouts = [];

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
    
    // Виброотдача при выборе - ИСПРАВЛЕНО
    playHaptic('selection');
    
    if (userMadeRightChoice) {
        playSmokeAnimation(`hero${heroNumber}-blue-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/BlueSMoke256.webp");
        playSmokeAnimation(`hero${heroNumber === 1 ? 2 : 1}-gray-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/RedSmoke256.webp");
        playHaptic('correct'); // Виброотдача для правильного ответа
    } else {
        playSmokeAnimation(`hero${heroNumber}-gray-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/RedSmoke256.webp");
        playSmokeAnimation(`hero${heroNumber === 1 ? 2 : 1}-blue-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/BlueSMoke256.webp");
        playHaptic('wrong'); // Виброотдача для неправильного ответа
    }
    
    showVoteResult(heroNumber, userMadeRightChoice, selectedHero.rating, otherHero.rating);
    
    // Задержка перед начислением очков/жизней
    setTimeout(() => {
        if (userMadeRightChoice) {
            playerScore++;
        } else {
            playerLives--;
            // Запускаем анимацию удаления жизни
            updateLivesWithAnimation();
        }
        
        updateUI();
        
        votedHeroes.add(selectedHero.id);
        votedHeroes.add(otherHero.id);
        saveProgress();
        
        updateHeroStatsAsync(selectedHero.id, otherHero.id);
    }, 2500);
    
    // Задержка перед сменой пары (увеличена для завершения анимаций)
    setTimeout(() => {
        isVotingInProgress = false;
        currentVotePairId = null;
        
        if (playerLives <= 0) {
            gameOver();
        } else if (gameActive) {
            displayHeroes();
        }
    }, 2500);
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
    
    // Форматируем рейтинг с запятой БЕЗ знака %
    const ratingText = `${rating.toFixed(1)}`.replace('.', ',');
    
    // Всегда используем картинки для цифр
    convertToImageBasedDigits(percentElement, ratingText);
    
    // Показываем звезду
    starContainer.classList.add('show');
    
    // Автоматически скрываем через 1.8 секунды (синхронизируем с общей анимацией)
    setTimeout(() => {
        starContainer.classList.add('hiding');
    }, 2000);
}


// И добавьте эту функцию обратно:
function updateLivesWithAnimation() {
    const globalLives = document.getElementById('global-lives');
    if (!globalLives) return;
    
    const lifeStars = globalLives.querySelectorAll('.life-star');
    if (lifeStars.length > 0) {
        const lastLifeStar = lifeStars[lifeStars.length - 1];
        
        // Добавляем класс для анимации исчезновения
        lastLifeStar.classList.add('life-star-removing');
        
        // Удаляем элемент после завершения анимации
        setTimeout(() => {
            if (lastLifeStar.parentNode === globalLives) {
                globalLives.removeChild(lastLifeStar);
            }
        }, 400); // Длительность анимации
    }
}

// Функция для создания цифр из картинок (обновленная - без %)
function convertToImageBasedDigits(element, text) {
    element.innerHTML = ''; // Очищаем элемент
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === ',' || char === '.') {
            const dotSpan = document.createElement('span');
            dotSpan.className = 'digit comma';
            dotSpan.style.backgroundImage = `url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Numbers/dot.webp')`;
            element.appendChild(dotSpan);
        } else if (!isNaN(char) && char !== ' ') {
            const digitSpan = document.createElement('span');
            digitSpan.className = 'digit';
            digitSpan.style.backgroundImage = `url('https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Images/Numbers/${char}.webp')`;
            element.appendChild(digitSpan);
        }
        // Убираем обработку знака %
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

// Улучшаем функцию вибрации
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
            console.log(`Haptic: ${type}`);
            return;
        } catch (e) {
            console.log("Telegram haptic failed:", e);
        }
    }
    
    // Fallback: стандартная вибрация браузера
    if (navigator.vibrate) {
        switch(type) {
            case 'selection': navigator.vibrate(50); break;
            case 'correct': navigator.vibrate([50, 30, 50]); break;
            case 'wrong': navigator.vibrate(100); break;
            case 'game_over': navigator.vibrate([100, 50, 100]); break;
            case 'win': navigator.vibrate([50, 30, 50, 30, 50]); break;
        }
        console.log(`Fallback haptic: ${type}`);
    } else {
        console.log(`Haptic not supported for: ${type}`);
    }
}

// Новая функция для показа приветственного дисклеймера
function showWelcomeDisclaimer() {
    const hasSeenDisclaimer = localStorage.getItem('hasSeenDisclaimer');
    
    if (!hasSeenDisclaimer) {
        setTimeout(() => {
            const popup = document.createElement('div');
            popup.className = 'game-over-popup';
            popup.innerHTML = `
                <div class="popup-content">
                    <h2>🎮 SUPER POWER BEAT DOWN</h2>
                    <div style="text-align: left; margin: 15px 0;">
                        <p><strong>Правила игры:</strong></p>
                        <p>• Выбирайте героя с более высоким рейтингом</p>
                        <p>• У вас есть 5 жизней</p>
                        <p>• За правильный выбор получаете +1 очко</p>
                        <p>• За ошибку теряете 1 жизнь</p>
                        <p>• Играйте пока не закончатся герои или жизни!</p>
                    </div>
                    <button id="understand-button">ПОНЯТНО!</button>
                </div>
            `;
            
            document.body.appendChild(popup);
            
            document.getElementById('understand-button').addEventListener('click', function() {
                localStorage.setItem('hasSeenDisclaimer', 'true');
                popup.remove();
                document.body.style.opacity = '1';
            });
        }, 500);
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