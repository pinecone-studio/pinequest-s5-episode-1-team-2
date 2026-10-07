"use client";

import { useEffect, useRef, useState } from "react";

const defaultText =
  "Сайн байна уу. Та аюулгүй замаасаа хазайсан байна. Гэр рүүгээ буцахад тань туслах уу?";

export default function Home() {
  const [text, setText] = useState(defaultText);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  async function handleSpeak() {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Дуу үүсгэхэд алдаа гарлаа.");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      audioUrlRef.current = audioUrl;

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Дуу үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-16 text-zinc-950">
      <section className="w-full max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Монгол AI Voice</h1>
        <p className="mt-3 text-zinc-600">Монгол текстийг дуугаар уншуулна уу.</p>

        <label className="mt-8 block text-sm font-medium" htmlFor="tts-text">
          Текст
        </label>
        <textarea
          className="mt-2 min-h-56 w-full resize-y rounded-lg border border-zinc-300 bg-white p-4 text-base leading-7 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
          id="tts-text"
          onChange={(event) => setText(event.target.value)}
          placeholder="Энд текстээ бичнэ үү"
          value={text}
        />

        <button
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-black px-5 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isLoading || !text.trim()}
          onClick={handleSpeak}
          type="button"
        >
          {isLoading ? "Дуу үүсгэж байна..." : "Дуугаар унших"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <audio className="sr-only" ref={audioRef} />
      </section>
    </main>
  );
}
