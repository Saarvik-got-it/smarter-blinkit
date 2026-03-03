'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import Navbar from '@/components/Navbar';

export default function AdminUsersPage() {
    const { api, toast } = useApp();
    const [secret, setSecret] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Try to auto-login from session storage
    useEffect(() => {
        const saved = sessionStorage.getItem('admin_secret');
        if (saved) {
            setSecret(saved);
            fetchUsers(saved);
        }
    }, []);

    const fetchUsers = async (key: string) => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/users', { headers: { 'x-admin-secret': key } });
            setUsers(data.users);
            setIsAuthenticated(true);
            sessionStorage.setItem('admin_secret', key);
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Access Denied', 'error');
            setIsAuthenticated(false);
            sessionStorage.removeItem('admin_secret');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        fetchUsers(secret);
    };

    return (
        <>
            <Navbar />
            <main className="container" style={{ paddingTop: '100px', minHeight: '100vh' }}>
                <h1 style={{ marginBottom: '24px' }}>🛡️ Developer Admin Panel</h1>

                {!isAuthenticated ? (
                    <div className="card" style={{ maxWidth: '400px', margin: '40px auto' }}>
                        <h3 style={{ marginBottom: '16px' }}>Admin Login</h3>
                        <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.875rem' }}>Enter the developer secret key to view all platform users.</p>
                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Enter admin secret key"
                                value={secret}
                                onChange={e => setSecret(e.target.value)}
                                required
                            />
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Authenticating...' : 'Access Dashboard'}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <p className="text-muted">Viewing all registered buyers and sellers on the platform.</p>
                            <button className="btn btn-ghost btn-sm" onClick={() => fetchUsers(secret)}>🔄 Refresh</button>
                        </div>

                        <div className="card" style={{ padding: 0 }}>
                            <div className="table-wrap">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Created At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u._id}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u._id}</td>
                                                <td style={{ fontWeight: 600 }}>{u.name}</td>
                                                <td>{u.email}</td>
                                                <td>
                                                    <span className={`badge ${u.role === 'seller' ? 'badge-yellow' : 'badge-green'}`}>
                                                        {u.role.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {new Date(u.createdAt || Date.now()).toLocaleDateString('en-IN')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {users.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</div>}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
