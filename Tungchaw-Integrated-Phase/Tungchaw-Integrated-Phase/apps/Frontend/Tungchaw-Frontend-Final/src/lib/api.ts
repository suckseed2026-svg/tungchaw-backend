import type {
  ApiList,
  AuthState,
  Branch,
  Business,
  ResourceRow,
  SessionUser,
  UserBusinessMembership,
} from './types';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const STORAGE = 'tungchaw.session.v1';
const EMPTY_SESSION: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  business: null,
  branch: null,
  membership: null,
};

export const demoMode = (import.meta.env.VITE_DEMO_MODE ?? 'false') === 'true';

export function readSession(): AuthState {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) || 'null') as Partial<AuthState> | null;
    return value ? { ...EMPTY_SESSION, ...value } : { ...EMPTY_SESSION };
  } catch {
    return { ...EMPTY_SESSION };
  }
}

export function writeSession(value: AuthState): void {
  localStorage.setItem(STORAGE, JSON.stringify(value));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE);
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    return Array.isArray(message) ? message.join(', ') : String(message);
  }
  return `Request failed (${status})`;
}

type RequestOptions = RequestInit & { businessId?: string };

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { businessId, ...init } = options;
  const session = readSession();
  const headers = new Headers(init.headers);

  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (session.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (businessId) headers.set('X-Business-Id', businessId);

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Cannot connect to Tungchaw API at ${API}. Make sure the backend is running.`);
  }

  const contentType = response.headers.get('content-type') || '';
  const body: unknown = contentType.includes('json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new Error(messageFrom(body, response.status));
  }

  return body as T;
}

export async function login(email: string, password: string) {
  const data = await request<{
    accessToken: string;
    refreshToken: string;
    user: SessionUser;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
}

export async function register(payload: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}) {
  return request<{ message: string; user: SessionUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function profile() {
  return request<SessionUser>('/auth/profile');
}

export async function businesses() {
  return request<UserBusinessMembership[]>('/businesses');
}

export async function createBusiness(payload: {
  name: string;
  code: string;
  industry: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  return request<{
    message: string;
    business: Business;
    membership: { id: string; isOwner: boolean; status: string };
    ownerRole: { id: string; name: string; code: string };
  }>('/businesses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function businessContext(businessId: string) {
  return request<unknown>('/businesses/context', { businessId });
}

export async function branches(businessId: string) {
  return request<Branch[]>(`/businesses/${businessId}/branches`, { businessId });
}

export async function createBranch(
  businessId: string,
  payload: { name: string; code: string; phone?: string; address?: string },
) {
  return request<Branch>(`/businesses/${businessId}/branches`, {
    method: 'POST',
    businessId,
    body: JSON.stringify(payload),
  });
}

export function rows<T = ResourceRow>(value: ApiList<T>): T[] {
  if (Array.isArray(value)) return value;
  return value.data || value.items || [];
}

export const apiBase = API;
