"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";
import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import type { Role } from "@/types/auth";

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

const ROLE_OPTIONS: { value: Role; title: string; hint: string }[] = [
  { value: "guardian", title: "Эцэг эх / Асран хамгаалагч", hint: "Байршил, аюулгүй байдлыг харах" },
  { value: "child", title: "Хэрэглэгч", hint: "Милотой ярилцах" },
];

function RoleChoice({ selected, errors }: { selected?: string; errors?: string[] }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-[#737373]">Та хэн бэ?</legend>
      <div className="mt-2 grid gap-2">
        {ROLE_OPTIONS.map((option) => (
          <label key={option.value} className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border border-[#e7e7e5] bg-[#f7f7f5] px-4 py-3 has-[:checked]:border-[#111111] has-[:checked]:bg-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#111111]">
            <input type="radio" name="role" value={option.value} defaultChecked={selected === option.value} className="size-4 accent-[#111111]" />
            <span className="min-w-0"><span className="block text-[15px] font-semibold">{option.title}</span><span className="mt-0.5 block text-[12px] text-[#737373]">{option.hint}</span></span>
          </label>
        ))}
      </div>
      {errors?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#c64242]">{error}</p>)}
    </fieldset>
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
      <Field id="email" label="Имэйл" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
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
      <RoleChoice selected={state?.values?.role} errors={state?.errors?.role} />
      {state?.message && <p role="alert" className="text-sm text-[#c64242]">{state.message}</p>}
      <SubmitButton pending={pending}>Бүртгүүлэх</SubmitButton>
      <p className="text-center text-sm text-[#737373]">Бүртгэлтэй юу? <Link href="/login" className="font-medium text-[#111111] underline underline-offset-4">Нэвтрэх</Link></p>
    </form>
  );
}
