/**
 * End-to-End Encryption (E2EE) Module
 * Implements Elliptic Curve Diffie-Hellman (ECDH P-256) key agreement
 * combined with AES-GCM 256-bit authenticated payload encryption using
 * the standard W3C Web Cryptography API (window.crypto.subtle).
 *
 * Private keys are generated and stored exclusively on the user's local device (IndexedDB)
 * and are NEVER transmitted to Firestore or any backend server.
 */

const DB_NAME = 'CipherWire_Keystore';
const DB_VERSION = 1;
const STORE_NAME = 'keypairs';

// Shared key cache in memory: `${myUid}_${peerPubKeyString}` => CryptoKey (AES-GCM)
const sharedKeyCache = new Map<string, CryptoKey>();

interface StoredKeyPair {
  userId: string;
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
  createdAt: number;
}

function openKeystoreDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveKeyPairToIndexedDB(
  userId: string,
  privateKeyJwk: JsonWebKey,
  publicKeyJwk: JsonWebKey
): Promise<void> {
  const db = await openKeystoreDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const data: StoredKeyPair = {
      userId,
      privateKeyJwk,
      publicKeyJwk,
      createdAt: Date.now(),
    };
    const req = store.put(data);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function loadKeyPairFromIndexedDB(
  userId: string
): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey; publicKeyString: string } | null> {
  try {
    const db = await openKeystoreDB();
    const data = await new Promise<StoredKeyPair | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(userId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!data || !data.privateKeyJwk || !data.publicKeyJwk) {
      return null;
    }

    const privateKey = await window.crypto.subtle.importKey(
      'jwk',
      data.privateKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKey = await window.crypto.subtle.importKey(
      'jwk',
      data.publicKeyJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    const publicKeyString = JSON.stringify(data.publicKeyJwk);

    return { privateKey, publicKey, publicKeyString };
  } catch (err) {
    console.error('Failed to load key pair from IndexedDB:', err);
    return null;
  }
}

/**
 * Generates a fresh ECDH P-256 key pair, saves it to IndexedDB, and returns the public key string.
 */
export async function getOrGenerateUserKeyPair(
  userId: string
): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey; publicKeyString: string }> {
  // Check if we already have a key stored locally
  const existing = await loadKeyPairFromIndexedDB(userId);
  if (existing) {
    return existing;
  }

  // Generate new ECDH P-256 keypair
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable so user can back it up or restore
    ['deriveKey', 'deriveBits']
  );

  const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const publicKeyString = JSON.stringify(publicKeyJwk);

  await saveKeyPairToIndexedDB(userId, privateKeyJwk, publicKeyJwk);

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyString,
  };
}

/**
 * Imports a peer's public key string (JWK) into a CryptoKey for ECDH agreement
 */
export async function importPeerPublicKey(publicKeyString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(publicKeyString);
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

/**
 * Derives a shared 256-bit AES-GCM symmetric key between local private key and remote public key.
 */
export async function getSharedSecretKey(
  myUid: string,
  myPrivateKey: CryptoKey,
  peerPublicKeyString: string
): Promise<CryptoKey> {
  const cacheKey = `${myUid}::${peerPublicKeyString}`;
  const cached = sharedKeyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const peerPublicKey = await importPeerPublicKey(peerPublicKeyString);

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: peerPublicKey,
    },
    myPrivateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // derived key is non-extractable from memory
    ['encrypt', 'decrypt']
  );

  sharedKeyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

// Unicode-safe Base64 encoder
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Unicode-safe Base64 decoder
function base64ToBytes(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts a plaintext string using AES-GCM with a fresh 12-byte initialization vector.
 */
export async function encryptPayload(
  sharedKey: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // 96-bit (12 bytes) IV standard for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    sharedKey,
    data as unknown as BufferSource
  );

  const ciphertext = bytesToBase64(new Uint8Array(encryptedBuffer));
  const ivString = bytesToBase64(iv);

  return { ciphertext, iv: ivString };
}

/**
 * Decrypts an AES-GCM ciphertext using the derived shared key and provided IV.
 */
export async function decryptPayload(
  sharedKey: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string
): Promise<string> {
  const ciphertext = base64ToBytes(ciphertextBase64);
  const iv = base64ToBytes(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    sharedKey,
    ciphertext as unknown as BufferSource
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Computes a standardized 60-digit / 12-chunk Safety Fingerprint (similar to Signal)
 * derived from the two public keys for out-of-band identity verification.
 */
export async function computeSafetyFingerprint(
  pubKeyA: string,
  pubKeyB: string
): Promise<string> {
  const sorted = [pubKeyA, pubKeyB].sort().join('::');
  const encoder = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest(
    'SHA-256',
    encoder.encode(sorted) as unknown as BufferSource
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  // Format as readable 6-character chunks
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const chunks: string[] = [];
  for (let i = 0; i < 36; i += 6) {
    chunks.push(hex.slice(i, i + 6));
  }
  return chunks.join(' - ');
}

/**
 * Exports user keys as a portable JSON backup file for device migration.
 */
export async function exportKeyBackup(userId: string): Promise<string | null> {
  const db = await openKeystoreDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(userId);
    req.onsuccess = () => {
      if (req.result) {
        resolve(JSON.stringify(req.result));
      } else {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

/**
 * Imports a key backup into IndexedDB
 */
export async function importKeyBackup(
  userId: string,
  backupJson: string
): Promise<boolean> {
  try {
    const parsed = JSON.parse(backupJson);
    if (!parsed.privateKeyJwk || !parsed.publicKeyJwk) {
      throw new Error('Invalid key backup file format');
    }
    await saveKeyPairToIndexedDB(userId, parsed.privateKeyJwk, parsed.publicKeyJwk);
    sharedKeyCache.clear();
    return true;
  } catch (err) {
    console.error('Import key backup failed:', err);
    return false;
  }
}
