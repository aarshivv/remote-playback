export interface ResolutionPreset {
  label: string;
  width: number;
  height: number;
  devicePixelRatio: number;
}

export const RESOLUTION_PRESETS: Record<string, ResolutionPreset> = {
  "720p":  { label: "720p (HD)",       width: 1280, height: 720,  devicePixelRatio: 1 },
  "1080p": { label: "1080p (Full HD)", width: 1920, height: 1080, devicePixelRatio: 1 },
  "1440p": { label: "1440p (2K)",      width: 2560, height: 1440, devicePixelRatio: 1 },
  "4k":    { label: "4K (Ultra HD)",   width: 3840, height: 2160, devicePixelRatio: 1 },
};

export const DEFAULT_RESOLUTION = "1080p";

export const STORAGE_KEY_ENABLED = "enabled";
export const STORAGE_KEY_RESOLUTION = "resolution";

export const MSG_TYPE_RESOLUTION_UPDATE = "rp-resolution-update";
