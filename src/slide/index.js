document.addEventListener("DOMContentLoaded", () => {
  // --- 1. БАГИЙН ГИШҮҮД ---
  const teamData = [
    { name: "А.Билгүүнэгс", role: "4A" },
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
      const memberHTML = `
                <div class="team-member">
                    <div class="avatar animated-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>
                    <div class="member-name">${member.name}</div>
                    <div class="member-role">${member.role}</div>
                </div>
            `;
      teamContainer.insertAdjacentHTML("beforeend", memberHTML);
    });
  }

  // --- 2. СЛАЙД БОЛОН ДОТОРХ МӨРҮҮДИЙГ УДИРДАХ ЛОГИК ---
  const slides = document.querySelectorAll(".slide");
  const logo = document.getElementById("main-logo");
  const heroText = document.querySelector(".hero-text-block");

  let currentSlide = 0;

  const problemItems = document.querySelectorAll(".problem-item");
  const statItems = document.querySelectorAll(".stat-item");
  const solutionItems = document.querySelectorAll(".solution-item");
  const goalItems = document.querySelectorAll(".goal-item");
  const archCardsNew = document.querySelectorAll(".arch-card-new");
  const usageCards = document.querySelectorAll(".usage-card");
  const demoItems = document.querySelectorAll(".demo-item");
  let subStep = 0;

  function updateLogoAndNav(index) {
    if (index === 0) {
      if (logo) {
        logo.classList.remove("corner");
        logo.classList.add("centered");
      }
      if (heroText) heroText.classList.remove("visible");
    } else {
      if (logo) {
        logo.classList.remove("centered");
        logo.classList.add("corner");
      }
      if (heroText) heroText.classList.add("visible");
    }
  }

  function goToSlide(index) {
    if (!slides.length) return;

    slides[currentSlide].classList.remove("active");

    if (currentSlide === 3) {
      slides[3].classList.remove("start-q-anim");
    }

    currentSlide = index;
    slides[currentSlide].classList.add("active");
    updateLogoAndNav(currentSlide);

    if (currentSlide === 3) {
      subStep = 0;
      setTimeout(() => {
        slides[3].classList.add("start-q-anim");
      }, 50);
    } else if (currentSlide >= 4 && currentSlide <= 9) {
      subStep = 0;
    }
  }

  function handleNext() {
    if (currentSlide === 3 && subStep < problemItems.length) {
      problemItems[subStep].classList.add("visible");
      subStep++;
      return;
    }
    if (currentSlide === 4 && subStep < statItems.length) {
      statItems[subStep].classList.add("visible");
      subStep++;
      return;
    }
    if (currentSlide === 5 && subStep < solutionItems.length) {
      solutionItems[subStep].classList.add("visible");
      subStep++;
      return;
    }
    if (currentSlide === 6 && subStep < goalItems.length) {
      goalItems[subStep].classList.add("visible");
      subStep++;
      return;
    }
    if (currentSlide === 7 && subStep < archCardsNew.length) {
      archCardsNew[subStep].classList.add("visible");
      subStep++;
      return;
    }
    if (currentSlide === 8 && subStep < usageCards.length) {
      usageCards[subStep].classList.add("visible");
      subStep++;
      return;
    }
    if (currentSlide === 9 && subStep < demoItems.length) {
      demoItems[subStep].classList.add("visible");
      subStep++;
      return;
    }

    let newIndex = (currentSlide + 1) % slides.length;
    goToSlide(newIndex);
  }

  function handlePrev() {
    if (currentSlide === 3 && subStep > 0) {
      subStep--;
      problemItems[subStep].classList.remove("visible");
      return;
    }
    if (currentSlide === 4 && subStep > 0) {
      subStep--;
      statItems[subStep].classList.remove("visible");
      return;
    }
    if (currentSlide === 5 && subStep > 0) {
      subStep--;
      solutionItems[subStep].classList.remove("visible");
      return;
    }
    if (currentSlide === 6 && subStep > 0) {
      subStep--;
      goalItems[subStep].classList.remove("visible");
      return;
    }
    if (currentSlide === 7 && subStep > 0) {
      subStep--;
      archCardsNew[subStep].classList.remove("visible");
      return;
    }
    if (currentSlide === 8 && subStep > 0) {
      subStep--;
      usageCards[subStep].classList.remove("visible");
      return;
    }
    if (currentSlide === 9 && subStep > 0) {
      subStep--;
      demoItems[subStep].classList.remove("visible");
      return;
    }

    let newIndex = (currentSlide - 1 + slides.length) % slides.length;
    goToSlide(newIndex);
  }

  document.addEventListener("click", (e) => {
    const screenWidth = window.innerWidth;
    const clickX = e.clientX;

    if (clickX > screenWidth / 2) {
      handleNext();
    } else {
      handlePrev();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      handleNext();
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlePrev();
    }
  });
});
