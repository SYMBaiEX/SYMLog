// Tauri Window API Type Definitions
export interface TauriWindow {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  isFullscreen(): Promise<boolean>;
  emit(event: string, payload?: any): void;
}

export interface TauriAPI {
  window: {
    getCurrent(): TauriWindow;
  };
  invoke(cmd: string, args?: Record<string, any>): Promise<any>;
  tauri: any;
}

declare global {
  interface Window {
    __TAURI__?: TauriAPI;
  }
}
