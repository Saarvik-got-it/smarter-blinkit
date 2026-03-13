'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api' });

API.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sb_token') : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Response interceptor to handle stale sessions (e.g. after a re-seed)
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && error.response?.data?.message === 'User not found') {
            console.warn('Session is stale. Logging out...');
            if (typeof window !== 'undefined') {
                localStorage.removeItem('sb_token');
                localStorage.removeItem('sb_user');
                localStorage.removeItem('sb_cart');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

interface User {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    role: 'buyer' | 'seller';
    location?: {
        type: 'Point';
        coordinates: [number, number]; // [lng, lat]
        address?: string;
        city?: string;
        state?: string;
        pincode?: string;
    };
    savedAddresses?: any[];
}
interface CartItem { productId: string; name: string; price: number; quantity: number; image: string; shopId: string; shopName?: string; }

interface AppContextType {
    user: User | null; token: string | null;
    cart: CartItem[]; cartOpen: boolean;
    login: (email: string, password: string) => Promise<User>;
    register: (data: object) => Promise<User>;
    logout: () => boolean;
    // ✅ NEW: Used by FaceLogin to update context state after a face scan
    setUserFromToken: (token: string, user: User) => void;
    updateUser: (user: User) => void;
    deleteAccount: () => Promise<boolean>;
    addToCart: (item: CartItem) => void;
    addMultipleToCart: (items: CartItem[]) => void;
    removeFromCart: (productId: string) => void;
    updateQty: (productId: string, delta: number) => void;
    clearCart: () => void;
    setCartOpen: (v: boolean) => void;
    cartTotal: number; cartCount: number;
    api: typeof API;
    toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    toasts: { id: number; msg: string; type: string }[];
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
    // Track if we've finished hydrating from localStorage (prevents flash of logged-out state)
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const t = localStorage.getItem('sb_token');
        const u = localStorage.getItem('sb_user');
        if (t && u) {
            try {
                setToken(t);
                setUser(JSON.parse(u));
            } catch {
                // Corrupted data — clear it
                localStorage.removeItem('sb_token');
                localStorage.removeItem('sb_user');
            }
        }
        const c = localStorage.getItem('sb_cart');
        if (c) {
            try { setCart(JSON.parse(c)); } catch { /* ignore */ }
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        localStorage.setItem('sb_cart', JSON.stringify(cart));
    }, [cart]);

    let toastCounter = 0;
    const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = Date.now() * 1000 + (toastCounter++ % 1000);
        setToasts(t => [...t, { id, msg, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }, []);

    const login = async (email: string, password: string) => {
        const { data } = await API.post('/auth/login', { email, password });
        setToken(data.token); setUser(data.user);
        localStorage.setItem('sb_token', data.token);
        localStorage.setItem('sb_user', JSON.stringify(data.user));
        return data.user;
    };

    const register = async (formData: object) => {
        const { data } = await API.post('/auth/register', formData);
        setToken(data.token); setUser(data.user);
        localStorage.setItem('sb_token', data.token);
        localStorage.setItem('sb_user', JSON.stringify(data.user));
        return data.user;
    };

    // ✅ FIX: Used by FaceLogin so the React state is in sync with localStorage
    const setUserFromToken = (tok: string, u: User) => {
        setToken(tok);
        setUser(u);
        localStorage.setItem('sb_token', tok);
        localStorage.setItem('sb_user', JSON.stringify(u));
    };

    const updateUser = (u: User) => {
        setUser(u);
        localStorage.setItem('sb_user', JSON.stringify(u));
    };

    const logout = (): boolean => {
        if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to sign out?')) return false;
        // ✅ FIX: Clear React state first, then localStorage — both must clear for a clean logout
        setUser(null);
        setToken(null);
        setCart([]);
        setCartOpen(false);
        localStorage.removeItem('sb_token');
        localStorage.removeItem('sb_user');
        localStorage.removeItem('sb_cart');
        return true;
    };

    // ✅ NEW: Delete the currently logged-in account from the DB
    const deleteAccount = async (): Promise<boolean> => {
        if (!window.confirm('⚠️ Are you absolutely sure? This will permanently delete your account and all associated data. This cannot be undone.')) return false;
        try {
            await API.delete('/auth/delete-account');
            // Clear all state after successful deletion
            setUser(null); setToken(null); setCart([]); setCartOpen(false);
            localStorage.removeItem('sb_token');
            localStorage.removeItem('sb_user');
            localStorage.removeItem('sb_cart');
            return true;
        } catch {
            return false;
        }
    };

    const addToCart = (item: CartItem) => {
        setCart(c => {
            const existing = c.find(x => x.productId === item.productId);
            if (existing) return c.map(x => x.productId === item.productId ? { ...x, quantity: x.quantity + (item.quantity || 1) } : x);
            return [...c, { ...item, quantity: item.quantity || 1 }];
        });
        // Cart does NOT auto-open — user clicks cart icon to view it
        toast(`${item.name} added to cart`);
    };

    const addMultipleToCart = (items: CartItem[]) => {
        setCart(c => {
            let newCart = [...c];
            items.forEach(item => {
                const existingIndex = newCart.findIndex(x => x.productId === item.productId);
                if (existingIndex >= 0) {
                    newCart[existingIndex] = { ...newCart[existingIndex], quantity: newCart[existingIndex].quantity + (item.quantity || 1) };
                } else {
                    newCart.push({ ...item, quantity: item.quantity || 1 });
                }
            });
            return newCart;
        });
        // Cart does NOT auto-open — user clicks cart icon to view it
        if (items.length === 1) {
            toast(`${items[0].name} added to cart`);
        } else if (items.length > 1) {
            const names = items.map(i => i.name).join(', ');
            toast(`${names} added to cart`);
        }
    };

    const removeFromCart = (productId: string) => setCart(c => c.filter(x => x.productId !== productId));

    const updateQty = (productId: string, delta: number) => {
        setCart(c => c.map(x => x.productId === productId
            ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x).filter(x => x.quantity > 0));
    };

    const clearCart = () => setCart([]);
    const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

    // Don't render children until hydration is done to prevent auth flicker
    if (!hydrated) return null;

    return (
        <AppContext.Provider value={{ user, token, cart, cartOpen, login, register, logout, setUserFromToken, updateUser, deleteAccount, addToCart, addMultipleToCart, removeFromCart, updateQty, clearCart, setCartOpen, cartTotal, cartCount, api: API, toast, toasts }}>
            {children}
            {/* Toast container */}
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`}>
                        <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
                        {t.msg}
                    </div>
                ))}
            </div>
        </AppContext.Provider>
    );
}

export const useApp = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used inside AppProvider');
    return ctx;
};

export { API };
