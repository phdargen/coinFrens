"use client";

import { Button } from "@/components/ui/button";
import { Plus, Users, Trophy } from "lucide-react";

interface BottomNavigationProps {
  activeTab: 'create' | 'join' | 'completed';
  setActiveTab: (tab: 'create' | 'join' | 'completed') => void;
}

export function BottomNavigation({ activeTab, setActiveTab }: BottomNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-border p-4">
      <div className="max-w-md mx-auto">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={activeTab === 'create' ? 'default' : 'outline'}
            onClick={() => setActiveTab('create')}
            className="flex-1 gap-2 text-xs"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Create
          </Button>
          <Button
            variant={activeTab === 'join' ? 'default' : 'outline'}
            onClick={() => setActiveTab('join')}
            className="flex-1 gap-2 text-xs"
            size="sm"
          >
            <Users className="h-4 w-4" />
            Join
          </Button>
          <Button
            variant={activeTab === 'completed' ? 'default' : 'outline'}
            onClick={() => setActiveTab('completed')}
            className="flex-1 gap-2 text-xs"
            size="sm"
          >
            <Trophy className="h-4 w-4" />
            Gallery
          </Button>
        </div>
      </div>
    </div>
  );
} 