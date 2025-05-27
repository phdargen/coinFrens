"use client";

import { useState, useCallback } from "react";
import { useMiniKit, useAddFrame } from "@coinbase/onchainkit/minikit";
import { Button } from "@/components/ui/button";
import { X, Smartphone } from "lucide-react";

interface AddFramePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFramePopup({ isOpen, onClose }: AddFramePopupProps) {
  const { context } = useMiniKit();
  const addFrame = useAddFrame();
  const [isLoading, setIsLoading] = useState(false);

  const isFrameAdded = context?.client?.added;

  const handleAddFrame = useCallback(async () => {
    try {
      setIsLoading(true);
      const frameAdded = await addFrame();
      
      // Close popup directly after successful save
      if (frameAdded) {
        onClose();
      }
    } catch (error) {
      console.error("Error adding frame:", error);
    } finally {
      setIsLoading(false);
    }
  }, [addFrame, onClose]);

  // Don't show popup if frame is already added or if not open
  if (!isOpen || isFrameAdded) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm text-center shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 h-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4">
          <div className="bg-primary/10 p-3 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-foreground">
            Save app
          </h3>
          <p className="text-muted-foreground mb-6 text-sm">
            Get notified when your coin launches 🚀
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleAddFrame}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 