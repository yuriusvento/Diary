const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const entriesDir = path.join(rootDir, "entries");
const dataDir = path.join(rootDir, "data");
const entriesPath = path.join(dataDir, "entries.json");
const statePath = path.join(dataDir, "state.json");

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

const readJson = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const escapeHtml = (value) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const slugify = (value) => {
  const translit = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
    щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
  };

  const normalized = value
    .toLowerCase()
    .split("")
    .map((char) => translit[char] ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return normalized || "observation";
};

const splitMessage = (text) => {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  const title = lines.shift()?.trim() || "Наблюдение";
  const body = lines.join("\n").trim() || title;
  return { title, body };
};

const formatDateInTimeZone = (createdAt, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).formatToParts(new Date(createdAt));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const renderBody = (text) => {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("\n        ");
};

const renderEntryPage = ({ title, body, date, createdAt }) => {
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: process.env.DIARY_TIME_ZONE || "America/Sao_Paulo"
  }).format(new Date(createdAt));

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - Дневник наблюдений</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --text: #151515;
      --muted: #6f6f6f;
      --soft: #a8a8a8;
      --line: #e8e8e8;
      --paper: #ffffff;
      --wash: #f7f7f4;
      --accent: #315f54;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--wash);
      color: var(--text);
      font-family: "Inter", Arial, sans-serif;
      font-weight: 300;
    }
    .page {
      width: min(760px, calc(100% - 40px));
      margin: 0 auto;
      padding: 48px 0 76px;
    }
    .back {
      color: var(--accent);
      font-size: 0.86rem;
      font-weight: 500;
      text-decoration: none;
    }
    .back:hover { text-decoration: underline; }
    article {
      margin-top: 38px;
      padding-top: 28px;
      border-top: 1px solid var(--line);
    }
    time {
      display: block;
      color: var(--soft);
      font-size: 0.88rem;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0 0 30px;
      font-size: clamp(2rem, 7vw, 4rem);
      font-weight: 300;
      line-height: 1.05;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    .content {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: clamp(22px, 5vw, 42px);
    }
    p {
      margin: 0 0 1.25rem;
      color: #343434;
      font-size: 1.06rem;
      line-height: 1.82;
      overflow-wrap: anywhere;
    }
    p:last-child { margin-bottom: 0; }
    @media (max-width: 640px) {
      .page {
        width: min(100% - 28px, 760px);
        padding-top: 32px;
      }
      article { margin-top: 30px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <a class="back" href="../index.html">Назад к дневнику</a>
    <article>
      <time datetime="${date}">${dateLabel}</time>
      <h1>${escapeHtml(title)}</h1>
      <div class="content">
        ${renderBody(body)}
      </div>
    </article>
  </main>
</body>
</html>
`;
};

const getUpdates = async (offset) => {
  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("timeout", "0");
  url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

  const response = await fetch(url);
  const payload = await response.json();

  if (!payload.ok) {
    throw new Error(payload.description || "Telegram API request failed");
  }

  return payload.result;
};

const sendMessage = async (chatId, text) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });

  if (!response.ok) {
    console.warn(`Could not send Telegram confirmation to ${chatId}`);
  }
};

const ensureUniqueFileName = (date, slug) => {
  let fileName = `${date}-${slug}.html`;
  let index = 2;

  while (fs.existsSync(path.join(entriesDir, fileName))) {
    fileName = `${date}-${slug}-${index}.html`;
    index += 1;
  }

  return fileName;
};

const main = async () => {
  fs.mkdirSync(entriesDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const state = readJson(statePath, { lastUpdateId: 0 });
  const entries = readJson(entriesPath, []);
  const updates = await getUpdates(Number(state.lastUpdateId || 0) + 1);

  let lastUpdateId = Number(state.lastUpdateId || 0);
  let createdCount = 0;

  for (const update of updates) {
    lastUpdateId = Math.max(lastUpdateId, update.update_id);

    const message = update.message;
    const text = message?.text?.trim();
    const chatId = message?.chat?.id;

    if (!text) continue;

    if (text === "/id") {
      await sendMessage(chatId, `Твой chat ID: ${chatId}`);
      continue;
    }

    if (text === "/start") {
      await sendMessage(chatId, "Пришли наблюдение: первая строка станет названием, остальной текст станет записью.");
      continue;
    }

    if (text.startsWith("/")) continue;

    if (allowedChatId && String(chatId) !== String(allowedChatId)) {
      console.log(`Skipping message from chat ${chatId}`);
      continue;
    }

    const createdAt = new Date((message.date || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const date = formatDateInTimeZone(createdAt, process.env.DIARY_TIME_ZONE || "America/Sao_Paulo");
    const { title, body } = splitMessage(text);
    const fileName = ensureUniqueFileName(date, slugify(title));
    const url = `entries/${fileName}`;

    fs.writeFileSync(
      path.join(entriesDir, fileName),
      renderEntryPage({ title, body, date, createdAt })
    );

    entries.push({
      date,
      title,
      url,
      createdAt,
      telegramUpdateId: update.update_id
    });

    createdCount += 1;
    await sendMessage(chatId, `Запись опубликована: ${title}`);
  }

  writeJson(entriesPath, entries);
  writeJson(statePath, { lastUpdateId });

  console.log(`Created ${createdCount} entr${createdCount === 1 ? "y" : "ies"}.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
