'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import Navbar from '@/components/Navbar';
import CartSidebar from '@/components/CartSidebar';
import BuyerDashboard from '@/components/BuyerDashboard';
import SellerDashboard from '@/components/SellerDashboard';

export default function DashboardPage() {
    const { user } = useApp();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.replace('/login');
    }, [user, router]);

    if (!user) return null;

    return (
        <>
            <Navbar />
            {user.role === 'buyer' ? <><BuyerDashboard /><CartSidebar /></> : <SellerDashboard />}
        </>
    );
}
