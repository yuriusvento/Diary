const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const entriesDir = path.join(rootDir, "entries");
const mediaDir = path.join(rootDir, "media");
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

const splitEntryText = (text, fallbackTitle) => {
  if (!text?.trim()) {
    return { title: fallbackTitle, body: "" };
  }

  return splitMessage(text);
};

const getEntryId = (entry) => {
  if (entry.id) return String(entry.id);
  if (entry.telegramUpdateId) return String(entry.telegramUpdateId);
  return path.basename(entry.url || "", ".html");
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
  if (!text) return "";

  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("\n        ");
};

const renderMedia = (media) => {
  if (!media) return "";

  if (media.type === "photo") {
    return `<figure class="media">
          <img src="../${escapeHtml(media.url)}" alt="${escapeHtml(media.alt || "Фото наблюдения")}" loading="lazy" />
        </figure>`;
  }

  if (media.type === "video") {
    return `<figure class="media">
          <video src="../${escapeHtml(media.url)}" controls preload="metadata"></video>
        </figure>`;
  }

  return "";
};

const renderEntryPage = ({ title, body, date, createdAt, media }) => {
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
    .media {
      margin: 0 0 28px;
    }
    .media img,
    .media video {
      display: block;
      width: 100%;
      max-height: 78vh;
      object-fit: contain;
      background: #111;
      border-radius: 8px;
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
        ${renderMedia(media)}
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

const setBotCommands = async () => {
  const commands = [
    { command: "help", description: "Как публиковать, редактировать и удалять записи" },
    { command: "list", description: "Показать последние 10 записей" },
    { command: "edit", description: "Редактировать запись: /edit latest" },
    { command: "delete", description: "Удалить запись: /delete latest" },
    { command: "id", description: "Показать Telegram chat ID" }
  ];

  const response = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ commands })
  });

  if (!response.ok) {
    console.warn("Could not update Telegram bot commands");
  }
};

const getFileInfo = async (fileId) => {
  const url = new URL(`https://api.telegram.org/bot${token}/getFile`);
  url.searchParams.set("file_id", fileId);

  const response = await fetch(url);
  const payload = await response.json();

  if (!payload.ok) {
    throw new Error(payload.description || "Telegram getFile request failed");
  }

  return payload.result;
};

const extensionFromPath = (filePath, fallback) => {
  const extension = path.extname(filePath || "").toLowerCase();
  return extension || fallback;
};

const detectMedia = (message) => {
  if (message.photo?.length) {
    const photo = message.photo.at(-1);
    return {
      type: "photo",
      fileId: photo.file_id,
      fallbackExtension: ".jpg",
      fallbackTitle: "Фото"
    };
  }

  if (message.video) {
    return {
      type: "video",
      fileId: message.video.file_id,
      fallbackExtension: ".mp4",
      fallbackTitle: "Видео"
    };
  }

  return null;
};

const downloadTelegramFile = async (fileInfo, destinationPath) => {
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`);

  if (!response.ok) {
    throw new Error(`Could not download Telegram file: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destinationPath, bytes);

  return {
    filePath: fileInfo.file_path,
    size: bytes.length
  };
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

const ensureUniqueMediaFileName = (baseName, extension) => {
  let fileName = `${baseName}${extension}`;
  let index = 2;

  while (fs.existsSync(path.join(mediaDir, fileName))) {
    fileName = `${baseName}-${index}${extension}`;
    index += 1;
  }

  return fileName;
};

const sortedEntries = (entries) => {
  return [...entries].sort((a, b) => {
    return `${b.createdAt || b.date || ""}`.localeCompare(`${a.createdAt || a.date || ""}`);
  });
};

const findEntryByReference = (entries, reference) => {
  const value = String(reference || "").trim().toLowerCase();
  const recent = sortedEntries(entries);

  if (!value || value === "latest" || value === "last" || value === "последний") {
    return recent[0] ? { entry: recent[0], index: entries.indexOf(recent[0]) } : null;
  }

  const directIndex = entries.findIndex((entry) => getEntryId(entry).toLowerCase() === value);
  if (directIndex !== -1) {
    return { entry: entries[directIndex], index: directIndex };
  }

  const listNumber = Number(value);
  if (Number.isInteger(listNumber) && listNumber >= 1 && listNumber <= recent.length) {
    const entry = recent[listNumber - 1];
    return { entry, index: entries.indexOf(entry) };
  }

  return null;
};

const deleteEntryFiles = (entry, remainingEntries) => {
  const entryFile = path.join(rootDir, entry.url || "");
  if (entry.url && fs.existsSync(entryFile)) {
    fs.unlinkSync(entryFile);
  }

  const mediaUrl = entry.media?.url;
  const mediaStillUsed = mediaUrl && remainingEntries.some((item) => item.media?.url === mediaUrl);

  if (mediaUrl && !mediaStillUsed) {
    const mediaFile = path.join(rootDir, mediaUrl);
    if (fs.existsSync(mediaFile)) {
      fs.unlinkSync(mediaFile);
    }
  }
};

const listEntriesMessage = (entries) => {
  const recent = sortedEntries(entries).slice(0, 10);

  if (!recent.length) {
    return "Записей пока нет.";
  }

  return recent.map((entry, index) => {
    const kind = entry.media?.type === "photo" ? "фото" : entry.media?.type === "video" ? "видео" : "текст";
    return `${index + 1}. ${getEntryId(entry)} - ${entry.title} (${kind})`;
  }).join("\n");
};

const helpMessage = () => {
  return [
    "Как вести дневник:",
    "",
    "Обычная запись:",
    "Название наблюдения",
    "",
    "Текст наблюдения",
    "",
    "Фото или видео:",
    "отправь файл с подписью в таком же формате.",
    "",
    "Команды:",
    "/list - последние 10 записей с номерами и id",
    "/delete latest - удалить последнюю запись",
    "/delete 1 - удалить запись номер 1 из /list",
    "/delete <id> - удалить запись по id",
    "/edit latest",
    "Новое название",
    "",
    "Новый текст - отредактировать последнюю запись",
    "/edit <id> - отредактировать запись по id",
    "/id - показать твой chat ID"
  ].join("\n");
};

const main = async () => {
  fs.mkdirSync(entriesDir, { recursive: true });
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  await setBotCommands();

  const state = readJson(statePath, { lastUpdateId: 0 });
  const entries = readJson(entriesPath, []);
  const updates = await getUpdates(Number(state.lastUpdateId || 0) + 1);

  let lastUpdateId = Number(state.lastUpdateId || 0);
  let changeCount = 0;

  for (const update of updates) {
    lastUpdateId = Math.max(lastUpdateId, update.update_id);

    const message = update.message;
    const text = (message?.text || message?.caption || "").trim();
    const mediaInfo = detectMedia(message || {});
    const chatId = message?.chat?.id;

    if (!text && !mediaInfo) continue;

    if (text === "/id") {
      await sendMessage(chatId, `Твой chat ID: ${chatId}`);
      continue;
    }

    if (text === "/start" || text === "/help") {
      await sendMessage(chatId, helpMessage());
      continue;
    }

    if (allowedChatId && String(chatId) !== String(allowedChatId)) {
      console.log(`Skipping message from chat ${chatId}`);
      continue;
    }

    if (text === "/list") {
      await sendMessage(chatId, listEntriesMessage(entries));
      continue;
    }

    if (text.startsWith("/delete")) {
      const reference = text.replace(/^\/delete(@\w+)?/i, "").trim() || "latest";
      const match = findEntryByReference(entries, reference);

      if (!match) {
        await sendMessage(chatId, "Не нашел запись для удаления. Напиши /list и используй номер или id.");
        continue;
      }

      const [deleted] = entries.splice(match.index, 1);
      deleteEntryFiles(deleted, entries);
      changeCount += 1;
      await sendMessage(chatId, `Запись удалена: ${deleted.title}`);
      continue;
    }

    if (text.startsWith("/edit")) {
      const editText = text.replace(/^\/edit(@\w+)?/i, "").trim();
      const lines = editText.split("\n");
      const reference = lines.shift()?.trim() || "latest";
      const nextText = lines.join("\n").trim();
      const match = findEntryByReference(entries, reference);

      if (!match) {
        await sendMessage(chatId, "Не нашел запись для редактирования. Напиши /list и используй номер или id.");
        continue;
      }

      if (!nextText) {
        await sendMessage(chatId, "Для редактирования напиши так:\n/edit latest\nНовое название\n\nНовый текст");
        continue;
      }

      const { title, body } = splitMessage(nextText);
      const updated = {
        ...match.entry,
        title,
        body,
        editedAt: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(rootDir, updated.url),
        renderEntryPage({
          title: updated.title,
          body: updated.body,
          date: updated.date,
          createdAt: updated.createdAt,
          media: updated.media ? { ...updated.media, alt: updated.title } : null
        })
      );

      entries[match.index] = updated;
      changeCount += 1;
      await sendMessage(chatId, `Запись обновлена: ${updated.title}`);
      continue;
    }

    if (text.startsWith("/")) continue;

    const createdAt = new Date((message.date || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const date = formatDateInTimeZone(createdAt, process.env.DIARY_TIME_ZONE || "America/Sao_Paulo");
    const { title, body } = splitEntryText(text, mediaInfo?.fallbackTitle || "Наблюдение");
    const slug = slugify(title);
    const fileName = ensureUniqueFileName(date, slug);
    const url = `entries/${fileName}`;
    let media = null;

    if (mediaInfo) {
      const fileInfo = await getFileInfo(mediaInfo.fileId);
      const extension = extensionFromPath(fileInfo.file_path, mediaInfo.fallbackExtension);
      const mediaFileName = ensureUniqueMediaFileName(`${date}-${slug}`, extension);
      const mediaPath = path.join(mediaDir, mediaFileName);

      const downloaded = await downloadTelegramFile(fileInfo, mediaPath);

      media = {
        type: mediaInfo.type,
        url: `media/${mediaFileName}`,
        fileName: mediaFileName,
        size: downloaded.size,
        alt: title
      };
    }

    fs.writeFileSync(
      path.join(entriesDir, fileName),
      renderEntryPage({ title, body, date, createdAt, media })
    );

    entries.push({
      id: String(update.update_id),
      date,
      title,
      body,
      url,
      createdAt,
      telegramUpdateId: update.update_id,
      media: media ? {
        type: media.type,
        url: media.url,
        size: media.size
      } : null
    });

    changeCount += 1;
    await sendMessage(chatId, `Запись опубликована: ${title}`);
  }

  writeJson(entriesPath, entries);
  writeJson(statePath, { lastUpdateId });

  console.log(`Processed ${changeCount} diary change${changeCount === 1 ? "" : "s"}.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
