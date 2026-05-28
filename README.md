# Diary

Статический дневник для GitHub Pages с публикацией записей через Telegram-бота.

## Как это работает

1. Сообщение отправляется Telegram-боту.
2. GitHub Actions каждые 10 минут запускает `scripts/fetch-telegram.js`.
3. Скрипт забирает новые сообщения через Telegram Bot API.
4. Каждое сообщение превращается в отдельную HTML-страницу в `entries/`.
5. `data/entries.json` обновляется, и главная страница показывает новую запись.

База данных и внешний хостинг не нужны. Данные хранятся в репозитории.

## Формат сообщения

```text
Название наблюдения

Текст наблюдения.
Можно писать несколько абзацев.
```

Первая строка становится названием записи, остальной текст становится содержимым.

## Настройка

1. Создать Telegram-бота через `@BotFather`.
2. В GitHub открыть `Settings -> Secrets and variables -> Actions`.
3. Добавить repository secret:

```text
TELEGRAM_BOT_TOKEN
```

4. Написать боту команду `/id`.
5. Взять полученный chat ID и добавить repository secret:

```text
TELEGRAM_ALLOWED_CHAT_ID
```

Этот второй секрет нужен, чтобы публиковать записи мог только владелец указанного Telegram-чата.

6. Включить GitHub Pages:

```text
Settings -> Pages -> Deploy from a branch -> main -> /root
```

## Проверка

Workflow можно запустить вручную во вкладке `Actions -> Telegram Diary -> Run workflow`.

По расписанию он запускается примерно каждые 10 минут. GitHub иногда задерживает scheduled workflows, это нормально.
