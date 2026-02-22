import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.SETTINGS_ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY environment variable is not set. Generate one with: openssl rand -hex 32'
    )
  }
  // Key must be 32 bytes (64 hex chars) for AES-256
  const buf = Buffer.from(key, 'hex')
  if (buf.length !== 32) {
    throw new Error(
      `SETTINGS_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes) for AES-256. Got ${buf.length} bytes. Generate a valid key with: openssl rand -hex 32`
    )
  }
  return buf
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a hex string of: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  // Concatenate: IV (16 bytes) + AuthTag (16 bytes) + Ciphertext
  return iv.toString('hex') + authTag.toString('hex') + encrypted
}

/**
 * Decrypt a hex string produced by encrypt().
 * Returns the original plaintext.
 */
export function decrypt(encryptedHex: string): string {
  const key = getEncryptionKey()

  const ivHex = encryptedHex.slice(0, IV_LENGTH * 2)
  const authTagHex = encryptedHex.slice(
    IV_LENGTH * 2,
    IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2
  )
  const ciphertextHex = encryptedHex.slice(
    IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2
  )

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Extract the last 4 characters of a PAT for display hint.
 */
export function getPatHint(pat: string): string {
  if (pat.length <= 4) return pat
  return pat.slice(-4)
}
