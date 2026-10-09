import { redirect } from "next/navigation";
import { AppShell } from "@/components/safe-path";
import { LoginForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/auth/dal";
import { homeFor } from "@/lib/auth/routes";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <AppShell>
      <main className="flex min-h-dvh flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(20px+env(safe-area-inset-top))] bg-[radial-gradient(circle_at_50%_35%,#FFFFFF_0%,#DDF3FF_45%,#B9E2F7_100%)]">
        <p className="text-[17px] font-semibold tracking-[-0.02em]">SafePath</p>
        <div className="flex flex-1 flex-col justify-center py-10">
          <h1 className="text-[30px] font-semibold leading-[1.14] tracking-[-0.04em]">Нэвтрэх</h1>
          <p className="mb-8 mt-2 text-[15px] text-[#737373]">Бүртгэлээрээ нэвтэрнэ үү.</p>
          <LoginForm />
        </div>
      </main>
    </AppShell>
  );
}
