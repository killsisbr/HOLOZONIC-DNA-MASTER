const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contato@holozonic.com.br',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
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