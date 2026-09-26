export {};
declare global {
  interface Window {
    supercool?: { track?: (name: string, props?: Record<string, string | number | boolean>) => void };
  }
}
