// Кеш рейтинга на клиенте (обновляется раз в 5 минут)
let heroesCache = null;
let lastCacheUpdate = 0;

// Получение героев с кешированием
async function getHeroes() {
    const now = Date.now();
    if (!heroesCache || now - lastCacheUpdate > 5 * 60 * 1000) {
        heroesCache = await fetchHeroesFromDB();
        lastCacheUpdate = now;
    }
    return heroesCache;
}

// Обновление статистики
async function updateHeroStats(heroId, updates) {
    // Быстрый UPDATE в базу
    await fetch(`${SUPABASE_URL}/rest/v1/heroes?id=eq.${heroId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
        body: JSON.stringify(updates)
    });
    
    // Инвалидируем кеш
    heroesCache = null;
}

// При показе героя
async function trackHeroShow(heroId) {
    await updateHeroStats(heroId, { shows: { increment: 1 } });
}

// При начале битвы (показ двух героев)
async function trackBattleView(hero1Id, hero2Id) {
    await updateHeroStats(hero1Id, { viewers: { increment: 1 } });
    await updateHeroStats(hero2Id, { viewers: { increment: 1 } });
}

// При голосовании
async function sendVote(winnerId, loserId) {
    await updateHeroStats(winnerId, { wins: { increment: 1 } });
    await updateHeroStats(loserId, { loses: { increment: 1 } });
}