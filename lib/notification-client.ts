import {
  type FrameNotificationDetails,
  type SendNotificationRequest,
  sendNotificationResponseSchema,
} from "@farcaster/frame-core";
import { getUserNotificationDetails } from "@/lib/notification";

const appUrl = process.env.NEXT_PUBLIC_URL || "";

type SendFrameNotificationResult =
  | {
      state: "error";
      error: unknown;
    }
  | { state: "no_token" }
  | { state: "rate_limit" }
  | { state: "success" };

export async function sendFrameNotification({
  fid,
  title,
  body,
  notificationDetails,
}: {
  fid: number;
  title: string;
  body: string;
  notificationDetails?: FrameNotificationDetails | null;
}): Promise<SendFrameNotificationResult> {
  if (!notificationDetails) {
    notificationDetails = await getUserNotificationDetails(fid);
  }
  if (!notificationDetails) {
    return { state: "no_token" };
  }

  const response = await fetch(notificationDetails.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notificationId: crypto.randomUUID(),
      title,
      body,
      targetUrl: appUrl,
      tokens: [notificationDetails.token],
    } satisfies SendNotificationRequest),
  });

  const responseJson = await response.json();

  if (response.status === 200) {
    const responseBody = sendNotificationResponseSchema.safeParse(responseJson);
    if (responseBody.success === false) {
      return { state: "error", error: responseBody.error.errors };
    }

    if (responseBody.data.result.rateLimitedTokens.length) {
      return { state: "rate_limit" };
    }

    return { state: "success" };
  }

  return { state: "error", error: responseJson };
}

export async function sendBatchNotifications({
  fids,
  title,
  body,
}: {
  fids: number[];
  title: string;
  body: string;
}): Promise<{
  success: number;
  frequencyLimited: number;
  notificationsDisabled: number;
  failed: number;
}> {
  const results = await Promise.allSettled(
    fids.map(fid => sendFrameNotification({ 
      fid, 
      title, 
      body, 
    }))
  );
  
  const success = results.filter(
    result => result.status === 'fulfilled' && result.value.state === 'success'
  ).length;
  
  const frequencyLimited = results.filter(
    result => result.status === 'fulfilled' && result.value.state === 'rate_limit'
  ).length;

  const notificationsDisabled = results.filter(
    result => result.status === 'fulfilled' && result.value.state === 'no_token'
  ).length;
  
  return {
    success,
    frequencyLimited,
    notificationsDisabled,
    failed: fids.length - success - frequencyLimited - notificationsDisabled
  };
}
