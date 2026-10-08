"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";
import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  autoComplete: string;
  defaultValue?: string;
  errors?: string[];
  maxLength?: number;
  minLength?: number;
};

function Field({ id, label, type = "text", autoComplete, defaultValue, errors, maxLength, minLength }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-[#737373]">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        maxLength={maxLength}
        minLength={minLength}
        aria-invalid={errors ? true : undefined}
        className="mt-2 h-14 w-full rounded-xl border border-[#e7e7e5] bg-[#f7f7f5] px-4 text-[16px] outline-none focus:border-[#111111]"
      />
      {errors?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#c64242]">{error}</p>)}
    </div>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button type="submit" disabled={pending} className="mt-2 min-h-[52px] rounded-2xl bg-[#111111] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:bg-[#c8c8c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]">
      {pending ? "Түр хүлээнэ үү…" : children}
    </button>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field id="email" label="Имэйл" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email}/>
      <Field id="password" label="Нууц үг" type="password" autoComplete="current-password" errors={state?.errors?.password} />
      {state?.message && <p role="alert" className="text-sm text-[#c64242]">{state.message}</p>}
      <SubmitButton pending={pending}>Нэвтрэх</SubmitButton>
      <p className="text-center text-sm text-[#737373]">Бүртгэлгүй юу? <Link href="/signup" className="font-medium text-[#111111] underline underline-offset-4">Бүртгүүлэх</Link></p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field id="name" label="Нэр" autoComplete="name" defaultValue={state?.values?.name} errors={state?.errors?.name} maxLength={NAME_MAX_LENGTH} />
      <Field id="email" label="Имэйл" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      <Field id="password" label="Нууц үг" type="password" autoComplete="new-password" errors={state?.errors?.password} minLength={PASSWORD_MIN_LENGTH} />
      <Field id="confirmPassword" label="Нууц үгээ давтах" type="password" autoComplete="new-password" errors={state?.errors?.confirmPassword} />
      {state?.message && <p role="alert" className="text-sm text-[#c64242]">{state.message}</p>}
      <SubmitButton pending={pending}>Бүртгүүлэх</SubmitButton>
      <p className="text-center text-sm text-[#737373]">Бүртгэлтэй юу? <Link href="/login" className="font-medium text-[#111111] underline underline-offset-4">Нэвтрэх</Link></p>
    </form>
  );
}
