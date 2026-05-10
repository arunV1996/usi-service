'use strict';

const crypto = require('crypto');

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

/**
 * Encrypts a UTF-8 plaintext using AES-256-GCM.
 * @param {string} plaintext
 * @param {string} keyB64 Base64-encoded 32-byte key.
 * @returns {{iv:string, tag:string, data:string, alg:string}|null}
 */
function encryptAesGcm(plaintext, keyB64) {
  if (!keyB64) return null;
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('AUDIT_ENCRYPTION_KEY must be 32 bytes (base64)');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
}

function decryptAesGcm(payload, keyB64) {
  if (!payload || !keyB64) return null;
  const key = Buffer.from(keyB64, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString('utf8');
}

function timingSafeEquals(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function randomId(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { sha256Hex, encryptAesGcm, decryptAesGcm, timingSafeEquals, randomId };
