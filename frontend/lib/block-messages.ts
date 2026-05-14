export const BLOCK_USER_ALREADY_BLOCKED_MESSAGE =
  "Ви вже заблокували цього користувача. Оновіть сторінку.";

export const UNBLOCK_USER_ALREADY_UNBLOCKED_MESSAGE =
  "Користувач вже розблокований. Оновіть сторінку.";

export const BLOCK_SYNC_NOTICE_STORAGE_KEY = "matefounder.blocks.syncNotice";

export function persistBlockSyncNotice(message: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(BLOCK_SYNC_NOTICE_STORAGE_KEY, message);
  } catch {
  }
}
