import { AppSettings } from "../store/persistence";

type AudioMode = "idle" | "html-audio" | "synth";
type SfxEvent =
  | "ui-click"
  | "research"
  | "event"
  | "base"
  | "location"
  | "system"
  | "save"
  | "load"
  | "warning";

const MUSIC_TRACKS = ["/music/theme.mp3", "/music/ambient.mp3", "/music/singularity.mp3"];
const TRACK_INDEX_KEY = "singularity_webapp_music_track_index";

const SFX_BY_EVENT: Record<SfxEvent, string> = {
  "ui-click": "/sfx/click0.wav",
  research: "/sfx/click0.wav",
  event: "/sfx/click0.wav",
  base: "/sfx/click0.wav",
  location: "/sfx/click0.wav",
  system: "/sfx/click0.wav",
  save: "/sfx/click0.wav",
  load: "/sfx/click0.wav",
  warning: "/sfx/click0.wav",
};

const SFX_COOLDOWN_MS: Record<SfxEvent, number> = {
  "ui-click": 40,
  research: 260,
  event: 600,
  base: 450,
  location: 400,
  system: 350,
  save: 800,
  load: 800,
  warning: 1200,
};

class AudioController {
  private settings: AppSettings | null = null;
  private mode: AudioMode = "idle";
  private unlocked = false;
  private warningHandler: ((message: string) => void) | null = null;

  private sfxCache = new Map<string, HTMLAudioElement>();
  private lastSfxAt = new Map<SfxEvent, number>();
  private musicElement: HTMLAudioElement | null = null;
  private musicTrackIndex = 0;
  private unavailableTracks = new Set<string>();
  private warningsShown = new Set<string>();
  private playlistTracks: string[] = [...MUSIC_TRACKS];
  private playlistLoaded = false;
  private playlistLoading: Promise<void> | null = null;

  private context: AudioContext | null = null;
  private synthMaster: GainNode | null = null;
  private synthNodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];

  constructor() {
    this.musicTrackIndex = this.loadTrackIndex();
  }

  setWarningHandler(handler: ((message: string) => void) | null): void {
    this.warningHandler = handler;
  }

  setSettings(next: AppSettings): void {
    this.settings = next;
    this.applySettings();
  }

  unlockFromGesture(): void {
    if (this.unlocked) {
      return;
    }

    this.unlocked = true;

    for (const assetPath of new Set(Object.values(SFX_BY_EVENT))) {
      if (!this.sfxCache.has(assetPath)) {
        const audio = new Audio(assetPath);
        audio.preload = "auto";
        this.sfxCache.set(assetPath, audio);
      }
    }

    this.applySettings();
    this.resumeIfNeeded();
  }

  resumeIfNeeded(): void {
    if (!this.settings || !this.unlocked) {
      return;
    }

    if (this.context && this.context.state === "suspended") {
      void this.context.resume();
    }

    if (this.musicElement) {
      const shouldPlay = this.getEffectiveMusicVolume() > 0;
      this.musicElement.volume = this.getEffectiveMusicVolume();
      if (shouldPlay && this.musicElement.paused) {
        void this.musicElement.play().catch(() => undefined);
      }
    }
  }

  playUiClick(): void {
    this.playSfx("ui-click");
  }

  playSfxForEvent(kind: string, message: string): void {
    const normalized = kind.toLowerCase();
    if (normalized === "research") {
      this.playSfx("research");
      return;
    }
    if (normalized === "event") {
      this.playSfx("event");
      return;
    }
    if (normalized === "base" || normalized === "build" || normalized === "power") {
      this.playSfx("base");
      return;
    }
    if (normalized === "location") {
      this.playSfx("location");
      return;
    }
    if (normalized === "system") {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes("saved")) {
        this.playSfx("save");
      } else if (lowerMessage.includes("loaded")) {
        this.playSfx("load");
      } else if (lowerMessage.includes("game over") || lowerMessage.includes("lost")) {
        this.playSfx("warning");
      } else {
        this.playSfx("system");
      }
      return;
    }
    this.playSfx("system");
  }

  dispose(): void {
    this.stopMusic();
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
    this.synthMaster = null;
    this.synthNodes = [];
    this.sfxCache.clear();
    this.lastSfxAt.clear();
    this.settings = null;
    this.unlocked = false;
    this.mode = "idle";
  }

  private applySettings(): void {
    if (!this.settings || !this.unlocked) {
      return;
    }

    if (!this.settings.musicEnabled || this.settings.musicVolume <= 0) {
      this.stopMusic();
      return;
    }

    if (this.mode === "html-audio" && this.musicElement) {
      this.musicElement.volume = this.getEffectiveMusicVolume();
      return;
    }

    if (this.mode === "synth") {
      this.updateSynthVolume();
      return;
    }

    this.startMusic();
  }

  private startMusic(): void {
    this.ensurePlaylistLoaded();
    this.stopMusic();

    const playableTracks = this.playlistTracks.filter((trackPath) => !this.unavailableTracks.has(trackPath));
    if (playableTracks.length === 0) {
      this.warnOnce(
        "music-missing",
        "Music tracks are missing from /public/music; using synth fallback. Run `npm run music:update` in webapp to pull/sync tracks."
      );
      this.startSynthFallback();
      return;
    }

    const index = Math.max(0, this.musicTrackIndex % playableTracks.length);
    const trackPath = playableTracks[index] ?? playableTracks[0];

    const music = new Audio(trackPath);
    music.loop = false;
    music.preload = "auto";
    music.volume = this.getEffectiveMusicVolume();
    music.onended = () => {
      this.selectNextTrack();
      this.startMusic();
    };
    music.onerror = () => {
      this.unavailableTracks.add(trackPath);
      this.warnOnce(`missing:${trackPath}`, `Could not load ${trackPath}; trying next track.`);
      this.selectNextTrack();
      this.startMusic();
    };

    this.musicTrackIndex = this.playlistTracks.indexOf(trackPath);
    this.storeTrackIndex(this.musicTrackIndex);

    void music
      .play()
      .then(() => {
        this.musicElement = music;
        this.mode = "html-audio";
      })
      .catch(() => {
        this.warnOnce("autoplay-blocked", "Music auto-play is blocked until you interact with the page.");
        this.startSynthFallback();
      });
  }

  private stopMusic(): void {
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.onended = null;
      this.musicElement.onerror = null;
      this.musicElement.src = "";
      this.musicElement = null;
    }

    if (this.synthNodes.length > 0) {
      for (const node of this.synthNodes) {
        try {
          node.osc.stop();
        } catch {
          // already stopped
        }
        node.osc.disconnect();
        node.gain.disconnect();
      }
      this.synthNodes = [];
    }

    this.mode = "idle";
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
    return this.context;
  }

  private startSynthFallback(): void {
    const ctx = this.ensureContext();

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const notes = [110, 164.81, 220];
    const nodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];

    for (const freq of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      nodes.push({ osc, gain });
    }

    const now = ctx.currentTime;
    const target = this.getMusicGainTarget();
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(target, now + 0.7);

    this.synthMaster = master;
    this.synthNodes = nodes;
    this.mode = "synth";
  }

  private updateSynthVolume(): void {
    if (!this.synthMaster || !this.context) {
      return;
    }
    const now = this.context.currentTime;
    this.synthMaster.gain.cancelScheduledValues(now);
    this.synthMaster.gain.linearRampToValueAtTime(this.getMusicGainTarget(), now + 0.2);
  }

  private getMusicGainTarget(): number {
    return this.getEffectiveMusicVolume() * 0.16;
  }

  private getEffectiveMusicVolume(): number {
    if (!this.settings || this.settings.audioMuted || !this.settings.musicEnabled) {
      return 0;
    }
    const master = Math.max(0, Math.min(1, this.settings.masterVolume));
    const music = Math.max(0, Math.min(1, this.settings.musicVolume));
    return master * music;
  }

  private getEffectiveSfxVolume(): number {
    if (!this.settings || this.settings.audioMuted || !this.settings.sfxEnabled) {
      return 0;
    }
    const master = Math.max(0, Math.min(1, this.settings.masterVolume));
    const sfx = Math.max(0, Math.min(1, this.settings.sfxVolume));
    return master * sfx;
  }

  private playSfx(event: SfxEvent): void {
    if (!this.unlocked) {
      return;
    }

    const volume = this.getEffectiveSfxVolume();
    if (volume <= 0) {
      return;
    }

    const now = Date.now();
    const last = this.lastSfxAt.get(event) ?? 0;
    const cooldown = SFX_COOLDOWN_MS[event];
    if (now - last < cooldown) {
      return;
    }
    this.lastSfxAt.set(event, now);

    const assetPath = SFX_BY_EVENT[event];
    const source = this.sfxCache.get(assetPath);
    if (source) {
      const sfx = source.cloneNode(true) as HTMLAudioElement;
      sfx.volume = volume;
      void sfx.play().catch(() => {
        this.playClickFallback(volume, event);
      });
      return;
    }

    this.warnOnce(`sfx-missing:${assetPath}`, `Missing sound effect asset: ${assetPath}`);
    this.playClickFallback(volume, event);
  }

  private playClickFallback(volume: number, event: SfxEvent): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    const baseFreq =
      event === "warning"
        ? 340
        : event === "research"
          ? 760
          : event === "save"
            ? 660
            : event === "load"
              ? 580
              : 900;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.58, ctx.currentTime + 0.035);
    gain.gain.setValueAtTime(volume * 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.055);
  }

  private loadTrackIndex(): number {
    try {
      const raw = window.localStorage.getItem(TRACK_INDEX_KEY);
      if (!raw) {
        return 0;
      }
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private storeTrackIndex(index: number): void {
    try {
      window.localStorage.setItem(TRACK_INDEX_KEY, String(index));
    } catch {
      // ignore storage errors
    }
  }

  private selectNextTrack(): void {
    const trackCount = this.playlistTracks.length;
    if (trackCount <= 1) {
      this.musicTrackIndex = 0;
      this.storeTrackIndex(0);
      return;
    }

    if (this.settings?.musicShuffle) {
      const next = ((this.musicTrackIndex * 1103515245 + 12345) >>> 0) % trackCount;
      this.musicTrackIndex = next === this.musicTrackIndex ? (next + 1) % trackCount : next;
    } else {
      this.musicTrackIndex = (this.musicTrackIndex + 1) % trackCount;
    }

    this.storeTrackIndex(this.musicTrackIndex);
  }

  private warnOnce(id: string, message: string): void {
    if (this.warningsShown.has(id)) {
      return;
    }
    this.warningsShown.add(id);
    console.warn(`[audio] ${message}`);
    this.warningHandler?.(message);
  }

  private ensurePlaylistLoaded(): void {
    if (this.playlistLoaded || this.playlistLoading) {
      return;
    }

    this.playlistLoading = fetch("/music/tracks.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) {
          return;
        }
        const tracks = payload.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
        if (tracks.length > 0) {
          this.playlistTracks = tracks;
          if (this.musicTrackIndex >= tracks.length) {
            this.musicTrackIndex = 0;
            this.storeTrackIndex(0);
          }
        }
      })
      .catch(() => {
        // Keep built-in defaults if manifest fetch fails.
      })
      .finally(() => {
        this.playlistLoaded = true;
        this.playlistLoading = null;
      });
  }
}

export const audioController = new AudioController();
