import crypto from 'crypto';
import { prisma } from '../config/prisma';

export const generateRandomCode = (length = 6): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
};

export const generateUniqueInviteCode = async (): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateRandomCode(6);
    const existing = await prisma.room.findFirst({
      where: {
        OR: [{ code }, { inviteCode: code }],
      },
    });

    if (!existing) {
      return code;
    }
    attempts++;
  }

  // Fallback with timestamp suffix if 10 collisions occur
  return `P${Date.now().toString(36).substring(3, 8).toUpperCase()}`;
};
