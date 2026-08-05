export const ADMIN_MESSAGE_PREFIX = "PREDICT-X admin request:";

export function buildAdminMessage(nonce: string): string {
  return `${ADMIN_MESSAGE_PREFIX}${nonce}`;
}
