import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt?: Date;
}

export const registerUser = async (
  username: string,
  email: string,
  password: string
): Promise<SafeUser> => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();

  // Check duplicate email or username
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
    },
  });

  if (existingUser) {
    if (existingUser.email === normalizedEmail) {
      throw new AppError('An account with this email address already exists', 409);
    }
    throw new AppError('Username is already taken', 409);
  }

  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await prisma.user.create({
    data: {
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
    },
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const loginUser = async (email: string, password: string): Promise<SafeUser> => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const getUserById = async (id: string): Promise<SafeUser | null> => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
