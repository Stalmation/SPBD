// app.js - улучшенная версия
async function trackHeroShow(heroId) {
    // Увеличиваем счетчик показов
    await fetch(`${SUPABASE_URL}/rest/v1/heroes?id=eq.${heroId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({
            shows: { increment: 1 }  // Добавляем поле shows
        })
    });
}

async function sendVote(winner, loser) {
    await updateHero(winner.id, 'win');
    await updateHero(loser.id, 'lose');
}

async function updateHero(heroId, result) {
    await fetch(`${SUPABASE_URL}/rest/v1/heroes?id=eq.${heroId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({
            viewers: { increment: 1 },
            wins: result === 'win' ? { increment: 1 } : undefined,
            loses: result === 'lose' ? { increment: 1 } : undefined
        })
    });
}

// При показе героя на экране
function displayHero(heroElementId) {
    const heroId = // получаем ID героя
    trackHeroShow(heroId); // Учитываем показ
}