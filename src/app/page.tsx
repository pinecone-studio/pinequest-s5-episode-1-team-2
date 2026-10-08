"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Clock3, Heart, LocateFixed, MapPin, Menu, Navigation, ShieldCheck, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/safe-path";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <AppShell>
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#f8f8f6] px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
        <header className="relative z-20 flex h-14 items-center justify-between">
          <Link href="/" aria-label="SafePath нүүр" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#171817]">
            <span className="grid size-10 place-items-center rounded-[14px] bg-[#e83c36] text-white shadow-[0_6px_14px_rgba(232,60,54,.2)]"><MapPin size={22} fill="currentColor" strokeWidth={2.2} /></span>
            <span className="text-[16px] font-bold tracking-[-0.04em]">SafePath</span>
          </Link>
          <button type="button" aria-label={menuOpen ? "Цэс хаах" : "Цэс нээх"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="grid size-11 place-items-center rounded-2xl border border-[#e9e9e5] bg-white text-[#252623] shadow-sm transition hover:bg-[#f3f3f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171817]">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {menuOpen && <nav aria-label="Үндсэн цэс" className="absolute right-0 top-[54px] z-30 w-[min(280px,calc(100vw-40px))] rounded-[22px] border border-[#e9e9e5] bg-white p-2 shadow-[0_16px_44px_rgba(22,25,20,.14)]">
            <Link onClick={() => setMenuOpen(false)} href="/guardian" className="flex min-h-[62px] items-center gap-3 rounded-2xl px-3 hover:bg-[#f7f7f4]"><span className="grid size-10 place-items-center rounded-xl bg-[#f1f4ed] text-[#416b46]"><ShieldCheck size={19} /></span><span className="flex-1"><span className="block text-sm font-semibold">Асран хамгаалагч</span><span className="mt-0.5 block text-xs text-[#777a73]">Байршил, аюулгүй байдлыг харах</span></span><ArrowUpRight size={16} className="text-[#8a8c86]" /></Link>
            <Link onClick={() => setMenuOpen(false)} href="/tracker" className="flex min-h-[62px] items-center gap-3 rounded-2xl px-3 hover:bg-[#f7f7f4]"><span className="grid size-10 place-items-center rounded-xl bg-[#fff1ed] text-[#d64a3d]"><UserRound size={19} /></span><span className="flex-1"><span className="block text-sm font-semibold">Хэрэглэгч</span><span className="mt-0.5 block text-xs text-[#777a73]">Милотой ярилцах</span></span><ArrowUpRight size={16} className="text-[#8a8c86]" /></Link>
            <Link onClick={() => setMenuOpen(false)} href="/settings" className="flex min-h-[54px] items-center gap-3 rounded-2xl px-3 text-sm font-semibold hover:bg-[#f7f7f4]"><span className="grid size-10 place-items-center rounded-xl bg-[#f4f3f0] text-[#666860]"><LocateFixed size={19} /></span>Тохиргоо</Link>
          </nav>}
        </header>

        <section className="flex flex-1 flex-col pt-9" aria-labelledby="home-title">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#e3433b]"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ee655c] opacity-40" /><span className="relative size-2 rounded-full bg-[#e3433b]" /></span>Аюулгүй аялал</div>
          <h1 id="home-title" className="mt-3 max-w-[330px] text-[34px] font-bold leading-[1.08] tracking-[-0.055em] text-[#20211f]">Хайртай хүмүүсээ <span className="text-[#e3433b]">аюулгүй</span> дагаарай.</h1>
          <p className="mt-3 max-w-[320px] text-[14px] leading-6 text-[#777a73]">Байршлаа хуваалцаж, хэрэгтэй үедээ Мило туслахаас зөвлөгөө аваарай.</p>

          <div className="relative mt-7 min-h-[270px] flex-1 overflow-hidden rounded-[30px] border border-[#e9e9e5] bg-[#efefeb] shadow-[0_12px_34px_rgba(30,35,25,.06)]">
            <div className="absolute inset-0 opacity-70" aria-hidden="true">
              <svg className="size-full" viewBox="0 0 390 360" preserveAspectRatio="xMidYMid slice">
                <path d="M-40 68 C70 82 104 150 195 143S325 71 435 109" fill="none" stroke="#fff" strokeWidth="31" />
                <path d="M-40 68 C70 82 104 150 195 143S325 71 435 109" fill="none" stroke="#deded8" strokeWidth="1.5" />
                <path d="M82 -25 C98 68 161 95 174 155s-37 119-3 236" fill="none" stroke="#fff" strokeWidth="23" />
                <path d="M82 -25 C98 68 161 95 174 155s-37 119-3 236" fill="none" stroke="#deded8" strokeWidth="1.5" />
                <path d="M345 -25c-22 79-54 131-50 197s51 116 27 220" fill="none" stroke="#fff" strokeWidth="20" />
                <path d="M345 -25c-22 79-54 131-50 197s51 116 27 220" fill="none" stroke="#deded8" strokeWidth="1.5" />
                <path d="M95 330c10-76 17-136 87-175s102-47 172-101" fill="none" stroke="#e98178" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />
              </svg>
            </div>
            <div className="absolute left-[27%] top-[35%] grid size-12 place-items-center rounded-full border-[5px] border-white bg-[#e7433c] text-white shadow-[0_7px_16px_rgba(210,62,52,.28)]"><MapPin size={20} fill="currentColor" /></div>
            <div className="absolute right-[20%] top-[17%] grid size-9 place-items-center rounded-full border-[4px] border-white bg-[#252623] text-white shadow-md"><Heart size={14} fill="currentColor" /></div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-[20px] border border-white/80 bg-white/95 p-3.5 shadow-[0_8px_24px_rgba(25,27,22,.08)] backdrop-blur">
              <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#fff0ed] text-[#e3433b]"><Navigation size={19} /></span>
              <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-[#272824]">Байршлын хамгаалалт</p><p className="mt-0.5 text-[11px] text-[#85877f]">Нэг товшилтоор эхлүүлнэ</p></div>
              <span className="grid size-8 place-items-center rounded-full bg-[#f5f5f2] text-[#777a73]"><Clock3 size={15} /></span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between px-1 text-[12px] text-[#777a73]"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#5c9a65]" />Таны аялал, таны хяналт</span><span>Хэзээ ч зогсоож болно</span></div>
          <Link href="/tracker" className="group mt-4 flex min-h-[64px] items-center justify-center gap-3 rounded-[22px] bg-[#e6413a] px-5 text-[16px] font-bold text-white shadow-[0_10px_22px_rgba(230,65,58,.24)] transition hover:bg-[#d93832] active:scale-[.99] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#171817]">
            <LocateFixed size={20} strokeWidth={2.2} />Байршлаа эхлүүлэх<ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link href="/guardian" className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-[#666860] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#171817]"><ShieldCheck size={16} />Асран хамгаалагчийн самбар</Link>
        </section>
      </main>
    </AppShell>
  );
}
