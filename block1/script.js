"use strict";

const TEAM_MEMBERS = [
  {
    name: "Trần Công Hoàng Tấn",
    role: "Front-end Developer",
    bio: "Tấn tập trung biến bản thiết kế thành giao diện rõ ràng, dễ dùng và hoạt động ổn định trên nhiều kích thước màn hình. Cậu đặc biệt chú ý đến chi tiết thị giác và cảm giác khi người dùng tương tác.",
    skills: ["HTML5", "CSS3", "JavaScript", "Responsive UI"],
    interests: "Giao diện tương tác, chuyển động trên web và tối ưu trải nghiệm người dùng.",
    github: "https://github.com/24127237",
    linkedin: "",
    palette: {
      background: "linear-gradient(145deg, #263022, #0d100c 72%)",
      skin: "#c8a17b",
      hair: "#232323",
      shirt: "#586f39"
    }
  },
  {
    name: "Nguyễn Hoàng Kim Ngân",
    role: "Project Manager / Full-stack",
    bio: "Ngân phụ trách kết nối ý tưởng, tiến độ và các phần việc của nhóm. Bên cạnh điều phối dự án, cô tham gia phát triển cả giao diện lẫn xử lý dữ liệu để sản phẩm giữ được sự nhất quán từ đầu đến cuối.",
    skills: ["Project Planning", "JavaScript", "Node.js", "Git / GitHub"],
    interests: "Tổ chức quy trình làm việc, xây dựng sản phẩm có mục tiêu rõ ràng và giúp mọi thành viên phát huy thế mạnh.",
    github: "https://github.com/ZiziSora",
    linkedin: "",
    palette: {
      background: "linear-gradient(145deg, #2d2922, #100f0c 72%)",
      skin: "#d9aa82",
      hair: "#161616",
      shirt: "#77715e"
    }
  },
  {
    name: "Trần Nguyễn Duy Thịnh",
    role: "Back-end Developer",
    bio: "Thịnh xây dựng phần logic và luồng dữ liệu phía sau sản phẩm. Cậu hướng đến những API có cấu trúc dễ hiểu, dễ bảo trì và đủ linh hoạt để nhóm tiếp tục mở rộng tính năng.",
    skills: ["Node.js", "Express.js", "REST API", "MongoDB"],
    interests: "Thiết kế API, quản lý dữ liệu và cải thiện độ ổn định, bảo mật của hệ thống.",
    github: "https://github.com/n0thing2c",
    linkedin: "",
    palette: {
      background: "linear-gradient(145deg, #202b30, #0c0f11 72%)",
      skin: "#b98868",
      hair: "#27221f",
      shirt: "#425f6b"
    }
  }
];

const memberGrid = document.querySelector("#member-grid");
const profileModal = document.querySelector("#profile-modal");
const currentMemberLabel = document.querySelector("#current-member");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let selectedMemberIndex = 0;
let lastFocusedElement = null;

function formatIndex(index) {
  return String(index + 1).padStart(2, "0");
}

function applyPalette(element, palette) {
  element.style.setProperty("--portrait-bg", palette.background);
  element.style.setProperty("--avatar-skin", palette.skin);
  element.style.setProperty("--avatar-hair", palette.hair);
  element.style.setProperty("--avatar-shirt", palette.shirt);
}

function renderMemberCards() {
  memberGrid.innerHTML = TEAM_MEMBERS.map((member, index) => `
    <button
      class="member-card${index === 0 ? " is-mobile-active is-keyboard-active" : ""}"
      type="button"
      data-member-index="${index}"
      aria-label="Xem hồ sơ ${member.name}"
      tabindex="${index === 0 ? "0" : "-1"}"
    >
      <div class="member-card__portrait">
        <span class="member-card__code">PLAYER_${formatIndex(index)}</span>
        <div class="pixel-avatar" aria-hidden="true">
          <span class="pixel-avatar__head"></span>
          <span class="pixel-avatar__body"></span>
        </div>
      </div>
      <div class="member-card__content">
        <p class="member-card__role">${member.role}</p>
        <h3>${member.name}</h3>
        <span class="member-card__view">
          VIEW PROFILE
          <i data-lucide="corner-down-right" aria-hidden="true"></i>
        </span>
      </div>
    </button>
  `).join("");

  document.querySelectorAll(".member-card").forEach((card, index) => {
    applyPalette(card, TEAM_MEMBERS[index].palette);
  });
}

function setActiveMember(index, shouldFocus = false) {
  selectedMemberIndex = (index + TEAM_MEMBERS.length) % TEAM_MEMBERS.length;

  document.querySelectorAll(".member-card").forEach((card, cardIndex) => {
    const isActive = cardIndex === selectedMemberIndex;
    card.classList.toggle("is-mobile-active", isActive);
    card.classList.toggle("is-keyboard-active", isActive);
    card.tabIndex = isActive ? 0 : -1;
  });

  currentMemberLabel.textContent = formatIndex(selectedMemberIndex);
  const activeCard = document.querySelector(`[data-member-index="${selectedMemberIndex}"]`);

  if (shouldFocus) activeCard?.focus();

  if (window.innerWidth <= 640 && window.gsap && !prefersReducedMotion && activeCard) {
    gsap.fromTo(activeCard, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.32, ease: "power2.out" });
  }
}

function updateProfile(index) {
  const member = TEAM_MEMBERS[index];
  const portrait = document.querySelector("#profile-portrait");
  const linkedinLink = document.querySelector("#profile-linkedin");

  document.querySelector("#profile-count").textContent = `PLAYER ${formatIndex(index)} / ${String(TEAM_MEMBERS.length).padStart(2, "0")}`;
  document.querySelector("#profile-index").textContent = formatIndex(index);
  document.querySelector("#profile-role").textContent = member.role;
  document.querySelector("#profile-name").textContent = member.name;
  document.querySelector("#profile-bio").textContent = member.bio;
  document.querySelector("#profile-interests").textContent = member.interests;
  document.querySelector("#profile-github").href = member.github;
  document.querySelector("#profile-skills").innerHTML = member.skills.map((skill) => `<li>${skill}</li>`).join("");

  linkedinLink.hidden = !member.linkedin;
  if (member.linkedin) linkedinLink.href = member.linkedin;

  applyPalette(portrait, member.palette);
}

function openProfile(index) {
  selectedMemberIndex = index;
  lastFocusedElement = document.activeElement;
  updateProfile(index);
  profileModal.hidden = false;
  document.body.classList.add("modal-open");

  requestAnimationFrame(() => {
    if (window.gsap && !prefersReducedMotion) {
      gsap.fromTo(".profile-panel", { opacity: 0, scale: 0.975, y: 18 }, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "power3.out" });
      gsap.fromTo(".profile-data > *", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.38, stagger: 0.045, delay: 0.12, ease: "power2.out" });
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

  if (window.gsap && !prefersReducedMotion) {
    gsap.to(".profile-panel", { opacity: 0, scale: 0.985, y: 12, duration: 0.22, ease: "power2.in", onComplete: finishClose });
  } else {
    finishClose();
  }
}

function switchProfile(direction) {
  selectedMemberIndex = (selectedMemberIndex + direction + TEAM_MEMBERS.length) % TEAM_MEMBERS.length;
  setActiveMember(selectedMemberIndex);
  updateProfile(selectedMemberIndex);

  if (window.gsap && !prefersReducedMotion) {
    gsap.fromTo(
      ["#profile-name", "#profile-role", "#profile-bio", ".profile-portrait__figure"],
      { opacity: 0, x: direction > 0 ? 22 : -22 },
      { opacity: 1, x: 0, duration: 0.32, stagger: 0.035, ease: "power2.out" }
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

function initScrollReveal() {
  if (prefersReducedMotion || !("IntersectionObserver" in window)) return;

  document.body.classList.add("motion-ready");
  const revealTargets = document.querySelectorAll(
    ".team-select .section-heading, .member-card, .quests .section-heading, .quest-card, .contact > .section-index, .contact__inner, .site-footer"
  );

  revealTargets.forEach((element, index) => {
    element.classList.add("scroll-reveal");
    element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
  });

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -10%", threshold: 0.12 });

  revealTargets.forEach((element) => revealObserver.observe(element));
}

function initCardTilt() {
  if (prefersReducedMotion || !window.matchMedia("(pointer: fine)").matches) return;

  document.querySelectorAll(".member-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const bounds = card.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const rotateY = ((x / bounds.width) - 0.5) * 5;
      const rotateX = (0.5 - (y / bounds.height)) * 5;

      card.style.setProperty("--pointer-x", `${x}px`);
      card.style.setProperty("--pointer-y", `${y}px`);
      card.style.setProperty("--rotate-x", `${rotateX.toFixed(2)}deg`);
      card.style.setProperty("--rotate-y", `${rotateY.toFixed(2)}deg`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rotate-x", "0deg");
      card.style.setProperty("--rotate-y", "0deg");
    });
  });
}

function initHeroParallax() {
  if (prefersReducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
  const hero = document.querySelector(".hero");

  hero.addEventListener("pointermove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 12;
    const y = (event.clientY / window.innerHeight - 0.5) * 12;
    hero.style.setProperty("--hero-shift-x", `${x.toFixed(1)}px`);
    hero.style.setProperty("--hero-shift-y", `${y.toFixed(1)}px`);
  });
}

renderMemberCards();

if (window.lucide) lucide.createIcons();

initScrollReveal();
initCardTilt();
initHeroParallax();

memberGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".member-card");
  if (!card) return;
  openProfile(Number(card.dataset.memberIndex));
});

memberGrid.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  setActiveMember(selectedMemberIndex + direction, true);
});

document.querySelector(".carousel-control--prev").addEventListener("click", () => setActiveMember(selectedMemberIndex - 1));
document.querySelector(".carousel-control--next").addEventListener("click", () => setActiveMember(selectedMemberIndex + 1));

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

const navSections = [...document.querySelectorAll("#team, #quests, #contact")];
const navLinks = [...document.querySelectorAll(".site-nav__link")];
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`));
  });
}, { rootMargin: "-35% 0px -55%", threshold: 0 });

navSections.forEach((section) => sectionObserver.observe(section));

if (window.gsap && !prefersReducedMotion) {
  gsap.from(".site-header", { opacity: 0, y: -18, duration: 0.55, ease: "power2.out" });
  gsap.from(".reveal-item", { opacity: 0, y: 28, duration: 0.72, stagger: 0.085, delay: 0.12, ease: "power3.out" });
}
