const webpush = require('web-push');

let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY) VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
if (VAPID_PRIVATE_KEY) VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:contato@holozonic.com.br',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    console.log('[PUSH] VAPID configured successfully');
  } catch (err) {
    console.error('[PUSH] VAPID config error:', err.message);
  }
} else {
  console.log('[PUSH] VAPID keys not configured - push disabled');
}

const pushSubscriptions = new Map();

function addSubscription(userId, subscription) {
  if (!userId || !subscription) return;
  
  if (!pushSubscriptions.has(userId)) {
    pushSubscriptions.set(userId, []);
  }
  
  const subs = pushSubscriptions.get(userId);
  const exists = subs.find(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subs.push(subscription);
    console.log(`[PUSH] Subscription added for userId=${userId}`);
  }
}

function removeSubscription(userId, endpoint) {
  if (!userId || !endpoint) return;
  
  const subs = pushSubscriptions.get(userId);
  if (subs) {
    const index = subs.findIndex(s => s.endpoint === endpoint);
    if (index > -1) {
      subs.splice(index, 1);
      console.log(`[PUSH] Subscription removed for userId=${userId}`);
    }
  }
}

async function sendPushNotification(userId, title, body, url = '/') {
  const subs = pushSubscriptions.get(userId) || [];
  if (subs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({ title, body, url });
  
  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub, payload).catch(err => {
      console.error('[PUSH] Send failed:', err.message);
      return Promise.reject(err);
    }))
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`[PUSH] Sent to userId=${userId}: ${sent}/${subs.length}`);
  
  return { sent, failed };
}

function getSubscriptions(userId) {
  return pushSubscriptions.get(userId) || [];
}

function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

module.exports = {
  addSubscription,
  removeSubscription,
  sendPushNotification,
  getSubscriptions,
  getVapidPublicKey
};