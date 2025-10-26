// Minimalist 2D Sandbox Game (large world, bedrock layer, fix for browser performance)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const BLOCK_SIZE = 32;
const WORLD_W = 250; // Wide world
const WORLD_H = 400; // Very deep world!
const INVENTORY_TYPES = ["dirt", "stone", "wood", "leaf"];
const BLOCK_COLORS = {
  dirt: "#b97a57",
  stone: "#aaa",
  wood: "#8b5c2a",
  leaf: "#3fc25b",
  bedrock: "#222"
};
const skyColors = ["#87ceeb", "#232d4b"];

let keys = {}, mouse = { x: 0, y: 0, down: false, right: false };
let world = [];
let inventory = { dirt: 0, stone: 0, wood: 0, leaf: 0 };
let selectedType = INVENTORY_TYPES[0];
let timeOfDay = 0;
let stickman = {
  x: Math.floor(WORLD_W/2), y: WORLD_H-10.5, vx: 0, vy: 0,
  w: 18/BLOCK_SIZE, h: 40/BLOCK_SIZE, grounded: false, face: 1
};
let cam = { x: stickman.x, y: stickman.y };

function playSound(id) {
  let s = document.getElementById(id);
  s.currentTime = 0; s.play();
}

// World Generation (bedrock at bottom)
function genWorld() {
  world = [];
  for (let y=0; y<WORLD_H; ++y) {
    let row = [];
    for (let x=0; x<WORLD_W; ++x) {
      if (y === WORLD_H-1) row.push("bedrock"); // Bedrock layer at bottom
      else if (y > WORLD_H-11) row.push("dirt"); // Deep solid ground
      else if (y === WORLD_H-11) row.push("dirt"); // Surface is always solid
      else if (y === WORLD_H-12) row.push("stone"); // Stone layer just below top ground
      else if (y > WORLD_H-40) row.push(Math.random()<0.03 ? "stone" : null);
      else row.push(null);
    }
    world.push(row);
  }
  // Trees only on solid ground
  for (let x=3; x<WORLD_W-3; x++) {
    if (Math.random() < 0.07) {
      let y = WORLD_H-12;
      addTree(x, y);
    }
  }
}

function addTree(x, y) {
  let trunkHeight = 4 + Math.floor(Math.random()*3);
  for (let h=0; h<trunkHeight; h++) {
    let ty = y-h;
    if (ty>=0 && ty<WORLD_H && world[ty][x] !== "bedrock") world[ty][x] = "wood";
  }
  let leafStart = y-trunkHeight;
  for (let dy=-2; dy<=0; dy++) {
    for (let dx=-2; dx<=2; dx++) {
      let lx = x+dx, ly = leafStart+dy;
      if (lx>=0 && lx<WORLD_W && ly>=0 && ly<WORLD_H && world[ly][lx] !== "bedrock") {
        if (Math.abs(dx)+Math.abs(dy)<4) {
          world[ly][lx] = "leaf";
        }
      }
    }
  }
}

function drawWorld() {
  // Only draw blocks visible on canvas for performance!
  let minX = Math.max(0, Math.floor(cam.x - W/(2*BLOCK_SIZE)) - 2);
  let maxX = Math.min(WORLD_W, Math.ceil(cam.x + W/(2*BLOCK_SIZE)) + 2);
  let minY = Math.max(0, Math.floor(cam.y - H/(2*BLOCK_SIZE)) - 2);
  let maxY = Math.min(WORLD_H, Math.ceil(cam.y + H/(2*BLOCK_SIZE)) + 2);
  for (let y=minY; y<maxY; ++y) {
    for (let x=minX; x<maxX; ++x) {
      let type = world[y][x];
      if (type && BLOCK_COLORS[type]) {
        ctx.fillStyle = BLOCK_COLORS[type];
        ctx.fillRect(
          (x-cam.x)*BLOCK_SIZE+W/2,
          (y-cam.y)*BLOCK_SIZE+H/2,
          BLOCK_SIZE, BLOCK_SIZE
        );
      }
    }
  }
}

function drawStickman() {
  let px = (stickman.x-cam.x)*BLOCK_SIZE+W/2;
  let py = (stickman.y-cam.y)*BLOCK_SIZE+H/2;
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px, py-16, 8, 0, Math.PI*2);
  ctx.moveTo(px, py-8); ctx.lineTo(px, py+18);
  let legA = px-6, legB = px+6, legY = py+18, legY2 = py+32;
  ctx.moveTo(px, py+18); ctx.lineTo(legA, legY2);
  ctx.moveTo(px, py+18); ctx.lineTo(legB, legY2);
  ctx.moveTo(px, py); ctx.lineTo(px-10*stickman.face, py+8);
  ctx.moveTo(px, py); ctx.lineTo(px+10*stickman.face, py+8);
  ctx.stroke();
}

function drawInventory() {
  let invDiv = document.getElementById("inventory");
  invDiv.innerHTML = INVENTORY_TYPES.map((type, i) =>
    `<span class="inv-item" style="${
      selectedType === type ? 'outline:2px solid #0057ff; background:#e0f0ff;' : ''
    }">
      <span class="block-icon block-${type}" style="background:${BLOCK_COLORS[type]}"></span>
      <span>${inventory[type]}</span>
      <span style="font-size:12px; color:#888;">[${i+1}]</span>
    </span>`
  ).join('');
}

function updateCamera() {
  cam.x += (stickman.x-cam.x)*0.08;
  cam.y += (stickman.y-cam.y)*0.08;
}

function updateStickman() {
  stickman.vx = 0;
  if (keys["ArrowLeft"] || keys["a"]) { stickman.vx -= 4; stickman.face = -1; }
  if (keys["ArrowRight"] || keys["d"]) { stickman.vx += 4; stickman.face = 1; }
  stickman.vy += 0.5;
  stickman.vy = Math.min(stickman.vy, 12);

  let nx = stickman.x + stickman.vx/BLOCK_SIZE;
  if (!collides(nx, stickman.y)) stickman.x = nx;

  let ny = stickman.y + stickman.vy/BLOCK_SIZE;
  if (!collides(stickman.x, ny)) {
    stickman.y = ny;
    stickman.grounded = false;
  } else {
    if (stickman.vy > 0) stickman.grounded = true;
    stickman.vy = 0;
  }
  if ((keys[" "] || keys["w"] || keys["ArrowUp"]) && stickman.grounded) {
    stickman.vy = -10;
    playSound("jumpSound");
    stickman.grounded = false;
  }
  if (stickman.vx != 0 && stickman.grounded) playSound("walkSound");
}

function collides(x, y) {
  let gx = Math.floor(x), gy = Math.floor(y+stickman.h/2);
  if (gx < 0 || gy < 0 || gx >= WORLD_W || gy >= WORLD_H) return true;
  return !!world[gy][gx];
}

function blockAction(breaking) {
  let mx = Math.floor(cam.x + (mouse.x-W/2)/BLOCK_SIZE);
  let my = Math.floor(cam.y + (mouse.y-H/2)/BLOCK_SIZE);
  if (mx>=0 && my>=0 && mx<WORLD_W && my<WORLD_H) {
    if (breaking) {
      let type = world[my][mx];
      if (type === "bedrock") return;
      if (type && INVENTORY_TYPES.includes(type)) {
        world[my][mx] = null;
        inventory[type]++;
        playSound("breakSound");
        for (let i=0; i<8; ++i) particles.push({
          x: mx, y: my,
          dx: (Math.random()-0.5)*2, dy: (Math.random()-0.5)*2,
          color: BLOCK_COLORS[type], life: 15+Math.random()*10
        });
      }
    } else {
      if (world[my][mx] !== "bedrock" && inventory[selectedType]>0 && !world[my][mx]) {
        world[my][mx] = selectedType;
        inventory[selectedType]--;
        playSound("placeSound");
      }
    }
  }
}

let particles = [];
function updateParticles() {
  for (let p of particles) {
    p.x += p.dx*0.1;
    p.y += p.dy*0.1;
    p.dy += 0.05;
    p.life--;
  }
  particles = particles.filter(p=>p.life>0);
}
function drawParticles() {
  for (let p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(
      (p.x-cam.x)*BLOCK_SIZE+W/2,
      (p.y-cam.y)*BLOCK_SIZE+H/2,
      6, 6
    );
  }
}

function updateDayNight() {
  timeOfDay += 0.0002;
  if (timeOfDay > 1) timeOfDay = 0;
  let bg = lerpColor(skyColors[0], skyColors[1], Math.abs(Math.sin(timeOfDay*Math.PI)));
  document.body.style.background = bg;
  canvas.style.background = bg;
}
function lerpColor(a, b, t) {
  let ah=[parseInt(a.substr(1,2),16),parseInt(a.substr(3,2),16),parseInt(a.substr(5,2),16)];
  let bh=[parseInt(b.substr(1,2),16),parseInt(b.substr(3,2),16),parseInt(b.substr(5,2),16)];
  let rh = ah.map((v,i)=>Math.round(v*(1-t)+bh[i]*t));
  return `rgb(${rh[0]},${rh[1]},${rh[2]})`;
}

// Mouse/Key Events
canvas.addEventListener("mousemove", e=>{
  mouse.x = e.offsetX; mouse.y = e.offsetY;
});
canvas.addEventListener("mousedown", e=>{
  if (e.button === 0) { mouse.down = true; blockAction(true); }
  if (e.button === 2) { mouse.right = true; blockAction(false); }
});
canvas.addEventListener("mouseup", e=>{
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) mouse.right = false;
});
canvas.addEventListener("contextmenu", e=>e.preventDefault());
window.addEventListener("keydown", e=>{
  keys[e.key] = true;
  if (e.key === "1") selectedType = INVENTORY_TYPES[0];
  if (e.key === "2") selectedType = INVENTORY_TYPES[1];
  if (e.key === "3") selectedType = INVENTORY_TYPES[2];
  if (e.key === "4") selectedType = INVENTORY_TYPES[3];
  drawInventory();
});
window.addEventListener("keyup", e=>{ keys[e.key] = false; });

// Save/Load
function saveWorld() {
  localStorage.setItem("sandbox_world", JSON.stringify(world));
  localStorage.setItem("sandbox_inv", JSON.stringify(inventory));
}
function loadWorld() {
  let ws = localStorage.getItem("sandbox_world");
  let inv = localStorage.getItem("sandbox_inv");
  if (ws) world = JSON.parse(ws);
  if (inv) inventory = JSON.parse(inv);
}
document.addEventListener("keydown", e => {
  if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
    saveWorld();
    alert("World Saved!");
  }
  if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
    loadWorld();
    alert("World Loaded!");
  }
});

function loop() {
  updateDayNight();
  updateCamera();
  updateStickman();
  updateParticles();

  ctx.clearRect(0,0,W,H);
  drawWorld();
  drawParticles();
  drawStickman();
  drawInventory();

  requestAnimationFrame(loop);
}

// Start
genWorld();
drawInventory();
loop();
