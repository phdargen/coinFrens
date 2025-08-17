"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Header } from "./components/Header";
import { LoadingComponent } from "./components/UIComponents";
import { JoinPage } from "./components/JoinPage";
import { BottomNavigation } from "./components/BottomNavigation";

// Dynamic imports for tab components
const CreateSession = dynamic(() => import('./components/CreateSession').then(mod => ({ default: mod.CreateSession })), {
  loading: () => <LoadingComponent text="Loading..." />,
  ssr: false
});

const CompletedCoinsPage = dynamic(() => import('./components/CompletedCoinsPage').then(mod => ({ default: mod.CompletedCoinsPage })), {
  loading: () => <LoadingComponent text="Loading..." />,
  ssr: false
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'completed'>('join');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a loading state during SSR/before hydration
  if (!mounted) {
    return <LoadingComponent text="Loading CoinJam..." />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'join':
        return <JoinPage />;
      case 'create':
        return <CreateSession />;
      case 'completed':
        return <CompletedCoinsPage />;
      default:
        return <JoinPage />;
    }
  };

  return (
    <main className="min-h-screen bg-background dark:bg-background">
      <div className="flex min-h-screen flex-col items-center p-4">
        <div className="max-w-md w-full space-y-4 pb-24">
          {/* Header with logo and user identity */}
          <Header />
          
          {/* Render content based on active tab */}
          {renderTabContent()}
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <BottomNavigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
      />
    </main>
  );
}
