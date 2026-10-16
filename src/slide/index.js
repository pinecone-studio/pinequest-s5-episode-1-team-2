document.addEventListener("DOMContentLoaded", () => {
  // --- 1. БАГИЙН ГИШҮҮД ---
  const teamData = [
    { name: "А.Билгүүнтөгс", role: "4A" },
    { name: "М.Хосбат", role: "4C" },
    { name: "Т.Отгонбаатар", role: "4D" },
    { name: "М.Анхбаяр", role: "4D" },
    { name: "Э.Сэргэлэнбаяр", role: "4D" },
    { name: "Г.Нямлхагва", role: "Teencoding" },
    { name: "Ц.Должинсүрэн", role: "College Prep" },
    { name: "Э.Оюундарь", role: "Advanced HOP" },
  ];

  const teamContainer = document.getElementById("team-members-container");
  if (teamContainer) {
    teamData.forEach((member) => {
      // "А.Билгүүнтөгс" -> "Б"
      const initial = member.name.split(".").pop().charAt(0);
      const memberHTML = `
                <div class="team-member">
                    <div class="avatar">${initial}</div>
                    <div class="member-name">${member.name}</div>
                    <div class="member-role">${member.role}</div>
                </div>
            `;
      teamContainer.insertAdjacentHTML("beforeend", memberHTML);
    });
  }

  // --- 2. ТООН БАРИМТ: 65+ насны хүн ам (ҮСХ, 1212.mn — DT_NSO_0300_003V1) ---
  const elderlyData = [
    { year: 2015, value: 115065 },
    { year: 2016, value: 117294 },
    { year: 2017, value: 122717 },
    { year: 2018, value: 127941 },
    { year: 2019, value: 135596 },
    { year: 2020, value: 143781 },
    { year: 2021, value: 151939 },
    { year: 2022, value: 162327 },
    { year: 2023, value: 174635 },
    { year: 2024, value: 188072 },
    { year: 2025, value: 204790 },
  ];
  const elderlyChart = document.getElementById("elderly-chart");
  if (elderlyChart) renderElderlyChart(elderlyChart, elderlyData);

  // --- 3. ӨРТГИЙН СУДАЛГАА: доорх таамаглалыг өөрчилбөл слайдын бүх тоо дахин бодогдоно ---
  const costModel = {
    usdToMnt: 3596.01, // Монголбанкны албан ханш, 2026.10.15
    averageWage: 2726900, // ҮСХ, 2025 оны сарын дундаж цалин (₮)
    price: 9900, // ₮, 1 өрх, сард (таамаглал)
    families: 5000, // эхний жилийн зорилт ≈ Улаанбаатарын 490,501 өрхийн 1%
    // Gemini 3.1 Flash-Lite: $0.25 / 1M оролт, $1.50 / 1M гаралт токен.
    // Сард ≈ 600 AI харилцаа + 150 зураг тайлбар → 800K оролт, 100K гаралт
    geminiUsd: 0.8 * 0.25 + 0.1 * 1.5,
    // ElevenLabs v3 (монгол хэл дэмждэг цорын ганц загвар): $0.08 / 1,000 тэмдэгт,
    // сард 10,000 тэмдэгт (давтагдах замын зааврыг нэг удаа үүсгээд хадгална)
    voiceUsd: 10 * 0.08,
    // Vercel Pro ($20) + MongoDB Atlas M10 (≈$57) + газрын зургийн tile ≈ $100 / сар
    infraUsdMonthly: 100,
  };
  renderCostStudy(costModel);

  // --- 4. ДҮРС ТЭМДЭГ (vendor/lucide.min.js) ---
  if (window.lucide) lucide.createIcons();

  // --- 5. ТУРШИЛТЫН ВИДЕО: файл олдохгүй бол хаана хадгалахыг харуулна ---
  document.querySelectorAll(".slide-video").forEach((video) => {
    const markMissing = () => video.parentElement.classList.add("is-missing");
    video.addEventListener("error", markMissing);
    if (video.error) markMissing();
  });

  // --- 6. 1920×1080 ТАЙЗЫГ ДЭЛГЭЦЭНД ТААРУУЛАХ ---
  const stage = document.querySelector(".stage");
  function fitStage() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty("--scale", scale);
  }
  window.addEventListener("resize", fitStage);
  fitStage();

  // --- 7. СЛАЙД БОЛОН ДОТОРХ МӨРҮҮДИЙГ УДИРДАХ ЛОГИК ---
  const slides = document.querySelectorAll(".slide");
  const logo = document.getElementById("main-logo");
  const counter = document.getElementById("slide-counter");
  const progressBar = document.getElementById("progress-bar");

  let currentSlide = 0;
  let subStep = 0;

  // Слайд доторх data-step-тэй мөрүүд, дарааллаар нь
  function stepsOf(index) {
    return [...slides[index].querySelectorAll("[data-step]")].sort(
      (a, b) => a.dataset.step - b.dataset.step,
    );
  }

  function goToSlide(index, revealAll = false) {
    slides[currentSlide].classList.remove("active", "entered");
    slides[currentSlide].querySelectorAll("video").forEach((v) => v.pause());
    currentSlide = index;

    const slide = slides[currentSlide];
    const steps = stepsOf(currentSlide);
    steps.forEach((el) => el.classList.toggle("visible", revealAll));
    subStep = revealAll ? steps.length : 0;

    slide.classList.add("active");
    // Видеотой слайд руу ороход тоглуулна (хөтөч зөвшөөрөхгүй бол ▶ товчоор)
    slide.querySelectorAll("video").forEach((v) => v.play().catch(() => {}));
    // Дараагийн frame-д нэмснээр орох анимаци (асуултын тэмдэг, утас) дахин эхэлнэ
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (slide.classList.contains("active")) slide.classList.add("entered");
      }),
    );

    logo.className = slide.dataset.logo || "corner";
    const pad = (n) => String(n).padStart(2, "0");
    counter.textContent = `${pad(currentSlide + 1)} / ${pad(slides.length)}`;
    counter.classList.toggle("hidden", currentSlide === 0);
    progressBar.style.transform = `scaleX(${(currentSlide + 1) / slides.length})`;
    history.replaceState(null, "", `#${currentSlide + 1}`);
  }

  function handleNext() {
    const steps = stepsOf(currentSlide);
    if (subStep < steps.length) {
      steps[subStep].classList.add("visible");
      subStep++;
      return;
    }
    if (currentSlide < slides.length - 1) goToSlide(currentSlide + 1);
  }

  function handlePrev() {
    const steps = stepsOf(currentSlide);
    if (subStep > 0) {
      subStep--;
      steps[subStep].classList.remove("visible");
      return;
    }
    // Өмнөх слайд руу буцахад бүх мөр нь харагдсан байна
    if (currentSlide > 0) goToSlide(currentSlide - 1, true);
  }

  document.addEventListener("click", (e) => {
    // Холбоос, товч, видео дээр дарахад слайд солигдохгүй
    if (e.target.closest("a, button, video")) return;

    if (e.clientX > window.innerWidth / 2) {
      handleNext();
    } else {
      handlePrev();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest("a, button") && (e.key === "Enter" || e.key === " "))
      return;

    // Сум, Space, Enter, PageUp/PageDown (презентацийн clicker)
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
      e.preventDefault();
      handleNext();
    } else if (
      ["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)
    ) {
      e.preventDefault();
      handlePrev();
    } else if (e.key === "Home") {
      goToSlide(0);
    } else if (e.key === "End") {
      goToSlide(slides.length - 1, true);
    } else if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
  });

  // URL-ийн #дугаараар тухайн слайдыг шууд нээнэ (жишээ нь: index.html#7)
  const startSlide = parseInt(location.hash.slice(1), 10);
  if (startSlide >= 1 && startSlide <= slides.length) {
    goToSlide(startSlide - 1, startSlide > 1);
  } else {
    goToSlide(0);
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => stage.classList.remove("is-loading")),
  );
});

// Өртгийн судалгаа: costModel-оос картуудын тоо, үнийн задаргааны баганыг бөглөнө
function renderCostStudy(m) {
  const round10 = (n) => Math.round(n / 10) * 10;
  const tg = (n) => `${Math.round(n).toLocaleString("en-US")}₮`;
  const mln = (n) => `${n.toFixed(1)} сая ₮`;

  // Нэг өрхийн сарын зардал (10₮-өөр бөөрөнхийлөөд нийлбэрийг нь авна)
  const gemini = round10(m.geminiUsd * m.usdToMnt);
  const voice = round10(m.voiceUsd * m.usdToMnt);
  const infra = round10((m.infraUsdMonthly * m.usdToMnt) / m.families);
  const costPerFamily = gemini + voice + infra;
  const profitPerFamily = m.price - costPerFamily;

  // Бүх өрхийн сарын дүн (сая ₮, нэг оронтой)
  const revenueM = Math.round((m.price * m.families) / 1e5) / 10;
  const costM = Math.round((costPerFamily * m.families) / 1e5) / 10;
  const profitM = Math.round((revenueM - costM) * 10) / 10;

  const values = {
    families: `≈${m.families.toLocaleString("en-US")} өрх`,
    rateNote: `1 өрх, сард · 1$ = ${Math.round(m.usdToMnt).toLocaleString("en-US")}₮`,
    gemini: tg(gemini),
    voice: tg(voice),
    infra: tg(infra),
    costPerFamily: tg(costPerFamily),
    revenueNote: `${m.families.toLocaleString("en-US")} өрх, сард`,
    price: tg(m.price),
    wageShare: `(дундаж цалингийн ${((m.price / m.averageWage) * 100).toFixed(2)}%)`,
    revenue: mln(revenueM),
    totalCost: mln(costM),
    profit: mln(profitM),
    barTitle: `${tg(m.price)} хаашаа зарцуулагдах вэ?`,
    yearNote: `Жилд ≈${Math.round(profitM * 12)} сая ₮ ашиг`,
  };
  document.querySelectorAll("[data-cost]").forEach((el) => {
    el.textContent = values[el.dataset.cost];
  });

  const parts = [
    { label: "Gemini", value: gemini, color: "--cost-gemini" },
    { label: "ElevenLabs", value: voice, color: "--cost-voice" },
    { label: "Сервер", value: infra, color: "--cost-infra" },
    { label: "Ашиг", value: profitPerFamily, color: "--cost-profit" },
  ];
  const bar = document.getElementById("cost-bar");
  const legend = document.getElementById("cost-legend");
  parts.forEach((p) => {
    const pct = Math.round((p.value / m.price) * 100);
    const tip = `${tg(p.value)} · ${p.label} (${pct < 1 ? "<1" : pct}%)`;

    const seg = document.createElement("div");
    seg.className = "cost-seg";
    seg.style.flex = `${p.value} 0 0`;
    seg.style.background = `var(${p.color})`;
    seg.tabIndex = 0;
    seg.setAttribute("role", "img");
    seg.setAttribute("aria-label", tip);
    seg.dataset.tip = tip;
    bar.appendChild(seg);

    const item = document.createElement("span");
    const swatch = document.createElement("span");
    swatch.className = "cost-swatch";
    swatch.style.background = `var(${p.color})`;
    const value = document.createElement("strong");
    value.textContent = tg(p.value);
    item.append(swatch, `${p.label} `, value);
    legend.appendChild(item);
  });
}

// Талбайтай шугаман график (SVG) + hover/focus tooltip + дэлгэц уншигчид зориулсан хүснэгт
function renderElderlyChart(svg, data) {
  const NS = "http://www.w3.org/2000/svg";
  const [, , W, H] = svg.getAttribute("viewBox").split(" ").map(Number);
  const left = 64;
  const right = W - 40;
  const top = 48;
  const bottom = H - 52;
  const yMax = 220000;
  const ticks = [0, 50000, 100000, 150000, 200000];
  const last = data.length - 1;
  const step = (right - left - 40) / last;
  const x = (i) => left + 20 + i * step;
  const y = (v) => bottom - (v / yMax) * (bottom - top);
  const fmt = (n) => n.toLocaleString("en-US");

  const el = (tag, attrs, parent = svg) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.appendChild(node);
    return node;
  };
  const text = (content, attrs, parent) => {
    const node = el("text", attrs, parent);
    node.textContent = content;
    return node;
  };

  // Хэвтээ шугам, тэнхлэгийн тоо (мянгаар)
  ticks.forEach((t) => {
    const ty = Math.round(y(t)) + 0.5;
    el("line", {
      x1: left,
      x2: right,
      y1: ty,
      y2: ty,
      class: t === 0 ? "chart-baseline" : "chart-grid",
    });
    text(t / 1000, {
      x: left - 14,
      y: ty + 6,
      "text-anchor": "end",
      class: "chart-tick",
    });
  });
  data.forEach((d, i) => {
    if (i % 2 === 0) {
      text(d.year, {
        x: x(i),
        y: bottom + 34,
        "text-anchor": "middle",
        class: "chart-tick",
      });
    }
  });

  // Талбай ба шугам
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join("L");
  el("path", {
    d: `M${points}L${x(last)},${bottom}L${x(0)},${bottom}Z`,
    class: "chart-area",
  });
  const line = el("path", { d: `M${points}`, class: "chart-line" });
  line.style.setProperty("--len", line.getTotalLength());

  // Зөвхөн эхний ба сүүлийн утгыг шууд бичнэ
  const endIndexes = [0, last];
  const ends = endIndexes.map((i) => {
    const g = el("g", { class: "chart-end" });
    el(
      "circle",
      { cx: x(i), cy: y(data[i].value), r: 5, class: "chart-dot" },
      g,
    );
    text(
      (data[i].value / 1000).toFixed(1),
      {
        x: x(i),
        y: y(data[i].value) - 18,
        "text-anchor": "middle",
        class: "chart-label",
      },
      g,
    );
    return g;
  });

  // Hover давхарга: босоо шугам, цэг, tooltip
  const hover = el("g", { class: "chart-hover" });
  const cross = el(
    "line",
    { y1: top - 8, y2: bottom, class: "chart-crosshair" },
    hover,
  );
  const dot = el("circle", { r: 6, class: "chart-dot" }, hover);
  const tipBox = el("rect", { rx: 10, height: 64, class: "chart-tip" }, hover);
  const tipValue = text("", { class: "chart-tip-value" }, hover);
  const tipLabel = text("", { class: "chart-tip-label" }, hover);

  function show(i) {
    const px = x(i);
    const py = y(data[i].value);
    cross.setAttribute("x1", px);
    cross.setAttribute("x2", px);
    dot.setAttribute("cx", px);
    dot.setAttribute("cy", py);
    tipValue.textContent = `${fmt(data[i].value)} хүн`;
    tipLabel.textContent = `${data[i].year} он`;
    const w =
      Math.max(
        tipValue.getComputedTextLength(),
        tipLabel.getComputedTextLength(),
      ) + 32;
    const tx = Math.min(Math.max(px - w / 2, left), right - w);
    const ty = py - 64 - 18 < 0 ? py + 18 : py - 64 - 18;
    tipBox.setAttribute("x", tx);
    tipBox.setAttribute("y", ty);
    tipBox.setAttribute("width", w);
    tipValue.setAttribute("x", tx + 16);
    tipValue.setAttribute("y", ty + 28);
    tipLabel.setAttribute("x", tx + 16);
    tipLabel.setAttribute("y", ty + 50);
    ends.forEach((g, k) =>
      g.classList.toggle("is-hidden", endIndexes[k] === i),
    );
    hover.classList.add("is-visible");
  }
  function hide() {
    hover.classList.remove("is-visible");
    ends.forEach((g) => g.classList.remove("is-hidden"));
  }

  // Он бүрт багана хэлбэрийн hover/focus бүс (цэгээс том)
  data.forEach((d, i) => {
    const hit = el("rect", {
      x: x(i) - step / 2,
      y: top - 8,
      width: step,
      height: bottom - top + 8,
      tabindex: 0,
      role: "img",
      "aria-label": `${d.year} он: ${fmt(d.value)} хүн`,
      class: "chart-hit",
    });
    hit.addEventListener("pointerenter", () => show(i));
    hit.addEventListener("focus", () => show(i));
    hit.addEventListener("blur", hide);
  });
  svg.addEventListener("pointerleave", hide);

  // Дэлгэц уншигчид зориулсан хүснэгт (харагдахгүй)
  const table = document.createElement("table");
  table.className = "sr-only";
  table.createCaption().textContent = "65+ насны хүн ам, 2015–2025 он (ҮСХ)";
  const headRow = table.createTHead().insertRow();
  ["Он", "Хүн"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  const body = table.createTBody();
  data.forEach((d) => {
    const row = body.insertRow();
    row.insertCell().textContent = d.year;
    row.insertCell().textContent = fmt(d.value);
  });
  svg.after(table);
}
