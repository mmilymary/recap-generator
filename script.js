// =============================================================
// recap-generator
// Lomake -> piirretään <canvas>-elementtiin -> ladataan PNG:nä.
// =============================================================

// ---------- 1. Asetukset ----------
const W = 1080;   // kuvan leveys (Instagram 3:4)
const H = 1440;   // kuvan korkeus
const CARD = { x: 37, y: 248, w: 1006, h: 944, radius: 45 };  // tumma laatikko
const PAD_X = 29;          // tekstin etäisyys laatikon reunasta
const PAD_Y = 60;          // pienin tyhjä tila laatikon ylä- ja alareunassa
const MAX_FONT = 25;       // aloitusfonttikoko
const MIN_FONT = 16;       // pienin, johon kutistetaan jos teksti ei mahdu
const LINE = 1.12;         // riviväli (sama kuin Canvassa)
const FALLBACK = 'ui-monospace, "Courier New", monospace';
const STORAGE_KEY = 'recap-generator:v1';

// Fontit: name = Google Fonts -nimi, scale = kokokerroin.
// VT323 on luonnostaan pieni, joten sitä suurennetaan, jotta rivit näyttävät yhtä isoilta.
const FONTS = {
  courier:   { name: 'Courier Prime',  scale: 1.0 },
  vt323:     { name: 'VT323',          scale: 1.45 },
  space:     { name: 'Space Mono',     scale: 0.95 },
  jetbrains: { name: 'JetBrains Mono', scale: 1.0 },
};
const fontStack = (key) => `"${FONTS[key].name}", ${FALLBACK}`;

// Oletussisältö (viikko 39), jotta esikatselussa näkyy heti jotain
const DEFAULTS = {
  week: 39,
  status: 'active_student',
  topics: [
    { tag: 'math', text: 'Contribution margin calcs – exam on Monday' },
    { tag: 'it_basics', text: 'Exam 19/20 – course done, coding next!' },
    { tag: 'ux_team', text: 'E-commerce project presented to other teams' },
    { tag: 'networks', text: 'Cisco Networking course' },
    { tag: 'security', text: 'Self-study Cisco course – so interesting!' },
    { tag: 'side_quests', text: 'Figma studies & building my own app' },
  ],
  highlight: '19/20 on the IT Basics exam and our e-commerce store presented – one course closed, programming up next.',
  next: 'Math exam on Monday & the first lines of real code',
  dim: 20,
  font: 'courier',
};

// ---------- 2. Elementit ----------
const $ = (id) => document.getElementById(id);
const form = $('recap-form');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const topicsList = $('topics');

let bgImage = null;  // käyttäjän valitsema taustakuva (Image-olio)

// ---------- 3. Aiherivit lomakkeessa ----------
function addTopicRow(tag = '', text = '') {
  const li = document.createElement('li');
  li.className = 'topic-row';
  li.innerHTML = `
    <input type="text" class="topic-tag" placeholder="tag" aria-label="Tag">
    <input type="text" class="topic-text" placeholder="what you did" aria-label="Topic">
    <button type="button" class="btn-remove" aria-label="Remove topic">✕</button>
  `;
  // Arvot asetetaan .value-ominaisuudella (ei innerHTML:llä), jotta teksti ei tulkitu HTML:ksi
  li.querySelector('.topic-tag').value = tag;
  li.querySelector('.topic-text').value = text;
  li.querySelector('.btn-remove').addEventListener('click', () => {
    li.remove();
    update();
  });
  topicsList.appendChild(li);
}

function readTopics() {
  return [...topicsList.querySelectorAll('.topic-row')]
    .map((li) => ({
      tag: li.querySelector('.topic-tag').value.trim(),
      text: li.querySelector('.topic-text').value.trim(),
    }))
    .filter((t) => t.tag || t.text);  // tyhjät rivit pois
}

// ---------- 4. Lomakkeen tiedot yhdeksi olioksi ----------
function readForm() {
  return {
    week: $('week').value,
    status: $('status').value.trim(),
    topics: readTopics(),
    highlight: $('highlight').value.trim(),
    next: $('next').value.trim(),
    dim: Number($('dim').value),
    font: FONTS[$('font').value] ? $('font').value : 'courier',
  };
}

function fillForm(data) {
  $('week').value = data.week;
  $('status').value = data.status;
  $('highlight').value = data.highlight;
  $('next').value = data.next;
  $('dim').value = data.dim;
  $('dim-value').textContent = data.dim;
  $('font').value = FONTS[data.font] ? data.font : 'courier';
  topicsList.innerHTML = '';
  data.topics.forEach((t) => addTopicRow(t.tag, t.text));
}

// ---------- 5. Tekstin rivitys ----------
// Monospace-fontissa jokainen merkki on yhtä leveä, joten riittää laskea merkkejä.
function wrap(text, firstPrefix, nextPrefix, maxChars) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = firstPrefix;
  let lineHasWord = false;

  for (const word of words) {
    const candidate = lineHasWord ? `${line} ${word}` : line + word;
    if (candidate.length <= maxChars || !lineHasWord) {
      line = candidate;
      lineHasWord = true;
    } else {
      lines.push(line);
      line = nextPrefix + word;
    }
  }
  lines.push(line);
  return lines;
}

// Rakennetaan kaikki kuvan rivit tekstinä
function buildLines(data, maxChars) {
  const week = String(data.week || '').padStart(2, '0');
  const lines = [
    `> git status: ${data.status || 'active_student'}`,
    `> location: week_${week}/recap.md`,
    '',
    '// TOPICS COVERED',
  ];

  // Tagisarake yhtä leveäksi kaikille riveille, jotta tekstit asettuvat allekkain
  const prefixes = data.topics.map((t) => `>> [${t.tag}]`);
  const col = Math.max(18, ...prefixes.map((p) => p.length + 3));
  data.topics.forEach((t, i) => {
    const first = prefixes[i].padEnd(col, ' ');
    lines.push(...wrap(t.text, first, ' '.repeat(col), maxChars));
  });

  if (data.highlight) {
    lines.push('', '// WEEKLY HIGHLIGHT');
    lines.push(...wrap(`"${data.highlight}"`, '>> ', '   ', maxChars));
  }
  if (data.next) {
    lines.push('', '// NEXT UP');
    lines.push(...wrap(data.next, '>> ', '   ', maxChars));
  }
  lines.push('•', '•', '•');
  return lines;
}

// ---------- 6. Piirtäminen ----------
function drawBackground(dim) {
  if (bgImage) {
    // "cover": kuva täyttää koko alueen, ylimenevä osa rajataan pois
    const scale = Math.max(W / bgImage.width, H / bgImage.height);
    const w = bgImage.width * scale;
    const h = bgImage.height * scale;
    ctx.drawImage(bgImage, (W - w) / 2, (H - h) / 2, w, h);
    ctx.fillStyle = `rgba(0, 0, 0, ${dim / 100})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    // Ilman kuvaa: burgundy-liukuväri
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#4a1320');
    g.addColorStop(1, '#140b0d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawCard() {
  ctx.fillStyle = '#292828';
  ctx.beginPath();
  ctx.roundRect(CARD.x, CARD.y, CARD.w, CARD.h, CARD.radius);
  ctx.fill();
}

function render() {
  const data = readForm();
  drawBackground(data.dim);
  drawCard();

  // Etsitään suurin fonttikoko, jolla kaikki mahtuu laatikkoon
  const maxWidth = CARD.w - PAD_X * 2;
  const maxHeight = CARD.h - PAD_Y * 2;
  const scale = FONTS[data.font].scale;
  let size = MAX_FONT;
  let lines;
  while (true) {
    ctx.font = `${Math.round(size * scale)}px ${fontStack(data.font)}`;
    const charWidth = ctx.measureText('M').width;
    const maxChars = Math.floor(maxWidth / charWidth);
    lines = buildLines(data, maxChars);
    if (lines.length * size * LINE <= maxHeight || size <= MIN_FONT) break;
    size -= 1;
  }

  // Tekstilohko pystysuunnassa laatikon keskelle.
  // Riviväli lasketaan peruskoosta, joten eri fontit vievät saman verran tilaa.
  const lineHeight = size * LINE;
  const blockHeight = lines.length * lineHeight;
  let y = CARD.y + Math.max(PAD_Y, (CARD.h - blockHeight) / 2);

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  for (const line of lines) {
    ctx.fillText(line, CARD.x + PAD_X, y);
    y += lineHeight;
  }

  // Kerrotaan käyttäjälle, jos teksti kutistettiin tai ei mahdu
  const note = $('fit-note');
  if (blockHeight > maxHeight) note.textContent = 'Too much text – shorten a topic so everything fits.';
  else if (size < MAX_FONT) note.textContent = `Text shrunk to ${size}px so it fits.`;
  else note.textContent = '';
}

// ---------- 7. Tallennus selaimeen ----------
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readForm()));
  } catch (e) { /* esim. yksityinen selaustila: ei haittaa */ }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.topics)) return { ...DEFAULTS, ...saved };
  } catch (e) { /* rikkinäinen tallennus: käytetään oletuksia */ }
  return DEFAULTS;
}

function update() {
  $('dim-value').textContent = $('dim').value;
  render();
  save();
}

// ---------- 8. Tapahtumat ----------
form.addEventListener('input', update);   // mikä tahansa kenttä muuttuu -> piirretään uudelleen

// Uusi fontti pitää ladata ennen piirtämistä, muuten canvas käyttää varafonttia
$('font').addEventListener('change', () => {
  const key = $('font').value;
  document.fonts.load(`${MAX_FONT}px "${FONTS[key].name}"`).finally(render);
});

$('add-topic').addEventListener('click', () => {
  addTopicRow();
  topicsList.lastElementChild.querySelector('.topic-tag').focus();
});

$('bg').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => { bgImage = img; render(); };
  img.src = URL.createObjectURL(file);
});

$('clear-bg').addEventListener('click', () => {
  bgImage = null;
  $('bg').value = '';
  render();
});

$('download').addEventListener('click', () => {
  render();
  const week = String($('week').value || '').padStart(2, '0');
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `week_${week}_recap.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
});

// ---------- 9. Käynnistys ----------
fillForm(load());
// Fontin pitää olla ladattu ennen piirtämistä, muuten canvas käyttää varafonttia
document.fonts.load(`${MAX_FONT}px "${FONTS[$('font').value].name}"`).finally(render);
document.fonts.ready.then(render);
render();
