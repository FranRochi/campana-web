"use client";

const TOKEN_KEY = "campaign_token";
const USER_KEY = "campaign_user";

export type SessionUser = {
  username: string;
  full_name: string;
  email: string;
};

export function saveSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = localStorage.getItem(USER_KEY);
  return stored ? (JSON.parse(stored) as SessionUser) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
