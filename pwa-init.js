const VAPID_PUBLIC_KEY = 'BMRoiVkMZ6i5i1Ekc7Uzh+fJzCcS8qd8X+ve1RFt0RLJlHaGGjtV5AZcpOsPUFfTKsoBEPzX8IhmYgUJ+MnAtOg=';

async function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[PUSH] Push not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: await urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('[PUSH] Subscribed:', subscription.endpoint);

    const userId = localStorage.getItem('holozonic_user_id') || 'anonymous';
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, userId })
    });

    return subscription;
  } catch (err) {
    console.error('[PUSH] Subscription failed:', err);
    return null;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[PWA] Registered:', reg.scope))
      .catch((err) => console.error('[PWA] Failed:', err));
  });
}

if ('Notification' in window && Notification.permission === 'default') {
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.id = 'pwa-prompt';
    banner.innerHTML = `
      <style>
        #pwa-prompt {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #0a1628, #1a2744);
          border: 1px solid #00d9a5;
          border-radius: 12px;
          padding: 16px 24px;
          color: white;
          font-family: system-ui, sans-serif;
          box-shadow: 0 8px 32px rgba(0, 217, 165, 0.3);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 12px;
          animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        #pwa-prompt button {
          background: #00d9a5;
          color: #0a1628;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
        }
        #pwa-prompt button:hover { background: #00f5b8; }
        #pwa-prompt .close {
          background: transparent;
          color: #8899aa;
          font-size: 20px;
        }
        #pwa-prompt .push-opt {
          font-size: 12px;
          color: #8899aa;
        }
      </style>
      <span>Instale o app para melhor experiência</span>
      <button onclick="this.parentElement.remove(); subscribeToPush()">Instalar</button>
      <span class="push-opt"><label><input type="checkbox" id="push-checkbox" checked> Receber notificações</label></span>
      <button class="close" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(banner);
  });
}

if ('Notification' in window && Notification.permission === 'granted') {
  subscribeToPush();
}