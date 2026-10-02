"use strict";

/* ================================================================
   DỮ LIỆU THÀNH VIÊN
   TODO: Nhóm chỉ cần thay nội dung trong 3 object dưới đây.
   Các character card và profile chi tiết sẽ tự động cập nhật.
================================================================ */
const TEAM_MEMBERS = [
  {
    name: "Trần Công Hoàng Tấn ",
    role: "Front end Developer",
    bio: "Hello mọi người mình là Tấn.",
    skills: ["[KỸ NĂNG 01]", "[KỸ NĂNG 02]", "[KỸ NĂNG 03]"],
    interests: "Mình muốn ra trường lương 1000 USD.",
    github: "#",
    linkedin: "#",
    palette: {
      background: "linear-gradient(145deg, #263022, #0d100c 72%)",
      skin: "#c8a17b",
      hair: "#232323",
      shirt: "#586f39"
    }
  },
  {
    name: "Nguyễn Hoàng Kim Ngân",
    role: "Project Manager",
    bio: "Hello mọi người mình là Ngân",
    skills: ["Project Management",
      "Full-stack Development",
      "Teamwork",
      "Problem Solving"],
    interests: "Mình muốn ra trường lương 1000 USD.",
    github: "#https://github.com/ZiziSora",
    linkedin: "#",
    palette: {
      background: "linear-gradient(145deg, #2d2922, #100f0c 72%)",
      skin: "#d9aa82",
      hair: "#161616",
      shirt: "#77715e"
    }
  },
  {
    name: "Trần Công Hoàng Tấn",
    role: "Backend Developer",
    bio: "Xin chào mọi người mình là ",
    skills: ["[KỸ NĂNG 01]", "[KỸ NĂNG 02]", "[KỸ NĂNG 03]"],
    interests: "Mình muốn ra trường lương 1000 USD.",
    github: "https://github.com/n0thing2c",
    linkedin: "#",
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

/** Chuyển số thành dạng 01, 02, 03. */
function formatIndex(index) {
  return String(index + 1).padStart(2, "0");
}

/** Gắn bảng màu riêng của từng nhân vật vào phần tử. */
function applyPalette(element, palette) {
  element.style.setProperty("--portrait-bg", palette.background);
  element.style.setProperty("--avatar-skin", palette.skin);
  element.style.setProperty("--avatar-hair", palette.hair);
  element.style.setProperty("--avatar-shirt", palette.shirt);
}

/** Tạo 3 character card từ mảng TEAM_MEMBERS. */
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

/** Đồng bộ character card đang được chọn trên desktop và mobile. */
function setActiveMember(index, shouldFocus = false) {
  selectedMemberIndex = (index + TEAM_MEMBERS.length) % TEAM_MEMBERS.length;

  document.querySelectorAll(".member-card").forEach((card, cardIndex) => {
    const isActive = cardIndex === selectedMemberIndex;
    card.classList.toggle("is-mobile-active", isActive);
    card.classList.toggle("is-keyboard-active", isActive);
    card.tabIndex = isActive ? 0 : -1;
  });

  currentMemberLabel.textContent = formatIndex(selectedMemberIndex);

  if (shouldFocus) {
    document.querySelector(`[data-member-index="${selectedMemberIndex}"]`)?.focus();
  }
}

/** Đổ dữ liệu thành viên vào hộp thoại hồ sơ. */
function updateProfile(index) {
  const member = TEAM_MEMBERS[index];
  const portrait = document.querySelector("#profile-portrait");

  document.querySelector("#profile-count").textContent = `PLAYER ${formatIndex(index)} / ${formatIndex(TEAM_MEMBERS.length)}`;
  document.querySelector("#profile-index").textContent = formatIndex(index);
  document.querySelector("#profile-role").textContent = member.role;
  document.querySelector("#profile-name").textContent = member.name;
  document.querySelector("#profile-bio").textContent = member.bio;
  document.querySelector("#profile-interests").textContent = member.interests;
  document.querySelector("#profile-github").href = member.github;
  document.querySelector("#profile-linkedin").href = member.linkedin;
  document.querySelector("#profile-skills").innerHTML = member.skills
    .map((skill) => `<li>${skill}</li>`)
    .join("");

  applyPalette(portrait, member.palette);
}

/** Mở profile và đưa focus vào nút Back. */
function openProfile(index) {
  selectedMemberIndex = index;
  lastFocusedElement = document.activeElement;
  updateProfile(index);
  profileModal.hidden = false;
  document.body.classList.add("modal-open");

  requestAnimationFrame(() => {
    if (window.gsap && !prefersReducedMotion) {
      gsap.fromTo(
        ".profile-panel",
        { opacity: 0, scale: 0.975, y: 18 },
        { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: "power3.out" }
      );
      gsap.fromTo(
        ".profile-data > *",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.38, stagger: 0.045, delay: 0.12, ease: "power2.out" }
      );
    }
    document.querySelector(".profile-close").focus();
  });
}

/** Đóng profile và trả focus về character card trước đó. */
function closeProfile() {
  const finishClose = () => {
    profileModal.hidden = true;
    document.body.classList.remove("modal-open");
    lastFocusedElement?.focus();
  };

  if (window.gsap && !prefersReducedMotion) {
    gsap.to(".profile-panel", {
      opacity: 0,
      scale: 0.985,
      y: 12,
      duration: 0.22,
      ease: "power2.in",
      onComplete: finishClose
    });
  } else {
    finishClose();
  }
}

/** Chuyển profile mà không đóng hộp thoại. */
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

/** Giữ focus bên trong profile khi người dùng nhấn Tab. */
function trapProfileFocus(event) {
  const focusable = [...profileModal.querySelectorAll("button, a[href]")]
    .filter((element) => !element.hasAttribute("disabled"));
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

renderMemberCards();

// Khởi tạo icon sau khi nội dung động đã được tạo.
if (window.lucide) {
  lucide.createIcons();
}

// Click/Enter trên member card để mở profile.
memberGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".member-card");
  if (!card) return;
  openProfile(Number(card.dataset.memberIndex));
});

// Điều hướng character card bằng cả 4 phím mũi tên.
memberGrid.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  setActiveMember(selectedMemberIndex + direction, true);
});

// Nút Previous/Next cho carousel trên mobile.
document.querySelector(".carousel-control--prev").addEventListener("click", () => {
  setActiveMember(selectedMemberIndex - 1);
});

document.querySelector(".carousel-control--next").addEventListener("click", () => {
  setActiveMember(selectedMemberIndex + 1);
});

// Các điều khiển trong profile.
document.querySelectorAll("[data-close-profile]").forEach((element) => {
  element.addEventListener("click", closeProfile);
});

document.querySelector("#profile-prev").addEventListener("click", () => switchProfile(-1));
document.querySelector("#profile-next").addEventListener("click", () => switchProfile(1));

// Escape đóng profile; Arrow trái/phải chuyển thành viên; Tab được giữ trong dialog.
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

// Cập nhật trạng thái menu theo section đang xuất hiện trên màn hình.
const navSections = [...document.querySelectorAll("#team, #quests, #contact")];
const navLinks = [...document.querySelectorAll(".site-nav__link")];

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
    });
  });
}, { rootMargin: "-35% 0px -55%", threshold: 0 });

navSections.forEach((section) => sectionObserver.observe(section));

// Animation mở đầu nhẹ bằng GSAP, có tôn trọng prefers-reduced-motion.
if (window.gsap && !prefersReducedMotion) {
  gsap.from(".site-header", { opacity: 0, y: -18, duration: 0.55, ease: "power2.out" });
  gsap.from(".reveal-item", {
    opacity: 0,
    y: 28,
    duration: 0.72,
    stagger: 0.085,
    delay: 0.12,
    ease: "power3.out"
  });
}
