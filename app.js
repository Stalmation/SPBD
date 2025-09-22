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
    
    // Обновляем отображение жизней в виде звезд
    updateLivesDisplay();
}

function updateLivesDisplay() {
    const globalLives = document.getElementById('global-lives');
    
    if (globalLives) {
        // Очищаем контейнер
        globalLives.innerHTML = '';
        
        // Добавляем звезды по количеству жизней (горизонтально)
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

        // Add logo URLs to each hero
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

// Completion screen
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
            resetGameProgress();
            resetGame();
        });
    }, 1000);
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
    const overlays = document.querySelectorAll('.hero-win-overlay, .hero-lose-overlay');
    overlays.forEach(overlay => overlay.classList.remove('show'));
    
    const smokeEffects = document.querySelectorAll('.smoke-effect');
    smokeEffects.forEach(smoke => smoke.classList.remove('show'));
}

// Get hero alignment
function getHeroAlignment(goodBad) {
    switch(goodBad) {
        case 1: return { text: 'HERO', color: '#0098d0' };
        case 2: return { text: 'EVIL', color: '#e00f0f' };
        case 3: return { text: 'ANTI<br>HERO', color: '#adadadff' };
        default: return { text: 'UNKNOWN', color: '#adadad' };
    }
}

// Display heroes
function displayHeroes() {
    if (!gameActive) return;
    
    isVotingInProgress = false;
    currentVotePairId = null;
    
    hideAllOverlays();
    
    if (nextHeroes.length === 2) {
        currentHeroes = nextHeroes;
        nextHeroes = [];
    } else {
        currentHeroes = getRandomHeroes();
    }
    
    if (!currentHeroes) return;
    
    preloadNextPair();
    
    // Clear percentages
    ['hero1', 'hero2'].forEach(hero => {
        document.getElementById(`${hero}-win-percent`).textContent = '';
        document.getElementById(`${hero}-lose-percent`).textContent = '';
    });
    
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
        alignmentElement.innerHTML = alignment.text;
        alignmentElement.style.color = alignment.color;
        
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

// Vote function
async function vote(heroNumber) {
    if (!gameActive || !currentHeroes || currentHeroes.length < 2 || 
        playerLives <= 0 || isVotingInProgress) {
        return;
    }
    
    isVotingInProgress = true;
    
    const selectedHero = currentHeroes[heroNumber - 1];
    const otherHero = currentHeroes[heroNumber === 1 ? 1 : 0];
    
    const votePairId = `${selectedHero.id}-${otherHero.id}`;
    
    if (currentVotePairId === votePairId) {
        isVotingInProgress = false;
        return;
    }
    
    currentVotePairId = votePairId;
    
    const userMadeRightChoice = selectedHero.rating > otherHero.rating;
    
    // Show instant result
    if (userMadeRightChoice) {
        playerScore++;
        if (tg) tg.HapticFeedback.impactOccurred('heavy');
        
        playSmokeAnimation(`hero${heroNumber}-blue-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/BlueSMoke256.png");
        playSmokeAnimation(`hero${heroNumber === 1 ? 2 : 1}-gray-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/GraySmoke256.png");
    } else {
        playerLives--;
        if (tg) tg.HapticFeedback.impactOccurred('medium');
        
        playSmokeAnimation(`hero${heroNumber}-gray-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/GraySmoke256.png");
        playSmokeAnimation(`hero${heroNumber === 1 ? 2 : 1}-blue-smoke`, "https://xwtcasfvetisjaiijtsj.supabase.co/storage/v1/object/public/Heroes/Sprites/BlueSMoke256.png");
    }
    
    showVoteResult(heroNumber, userMadeRightChoice, selectedHero.rating, otherHero.rating);
    
    votedHeroes.add(selectedHero.id);
    votedHeroes.add(otherHero.id);
    saveProgress();
    
    updateHeroStatsAsync(selectedHero.id, otherHero.id);
    
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

// Show vote result
function showVoteResult(heroNumber, userWon, selectedRating, otherRating) {
    const selectedHero = heroNumber;
    const otherHero = heroNumber === 1 ? 2 : 1;
    
    if (userWon) {
        document.getElementById(`hero${selectedHero}-win`).classList.add('show');
        document.getElementById(`hero${otherHero}-lose`).classList.add('show');
        document.getElementById(`hero${selectedHero}-win-percent`).textContent = `${selectedRating.toFixed(1)}%`;
        document.getElementById(`hero${otherHero}-lose-percent`).textContent = `${otherRating.toFixed(1)}%`;
    } else {
        document.getElementById(`hero${selectedHero}-lose`).classList.add('show');
        document.getElementById(`hero${otherHero}-win`).classList.add('show');
        document.getElementById(`hero${selectedHero}-lose-percent`).textContent = `${selectedRating.toFixed(1)}%`;
        document.getElementById(`hero${otherHero}-win-percent`).textContent = `${otherRating.toFixed(1)}%`;
    }
}

// Smoke animation
function playSmokeAnimation(elementId, spriteUrl) {
    const el = document.getElementById(elementId);
    el.style.backgroundImage = `url(${spriteUrl})`;
    el.style.backgroundSize = '1280px 1280px';
    el.style.backgroundRepeat = 'no-repeat';
    el.classList.add("show");

    let frame = 0;
    const frameSize = 256;
    const framesPerRow = 5;
    const totalFrames = 25;
    const slowFrames = Math.floor(totalFrames / 2);
    const fastFrames = totalFrames - slowFrames;

    let intervalSpeed = 60;
    
    function animateFrame() {
        if (frame >= totalFrames) {
            setTimeout(() => {
                el.classList.remove("show");
                el.style.backgroundImage = 'none';
                el.style.backgroundPosition = "0px 0px";
            }, 100);
            return;
        }

        const col = frame % framesPerRow;
        const row = Math.floor(frame / framesPerRow);
        
        const x = -col * frameSize;
        const y = -row * frameSize;
        
        el.style.backgroundPosition = `${x}px ${y}px`;

        frame++;
        
        if (frame === slowFrames) {
            intervalSpeed = 30;
        }
        
        setTimeout(animateFrame, intervalSpeed);
    }

    setTimeout(animateFrame, intervalSpeed);
}

// Game over
function gameOver() {
    gameActive = false;
    maxScore = Math.max(maxScore, playerScore);
    saveProgress();
    
    document.body.style.opacity = '0.7';
    
    setTimeout(() => {
        showGameOverPopup();
    }, 1000);
}

// Game over popup
function showGameOverPopup() {
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
        resetGame();
    });
    
    if (tg) tg.HapticFeedback.notificationOccurred('error');
}

// Reset game
function resetGame() {
    playerLives = 5;
    playerScore = 0;
    isVotingInProgress = false;
    currentVotePairId = null;
    gameActive = true;
    
    document.body.style.opacity = '1';
    updateUI(); // Эта функция уже включает updateLivesDisplay()
    displayHeroes();
}

// Reset game progress
function resetGameProgress() {
    playerLives = 5;
    playerScore = 0;
    votedHeroes.clear();
    maxScore = 0;
    isVotingInProgress = false;
    currentVotePairId = null;
    localStorage.removeItem('heroVoteProgress');
    localStorage.removeItem('heroGameStats');
    updateUI();
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
});

window.vote = vote;