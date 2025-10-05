// menu-script.js

// Initialize Telegram Web App
let tg = null;

function initTelegram() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        tg = Telegram.WebApp;
        tg.expand();
        tg.enableClosingConfirmation();
        tg.setHeaderColor('#1a1a2e');
        tg.setBackgroundColor('#1a1a2e');
        tg.BackButton.hide();
    }
}

function startGame() {
    playHaptic('selection');
    window.location.href = 'game.html';
}

function showRules() {
    playHaptic('selection');
    alert(`🎮 SUPER POWER BEAT DOWN - RULES

• Choose the hero with the higher rating
• You have 5 lives
• +1 point for correct choice  
• -1 life for wrong choice
• Play until you run out of heroes or lives!

Good luck! 🍀`);
}

function showRecords() {
    playHaptic('selection');
    const stats = localStorage.getItem('heroGameStats');
    let maxScore = 0;
    
    if (stats) {
        try {
            const parsed = JSON.parse(stats);
            maxScore = parsed.maxScore || 0;
        } catch(e) {}
    }
    
    alert(`🏆 YOUR RECORDS

Best Score: ${maxScore} points

Keep playing to improve your record! 💪`);
}

function showSupport() {
    playHaptic('selection');
    if (tg && tg.openTelegramLink) {
        tg.openTelegramLink('https://t.me/your_support_channel');
    } else {
        alert('Support: Contact us @your_support_channel');
    }
}

function showSettings() {
    playHaptic('selection');
    alert('⚙️ SETTINGS\n\nGame settings will be available in future updates!');
}

// Haptic feedback
function playHaptic(type) {
    if (tg && tg.HapticFeedback) {
        try {
            tg.HapticFeedback.impactOccurred('light');
            return;
        } catch(e) {
            // Fallback silently
        }
    }
    
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

// Show welcome disclaimer on first visit
function showWelcomeDisclaimer() {
    const hasSeenDisclaimer = localStorage.getItem('hasSeenDisclaimer');
    
    if (!hasSeenDisclaimer) {
        setTimeout(() => {
            const popup = document.createElement('div');
            popup.className = 'game-over-popup';
            popup.innerHTML = `
                <div class="popup-content">
                    <h2>🎮 WELCOME!</h2>
                    <div style="text-align: left; margin: 15px 0; font-size: 14px; color: white;">
                        <p><strong>How to play:</strong></p>
                        <p>• Choose the hero with higher rating</p>
                        <p>• You have 5 lives</p>
                        <p>• +1 point for correct answers</p>
                        <p>• -1 life for mistakes</p>
                        <p>• Play until no heroes or lives left!</p>
                    </div>
                    <button id="understand-button">LET'S PLAY! 🚀</button>
                </div>
            `;
            
            document.body.appendChild(popup);
            
            document.getElementById('understand-button').addEventListener('click', function() {
                playHaptic('selection');
                localStorage.setItem('hasSeenDisclaimer', 'true');
                popup.remove();
            });
        }, 1000);
    }
}

// Escape handler for menu
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

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    initTelegram();
    showWelcomeDisclaimer();
});