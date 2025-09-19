// app.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ⚡ сюда вставь свои данные
const SUPABASE_URL = "https://xwtcasfvetisjaiijtsj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные
let allHeroes = [];
let currentHeroes = [];
let votedHeroes = new Set();

// Загрузка всех героев из базы данных
async function loadAllHeroes() {
    console.log("Подключаемся к Supabase...");

    try {
        // запрос к таблице Heroes_Table
        let { data, error } = await supabase
            .from("Heroes_Table")
            .select("id, name, image_url, rating, publisher")
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
    document.getElementById('hero1-img').src = currentHeroes[0].image_url;
    document.getElementById('hero1-name').textContent = currentHeroes[0].name;
    document.getElementById('hero1-rating').textContent = `Рейтинг: ${currentHeroes[0].rating || 0}`;
    document.getElementById('hero1-publisher').textContent = currentHeroes[0].publisher || '';
    
    // Отображаем второго героя
    document.getElementById('hero2-img').src = currentHeroes[1].image_url;
    document.getElementById('hero2-name').textContent = currentHeroes[1].name;
    document.getElementById('hero2-rating').textContent = `Рейтинг: ${currentHeroes[1].rating || 0}`;
    document.getElementById('hero2-publisher').textContent = currentHeroes[1].publisher || '';
}

// Голосование
async function vote(heroNumber) {
    if (!currentHeroes || currentHeroes.length < 2) return;
    
    const winner = currentHeroes[heroNumber - 1];
    const loser = currentHeroes[heroNumber === 1 ? 1 : 0];
    
    // Добавляем в проголосованные
    votedHeroes.add(winner.id);
    votedHeroes.add(loser.id);
    saveProgress();
    
    // Показываем результат
    document.getElementById('result').textContent = `Вы выбрали: ${winner.name}!`;
    
    // Обновляем рейтинги в базе данных
    try {
        // Увеличиваем рейтинг победителя
        await supabase
            .from('Heroes_Table')
            .update({ rating: (winner.rating || 0) + 1 })
            .eq('id', winner.id);
        
        // Уменьшаем рейтинг проигравшего (но не ниже 0)
        const newLoserRating = Math.max(0, (loser.rating || 0) - 1);
        await supabase
            .from('Heroes_Table')
            .update({ rating: newLoserRating })
            .eq('id', loser.id);
            
    } catch (error) {
        console.error("Ошибка при обновлении рейтинга:", error);
    }
    
    // Ждем немного и показываем новых героев
    setTimeout(() => {
        document.getElementById('result').textContent = '';
        displayHeroes();
    }, 1500);
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