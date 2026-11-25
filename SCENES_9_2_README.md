# АРХИВ 9.2 — 3 анимированных сцены для каждого рассказа

**Опубликованные GIF** создаются из имеющихся медиа как анимированная раскадровка, не как настоящие ИИ-видеоролики. Это намеренно указано здесь и в `data/scene-manifest.json`.

## Что уже работает
- 22 истории × 3 сюжетных момента = **66 анимированных GIF**;
- `intro` — НАЧАЛО, перед первым абзацем;
- `encounter` — СЕРЕДИНА, после первой половины рассказа;
- `finale` — КОНЕЦ, перед заключительным абзацем;
- GIF загружаются по мере чтения (нативное `loading=lazy`);
- сохранена уже существующая GIF-анимация финала истории №3 «Окно»;
- весь контент собирается прямо в GitHub Actions, без выключенного ПК и сервера.

## Как устроена публикация
1. Action извлекает исходный ZIP из корня репозитория в папку `public/`.
2. Запускается `scripts/build_scene_gifs.py public`.
3. Скрипт создаёт три анимации для каждой истории из имеющихся разрешённых медиа. Исходные фотографии не удаляются.
4. Заполняются `scenes` в `public/data/stories.json` с `type:gif`, `before_paragraph`, `media_url`.
5. Формируется `public/data/scene-manifest.json` со строками сюжета для каждой сцены.
6. После проверок GitHub Pages публикует готовый HTML/JSON/медиа.

## Как заменять временные GIF настоящим ИИ-видео

Подходящий вход: вертикальная исходная картинка и сюжетное описание нужного эпизода из `scene-manifest.json`.

Три базовых режиссёрских промпта:

**01 НАЧАЛО:** "Animate the exact subject and environment in the reference image. 1989 analogue horror found-footage surveillance. A subtle but REAL action unfolds: the creature looks toward the camera, slowly breathes or takes one uneasy step. Preserve face, anatomy, clothing and scene continuity. 3–5 seconds, seamless loop, stable camera, no simple zoom or shaking."

**02 СЕРЕДИНА:** "Same established creature and location. The threat moves through the scene — stalking, turning, raising a hand, or approaching the protagonist. Consistent silhouette and lighting. Intrusive fluorescent flicker, deep darkness, fine VHS noise. Organic intentional motion, not fake camera wobble, 3–5 seconds."

**03 КОНЕЦ:** "Same creature reaches the culmination of the story: clear physical motion, sudden attack/appearance or unsettling aftermath. Photorealistic analogue-horror film grain, dark composition, believable anatomy. No captions, no extra characters, 3–5 seconds, seamless loop if possible."

Рекомендуемый формат для Telegram Mini App: **MP4/WebM с H.264/VP9, muted, loop, playsinline**, 480p–720p. Настоящие GIF часто гораздо тяжелее. Если нужен именно GIF — конвертируй финальное ИИ-видео в оптимизированный GIF с 8–12 кадрами/с.

Чтобы заменить конкретную сцену: обнови `media_url` для `story_id` и `id` в `data/stories.json` или исходном каталоге генерации, а файл опубликуй в `media/`. В редакционной версии скрипта введи переопределение по ID, чтобы при следующих сборках не затирать AI-работы.

## Стиль и изображения из Pinterest
Подборки Pinterest можно использовать как **референсы настроения**, но фотографии третьих лиц нельзя автоматически копировать и публиковать без соответствующей лицензии. Для публикации используйте свои изображения, разрешённые материалы или сгенерированные новые кадры того же настроения.

## Ограничение бюджета
66 настоящих отдельных ИИ-видео сейчас **не созданы**: на подключённом видеогенераторе 1 доступный кредит, а проверенная стоимость короткого ролика — 4 кредита. Пользовательские секреты генерации не должны попадать в публичный репозиторий.
