"use client";

import { useActionState } from "react";
import { generatePairingCode, redeemCode } from "@/app/actions/auth";
import { PAIRING_CODE_LENGTH, PAIRING_CODE_TTL_MINUTES } from "@/lib/auth/schemas";

const button = "min-h-[52px] rounded-2xl bg-[#111111] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:bg-[#c8c8c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]";

/** Child side: ask for a code and show it. */
export function CodeGenerator() {
  const [state, action, pending] = useActionState(generatePairingCode, undefined);
  return (
    <form action={action} className="grid gap-4">
      {state?.code && (
        <div className="rounded-2xl bg-[#f7f7f5] px-5 py-6 text-center" aria-live="polite">
          <p className="text-[36px] font-semibold tracking-[0.3em]">{state.code}</p>
          <p className="mt-2 text-sm text-[#737373]">{PAIRING_CODE_TTL_MINUTES} минутын дотор ашиглана уу.</p>
        </div>
      )}
      <button type="submit" disabled={pending} className={button}>{pending ? "Түр хүлээнэ үү…" : state?.code ? "Шинэ код авах" : "Код авах"}</button>
    </form>
  );
}

/** Guardian side: type in the code shown on the child's phone. */
export function CodeEntry() {
  const [state, action, pending] = useActionState(redeemCode, undefined);
  return (
    <form action={action} className="grid gap-4">
      <div>
        <label htmlFor="code" className="text-[13px] font-medium text-[#737373]">Код</label>
        <input
          id="code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={PAIRING_CODE_LENGTH}
          className="mt-2 h-16 w-full rounded-xl border border-[#e7e7e5] bg-[#f7f7f5] px-4 text-center text-2xl font-semibold uppercase tracking-[0.3em] outline-none focus:border-[#111111]"
        />
        {state?.errors?.code?.map((error) => <p key={error} role="alert" className="mt-2 text-sm text-[#c64242]">{error}</p>)}
      </div>
      {state?.message && <p role="alert" className="text-sm text-[#c64242]">{state.message}</p>}
      {state?.success && <p role="status" className="text-sm text-[#2e7d4f]">{state.success}</p>}
      <button type="submit" disabled={pending} className={button}>{pending ? "Түр хүлээнэ үү…" : "Холбох"}</button>
    </form>
  );
}
