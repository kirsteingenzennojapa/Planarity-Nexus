// === script.js ===
// Planarity Nexus: Galaxy Edition (Rules 1–4 + HUD + difficulty multiplier + auto-continue)
// - HUD shows live Complexity (no Balance score)
// - Per-level multiplier (Easy / Hard / Expert) applied to complexity score
// - Timer stops when graph is planar
// - Robust Generate New hookup preserved
// - Auto-continue: when a graph is solved, automatically generate a new graph after a short pause
// - Difficulty node counts:
//      Easy  -> 5 nodes
//      Hard  -> 6–10 nodes
//      Expert-> 11–20 nodes

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const floatingHUD = document.getElementById("floatingHUD");

if (canvas) canvas.style.touchAction = 'none';

let nodes = [];
let edges = [];
let selectedNode = null;
let moves = 0;
let timer = 0;
let score = 0;
let planarity = 0;
let initialCrossings = 1;
let solving = false;
let particles = [];

// === Difficulty multiplier ===
function getDifficultyMultiplier() {
  const p = new URLSearchParams(window.location.search).get("difficulty") || "Easy";
  if (/expert/i.test(p)) return 1.6;
  if (/hard/i.test(p)) return 1.3;
  return 1.0;
}
const DIFFICULTY_MULT = getDifficultyMultiplier();

// === Node count per difficulty ===
function getNodeCountByDifficulty() {
  const diff = new URLSearchParams(window.location.search).get("difficulty") || "Easy";

  if (/expert/i.test(diff)) {
    // 11–20
    return Math.floor(Math.random() * 10) + 11;
  }
  if (/hard/i.test(diff)) {
    // 6–10
    return Math.floor(Math.random() * 5) + 6;
  }
  // Easy: fixed 5 nodes
  return 5;
}

// === STARFIELD BACKGROUND ===
function createParticles(count = 120) {
  particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2,
      speed: Math.random() * 0.3 + 0.1,
      alpha: Math.random() * 0.6 + 0.3,
    });
  }
}

function drawParticles() {
  for (const p of particles) {
    p.y += p.speed;
    if (p.y > canvas.height) p.y = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 150, ${p.alpha})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(255, 215, 150, 0.8)";
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// === UTILITY ===
function random(min, max) {
  return Math.random() * (max - min) + min;
}

function intersect(a, b, c, d) {
  function ccw(p1, p2, p3) {
    return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  }
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

// === GRAPH GENERATION ===
function generateGraph(numNodes = null) {
  nodes = [];
  edges = [];

  if (!canvas.width || !canvas.height) resizeCanvas();

  if (!numNodes) numNodes = getNodeCountByDifficulty();

  const margin = 80;
  for (let i = 0; i < numNodes; i++) {
    nodes.push({
      x: random(margin, canvas.width - margin),
      y: random(margin, canvas.height - margin),
      radius: Math.max(8, Math.min(14, canvas.width * 0.012)),
      color: "#FFD700",
    });
  }

  // === Random edges (with guaranteed connectivity) ===
for (let i = 0; i < numNodes - 1; i++) {
  for (let j = i + 1; j < numNodes; j++) {
    if (Math.random() < 0.35) edges.push([i, j]);
  }
}

// ✅ Ensure every node has at least one connection
for (let i = 0; i < numNodes; i++) {
  const hasEdge = edges.some(([a, b]) => a === i || b === i);
  if (!hasEdge) {
    // randomly connect isolated node to another node
    let target;
    do {
      target = Math.floor(Math.random() * numNodes);
    } while (target === i);
    edges.push([i, target]);
  }
}


  // Reset variables
  moves = 0;
  timer = 0;
  score = 0;
  planarity = 0;
  window._planaritySaved = false;

  // ✅ Reset and restart timer properly
  window._timerStopped = false;
  if (window._timerInterval) clearInterval(window._timerInterval);
  window._timerInterval = setInterval(() => {
    if (!window._timerStopped) {
      timer++;
      updateStats();
    }
  }, 1000);

  // Cancel any scheduled auto-continue (user generated new graph)
  window._autoContinueScheduled = false;

  // Initialize crossings and draw
  initialCrossings = countCrossings();
  if (initialCrossings === 0) initialCrossings = 1;
  updateStats();
  drawGraph();
}

// === CROSSING DETECTION ===
function countCrossings() {
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a1, a2] = edges[i];
      const [b1, b2] = edges[j];
      if (
        a1 !== b1 &&
        a1 !== b2 &&
        a2 !== b1 &&
        a2 !== b2 &&
        intersect(nodes[a1], nodes[a2], nodes[b1], nodes[b2])
      ) {
        crossings++;
      }
    }
  }
  return crossings;
}

// === COMPLEXITY (Rule 4) ===
function graphComplexityScore() {
  const base = edges.length * 6 + nodes.length * 2;
  return Math.round(base * DIFFICULTY_MULT);
}

// === DRAW GRAPH ===
function drawGraph() {
  if (!canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,10,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawParticles();

  const crossings = countCrossings();
  const isPlanar = crossings === 0;

  // Draw edges
  for (const [a, b] of edges) {
    const crossed = edges.some(([c, d]) => {
      if (a === c || a === d || b === c || b === d) return false;
      return intersect(nodes[a], nodes[b], nodes[c], nodes[d]);
    });

    ctx.beginPath();
    ctx.moveTo(nodes[a].x, nodes[a].y);
    ctx.lineTo(nodes[b].x, nodes[b].y);
    ctx.lineWidth = 2.5;

    if (isPlanar) {
      ctx.strokeStyle = "rgba(255, 250, 240, 0.98)";
      ctx.shadowColor = "rgba(255, 240, 200, 0.95)";
      ctx.shadowBlur = 22;
    } else {
      ctx.strokeStyle = crossed ? "rgba(255,80,80,0.98)" : "rgba(100,255,160,0.95)";
      ctx.shadowColor = crossed ? "rgba(255,60,60,0.8)" : "rgba(160,255,200,0.6)";
      ctx.shadowBlur = crossed ? 10 : 14;
    }
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  // Draw nodes
  for (const node of nodes) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    if (isPlanar) {
      ctx.fillStyle = "rgba(255,250,240,1)";
      ctx.shadowColor = "rgba(255,240,200,0.95)";
      ctx.shadowBlur = 30;
    } else {
      ctx.fillStyle = node.color;
      ctx.shadowColor = "rgba(255,215,0,0.9)";
      ctx.shadowBlur = 20;
    }
    ctx.fill();
  }

  // === Planar Success ===
  if (isPlanar) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(120,255,150,0.95)";
    ctx.font = "26px Orbitron, sans-serif";
    ctx.fillText("Planar Graph Achieved!", Math.max(20, canvas.width / 2 - 220), 90);

    if (!window._planaritySaved) {
      const params = new URLSearchParams(window.location.search);
      const difficulty = params.get("difficulty") || "Default";
      savePlanarityHistory(difficulty, score, moves, timer);
      window._planaritySaved = true;
    }

    if (!window._timerStopped) {
      clearInterval(window._timerInterval);
      window._timerStopped = true;
    }

    // schedule auto-continue (generate next graph) if not already scheduled
    autoContinueIfSolved();

    
  }

  updatePlanarity(crossings);
  updateFloatingHUD();
  saveCurrentProgress();
}

// === PLANARITY + SCORE (no balance) ===
function updatePlanarity(crossings) {
  if (!initialCrossings || initialCrossings <= 0) initialCrossings = Math.max(1, countCrossings());
  const progress = Math.max(0, initialCrossings - crossings);
  planarity = Math.round((progress / initialCrossings) * 100);

  const complexityScore = graphComplexityScore();
  const baseFromPlanarity = planarity * 12;
  const raw = baseFromPlanarity + complexityScore - (moves * 2) - timer;
  score = Math.max(0, Math.round(raw));

  updateStats();
}

// === HUD Overlay ===
function updateFloatingHUD() {
  if (!floatingHUD) return;
  const complexity = graphComplexityScore();
  const dif = new URLSearchParams(window.location.search).get("difficulty") || "Easy";
  floatingHUD.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;">
      <span>🌟 <strong>Result</strong></span>
      <span style="opacity:0.9">⚙️ Complexity: <strong>${complexity}</strong></span>
      <span style="opacity:0.85">🎚️ ${dif}</span>
    </div>
  `;
}

// === UI Stats ===
function updateStats() {
  const elMoves = document.getElementById("moves");
  const elTimer = document.getElementById("timer");
  const elScore = document.getElementById("score");
  const elPlan = document.getElementById("planarity");

  if (elMoves) elMoves.innerText = moves;
  if (elTimer) elTimer.innerText = `${timer}s`;
  if (elScore) elScore.innerText = score;
  if (elPlan) elPlan.innerText = `${planarity}%`;
}

// === AI HINT ===
function aiHint() {
  let nodeCrossCount = Array(nodes.length).fill(0);
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a1, a2] = edges[i];
      const [b1, b2] = edges[j];
      if (
        a1 !== b1 &&
        a1 !== b2 &&
        a2 !== b1 &&
        a2 !== b2 &&
        intersect(nodes[a1], nodes[a2], nodes[b1], nodes[b2])
      ) {
        nodeCrossCount[a1]++; nodeCrossCount[a2]++;
        nodeCrossCount[b1]++; nodeCrossCount[b2]++;
      }
    }
  }
  const worstNode = nodeCrossCount.indexOf(Math.max(...nodeCrossCount));
  if (worstNode >= 0) {
    nodes[worstNode].color = "#FFFF66";
    setTimeout(() => { nodes[worstNode].color = "#FFD700"; drawGraph(); }, 1400);
  }
  drawGraph();
}

// === AUTO SOLVE (Instant Planarity Mode) ===
function autoSolve() {
  if (solving) return;
  solving = true;

  console.log("Auto Solve Activated: Instant planarity solving...");

  // If already solved, skip
  if (countCrossings() === 0) {
    solving = false;
    drawGraph();
    return;
  }

  const maxAttempts = 8000; // maximum repositioning attempts
  const margin = 40;
  let attempts = 0;

  // Attempt random repositioning until no crossings remain
  while (countCrossings() > 0 && attempts < maxAttempts) {
    for (let i = 0; i < nodes.length; i++) {
      // Randomly reposition nodes within safe canvas bounds
      nodes[i].x = random(margin, canvas.width - margin);
      nodes[i].y = random(margin, canvas.height - margin);
    }
    attempts++;
  }

  // If still unsolved after many attempts, fallback heuristic
  if (countCrossings() > 0) {
    console.warn("Could not fully solve using random repositioning. Applying heuristic cleanup...");

    // Heuristic: spread nodes evenly in circular layout
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 3;

    for (let i = 0; i < nodes.length; i++) {
      const angle = (2 * Math.PI * i) / nodes.length;
      nodes[i].x = centerX + radius * Math.cos(angle);
      nodes[i].y = centerY + radius * Math.sin(angle);
    }
  }

  // Final check & draw
  solving = false;
  drawGraph();

  const solved = countCrossings() === 0;
  if (solved) {
    console.log("✅ Graph solved instantly!");
  } else {
    console.warn("⚠️ Graph may still have minor crossings after max attempts.");
  }

  // Stop timer and save as solved
  if (!window._timerStopped) {
    clearInterval(window._timerInterval);
    window._timerStopped = true;
  }

  // Trigger "Planar Achieved" visuals and scoring update
  updateStats();
  updateFloatingHUD();
  savePlanarityHistory(
    new URLSearchParams(window.location.search).get("difficulty") || "Unknown",
    score,
    moves,
    timer
  );
  drawGraph();
}


// === SAVE HISTORY ===
function savePlanarityHistory(difficulty, scoreVal, movesVal, timerVal) {
  const history = JSON.parse(localStorage.getItem("planarityHistory")) || [];
  const nodeData = nodes.map(n => ({
    x: (n.x / canvas.width).toFixed(3),
    y: (n.y / canvas.height).toFixed(3)
  }));
  const edgeData = edges.map(([a, b]) => [a, b]);
  const newRecord = {
    difficulty: difficulty || "Unknown",
    score: scoreVal,
    moves: movesVal,
    time: `${timerVal}s`,
    date: new Date().toLocaleString(),
    nodes: nodeData,
    edges: edgeData,
    complexity: graphComplexityScore()
  };
  history.push(newRecord);
  localStorage.setItem("planarityHistory", JSON.stringify(history));
}

// === SAVE / LOAD CURRENT ===
function saveCurrentProgress() {
  const currentData = {
    nodes: nodes.map(n => ({ x: n.x, y: n.y })),
    edges,
    moves,
    timer,
    score,
    planarity,
    difficulty: new URLSearchParams(window.location.search).get("difficulty") || "Easy",
  };
  localStorage.setItem("currentPlanarityGame", JSON.stringify(currentData));
}

function loadCurrentProgress() {
  const saved = JSON.parse(localStorage.getItem("currentPlanarityGame"));
  if (!saved) return false;
  nodes = saved.nodes.map(n => ({
    x: n.x,
    y: n.y,
    radius: Math.max(8, Math.min(14, canvas.width * 0.012)),
    color: "#FFD700"
  }));
  edges = saved.edges || [];
  moves = saved.moves || 0;
  timer = saved.timer || 0;
  score = saved.score || 0;
  planarity = saved.planarity || 0;
  initialCrossings = countCrossings() || 1;
  updateStats();
  drawGraph();
  return true;
}

// === DRAG / POINTER HANDLERS ===
function getPointerPosition(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  return { x: (touch.clientX - rect.left), y: (touch.clientY - rect.top) };
}

function startDrag(e) {
  const pos = getPointerPosition(e);
  selectedNode = nodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) < n.radius + 8);
  if (selectedNode && e.cancelable) e.preventDefault();
}

function drag(e) {
  if (!selectedNode) return;
  if (e.cancelable) e.preventDefault();
  const pos = getPointerPosition(e);
  selectedNode.x = Math.max(10, Math.min(canvas.width - 10, pos.x));
  selectedNode.y = Math.max(10, Math.min(canvas.height - 10, pos.y));
  moves++;
  drawGraph();
}

function endDrag() { selectedNode = null; }

canvas.addEventListener("mousedown", startDrag, { passive: false });
canvas.addEventListener("mousemove", drag, { passive: false });
canvas.addEventListener("mouseup", endDrag);
canvas.addEventListener("mouseleave", endDrag);
canvas.addEventListener("touchstart", startDrag, { passive: false });
canvas.addEventListener("touchmove", drag, { passive: false });
canvas.addEventListener("touchend", endDrag);
canvas.addEventListener("touchcancel", endDrag);

// === BUTTONS ===
const resetBtn = document.getElementById("resetBtn");
const hintBtn = document.getElementById("hintBtn");
const autoSolveBtn = document.getElementById("autoSolveBtn");

if (resetBtn) resetBtn.addEventListener("click", () => generateGraph());
if (hintBtn) hintBtn.addEventListener("click", aiHint);
if (autoSolveBtn) autoSolveBtn.addEventListener("click", autoSolve);

// === GENERATE NEW ===
function findGenerateNewButton() {
  let btn = document.getElementById("generateNewBtn");
  if (!btn) btn = document.querySelector('[data-action="generate-new"]');
  if (!btn) btn = document.querySelector(".generate-new");
  return btn;
}

const generateBtn = findGenerateNewButton();

if (!generateBtn) {
  console.warn("Generate New Graph button not found.");
} else {
  const cloned = generateBtn.cloneNode(true);
  generateBtn.parentNode.replaceChild(cloned, generateBtn);
  const freshBtn = findGenerateNewButton();
  freshBtn.addEventListener("click", () => {
    window._planaritySaved = false;
    window._autoContinueScheduled = false;
    const num = getNodeCountByDifficulty();
    console.log("Generate New Graph clicked. nodes:", num);
    generateGraph(num);
    createParticles();
    drawGraph();
  });
  console.log("Generate New Graph button hooked up successfully.");
}

// === AUTO CONTINUE ===
function autoContinueIfSolved() {
  if (window._autoContinueScheduled) return; 
  if (!nodes || nodes.length === 0) return;
  window._autoContinueScheduled = true;

  setTimeout(() => {
    if (!window._autoContinueScheduled) return;

    const nextNum = getNodeCountByDifficulty();

    window._planaritySaved = false;
    window._timerStopped = false;
    window._autoContinueScheduled = false;

    generateGraph(nextNum);
    createParticles();
    drawGraph();
  }, 2000); 
}

// === INIT / TIMER (single source of truth is in generateGraph) ===
createParticles();
const params = new URLSearchParams(window.location.search);
if (!loadCurrentProgress() || params.get("new") === "true") {
  generateGraph();
}

function animate() {
  drawGraph();
  requestAnimationFrame(animate);
}
animate();

// === RESIZE ===
function resizeCanvas() {
  const container = document.getElementById("canvasContainer");
  if (!container) return;
  const rect = container.getBoundingClientRect();
  canvas.width = Math.max(300, Math.floor(rect.width));
  canvas.height = Math.max(240, Math.floor(rect.height));
  createParticles();
  for (const n of nodes) {
    n.radius = Math.max(8, Math.min(14, canvas.width * 0.012));
    n.x = Math.max(10, Math.min(canvas.width - 10, n.x));
    n.y = Math.max(10, Math.min(canvas.height - 10, n.y));
  }
  if (!initialCrossings || initialCrossings <= 0) initialCrossings = Math.max(1, countCrossings());
  drawGraph();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
