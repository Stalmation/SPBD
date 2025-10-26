// Конфигурация Supabase
const SUPABASE_URL = "https://xwtcasfvetisjaiijtsj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dGNhc2Z2ZXRpc2phaWlqdHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMTA5OTMsImV4cCI6MjA3Mzc4Njk5M30.b8ScpPxBx6K0HmWynqppBLSxxuENNmOJR7Kcl6hIo2s";



const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Текущий фильтр
let currentFilter = 'all';

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    checkSavedAccess();
});

// Проверка сохраненного доступа
function checkSavedAccess() {
    if (localStorage.getItem('adminAccess') === 'true') {
        showAdminPanel();
    }
}

// Проверка кода доступа через базу данных
async function checkAdminAccess() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    
    if (!username || !password) {
        showMessage('Please enter both username and password', 'error');
        return;
    }

    try {
        // Простая проверка через прямую выборку
        const { data, error } = await supabase
            .from('admins')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) {
            showMessage('Invalid credentials!', 'error');
            return;
        }

        // Проверяем пароль через функцию (если она работает)
        const { data: verifyData, error: verifyError } = await supabase
            .rpc('verify_admin_password', { 
                username: username, 
                password_input: password 
            });

        // Если функция не работает, используем прямое сравнение (НЕ БЕЗОПАСНО - только для теста)
        if (verifyError) {
            console.log('RPC function failed, using direct check');
            // Временное решение - сравнение паролей на клиенте
            if (password === 'admin123') { // Замените на ваш пароль
                localStorage.setItem('adminAccess', 'true');
                showAdminPanel();
            } else {
                showMessage('Invalid credentials!', 'error');
            }
            return;
        }

        if (verifyData) {
            localStorage.setItem('adminAccess', 'true');
            showAdminPanel();
        } else {
            showMessage('Invalid credentials!', 'error');
        }
        
    } catch (error) {
        console.error('Auth error:', error);
        showMessage('Authentication error', 'error');
    }
}

// Показать админ-панель
function showAdminPanel() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadStats();
}

// Загрузка статистики
async function loadStats(filter = 'all') {
    try {
        showLoading();
        currentFilter = filter;
        
        // Обновляем активные кнопки
        updateFilterButtons(filter);
        
        // Получаем даты для фильтра
        const dateRange = getDateRange(filter);
        
        const [
            sessionsRes,
            uniquePlayersRes,
            voteActivityRes,
            countriesRes,
            devicesRes,
            previousPeriodRes,
            recentSessionsRes
        ] = await Promise.all([
            supabase.from('game_sessions')
                .select('*')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end),
                
            supabase.from('game_sessions')
                .select('user_id')
                .not('user_id', 'is', null)
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end),
                
            supabase.from('vote_activity')
                .select('votes_count')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end),
                
            supabase.from('game_sessions')
                .select('country_code')
                .not('country_code', 'is', null)
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end),
                
            supabase.from('game_sessions')
                .select('user_agent')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end),
                
            supabase.from('game_sessions')
                .select('id')
                .gte('created_at', dateRange.previousStart)
                .lte('created_at', dateRange.previousEnd),
                
            supabase.from('game_sessions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10)
        ]);

        const stats = calculateStats(
            sessionsRes, uniquePlayersRes, voteActivityRes,
            countriesRes, devicesRes, previousPeriodRes,
            filter
        );

        renderStats(stats, filter);
        renderRecentActivity(recentSessionsRes.data || []);
        
        document.getElementById('lastUpdate').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        
    } catch (error) {
        showMessage('Error loading statistics', 'error');
        document.getElementById('statsGrid').innerHTML = '<div class="error-message">Failed to load data</div>';
    }
}

// Обновление активных кнопок фильтра
function updateFilterButtons(activeFilter) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Получение диапазона дат для фильтра
function getDateRange(filter) {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    
    switch(filter) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'week':
            start.setDate(now.getDate() - 7);
            break;
        case 'month':
            start.setMonth(now.getMonth() - 1);
            break;
        case 'year':
            start.setFullYear(now.getFullYear() - 1);
            break;
        default: // all
            start.setFullYear(2020, 0, 1);
    }
    
    // Предыдущий период для сравнения
    const previousStart = new Date(start);
    const previousEnd = new Date(end);
    const periodDiff = end - start;
    
    previousStart.setTime(previousStart.getTime() - periodDiff);
    previousEnd.setTime(previousEnd.getTime() - periodDiff);
    
    return {
        start: start.toISOString(),
        end: end.toISOString(),
        previousStart: previousStart.toISOString(),
        previousEnd: previousEnd.toISOString()
    };
}

// Расчет статистики
function calculateStats(sessionsRes, uniquePlayersRes, voteActivityRes, countriesRes, devicesRes, previousPeriodRes, filter) {
    const sessions = sessionsRes.data || [];
    const uniquePlayers = new Set(uniquePlayersRes.data?.map(p => p.user_id) || []);
    const voteActivities = voteActivityRes.data || [];
    const previousSessions = previousPeriodRes.data || [];
    
    // Общая активность голосований
    const totalVotes = voteActivities.reduce((sum, activity) => sum + activity.votes_count, 0);
    
    // Средняя активность за игру
    const avgVotesPerGame = sessions.length > 0 ? (totalVotes / sessions.length).toFixed(1) : 0;
    
    // Среднее время игры
    const totalGameTime = sessions.reduce((sum, session) => sum + (session.game_duration || 0), 0);
    const avgGameTime = sessions.length > 0 ? formatTime(totalGameTime / sessions.length) : '0s';
    
    // Статистика по странам
    const countryStats = {};
    (countriesRes.data || []).forEach(session => {
        countryStats[session.country_code] = (countryStats[session.country_code] || 0) + 1;
    });
    
    // Статистика по устройствам
    const deviceStats = {};
    (devicesRes.data || []).forEach(session => {
        deviceStats[session.user_agent] = (deviceStats[session.user_agent] || 0) + 1;
    });
    
    // Сравнение с предыдущим периодом
    const growth = previousSessions.length > 0 ? 
        ((sessions.length - previousSessions.length) / previousSessions.length * 100).toFixed(1) : 100;

    return {
        totalGames: sessions.length,
        uniquePlayers: uniquePlayers.size,
        totalVotes: totalVotes,
        avgVotesPerGame: avgVotesPerGame,
        avgGameTime: avgGameTime,
        countryStats: countryStats,
        deviceStats: deviceStats,
        growth: growth,
        filter: filter
    };
}

// Отрисовка статистики
function renderStats(stats, filter) {
    // Топ 5 стран
    const topCountries = Object.entries(stats.countryStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([country, count]) => `${getFlag(country)} ${country}: ${count}`)
        .join('<br>');

    const growthSymbol = stats.growth >= 0 ? '↗' : '↘';
    const growthColor = stats.growth >= 0 ? 'trend-up' : 'trend-down';

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Games Played</div>
            <div class="stat-value">${stats.totalGames}</div>
            <div class="stat-trend ${growthColor}">
                ${growthSymbol} ${Math.abs(stats.growth)}% vs previous
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Unique Players</div>
            <div class="stat-value">${stats.uniquePlayers}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Votes</div>
            <div class="stat-value">${stats.totalVotes}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg Votes/Game</div>
            <div class="stat-value">${stats.avgVotesPerGame}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg Game Time</div>
            <div class="stat-value">${stats.avgGameTime}</div>
        </div>
        <div class="stat-card full-width">
            <div class="stat-label">🌍 Top Countries</div>
            <div class="country-stats">${topCountries || 'No data'}</div>
        </div>
        <div class="stat-card full-width">
            <div class="stat-label">📱 Devices</div>
            <div class="device-stats">
                📱 Mobile: ${stats.deviceStats['mobile'] || 0} | 
                💻 Desktop: ${stats.deviceStats['desktop'] || 0}
            </div>
        </div>
    `;
    
    document.getElementById('filterInfo').textContent = `Period: ${getFilterDisplayName(filter)}`;
}

// Отрисовка последней активности
function renderRecentActivity(sessions) {
    const container = document.getElementById('recentActivity');
    
    if (sessions.length === 0) {
        container.innerHTML = '<div class="loading">No recent activity</div>';
        return;
    }
    
    container.innerHTML = sessions.map(session => `
        <div class="activity-item">
            <div class="activity-time">
                ${new Date(session.created_at).toLocaleDateString()} 
                ${new Date(session.created_at).toLocaleTimeString()}
            </div>
            <div class="activity-details">
                ${session.total_votes} votes • ${formatTime(session.game_duration)} • ${getFlag(session.country_code)}
            </div>
        </div>
    `).join('');
}

// Вспомогательные функции
function showLoading() {
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card full-width">
            <div class="loading">Loading statistics...</div>
        </div>
    `;
}

function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;
    
    const adminPanel = document.getElementById('adminPanel');
    adminPanel.insertBefore(messageDiv, adminPanel.firstChild);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

function getFilterDisplayName(filter) {
    const names = {
        'all': 'All Time',
        'today': 'Today', 
        'week': 'Last 7 Days',
        'month': 'Last 30 Days',
        'year': 'Last Year'
    };
    return names[filter] || filter;
}

function getFlag(countryCode) {
    if (!countryCode || countryCode === 'unknown') return '🏴';
    
    const flags = {
        'RU': '🇷🇺', 'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷',
        'IT': '🇮🇹', 'ES': '🇪🇸', 'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳',
        'BR': '🇧🇷', 'IN': '🇮🇳', 'TR': '🇹🇷', 'UA': '🇺🇦', 'KZ': '🇰🇿',
        'CA': '🇨🇦', 'AU': '🇦🇺', 'NL': '🇳🇱', 'SE': '🇸🇪', 'NO': '🇳🇴',
        'FI': '🇫🇮', 'DK': '🇩🇰', 'PL': '🇵🇱', 'CZ': '🇨🇿', 'SK': '🇸🇰'
    };
    return flags[countryCode.toUpperCase()] || '🏴';
}

function formatTime(seconds) {
    if (!seconds || seconds < 60) return `${Math.round(seconds || 0)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}

// Экспорт данных
async function exportStats() {
    try {
        const dateRange = getDateRange(currentFilter);
        
        const { data: sessions, error } = await supabase
            .from('game_sessions')
            .select('*')
            .gte('created_at', dateRange.start)
            .lte('created_at', dateRange.end);
        
        if (error) throw error;
        
        const exportData = {
            export_date: new Date().toISOString(),
            period: currentFilter,
            stats: sessions
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `game_stats_${currentFilter}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showMessage('Data exported successfully!', 'success');
    } catch (error) {
        showMessage('Error exporting data', 'error');
    }
}