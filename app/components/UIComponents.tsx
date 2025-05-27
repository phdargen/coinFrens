import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";

export function LoadingComponent({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen bg-background dark:bg-background flex items-center justify-center p-4">
      <Card className="border bg-card">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <Image 
                src="/coinFrens.png" 
                alt="CoinFrens Logo" 
                width={64} 
                height={64}
                className="h-16 w-16 animate-pulse"
              />
            </div>
            <p className="text-muted-foreground">{text}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ErrorComponent({ message = "An error occurred" }: { message: string }) {
  return (
    <div className="min-h-screen bg-background dark:bg-background flex items-center justify-center p-4">
      <Card className="border bg-card max-w-sm mx-auto">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-destructive/10 p-3 rounded-full">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
} 