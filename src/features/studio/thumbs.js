// Drawn placeholder thumbnails for the feed preview's "other videos": bold colour fields, a
// face, chunky word blocks and arrows, so your design is judged among realistic neighbours.
// Everything is drawn here in code (no images).

const PALETTES = [
  ["#ff5a36", "#ffd23f", "#16121b"], ["#1f6feb", "#8fe3ff", "#0b1021"], ["#2bb673", "#f3ead8", "#0f2a1d"],
  ["#ff2e7e", "#ffc83d", "#1a0d14"], ["#7c3aed", "#f472b6", "#120a1f"], ["#f59e0b", "#fef3c7", "#2a1606"],
  ["#0ea5e9", "#f8fafc", "#082032"], ["#e11d48", "#fde68a", "#1c0a0f"],
];
const SKIN = ["#f1c7a5", "#d7a07a", "#a8714f", "#7a4b32", "#f5d6bd"];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function face(g, x, y, r, skin, ink, rand) {
  g.fillStyle = skin;
  g.strokeStyle = ink;
  g.lineWidth = r * 0.09;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = ink;
  const hair = Math.floor(rand() * 3);
  if (hair === 0) { g.beginPath(); g.arc(x, y - r * 0.15, r * 1.02, Math.PI * 1.08, Math.PI * 1.92); g.fill(); }
  else if (hair === 1) { g.beginPath(); g.ellipse(x, y - r * 0.82, r * 0.7, r * 0.3, 0, Math.PI, 0); g.fill(); }
  g.lineWidth = r * 0.08;
  for (const dx of [-0.33, 0.33]) { // eyebrows
    g.beginPath(); g.moveTo(x + (dx - 0.13) * r, y - r * 0.32); g.lineTo(x + (dx + 0.13) * r, y - r * (0.32 + dx * 0.15)); g.stroke();
  }
  const eye = r * 0.11, shock = rand() > 0.5;
  for (const dx of [-0.33, 0.33]) {
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(x + dx * r, y - r * 0.05, eye * 1.7, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink;
    g.beginPath(); g.arc(x + dx * r, y - r * 0.05, eye, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = ink;
  g.beginPath();
  if (shock) g.ellipse(x, y + r * 0.42, r * 0.17, r * 0.24, 0, 0, Math.PI * 2);
  else g.arc(x, y + r * 0.28, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
  shock ? g.fill() : g.stroke();
}

const WORDS = ["100 DAYS", "IT WORKED?!", "$1 MEAL", "DON'T BUY", "48 HOURS", "TOO CHEAP", "SECRET", "I QUIT", "NO WAY", "WORTH IT?"];
const BIG = ["$4.99", "48H", "100x", "#1", "0%", "1 DAY", "$9", "3AM"];

/** Heavy outlined words, the way real thumbnails set them. */
function words(g, text, x, y, size, fill, ink, angle = 0, align = "left") {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.font = `900 ${size}px "Archivo Black", "Anton", "Arial Black", Impact, sans-serif`;
  g.textAlign = align;
  g.textBaseline = "top";
  g.lineJoin = "round";
  g.lineWidth = size * 0.22;
  g.strokeStyle = ink;
  g.strokeText(text, 0, 0);
  g.fillStyle = fill;
  g.fillText(text, 0, 0);
  g.restore();
}

function arrow(g, x, y, s, color, ink, ang) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = color;
  g.strokeStyle = ink;
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.moveTo(0, -s * 0.12); g.lineTo(s * 0.6, -s * 0.12); g.lineTo(s * 0.6, -s * 0.3);
  g.lineTo(s, 0); g.lineTo(s * 0.6, s * 0.3); g.lineTo(s * 0.6, s * 0.12); g.lineTo(0, s * 0.12);
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}

function backdrop(g, W, H, a, b, ink, rand) {
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, a);
  grad.addColorStop(1, ink);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.fillStyle = b;
  g.globalAlpha = 0.2;
  g.beginPath();
  g.moveTo(W * (0.4 + rand() * 0.2), 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W * (0.2 + rand() * 0.2), H);
  g.fill();
  g.globalAlpha = 1;
}

function scene(g, W, H, a, b, ink, rand) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, b);
  sky.addColorStop(0.65, a);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.beginPath(); g.arc(W * (0.2 + rand() * 0.6), H * 0.3, H * 0.12, 0, Math.PI * 2); g.fill();
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(0, H);
  let x = 0;
  while (x < W) { g.lineTo(x, H * (0.55 + rand() * 0.2)); x += W / 7; }
  g.lineTo(W, H * 0.6); g.lineTo(W, H);
  g.fill();
}

function product(g, W, H, b, ink, rand) {
  const cx = W * (0.3 + rand() * 0.4), cy = H * 0.55, r = H * 0.3;
  g.fillStyle = b;
  g.strokeStyle = ink;
  g.lineWidth = r * 0.08;
  g.beginPath(); g.roundRect(cx - r, cy - r * 0.8, r * 2, r * 1.6, r * 0.25); g.fill(); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.fillRect(cx - r * 0.7, cy - r * 0.55, r * 0.25, r * 1.1);
  g.strokeStyle = "#ff2e3e";
  g.lineWidth = r * 0.1;
  g.beginPath(); g.ellipse(cx, cy, r * 1.35, r * 1.1, 0.1, 0, Math.PI * 2); g.stroke();
}

/**
 * A placeholder thumbnail as a data URL.
 * @param {number} seed
 * @param {boolean} vertical 9:16 (Shorts) instead of 16:9
 */
export function placeholderThumb(seed, vertical = false) {
  const rand = rng(seed * 7919 + 13);
  const W = vertical ? 270 : 480, H = vertical ? 480 : 270;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const [a, b, ink] = PALETTES[Math.floor(rand() * PALETTES.length)];
  const skin = SKIN[Math.floor(rand() * SKIN.length)];
  const word = WORDS[Math.floor(rand() * WORDS.length)], big = BIG[Math.floor(rand() * BIG.length)];
  const kind = seed % 5;
  if (vertical) {
    (kind === 3 ? scene : backdrop)(g, W, H, a, b, ink, rand);
    face(g, W * 0.5, H * 0.45, W * 0.26, skin, ink, rand);
    words(g, word, W / 2, H * 0.12, 30, "#fff", ink, -0.05, "center");
    return c.toDataURL("image/jpeg", 0.85);
  }
  if (kind === 0) {
    backdrop(g, W, H, a, b, ink, rand);
    face(g, W * 0.73, H * 0.56, H * 0.32, skin, ink, rand);
    words(g, word, W * 0.05, H * 0.14, 52, b, ink, -0.04);
    arrow(g, W * 0.4, H * 0.7, H * 0.3, b, ink, Math.PI * 0.05);
  } else if (kind === 1) {
    g.fillStyle = a; g.fillRect(0, 0, W / 2, H);
    g.fillStyle = PALETTES[(seed + 3) % PALETTES.length][0]; g.fillRect(W / 2, 0, W / 2, H);
    face(g, W * 0.25, H * 0.58, H * 0.3, skin, ink, rand);
    face(g, W * 0.75, H * 0.58, H * 0.3, SKIN[(seed + 2) % SKIN.length], ink, rand);
    words(g, "VS", W / 2, H * 0.32, 72, "#fff", ink, 0, "center");
  } else if (kind === 2) {
    backdrop(g, W, H, ink, a, "#050308", rand);
    words(g, big, W / 2, H * 0.22, 118, b, ink, -0.03, "center");
    words(g, word, W / 2, H * 0.7, 34, "#fff", ink, 0, "center");
  } else if (kind === 3) {
    scene(g, W, H, a, b, ink, rand);
    words(g, word, W * 0.06, H * 0.1, 46, "#fff", ink, 0);
  } else {
    backdrop(g, W, H, a, b, ink, rand);
    product(g, W, H, b, ink, rand);
    words(g, word, W * 0.5, H * 0.06, 44, "#fff", ink, 0.03, "center");
  }
  return c.toDataURL("image/jpeg", 0.85);
}

export const FAKE_VIDEOS = [
  { title: "I Built a Tiny Cabin With $500 and No Experience", channel: "Pocket Lab", views: "1.2M views", age: "3 days ago", time: "18:42" },
  { title: "Why Nobody Talks About This Old Supermarket Trick", channel: "Northbound", views: "486K views", age: "1 week ago", time: "12:07" },
  { title: "Testing 10 Viral Kitchen Gadgets So You Don't Have To", channel: "Kettle & Co", views: "2.3M views", age: "2 weeks ago", time: "21:15" },
  { title: "We Lived Offline for 48 Hours. It Got Weird.", channel: "Mila Makes", views: "907K views", age: "5 days ago", time: "16:30" },
  { title: "The Map That Fooled Sailors for 300 Years", channel: "Fieldnotes", views: "3.1M views", age: "1 month ago", time: "24:51" },
  { title: "This Car Costs Less Than a Phone. Is It Any Good?", channel: "Byte Size", views: "655K views", age: "4 days ago", time: "14:03" },
  { title: "How One Shop Sold Ice Before Fridges Existed", channel: "Old Money", views: "1.8M views", age: "3 weeks ago", time: "19:28" },
  { title: "I Asked 100 Strangers the Same Weird Question", channel: "Street Tape", views: "742K views", age: "6 days ago", time: "11:46" },
];
