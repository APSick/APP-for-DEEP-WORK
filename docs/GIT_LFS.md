# Настройка Git LFS для аудио

Аудиофайлы в `public/audio/` превышают лимит GitHub 100 MB. Чтобы пушить их, нужен Git LFS.

## 1. Установить Git LFS

**Вариант A — Homebrew** (если есть права на запись):
```bash
brew install git-lfs
```

**Вариант B — Официальный установщик:**  
Скачай и установи с https://git-lfs.com/ (macOS .pkg).

После установки один раз:
```bash
git lfs install
```

## 2. В этом репозитории

Файл `.gitattributes` уже добавлен (треки `public/audio/*.mp3` и `*.m4a`).

Перевести уже закоммиченные большие файлы в LFS и переписать историю:

```bash
cd /Users/cornelius/Desktop/deepwork-tma

git lfs install
git lfs migrate import --include="public/audio/*.mp3,public/audio/*.m4a" --everything
```

Потом отправить на GitHub (история изменится — понадобится force push):

```bash
git push --force-with-lease origin main
```

После этого новые коммиты с аудио будут автоматически идти через LFS.
