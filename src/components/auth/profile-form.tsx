"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProfile } from "@/app/actions/auth";
import { NAME_MAX_LENGTH } from "@/lib/auth/schemas";
import { SafePathLoading } from "@/components/safepath-loading";

type Profile = { role: "guardian" | "child" | null; name: string; phone: string };

const input = "mt-2 min-h-12 w-full border-0 border-b border-white/15 bg-transparent px-0 text-[18px] font-medium text-white outline-none focus:border-[#67e8f9]";

/** Settings: the name and phone for this device's role, saved to the database. Hidden until a role is chosen. */
export function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, action, pending] = useActionState(updateProfile, undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled && data) setProfile(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!profile) return <SafePathLoading className="py-8" label="Мэдээлэл ачаалж байна…" />;
  if (!profile.role) return null;
  const child = profile.role === "child";
  const name = state?.values?.name ?? profile.name;
  const phone = state?.values?.phone ?? profile.phone;

  return (
    <form key={profile.role} action={action} className="relative z-10 mx-auto grid w-full max-w-[390px] gap-4 pt-5">
      <h1 className="text-[29px] font-bold leading-[1.08] tracking-[-0.055em] text-white">{child ? "Хүүхдийн мэдээлэл" : "Эцэг эхийн мэдээлэл"}</h1>
      <div>
        <label htmlFor="profile-name" className="text-[13px] font-medium text-cyan-200">{child ? "Хүүхдийн нэр" : "Эцэг эхийн нэр"}</label>
        <input id="profile-name" name="name" defaultValue={name} maxLength={NAME_MAX_LENGTH} autoComplete="off" className={input} />
        {state?.errors?.name?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#ff8a8a]">{error}</p>)}
      </div>
      <div>
        <label htmlFor="profile-phone" className="text-[13px] font-medium text-cyan-200">{child ? "Хүүхдийн утасны дугаар" : "Эцэг эхийн утасны дугаар"}</label>
        <input id="profile-phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" className={input} />
        {state?.errors?.phone?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#ff8a8a]">{error}</p>)}
      </div>
      {state?.success && <p role="status" className="text-sm text-cyan-200">{state.success}</p>}
      <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0e7490] to-[#0891b2] px-5 text-[15px] font-bold text-white disabled:opacity-50">{pending && <SafePathLoading variant="button" />}{pending ? "Түр хүлээнэ үү…" : "Хадгалах"}</button>
    </form>
  );
}
