/** Demo-only role session (no real authentication yet). */
export type DemoRole = "admin" | "driver";
const KEY = "resqfood.demo-role";

export function setDemoRole(role: DemoRole) { try { localStorage.setItem(KEY, role); } catch { /* ignore */ } }
export function getDemoRole(): DemoRole | null {
  try { const v = localStorage.getItem(KEY); return v === "admin" || v === "driver" ? v : null; } catch { return null; }
}
export function clearDemoRole() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export const homeFor = (role: DemoRole) => (role === "driver" ? "/driver" : "/admin") as "/driver" | "/admin";
