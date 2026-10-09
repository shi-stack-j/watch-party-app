import { z } from 'zod';

export const createRoomSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Room title is required' })
      .min(2, 'Room title must be at least 2 characters')
      .max(100, 'Room title cannot exceed 100 characters'),
    description: z.string().optional(),
    isPrivate: z.boolean().optional().default(false),
  }),
});

export const joinRoomSchema = z.object({
  body: z.object({
    code: z
      .string({ required_error: 'Invite code is required' })
      .min(1, 'Invite code is required')
      .transform((val) => val.trim().toUpperCase()),
  }),
});
