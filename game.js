const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Resize Canvas
function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game State
let gameState = 'MENU'; // MENU, PLAYING, STORE, GAMEOVER, LEVEL_TRANSITION
let animationId;
let lastTime = 0;

// Player Data
const player = {
    x: 100,
    y: 100,
    width: 40,
    height: 80,
    vx: 0,
    vy: 0,
    speed: 300, // pixels per second
    jumpPower: -600,
    gravity: 1200,
    hp: 100,
    maxHp: 100,
    xp: 0,
    maxXp: 100,
    points: 0,
    level: 1,
    isGrounded: false,
    state: 'IDLE', // IDLE, RUN, JUMP, ATTACK, DASH
    direction: 1, // 1 right, -1 left
    dashTime: 0,
    dashDuration: 0.2, // seconds
    dashSpeedMultiplier: 2.5,
    attackTime: 0,
    attackDuration: 0.3,
    color: '#e67e22' // Temp placeholder for realistic sprite
};

// Input handling
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    Space: false,
    KeyZ: false,
    KeyX: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

// Mobile Controls
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
    document.getElementById('mobile-controls').style.display = 'flex';

    const bindTouch = (id, key) => {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
        el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
    };

    bindTouch('btn-left', 'ArrowLeft');
    bindTouch('btn-right', 'ArrowRight');
    bindTouch('btn-jump', 'Space');
    bindTouch('btn-dash', 'KeyZ');
    bindTouch('btn-attack', 'KeyX');
}


// Level Data (African Cities)
const levels = [
    { name: 'Lagos', bg: '#2c3e50', ground: '#7f8c8d', goal: 2000, theme: 'Urban Hustle' },
    { name: 'Kigali', bg: '#27ae60', ground: '#2ecc71', goal: 4000, theme: 'Green Hills' },
    { name: 'Cairo', bg: '#d35400', ground: '#e67e22', goal: 6000, theme: 'Desert Sands' },
    { name: 'Cape Town', bg: '#2980b9', ground: '#3498db', goal: 8000, theme: 'Coastal Winds' }
];

let currentLevelIdx = 0;
let cameraX = 0;
const groundHeight = 100;
let obstacles = [];
let coins = [];
let distanceTraveled = 0;


function initLevel() {
    const levelData = levels[currentLevelIdx];
    document.getElementById('level-display').innerText = `${player.level} (${levelData.name})`;

    player.x = 100;
    player.y = canvas.height - groundHeight - player.height;
    player.vx = 0;
    player.vy = 0;
    cameraX = 0;
    distanceTraveled = 0;

    obstacles = [];
    coins = [];

    // Generate level elements (Danger Dash theme)
    let nextX = 800;
    for(let i=0; i<50; i++) {
        // Obstacles
        if (Math.random() > 0.3) {
            obstacles.push({
                x: nextX,
                y: canvas.height - groundHeight - 40,
                width: 40,
                height: 40,
                type: 'spike' // Needs jump or dash to avoid
            });
        }

        // Coins/Points
        for(let j=0; j<3; j++) {
            coins.push({
                x: nextX + 100 + (j*40),
                y: canvas.height - groundHeight - 80 - (Math.random() * 100),
                radius: 10,
                collected: false
            });
        }

        nextX += 400 + Math.random() * 400; // Increase gap randomly
    }
}


function updatePlayer(dt) {
    if (player.hp <= 0) {
        gameOver();
        return;
    }

    // State management
    if (player.dashTime > 0) {
        player.dashTime -= dt;
        player.state = 'DASH';
        player.vx = player.direction * player.speed * player.dashSpeedMultiplier;
        player.vy = 0; // Anti-gravity while dashing
    } else if (player.attackTime > 0) {
        player.attackTime -= dt;
        player.state = 'ATTACK';
        player.vx = 0;
    } else {
        // Normal movement
        if (keys.ArrowRight) {
            player.vx = player.speed;
            player.direction = 1;
            player.state = player.isGrounded ? 'RUN' : 'JUMP';
        } else if (keys.ArrowLeft) {
            player.vx = -player.speed;
            player.direction = -1;
            player.state = player.isGrounded ? 'RUN' : 'JUMP';
        } else {
            player.vx = 0;
            player.state = player.isGrounded ? 'IDLE' : 'JUMP';
        }

        // Jump
        if ((keys.Space || keys.ArrowUp) && player.isGrounded) {
            player.vy = player.jumpPower;
            player.isGrounded = false;
        }

        // Apply Gravity
        player.vy += player.gravity * dt;

        // Attack Initiation
        if (keys.KeyX && player.attackTime <= 0) {
            player.attackTime = player.attackDuration;
        }

        // Dash Initiation
        if (keys.KeyZ && player.dashTime <= 0 && player.xp >= 20) {
            player.dashTime = player.dashDuration;
            player.xp -= 20; // Costs XP to dash
            updateHUD();
        }
    }

    // Apply Velocity
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Floor collision
    const floorY = canvas.height - groundHeight;
    if (player.y + player.height > floorY) {
        player.y = floorY - player.height;
        player.vy = 0;
        player.isGrounded = true;
    }

    // Left screen bound
    if (player.x < cameraX) {
        player.x = cameraX;
    }

    // Camera follow (Danger Dash style - constantly moving right slightly, or follows player)
    const targetCameraX = player.x - 200;
    if (targetCameraX > cameraX) {
        cameraX = targetCameraX;
    }

    distanceTraveled = Math.max(distanceTraveled, player.x);

    checkCollisions();

    // Level Complete Condition
    const levelData = levels[currentLevelIdx];
    if (distanceTraveled > levelData.goal) {
        levelComplete();
    }
}

function checkCollisions() {
    // Coins
    coins.forEach(coin => {
        if (!coin.collected) {
            // Simple AABB vs Circle approx
            if (player.x < coin.x + coin.radius &&
                player.x + player.width > coin.x - coin.radius &&
                player.y < coin.y + coin.radius &&
                player.y + player.height > coin.y - coin.radius) {

                coin.collected = true;
                player.points += 10;
                player.xp += 5;
                if(player.xp > player.maxXp) {
                    player.level++;
                    player.xp = 0;
                    player.maxXp *= 1.2;
                }
                updateHUD();
            }
        }
    });

    // Obstacles
    obstacles.forEach(obs => {
        if (player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y) {

            // Hit obstacle
            if (player.state !== 'DASH') {
                // Take damage if not dashing through
                player.hp -= 20;
                player.x -= 100; // Knockback
                player.vy = -300;
                updateHUD();

                // Remove obstacle to prevent multiple hits
                obs.x = -1000;
            } else {
                // Destroy obstacle while dashing
                obs.x = -1000;
                player.points += 20;
                updateHUD();
            }
        }
    });
}


function drawGame() {
    const levelData = levels[currentLevelIdx];

    // Clear and draw bg
    ctx.fillStyle = levelData.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw mountains/parallax (simple representation)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for(let i=0; i<10; i++) {
        ctx.beginPath();
        let mx = (i * 300) - (cameraX * 0.2) % 300;
        ctx.moveTo(mx, canvas.height - groundHeight);
        ctx.lineTo(mx + 150, canvas.height - groundHeight - 200);
        ctx.lineTo(mx + 300, canvas.height - groundHeight);
        ctx.fill();
    }

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Draw Ground
    ctx.fillStyle = levelData.ground;
    ctx.fillRect(cameraX, canvas.height - groundHeight, canvas.width + 1000, groundHeight);

    // Draw Coins
    ctx.fillStyle = '#f1c40f';
    coins.forEach(coin => {
        if (!coin.collected) {
            ctx.beginPath();
            ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#f39c12';
            ctx.stroke();
        }
    });

    // Draw Obstacles
    ctx.fillStyle = '#c0392b';
    obstacles.forEach(obs => {
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width/2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.fill();
    });

    // Draw Player
    ctx.fillStyle = player.color;

    if (player.state === 'DASH') {
        ctx.fillStyle = '#3498db'; // visual feedback for dash
    } else if (player.state === 'ATTACK') {
        ctx.fillStyle = '#e74c3c';
    }

    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Attack hitbox visual
    if (player.state === 'ATTACK') {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.5)';
        if (player.direction === 1) {
            ctx.fillRect(player.x + player.width, player.y + 20, 40, 40);
        } else {
            ctx.fillRect(player.x - 40, player.y + 20, 40, 40);
        }
    }

    ctx.restore();
}

function updateHUD() {
    document.getElementById('hp-bar').style.width = `${(Math.max(0, player.hp) / player.maxHp) * 100}%`;
    document.getElementById('xp-bar').style.width = `${(player.xp / player.maxXp) * 100}%`;
    document.getElementById('points-display').innerText = player.points;
}

function gameLoop(timestamp) {
    if (gameState !== 'PLAYING') return;

    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // Cap dt for lag spikes
    lastTime = timestamp;

    updatePlayer(dt);
    drawGame();

    animationId = requestAnimationFrame(gameLoop);
}

// UI Functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

document.getElementById('start-btn').addEventListener('click', () => {
    showScreen('game-screen');
    gameState = 'PLAYING';
    initLevel();
    updateHUD();
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
});

document.getElementById('store-btn').addEventListener('click', () => {
    showScreen('store-screen');
    document.getElementById('store-points').innerText = player.points;
});

document.getElementById('close-store-btn').addEventListener('click', () => {
    showScreen('main-menu');
});

function gameOver() {
    gameState = 'GAMEOVER';
    document.getElementById('overlay-title').innerText = "You have fallen...";
    document.getElementById('overlay-desc').innerText = "The ancestors wait for your return.";
    const btn = document.getElementById('overlay-btn');
    btn.innerText = "Try Again";
    btn.onclick = () => {
        player.hp = player.maxHp;
        initLevel();
        gameState = 'PLAYING';
        showScreen('game-screen');
        lastTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    };
    showScreen('overlay-screen');
}

function levelComplete() {
    gameState = 'LEVEL_TRANSITION';
    const levelData = levels[currentLevelIdx];

    currentLevelIdx++;
    if (currentLevelIdx >= levels.length) {
        // Game Beat
        document.getElementById('overlay-title').innerText = "Victory!";
        document.getElementById('overlay-desc').innerText = "You have conquered all cities and claimed your rightful throne!";
        const btn = document.getElementById('overlay-btn');
        btn.innerText = "Main Menu";
        btn.onclick = () => {
            currentLevelIdx = 0;
            player.hp = player.maxHp;
            showScreen('main-menu');
        };
    } else {
        document.getElementById('overlay-title').innerText = "Level Complete!";
        document.getElementById('overlay-desc').innerText = `You have survived ${levelData.name}. Prepare for ${levels[currentLevelIdx].name}.`;
        const btn = document.getElementById('overlay-btn');
        btn.innerText = "Continue Journey";
        btn.onclick = () => {
            initLevel();
            gameState = 'PLAYING';
            showScreen('game-screen');
            lastTime = performance.now();
            animationId = requestAnimationFrame(gameLoop);
        };
    }
    showScreen('overlay-screen');
}

// Store logic
document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const cost = parseInt(e.target.dataset.cost);
        const item = e.target.dataset.item;

        if (player.points >= cost) {
            player.points -= cost;
            document.getElementById('store-points').innerText = player.points;

            if (item === 'potion') {
                player.hp = Math.min(player.maxHp, player.hp + 50);
            } else if (item === 'spear') {
                player.attackDuration += 0.1; // Better attack
            } else if (item === 'shield') {
                player.maxHp += 50;
                player.hp += 50;
            }

            updateHUD();
            e.target.innerText = "Bought";
            e.target.disabled = true;
            setTimeout(() => {
                e.target.innerText = "Buy";
                e.target.disabled = false;
            }, 1000);
        }
    });
});
