// Simple in-memory store for the currently active access token per user.
// Note: this is ephemeral (lost on server restart). For production use Redis or DB.
const activeTokens = new Map(); // userId => accessToken

export function setActiveAccessToken(userId, token) {
  if (!userId) return;
  activeTokens.set(String(userId), token);
}

export function getActiveAccessToken(userId) {
  return activeTokens.get(String(userId)) || null;
}

export function revokeActiveAccessToken(userId) {
  activeTokens.delete(String(userId));
}

export function isAccessTokenValidForUser(userId, token) {
  if (!userId) return false;
  const current = activeTokens.get(String(userId));
  if (!current) return false;
  return current === token;
}

export default {
  setActiveAccessToken,
  getActiveAccessToken,
  revokeActiveAccessToken,
  isAccessTokenValidForUser
};
