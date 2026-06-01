import Pusher from 'pusher';

const PUSHER_APP_ID = process.env.PUSHER_APP_ID;
const NEXT_PUBLIC_PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_SECRET = process.env.PUSHER_SECRET;
const NEXT_PUBLIC_PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

let pusherInstance: Pusher | null = null;

if (PUSHER_APP_ID && NEXT_PUBLIC_PUSHER_KEY && PUSHER_SECRET && NEXT_PUBLIC_PUSHER_CLUSTER) {
  pusherInstance = new Pusher({
    appId: PUSHER_APP_ID,
    key: NEXT_PUBLIC_PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  });
  console.log('Pusher server-side initialized successfully.');
} else {
  console.log('Pusher environment variables not fully configured. WebSocket triggers will be bypassed (Graceful Polling Fallback active).');
}

/**
 * Triggers a real-time event via Pusher if keys are configured.
 * Gracefully ignores if not configured.
 */
export async function triggerPusherEvent(channel: string, event: string, data: any) {
  if (!pusherInstance) {
    return;
  }
  try {
    await pusherInstance.trigger(channel, event, data);
  } catch (error) {
    console.error('Error triggering Pusher event:', error);
  }
}

export default pusherInstance;
