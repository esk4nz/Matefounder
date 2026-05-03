export const NAVBAR_SYNC_EVENT = "matefounder:navbar-sync";

export function dispatchNavbarSync(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAVBAR_SYNC_EVENT));
}

export function subscribeNavbarSync(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(NAVBAR_SYNC_EVENT, listener);
  return () => {
    window.removeEventListener(NAVBAR_SYNC_EVENT, listener);
  };
}
