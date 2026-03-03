'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api' });

API.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sb_token') : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

interface User { _id: string; name: string; email: string; role: 'buyer' | 'seller'; }
interface CartItem { productId: string; name: string; price: number; quantity: number; image: string; shopId: string; shopName?: string; }

interface AppContextType {
    user: User | null; token: string | null;
    cart: CartItem[]; cartOpen: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: object) => Promise<void>;
    logout: () => void;
    addToCart: (item: CartItem) => void;
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

    useEffect(() => {
        const t = localStorage.getItem('sb_token');
        const u = localStorage.getItem('sb_user');
        if (t && u) { setToken(t); setUser(JSON.parse(u)); }
        const c = localStorage.getItem('sb_cart');
        if (c) setCart(JSON.parse(c));
    }, []);

    useEffect(() => {
        localStorage.setItem('sb_cart', JSON.stringify(cart));
    }, [cart]);

    const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = Date.now();
        setToasts(t => [...t, { id, msg, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }, []);

    const login = async (email: string, password: string) => {
        const { data } = await API.post('/auth/login', { email, password });
        setToken(data.token); setUser(data.user);
        localStorage.setItem('sb_token', data.token);
        localStorage.setItem('sb_user', JSON.stringify(data.user));
    };

    const register = async (formData: object) => {
        const { data } = await API.post('/auth/register', formData);
        setToken(data.token); setUser(data.user);
        localStorage.setItem('sb_token', data.token);
        localStorage.setItem('sb_user', JSON.stringify(data.user));
    };

    const logout = () => {
        setUser(null); setToken(null); setCart([]);
        localStorage.removeItem('sb_token'); localStorage.removeItem('sb_user'); localStorage.removeItem('sb_cart');
    };

    const addToCart = (item: CartItem) => {
        setCart(c => {
            const existing = c.find(x => x.productId === item.productId);
            if (existing) return c.map(x => x.productId === item.productId ? { ...x, quantity: x.quantity + (item.quantity || 1) } : x);
            return [...c, { ...item, quantity: item.quantity || 1 }];
        });
        setCartOpen(true);
        toast(`${item.name} added to cart`);
    };

    const removeFromCart = (productId: string) => setCart(c => c.filter(x => x.productId !== productId));

    const updateQty = (productId: string, delta: number) => {
        setCart(c => c.map(x => x.productId === productId
            ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x).filter(x => x.quantity > 0));
    };

    const clearCart = () => setCart([]);
    const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

    return (
        <AppContext.Provider value={{ user, token, cart, cartOpen, login, register, logout, addToCart, removeFromCart, updateQty, clearCart, setCartOpen, cartTotal, cartCount, api: API, toast, toasts }}>
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
