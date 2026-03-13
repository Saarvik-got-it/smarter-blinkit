'use client';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/lib/context';
import { SOCKET_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';
import FaceRegister from '@/components/FaceRegister';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { io } from 'socket.io-client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import dynamic from 'next/dynamic';
import MapPicker from '@/components/MapPicker';
import type { MapLocationData } from '@/components/MapPickerBase';

const MoneyMap = dynamic(() => import('@/components/MoneyMap'), { ssr: false });

export default function SellerDashboard() {
    const { user, api, toast, deleteAccount } = useApp();
    const router = useRouter();
    const [shop, setShop] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [tab, setTab] = useState<'overview' | 'inventory' | 'orders' | 'barcode' | 'settings' | 'storeboard'>('overview');
    const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', category: '', unit: 'piece', weight: '', barcode: '', image: '', description: '', expiryDate: '' });
    const [shopEdit, setShopEdit] = useState<any>({ name: '', address: '', phone: '', city: '', state: '', pincode: '', location: null });
    const [savingShop, setSavingShop] = useState(false);
    const [editingLocation, setEditingLocation] = useState({ loadingLoc: false, loadingPin: false });
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef<HTMLDivElement>(null);
    const [shopSetup, setShopSetup] = useState<any>({ name: '', address: '', phone: '', city: '', state: '', pincode: '', country: 'India', location: null });
    const [creatingShop, setCreatingShop] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [loadingPincode, setLoadingPincode] = useState(false);
    const [catDropdownOpen, setCatDropdownOpen] = useState(false);
    const [showMapSetup, setShowMapSetup] = useState(false);
    const [showMapEdit, setShowMapEdit] = useState(false);

    // State for animated custom modal prompt when scanning dupes
    const [existingProductPrompt, setExistingProductPrompt] = useState<{ isOpen: boolean; product: any; barcode: string } | null>(null);

    // Derive unique categories from the shop's current inventory
    const shopCategories: string[] = [...new Set(products.map((p: any) => p.category).filter(Boolean))] as string[];

    useEffect(() => {
        // Fetch shop separately so a 404 (no shop yet) doesn't crash the whole dashboard
        api.get('/shops/my')
            .then(r => {
                const s = r.data.shop;
                setShop(s);
                let addr = s.location?.address || '';
                let cty = s.location?.city || '';
                let st = s.location?.state || '';
                let pin = s.location?.pincode || '';

                // Backwards compat for monolithic strings
                if (addr && (!cty || !st || !pin)) {
                    const parts = addr.split(',').map((ss: string) => ss.trim()).filter(Boolean);
                    if (parts.length >= 3) {
                        const pinIndex = parts.findIndex((p: string) => /^\d{6}$/.test(p));
                        if (pinIndex !== -1) {
                            if (!pin) pin = parts[pinIndex];
                            if (!st && pinIndex >= 1) st = parts[pinIndex - 1];
                            if (!cty && pinIndex >= 2) cty = parts[pinIndex - 2];
                            addr = parts.slice(0, pinIndex - 2).join(', ');
                        }
                    }
                }

                setShopEdit({
                    name: s.name,
                    address: addr,
                    phone: s.phone || '',
                    city: cty,
                    state: st,
                    pincode: pin,
                    location: s.location?.coordinates?.[0] !== 0 ? s.location : null
                });
            })
            .catch(() => { /* shop not created yet — handled by render below */ });
        api.get('/orders/shop').then(r => setOrders(r.data.orders || [])).catch(() => { });
        setLoading(false);
    }, [api]);

    useEffect(() => {
        if (shop) api.get(`/products/shop/${shop._id}`).then(r => setProducts(r.data.products || []));
    }, [shop, api]);

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let processedWeight = newProduct.weight.trim();
            // If the user only typed a number (e.g., "52" or " 52 "), append the selected unit type
            if (processedWeight && !isNaN(Number(processedWeight))) {
                processedWeight = `${processedWeight}${newProduct.unit === 'piece' ? '' : newProduct.unit}`;
            }

            const payload: any = {
                ...newProduct,
                price: Number(newProduct.price),
                stock: Number(newProduct.stock),
                weight: processedWeight
            };

            if (!payload.expiryDate) delete payload.expiryDate;

            if (payload._id) {
                const { _id, ...updatePayload } = payload;
                const { data } = await api.put(`/products/${_id}`, updatePayload);
                setProducts(p => p.map(prod => prod._id === _id ? data.product : prod));
                toast('Product updated! ✅', 'success');
            } else {
                const { data } = await api.post('/products', payload);
                setProducts(p => [...p, data.product]);
                toast('Product added! ✅', 'success');
            }

            setNewProduct({ name: '', price: '', stock: '', category: '', unit: 'piece', weight: '', barcode: '', image: '', description: '', expiryDate: '' });
        } catch (err: any) { toast(err?.response?.data?.message || 'Failed to save product', 'error'); }
    };

    const handleDeleteProduct = async (productId: string, productName: string) => {
        if (!window.confirm(`Delete "${productName}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/products/${productId}`);
            setProducts(p => p.filter(prod => prod._id !== productId));
            toast('Product deleted.', 'success');
        } catch (err: any) { toast(err?.response?.data?.message || 'Failed to delete product', 'error'); }
    };

    const generateDemoBarcode = () => {
        const code = Math.floor(100000000000 + Math.random() * 900000000000).toString(); // 12-digit numeric
        setNewProduct(p => ({ ...p, barcode: code }));
        toast(`Generated demo barcode: ${code}`, 'success');
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast('Geolocation is not supported by your browser', 'error');
            return;
        }
        setLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude: lat, longitude: lon } = position.coords;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
                    const data = await res.json();
                    if (data && data.address) {
                        const addr = data.address;
                        const street = [addr.road, addr.suburb, addr.neighbourhood, addr.residential].filter(Boolean).join(', ') || '';
                        const city = addr.city || addr.town || addr.village || addr.state_district || '';
                        const state = addr.state || '';

                        setShopSetup((f: any) => ({
                            ...f, address: street, city: city, state: state, pincode: addr.postcode || '',
                            location: { type: 'Point', coordinates: [lon, lat], address: data.display_name }
                        }));
                        toast('Location & Address mapped successfully!', 'success');
                    } else {
                        setShopSetup((f: any) => ({ ...f, location: { type: 'Point', coordinates: [lon, lat], address: 'Detected Location' } }));
                        toast('Coordinates mapped, but address details unavailable.', 'info');
                    }
                } catch (err) {
                    setShopSetup((f: any) => ({ ...f, location: { type: 'Point', coordinates: [lon, lat], address: 'Detected Location' } }));
                    toast('Coordinates mapped (Geocoding failed).', 'info');
                } finally {
                    setLoadingLocation(false);
                }
            },
            (err) => { toast('Failed to get location: ' + err.message, 'error'); setLoadingLocation(false); }
        );
    };

    const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const pin = e.target.value.replace(/\D/g, '');
        setShopSetup((f: any) => ({ ...f, pincode: pin }));

        if (pin.length === 6) {
            setLoadingPincode(true);
            try {
                const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                const data = await res.json();
                if (data?.[0]?.Status === 'Success') {
                    const postOffice = data[0].PostOffice[0];
                    setShopSetup((f: any) => ({ ...f, city: postOffice.District, state: postOffice.State }));
                    toast(`Mapped to ${postOffice.District}, ${postOffice.State}`, 'success');
                }
            } catch (err) { console.warn('Pincode lookup failed'); } finally { setLoadingPincode(false); }
        }
    };

    // Create shop for sellers who didn't set one up at registration
    const handleCreateShop = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopSetup.name.trim()) return toast('Shop name is required', 'error');
        setCreatingShop(true);
        try {
            let finalLocation = shopSetup.location;
            if (!finalLocation && shopSetup.address && shopSetup.city) {
                const queriesToTry = [
                    `${shopSetup.address}, ${shopSetup.city}, ${shopSetup.state}, ${shopSetup.pincode}, ${shopSetup.country}`,
                    `${shopSetup.address}, ${shopSetup.city}, ${shopSetup.state}`,
                    `${shopSetup.city}, ${shopSetup.state}, ${shopSetup.pincode}`,
                    `${shopSetup.city}, ${shopSetup.state}`,
                    shopSetup.city
                ];

                let found = false;
                for (const q of queriesToTry) {
                    if (!q || !q.trim()) continue;
                    try {
                        const query = encodeURIComponent(q);
                        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
                        const data = await response.json();
                        if (data && data.length > 0) {
                            finalLocation = { type: 'Point', coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)], address: data[0].display_name };
                            found = true;
                            break;
                        }
                    } catch { }
                }
            }
            const finalForm = {
                ...shopSetup,
                location: finalLocation || {
                    type: 'Point', coordinates: [0, 0],
                    address: `${shopSetup.address}, ${shopSetup.city}, ${shopSetup.state}, ${shopSetup.pincode}, ${shopSetup.country}`.replace(/, ,/g, ',').trim()
                }
            };

            const { data } = await api.post('/shops', finalForm);
            setShop(data.shop);
            setShopEdit({ name: data.shop.name, address: data.shop.location?.address || '', phone: data.shop.phone || '' });
            toast('Your shop is live! 🎉', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Failed to create shop', 'error');
        } finally {
            setCreatingShop(false);
        }
    };

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturing, setCapturing] = useState(false); // true while decoding a frame

    const stopScanner = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setScanning(false);
        setCapturing(false);
    };

    useEffect(() => { if (tab !== 'barcode') stopScanner(); }, [tab]);
    useEffect(() => () => { stopScanner(); }, []);

    const startBarcodeScanner = async () => {
        if (!videoRef.current) return;
        try {
            // Start a fresh camera stream each time — no ZXing continuous polling
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setScanning(true);
        } catch (err: any) {
            toast(err.message || 'Camera access denied', 'error');
        }
    };

    // Called when user clicks "Capture Barcode" — decode exactly one frame
    const captureAndDecode = async () => {
        if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
        setCapturing(true);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);

            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const reader = new BrowserMultiFormatReader();
            // decodeFromCanvas decodes ONE frame — no continuous loop, no buffer replay
            const result = reader.decodeFromCanvas(canvas);
            const code = result.getText();
            stopScanner();
            toast(`Barcode scanned: ${code} ✅. Checking details...`, 'info');

            try {
                const res = await api.post('/products/barcode/lookup', { barcode: code });
                if (res.data.found) {
                    // Show custom animated modal instead of window.confirm
                    setExistingProductPrompt({ isOpen: true, product: res.data.product, barcode: code });
                } else if (res.data.external && res.data.productData) {
                    setNewProduct(p => ({
                        ...p,
                        barcode: code,
                        name: res.data.productData.name || '',
                        category: res.data.productData.category || '',
                        description: res.data.productData.brand ? `Brand: ${res.data.productData.brand}` : '',
                        image: res.data.productData.image || ''
                    }));
                    toast('External product details found! Auto-filled form.', 'success');
                    setTab('inventory');
                } else {
                    setNewProduct(p => ({ ...p, barcode: code }));
                    toast('Product not found. Please enter details manually.', 'info');
                    setTab('inventory');
                }
            } catch (err: any) {
                setNewProduct(p => ({ ...p, barcode: code }));
                toast('Error checking barcode. Please enter details manually.', 'error');
                setTab('inventory');
            }
        } catch {
            toast('No barcode detected — try holding still and try again.', 'info');
        } finally {
            setCapturing(false);
        }
    };




    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setScanning(true);
        setCapturing(true);

        try {
            const url = URL.createObjectURL(file);
            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const reader = new BrowserMultiFormatReader();

            const result = await reader.decodeFromImageUrl(url);
            const code = result.getText();
            URL.revokeObjectURL(url);
            setScanning(false);
            setCapturing(false);

            toast(`Barcode found from image: ${code} ✅. Checking details...`, 'info');

            try {
                const res = await api.post('/products/barcode/lookup', { barcode: code });
                if (res.data.found) {
                    setExistingProductPrompt({ isOpen: true, product: res.data.product, barcode: code });
                } else if (res.data.external && res.data.productData) {
                    setNewProduct(p => ({
                        ...p,
                        barcode: code,
                        name: res.data.productData.name || '',
                        category: res.data.productData.category || '',
                        description: res.data.productData.brand ? `Brand: ${res.data.productData.brand}` : '',
                        image: res.data.productData.image || ''
                    }));
                    toast('External product details found! Auto-filled form.', 'success');
                    setTab('inventory');
                } else {
                    setNewProduct(p => ({ ...p, barcode: code }));
                    toast('Product not found. Please enter details manually.', 'info');
                    setTab('inventory');
                }
            } catch (err: any) {
                setNewProduct(p => ({ ...p, barcode: code }));
                toast('Error checking barcode. Please enter details manually.', 'error');
                setTab('inventory');
            }
        } catch {
            setScanning(false);
            setCapturing(false);
            toast('Failed to decode barcode from image. Please ensure the image is clear and try again.', 'error');
        }
    };

    const handlePromptAction = async (action: 'increase' | 'edit' | 'cancel') => {
        if (!existingProductPrompt) return;

        const { product, barcode } = existingProductPrompt;

        if (action === 'increase') {
            try {
                await api.post('/products/barcode/update', { barcode, stockDelta: 1 });
                setProducts(prev => prev.map(p => p._id === product._id ? { ...p, stock: p.stock + 1 } : p));
                toast(`Stock for ${product.name} increased by 1 ✅`, 'success');
            } catch (err: any) {
                toast(err?.response?.data?.message || 'Failed to update stock', 'error');
            }
        } else if (action === 'edit') {
            setNewProduct({
                ...product,
                price: product.price.toString(),
                stock: product.stock.toString(),
                expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : ''
            });
        }

        setExistingProductPrompt(null);
        setTab('inventory');
    };

    const handleEditGetLocation = () => {
        if (!navigator.geolocation) return toast('Geolocation is not supported by your browser', 'error');
        setEditingLocation(prev => ({ ...prev, loadingLoc: true }));
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude: lat, longitude: lon } = position.coords;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
                    const data = await res.json();
                    if (data && data.address) {
                        const addr = data.address;
                        const street = [addr.road, addr.suburb, addr.neighbourhood, addr.residential].filter(Boolean).join(', ') || '';
                        setShopEdit((f: any) => ({
                            ...f, address: street, city: addr.city || addr.town || addr.village || addr.state_district || '', state: addr.state || '', pincode: addr.postcode || '',
                            location: { type: 'Point', coordinates: [lon, lat], address: data.display_name, city: addr.city || addr.town || '', state: addr.state || '', pincode: addr.postcode || '', country: 'India' }
                        }));
                        toast('Location & Address mapped successfully!', 'success');
                    } else {
                        setShopEdit((f: any) => ({ ...f, location: { type: 'Point', coordinates: [lon, lat], address: 'Detected Location' } }));
                    }
                } catch {
                    setShopEdit((f: any) => ({ ...f, location: { type: 'Point', coordinates: [lon, lat], address: 'Detected Location' } }));
                } finally { setEditingLocation(prev => ({ ...prev, loadingLoc: false })); }
            },
            (err) => { toast('Failed to get location: ' + err.message, 'error'); setEditingLocation(prev => ({ ...prev, loadingLoc: false })); }
        );
    };

    const handleEditPincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const pin = e.target.value.replace(/\D/g, '');
        setShopEdit((f: any) => ({ ...f, pincode: pin }));
        if (pin.length === 6) {
            setEditingLocation(prev => ({ ...prev, loadingPin: true }));
            try {
                const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                const data = await res.json();
                if (data?.[0]?.Status === 'Success') {
                    const postOffice = data[0].PostOffice[0];
                    setShopEdit((f: any) => ({ ...f, city: postOffice.District, state: postOffice.State }));
                    toast(`Mapped to ${postOffice.District}, ${postOffice.State}`, 'success');
                }
            } catch { } finally { setEditingLocation(prev => ({ ...prev, loadingPin: false })); }
        }
    };

    const handleSaveShop = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingShop(true);
        try {
            let coords = shopEdit.location?.coordinates || [0, 0];

            if (!shopEdit.location || shopEdit.address !== shopEdit.location.address || shopEdit.city !== shopEdit.location.city || shopEdit.pincode !== shopEdit.location.pincode) {
                const queriesToTry = [
                    `${shopEdit.address}, ${shopEdit.city}, ${shopEdit.state}, ${shopEdit.pincode}`,
                    `${shopEdit.address}, ${shopEdit.city}, ${shopEdit.state}`,
                    `${shopEdit.city}, ${shopEdit.state}, ${shopEdit.pincode}`,
                    `${shopEdit.city}, ${shopEdit.state}`,
                    shopEdit.city
                ];

                let found = false;
                for (const q of queriesToTry) {
                    if (!q || !q.trim()) continue;
                    try {
                        const query = encodeURIComponent(q);
                        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
                        const data = await response.json();
                        if (data && data.length > 0) {
                            coords = [parseFloat(data[0].lon), parseFloat(data[0].lat)];
                            found = true;
                            break;
                        }
                    } catch { }
                }

                if (!found) {
                    toast('Warning: Could not pinpoint exact map coordinates for this address.', 'info');
                    coords = [0, 0]; // Reset so we don't accidentally match old coords
                }
            }

            const payload = {
                name: shopEdit.name,
                phone: shopEdit.phone,
                location: {
                    type: 'Point',
                    coordinates: coords,
                    address: shopEdit.address,
                    city: shopEdit.city,
                    state: shopEdit.state,
                    pincode: shopEdit.pincode,
                    country: 'India'
                }
            };

            const { data } = await api.put('/shops/my', payload);
            setShop(data.shop);
            toast('Shop updated! ✅', 'success');
        } catch (err: any) {
            toast(err?.response?.data?.message || 'Update failed', 'error');
        } finally {
            setSavingShop(false);
        }
    };

    // Storeboard logic
    const [storeboardData, setStoreboardData] = useState<any>({ fastestSelling: [], topRatedShops: [], heatmapData: [] });
    const [liveEvents, setLiveEvents] = useState<any[]>([]);

    useEffect(() => {
        if (tab === 'storeboard') {
            api.get('/admin/storeboard').then(r => setStoreboardData(r.data));
            const socket = io(SOCKET_URL);
            socket.on('newOrder', (data) => {
                setLiveEvents(prev => [{ ...data, id: Date.now() }, ...prev].slice(0, 10)); // Keep last 10
                // Re-fetch rankings on new order to keep charts strictly up-to-date
                api.get('/admin/storeboard').then(r => setStoreboardData(r.data));
            });
            return () => { socket.disconnect(); };
        }
    }, [tab, api]);

    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);

    // Today's stats
    const todayStr = new Date().toDateString();
    const todayOrders = orders.filter((o: any) => new Date(o.createdAt).toDateString() === todayStr);
    const todayRevenue = todayOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock < 5).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;

    const sidebarLinks = [
        { id: 'overview', icon: '📊', label: 'Overview' },
        { id: 'inventory', icon: '📦', label: 'Inventory' },
        { id: 'storeboard', icon: '⚡', label: 'Live Storeboard' },
        { id: 'orders', icon: '📋', label: 'Orders' },
        { id: 'barcode', icon: '🔲', label: 'Barcode Scanner' },
        { id: 'settings', icon: '⚙️', label: 'Shop Settings' },
    ];

    // ✅ FIX: If seller has no shop yet, show an onboarding setup screen
    if (!loading && !shop) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.08) 0%, transparent 60%)' }}>
                <div style={{ width: '100%', maxWidth: '460px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🏪</div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Set Up Your Shop</h1>
                        <p className="text-muted">You don&apos;t have a shop yet. Create one to start selling!</p>
                    </div>
                    <div className="card" style={{ padding: '32px' }}>
                        <form onSubmit={handleCreateShop} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Shop Name *</label>
                                <input className="form-input" placeholder="e.g. Ramesh General Store" value={shopSetup.name} onChange={e => setShopSetup((s: any) => ({ ...s, name: e.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-input" placeholder="+91 98765 43210" value={shopSetup.phone} onChange={e => setShopSetup((s: any) => ({ ...s, phone: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Street Address *</label>
                                <input className="form-input" placeholder="e.g. 12, MG Road, Landmark" value={shopSetup.address} onChange={e => setShopSetup((s: any) => ({ ...s, address: e.target.value }))} required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">PIN Code</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="form-input" placeholder="600001" value={shopSetup.pincode} onChange={handlePincodeChange} required maxLength={6} />
                                        {loadingPincode && <div className="spinner" style={{ position: 'absolute', right: '12px', top: '10px', width: '16px', height: '16px' }} />}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">City</label>
                                    <input className="form-input" placeholder="Bengaluru" value={shopSetup.city} onChange={e => setShopSetup((s: any) => ({ ...s, city: e.target.value }))} required />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="form-label">State</label>
                                    <input className="form-input" placeholder="Karnataka" value={shopSetup.state} onChange={e => setShopSetup((s: any) => ({ ...s, state: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Country</label>
                                    <input className="form-input" disabled value="India" />
                                </div>
                            </div>
                            <div className="form-group">
                                <button type="button" onClick={() => setShowMapSetup(true)} style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: shopSetup.location ? 'var(--accent-subtle)' : 'var(--bg-elevated)', border: `1px solid ${shopSetup.location ? 'var(--accent)' : 'var(--border)'}`, color: shopSetup.location ? 'var(--accent)' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, transition: 'var(--transition)' }}>
                                    {shopSetup.location ? '📍 Exact Coordinates Mapped' : '📍 Pinpoint Location on Map'}
                                </button>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>Pinpoint precision ensures you appear in nearby buyer searches.</p>
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg" disabled={creatingShop} style={{ marginTop: '8px' }}>
                                {creatingShop ? '⏳ Creating...' : '🚀 Launch My Shop'}
                            </button>
                        </form>
                    </div>
                </div>

                {showMapSetup && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-card)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowMapSetup(false)}>← Back</button>
                            <span style={{ fontWeight: 600 }}>Pinpoint Shop Location</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <MapPicker onConfirm={(loc) => {
                                setShopSetup((f: any) => ({
                                    ...f,
                                    address: loc.street || f.address || '',
                                    city: loc.city || f.city || '',
                                    state: loc.state || f.state || '',
                                    pincode: loc.pincode || f.pincode || '',
                                    location: {
                                        type: 'Point',
                                        coordinates: loc.coordinates,
                                        address: loc.address
                                    }
                                }));
                                setShowMapSetup(false);
                            }} buttonText="Confirm Shop Location" initialCoords={shopSetup.location?.coordinates || undefined} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="dashboard-layout">

            <aside className="sidebar">
                <div style={{ padding: '0 12px 20px' }}>
                    <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, #ff6b35, #f7c59f)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '12px' }}>
                        🏪
                    </div>
                    <div style={{ fontWeight: 700 }}>{shop?.name || 'My Shop'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                    <div className="badge badge-yellow" style={{ marginTop: '8px' }}>Seller</div>
                </div>
                <div className="sidebar-section-label">Manage</div>
                {sidebarLinks.map(l => (
                    <button key={l.id} onClick={() => setTab(l.id as any)} className={`sidebar-link ${tab === l.id ? 'active' : ''}`}>
                        <span className="link-icon">{l.icon}</span> {l.label}
                    </button>
                ))}
            </aside>

            <main className="dashboard-main">
                {loading ? <div style={{ textAlign: 'center', paddingTop: '20vh' }}><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
                    <>
                        {tab === 'overview' && (
                            <>
                                <div style={{ marginBottom: '28px' }}>
                                    <h1 style={{ fontSize: '1.75rem', marginBottom: '6px' }}>Seller Dashboard 🏪</h1>
                                    <p className="text-muted">{shop?.name} · {shop?.location?.address || 'No address set'}</p>
                                </div>

                                {/* Today's highlights */}
                                <div className="today-grid">
                                    <div className="today-card">
                                        <div className="today-icon green">📦</div>
                                        <div><div className="today-val">{todayOrders.length}</div><div className="today-lbl">Orders Today</div></div>
                                    </div>
                                    <div className="today-card">
                                        <div className="today-icon blue">💸</div>
                                        <div><div className="today-val">₹{todayRevenue.toFixed(0)}</div><div className="today-lbl">Revenue Today</div></div>
                                    </div>
                                    <div className="today-card">
                                        <div className="today-icon orange">⚠️</div>
                                        <div><div className="today-val">{lowStockCount}</div><div className="today-lbl">Low Stock Items</div></div>
                                    </div>
                                    <div className="today-card">
                                        <div className="today-icon red">❌</div>
                                        <div><div className="today-val">{outOfStockCount}</div><div className="today-lbl">Out of Stock</div></div>
                                    </div>
                                </div>

                                <div className="stats-grid" style={{ marginBottom: '28px' }}>
                                    <div className="stat-card"><div className="stat-icon orange">📦</div><div className="stat-label">Total Products</div><div className="stat-value">{products.length}</div></div>
                                    <div className="stat-card"><div className="stat-icon green">💰</div><div className="stat-label">Total Revenue</div><div className="stat-value">₹{totalRevenue.toFixed(0)}</div></div>
                                    <div className="stat-card"><div className="stat-icon blue">📋</div><div className="stat-label">Total Orders</div><div className="stat-value">{orders.length}</div></div>
                                    <div className="stat-card"><div className="stat-icon red">⚠️</div><div className="stat-label">Low Stock</div><div className="stat-value">{products.filter(p => p.stock < 5).length}</div></div>
                                </div>

                                {products.filter(p => p.stock < 5).length > 0 && (
                                    <div className="card" style={{ padding: '20px', marginBottom: '28px', borderLeft: '4px solid var(--danger)' }}>
                                        <h3 style={{ marginBottom: '16px', color: 'var(--danger)' }}>⚠️ Low Stock Alerts</h3>
                                        {products.filter(p => p.stock < 5).map(p => (
                                            <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                                <span style={{ fontWeight: 500 }}>{p.name} <span className="text-muted" style={{ fontSize: '0.8rem' }}>({p.category})</span></span>
                                                <span className="badge badge-red">{p.stock} remaining</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="card" style={{ padding: '20px' }}>
                                    <h3 style={{ marginBottom: '16px' }}>Top Products by Sales</h3>
                                    {products.sort((a, b) => b.salesCount - a.salesCount).slice(0, 5).map(p => (
                                        <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <span className="badge badge-green">{p.salesCount} sold</span>
                                                <span style={{ color: p.stock < 5 ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.8rem' }}>Stock: {p.stock}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {products.length === 0 && <p className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>No products yet. Add your first product!</p>}
                                </div>

                                {/* Recent orders */}
                                {orders.length > 0 && (
                                    <div className="card" style={{ padding: '20px', marginTop: '24px' }}>
                                        <h3 style={{ marginBottom: '16px' }}>🕐 Recent Orders</h3>
                                        {orders.slice(0, 5).map((o: any) => (
                                            <div key={o._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                                <div>
                                                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                                                        {o.buyerId?.name || 'Customer'} &nbsp;·&nbsp; {o.items?.length} item{o.items?.length !== 1 ? 's' : ''}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        {new Date(o.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{o.totalAmount?.toFixed(0)}</span>
                                                    <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>{o.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {tab === 'storeboard' && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h2>⚡ Live Storeboard</h2>
                                    <div className="badge badge-red" style={{ animation: 'pulse 1.5s infinite' }}>● LIVE</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
                                    {/* Left: Charts */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div className="card" style={{ padding: '24px' }}>
                                            <h3 style={{ marginBottom: '16px' }}>🔥 Fastest Selling Items across City</h3>
                                            <div style={{ height: 280, width: '100%' }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={storeboardData.fastestSelling} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                                        <XAxis type="number" hide />
                                                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                                                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                        <Bar dataKey="salesCount" radius={[0, 4, 4, 0]}>
                                                            {storeboardData.fastestSelling.map((entry: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ff6b35' : '#f7c59f'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="card" style={{ padding: '24px' }}>
                                            <h3 style={{ marginBottom: '16px' }}>⭐ Top Rated Shops</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {storeboardData.topRatedShops.map((s: any, i: number) => (
                                                    <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: i === 0 ? '#ff6b35' : 'var(--text-muted)' }}>#{i + 1}</div>
                                                            <div>
                                                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.city}</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ color: '#fbbf24', fontWeight: 700 }}>★ {s.rating}</div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.totalOrders} Orders</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Live Feed */}
                                    <div className="card" style={{ padding: '20px', background: 'var(--bg-card)', border: '2px solid var(--accent-subtle)' }}>
                                        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>📡 Live Feed {liveEvents.length > 0 && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {liveEvents.length === 0 ? (
                                                <div className="text-muted" style={{ padding: '20px', textAlign: 'center' }}>Waiting for new orders...</div>
                                            ) : (
                                                liveEvents.map((evt) => (
                                                    <div key={evt.id} style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', animation: 'slideIn 0.3s ease-out' }}>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                            Just now • Order #{evt.order?.slice(-6)}
                                                        </div>
                                                        <div style={{ fontWeight: 600, color: 'var(--accent)' }}>₹{evt.totalAmount?.toFixed(2)}</div>
                                                        <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                                                            {evt.shopGroups?.map((sg: any) => `${sg.items.length} items from ${sg.shopName || 'Shop'}`).join(' & ')}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Full Width: Money Map */}
                                <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <h3>🗺️ The Money Map</h3>
                                            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Geospatial heatmap of city-wide orders. See where demand is highest to plan your next dark store.</p>
                                        </div>
                                        <div className="badge badge-blue">Data Science</div>
                                    </div>
                                    <div style={{ width: '100%', height: 400, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        {storeboardData.heatmapData && storeboardData.heatmapData.length > 0 ? (
                                            <MoneyMap data={storeboardData.heatmapData} />
                                        ) : (
                                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                Loading geographical insights...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {tab === 'inventory' && (
                            <>
                                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h2>Inventory Management</h2>
                                </div>
                                {/* Add Product Form */}
                                <div className="card" style={{ marginBottom: '24px' }}>
                                    <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>
                                            {(newProduct as any)._id ? '✏️ Edit Product' : '➕ Add Product'}
                                            {newProduct.barcode && <span className="badge badge-green" style={{ marginLeft: 8 }}>Barcode: {newProduct.barcode}</span>}
                                        </span>
                                        {(newProduct as any)._id && (
                                            <button className="btn btn-secondary btn-sm" onClick={() => setNewProduct({ name: '', price: '', stock: '', category: '', unit: 'piece', weight: '', barcode: '', image: '', description: '', expiryDate: '' })}>Cancel Edit</button>
                                        )}
                                    </h3>

                                    {/* Product Image Preview Area */}
                                    <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'flex-start' }}>
                                        <div style={{
                                            width: '120px', height: '120px',
                                            borderRadius: 'var(--radius-md)',
                                            background: newProduct.image ? 'transparent' : 'var(--bg-elevated)',
                                            border: '2px dashed var(--border)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            overflow: 'hidden', flexShrink: 0
                                        }}>
                                            {newProduct.image ? (
                                                <img src={newProduct.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50" y="50" font-family="sans-serif" font-size="12" fill="%23888" text-anchor="middle" alignment-baseline="middle">Invalid Image</text></svg>'; }} />
                                            ) : (
                                                <div style={{ color: 'var(--text-muted)', fontSize: '2rem' }}>🖼️</div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Product Image URL (Optional)</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input className="form-input" placeholder="https://example.com/image.jpg" value={newProduct.image} onChange={e => setNewProduct(p => ({ ...p, image: e.target.value }))} />
                                                    {newProduct.image && <button type="button" className="btn btn-secondary" onClick={() => setNewProduct(p => ({ ...p, image: '' }))}>Clear</button>}
                                                </div>
                                                <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>Fetched automatically if picking up recognised barcodes, or enter your own.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <form onSubmit={handleAddProduct}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                            <div className="form-group"><label className="form-label">Product Name*</label><input className="form-input" placeholder="e.g. Wheat Flour" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} required /></div>
                                            <div className="form-group"><label className="form-label">Price (₹)*</label><input className="form-input" type="number" min="0" step="0.01" placeholder="49.99" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} required /></div>
                                            <div className="form-group"><label className="form-label">Stock (Pieces)*</label><input className="form-input" type="number" min="0" placeholder="100" value={newProduct.stock} onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} required /></div>
                                            <div className="form-group" style={{ position: 'relative' }}>
                                                <label className="form-label">Category*</label>
                                                <input
                                                    className="form-input"
                                                    placeholder="Select or type a category..."
                                                    value={newProduct.category}
                                                    onChange={e => {
                                                        setNewProduct(p => ({ ...p, category: e.target.value }));
                                                        setCatDropdownOpen(true);
                                                    }}
                                                    onFocus={() => setCatDropdownOpen(true)}
                                                    onBlur={() => setTimeout(() => setCatDropdownOpen(false), 200)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Escape') setCatDropdownOpen(false);
                                                        if (e.key === 'Enter' && catDropdownOpen) {
                                                            e.preventDefault();
                                                            const filtered = shopCategories.filter(c => c.toLowerCase().includes(newProduct.category.toLowerCase()));
                                                            if (filtered.length > 0) {
                                                                setNewProduct(p => ({ ...p, category: filtered[0] }));
                                                            }
                                                            setCatDropdownOpen(false);
                                                        }
                                                    }}
                                                    required
                                                    autoComplete="off"
                                                />
                                                {catDropdownOpen && (
                                                    <div style={{
                                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                                        maxHeight: '200px', overflowY: 'auto', marginTop: '4px'
                                                    }}>
                                                        {shopCategories
                                                            .filter(c => !newProduct.category || c.toLowerCase().includes(newProduct.category.toLowerCase()))
                                                            .map(c => (
                                                                <div key={c}
                                                                    onMouseDown={() => { setNewProduct(p => ({ ...p, category: c })); setCatDropdownOpen(false); }}
                                                                    style={{
                                                                        padding: '10px 14px', cursor: 'pointer', fontSize: '0.9rem',
                                                                        borderBottom: '1px solid var(--border)',
                                                                        transition: 'background 0.15s'
                                                                    }}
                                                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-subtle)')}
                                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                                >
                                                                    {c}
                                                                </div>
                                                            ))
                                                        }
                                                        {newProduct.category.trim() && !shopCategories.some(c => c.toLowerCase() === newProduct.category.toLowerCase()) && (
                                                            <div
                                                                onMouseDown={() => { setCatDropdownOpen(false); }}
                                                                style={{
                                                                    padding: '10px 14px', cursor: 'pointer', fontSize: '0.9rem',
                                                                    color: 'var(--accent)', fontWeight: 600,
                                                                    background: 'var(--accent-subtle)',
                                                                    borderTop: '2px solid var(--accent)'
                                                                }}
                                                            >
                                                                + Add &ldquo;{newProduct.category.trim()}&rdquo; as new category
                                                            </div>
                                                        )}
                                                        {!newProduct.category.trim() && shopCategories.length === 0 && (
                                                            <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                                No categories yet — type to create one
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Unit Type</label>
                                                <select className="form-select" value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))}>
                                                    {['piece', 'pack', 'box', 'dozen', 'kg', 'g', 'litre', 'ml'].map(u => <option key={u}>{u}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group"><label className="form-label">Weight/Volume per Item</label><input className="form-input" placeholder="e.g. 250g, 1L" value={newProduct.weight || ''} onChange={e => setNewProduct(p => ({ ...p, weight: e.target.value }))} /></div>
                                            <div className="form-group"><label className="form-label">Expiry Date (Optional)</label><input className="form-input" type="date" value={newProduct.expiryDate} onChange={e => setNewProduct(p => ({ ...p, expiryDate: e.target.value }))} /></div>
                                            <div className="form-group"><label className="form-label">Barcode (Optional)</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input className="form-input" placeholder="Scan or enter" value={newProduct.barcode} onChange={e => setNewProduct(p => ({ ...p, barcode: e.target.value }))} />
                                                    <button type="button" className="btn btn-secondary" onClick={generateDemoBarcode} title="Generate Demo Barcode">🎲</button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: '16px' }}><label className="form-label">Description</label><input className="form-input" placeholder="Brief product description..." value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} /></div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button type="submit" className="btn btn-primary">{(newProduct as any)._id ? 'Update Product' : 'Add Product'}</button>
                                            <button type="button" className="btn btn-secondary" onClick={() => setTab('barcode')}>🔲 Scan Barcode</button>
                                        </div>
                                    </form>
                                </div>

                                {/* Products Table */}
                                <div className="card" style={{ padding: 0 }}>
                                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                                        <h3>All Products ({products.length})</h3>
                                    </div>
                                    <div className="table-wrap">
                                        <table className="table">
                                            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Sold</th><th>Actions</th></tr></thead>
                                            <tbody>
                                                {products.map(p => (
                                                    <tr key={p._id}>
                                                        <td style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            {p.image ? (
                                                                <img src={p.image} alt={p.name} style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'contain', background: 'var(--bg-elevated)' }} />
                                                            ) : (
                                                                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📦</div>
                                                            )}
                                                            <div>
                                                                <div style={{ fontWeight: 500 }}>{p.name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                    {p.weight && <span>{p.weight}</span>}
                                                                    {p.weight && p.expiryDate && <span> • </span>}
                                                                    {p.expiryDate && <span>Exp: {new Date(p.expiryDate).toLocaleDateString()}</span>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td><span className="badge badge-blue">{p.category}</span></td>
                                                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{p.price}</td>
                                                        <td><span style={{ color: p.stock < 5 ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 600 }}>{p.stock} units</span></td>
                                                        <td>{p.salesCount}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    className="btn btn-secondary btn-sm"
                                                                    onClick={() => {
                                                                        setNewProduct({
                                                                            _id: p._id,
                                                                            name: p.name,
                                                                            price: p.price.toString(),
                                                                            stock: p.stock.toString(),
                                                                            category: p.category,
                                                                            unit: p.unit || 'piece',
                                                                            weight: p.weight || '',
                                                                            barcode: p.barcode || '',
                                                                            image: p.image || '',
                                                                            description: p.description || '',
                                                                            expiryDate: p.expiryDate ? new Date(p.expiryDate).toISOString().split('T')[0] : ''
                                                                        } as any);
                                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                    }}
                                                                >
                                                                    ✏️ Edit
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm"
                                                                    style={{ color: 'var(--danger)', border: '1px solid var(--danger)', background: 'transparent' }}
                                                                    onClick={() => handleDeleteProduct(p._id, p.name)}
                                                                >
                                                                    🗑️ Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {products.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No products yet</div>}
                                    </div>
                                </div>
                            </>
                        )}

                        {tab === 'orders' && (
                            <>
                                <h2 style={{ marginBottom: '24px' }}>Shop Orders</h2>
                                <div className="card" style={{ padding: 0 }}>
                                    <div className="table-wrap">
                                        <table className="table">
                                            <thead><tr><th>Order ID</th><th>Buyer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                                            <tbody>
                                                {orders.map(o => (
                                                    <tr key={o._id}>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>#{o._id.slice(-8)}</td>
                                                        <td>{o.buyerId?.name || 'Customer'}</td>
                                                        <td>{o.items?.length} items</td>
                                                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{o.totalAmount?.toFixed(2)}</td>
                                                        <td><span className="badge badge-green">{o.status}</span></td>
                                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {orders.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No orders yet</div>}
                                    </div>
                                </div>
                            </>
                        )}

                        {tab === 'barcode' && (
                            <div className="tab-content-centered">
                                <h2 style={{ marginBottom: '24px' }}>🔲 Barcode Scanner</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '24px', alignItems: 'start' }}>
                                    {/* Scanner card */}
                                    <div className="card" style={{ padding: '24px' }}>
                                        <h3 style={{ marginBottom: '8px' }}>Scan Product Barcode</h3>
                                        <p className="text-muted" style={{ marginBottom: '20px', fontSize: '0.875rem' }}>
                                            Start the camera, point it at the barcode, then click <strong>Capture</strong> when it&apos;s in frame.
                                        </p>

                                        {/* Live camera preview */}
                                        <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', border: scanning ? '2px solid var(--accent)' : '2px solid var(--border)', transition: 'border-color 0.3s' }}>
                                            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanning ? 'block' : 'none' }} />
                                            {!scanning && <span style={{ fontSize: '3.5rem', opacity: 0.4 }}>🔲</span>}
                                            {scanning && (
                                                <>
                                                    {/* Animated sweep line */}
                                                    <div className="scanner-sweep-line" />
                                                    {/* Corner marks */}
                                                    <div className="scanner-corner sc-tl" />
                                                    <div className="scanner-corner sc-tr" />
                                                    <div className="scanner-corner sc-bl" />
                                                    <div className="scanner-corner sc-br" />
                                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px', background: 'rgba(0,0,0,0.55)', textAlign: 'center', fontSize: '0.75rem', color: '#fff' }}>
                                                        Aim at barcode · click Capture when ready
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Hidden canvas */}
                                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            {!scanning ? (
                                                <>
                                                    <button className="btn btn-primary" onClick={startBarcodeScanner}>📷 Start Camera</button>
                                                    <span className="text-muted" style={{ fontSize: '0.875rem' }}>or</span>
                                                    <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                                                        📁 Upload Image
                                                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                                                    </label>
                                                </>
                                            ) : (
                                                <>
                                                    <button className="btn btn-primary" onClick={captureAndDecode} disabled={capturing} style={{ flex: 2 }}>
                                                        {capturing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing...</> : '📸 Capture'}
                                                    </button>
                                                    <button className="btn btn-danger" onClick={stopScanner}>⏹ Stop</button>
                                                </>
                                            )}
                                            <button className="btn btn-secondary" onClick={() => { stopScanner(); setTab('inventory'); }} style={{ marginLeft: scanning ? 0 : 'auto' }}>← Back to Inventory</button>
                                        </div>
                                    </div>

                                    {/* Tips / instructions panel */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div className="card" style={{ padding: '20px', borderLeft: '3px solid var(--accent)' }}>
                                            <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.3rem' }}>💡</span> Scan Tips
                                            </h4>
                                            {[
                                                'Hold the camera ~15–20 cm from the barcode.',
                                                'Ensure good lighting — avoid shadows on the barcode.',
                                                'Keep the phone/camera steady before clicking Capture.',
                                                'If the scan fails, try uploading a clear photo instead.',
                                            ].map((tip, i) => (
                                                <div key={i} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem' }}>
                                                    <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                                                    <span>{tip}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="card" style={{ padding: '20px' }}>
                                            <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.3rem' }}>📑</span> Supported Formats
                                            </h4>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'Code 128', 'Code 39', 'QR Code', 'PDF417'].map(fmt => (
                                                    <span key={fmt} className="badge badge-blue" style={{ fontSize: '0.72rem' }}>{fmt}</span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="card" style={{ padding: '20px', background: 'var(--accent-subtle)', border: '1px solid rgba(0,210,106,0.2)' }}>
                                            <h4 style={{ marginBottom: '8px', color: 'var(--accent)' }}>🧠 What happens after scan?</h4>
                                            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                                We look up the barcode in our database first. If found, you can update stock instantly. If new, we try to auto-fill product details from external sources. If nothing matches, you manually enter details.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {tab === 'settings' && (
                            <div className="tab-content-centered">
                                <h2 style={{ marginBottom: '24px' }}>⚙️ Shop Settings</h2>
                                <div className="card" style={{ maxWidth: '520px' }}>
                                    <h3 style={{ marginBottom: '20px' }}>Edit Shop Profile</h3>
                                    <form onSubmit={handleSaveShop} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Shop Name</label>
                                            <input className="form-input" value={shopEdit.name} onChange={e => setShopEdit((s: any) => ({ ...s, name: e.target.value }))} placeholder="e.g. Ramesh General Store" required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Phone</label>
                                            <input className="form-input" value={shopEdit.phone} onChange={e => setShopEdit((s: any) => ({ ...s, phone: e.target.value }))} placeholder="+91 98765 43210" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Shop / Street Address</label>
                                            <input className="form-input" value={shopEdit.address} onChange={e => setShopEdit((s: any) => ({ ...s, address: e.target.value }))} placeholder="123 Main Street, Bengaluru" required />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                                            <div className="form-group">
                                                <label className="form-label">PIN Code</label>
                                                <div style={{ position: 'relative' }}>
                                                    <input className="form-input" placeholder="600001" value={shopEdit.pincode} onChange={handleEditPincodeChange} required maxLength={6} />
                                                    {editingLocation.loadingPin && <div className="spinner" style={{ position: 'absolute', right: '12px', top: '10px', width: '16px', height: '16px' }} />}
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">City</label>
                                                <input className="form-input" placeholder="Bengaluru" value={shopEdit.city} onChange={e => setShopEdit((s: any) => ({ ...s, city: e.target.value }))} required />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">State</label>
                                            <input className="form-input" placeholder="Karnataka" value={shopEdit.state} onChange={e => setShopEdit((s: any) => ({ ...s, state: e.target.value }))} required />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: '16px' }}>
                                            <label className="form-label">Exact GPS Location</label>
                                            <button type="button" onClick={() => setShowMapEdit(true)} style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', background: shopEdit.location ? 'var(--accent-subtle)' : 'var(--bg-elevated)', border: `1px solid ${shopEdit.location ? 'var(--accent)' : 'var(--border)'}`, color: shopEdit.location ? 'var(--accent)' : 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, transition: 'var(--transition)' }}>
                                                {shopEdit.location ? '📍 Coordinates Mapped' : '📍 Pinpoint Location on Map'}
                                            </button>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>Pinpoint precision ensures you only receive orders from nearby buyers.</p>
                                        </div>

                                        <button type="submit" className="btn btn-primary" disabled={savingShop}>
                                            {savingShop ? '⏳ Saving...' : '💾 Save Changes'}
                                        </button>
                                    </form>
                                </div>

                                {/* Face ID Enrollment */}
                                <div className="card" style={{ maxWidth: '520px', marginTop: '24px' }}>
                                    <h3 style={{ marginBottom: '8px' }}>🪪 Face ID Setup</h3>
                                    <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '20px' }}>Enroll or update your Face ID to allow instant camera-based login to your seller dashboard.</p>
                                    <FaceRegister userRole="seller" onSkip={() => { }} />
                                </div>

                                {/* Danger Zone */}
                                <div className="card" style={{ maxWidth: '520px', marginTop: '24px', border: '1px solid var(--danger, #ff5252)' }}>
                                    <h3 style={{ marginBottom: '8px', color: 'var(--danger, #ff5252)' }}>⚠️ Danger Zone</h3>
                                    <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '20px' }}>
                                        Permanently delete your seller account and shop. All products and orders will be removed. This action <strong>cannot be undone</strong>.
                                    </p>
                                    <button
                                        className="btn"
                                        style={{ background: 'var(--danger, #ff5252)', color: '#fff', border: 'none' }}
                                        onClick={async () => {
                                            const deleted = await deleteAccount();
                                            if (deleted) { toast('Account deleted', 'success'); router.replace('/'); }
                                            else toast('Account deletion failed', 'error');
                                        }}
                                    >
                                        🗑️ Delete Account & Shop
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
            {existingProductPrompt && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'var(--bg-card)', padding: '32px', borderRadius: 'var(--radius-lg)',
                        maxWidth: '440px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        border: '1px solid var(--border)', animation: 'slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255, 107, 53, 0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                                📦
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Product Already Exists</h2>
                                <p className="text-muted" style={{ fontSize: '0.875rem' }}>Barcode: {existingProductPrompt.barcode}</p>
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                            {existingProductPrompt.product.image && (
                                <img src={existingProductPrompt.product.image} alt="Product" style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} />
                            )}
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{existingProductPrompt.product.name}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    Current Stock: <strong style={{ color: 'var(--text-primary)' }}>{existingProductPrompt.product.stock} units</strong>
                                </div>
                            </div>
                        </div>

                        <p style={{ marginBottom: '24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
                            Would you like to instantly increase the stock by 1, or edit the full details of this product manually?
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button className="btn btn-primary btn-lg" onClick={() => handlePromptAction('increase')} style={{ width: '100%', justifyContent: 'center' }}>
                                ➕ Fast Stock (+1)
                            </button>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-secondary" onClick={() => handlePromptAction('edit')} style={{ flex: 1, justifyContent: 'center' }}>
                                    ✏️ Edit Details
                                </button>
                                <button className="btn" onClick={() => handlePromptAction('cancel')} style={{ flex: 1, justifyContent: 'center', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Add required keyframes if not globally available, usually better to put in globals.css, but for encapsulation we use inline style tag */}
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @keyframes slideUpModal {
                            from { opacity: 0; transform: translateY(20px) scale(0.98); }
                            to { opacity: 1; transform: translateY(0) scale(1); }
                        }
                    `}} />
                </div>
            )}

            {showMapEdit && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-card)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowMapEdit(false)}>← Back</button>
                        <span style={{ fontWeight: 600 }}>Update Shop Location</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <MapPicker onConfirm={(loc) => {
                            setShopEdit((f: any) => ({
                                ...f,
                                address: loc.street || f.address || '',
                                city: loc.city || f.city || '',
                                state: loc.state || f.state || '',
                                pincode: loc.pincode || f.pincode || '',
                                location: {
                                    type: 'Point',
                                    coordinates: loc.coordinates,
                                    address: loc.address
                                }
                            }));
                            setShowMapEdit(false);
                            toast('Location updated on map! Save changes below.', 'success');
                        }} buttonText="Confirm Location" initialCoords={shopEdit.location?.coordinates || undefined} />
                    </div>
                </div>
            )}
        </div>
    );
}
