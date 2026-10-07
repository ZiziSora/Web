"use strict";

const TEAM_MEMBERS = [
  {
    name: "Trần Công Hoàng Tấn",
    role: "Front-end Developer",
    cardBio: "Biến thiết kế thành giao diện có nhịp điệu, rõ ràng và thân thiện trên mọi màn hình.",
    bio: "Tấn tập trung biến bản thiết kế thành giao diện rõ ràng, dễ dùng và hoạt động ổn định trên nhiều kích thước màn hình. Cậu đặc biệt chú ý đến chi tiết thị giác và cảm giác khi người dùng tương tác.",
    skills: ["HTML5", "CSS3", "JavaScript", "Responsive UI"],
    interests: "Giao diện tương tác, chuyển động trên web và tối ưu trải nghiệm người dùng.",
    github: "https://github.com/24127237",
    color: "#a96356"
  },
  {
    name: "Nguyễn Hoàng Kim Ngân",
    role: "Project Manager / Full-stack",
    cardBio: "Kết nối mục tiêu, con người và từng phần của sản phẩm thành một hướng đi thống nhất.",
    bio: "Ngân phụ trách kết nối ý tưởng, tiến độ và các phần việc của nhóm. Bên cạnh điều phối dự án, cô tham gia phát triển cả giao diện lẫn xử lý dữ liệu để sản phẩm giữ được sự nhất quán từ đầu đến cuối.",
    skills: ["Project Planning", "JavaScript", "Node.js", "Git / GitHub"],
    interests: "Tổ chức quy trình làm việc, xây dựng sản phẩm có mục tiêu rõ ràng và giúp mọi thành viên phát huy thế mạnh.",
    github: "",
    color: "#c9b990"
  },
  {
    name: "Trần Nguyễn Duy Thịnh",
    role: "Back-end Developer",
    cardBio: "Xây dựng logic, API và luồng dữ liệu vững chắc để sản phẩm có thể phát triển lâu dài.",
    bio: "Thịnh xây dựng phần logic và luồng dữ liệu phía sau sản phẩm. Cậu hướng đến những API có cấu trúc dễ hiểu, dễ bảo trì và đủ linh hoạt để nhóm tiếp tục mở rộng tính năng.",
    skills: ["Node.js", "Express.js", "REST API", "MongoDB"],
    interests: "Thiết kế API, quản lý dữ liệu và cải thiện độ ổn định, bảo mật của hệ thống.",
    github: "",
    color: "#9fb4a5"
  }
];

const memberList = document.querySelector("#member-list");
const profileModal = document.querySelector("#profile-modal");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let selectedMemberIndex = 0;
let lastFocusedElement = null;
let motionPaused = prefersReducedMotion;

function formatIndex(index) {
  return String(index + 1).padStart(2, "0");
}

function renderMembers() {
  memberList.innerHTML = TEAM_MEMBERS.map((member, index) => `
    <button
      class="member-card"
      type="button"
      data-member-index="${index}"
      data-cursor="VIEW"
      data-reveal
      aria-label="Xem hồ sơ ${member.name}"
      style="--member-color: ${member.color}"
    >
      <span class="member-card__index">${formatIndex(index)}</span>
      <span class="member-card__avatar" aria-hidden="true">
        <span class="member-avatar__eyes"></span>
        <span class="member-avatar__smile"></span>
      </span>
      <span class="member-card__title">
        <h3>${member.name}</h3>
        <p>${member.role}</p>
      </span>
      <span class="member-card__bio">${member.cardBio}</span>
      <span class="member-card__action" aria-hidden="true">
        <i data-lucide="arrow-up-right"></i>
      </span>
    </button>
  `).join("");
}

function updateProfile(index) {
  const member = TEAM_MEMBERS[index];
  const portrait = document.querySelector("#profile-portrait");
  const githubLink = document.querySelector("#profile-github");

  document.querySelector("#profile-count").textContent = `PLAYER ${formatIndex(index)} / ${String(TEAM_MEMBERS.length).padStart(2, "0")}`;
  document.querySelector("#profile-index").textContent = formatIndex(index);
  document.querySelector("#profile-role").textContent = member.role;
  document.querySelector("#profile-name").textContent = member.name;
  document.querySelector("#profile-bio").textContent = member.bio;
  document.querySelector("#profile-interests").textContent = member.interests;
  document.querySelector("#profile-skills").innerHTML = member.skills.map((skill) => `<li>${skill}</li>`).join("");
  githubLink.hidden = !member.github;
  if (member.github) githubLink.href = member.github;
  portrait.style.setProperty("--member-color", member.color);
}

function openProfile(index) {
  selectedMemberIndex = index;
  lastFocusedElement = document.activeElement;
  updateProfile(index);
  profileModal.hidden = false;
  document.body.classList.add("modal-open");

  requestAnimationFrame(() => {
    if (window.gsap && !motionPaused) {
      gsap.fromTo(".profile-panel", { yPercent: 105 }, { yPercent: 0, duration: 0.72, ease: "power4.out" });
      gsap.fromTo(".profile-data > *", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, delay: 0.34, ease: "power3.out" });
      gsap.fromTo(".profile-face", { scale: 0.65, rotate: -18 }, { scale: 1, rotate: -4, duration: 0.7, delay: 0.22, ease: "back.out(1.5)" });
    }
    document.querySelector(".profile-close").focus();
  });
}

function closeProfile() {
  const finishClose = () => {
    profileModal.hidden = true;
    document.body.classList.remove("modal-open");
    lastFocusedElement?.focus();
  };

  if (window.gsap && !motionPaused) {
    gsap.to(".profile-panel", { yPercent: 105, duration: 0.48, ease: "power3.in", onComplete: finishClose });
  } else {
    finishClose();
  }
}

function switchProfile(direction) {
  selectedMemberIndex = (selectedMemberIndex + direction + TEAM_MEMBERS.length) % TEAM_MEMBERS.length;
  updateProfile(selectedMemberIndex);

  if (window.gsap && !motionPaused) {
    gsap.fromTo(
      ["#profile-name", "#profile-role", "#profile-bio", ".profile-face"],
      { opacity: 0, x: direction > 0 ? 36 : -36 },
      { opacity: 1, x: 0, duration: 0.45, stagger: 0.05, ease: "power3.out" }
    );
  }
}

function trapProfileFocus(event) {
  const focusable = [...profileModal.querySelectorAll("button, a[href]")]
    .filter((element) => !element.hasAttribute("disabled") && !element.hidden);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function initLoader() {
  const loader = document.querySelector(".page-loader");
  const counter = document.querySelector(".page-loader__count");
  const line = document.querySelector(".page-loader__line");
  document.body.classList.add("is-loading");

  const finish = () => {
    loader.classList.add("is-finished");
    document.body.classList.remove("is-loading");
    playHeroIntro();
  };

  if (!window.gsap || motionPaused) {
    counter.textContent = "100";
    line.style.width = "100%";
    finish();
    return;
  }

  const countState = { value: 0 };
  const timeline = gsap.timeline({ onComplete: finish });
  timeline
    .to(countState, {
      value: 100,
      duration: 0.9,
      ease: "power2.inOut",
      onUpdate: () => { counter.textContent = String(Math.round(countState.value)).padStart(3, "0"); }
    })
    .to(line, { width: "100%", duration: 0.9, ease: "power2.inOut" }, 0)
    .to(loader, { yPercent: -100, duration: 0.78, ease: "power4.inOut" }, "+=0.12");
}

function playHeroIntro() {
  if (!window.gsap || motionPaused) return;

  gsap.fromTo(".hero__title span", { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, stagger: 0.1, ease: "power4.out" });
  gsap.fromTo(".hero-doodle", { scale: 0.4, opacity: 0, rotate: -12 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.1, delay: 0.35, ease: "back.out(1.35)" });
  gsap.fromTo([".hero__eyebrow", ".hero__side", ".hero__bottom"], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.65, stagger: 0.08, delay: 0.6, ease: "power3.out" });
}

function initScrollReveal() {
  const targets = [...document.querySelectorAll("[data-reveal]")];

  if (motionPaused || !("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  document.body.classList.add("motion-ready");
  targets.forEach((target, index) => target.style.setProperty("--reveal-delay", `${Math.min(index % 3, 2) * 70}ms`));

  const observer = new IntersectionObserver((entries, revealObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -10%", threshold: 0.12 });

  targets.forEach((target) => observer.observe(target));
}

function initScrollProgress() {
  const progress = document.querySelector(".scroll-progress");

  const update = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    progress.style.transform = `scaleX(${Math.min(Math.max(ratio, 0), 1)})`;
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

function initCursor() {
  if (motionPaused || !window.matchMedia("(pointer: fine)").matches) return;

  const cursor = document.querySelector(".cursor-orb");
  const label = cursor.querySelector("span");

  window.addEventListener("pointermove", (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });

  document.querySelectorAll("[data-cursor]").forEach((element) => {
    element.addEventListener("pointerenter", () => {
      label.textContent = element.dataset.cursor;
      cursor.classList.add("is-visible");
    });
    element.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
  });
}

function initHeroParallax() {
  if (motionPaused || !window.gsap || !window.matchMedia("(pointer: fine)").matches) return;
  const hero = document.querySelector(".hero");

  hero.addEventListener("pointermove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 20;
    const y = (event.clientY / window.innerHeight - 0.5) * 16;
    gsap.to(".hero-doodle", { x: x, y: y, duration: 1.1, ease: "power3.out", overwrite: "auto" });
    gsap.to(".hero__title span:first-child", { x: -x * 0.35, duration: 1.2, ease: "power3.out", overwrite: "auto" });
    gsap.to(".hero__title span:last-child", { x: x * 0.35, duration: 1.2, ease: "power3.out", overwrite: "auto" });
  });
}

function initLocalTime() {
  const timeElement = document.querySelector("#local-time");
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const update = () => {
    const now = new Date();
    timeElement.textContent = formatter.format(now);
    timeElement.dateTime = now.toISOString();
  };

  update();
  window.setInterval(update, 30000);
}

function initMotionToggle() {
  const toggle = document.querySelector("#motion-toggle");

  if (motionPaused) {
    document.body.classList.add("motion-off");
    toggle.textContent = "MOTION OFF";
    toggle.setAttribute("aria-pressed", "true");
  }

  toggle.addEventListener("click", () => {
    motionPaused = !motionPaused;
    document.body.classList.toggle("motion-off", motionPaused);
    toggle.textContent = motionPaused ? "MOTION OFF" : "MOTION ON";
    toggle.setAttribute("aria-pressed", String(motionPaused));
  });
}

function initNavigation() {
  if (!("IntersectionObserver" in window)) return;

  const sections = [...document.querySelectorAll("#team, #work, #process, #contact")];
  const links = [...document.querySelectorAll(".site-nav a")];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`));
    });
  }, { rootMargin: "-35% 0px -55%", threshold: 0 });

  sections.forEach((section) => observer.observe(section));
}

renderMembers();

if (window.lucide) lucide.createIcons();

initLoader();
initScrollReveal();
initScrollProgress();
initCursor();
initHeroParallax();

memberList.addEventListener("click", (event) => {
  const card = event.target.closest(".member-card");
  if (!card) return;
  openProfile(Number(card.dataset.memberIndex));
});

document.querySelectorAll("[data-close-profile]").forEach((element) => element.addEventListener("click", closeProfile));
document.querySelector("#profile-prev").addEventListener("click", () => switchProfile(-1));
document.querySelector("#profile-next").addEventListener("click", () => switchProfile(1));

document.addEventListener("keydown", (event) => {
  if (profileModal.hidden) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeProfile();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    switchProfile(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    switchProfile(1);
  } else if (event.key === "Tab") {
    trapProfileFocus(event);
  }
});
