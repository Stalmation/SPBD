// app.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Публичные данные для подключения (безопасно для браузера)
const SUPABASE_URL = "https://xwtcasfvetisjaiijtsj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные
let allHeroes = [];
let currentHeroes = [];
let nextHeroes = [];
let votedHeroes = new Set();
let tg = null;

// Инициализация Telegram Web App
function initTelegram() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        tg = Telegram.WebApp;
        
        // Меняем цвет фона Telegram
        tg.setBackgroundColor('#1a1a2e');
        
        // Скрываем кнопку назад если нужно
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
        if (savedProgress) {
            const parsedProgress = JSON.parse(savedProgress);
            
            // Multiple validation checks
            if (Array.isArray(parsedProgress) && 
                parsedProgress.every(item => typeof item === 'number' || typeof item === 'string')) {
                votedHeroes = new Set(parsedProgress);
            } else {
                console.warn("Invalid progress data format, resetting...");
                votedHeroes = new Set();
                localStorage.removeItem('heroVoteProgress');
            }
        } else {
            votedHeroes = new Set();
        }
        updateProgressBar();
    } catch (error) {
        console.error("Error loading progress:", error);
        votedHeroes = new Set();
        localStorage.removeItem('heroVoteProgress');
        updateProgressBar();
    }
}

// Сохранение прогресса
function saveProgress() {
    try {
        localStorage.setItem('heroVoteProgress', JSON.stringify(Array.from(votedHeroes)));
        updateProgressBar();
    } catch (error) {
        console.error("Error saving progress:", error);
    }
}

// Обновление прогрессбара
function updateProgressBar() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    const progress = (votedHeroes.size / allHeroes.length) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${votedHeroes.size}/${allHeroes.length}`;
}

// Загрузка всех героев из базы данных
async function loadAllHeroes() {
    console.log("Подключаемся к Supabase...");

    try {
        let { data, error } = await supabase
            .from("Heroes_Table")
            .select("id, name, image_url, wins, viewers, publisher, owner")
            .order('id');

        if (error) {
            console.error("Ошибка запроса:", error.message);
            return;
        }

        if (!data || data.length === 0) {
            console.error("База данных пустая или нет записей!");
            return;
        }

        console.log("Загружено героев:", data.length);
        allHeroes = data;
        
        // Загружаем прогресс из localStorage
        loadProgress();
        
        // Начинаем игру
        startGame();
        
    } catch (error) {
        console.error("Ошибка при загрузке героев:", error);
    }
}

// Предзагрузка изображений для следующей пары
function preloadNextPair() {
    const nextPair = getRandomHeroes();
    if (!nextPair) return;
    
    nextHeroes = nextPair;
    
    // Предзагружаем изображения для следующей пары
    nextPair.forEach(hero => {
        if (hero.image_url) {
            const img = new Image();
            img.src = hero.image_url;
        }
        if (hero.owner) {
            const logoImg = new Image();
            logoImg.src = hero.owner;
        }
    });
}

// Расчет рейтинга в процентах
function calculateRating(hero) {
    if (!hero.viewers || hero.viewers === 0) return 50;
    return (hero.wins / hero.viewers) * 100;
}

// Форматирование рейтинга
function formatRating(percent) {
    return percent.toFixed(1) + '%';
}

// Выбор случайных героев
function getRandomHeroes() {
    if (allHeroes.length < 2) return null;
    
    // Фильтруем героев, которых еще не голосовали
    const availableHeroes = allHeroes.filter(hero => !votedHeroes.has(hero.id));
    
    if (availableHeroes.length < 2) {
        // Если осталось меньше 2 героев, начинаем заново
        votedHeroes.clear();
        saveProgress();
        
        // Вибрация в Telegram при завершении
        if (tg) {
            tg.HapticFeedback.notificationOccurred('success');
        }
        
        return getRandomHeroes();
    }
    
    // Выбираем двух случайных героев
    const randomIndex1 = Math.floor(Math.random() * availableHeroes.length);
    let randomIndex2;
    
    do {
        randomIndex2 = Math.floor(Math.random() * availableHeroes.length);
    } while (randomIndex1 === randomIndex2);
    
    return [availableHeroes[randomIndex1], availableHeroes[randomIndex2]];
}

// Скрыть все оверлеи WIN/LOSE
function hideAllOverlays() {
    const overlays = document.querySelectorAll('.hero-win-overlay, .hero-lose-overlay');
    overlays.forEach(overlay => {
        overlay.classList.remove('show');
    });
}

// Отображение героев
function displayHeroes() {
    // Скрываем все оверлеи
    hideAllOverlays();
    
    // Используем предзагруженную пару если есть, иначе создаем новую
    if (nextHeroes.length === 2) {
        currentHeroes = nextHeroes;
        nextHeroes = [];
    } else {
        currentHeroes = getRandomHeroes();
    }
    
    // Предзагружаем следующую пару
    preloadNextPair();
    
    if (!currentHeroes) {
        return;
    }
    
    // Сбрасываем проценты в оверлеях
    document.getElementById('hero1-win-percent').textContent = '';
    document.getElementById('hero1-lose-percent').textContent = '';
    document.getElementById('hero2-win-percent').textContent = '';
    document.getElementById('hero2-lose-percent').textContent = '';
    
    // Отображаем первого героя
    document.getElementById('hero1-img').src = currentHeroes[0].image_url;
    document.getElementById('hero1-name').textContent = currentHeroes[0].name;
    
    // Отображаем логотип издателя
    const hero1Publisher = document.getElementById('hero1-publisher');
    hero1Publisher.innerHTML = '';
    if (currentHeroes[0].owner) {
        const logoImg = document.createElement('img');
        logoImg.src = currentHeroes[0].owner;
        logoImg.alt = currentHeroes[0].publisher;
        logoImg.className = 'publisher-logo';
        hero1Publisher.appendChild(logoImg);
    }
    
    // Отображаем второго героя
    document.getElementById('hero2-img').src = currentHeroes[1].image_url;
    document.getElementById('hero2-name').textContent = currentHeroes[1].name;
    
    // Отображаем логотип издателя
    const hero2Publisher = document.getElementById('hero2-publisher');
    hero2Publisher.innerHTML = '';
    if (currentHeroes[1].owner) {
        const logoImg = document.createElement('img');
        logoImg.src = currentHeroes[1].owner;
        logoImg.alt = currentHeroes[1].publisher;
        logoImg.className = 'publisher-logo';
        hero2Publisher.appendChild(logoImg);
    }
}

// Голосование
async function vote(heroNumber) {
    if (!currentHeroes || currentHeroes.length < 2) return;
    
    const selectedHero = currentHeroes[heroNumber - 1];
    const otherHero = currentHeroes[heroNumber === 1 ? 1 : 0];
    
    const selectedRating = calculateRating(selectedHero);
    const otherRating = calculateRating(otherHero);
    
    // Определяем, кто на самом деле сильнее
    const actualWinner = selectedRating > otherRating ? selectedHero : otherHero;
    const userSelectedWinner = selectedHero === actualWinner;
    
    // Добавляем в проголосованные
    votedHeroes.add(selectedHero.id);
    votedHeroes.add(otherHero.id);
    saveProgress();
    
    // Вибрация в Telegram
    if (tg) {
        if (userSelectedWinner) {
            tg.HapticFeedback.impactOccurred('heavy');
        } else {
            tg.HapticFeedback.impactOccurred('medium');
        }
    }
    
    // Показываем WIN/LOSE на картинках с процентами
    const winnerPercent = formatRating(calculateRating(actualWinner));
    const loserPercent = formatRating(calculateRating(userSelectedWinner ? otherHero : selectedHero));
    
    if (userSelectedWinner) {
        // Пользователь выбрал победителя
        document.getElementById(`hero${heroNumber}-win`).classList.add('show');
        document.getElementById(`hero${heroNumber}-win-percent`).textContent = winnerPercent;
        
        document.getElementById(`hero${heroNumber === 1 ? 2 : 1}-lose`).classList.add('show');
        document.getElementById(`hero${heroNumber === 1 ? 2 : 1}-lose-percent`).textContent = loserPercent;
    } else {
        // Пользователь выбрал проигравшего
        document.getElementById(`hero${heroNumber}-lose`).classList.add('show');
        document.getElementById(`hero${heroNumber}-lose-percent`).textContent = loserPercent;
        
        document.getElementById(`hero${heroNumber === 1 ? 2 : 1}-win`).classList.add('show');
        document.getElementById(`hero${heroNumber === 1 ? 2 : 1}-win-percent`).textContent = winnerPercent;
    }
    
    // Обновляем статистику в базе данных
    try {
        // Увеличиваем wins победителю и viewers обоим
        await supabase
            .from('Heroes_Table')
            .update({ 
                wins: (actualWinner.wins || 0) + 1,
                viewers: (actualWinner.viewers || 0) + 1
            })
            .eq('id', actualWinner.id);
        
        await supabase
            .from('Heroes_Table')
            .update({ 
                viewers: (otherHero.viewers || 0) + 1
            })
            .eq('id', otherHero.id);
            
    } catch (error) {
        console.error("Ошибка при обновлении статистики:", error);
    }
    
    // Ждем немного и показываем новых героев
    setTimeout(() => {
        displayHeroes();
    }, 2500);
}


// Начало игры
function startGame() {
    displayHeroes();
    updateProgressBar();
}

// Запуск при загрузке DOM
document.addEventListener("DOMContentLoaded", function() {
    initTelegram();
    loadAllHeroes();
});

// Делаем функции глобальными для использования в HTML
window.vote = vote;
