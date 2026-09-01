export const ADMIN_MESSAGE_PREFIX = "SOLPredict admin request:";

export function buildAdminMessage(nonce: string): string {
  return `${ADMIN_MESSAGE_PREFIX}${nonce}`;
}
