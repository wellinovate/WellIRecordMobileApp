// Optional certificate pinning for the WelliRecord API on Android.
//
// OFF unless API_PINS is set in the build environment, so a build without pins behaves as before.
// A wrong pin makes every request fail, so pins are never guessed here. Print them from the live
// server with scripts/print-spki-pins.sh, put them in EAS env, and test a preview build first.
//
//   API_PIN_HOST     host to pin, default wellirecordmobileapp.onrender.com
//   API_PINS         comma-separated base64 SHA-256 SPKI hashes. Give at least two: the current
//                    intermediate CA and a backup (another CA in the chain, or a spare key).
//   API_PIN_EXPIRY   YYYY-MM-DD. After this date Android ignores the pins and trusts the system
//                    store again, so a forgotten expired pin cannot lock people out. Default: 1 year.
//
// Pin a CA/intermediate public key, not the leaf: Render renews the leaf certificate often.
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const B64_SHA256 = /^[A-Za-z0-9+/]{43}=$/;

function buildXml(host, pins, expiry) {
  const pinLines = pins.map((p) => `      <pin digest="SHA-256">${p}</pin>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="false">${host}</domain>
    <pin-set expiration="${expiry}">
${pinLines}
    </pin-set>
  </domain-config>
</network-security-config>
`;
}

module.exports = function withApiPinning(config) {
  const pins = (process.env.API_PINS || '').split(',').map((p) => p.trim()).filter(Boolean);
  if (pins.length === 0) return config;

  if (pins.length < 2) throw new Error('API_PINS needs at least two pins (current and backup), or one bad certificate change locks everyone out.');
  for (const p of pins) if (!B64_SHA256.test(p)) throw new Error(`API_PINS: "${p}" is not a base64 SHA-256 hash (44 characters ending in =).`);

  const host = process.env.API_PIN_HOST || 'wellirecordmobileapp.onrender.com';
  if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error('API_PIN_HOST is not a host name.');
  const expiry = process.env.API_PIN_EXPIRY || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) throw new Error('API_PIN_EXPIRY must look like 2027-10-01.');

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'network_security_config.xml'), buildXml(host, pins, expiry));
      return cfg;
    },
  ]);

  return withAndroidManifest(config, (cfg) => {
    cfg.modResults.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });
};

module.exports.buildXml = buildXml;
