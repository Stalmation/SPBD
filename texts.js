// texts.js - ВЕРНУЛ ОРИГИНАЛЬНЫЕ ИМЕНА
const TEXTS = {
    EN: {
        DISCLAIMER: {
            TITLE: "DISCLAIMER",
            LEGAL: `
                <p>All characters and publisher logos presented here are property of their respective owners.</p>
                <p>We are not officially connected with Marvel, DC, Valiant, Dark Horse, Rebellion or any other publishers.</p>
                <p>This is a non-commercial fan-made application created by fans for fans.</p>
            `,
            RIGHTS_HOLDERS: `
                <p>We will immediately remove any character or logo upon request.</p>
                <p>Please contact us with official verification.</p>
                <p>We respect copyright and will cooperate!</p>
            `,
            BUTTON: "CONTINUE"
        },
        RULES: {
            TITLE: "HOW TO PLAY",
            RULES_LIST: `
                <p>💪 <strong>GUESS THE WINNER</strong> - Use your comic book smarts to predict who'll win between two random characters! Tap their pic to see if you're right and move to the next matchup. The winner is determined by the hero's popularity rating.</p>
                <p>🏆 <strong>COMMUNITY RANKINGS</strong> - Hero ratings are based on real-time votes from players like you! We calculate their win rate like this: if a character appears 10 times and gets chosen 8 times, their rating is 80%.</p>
                <p>❤️ <strong>YOUR VOTE MATTERS</strong> - Every tap shapes the ultimate superhero leaderboard! The more people play, the more accurate the rankings become.</p>
                <p>👨‍👩‍👧‍👦 <strong>BRING YOUR CREW</strong> - Test your superhero knowledge, vote for your favorites, and see who's the ultimate fan! Guess the most winners and claim bragging rights!</p>
                
            `,
            BUTTON: "LET'S PLAY"
        },
        GAME_OVER: {
            TITLE: "GAME OVER",
            SCORE: "Your score",
            BEST: "Best score",
            STATS: "Statistics",
            BUTTON: "TRY AGAIN"
        },
        COMPLETION: {
            TITLE: "🎉 CONGRATULATIONS!",
            DESCRIPTION: "You've rated all heroes!",
            SCORE: "Your final score",
            BEST: "Best score",
            STATS: "Statistics", 
            BUTTON: "PLAY AGAIN"
        },
        NETWORK_ERROR: {
            TITLE: "INTERNET LOST",
            DESCRIPTION: "Check your connection",
            SUBTEXT: "Reconnecting automatically...",
            BUTTON: "UNDERSTAND"
        }
    },
    RU: {
        DISCLAIMER: {
            TITLE: "ДИСКЛЕЙМЕР",
            LEGAL: `
                <p>Все персонажи и логотипы издателей являются собственностью их правообладателей.</p>
                <p>Мы не связаны с Marvel, DC, Valiant, Dark Horse, Rebellion или другими издателями.</p>
                <p>Это некоммерческое фанатское приложение, созданное фанатами для фанатов.</p>
            `,
            RIGHTS_HOLDERS: `
                <p>Мы немедленно удалим любого персонажа или логотип по запросу.</p>
                <p>Свяжитесь с нами для официальной проверки.</p>
                <p>Мы уважаем авторские права и готовы к сотрудничеству!</p>
            `,
            BUTTON: "ПРОДОЛЖИТЬ"
        },
        RULES: {
            TITLE: "КАК ИГРАТЬ",
            RULES_LIST: `
                <p>💪 <strong>УГАДАЙ ПОБЕДИТЕЛЯ</strong> - используйте свои знания комиксов, чтобы угадать, кто победит из двух случайных персонажей, и нажмите на его изображение, чтобы увидеть результат и перейти к следующей паре. Победитель определяется рейтингом героя.</p>
                <p>🏆 <strong>НАРОДНЫЙ РЕЙТИНГ</strong> - основан на популярности героев и формируется игроками в реальном времени. Расчёт происходит по формуле винрейта. Например, если персонажа показывали 10 раз и в 8 случаях игроки выбирали его, то его рейтинг составит 80%.</p>
                <p>❤️ <strong>ТВОЙ ВЫБОР ВАЖЕН</strong> - каждый твой голос помогает формировать народный топ супергероев. Чем больше людей играет, тем точнее становится рейтинг.</p>
                <p>👨‍👩‍👧‍👦 <strong>ПРИГЛАСИ ДРУЗЕЙ</strong> - проверьте свои знания о супергероях, голосуйте за любимых персонажей. Угадайте больше всех и станьте победителем!</p>
                
            `,
            BUTTON: "ПОГНАЛИ!"
        },
        GAME_OVER: {
            TITLE: "ИГРА ОКОНЧЕНА", 
            SCORE: "Ваш счёт",
            BEST: "Лучший счёт", 
            STATS: "Статистика",
            BUTTON: "ПОВТОРИТЬ"
        },
        COMPLETION: {
            TITLE: "🎉 ПОЗДРАВЛЯЕМ!",
            DESCRIPTION: "Вы оценили всех героев!",
            SCORE: "Финальный счёт",
            BEST: "Лучший счёт",
            STATS: "Статистика",
            BUTTON: "ПОВТОРИТЬ"
        },
        NETWORK_ERROR: {
            TITLE: "ПРОПАЛ ИНТЕРНЕТ",
            DESCRIPTION: "Проверьте подключение",
            SUBTEXT: "Автоматическое переподключение...",
            BUTTON: "ПОНЯТНО"
        }
    }
};

// Умное определение языка
function getBrowserLanguage() {
    // 1. Проверяем язык Telegram Web App
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        const tgLang = Telegram.WebApp.initDataUnsafe.user?.language_code;
        if (tgLang && tgLang.startsWith('ru')) return 'RU';
    }
    
    // 2. Проверяем язык браузера
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('ru')) return 'RU';
    
    // 3. По умолчанию английский
    return 'EN';
}

function getText(category, subKey = null) {
    const lang = getBrowserLanguage();
    if (subKey) {
        return TEXTS[lang][category][subKey];
    }
    return TEXTS[lang][category];
}