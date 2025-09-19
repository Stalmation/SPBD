// app.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://xwtcasfvetisjaiijtsj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные
let allHeroes = [];
let currentHeroes = [];
let nextHeroes = [];
let votedHeroes = new Set();

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

// Загрузка прогресса
function loadProgress() {
    const savedProgress = localStorage.getItem('heroVoteProgress');
    if (savedProgress) {
        votedHeroes = new Set(JSON.parse(savedProgress));
        updateProgressBar();
    }
}

// Сохранение прогресса
function saveProgress() {
    localStorage.setItem('heroVoteProgress', JSON.stringify(Array.from(votedHeroes)));
    updateProgressBar();
}

// Обновление прогрессбара
function updateProgressBar() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    const progress = (votedHeroes.size / allHeroes.length) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${votedHeroes.size}/${allHeroes.length}`;
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

// Отображение героев
function displayHeroes() {
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
        document.getElementById('result').textContent = "Недостаточно героев для голосования!";
        return;
    }
    
    // Сбрасываем результат
    document.getElementById('result').textContent = '';
    document.getElementById('result').className = '';
    document.getElementById('rating-info').style.display = 'none';
    
    // Отображаем первого героя (ПОЛНОСТЬЮ СКРЫВАЕМ РЕЙТИНГ)
    document.getElementById('hero1-img').src = currentHeroes[0].image_url;
    document.getElementById('hero1-name').textContent = currentHeroes[0].name;
    document.getElementById('hero1-rating').textContent = ''; // Полностью пусто
    
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
    
    // Отображаем второго героя (ПОЛНОСТЬЮ СКРЫВАЕМ РЕЙТИНГ)
    document.getElementById('hero2-img').src = currentHeroes[1].image_url;
    document.getElementById('hero2-name').textContent = currentHeroes[1].name;
    document.getElementById('hero2-rating').textContent = ''; // Полностью пусто
    
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
    
    const winner = currentHeroes[heroNumber - 1];
    const loser = currentHeroes[heroNumber === 1 ? 1 : 0];
    
    const winnerRating = calculateRating(winner);
    const loserRating = calculateRating(loser);
    
    // Определяем, угадал ли пользователь
    const userGuessedCorrectly = heroNumber === (winnerRating > loserRating ? 1 : 2);
    
    // Добавляем в проголосованные
    votedHeroes.add(winner.id);
    votedHeroes.add(loser.id);
    saveProgress();
    
    // Показываем результат
    const resultElement = document.getElementById('result');
    if (userGuessedCorrectly) {
        resultElement.textContent = `🎉 ПОБЕДА! ${winner.name} побеждает!`;
        resultElement.className = 'result win';
    } else {
        resultElement.textContent = `💥 ПРОИГРЫШ! ${winner.name} был сильнее!`;
        resultElement.className = 'result lose';
    }
    
    // Показываем реальные рейтинги после выбора
    document.getElementById('hero1-rating').textContent = formatRating(calculateRating(currentHeroes[0]));
    document.getElementById('hero2-rating').textContent = formatRating(calculateRating(currentHeroes[1]));
    
    // Обновляем статистику в базе данных
    try {
        // Увеличиваем wins победителю и viewers обоим
        await supabase
            .from('Heroes_Table')
            .update({ 
                wins: (winner.wins || 0) + 1,
                viewers: (winner.viewers || 0) + 1
            })
            .eq('id', winner.id);
        
        await supabase
            .from('Heroes_Table')
            .update({ 
                viewers: (loser.viewers || 0) + 1
            })
            .eq('id', loser.id);
            
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
document.addEventListener("DOMContentLoaded", loadAllHeroes);

// Делаем функции глобальными для использования в HTML
window.vote = vote;