"use client";

import { Button } from "@/components/ui/button";
import { Plus, Users, Trophy } from "lucide-react";

interface BottomNavigationProps {
  activeTab: 'create' | 'join' | 'completed';
  setActiveTab: (tab: 'create' | 'join' | 'completed') => void;
}

export function BottomNavigation({ activeTab, setActiveTab }: BottomNavigationProps) {
  const handleTabClick = (tab: 'create' | 'join' | 'completed') => {
    console.log('Tab clicked:', tab);
    setActiveTab(tab);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border shadow-lg">
      <div className="max-w-md mx-auto px-4 py-3">
        <nav className="grid grid-cols-3 gap-1">
          <Button
            variant={activeTab === 'join' ? 'default' : 'ghost'}
            onClick={() => handleTabClick('join')}
            className="flex flex-col items-center justify-center h-14 space-y-1"
          >
            <Users className="h-5 w-5" />
            <span className="text-xs font-medium">Join</span>
          </Button>
          
          <Button
            variant={activeTab === 'create' ? 'default' : 'ghost'}
            onClick={() => handleTabClick('create')}
            className="flex flex-col items-center justify-center h-14 space-y-1"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-medium">Create</span>
          </Button>

          <Button
            variant={activeTab === 'completed' ? 'default' : 'ghost'}
            onClick={() => handleTabClick('completed')}
            className="flex flex-col items-center justify-center h-14 space-y-1"
          >
            <Trophy className="h-5 w-5" />
            <span className="text-xs font-medium">Gallery</span>
          </Button>
        </nav>
      </div>
    </div>
  );
} 