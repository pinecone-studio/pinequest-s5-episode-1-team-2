import * as z from "zod";
import { ROLES } from "@/types/auth";

export const NAME_MAX_LENGTH = 40;
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt reads only the first 72 bytes, so longer passwords are refused instead of silently cut. */
export const PASSWORD_MAX_BYTES = 72;

export const PAIRING_CODE_LENGTH = 6;
/** No 0/O or 1/I, so a code read off a phone screen is hard to mistype. */
export const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PAIRING_CODE_TTL_MINUTES = 10;

const name = z
  .string({ error: "Нэрээ оруулна уу." })
  .trim()
  .min(1, { error: "Нэрээ оруулна уу." })
  .max(NAME_MAX_LENGTH, { error: `Нэр хамгийн ихдээ ${NAME_MAX_LENGTH} тэмдэгт байна.` });

const role = z.enum(ROLES, { error: "Үүргээ сонгоно уу." });

const email = z
  .string({ error: "Имэйл хаягаа оруулна уу." })
  .trim()
  .toLowerCase()
  .max(254, { error: "Имэйл хаяг хэт урт байна." })
  .pipe(z.email({ error: "Имэйл хаягаа зөв оруулна уу." }));

// Not trimmed: a password is stored exactly as typed.
const newPassword = z
  .string({ error: "Нууц үгээ оруулна уу." })
  .min(PASSWORD_MIN_LENGTH, { error: `Нууц үг хамгийн багадаа ${PASSWORD_MIN_LENGTH} тэмдэгт байна.` })
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES, {
    error: "Нууц үг хэт урт байна.",
  });

export const SignupFormSchema = z
  .object({
    name,
    email,
    password: newPassword,
    role,
    confirmPassword: z.string({ error: "Нууц үгээ дахин оруулна уу." }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    error: "Нууц үг таарахгүй байна.",
  });

// No length rules here: they apply when choosing a password, and checking them at login
// would lock out accounts created under older rules.
export const LoginFormSchema = z.object({
  email,
  password: z.string({ error: "Нууц үгээ оруулна уу." }).min(1, { error: "Нууц үгээ оруулна уу." }),
});

export const SetRoleFormSchema = z.object({
  role,
});

export const PairingCodeFormSchema = z.object({
  code: z
    .string({ error: "Кодоо оруулна уу." })
    .trim()
    .toUpperCase()
    .regex(new RegExp(`^[${PAIRING_CODE_ALPHABET}]{${PAIRING_CODE_LENGTH}}$`), {
      error: "Кодоо зөв оруулна уу.",
    }),
});
