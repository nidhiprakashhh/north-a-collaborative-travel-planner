import crypto from 'crypto';

// Excludes visually ambiguous characters (0/O, 1/I) since people type these
// codes by hand when joining a trip.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = crypto.randomInt(0, ALPHABET.length);
    code += ALPHABET[index];
  }
  return code;
}
