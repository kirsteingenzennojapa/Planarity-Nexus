// === Planarity Nexus: Galaxy Edition ===
// Starfield overlay + glowing constellations ✨
// Red = crossing edges, Green = clean, Yellow = AI Hint

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let nodes = [];
let edges = [];
let selectedNode = null;
let moves = 0;
let timer = 0;
let score = 0;
let planarity = 0;
let initialCrossings = 0;
let solving = false;
let particles = [];

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
  particles.forEach((p) => {
    p.y += p.speed;
    if (p.y > canvas.height) p.y = 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 150, ${p.alpha})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(255, 215, 150, 0.8)";
    ctx.fill();
  });
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
function generateGraph(numNodes = 6) {
  nodes = [];
  edges = [];

  for (let i = 0; i < numNodes; i++) {
    nodes.push({
      x: random(80, canvas.width - 80),
      y: random(80, canvas.height - 80),
      radius: 10,
      color: "#FFD700",
    });
  }

  for (let i = 0; i < numNodes - 1; i++) {
    for (let j = i + 1; j < numNodes; j++) {
      if (Math.random() < 0.35) edges.push([i, j]);
    }
  }

  moves = 0;
  timer = 0;
  score = 0;
  initialCrossings = countCrossings() || 1;
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

// === DRAW GRAPH ===
function drawGraph() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,10,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawParticles();

  const crossings = countCrossings();

  edges.forEach(([a, b]) => {
    const crossed = edges.some(([c, d]) => {
      if (a === c || a === d || b === c || b === d) return false;
      return intersect(nodes[a], nodes[b], nodes[c], nodes[d]);
    });

    ctx.beginPath();
    ctx.moveTo(nodes[a].x, nodes[a].y);
    ctx.lineTo(nodes[b].x, nodes[b].y);

    if (crossings === 0) {
      ctx.strokeStyle = "white";
      ctx.shadowColor = "white";
      ctx.shadowBlur = 20;
    } else {
      ctx.strokeStyle = crossed ? "red" : "limegreen";
      ctx.shadowColor = crossed ? "rgba(255,60,60,0.9)" : "rgba(255,255,200,0.6)";
      ctx.shadowBlur = crossed ? 8 : 15;
    }

    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  ctx.shadowBlur = 0;

  nodes.forEach((node) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = crossings === 0 ? "white" : node.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = crossings === 0 ? "white" : "rgba(255, 215, 0, 0.9)";
    ctx.fill();
  });

  if (crossings === 0) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(120, 255, 150, 0.95)";
    ctx.font = "26px Orbitron, sans-serif";
    ctx.fillText("✨ Planar Graph Achieved!", canvas.width / 2 - 240, 40);

    if (!window._planaritySaved) {
      const params = new URLSearchParams(window.location.search);
      const difficulty = params.get("difficulty") || "Default";
      savePlanarityHistory(difficulty, score, moves, timer);
      window._planaritySaved = true;
    }
  }

  updatePlanarity(crossings);
  saveCurrentProgress(); // ✅ Keep saving progress dynamically
}

// === PLANARITY + SCORE ===
function updatePlanarity(crossings) {
  const progress = Math.max(0, initialCrossings - crossings);
  planarity = Math.round((progress / initialCrossings) * 100);
  score = Math.max(0, planarity * 10 - moves * 2 - timer);
  updateStats();
}

function updateStats() {
  document.getElementById("moves").innerText = moves;
  document.getElementById("timer").innerText = `${timer}s`;
  document.getElementById("score").innerText = score;
  document.getElementById("planarity").innerText = `${planarity}%`;
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
        nodeCrossCount[a1]++;
        nodeCrossCount[a2]++;
        nodeCrossCount[b1]++;
        nodeCrossCount[b2]++;
      }
    }
  }

  const worstNode = nodeCrossCount.indexOf(Math.max(...nodeCrossCount));
  if (worstNode >= 0) {
    nodes[worstNode].color = "#FFFF66";
    setTimeout(() => {
      nodes[worstNode].color = "#FFD700";
      drawGraph();
    }, 1500);
  }
  drawGraph();
}

// === AUTO SOLVE (AI MODE) ===
function autoSolve() {
  if (solving) return;
  solving = true;
  let iterations = 0;
  const maxIterations = 1500;

  function step() {
    iterations++;
    nodes.forEach((n, i) => {
      let fx = 0, fy = 0;
      nodes.forEach((m, j) => {
        if (i === j) return;
        const dx = n.x - m.x;
        const dy = n.y - m.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < 0.01) return;
        const repulse = 1000 / dist2;
        fx += (dx / Math.sqrt(dist2)) * repulse;
        fy += (dy / Math.sqrt(dist2)) * repulse;
      });
      edges.forEach(([a, b]) => {
        if (a === i || b === i) {
          const other = nodes[a === i ? b : a];
          const dx = other.x - n.x;
          const dy = other.y - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const spring = (dist - 100) * 0.05;
          fx += dx * spring;
          fy += dy * spring;
        }
      });
      n.x += fx * 0.01;
      n.y += fy * 0.01;
    });

    drawGraph();
    if (countCrossings() > 0 && iterations < maxIterations) {
      requestAnimationFrame(step);
    } else {
      solving = false;
    }
  }
  step();
}

// === SAVE PLANARITY HISTORY WITH CONSTELLATION DATA ===
function savePlanarityHistory(difficulty, score, moves, timer) {
  const history = JSON.parse(localStorage.getItem("planarityHistory")) || [];
  const nodeData = nodes.map(n => ({
    x: (n.x / canvas.width).toFixed(3),
    y: (n.y / canvas.height).toFixed(3)
  }));
  const edgeData = edges.map(([a, b]) => [a, b]);

  const newRecord = {
    difficulty: difficulty || "Unknown",
    score,
    moves,
    time: `${timer}s`,
    date: new Date().toLocaleString(),
    nodes: nodeData,
    edges: edgeData
  };

  history.push(newRecord);
  localStorage.setItem("planarityHistory", JSON.stringify(history));
}

// === SAVE CURRENT PROGRESS TO LOCAL STORAGE ===
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

// === LOAD CURRENT PROGRESS ===
function loadCurrentProgress() {
  const saved = JSON.parse(localStorage.getItem("currentPlanarityGame"));
  if (!saved) return false;

  nodes = saved.nodes.map(n => ({
    x: n.x,
    y: n.y,
    radius: 10,
    color: "#FFD700"
  }));
  edges = saved.edges || [];
  moves = saved.moves || 0;
  timer = saved.timer || 0;
  score = saved.score || 0;
  planarity = saved.planarity || 0;

  updateStats();
  drawGraph();
  return true;
}

// === INTERACTION ===
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  selectedNode = nodes.find(
    (node) => Math.hypot(node.x - mx, node.y - my) < node.radius + 5
  );
});

canvas.addEventListener("mousemove", (e) => {
  if (selectedNode) {
    const rect = canvas.getBoundingClientRect();
    selectedNode.x = e.clientX - rect.left;
    selectedNode.y = e.clientY - rect.top;
    moves++;
    drawGraph();
  }
});

canvas.addEventListener("mouseup", () => (selectedNode = null));

// === BUTTONS ===
document.getElementById("resetBtn").addEventListener("click", () => generateGraph());
document.getElementById("hintBtn").addEventListener("click", aiHint);
document.getElementById("autoSolveBtn").addEventListener("click", autoSolve);
document.getElementById("generateNewBtn").addEventListener("click", () =>
  generateGraph(Math.floor(Math.random() * 6) + 5)
);

// === TIMER + ANIMATION ===
setInterval(() => {
  timer++;
  updateStats();
}, 1000);

createParticles();

// === Decide: Load or New ===
const params = new URLSearchParams(window.location.search);
if (!loadCurrentProgress() || params.get("new") === "true") {
  generateGraph();
}

function animate() {
  drawGraph();
  requestAnimationFrame(animate);
}
animate();
