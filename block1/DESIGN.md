# Team Portfolio: "Select Your Developer" - Design Specification

## 1. Concept Overview
The portfolio adopts a "Team as Game / Select Your Developer" concept. It merges the interactive, engaging feel of a modern video game character-selection screen with the clean, structured presentation of a professional developer portfolio. 

**Vibe:** Futuristic, minimal, technical, and youthful. 
**Avoid:** Fantasy/RPG tropes (no fake stats like "Strength: +10"), cluttered interfaces, or excessively bright neon aesthetics.

---

## 2. Design System

### 2.1. Color Palette
The color scheme relies on high-contrast dark mode with a single, striking accent color to guide user focus.

| Role | Hex Code | Usage |
| :--- | :--- | :--- |
| **Main Background** | `#0B0B0B` | Deepest background layer (body, main containers). |
| **Surfaces / Cards** | `#151515` | Elevated elements (character cards, project cards, modals). |
| **Primary Text** | `#F5F5F0` | Headings, active states, important data. |
| **Secondary Text** | `#8A8A8A` | Body copy, descriptions, inactive states, subtle labels. |
| **Accent / Highlight** | `#C7FF3D` | Interactive elements, focus outlines, hover states, primary calls-to-action. |

### 2.2. Typography
A dual-font system is used to separate display text (technical/gaming feel) from reading text (legibility).

*   **Display / Interface Font:** `Space Grotesk`
    *   *Usage:* Headings, Developer Names, Numbers, Navigation items, Buttons.
    *   *Weight:* Semi-bold / Bold.
*   **Body Font:** `Inter`
    *   *Usage:* Body text, paragraphs, short bios, project descriptions.
    *   *Weight:* Regular / Medium.

---

## 3. Main Screens & Layouts

### 3.1. Character Select (Landing Screen)
*   **Title:** "SELECT YOUR DEVELOPER" (Space Grotesk, centered, subtle tracking).
*   **Desktop Layout:** A balanced 2×2 grid of character cards.
*   **Mobile Layout:** A focused single-character view (carousel style) with obvious "Previous" and "Next" indicator arrows.
*   **Card Anatomy:**
    *   Large, high-quality portrait (desaturated or dramatically lit).
    *   Developer Name (Primary text).
    *   Role / Title (Secondary text, e.g., "Frontend Engineer").
*   **Interaction:** Hovering triggers an accent border (`#C7FF3D`), scales the image slightly (1.02x), and reveals a "VIEW PROFILE" indicator.

### 3.2. Character Profile
*   **Layout:** Full-screen overlay or distinct page transition.
*   **Desktop Layout:** Two-column split. Left: Large Portrait. Right: Developer data.
*   **Mobile Layout:** Single-column, scrollable vertically.
*   **Content:**
    *   **Header:** Developer Name & Role/Class.
    *   **Bio:** Short, punchy summary (Inter).
    *   **Tech Stack:** Badges or a clean list of technologies.
    *   **Specialty/Interests:** What drives them.
*   **Navigation:** Include a clear "BACK" action (Escape key mapping) and "PREV/NEXT" member toggles at the edges of the screen.

### 3.3. Quests (Projects Section)
*   **Concept:** Projects are presented as "QUESTS".
*   **Desktop Layout:** Horizontal project cards (Image on one side, text on the other).
*   **Mobile Layout:** Vertical stacking (Image on top, text below).
*   **Content per Quest:**
    *   Project Thumbnail/Image.
    *   Quest Title & Description.
    *   Tech Stack used.
    *   Specific Contribution.
    *   Action links: GitHub / Live Demo (styled as primary/secondary buttons).

---

## 4. Interaction & Accessibility

The interface must be fully navigable via keyboard, mimicking a true game menu experience while adhering to web accessibility standards.

### 4.1. Keyboard Controls
*   **Arrow Keys (Up/Down/Left/Right):** Navigate between character cards on the grid or carousel.
*   **Enter / Spacebar:** Confirm selection (Open Profile, View Project).
*   **Escape:** Close current view, go back to Character Select.
*   **Tab:** Standard focus management for form elements/links within profiles and projects.

### 4.2. Animation Guidelines
Animations should feel responsive, smooth, and purposeful (no unnecessary delays). Use CSS transitions or GSAP.
*   **Duration:** Generally `300ms` - `500ms`.
*   **Easing:** Use custom cubic-bezier (e.g., `cubic-bezier(0.2, 0.8, 0.2, 1)`) for a snappy, modern feel.
*   **Card Hover:** Subtle scale up (1.02x) + `#C7FF3D` border/glow fade-in.
*   **Profile Reveal:** Fast slide-in or scale-fade from the clicked card's position.

### 4.3. Accessibility (a11y)
*   Use semantic HTML (`<main>`, `<section>`, `<article>`, `<button>`, `<a>`).
*   Ensure all interactive elements have an `aria-label` where text is not explicitly clear.
*   Focus states must be highly visible (utilizing the `#C7FF3D` accent color).

---

## 5. Technical Stack

*   **Markup:** HTML5 (Semantic, structural).
*   **Styling:** CSS3 (CSS Variables for the design system, Flexbox/Grid for layout, Media Queries for the strict Desktop/Mobile divergence).
*   **Logic:** Vanilla JavaScript (ES6+). No React or heavy frameworks. Focus on clean DOM manipulation and event delegation.
*   **Icons (Optional):** Lucide Icons (lightweight, clean stroke SVGs).
*   **Animation (Optional):** GSAP (for complex sequence animations) or CSS Keyframes (for simple interactions).