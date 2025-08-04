declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: any) => Promise<any>
      tauri: any
      // Add other Tauri APIs as needed
    }
  }
}

export {}