"use client";

import { Header } from "../components/Header";
import { JoinPage } from "../components/JoinPage";

export default function JoinPageRoute() {
  return (
    <main className="min-h-screen bg-background dark:bg-background">
      <div className="flex min-h-screen flex-col items-center p-4">
        <div className="max-w-md w-full space-y-8 pb-24">
          {/* Header with logo and user identity */}
          <Header />
          
          {/* Join content */}
          <JoinPage />
        </div>
      </div>
    </main>
  );
} 