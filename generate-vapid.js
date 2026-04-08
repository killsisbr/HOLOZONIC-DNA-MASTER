const crypto = require('crypto');

function generateVapidKeys() {
  const curve = crypto.createECDH('prime256v1');
  curve.generateKeys();
  
  const publicKey = curve.getPublicKey('base64');
  const privateKey = curve.getPrivateKey('base64');
  
  return { publicKey, privateKey };
}

const vapidKeys = generateVapidKeys();

console.log('=== VAPID Keys para Push Notifications ===');
console.log('PUBLIC_KEY:', vapidKeys.publicKey);
console.log('PRIVATE_KEY:', vapidKeys.privateKey);
console.log('');
console.log('Adicione ao .env:');
console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);