const crypto = require('crypto');

// Şifreler Node'un yerleşik scrypt'i ile hash'lenir — ek bağımlılık gerekmez.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
};

const verifyPassword = (password, stored) => {
  const [scheme, saltHex, hashHex] = String(stored || '').split(':');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT_PARAMS);
  return crypto.timingSafeEqual(actual, expected);
};

module.exports = { hashPassword, verifyPassword };
