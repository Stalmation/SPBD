// texts.js - улучшенная версия
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
            BUTTON: "START GAME"
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
            BUTTON: "ПОГНАЛИ"
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