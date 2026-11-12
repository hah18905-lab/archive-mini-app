# АРХИВ 9.1 — бесплатная облачная база Cloudflare D1

**Готовность:** исходники есть, но реальная база ещё не создана. Сайт GitHub Pages продолжает работать локально без этого подключения.

Cloudflare D1 + Workers — НЕ Cloudflare Tunnel. ПК пользователя не нужен.

## Что будет храниться

Telegram ID (подтверждённый подписью Telegram), лайки/дизлайки, закладки, проценты прочтения и даты. Ни текстов переписки, ни телефонных номеров, ни открытых токенов.

## Настройка через браузер без терминала

1. Создай аккаунт на https://dash.cloudflare.com/ (план Workers Free).
2. Открой D1 SQL Database → Create Database, имя: **archive-users**.
3. База archive-users → Console: скопируй весь SQL из файла schema.sql и нажми Execute. Должны появиться таблицы archive_users и archive_story_state.
4. Workers & Pages → Create → Worker, имя: **archive-user** → Deploy.
5. Worker → Edit Code: замени содержимое кодом из worker.js → Deploy.
6. Worker → Settings → Bindings → Add binding → D1 database. Variable name: **DB**, Database: **archive-users**. Сохрани.
7. Worker → Settings → Variables and Secrets → Add → type **Secret**:
   - Variable name: **BOT_TOKEN**
   - Value: токен Telegram-бота из @BotFather
   - Нажми Deploy. **Не присылай токен в чат и не добавляй в GitHub!** Если старый токен где-либо был публично раскрыт, перевыпусти его через @BotFather.
8. Скопируй публичный HTTPS-адрес созданного Worker — например, https://archive-user.example.workers.dev. Только эту ссылку можно безопасно прислать ассистенту.
9. Укажи адрес в файле archive-cloud-config.js в корне GitHub-репозитория (значение functionUrl). GitHub Pages автоматически опубликует обновление.
10. Открой «АРХИВ» из Telegram. Подписанные Telegram-данные будут проверяться сервером, а оценки синхронизироваться между устройствами.

## Через Wrangler (необязательно, если настроил в браузере)

Перейди в директорию cloudflare и выполни:

- npx wrangler login
- npx wrangler d1 create archive-users
- Вставь полученный database_id в wrangler.toml
- npx wrangler d1 execute archive-users --remote --file=schema.sql
- npx wrangler deploy
- npx wrangler secret put BOT_TOKEN

## Безопасность и доступ

Сервер принимает только подписанное Telegram initData с актуальным auth_date. Telegram ID нельзя подменить запросом из браузера. Таблицы Cloudflare D1 открыты только связанному Worker (binding DB). BOT_TOKEN хранится исключительно как Secret внутри Cloudflare.

Открытие сайта вне Telegram оставляет локальное сохранение без облачной авторизации.

## Файлы

- schema.sql — таблицы D1
- worker.js — проверка Telegram и операции с D1
- wrangler.toml — пример подключения базы
- ../archive-cloud-config.js — только публичный адрес Worker
- ../archive-cloud.js — синхронизация Mini App

Актуальные инструкции: https://developers.cloudflare.com/d1/get-started/
