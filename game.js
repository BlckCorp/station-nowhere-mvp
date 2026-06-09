const W = 17;
const H = 17;
const SAVE_KEY = "station-nowhere-memory-v1";

const tileData = {
  rail: ["═", "Рельсы"],
  station: ["С", "Станция"],
  cache: ["□", "Тайник"],
  radio: ["◌", "Радиоузел"],
  house: ["⌂", "Панельный дом"],
  checkpoint: ["⌖", "Блокпост"],
  anomaly: ["◇", "Аномалия"],
  goal: ["Н", "Станция Нигде"]
};

const enemyData = {
  watcher: {
    name: "Путевой Смотритель",
    icon: "Ж",
    hp: 3,
    dmg: 12,
    memory: "Смотритель теряет след, если снизить шум."
  },
  domovoy: {
    name: "Домовой Подъезда",
    icon: "Д",
    hp: 2,
    dmg: 10,
    memory: "Домового можно ослабить, если найти якорь дома."
  },
  soldiers: {
    name: "Молчащие Срочники",
    icon: "М",
    hp: 4,
    dmg: 16,
    memory: "Срочники реагируют на уставные фразы и пропуска."
  }
};

let state = {
  map: [],
  player: null,
  enemies: [],
  memory: loadMemory(),
  over: false,
  run: 0
};

const board = document.querySelector("#board");
const logBox = document.querySelector("#log");
const drawer = document.querySelector("#memoryDrawer");

const $ = (id) => document.querySelector(id);
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b, c, d) => Math.abs(a - c) + Math.abs(b - d);
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

$("#newRunBtn").addEventListener("click", () => newRun("Новый забег начат вручную."));
$("#restBtn").addEventListener("click", rest);
$("#memoryBtn").addEventListener("click", toggleMemory);
$("#closeMemoryBtn").addEventListener("click", toggleMemory);
$("#wipeMemoryBtn").addEventListener("click", wipeMemory);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const moves = {
    arrowup: [0, -1], w: [0, -1],
    arrowdown: [0, 1], s: [0, 1],
    arrowleft: [-1, 0], a: [-1, 0],
    arrowright: [1, 0], d: [1, 0]
  };

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  if (moves[key]) movePlayer(...moves[key]);
  if (key === "r") rest();
  if (key === "m") toggleMemory();
  if (key === "n") newRun("Новый забег начат вручную.");
  if (event.key === " " || event.key === "Enter") interact();
});

function loadMemory() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return saved || { fragments: [], deaths: 0, wins: 0 };
  } catch {
    return { fragments: [], deaths: 0, wins: 0 };
  }
}

function saveMemory() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state.memory));
}

function knows(text) {
  return state.memory.fragments.includes(text);
}

function remember(text) {
  if (!knows(text)) {
    state.memory.fragments.unshift(text);
    state.memory.fragments = state.memory.fragments.slice(0, 12);
    saveMemory();
    log("Память закрепилась: " + text, true);
  }
}

function wipeMemory() {
  localStorage.removeItem(SAVE_KEY);
  state.memory = { fragments: [], deaths: 0, wins: 0 };
  renderMemory();
  log("Память браузера стёрта. Рельсы стали тише.", true);
}

function newRun(message) {
  state.run++;
  state.over = false;
  state.map = makeMap();
  state.player = {
    x: Math.floor(W / 2),
    y: H - 2,
    hp: 100,
    fuel: 42 + Math.min(state.memory.fragments.length, 8),
    ammo: 6,
    fatigue: 0,
    noise: 1,
    day: 1
  };
  state.enemies = makeEnemies();
  logBox.innerHTML = "";
  log(message || "Дрезина снова тронулась.", true);
  log(memoryIntro());
  render();
}

function makeMap() {
  const map = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ type: "rail" })));
  map[1][Math.floor(W / 2)].type = "goal";
  map[H - 2][Math.floor(W / 2)].type = "station";
  place(map, "station", 5);
  place(map, "cache", 8);
  place(map, "radio", 4);
  place(map, "house", 7);
  place(map, "checkpoint", 5);
  place(map, "anomaly", 6);
  return map;
}

function place(map, type, count) {
  let placed = 0;
  while (placed < count) {
    const x = rnd(1, W - 2);
    const y = rnd(1, H - 3);
    const startZone = Math.abs(x - Math.floor(W / 2)) < 3 && y > H - 5;
    const goalZone = Math.abs(x - Math.floor(W / 2)) < 2 && y < 3;
    if (!startZone && !goalZone && map[y][x].type === "rail") {
      map[y][x].type = type;
      placed++;
    }
  }
}

function makeEnemies() {
  const types = ["watcher", "watcher", "domovoy", "domovoy", "soldiers", "soldiers", "soldiers"];
  const result = [];
  for (const type of types) {
    for (let i = 0; i < 120; i++) {
      const x = rnd(1, W - 2);
      const y = rnd(1, H - 4);
      const far = dist(x, y, Math.floor(W / 2), H - 2) > 5;
      const busy = result.some((e) => e.x === x && e.y === y);
      if (far && !busy) {
        result.push({ id: type + Date.now() + Math.random(), type, x, y, hp: enemyData[type].hp, wait: 0 });
        break;
      }
    }
  }
  return result;
}

function movePlayer(dx, dy) {
  if (state.over) return;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!inside(nx, ny)) return;
  const enemy = enemyAt(nx, ny);
  if (enemy) {
    fight(enemy);
    render();
    return;
  }
  state.player.x = nx;
  state.player.y = ny;
  state.player.fuel--;
  state.player.fatigue += 2;
  state.player.noise = Math.min(9, state.player.noise + (Math.random() < 0.55 ? 1 : 0));
  if (state.player.fuel <= 0) hurt(10, "Топливо кончилось. Дрезину приходится толкать по рельсам.");
  if (state.player.fatigue >= 85) hurt(6, "Усталость ломает внимание. Ты путаешь шпалы и шаги.");
  passiveTile();
  enemiesAct();
  state.player.day++;
  checkGoal();
  render();
}

function interact() {
  if (state.over) return;
  const enemy = nearestEnemy(1);
  if (enemy) fight(enemy);
  else handleTile(true);
  enemiesAct();
  checkGoal();
  render();
}

function passiveTile() {
  const type = tile().type;
  if (["house", "checkpoint", "anomaly"].includes(type) && Math.random() < 0.38) handleTile(false);
}

function handleTile(direct) {
  const cell = tile();
  if (cell.type === "goal") return win();
  if (cell.type === "station") {
    if (direct) rest();
    else log("Станция скрипит вывеской. Здесь можно нажать R и отдохнуть.");
    return;
  }
  if (cell.type === "cache") {
    const roll = Math.random();
    if (roll < 0.4) {
      const fuel = rnd(5, 12);
      state.player.fuel += fuel;
      log("В тайнике найдено топливо: +" + fuel + ".");
      remember("На старых перегонах тайники часто прячут под щебнем.");
    } else if (roll < 0.72) {
      const ammo = rnd(2, 5);
      state.player.ammo += ammo;
      log("В промасленной тряпке лежали патроны: +" + ammo + ".");
    } else heal(10, "В тайнике нашёлся сухой бинт и спиртовая салфетка.");
    cell.type = "rail";
    return;
  }
  if (cell.type === "radio") {
    remember(pick([
      "Радио иногда повторяет имена тех, кто никому не назывался.",
      "Станция Нигде может быть не местом, а ошибкой маршрута.",
      "Чем выше шум, тем быстрее Смотритель выходит на путь.",
      "Старый устав работает на тех, кто забыл, что война закончилась."
    ]));
    state.player.noise = Math.max(0, state.player.noise - 2);
    log("Радио шипит, затем на секунду становится слышно чужое дыхание.", true);
    cell.type = "rail";
    return;
  }
  if (cell.type === "house") {
    if (knows(enemyData.domovoy.memory) && Math.random() < 0.62) {
      remember("Якорь дома пахнет пылью, детской краской и старыми ключами.");
      log("Ты находишь табличку с номером квартиры. Домовой отступает за стену.", true);
      cell.type = "rail";
      return;
    }
    hurt(rnd(6, 16), "Подъезд меняет этажи местами. За дверью кто-то говорит твоим голосом.");
    state.player.fatigue += 9;
    return;
  }
  if (cell.type === "checkpoint") {
    if (knows(enemyData.soldiers.memory) && Math.random() < 0.58) {
      log("Ты произносишь фразу из старого устава. Караул смотрит сквозь тебя.", true);
      state.player.noise = Math.max(0, state.player.noise - 1);
      cell.type = "rail";
      return;
    }
    hurt(rnd(8, 18), "Из тумана щёлкает затвор. Блокпост всё ещё выполняет приказ.");
    state.player.noise += 2;
    return;
  }
  if (cell.type === "anomaly") {
    hurt(rnd(5, 14), "Рельсы уходят в сторону, хотя ты идёшь прямо.");
    remember(pick([
      "Аномалии любят повторять уже пройденные станции.",
      "Нельзя доверять карте, если туман пахнет озоном.",
      "Иногда ложное воспоминание спасает лучше правды."
    ]));
    cell.type = "rail";
    return;
  }
  if (direct) log("Здесь только рельсы, грязь и слабый стук дрезины.");
}

function rest() {
  if (state.over) return;
  if (tile().type !== "station") return log("Отдыхать безопасно можно только на станции.");
  if (nearestEnemy(2)) return log("Слишком близко слышны чужие шаги. Отдых невозможен.");
  const hp = rnd(10, 18);
  const fuel = rnd(3, 8);
  heal(hp, "На станции удалось перевязаться и поспать у холодной печи.");
  state.player.fuel += fuel;
  state.player.fatigue = Math.max(0, state.player.fatigue - rnd(18, 32));
  state.player.noise = Math.max(0, state.player.noise - 2);
  log("В канистре на складе осталось немного дизеля: +" + fuel + " топлива.");
  enemiesAct();
  render();
}

function fight(enemy) {
  const data = enemyData[enemy.type];
  const weak = knows(data.memory);
  if (state.player.ammo > 0) {
    state.player.ammo--;
    state.player.noise = Math.min(9, state.player.noise + 3);
    enemy.hp -= weak ? 2 : 1;
    log("Выстрел по цели: " + data.name + ".");
  } else {
    enemy.hp -= weak ? 1 : 0;
    state.player.fatigue += 8;
    log("Патронов нет. Ты пытаешься отбиться ломом.");
  }
  if (enemy.hp <= 0) {
    state.enemies = state.enemies.filter((e) => e.id !== enemy.id);
    remember(data.memory);
    log(data.name + " исчезает за ржавым насыпным валом.", true);
    return;
  }
  hurt(Math.ceil(data.dmg * (weak ? 0.65 : 1)), data.name + " отвечает.");
}

function enemiesAct() {
  for (const enemy of state.enemies) {
    if (enemy.wait > 0) {
      enemy.wait--;
      continue;
    }
    const d = dist(enemy.x, enemy.y, state.player.x, state.player.y);
    if (d <= 1) {
      hurt(enemyData[enemy.type].dmg + Math.max(0, state.player.noise - 5), enemyData[enemy.type].name + " атакует почти вплотную.");
      continue;
    }
    if (enemy.type === "watcher") {
      if (state.player.noise >= 4 || d < 6) stepToward(enemy);
      if (state.player.noise <= 1 && Math.random() < 0.5) enemy.wait = 1;
    }
    if (enemy.type === "domovoy") {
      if (d < 5 && Math.random() < 0.75) stepToward(enemy);
      else if (Math.random() < 0.35) wander(enemy);
    }
    if (enemy.type === "soldiers") {
      if (d <= 5) stepToward(enemy);
      else if (Math.random() < 0.35) wander(enemy);
    }
  }
}

function stepToward(enemy) {
  const dx = Math.sign(state.player.x - enemy.x);
  const dy = Math.sign(state.player.y - enemy.y);
  const first = Math.random() < 0.5 ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
  for (const [mx, my] of first) {
    if (moveEnemy(enemy, mx, my)) return;
  }
}

function wander(enemy) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
  for (const [dx, dy] of dirs) if (moveEnemy(enemy, dx, dy)) return;
}

function moveEnemy(enemy, dx, dy) {
  const nx = enemy.x + dx;
  const ny = enemy.y + dy;
  if (!inside(nx, ny)) return false;
  if (state.player.x === nx && state.player.y === ny) return false;
  if (enemyAt(nx, ny)) return false;
  enemy.x = nx;
  enemy.y = ny;
  return true;
}

function hurt(amount, reason) {
  state.player.hp = Math.max(0, state.player.hp - amount);
  log(reason + " −" + amount + " здоровья.");
  if (state.player.hp <= 0) die();
}

function heal(amount, reason) {
  state.player.hp = Math.min(100, state.player.hp + amount);
  log(reason + " +" + amount + " здоровья.");
}

function die() {
  if (state.over) return;
  state.over = true;
  state.memory.deaths++;
  remember(pick([
    "Смерть не обрывает путь, она меняет стрелку.",
    "Если станция кажется знакомой, не верь первому указателю.",
    "Тишина на путях иногда громче выстрела.",
    "Рельсовая болезнь оставляет не шрамы, а маршруты."
  ]));
  saveMemory();
  log("Забег окончен. Ты просыпаешься у дрезины с чужой кровью на рукаве.", true);
}

function win() {
  if (state.over) return;
  state.over = true;
  state.memory.wins++;
  remember("Станция Нигде существует. Или умеет притворяться существующей.");
  saveMemory();
  log("Ты доехал до Станции Нигде. На платформе горит один фонарь. Он качается без ветра.", true);
}

function checkGoal() {
  if (tile().type === "goal") win();
}

function tile() {
  return state.map[state.player.y][state.player.x];
}

function enemyAt(x, y) {
  return state.enemies.find((enemy) => enemy.x === x && enemy.y === y);
}

function nearestEnemy(maxDistance) {
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of state.enemies) {
    const d = dist(enemy.x, enemy.y, state.player.x, state.player.y);
    if (d <= maxDistance && d < bestDistance) {
      best = enemy;
      bestDistance = d;
    }
  }
  return best;
}

function render() {
  renderStats();
  renderBoard();
  renderMemory();
}

function renderStats() {
  $("#hp").textContent = state.player.hp;
  $("#fuel").textContent = state.player.fuel;
  $("#ammo").textContent = state.player.ammo;
  $("#fatigue").textContent = state.player.fatigue;
  $("#noiseLevel").textContent = state.player.noise;
  $("#day").textContent = state.player.day;
}

function renderBoard() {
  board.innerHTML = "";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cell = state.map[y][x];
      const enemy = enemyAt(x, y);
      const div = document.createElement("div");
      div.className = "cell " + cell.type;
      div.title = tileData[cell.type][1];
      if (state.player.x === x && state.player.y === y) {
        div.className = "cell player";
        div.textContent = "☻";
        div.title = "Обходчик и дрезина";
      } else if (enemy) {
        div.className += " enemy";
        div.textContent = enemyData[enemy.type].icon;
        div.title = enemyData[enemy.type].name;
      } else {
        div.textContent = tileData[cell.type][0];
      }
      board.appendChild(div);
    }
  }
}

function renderMemory() {
  const list = $("#memoryList");
  list.innerHTML = "";
  const summary = document.createElement("div");
  summary.className = "memory-item";
  summary.innerHTML = "<b>Смертей:</b> " + state.memory.deaths + " · <b>Побед:</b> " + state.memory.wins;
  list.appendChild(summary);
  if (!state.memory.fragments.length) {
    const empty = document.createElement("div");
    empty.className = "memory-item";
    empty.textContent = "Память пуста. Первый настоящий урок обычно приходит после смерти.";
    list.appendChild(empty);
    return;
  }
  for (const fragment of state.memory.fragments) {
    const item = document.createElement("div");
    item.className = "memory-item";
    item.textContent = fragment;
    list.appendChild(item);
  }
}

function toggleMemory() {
  drawer.classList.toggle("hidden");
  renderMemory();
}

function log(text, important = false) {
  const p = document.createElement("p");
  if (important) p.classList.add("important");
  p.textContent = text;
  logBox.prepend(p);
}

function memoryIntro() {
  if (!state.memory.fragments.length) return "Ты почти ничего не помнишь. Только стук колёс и фразу: “Не приезжайте.”";
  return "Перед стартом всплывает обрывок памяти: " + pick(state.memory.fragments);
}

newRun("Дрезина вздрагивает. Где-то впереди ждёт Станция Нигде.");
