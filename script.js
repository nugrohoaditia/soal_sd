/* ==========================================================================
   Super Kid Math Adventure - Game Logic & State Management
   ========================================================================== */

(function () {
  'use strict';

  // --- Constants & Config ---
  const TOTAL_QUESTIONS = 20;
  const OPERATORS = ['+', '-'];

  // --- State Variables ---
  let questions = [];
  let activeIndex = 0;
  let totalAttempts = 0;

  // --- Web Audio API Synth Sound System ---
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    initAudio();
    if (!audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'success') {
        // Cheerful Arpeggio C5 -> E5 -> G5 -> C6
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const noteOsc = audioCtx.createOscillator();
          const noteGain = audioCtx.createGain();
          noteOsc.type = 'triangle';
          noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
          
          noteGain.gain.setValueAtTime(0, now + idx * 0.08);
          noteGain.gain.linearRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
          
          noteOsc.connect(noteGain);
          noteGain.connect(audioCtx.destination);
          noteOsc.start(now + idx * 0.08);
          noteOsc.stop(now + idx * 0.08 + 0.25);
        });
      } else if (type === 'error') {
        // Soft low descending buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.25);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'win') {
        // Victory fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, idx) => {
          const noteOsc = audioCtx.createOscillator();
          const noteGain = audioCtx.createGain();
          noteOsc.type = 'sine';
          noteOsc.frequency.setValueAtTime(freq, now + idx * 0.12);
          
          noteGain.gain.setValueAtTime(0.25, now + idx * 0.12);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);
          
          noteOsc.connect(noteGain);
          noteGain.connect(audioCtx.destination);
          noteOsc.start(now + idx * 0.12);
          noteOsc.stop(now + idx * 0.12 + 0.4);
        });
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // --- Helper Functions ---
  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Phase 2: Dynamic Problem Generation
   * Generates 20 questions with mix of Units, Tens, and Hundreds.
   * Ensures top number >= bottom number for Subtraction.
   */
  function generateQuestions() {
    questions = [];
    totalAttempts = 0;
    activeIndex = 0;

    for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
      const operator = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
      let num1 = 0;
      let num2 = 0;
      let answer = 0;

      // Tier difficulty distribution across 20 questions:
      // Questions 1-6: Units (1-9) & Small Tens (10-20)
      // Questions 7-14: Tens (10-99)
      // Questions 15-20: Mix of Tens & Hundreds (100-500)
      if (i <= 6) {
        num1 = getRandomInt(3, 19);
        num2 = getRandomInt(1, 9);
      } else if (i <= 14) {
        num1 = getRandomInt(15, 99);
        num2 = getRandomInt(5, 89);
      } else {
        num1 = getRandomInt(100, 500);
        num2 = getRandomInt(10, 300);
      }

      // Constraint for Subtraction: Top number MUST be >= bottom number
      if (operator === '-') {
        if (num1 < num2) {
          // Swap if top is smaller
          const temp = num1;
          num1 = num2;
          num2 = temp;
        }
        // Avoid 0 result for extra fun if possible
        if (num1 === num2) {
          num1 += getRandomInt(1, 5);
        }
        answer = num1 - num2;
      } else {
        answer = num1 + num2;
      }

      questions.push({
        id: i,
        num1: num1,
        num2: num2,
        operator: operator,
        answer: answer,
        userAnswer: '',
        isSolved: false,
        attempts: 0
      });
    }
  }

  // --- DOM Element References ---
  const worksheetGrid = document.getElementById('worksheet-grid');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const endScreenOverlay = document.getElementById('end-screen');
  const confettiContainer = document.getElementById('confetti-container');
  const finalScoreVal = document.getElementById('final-score-val');
  const finalAttemptsVal = document.getElementById('final-attempts-val');
  const btnRestart = document.getElementById('btn-restart');

  /**
   * Render Worksheet Cards (Phase 3)
   */
  function renderWorksheet() {
    worksheetGrid.innerHTML = '';

    questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = `card-problem ${idx === activeIndex ? 'active' : ''} ${q.isSolved ? 'success' : ''}`;
      card.id = `card-${idx}`;
      card.setAttribute('data-index', idx);

      card.innerHTML = `
        <div class="card-header-badge">Soal #${q.id}</div>
        
        <div class="math-column">
          <div class="math-num-top">${q.num1}</div>
          <div class="math-row-bottom">
            <span class="math-operator">${q.operator}</span>
            <span class="math-num-bottom">${q.num2}</span>
          </div>
          <div class="math-line"></div>
          <div class="math-input-wrapper">
            <input type="text" 
                   id="input-${idx}" 
                   class="math-input" 
                   value="${q.userAnswer}" 
                   readonly 
                   inputmode="none" 
                   placeholder="?" 
                   aria-label="Jawaban soal ${q.id}">
          </div>
        </div>

        <div id="feedback-${idx}" class="feedback-overlay">
          <div class="mascot-container">
            <div class="mascot-avatar" id="mascot-icon-${idx}">☀️</div>
            <div class="speech-bubble" id="speech-text-${idx}">Hebat!</div>
          </div>
        </div>
      `;

      // Click card to make it active (if not yet solved)
      card.addEventListener('click', () => {
        if (!q.isSolved && activeIndex !== idx) {
          setActiveCard(idx);
          playSound('click');
        }
      });

      worksheetGrid.appendChild(card);
    });

    updateProgress();
    scrollToActiveCard();
  }

  /**
   * Set Active Card Focus
   */
  function setActiveCard(index) {
    if (index < 0 || index >= TOTAL_QUESTIONS) return;

    // Remove active class from previous
    const currentActiveCard = document.querySelector('.card-problem.active');
    if (currentActiveCard) {
      currentActiveCard.classList.remove('active');
    }

    activeIndex = index;
    const newActiveCard = document.getElementById(`card-${activeIndex}`);
    if (newActiveCard) {
      newActiveCard.classList.add('active');
      scrollToActiveCard();
    }
  }

  function scrollToActiveCard() {
    const activeCard = document.getElementById(`card-${activeIndex}`);
    if (activeCard) {
      activeCard.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  /**
   * Virtual Keyboard Handler (Phase 1)
   */
  function handleInput(key) {
    const q = questions[activeIndex];
    if (!q || q.isSolved) return;

    if (key >= '0' && key <= '9') {
      // Limit answer string length to 4 digits max
      if (q.userAnswer.length < 4) {
        q.userAnswer += key;
        updateInputDisplay(activeIndex);
        playSound('click');
      }
    } else if (key === 'Backspace') {
      if (q.userAnswer.length > 0) {
        q.userAnswer = q.userAnswer.slice(0, -1);
        updateInputDisplay(activeIndex);
        playSound('click');
      }
    } else if (key === 'Enter') {
      validateAnswer(activeIndex);
    }
  }

  function updateInputDisplay(idx) {
    const inputEl = document.getElementById(`input-${idx}`);
    if (inputEl) {
      inputEl.value = questions[idx].userAnswer;
    }
  }

  /**
   * Phase 4: Feedback System & Validation Logic
   */
  function validateAnswer(idx) {
    const q = questions[idx];
    if (!q || q.isSolved) return;

    if (q.userAnswer === '') return; // Don't validate empty input

    const cardEl = document.getElementById(`card-${idx}`);
    const feedbackEl = document.getElementById(`feedback-${idx}`);
    const mascotIcon = document.getElementById(`mascot-icon-${idx}`);
    const speechText = document.getElementById(`speech-text-${idx}`);

    const userVal = parseInt(q.userAnswer, 10);
    q.attempts++;
    totalAttempts++;

    if (userVal === q.answer) {
      // --- CORRECT ANSWER ---
      q.isSolved = true;
      playSound('success');

      // Visual Updates
      cardEl.classList.remove('active', 'error');
      cardEl.classList.add('success');

      // Set Mascot to Sun ☀️
      mascotIcon.textContent = '☀️';
      speechText.textContent = 'Hebat! 🌟';
      speechText.className = 'speech-bubble bubble-success';
      feedbackEl.classList.add('show');

      setTimeout(() => {
        feedbackEl.classList.remove('show');

        // Check if all questions completed
        const nextUnsolvedIndex = questions.findIndex(item => !item.isSolved);
        if (nextUnsolvedIndex !== -1) {
          setActiveCard(nextUnsolvedIndex);
        } else {
          // Game Completed!
          showEndScreen();
        }
      }, 1000);

      updateProgress();

    } else {
      // --- INCORRECT ANSWER ---
      playSound('error');

      cardEl.classList.add('error');
      
      // Set Mascot to Bunny 🐰
      mascotIcon.textContent = '🐰';
      speechText.textContent = 'Coba lagi ya! 💪';
      speechText.className = 'speech-bubble bubble-error';
      feedbackEl.classList.add('show');

      setTimeout(() => {
        cardEl.classList.remove('error');
        feedbackEl.classList.remove('show');
        // Clear input for retry
        q.userAnswer = '';
        updateInputDisplay(idx);
      }, 1100);
    }
  }

  /**
   * Update Progress Trackers (Syncs both top and floating progress bars)
   */
  function updateProgress() {
    const solvedCount = questions.filter(q => q.isSolved).length;
    const percent = Math.round((solvedCount / TOTAL_QUESTIONS) * 100);

    const fillEls = document.querySelectorAll('.progress-bar-fill');
    const textEls = document.querySelectorAll('.progress-text');
    const percentEls = document.querySelectorAll('.progress-percent');

    fillEls.forEach(el => el.style.width = `${percent}%`);
    textEls.forEach(el => el.textContent = `Soal ${Math.min(solvedCount + 1, TOTAL_QUESTIONS)} dari ${TOTAL_QUESTIONS}`);
    percentEls.forEach(el => el.textContent = `${percent}%`);
  }

  /**
   * Scroll Observer: Shows floating progress above keyboard ONLY when top progress bar scrolls out of view
   */
  function setupScrollObserver() {
    const topProgress = document.getElementById('top-progress');
    const floatingProgress = document.getElementById('floating-progress');

    if (!topProgress || !floatingProgress) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Top progress is visible -> hide floating progress on keyboard
            floatingProgress.classList.add('hidden');
          } else {
            // Top progress scrolled out -> show floating progress on keyboard
            floatingProgress.classList.remove('hidden');
          }
        });
      }, {
        threshold: 0.1
      });

      observer.observe(topProgress);
    } else {
      window.addEventListener('scroll', () => {
        const rect = topProgress.getBoundingClientRect();
        if (rect.bottom < 0) {
          floatingProgress.classList.remove('hidden');
        } else {
          floatingProgress.classList.add('hidden');
        }
      });
    }
  }

  /**
   * Phase 5: Scoring & Celebratory End Screen
   */
  function showEndScreen() {
    playSound('win');
    
    // Calculate detailed metrics
    const firstTryCount = questions.filter(q => q.attempts === 1).length;
    const failedAttemptsCount = questions.reduce((sum, q) => sum + Math.max(0, q.attempts - 1), 0);
    const totalAttemptsCount = questions.reduce((sum, q) => sum + q.attempts, 0);

    finalScoreVal.textContent = `100% (Sempurna!)`;
    
    const firstTryEl = document.getElementById('first-try-val');
    const failedEl = document.getElementById('failed-attempts-val');
    if (firstTryEl) firstTryEl.textContent = `${firstTryCount} / ${TOTAL_QUESTIONS} Soal`;
    if (failedEl) failedEl.textContent = `${failedAttemptsCount} Kali`;
    if (finalAttemptsVal) finalAttemptsVal.textContent = `${totalAttemptsCount} Kali`;

    // Dynamic Star Ratings based on first-try accuracy
    const starsContainer = document.querySelector('.stars-display');
    if (starsContainer) {
      if (firstTryCount >= 17) {
        starsContainer.innerHTML = `
          <span class="star-item star-gold">⭐</span>
          <span class="star-item star-gold">⭐</span>
          <span class="star-item star-gold">⭐</span>
        `;
      } else if (firstTryCount >= 12) {
        starsContainer.innerHTML = `
          <span class="star-item star-gold">⭐</span>
          <span class="star-item star-gold">⭐</span>
          <span class="star-item star-muted" style="opacity: 0.3">⭐</span>
        `;
      } else {
        starsContainer.innerHTML = `
          <span class="star-item star-gold">⭐</span>
          <span class="star-item star-muted" style="opacity: 0.3">⭐</span>
          <span class="star-item star-muted" style="opacity: 0.3">⭐</span>
        `;
      }
    }

    createConfetti();
    endScreenOverlay.classList.remove('hidden');
  }

  function createConfetti() {
    confettiContainer.innerHTML = '';
    const colors = ['#FFD54F', '#81C784', '#4FC3F7', '#BA68C8', '#FF8A65', '#F06292'];
    
    for (let i = 0; i < 45; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 2.5}s`;
      piece.style.animationDuration = `${2 + Math.random() * 2}s`;
      confettiContainer.appendChild(piece);
    }
  }

  /**
   * Event Listeners Setup
   */
  function setupEventListeners() {
    // Virtual Keyboard Click Handling
    const keysContainer = document.getElementById('virtual-keyboard');
    keysContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.jelly-btn');
      if (!btn) return;
      const keyVal = btn.getAttribute('data-key');
      if (keyVal) {
        handleInput(keyVal);
      }
    });

    // Physical Keyboard Listener Mapping
    window.addEventListener('keydown', (e) => {
      // Don't intercept if modifier keys are pressed
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      let keyVal = null;
      if (e.key >= '0' && e.key <= '9') {
        keyVal = e.key;
      } else if (e.key === 'Backspace') {
        keyVal = 'Backspace';
      } else if (e.key === 'Enter') {
        keyVal = 'Enter';
      }

      if (keyVal) {
        // Visual button press animation on screen
        const btn = document.querySelector(`.jelly-btn[data-key="${keyVal}"]`);
        if (btn) {
          btn.classList.add('pressed');
          setTimeout(() => btn.classList.remove('pressed'), 120);
        }
        handleInput(keyVal);
      }
    });

    // Restart Button Event Listener
    btnRestart.addEventListener('click', () => {
      playSound('click');
      endScreenOverlay.classList.add('hidden');
      initGame();
    });
  }

  /**
   * Initialize Game Session
   */
  function initGame() {
    generateQuestions();
    renderWorksheet();
  }

  // --- Start Application ---
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupScrollObserver();
    initGame();
  });

})();
