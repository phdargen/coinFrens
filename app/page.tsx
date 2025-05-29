"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Header } from "./components/Header";
import { LoadingComponent } from "./components/UIComponents";
import { JoinPage } from "./components/JoinPage";

// Dynamic import for CreateSession component
const CreateSession = dynamic(() => import('./components/CreateSession').then(mod => ({ default: mod.CreateSession })), {
  loading: () => <LoadingComponent text="Loading..." />,
  ssr: false
});

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a loading state during SSR/before hydration
  if (!mounted) {
    return <LoadingComponent text="Loading CoinJam..." />;
  }

  return (
    <main className="min-h-screen bg-background dark:bg-background">
      <div className="flex min-h-screen flex-col items-center p-4">
        <div className="max-w-md w-full space-y-4 pb-24">
          {/* Header with logo and user identity */}
          <Header />
          
          {/* Show Join page as the main landing page */}
          <JoinPage />
        </div>
      </div>
    </main>
  );
}
