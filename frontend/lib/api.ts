const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');
export const API_URL = `${API_BASE_URL}/api`;
export const SOCKET_URL = (process.env.NEXT_PUBLIC_SOCKET_URL || API_BASE_URL).replace(/\/+$/, '');

export const apiFetch = (endpoint: string, options: RequestInit = {}) => {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
        credentials: 'include',
        ...options,
        headers,
    });
};
