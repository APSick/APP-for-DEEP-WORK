// src/components/MusicCard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { TEXTS } from "../constants";

type Track = {
  id: string;
  title: string;
  description: string;
  durationLabel: string;
  urls: string[];
};

// Аудио с GitHub
const TRACKS: Track[] = [
  {
    id: "midnight-productivity",
    title: "Midnight Productivity",
    description: "",
    durationLabel: "",
    urls: [
      "https://github.com/APSick/deepwork-audio/raw/refs/heads/main/tracks/track%201-1.MP3",
      "https://github.com/APSick/deepwork-audio/raw/refs/heads/main/tracks/track%201-2.MP3",
    ],
  },
];

function formatHoursMinutes(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0 мин";
  const totalMin = Math.floor(sec / 60);
  if (totalMin < 60) return `${totalMin} мин`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

/** Формат под ползунком: H:MM:SS без "ч" и "мин" (например 3:13:46) */
function formatHMMSS(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Полный URL для аудио: если уже https — как есть, иначе собираем из BASE_URL или VITE_AUDIO_BASE_URL */
const getAudioUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const external = import.meta.env.VITE_AUDIO_BASE_URL;
  if (external) {
    const base = String(external).replace(/\/$/, "");
    return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
  }
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  return path.startsWith("/") ? `${base.replace(/\/$/, "")}${path}` : `${base}${path}`;
};

export function MusicCard() {
  const [currentId, setCurrentId] = useState<string>(TRACKS[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
   const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
  const [isSeeking, setIsSeeking] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = useMemo(
    () => TRACKS.find((t) => t.id === currentId) ?? TRACKS[0],
    [currentId],
  );

  const currentUrl = useMemo(
    () => getAudioUrl(currentTrack.urls[Math.min(currentPartIndex, currentTrack.urls.length - 1)]),
    [currentTrack, currentPartIndex],
  );

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  // Обновляем src при смене трека
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setLoadError(null);
    setCurrentTime(0);
    setDuration(0);
    audio.src = currentUrl;
    audio.load();
    if (isPlaying) {
      const p = audio.play();
      if (p != null) p.catch(() => { /* ignore autoplay */ });
    }
  }, [currentTrack, currentUrl, isPlaying]);

  // Синхронизируем play/pause и время с audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      if (!isSeeking) setCurrentTime(audio.currentTime);
    };
    const handleDurationChange = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [isSeeking]);

  // Загружаем метаданные всех треков, чтобы показывать длительность у каждого
  useEffect(() => {
    const audioByTrack: HTMLAudioElement[] = [];
    TRACKS.forEach((track) => {
      track.urls.forEach((u) => {
        const audio = new Audio();
        audio.preload = "metadata";
        const onLoaded = () => {
          if (Number.isFinite(audio.duration)) {
            setTrackDurations((prev) => ({
              ...prev,
              [track.id]: (prev[track.id] ?? 0) + audio.duration,
            }));
          }
        };
        audio.addEventListener("loadedmetadata", onLoaded, { once: true });
        audio.src = getAudioUrl(u);
        audioByTrack.push(audio);
      });
    });
    return () => {
      audioByTrack.forEach((a) => (a.src = ""));
    };
  }, []);

  const playTrack = (trackId: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentPartIndex(0);
    setCurrentId(trackId);
    setIsPlaying(true);
  };

  const handleEnded = () => {
    const track = currentTrack;
    if (!track) return;
    const partsCount = track.urls.length;
    if (partsCount <= 1) {
      setIsPlaying(false);
      return;
    }
    const nextPart = currentPartIndex + 1;
    if (nextPart < partsCount) {
      setCurrentPartIndex(nextPart);
      setIsPlaying(true);
    } else {
      // все части проиграны — начинаем сначала
      setCurrentPartIndex(0);
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Math.max(0, Math.min(duration || 0, value));
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const skipBack = () => {
    seekTo(currentTime - 15);
  };

  const skipForward = () => {
    seekTo(currentTime + 15);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    seekTo((duration || 0) * val);
  };

  const handleSliderMouseDown = () => setIsSeeking(true);
  const handleSliderMouseUp = () => setIsSeeking(false);

  return (
    <div className="glass card musicCard">
      <div className="cardHeader">
        <div className="cardTitle">{TEXTS.music}</div>
        <div className="musicCardSubtitle">Плеер для продуктивной работы</div>
      </div>

      <div className="musicPlayerMain">
        <div className="musicNowPlaying">
          <button
            className={`musicPlayButton ${isPlaying ? "musicPlayButtonActive" : ""}`}
            type="button"
            onClick={togglePlayPause}
            aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
          >
            <span className="musicPlayIcon" />
          </button>

          <div className="musicNowText">
            <div className="musicNowLabel">Сейчас играет</div>
            <div className="musicNowTitle">{currentTrack.title}</div>
            {loadError === currentTrack.id && (
              <div className="musicNowError">
                Ошибка загрузки аудио. Проверь, что ссылка открывается в браузере и доступна в твоём регионе.
              </div>
            )}
            <div className="musicNowMeta">
              {duration > 0
                ? formatHoursMinutes(duration)
                : (trackDurations[currentTrack.id] != null && trackDurations[currentTrack.id] > 0)
                  ? formatHoursMinutes(trackDurations[currentTrack.id])
                  : "—"}
            </div>
          </div>
        </div>

        <div className="musicPlayerControls">
          <button
            type="button"
            className="musicSkipBtn"
            onClick={skipBack}
            aria-label="Назад 15 сек"
          >
            −15
          </button>
          <div className="musicSliderWrap">
            <input
              type="range"
              className="musicSlider"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={handleSliderChange}
              onMouseDown={handleSliderMouseDown}
              onMouseUp={handleSliderMouseUp}
              onTouchStart={handleSliderMouseDown}
              onTouchEnd={handleSliderMouseUp}
            />
          </div>
          <button
            type="button"
            className="musicSkipBtn"
            onClick={skipForward}
            aria-label="Вперёд 15 сек"
          >
            +15
          </button>
        </div>
        <div className="musicTimeLabels">
          <span>{formatHMMSS(currentTime)}</span>
          <span>{formatHMMSS(Math.max(0, duration - currentTime))}</span>
        </div>

        <div className="musicTrackList">
          {TRACKS.map((track) => (
            <button
              key={track.id}
              type="button"
              className={
                "musicTrackItem" +
                (track.id === currentId ? " musicTrackItemActive" : "")
              }
              onClick={() => playTrack(track.id)}
            >
              <div className="musicTrackTitle">{track.title}</div>
              <div className="musicTrackMeta">
                {trackDurations[track.id] != null && trackDurations[track.id] > 0
                  ? formatHoursMinutes(trackDurations[track.id])
                  : "—"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        onError={() => setLoadError(currentTrack.id)}
        onEnded={handleEnded}
      />
    </div>
  );
}

