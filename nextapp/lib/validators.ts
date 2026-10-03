import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM.");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your full name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use a password of at least 8 characters."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const reservationSchema = z.object({
  date: dateStr,
  start: timeStr,
  end: timeStr,
  roomId: z.string().min(1, "Choose a room."),
  equipmentIds: z.array(z.string()).min(1, "Select at least one piece of equipment."),
  event: z.string().trim().min(1, "Give the activity a name.").max(160),
  purpose: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  // Admins may book on behalf of a teacher; teachers may only book for themselves
  // (the API route enforces this — it is not trusted from the body alone).
  userId: z.string().optional(),
});

export const equipmentSchema = z.object({
  name: z.string().trim().min(1, "Give the item a name.").max(80),
  type: z.enum(["PROJECTOR", "MICROPHONE", "SPEAKER", "LAPTOP", "EXTENSION_CORD", "OTHER"]),
  status: z.enum(["AVAILABLE", "MAINTENANCE", "UNAVAILABLE", "RETIRED"]),
  location: z.string().trim().max(120).optional().default(""),
  condition: z.string().trim().max(120).optional().default(""),
  description: z.string().trim().max(500).optional().default(""),
});

export const roomSchema = z.object({
  name: z.string().trim().min(1, "Give the room a name.").max(80),
  building: z.string().trim().max(120).optional().default(""),
  capacity: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["TEACHER", "ADMIN"]),
  status: z.enum(["ACTIVE", "DISABLED"]),
  password: z.string().min(8).optional().or(z.literal("")),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
});

export const passwordChangeSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8, "Use a new password of at least 8 characters."),
});

export type ReservationInput = z.infer<typeof reservationSchema>;
