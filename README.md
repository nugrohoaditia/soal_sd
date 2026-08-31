# ✏️ Super Kid Math: Addition & Subtraction Adventure

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Target Grade](https://img.shields.io/badge/Target-Grade%201--3%20(Anak%20SD)-FF69B4?style=for-the-badge)

Interactive, accessible, and gamified single-page web application game designed for young children (Grade 1-3 / ~7 years old) to practice **Addition (+) & Subtraction (-)** in a fun, rewarding environment.

---

## ✨ Features

- 🎨 **Child-Friendly Pastel UI/UX**: Soft colors (baby blue, light green, soft yellow, warm pink) with rounded jelly-bean shapes and zero sharp edges.
- 📐 **Vertical (Column) Stack Math**: Traditional math equation alignment format used in primary school education.
- 📱 **3-Column Virtual Jelly Keypad**: Custom on-screen numeric keyboard (1-9, Backspace ⌫, Submit ✓). Prevents native OS virtual keyboard popups on touch devices while fully supporting physical keyboard input on PCs.
- 🧮 **20 Dynamic Random Questions**:
  - Balanced mix of Addition and Subtraction.
  - Number difficulty progression spanning Units (1-9), Tens (10-99), and Hundreds (100-500).
  - **Subtraction Safety**: Guarantees `top_number >= bottom_number` so answers are never negative.
- 🌟 **Cute Character Feedback System**:
  - **Correct Answer**: Soft green glow, smiling **Sun** mascot ☀️, *"Hebat!"* speech bubble, pop-bounce animation, and cheerful audio chime.
  - **Incorrect Answer**: Soft red glow, confused **Bunny** mascot 🐰, *"Coba lagi ya!"* speech bubble, card shake animation, and auto-cleared input for retries.
- 🏆 **Celebratory End Screen**: Falling confetti particles, score percentage, star rewards, and a *"Mulai Lagi"* restart button to generate 20 new problems.
- 📱 **Responsive Flex Layout**: Max 2 columns on mobile devices, scaling seamlessly to 3-5 columns on tablets and desktop monitors.

---

## 🚀 How to Run Locally

No external dependencies, build tools, or node modules required!

1. Clone or download this repository:
   ```bash
   git clone https://github.com/nugrohoaditia/soal_sd.git
   cd soal_sd
   ```
2. Open `index.html` directly in any browser (Chrome, Edge, Firefox, Safari):
   ```bash
   # On Windows (PowerShell)
   Start-Process index.html
   ```

---

## 📁 File Structure

```text
soal_sd/
├── index.html     # Game HTML structure, top header, progress bar, grid container & modals
├── style.css      # CSS variables, animations, jelly buttons & responsive flex rules
├── script.js     # State management, math problem generator, keypad logic & Web Audio synth
└── README.md      # Project documentation
```

---

## ⚙️ Tech Stack

- **HTML5**: Semantic markup & ARIA attributes.
- **CSS3**: Custom properties, keyframe animations, Flexbox layout.
- **Vanilla JavaScript (ES6)**: State management, dynamic DOM manipulation, Web Audio API sound synthesizer.

---

## 📄 License

Distributed under the MIT License. Feel free to use, modify, and share!
