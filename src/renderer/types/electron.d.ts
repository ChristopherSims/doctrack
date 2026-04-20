export {};

declare global {
  interface Window {
    electronAPI: {
      version: string;
      loadSettings: () => Promise<Record<string, unknown>>;
      saveSettings: (settings: Record<string, unknown>) => Promise<void>;
    };
  }
}
