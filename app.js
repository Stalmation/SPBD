// app.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://xwtcasfvetisjaiijtsj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные
let allHeroes = [];
let currentHeroes = [];
let votedHeroes = new Set();
let imageCache = new Map();

// Загрузка всех героев из базы данных
async function loadAllHeroes() {
    console.log("Подключаемся к Supabase...");

    try {
        let { data, error } = await supabase
            .from("Heroes_Table")
            .select("id, name, image_url, wins, shows, publisher")
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
        
        // Предзагрузка изображений
        preloadImages();
        
        // Загружаем прогресс из localStorage
        loadProgress();
        
        // Начинаем игру
        startGame();
        
    } catch (error) {
        console.error("Ошибка при загрузке героев:", error);
    }
}

// Предзагрузка изображений
function preloadImages() {
    const preloadContainer = document.getElementById('image-preload');
    allHeroes.forEach(hero => {
        if (hero.image_url) {
            const img = new Image();
            img.src = hero.image_url;
            img.onload = () => {
                imageCache.set(hero.id, hero.image_url);
            };
            preloadContainer.appendChild(img);
        }
    });
}

// Расчет рейтинга в процентах
function calculateRating(hero) {
    if (!hero.shows || hero.shows === 0) return 0;
    return (hero.wins / hero.shows) * 100;
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
    currentHeroes = getRandomHeroes();
    
    if (!currentHeroes) {
        document.getElementById('result').textContent = "Недостаточно героев для голосования!";
        return;
    }
    
    // Отображаем первого героя
    const hero1Rating = calculateRating(currentHeroes[0]);
    document.getElementById('hero1-img').src = currentHeroes[0].image_url;
    document.getElementById('hero1-name').textContent = currentHeroes[0].name;
    document.getElementById('hero1-rating').textContent = `Рейтинг: ${formatRating(hero1Rating)}`;
    document.getElementById('hero1-publisher').textContent = currentHeroes[0].publisher || '';
    
    // Отображаем второго героя
    const hero2Rating = calculateRating(currentHeroes[1]);
    document.getElementById('hero2-img').src = currentHeroes[1].image_url;
    document.getElementById('hero2-name').textContent = currentHeroes[1].name;
    document.getElementById('hero2-rating').textContent = `Рейтинг: ${formatRating(hero2Rating)}`;
    document.getElementById('hero2-publisher').textContent = currentHeroes[1].publisher || '';
    
    // Скрываем информацию о рейтингах
    document.getElementById('rating-info').style.display = 'none';
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
    let resultMessage = `Вы выбрали: ${winner.name}! `;
    resultMessage += userGuessedCorrectly ? "✅ Вы угадали!" : "❌ Вы не угадали!";
    
    document.getElementById('result').textContent = resultMessage;
    
    // Показываем реальные рейтинги
    const ratingInfo = document.getElementById('rating-info');
    ratingInfo.innerHTML = `
        <div class="rating-comparison">
            <div>${winner.name}: ${formatRating(winnerRating)}</div>
            <div>${loser.name}: ${formatRating(loserRating)}</div>
        </div>
    `;
    ratingInfo.style.display = 'block';
    
    // Обновляем статистику в базе данных
    try {
        // Увеличиваем wins победителю и shows обоим
        await supabase
            .from('Heroes_Table')
            .update({ 
                wins: (winner.wins || 0) + 1,
                shows: (winner.shows || 0) + 1
            })
            .eq('id', winner.id);
        
        await supabase
            .from('Heroes_Table')
            .update({ 
                shows: (loser.shows || 0) + 1
            })
            .eq('id', loser.id);
            
    } catch (error) {
        console.error("Ошибка при обновлении статистики:", error);
    }
    
    // Ждем немного и показываем новых героев
    setTimeout(() => {
        document.getElementById('result').textContent = '';
        document.getElementById('rating-info').style.display = 'none';
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