"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";
import { getFarcasterUserId, getFarcasterUsername } from "@/lib/farcaster-utils";
import { MAX_PROMPT_LENGTH, SESSION_STYLES } from "@/src/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Sparkles, Image as ImageIcon, ShieldQuestion, BarChartBig } from "lucide-react";
import { AddFramePopup } from "./AddFramePopup";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export function CreateSession() {
  const { context } = useMiniKit();
  const { isConnected, address } = useAccount();
  const [prompt, setPrompt] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConnectWalletPrompt, setShowConnectWalletPrompt] = useState(false);
  const [showAddFramePopup, setShowAddFramePopup] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const router = useRouter();
  
  // New state variables for additional settings
  const [addPfps, setAddPfps] = useState(false);
  const [style, setStyle] = useState<typeof SESSION_STYLES[number]>(SESSION_STYLES[0]);
  const [customStyle, setCustomStyle] = useState("");
  const [allowedToJoin, setAllowedToJoin] = useState("all");
  const [minTalentScore, setMinTalentScore] = useState<number | "">("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    
    if (prompt.length > MAX_PROMPT_LENGTH) {
      setError(`Prompt must be ${MAX_PROMPT_LENGTH} characters or less`);
      return;
    }
    
    if (style === "Custom" && !customStyle.trim()) {
      setError("Please enter a custom style description or select a predefined style.");
      return;
    }
    
    // Require both wallet connection and Farcaster context
    if (!address || !context) {
      setShowConnectWalletPrompt(true);
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Use utility functions to get ID and username
      const fid = context ? getFarcasterUserId(context) : `wallet-${address}`;
      const username = context ? getFarcasterUsername(context) : address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : undefined;
      const pfpUrl = context?.user?.pfpUrl;
      
      if (!fid) {
        throw new Error("Could not identify your account");
      }
      
      // Create session via API
      const sessionResponse = await fetch("/api/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creatorFid: fid,
          creatorName: username,
          maxParticipants,
          prompt,
          address: address || undefined,
          pfpUrl,
          addPfps,
          style: style === "Custom" ? customStyle : style,
          allowedToJoin,
          minTalentScore: minTalentScore === "" ? null : Number(minTalentScore),
        }),
      });
      
      const sessionData = await sessionResponse.json();
      
      if (!sessionData.success || !sessionData.session) {
        throw new Error(sessionData.error || "Failed to create session");
      }
      
      const session = sessionData.session;
      console.log("Session created:", session);
      
      // Check if frame is already added
      const isFrameAdded = context?.client?.added;
      
      if (isFrameAdded) {
        // Frame already added, redirect directly
        router.push(`/session/${session.id}`);
      } else {
        // Frame not added, show popup
        setCreatedSessionId(session.id);
        setShowAddFramePopup(true);
      }
    } catch (err) {
      console.error("Error creating session:", err);
      setError(err instanceof Error ? err.message : "Failed to create session. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePopupClose = () => {
    setShowAddFramePopup(false);
    if (createdSessionId) {
      router.push(`/session/${createdSessionId}`);
    }
  };

  return (
    <Card className="border bg-card">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Start a Jam Session
          <Sparkles className="h-5 w-5 text-primary" />
        </CardTitle>
        
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Textarea
              id="prompt"
              placeholder="Enter your part of the coin prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={MAX_PROMPT_LENGTH}
              rows={3}
              required
              className="resize-none bg-muted/50"
            />
            <p className="text-sm text-muted-foreground">
              This will be combined with other participants&apos; prompts to AI-generate your coin.
            </p>
          </div>

          {/* Style Select */}
          <div className="space-y-2">
            <Label htmlFor="style" className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Art style for image generation
            </Label>
            <Select
              value={style}
              onValueChange={(value) => setStyle(value as typeof SESSION_STYLES[number])}
            >
              <SelectTrigger className="bg-muted/50">
                <SelectValue placeholder="Select a style" />
              </SelectTrigger>
              <SelectContent>
                {SESSION_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>{s === "None" ? "Default (None)" : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {style === "Custom" && (
              <Input
                id="custom-style"
                placeholder="Describe your custom style (e.g., 'Steampunk, vibrant colors')"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                className="mt-2 bg-muted/50"
              />
            )}
          </div>

          {/* Add Pfps Switch */}
          <div className="flex items-center justify-between space-y-2 pt-2">
            <Label htmlFor="add-pfps" className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Add PFPs to image prompt
            </Label>
            <Switch
              id="add-pfps"
              checked={addPfps}
              onCheckedChange={setAddPfps}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="participants" className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Number of Frens
            </Label>
            <Select
              value={maxParticipants.toString()}
              onValueChange={(value) => setMaxParticipants(parseInt(value))}
            >
              <SelectTrigger className="bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Frens</SelectItem>
                <SelectItem value="3">3 Frens</SelectItem>
                <SelectItem value="4">4 Frens</SelectItem>
                <SelectItem value="5">5 Frens</SelectItem>
                <SelectItem value="6">6 Frens</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Allowed to Join Select */}
          <div className="space-y-2">
            <Label htmlFor="allowed-to-join" className="text-sm font-medium flex items-center gap-2">
              <ShieldQuestion className="h-4 w-4" />
              Who can join?
            </Label>
            <Select
              value={allowedToJoin}
              onValueChange={setAllowedToJoin}
            >
              <SelectTrigger className="bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                <SelectItem value="followers">Your followers</SelectItem>
                <SelectItem value="following">Accounts you follow</SelectItem>
                <SelectItem value="frens">Frens (followers + following)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min Talent Score Input */}
          {/* <div className="space-y-2">
            <Label htmlFor="min-talent-score" className="text-sm font-medium flex items-center gap-2">
              <BarChartBig className="h-4 w-4" />
              Minimum Talent Score (Optional)
            </Label>
            <Input
              id="min-talent-score"
              type="number"
              placeholder="e.g., 100"
              value={minTalentScore}
              onChange={(e) => setMinTalentScore(e.target.value === "" ? "" : Number(e.target.value))}
              min="0"
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank if no minimum score is required.
            </p>
          </div> */}
          
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Creating...
              </>
            ) : (
              <>
                Create 🚀
              </> 
            )}
          </Button>
          
        </form>
      </CardContent>

      {showConnectWalletPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm text-center shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Connection Required</h3>
            <p className="text-muted-foreground mb-6">
              Please connect both your wallet and Farcaster account to create a session.
            </p>
            <Button onClick={() => setShowConnectWalletPrompt(false)} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        </div>
      )}

          <AddFramePopup 
          isOpen={showAddFramePopup}
          onClose={handlePopupClose}
        />
    </Card>
  );
} 