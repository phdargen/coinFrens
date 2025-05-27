"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { BottomNavigation } from "./BottomNavigation";

interface AppWrapperProps {
  children: React.ReactNode;
}

export function AppWrapper({ children }: AppWrapperProps) {
  const { setFrameReady, isFrameReady } = useMiniKit();
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'completed'>('join');
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Update active tab based on current route
  useEffect(() => {
    if (pathname === '/') {
      setActiveTab('join');
    } else if (pathname === '/create') {
      setActiveTab('create');
    } else if (pathname.startsWith('/join/')) {
      setActiveTab('join');
    } else if (pathname === '/completed') {
      setActiveTab('completed');
    }
  }, [pathname]);

  // Handle tab changes and navigate accordingly
  const handleTabChange = (tab: 'create' | 'join' | 'completed') => {
    setActiveTab(tab);
    if (tab === 'create') {
      router.push('/create');
    } else if (tab === 'join') {
      router.push('/');
    } else if (tab === 'completed') {
      router.push('/completed');
    }
  };

  // Show navigation on main pages and join pages, but not on session pages
  // Only show after mounted and frame is ready
  const showNavigation = !pathname.startsWith('/session/') && mounted && isFrameReady;

  return (
    <>
      {children}
      
      {showNavigation && (
        <BottomNavigation 
          activeTab={activeTab} 
          setActiveTab={handleTabChange}
        />
      )}
    </>
  );
} 