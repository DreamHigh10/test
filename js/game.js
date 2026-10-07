// Canvas Setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Image Assets
const imgHero = new Image();
imgHero.src = 'assets/hero.jpg';

const imgEnemy1 = new Image();
imgEnemy1.src = 'assets/enemy1.jpg';

const imgEnemy2 = new Image();
imgEnemy2.src = 'assets/enemy2.jpg';

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game State
const STATE = {
    MENU: 0,
    PLAYING_LAGOS: 1,
    PLAYING_KIGALI: 2,
    DANGER_DASH: 3,
    STORE: 4,
    GAME_OVER: 5,
    LEVEL_COMPLETE: 6
};
let currentState = STATE.MENU;

// Global Game Variables
let lastTime = 0;
let keys = {};
let camera = { x: 0, y: 0 };

// Player Class
class Player {
    constructor() {
        this.reset();
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.xp = 0;
        this.points = 0;
        this.damage = 25; // Base damage
    }

    reset() {
        this.x = 100;
        this.y = 100;
        this.width = 40;
        this.height = 60;
        this.vx = 0;
        this.vy = 0;
        this.speed = 300; // pixels per second
        this.jumpForce = -600;
        this.gravity = 1500;
        this.grounded = false;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.facingRight = true;
    }

    update(dt) {
        // Horizontal Movement
        if (keys['ArrowLeft']) {
            this.vx = -this.speed;
            this.facingRight = false;
        } else if (keys['ArrowRight']) {
            this.vx = this.speed;
            this.facingRight = true;
        } else {
            this.vx = 0;
        }

        // Jumping
        if ((keys['Space'] || keys['ArrowUp']) && this.grounded) {
            this.vy = this.jumpForce;
            this.grounded = false;
        }

        // Attacking
        if (keys['KeyZ'] && this.attackTimer <= 0) {
            this.isAttacking = true;
            this.attackTimer = 0.3; // 300ms attack duration
        }

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        } else {
            this.isAttacking = false;
        }

        // Apply Gravity
        this.vy += this.gravity * dt;

        // Move
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Ground Collision (Basic bottom of screen for now, will override in level update)
        if (this.y + this.height > canvas.height - 50) {
            this.y = canvas.height - 50 - this.height;
            this.vy = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }

        // Bounds checking
        if (this.x < 0) this.x = 0;
    }

    draw(ctx) {
        // Calculate animation bobbing if moving
        let bobY = 0;
        let tiltAngle = 0;
        if (!this.grounded) {
            // Jumping tilt
            tiltAngle = this.facingRight ? 0.2 : -0.2;
        } else if (Math.abs(this.vx) > 0) {
            // Running bob and tilt
            bobY = Math.sin(Date.now() / 100) * 5;
            tiltAngle = Math.sin(Date.now() / 150) * 0.1;
            if (!this.facingRight) tiltAngle -= 0.1; // Baseline tilt for direction
            else tiltAngle += 0.1;
        } else if (!this.facingRight) {
            // Idle facing left
            tiltAngle = -0.05;
        }

        ctx.save();

        // Translate to the center of the player for rotation
        ctx.translate(this.x - camera.x + this.width / 2, this.y - camera.y + this.height / 2 + bobY - 15);
        ctx.rotate(tiltAngle);

        // Draw Player Image (adjusting for translation)
        // Draw the image filling the hit box roughly (plus some extra height to look like a full person)
        if (imgHero.complete) {
            // Flip horizontally if facing left
            if (!this.facingRight) {
                ctx.scale(-1, 1);
            }
            ctx.drawImage(imgHero, -this.width / 2 - 10, -this.height / 2 - 30, this.width + 20, this.height + 30);
        } else {
            // Fallback
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        }

        ctx.restore();

        // Draw Attack Hitbox (Effect)
        if (this.isAttacking) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.6)'; // Gold spear swipe effect
            ctx.beginPath();
            if (this.facingRight) {
                ctx.arc(this.x - camera.x + this.width + 10, this.y - camera.y + 20, 25, -Math.PI/2, Math.PI/2);
            } else {
                ctx.arc(this.x - camera.x - 10, this.y - camera.y + 20, 25, Math.PI/2, Math.PI*1.5);
            }
            ctx.fill();
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            setState(STATE.GAME_OVER);
        }
        updateHUD();
    }
}

const player = new Player();

function updateHUD() {
    hudHp.innerText = player.hp;
    hudXp.innerText = player.xp;
    hudPoints.innerText = player.points;
    document.getElementById('store-points').innerText = player.points;
}

// Dash Mode Variables
let dashObstacles = [];
let dashSpeed = 400;
let dashDistance = 0;
let dashTimer = 0;
let dashBaseY = 500;

function startDashMode() {
    player.reset();
    player.y = dashBaseY - player.height;
    player.grounded = true;
    dashObstacles = [];
    dashSpeed = 400;
    dashDistance = 0;
    dashTimer = 0;
    updateHUD();
}

function updateDash(dt) {
    dashDistance += dashSpeed * dt;
    dashTimer += dt;

    // Increase speed over time
    dashSpeed += 10 * dt;

    // Player Jumping
    if ((keys['Space'] || keys['ArrowUp']) && player.grounded) {
        player.vy = player.jumpForce;
        player.grounded = false;
    }

    // Player Gravity
    player.vy += player.gravity * dt;
    player.y += player.vy * dt;

    // Ground collision
    if (player.y + player.height > dashBaseY) {
        player.y = dashBaseY - player.height;
        player.vy = 0;
        player.grounded = true;
    }

    // Spawn Obstacles
    if (Math.random() < 0.02 + (dashSpeed / 10000)) {
        // Only spawn if last obstacle is far enough away
        let canSpawn = true;
        if (dashObstacles.length > 0) {
            let lastObs = dashObstacles[dashObstacles.length - 1];
            if (canvas.width - lastObs.x < 300) {
                canSpawn = false;
            }
        }

        if (canSpawn) {
            let isTall = Math.random() > 0.5;
            dashObstacles.push({
                x: canvas.width,
                y: isTall ? dashBaseY - 80 : dashBaseY - 40,
                w: 30,
                h: isTall ? 80 : 40,
                passed: false
            });
        }
    }

    // Update Obstacles
    for (let i = dashObstacles.length - 1; i >= 0; i--) {
        let obs = dashObstacles[i];
        obs.x -= dashSpeed * dt;

        // Collision
        if (player.x < obs.x + obs.w && player.x + player.width > obs.x &&
            player.y < obs.y + obs.h && player.y + player.height > obs.y) {
            // Hit obstacle
            player.takeDamage(100); // Instant death in dash
            break;
        }

        // Score points
        if (!obs.passed && obs.x + obs.w < player.x) {
            obs.passed = true;
            player.points += 5;
            player.xp += 10;
            updateHUD();
        }

        // Remove offscreen
        if (obs.x + obs.w < 0) {
            dashObstacles.splice(i, 1);
        }
    }
}

function drawDash() {
    // Background
    ctx.fillStyle = '#FF9800'; // Safari orange sunset
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sun
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 200, 100, 0, Math.PI * 2);
    ctx.fill();

    // Ground
    ctx.fillStyle = '#2F4F4F'; // Dark slate grey
    ctx.fillRect(0, dashBaseY, canvas.width, canvas.height - dashBaseY);

    // Obstacles
    ctx.fillStyle = '#000000';
    for (let obs of dashObstacles) {
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
    }

    // Score Text
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Distance: ${Math.floor(dashDistance)}m`, 20, 100);

    // Player (Fixed X position)
    // Draw Player Image with Dash Bobbing
    let dashBob = player.grounded ? Math.sin(Date.now() / 80) * 5 : 0;

    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2 + dashBob - 15);
    ctx.rotate(0.1); // Leaning forward slightly to run

    if (imgHero.complete) {
        ctx.drawImage(imgHero, -player.width / 2 - 10, -player.height / 2 - 30, player.width + 20, player.height + 30);
    } else {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
    }
    ctx.restore();
}

// Level Data
const LEVELS = {
    LAGOS: {
        platforms: [
            { x: 0, y: 500, w: 800, h: 100 },
            { x: 900, y: 400, w: 200, h: 20 },
            { x: 1200, y: 300, w: 300, h: 20 },
            { x: 1600, y: 500, w: 1000, h: 100 }
        ],
        enemies: [
            { x: 600, y: 450, w: 40, h: 50, hp: 50, speed: 100, patrolLeft: 400, patrolRight: 700, dir: 1, type: 'thug' },
            { x: 1300, y: 250, w: 40, h: 50, hp: 50, speed: 100, patrolLeft: 1200, patrolRight: 1450, dir: 1, type: 'thug' }
        ],
        color: '#87CEEB', // Sky blue
        platformColor: '#A9A9A9', // Urban grey
        groundY: 500
    },
    KIGALI: {
        platforms: [
            { x: 0, y: 600, w: 400, h: 100 },
            { x: 500, y: 500, w: 150, h: 20 },
            { x: 700, y: 350, w: 150, h: 20 },
            { x: 900, y: 200, w: 150, h: 20 },
            { x: 1200, y: 400, w: 300, h: 20 },
            { x: 1600, y: 600, w: 800, h: 100 }
        ],
        enemies: [
            { x: 1300, y: 350, w: 40, h: 50, hp: 80, speed: 150, patrolLeft: 1200, patrolRight: 1450, dir: 1, type: 'warrior' }
        ],
        color: '#4CAF50', // Greenish hills
        platformColor: '#8B4513', // Brown dirt
        groundY: 600
    }
};

let currentLevelData = null;
let enemies = [];

function loadLevel(levelKey) {
    currentLevelData = LEVELS[levelKey];
    player.reset();

    // Deep copy enemies so we can modify them
    enemies = JSON.parse(JSON.stringify(currentLevelData.enemies));
    updateHUD();
}

function checkCollisions(dt) {
    player.grounded = false;

    // Check platforms
    for (let p of currentLevelData.platforms) {
        // Simple AABB collision from above
        if (player.vy >= 0 &&
            player.x + player.width > p.x &&
            player.x < p.x + p.w &&
            player.y + player.height <= p.y + player.vy * dt + 5 && // Was above it last frame
            player.y + player.height >= p.y) {

            player.grounded = true;
            player.vy = 0;
            player.y = p.y - player.height;
        }
    }

    // Fall death
    if (player.y > canvas.height + 200) {
        player.takeDamage(100);
    }
}

function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];

        // Patrol
        e.x += e.speed * e.dir * dt;
        if (e.x < e.patrolLeft) {
            e.x = e.patrolLeft;
            e.dir = 1;
        } else if (e.x + e.w > e.patrolRight) {
            e.x = e.patrolRight - e.w;
            e.dir = -1;
        }

        // Check player attack collision
        if (player.isAttacking) {
            let hitX = player.facingRight ? player.x + player.width : player.x - 40;
            let hitY = player.y + 10;
            let hitW = 40;
            let hitH = 20;

            if (hitX < e.x + e.w && hitX + hitW > e.x &&
                hitY < e.y + e.h && hitY + hitH > e.y) {
                // Hit enemy
                e.hp -= player.damage * (dt * 10); // Simple continuous damage for demonstration
                if (e.hp <= 0) {
                    player.xp += 50;
                    player.points += 20;
                    enemies.splice(i, 1);
                    updateHUD();
                    continue;
                }
            }
        }

        // Enemy touches player
        if (player.x < e.x + e.w && player.x + player.width > e.x &&
            player.y < e.y + e.h && player.y + player.height > e.y) {
            player.takeDamage(10 * dt); // Continuous small damage while touching
        }
    }
}

// Input Handling (Keyboard)
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Input Handling (Mobile)
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump = document.getElementById('btn-jump');
const btnAttack = document.getElementById('btn-attack');
const btnDashAction = document.getElementById('btn-dash-action'); // For danger dash

function setupMobileControls() {
    // Touch start
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowLeft'] = true; btnLeft.classList.add('active'); }, {passive: false});
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowRight'] = true; btnRight.classList.add('active'); }, {passive: false});
    btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); keys['Space'] = true; btnJump.classList.add('active'); }, {passive: false});
    btnAttack.addEventListener('touchstart', (e) => { e.preventDefault(); keys['KeyZ'] = true; btnAttack.classList.add('active'); }, {passive: false});
    btnDashAction.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ShiftLeft'] = true; btnDashAction.classList.add('active'); }, {passive: false});

    // Touch end
    btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowLeft'] = false; btnLeft.classList.remove('active'); }, {passive: false});
    btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowRight'] = false; btnRight.classList.remove('active'); }, {passive: false});
    btnJump.addEventListener('touchend', (e) => { e.preventDefault(); keys['Space'] = false; btnJump.classList.remove('active'); }, {passive: false});
    btnAttack.addEventListener('touchend', (e) => { e.preventDefault(); keys['KeyZ'] = false; btnAttack.classList.remove('active'); }, {passive: false});
    btnDashAction.addEventListener('touchend', (e) => { e.preventDefault(); keys['ShiftLeft'] = false; btnDashAction.classList.remove('active'); }, {passive: false});

    // Mouse fallback for testing
    btnLeft.addEventListener('mousedown', () => { keys['ArrowLeft'] = true; });
    btnLeft.addEventListener('mouseup', () => { keys['ArrowLeft'] = false; });
    btnRight.addEventListener('mousedown', () => { keys['ArrowRight'] = true; });
    btnRight.addEventListener('mouseup', () => { keys['ArrowRight'] = false; });
    btnJump.addEventListener('mousedown', () => { keys['Space'] = true; });
    btnJump.addEventListener('mouseup', () => { keys['Space'] = false; });
    btnAttack.addEventListener('mousedown', () => { keys['KeyZ'] = true; });
    btnAttack.addEventListener('mouseup', () => { keys['KeyZ'] = false; });
    btnDashAction.addEventListener('mousedown', () => { keys['ShiftLeft'] = true; });
    btnDashAction.addEventListener('mouseup', () => { keys['ShiftLeft'] = false; });
}
setupMobileControls();

// UI Elements
const uiMainMenu = document.getElementById('main-menu');
const uiHud = document.getElementById('hud');
const uiStore = document.getElementById('store-menu');
const uiGameOver = document.getElementById('game-over');
const uiLevelComplete = document.getElementById('level-complete');

const hudHp = document.getElementById('hud-hp');
const hudXp = document.getElementById('hud-xp');
const hudPoints = document.getElementById('hud-points');
const hudLevel = document.getElementById('hud-level');

// Button Listeners
document.getElementById('btn-start').addEventListener('click', () => {
    setState(STATE.PLAYING_LAGOS);
});
document.getElementById('btn-dash').addEventListener('click', () => {
    setState(STATE.DANGER_DASH);
});
document.getElementById('btn-store').addEventListener('click', () => {
    setState(STATE.STORE);
});
document.getElementById('btn-close-store').addEventListener('click', () => {
    setState(STATE.MENU);
});

document.getElementById('btn-buy-spear').addEventListener('click', () => {
    if (player.points >= 50) {
        player.points -= 50;
        player.damage += 10;
        updateHUD();
        alert("Spear of the Elders purchased! Damage increased.");
    } else {
        alert("Not enough points!");
    }
});

document.getElementById('btn-buy-health').addEventListener('click', () => {
    if (player.points >= 30) {
        player.points -= 30;
        player.hp += 50;
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        updateHUD();
        alert("Baobab Potion purchased! HP restored.");
    } else {
        alert("Not enough points!");
    }
});
document.getElementById('btn-restart').addEventListener('click', () => {
    setState(STATE.PLAYING_LAGOS); // Default restart to Lagos
});
document.getElementById('btn-main-menu').addEventListener('click', () => {
    setState(STATE.MENU);
});
document.getElementById('btn-next-level').addEventListener('click', () => {
    setState(STATE.PLAYING_KIGALI);
});


function hideAllUI() {
    uiMainMenu.classList.add('hidden');
    uiHud.classList.add('hidden');
    uiStore.classList.add('hidden');
    uiGameOver.classList.add('hidden');
    uiLevelComplete.classList.add('hidden');
}

function setState(newState) {
    currentState = newState;
    hideAllUI();
    keys = {}; // Reset keys

    switch(currentState) {
        case STATE.MENU:
            uiMainMenu.classList.remove('hidden');
            break;
        case STATE.PLAYING_LAGOS:
            uiHud.classList.remove('hidden');
            hudLevel.innerText = "Lagos";
            loadLevel('LAGOS');
            break;
        case STATE.PLAYING_KIGALI:
            uiHud.classList.remove('hidden');
            hudLevel.innerText = "Kigali";
            loadLevel('KIGALI');
            break;
        case STATE.DANGER_DASH:
            uiHud.classList.remove('hidden');
            hudLevel.innerText = "Danger Dash";
            startDashMode();
            break;
        case STATE.STORE:
            uiStore.classList.remove('hidden');
            // Update store UI
            break;
        case STATE.GAME_OVER:
            uiGameOver.classList.remove('hidden');
            break;
        case STATE.LEVEL_COMPLETE:
            uiLevelComplete.classList.remove('hidden');
            break;
    }
}

// Main Game Loop
function update(deltaTime) {
    let dt = deltaTime / 1000; // Convert to seconds
    if (dt > 0.1) dt = 0.1; // Cap delta time

    if (currentState === STATE.PLAYING_LAGOS || currentState === STATE.PLAYING_KIGALI) {
        player.update(dt);
        checkCollisions(dt);
        updateEnemies(dt);

        // Simple camera follow
        camera.x = player.x - canvas.width / 2 + player.width / 2;
        if (camera.x < 0) camera.x = 0;

        // Win condition (reach far right)
        if (player.x > 2500) {
            setState(STATE.LEVEL_COMPLETE);
        }

    } else if (currentState === STATE.DANGER_DASH) {
        updateDash(dt);
    }
}

function drawLevel() {
    // Draw background
    ctx.fillStyle = currentLevelData.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Sun/Moon decoration
    ctx.fillStyle = '#FFD700'; // Gold sun
    ctx.beginPath();
    ctx.arc(800 - camera.x * 0.1, 100, 50, 0, Math.PI * 2);
    ctx.fill();

    // Draw Platforms
    ctx.fillStyle = currentLevelData.platformColor;
    for (let p of currentLevelData.platforms) {
        ctx.fillRect(p.x - camera.x, p.y - camera.y, p.w, p.h);
        // Add grass top for Kigali, concrete top for Lagos
        if (currentState === STATE.PLAYING_KIGALI) {
            ctx.fillStyle = '#228B22'; // Forest Green
            ctx.fillRect(p.x - camera.x, p.y - camera.y, p.w, 10);
            ctx.fillStyle = currentLevelData.platformColor; // Reset for next platform
        } else {
            ctx.fillStyle = '#696969'; // Dim grey
            ctx.fillRect(p.x - camera.x, p.y - camera.y, p.w, 10);
            ctx.fillStyle = currentLevelData.platformColor;
        }
    }

    // Draw Enemies
    for (let e of enemies) {
        let isMoving = Math.abs(e.speed) > 0;
        let enemyBobY = isMoving ? Math.sin(Date.now() / 150 + e.x) * 4 : 0;
        let enemyTilt = isMoving ? Math.sin(Date.now() / 200 + e.x) * 0.1 : 0;
        let facingRight = e.dir > 0;

        ctx.save();
        ctx.translate(e.x - camera.x + e.w / 2, e.y - camera.y + e.h / 2 + enemyBobY - 15);
        ctx.rotate(enemyTilt);

        let imgToDraw = e.type === 'thug' ? imgEnemy1 : imgEnemy2;

        if (imgToDraw.complete) {
            if (!facingRight) {
                ctx.scale(-1, 1);
            }
            ctx.drawImage(imgToDraw, -e.w / 2 - 10, -e.h / 2 - 30, e.w + 20, e.h + 30);
        } else {
            ctx.fillStyle = e.type === 'thug' ? '#800080' : '#8B0000';
            ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
        }

        ctx.restore();

        // Enemy HP bar
        ctx.fillStyle = 'red';
        ctx.fillRect(e.x - camera.x, e.y - camera.y - 15, e.w, 5);
        ctx.fillStyle = 'green';
        ctx.fillRect(e.x - camera.x, e.y - camera.y - 15, e.w * (e.hp / (e.type==='thug'?50:80)), 5);
    }

    // Draw Player
    player.draw(ctx);
}

function draw() {
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentState === STATE.MENU || currentState === STATE.STORE || currentState === STATE.GAME_OVER || currentState === STATE.LEVEL_COMPLETE) {
        // Draw background for menus
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (currentState === STATE.PLAYING_LAGOS || currentState === STATE.PLAYING_KIGALI) {
        drawLevel();
    } else if (currentState === STATE.DANGER_DASH) {
        drawDash();
    }
}

function gameLoop(timestamp) {
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// Start
setState(STATE.MENU);
requestAnimationFrame(gameLoop);
