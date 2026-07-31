const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  userId: number;
  username: string;
  name: string;
  role: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function clearAuth(): void {
  removeToken();
  removeStoredUser();
}

export async function authFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getToken();
  if (!token) {
    window.location.href = '/login';
    return new Response(null, { status: 401 });
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      'x-session': token,
    },
  });

  if (response.status === 401) {
    clearAuth();
    window.location.href = '/login';
  }

  return response;
}
