import { z } from "zod";

export const registerSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1, "Name cannot be empty").max(255),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const userDtoSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
});

export type UserDto = z.infer<typeof userDtoSchema>;
