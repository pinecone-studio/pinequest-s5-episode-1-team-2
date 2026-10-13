"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, signup } from "@/app/actions/auth";
import { NAME_MAX_LENGTH } from "@/lib/auth/schemas";
import type { Role } from "@/types/auth";
import { SafePathLoading } from "@/components/safepath-loading";

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  autoComplete: string;
  defaultValue?: string;
  errors?: string[];
  invalid?: boolean;
  describedBy?: string;
  maxLength?: number;
};

function Field({ id, label, type = "text", autoComplete, defaultValue, errors, invalid = false, describedBy, maxLength }: FieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const hasError = invalid || Boolean(errors?.length);
  const errorId = `${id}-error`;
  const hasFieldErrors = Boolean(errors?.length);
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-[#d2e0e3]">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={isPassword && passwordVisible ? "text" : type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          maxLength={maxLength}
          aria-invalid={hasError || undefined}
          aria-describedby={hasFieldErrors ? errorId : describedBy}
          className={`h-[54px] w-full rounded-[14px] border bg-[#0b1b20]/90 px-4 text-base text-white shadow-sm outline-none transition placeholder:text-[#7e969e] focus:ring-4 focus:ring-[#22d3ee]/15 ${isPassword ? "pr-14" : ""} ${hasError ? "border-[#fb7185] focus:border-[#fb7185]" : "border-[#24515b] focus:border-[#22d3ee]"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? "Нууц үг нуух" : "Нууц үг харуулах"}
            aria-pressed={passwordVisible}
            className="absolute inset-y-0 right-1.5 grid w-11 place-items-center rounded-xl text-[#91a5ad] transition hover:text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#67e8f9]"
          >
            {passwordVisible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        )}
      </div>
      {hasFieldErrors && <ul id={errorId} className="grid gap-1" aria-live="polite">{errors?.map((error) => <li key={error} className="flex items-start gap-2 text-[13px] leading-5 text-[#fda4af]"><span className="mt-[3px] font-bold" aria-hidden="true">!</span><span>{error}</span></li>)}</ul>}
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
      <legend className="text-sm font-medium text-[#d2e0e3]">Та хэн бэ?</legend>
      <div className="mt-2 grid gap-2">
        {ROLE_OPTIONS.map((option) => (
          <label key={option.value} className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border border-[#24515b] bg-[#0b1b20]/90 px-4 py-3 transition has-[:checked]:border-[#22d3ee] has-[:checked]:bg-[#0e7490]/30 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#67e8f9]">
            <input type="radio" name="role" value={option.value} defaultChecked={selected === option.value} className="size-4 accent-[#22d3ee]" />
            <span className="min-w-0"><span className="block text-[15px] font-semibold text-white">{option.title}</span><span className="mt-0.5 block text-[12px] text-[#b2c3c8]">{option.hint}</span></span>
          </label>
        ))}
      </div>
      {errors?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#fda4af]">{error}</p>)}
    </fieldset>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button type="submit" disabled={pending} className="mt-1 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#67e8f9] to-[#0891b2] px-5 text-[15px] font-bold text-[#06212a] shadow-[0_8px_22px_rgba(6,182,212,.22)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67e8f9]">
      {pending && <SafePathLoading variant="button" />}
      {pending ? "Түр хүлээнэ үү…" : children}
    </button>
  );
}

function FormMessage({ children, id }: { children: string; id?: string }) {
  return <p id={id} role="alert" className="rounded-xl border border-[#be5262]/50 bg-[#36151c] px-4 py-3 text-sm leading-5 text-[#fecdd3]">{children}</p>;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const credentialsInvalid =
    state?.message === "Имэйл эсвэл нууц үг буруу байна." ||
    Boolean(state?.errors?.email?.length || state?.errors?.password?.length);
  return (
    <form action={action} noValidate className="grid gap-5">
      {credentialsInvalid ? (
        <FormMessage id="login-credentials-error">Имэйл эсвэл нууц үг буруу байна.</FormMessage>
      ) : state?.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}
      <Field id="email" label="Имэйл хаяг" type="email" autoComplete="email" defaultValue={state?.values?.email} invalid={credentialsInvalid} describedBy={credentialsInvalid ? "login-credentials-error" : undefined} />
      <Field id="password" label="Нууц үг" type="password" autoComplete="current-password" invalid={credentialsInvalid} describedBy={credentialsInvalid ? "login-credentials-error" : undefined} />
      <SubmitButton pending={pending}>Нэвтрэх</SubmitButton>
      <p className="text-center text-sm text-[#b2c3c8]">Бүртгэлгүй юу? <Link href="/signup" className="font-semibold text-[#67e8f9] underline decoration-[#22d3ee]/50 underline-offset-4 hover:text-white">Бүртгүүлэх</Link></p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} noValidate className="grid gap-4">
      <Field id="name" label="Нэр" autoComplete="name" defaultValue={state?.values?.name} errors={state?.errors?.name} maxLength={NAME_MAX_LENGTH} />
      <Field id="email" label="Имэйл хаяг" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      <Field id="password" label="Нууц үг" type="password" autoComplete="new-password" errors={state?.errors?.password} />
      <Field id="confirmPassword" label="Нууц үгээ давтах" type="password" autoComplete="new-password" errors={state?.errors?.confirmPassword} />
      <RoleChoice selected={state?.values?.role} errors={state?.errors?.role} />
      {state?.message && <FormMessage>{state.message}</FormMessage>}
      <SubmitButton pending={pending}>Бүртгүүлэх</SubmitButton>
      <p className="text-center text-sm text-[#b2c3c8]">Бүртгэлтэй юу? <Link href="/login" className="font-semibold text-[#67e8f9] underline decoration-[#22d3ee]/50 underline-offset-4 hover:text-white">Нэвтрэх</Link></p>
    </form>
  );
}
