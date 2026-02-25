// src/components/MusicCard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { TEXTS } from "../constants";

type Track = {
  id: string;
  title: string;
  description: string;
  durationLabel: string;
  url: string;
};

// Локальные файлы (m4a/mp3) клади в папку public/audio/ и указывай url: "/audio/имя-файла.m4a"
const TRACKS: Track[] = [
  {
    id: "midnight-productivity",
    title: "Midnight Productivity",
    description: "",
    durationLabel: "",
    url: "/audio/" + encodeURIComponent("Музыка для работы за компьютером _ Фоновая музыка для концентрации и продуктивности.mp3.m4a"),
  },
  {
    id: "momentum",
    title: "Momentum",
    description: "",
    durationLabel: "",
    url: "/audio/" + encodeURIComponent("Deep Focus Music – High-Performance Beats for Peak Productivity _ Deep Work.mp3"),
  },
  {
    id: "deep-work-rad",
    title: "Deep Work RAD",
    description: "",
    durationLabel: "",
    url: "/audio/" + encodeURIComponent("Музыка для продуктивной работы (Гамма-волны 40 Гц).mp3"),
  },
  {
    id: "interstellar",
    title: "Interstellar",
    description: "",
    durationLabel: "",
    url: "/audio/" + encodeURIComponent("INTERSTELLAR _ INCEPTION Fusion _ Dark Ambient Music for Deep Focus _ Relaxation (4K).mp3"),
  },
  {
    id: "gamma-brainwave-music",
    title: "Gamma Brainwave Music",
    description: "",
    durationLabel: "",
    url: "/audio/" + encodeURIComponent("Instant Focus Mode – 40Hz Gamma Brainwave Music for Deep Focus _ Productivity.mp3.m4a"),
  },
  {
    id: "piano-collection",
    title: "Piano Collection",
    description: "",
    durationLabel: "",
    // Запятая в пути не кодируем — некоторые серверы отдают файл только так
    url: "/audio/" + "EINAUDI, ZIMMER - Immersive Study, Focus _ Work Music - Soft Felt Piano Collection.mp3".replace(/ /g, "%20"),
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

const getAudioUrl = (path: string) => {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  return path.startsWith("/") ? `${base.replace(/\/$/, "")}${path}` : `${base}${path}`;
};

export function MusicCard() {
  const [currentId, setCurrentId] = useState<string>(TRACKS[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
  const [isSeeking, setIsSeeking] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = useMemo(
    () => TRACKS.find((t) => t.id === currentId) ?? TRACKS[0],
    [currentId],
  );

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  // Обновляем src при смене трека
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setLoadError(null);
    setCurrentTime(0);
    setDuration(0);
    const url = getAudioUrl(currentTrack.url);
    audio.src = url;
    audio.load();
    if (isPlaying) {
      const p = audio.play();
      if (p != null) p.catch(() => { /* ignore autoplay */ });
    }
  }, [currentTrack, isPlaying]);

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
    const audioByTrack = new Map<string, HTMLAudioElement>();
    TRACKS.forEach((track) => {
      const audio = new Audio();
      audio.preload = "metadata";
      const onLoaded = () => {
        if (Number.isFinite(audio.duration)) {
          setTrackDurations((prev) => ({ ...prev, [track.id]: audio.duration }));
        }
      };
      audio.addEventListener("loadedmetadata", onLoaded, { once: true });
      audio.src = getAudioUrl(track.url);
      audioByTrack.set(track.id, audio);
    });
    return () => {
      audioByTrack.forEach((a) => (a.src = ""));
    };
  }, []);

  const playTrack = (trackId: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentId(trackId);
    setIsPlaying(true);
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
              <div className="musicNowError">Ошибка загрузки</div>
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
        loop
        preload="metadata"
        onError={() => setLoadError(currentTrack.id)}
      />
    </div>
  );
}

