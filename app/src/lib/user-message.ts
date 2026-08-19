export const USER_MESSAGE_PREFIX = "PREDICT-X user request:";

export function buildUserMessage(nonce: string): string {
  return `${USER_MESSAGE_PREFIX}${nonce}`;
}