// app.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://xwtcasfvetisjaiijtsj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s";

// Добавляем в начало файла константы для управления таймингами
const HERO_DISPLAY_DURATION = 3000; // Основное время показа пары героев (можно менять)

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

function updateUI() {
    const scoreElement = document.getElementById('player-score');
    const maxScoreElement = document.getElementById('max-score');
    
    if (scoreElement) scoreElement.textContent = playerScore;
    if (maxScoreElement) maxScoreElement.textContent = maxScore;
    
    // НЕ обновляем отображение жизней здесь, только если не в процессе анимации
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
        console.error("Error loading heroes:", error);
    }
}

// Start game
function startGame() {
    gameActive = true;
    displayHeroes();
    updateUI();
}

// Get random heroes - ОРИГИНАЛЬНАЯ ЛОГИКА ИЗ ПЕРВОГО ФАЙЛА
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

// Preload next pair - ОРИГИНАЛЬНАЯ ЛОГИКА ИЗ ПЕРВОГО ФАЙЛА
function preloadNextPair() {
    const nextPair = getRandomHeroes();
    if (!nextPair) return;
    nextHeroes = nextPair;
    nextPair.forEach(hero => {
        if (hero.image_url) new Image().src = hero.image_url;
        if (hero.logo_url) new Image().src = hero.logo_url;
    });
}

// ОЧИСТКА АНИМАЦИЙ - НОВАЯ ОПТИМИЗАЦИЯ
function cleanupCurrentAnimations() {
    animationTimeouts.forEach(timeout => clearTimeout(timeout));
    animationTimeouts = [];
    
    hideAllOverlays();
    
    document.querySelectorAll('.smoke-effect').forEach(el => {
        el.classList.remove('show');
        el.style.backgroundImage = 'none';
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
    }, 600);
}

// Обновляем функцию showVoteResult с синхронизированными таймингами
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

// Обновляем функцию showResultImage с синхронизированными таймингами
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
    
    // СИНХРОНИЗИРУЕМ С ЗВЕЗДАМИ: показываем с задержкой 50ms и скрываем через HERO_DISPLAY_DURATION - 500ms
    setTimeout(() => {
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

// Display heroes - ОРИГИНАЛЬНАЯ ЛОГИКА ИЗ ПЕРВОГО ФАЙЛА
function displayHeroes() {
    if (!gameActive) return;
    
    isVotingInProgress = false;
    currentVotePairId = null;
    
    // Очищаем таймауты анимаций - НОВАЯ ОПТИМИЗАЦИЯ
    cleanupCurrentAnimations();
    
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

// Обновляем функцию vote с синхронизированными таймингами
async function vote(heroNumber) {
    if (!gameActive || !currentHeroes || currentHeroes.length < 2 || 
        playerLives <= 0 || isVotingInProgress) {
        return;
    }
    
    isVotingInProgress = true;

    // Очищаем предыдущие таймауты анимаций - НОВАЯ ОПТИМИЗАЦИЯ
    cleanupCurrentAnimations();

    indicateSelection(heroNumber);
    
    const selectedHero = currentHeroes[heroNumber - 1];
    const otherHero = currentHeroes[heroNumber === 1 ? 1 : 0]; // ОРИГИНАЛЬНАЯ ЛОГИКА
    
    const votePairId = `${selectedHero.id}-${otherHero.id}`;
    
    if (currentVotePairId === votePairId) {
        isVotingInProgress = false;
        return;
    }
    
    currentVotePairId = votePairId;
    
    // ОРИГИНАЛЬНАЯ ЛОГИКА СРАВНЕНИЯ РЕЙТИНГОВ
    const userMadeRightChoice = selectedHero.rating > otherHero.rating;
    
    // Виброотдача при выборе
    playHaptic('selection');
    
    // Запускаем дым сразу
    setTimeout(() => {
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
    
    // Показываем результаты сразу
    showVoteResult(heroNumber, userMadeRightChoice, selectedHero.rating, otherHero.rating);
    
    // Отнимание жизни раньше (например, за 800ms до основной логики)
    setTimeout(() => {
        if (!userMadeRightChoice) {
            playerLives--;
            updateLivesWithAnimation();
            // Обновляем UI сразу для отображения измененных жизней
            updateUI();
        }
    }, HERO_DISPLAY_DURATION - 500);

    // Основная логика через 500ms (как было изначально)
    setTimeout(() => {
        if (userMadeRightChoice) {
            playerScore++;
            // UI обновляется здесь для правильного выбора
            updateUI();
        }
        // Для неправильного выбора UI уже обновлен выше, 
        // но если нужно обновить что-то еще, можно оставить
        
        votedHeroes.add(selectedHero.id);
        votedHeroes.add(otherHero.id);
        saveProgress();
        
        updateHeroStatsAsync(selectedHero.id, otherHero.id);
    }, HERO_DISPLAY_DURATION);
    
    // Скрываем анимации за 300ms до смены героев
    setTimeout(() => {
        hideAnimations();
    }, HERO_DISPLAY_DURATION - 500);
    
    // Смена пары героев через HERO_DISPLAY_DURATION
    setTimeout(() => {
        isVotingInProgress = false;
        currentVotePairId = null;
        
        if (playerLives <= 0) {
            setTimeout(() => {
                gameOver();
            }, 500);
        } else if (gameActive) {
            displayHeroes();
        }
    }, HERO_DISPLAY_DURATION);
}

// Обновляем функцию showStarRating с синхронизированными таймингами
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
    
    setTimeout(() => {
        starContainer.classList.add('show');
    }, 50);
    
    // УБИРАЕМ лишнее скрытие здесь - оно будет в hideAnimations()
}

function updateLivesWithAnimation() {
    const globalLives = document.getElementById('global-lives');
    if (!globalLives) return;
    
    const lifeStars = globalLives.querySelectorAll('.life-star');
    if (lifeStars.length > 0) {
        const lastLifeStar = lifeStars[lifeStars.length - 1];
        
        // Удаляем класс анимации если был добавлен ранее
        lastLifeStar.classList.remove('life-star-removing');
        
        // Принудительно перезапускаем анимацию
        void lastLifeStar.offsetWidth;
        
        // Добавляем класс для анимации исчезновения
        lastLifeStar.classList.add('life-star-removing');
        
        // Увеличиваем время удаления элемента чтобы анимация успела завершиться
        setTimeout(() => {
            if (lastLifeStar.parentNode === globalLives && lastLifeStar.classList.contains('life-star-removing')) {
                globalLives.removeChild(lastLifeStar);
            }
        }, 400); // Увеличиваем с 400 до 600мс
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

// Async stats update - ОРИГИНАЛЬНАЯ ЛОГИКА
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

// Обновляем функцию playSmokeAnimation с фиксированной длительностью
function playSmokeAnimation(elementId, spriteUrl) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    // Полностью сбрасываем стили
    el.style.backgroundImage = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -50%) scale(0.65)';
    el.style.overflow = 'hidden';
    
    setTimeout(() => {
        // Устанавливаем спрайт
        el.style.backgroundImage = `url(${spriteUrl})`;
        el.style.backgroundSize = '1280px 1280px';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = '0px 0px';
        el.style.opacity = '1';
        el.style.overflow = 'hidden';
        el.classList.add("show");
        
        let frame = 0;
        const frameSize = 256;
        const framesPerRow = 5;
        const totalFrames = 25;
        
        // Фиксированная скорость анимации дыма (не зависит от HERO_DISPLAY_DURATION)
        const slowFrames = 10;
        const fastFrames = 15;
        
        const slowFrameTime = 60; // Медленные кадры
        const fastFrameTime = 30; // Быстрые кадры
        
        let currentInterval = slowFrameTime;
        
        function animateFrame() {
            if (frame >= totalFrames) {
                // Автоматически скрываем дым через HERO_DISPLAY_DURATION - 300ms
                setTimeout(() => {
                    el.classList.remove("show");
                    el.style.opacity = '0';
                    setTimeout(() => {
                        el.style.backgroundImage = 'none';
                    }, 200);
                }, HERO_DISPLAY_DURATION - 300 - (totalFrames * (slowFrameTime + fastFrameTime) / 2));
                return;
            }
            
            const col = frame % framesPerRow;
            const row = Math.floor(frame / framesPerRow);
            
            const x = -col * frameSize;
            const y = -row * frameSize;
            
            el.style.backgroundPosition = `${x}px ${y}px`;
            
            // УСЛОВИЕ ДЛЯ БОЛЬШИХ ЭКРАНОВ
            if (window.innerWidth >= 769) {
                // Для больших экранов - увеличенный масштаб
                if (frame < 2) {
                    const scale = 0.50 + (frame * 0.03);
                    el.style.transform = `translate(-50%, -55%) scale(${scale})`;
                }
                if (frame > 1) {
                    const scale = 1.3; // Увеличиваем масштаб для больших экранов
                    el.style.transform = `translate(-50%, -50%) scale(${scale})`;
                }
            } else {
                // Для мобильных - стандартный масштаб
                if (frame < 2) {
                    const scale = 0.40 + (frame * 0.02);
                    el.style.transform = `translate(-50%, -55%) scale(${scale})`;
                }
                if (frame > 1) {
                    const scale = 0.8; // Стандартный масштаб для мобильных
                    el.style.transform = `translate(-50%, -50%) scale(${scale})`;
                }
            }
            
            frame++;
            
            if (frame === slowFrames) {
                currentInterval = fastFrameTime;
            }
            
            setTimeout(animateFrame, currentInterval);
        }
        
        animateFrame();
        
    }, 50);
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
                <h2>GAME OVER</h2>
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

// Защита от зажатия экрана - НОВАЯ ФУНКЦИЯ
function setupTouchProtection() {
    document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('touchend', function(e) {
        const now = Date.now();
        if (now - (lastTap || 0) < 300) {
            e.preventDefault();
        }
        lastTap = now;
    }, { passive: false });
    
    // Запрет контекстного меню
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
}

let lastTap = 0;

// DOM loaded
document.addEventListener("DOMContentLoaded", function() {
    initTelegram();
    loadAllHeroes();
    
    // Добавляем защиту от зажатия экрана
    setupTouchProtection();

    // Добавляем вызов дисклеймера
    setTimeout(() => {
        showWelcomeDisclaimer();
    }, 1000);
    
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

window.vote = vote;