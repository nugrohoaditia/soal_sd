/* ==========================================================================
   Super Kid Math Adventure - Game Logic & State Management
   ========================================================================== */

(function () {
    'use strict';

    // --- Constants & Config ---
    const TOTAL_QUESTIONS = 30;
    const OPERATORS = ['+', '-'];

    // --- State Variables ---
    let questions = [];
    let activeIndex = 0;
    let totalAttempts = 0;
    let isMuted = localStorage.getItem('kid_math_muted') === 'true';
    let currentFilter = 'all';
    let timerSeconds = 0;
    let timerInterval = null;

    // --- Live Timer System ---
    function startTimer() {
        stopTimer();
        timerSeconds = 0;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function formatTime(totalSec) {
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function updateTimerDisplay() {
        const timerBadge = document.getElementById('timer-badge');
        if (timerBadge) {
            timerBadge.textContent = `⏱️ ${formatTime(timerSeconds)}`;
        }
    }

    // --- Voice Equation Reader (Web Speech API) ---
    function speakQuestion(idx) {
        const q = questions[idx];
        if (!q) return;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const opText = q.operator === '+' ? 'ditambah' : 'dikurang';
            const text = `Berapa ${q.num1} ${opText} ${q.num2}?`;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID';
            utterance.rate = 0.85;
            window.speechSynthesis.speak(utterance);
        }
    }

    function updateAudioBtnUI() {
        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) {
            if (isMuted) {
                btnAudio.innerHTML = '<span>🔇 Suara: OFF</span>';
                btnAudio.classList.add('muted');
            } else {
                btnAudio.innerHTML = '<span>🔊 Suara: ON</span>';
                btnAudio.classList.remove('muted');
            }
        }
    }

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
        if (isMuted) return; // Mute check
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
     * Generates 30 questions with mix of Units, Tens, Hundreds, and Thousands.
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

            // Tier difficulty distribution across 30 questions:
            // Questions 1-6: Units (1-19) [6 questions]
            // Questions 7-15: Tens (20-99) [9 questions]
            // Questions 16-24: Hundreds (100-899) [9 questions]
            // Questions 25-30: Thousands (1200-4999) [6 questions]
            if (i <= 6) {
                num1 = getRandomInt(3, 19);
                num2 = getRandomInt(1, 9);
            } else if (i <= 15) {
                num1 = getRandomInt(20, 99);
                num2 = getRandomInt(10, 89);
            } else if (i <= 24) {
                num1 = getRandomInt(100, 899);
                num2 = getRandomInt(50, 499);
            } else {
                num1 = getRandomInt(1200, 4999);
                num2 = getRandomInt(200, 2500);
            }

            // Constraint for Subtraction: Top number MUST be >= bottom number
            if (operator === '-') {
                if (num1 < num2) {
                    const temp = num1;
                    num1 = num2;
                    num2 = temp;
                }
                if (num1 === num2) {
                    num1 += getRandomInt(1, 5);
                }
                answer = num1 - num2;
            } else {
                answer = num1 + num2;
            }

            let difficulty = 'satuan';
            let difficultyLabel = '🌱 Satuan';
            if (num1 >= 1000 || num2 >= 1000) {
                difficulty = 'ribuan';
                difficultyLabel = '⛰️ Ribuan';
            } else if (num1 >= 100 || num2 >= 100) {
                difficulty = 'ratusan';
                difficultyLabel = '🌳 Ratusan';
            } else if (num1 >= 20 || num2 >= 20) {
                difficulty = 'puluhan';
                difficultyLabel = '🌿 Puluhan';
            }

            questions.push({
                id: i,
                num1: num1,
                num2: num2,
                operator: operator,
                answer: answer,
                userAnswer: '',
                isSolved: false,
                attempts: 0,
                difficulty: difficulty,
                difficultyLabel: difficultyLabel,
                showHint: false
            });
        }
    }

    // --- DOM Element References ---
    const worksheetGrid = document.getElementById('worksheet-grid');
    const endScreenOverlay = document.getElementById('end-screen');
    const confettiContainer = document.getElementById('confetti-container');
    const finalScoreVal = document.getElementById('final-score-val');
    const finalAttemptsVal = document.getElementById('final-attempts-val');
    const btnRestart = document.getElementById('btn-restart');

    /**
     * Render Worksheet Cards (Phase 3)
     */
    function renderWorksheet() {
        if (!worksheetGrid) return;
        worksheetGrid.innerHTML = '';

        questions.forEach((q, idx) => {
            const card = document.createElement('div');
            card.className = `card-problem ${idx === activeIndex ? 'active' : ''} ${q.isSolved ? 'success' : ''}`;
            card.id = `card-${idx}`;
            card.setAttribute('data-index', idx);

            // Construct hint breakdown string
            let hintText = '';
            if (q.operator === '+') {
                hintText = `💡 Tips: Hitung ${q.num1} + ${q.num2} = ${q.answer}`;
            } else {
                hintText = `💡 Tips: Hitung ${q.num1} - ${q.num2} = ${q.answer}`;
            }

            const showHintBtn = (!q.isSolved && q.attempts >= 2 && !q.showHint);

            card.innerHTML = `
                <div class="card-header-badge-group">
                    <div class="card-header-badge">${q.isSolved ? '✅ Selesai' : `Soal #${q.id}`}</div>
                    <div class="badge-difficulty ${q.difficulty}">${q.difficultyLabel}</div>
                </div>
                
                <button type="button" class="btn-speech" data-idx="${idx}" title="Dengarkan Soal">🔊 Dengar</button>

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
                               placeholder="${idx === activeIndex ? '|' : '?'}" 
                               aria-label="Jawaban soal ${q.id}">
                    </div>
                </div>

                ${showHintBtn ? `<button type="button" class="btn-hint-trigger" data-idx="${idx}">💡 Lihat Bantuan</button>` : ''}
                ${q.showHint ? `<div class="hint-bubble-box">${hintText}</div>` : ''}

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
        applyFilter(currentFilter);
        scrollToActiveCard();
    }

    /**
     * Filter Navigation Bar Handler
     */
    function applyFilter(filter) {
        currentFilter = filter;
        document.querySelectorAll('.filter-chip').forEach(btn => {
            if (btn.getAttribute('data-filter') === filter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        questions.forEach((q, idx) => {
            const card = document.getElementById(`card-${idx}`);
            if (!card) return;

            if (filter === 'unsolved') {
                card.style.display = q.isSolved ? 'none' : 'flex';
            } else if (filter === 'solved') {
                card.style.display = q.isSolved ? 'flex' : 'none';
            } else {
                card.style.display = 'flex';
            }
        });
    }

    /**
     * Set Active Card Focus
     */
    function setActiveCard(index) {
        if (index < 0 || index >= TOTAL_QUESTIONS) return;

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
                block: 'center',
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
            if (q.userAnswer.length < 5) {
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
        } else if (key === 'Clear') {
            if (q.userAnswer.length > 0) {
                q.userAnswer = '';
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

            cardEl.classList.remove('active', 'error');
            cardEl.classList.add('success');

            mascotIcon.textContent = '☀️';
            speechText.textContent = 'Hebat! 🌟';
            speechText.className = 'speech-bubble bubble-success';
            feedbackEl.classList.add('show');

            setTimeout(() => {
                feedbackEl.classList.remove('show');

                const nextUnsolvedIndex = questions.findIndex(item => !item.isSolved);
                if (nextUnsolvedIndex !== -1) {
                    setActiveCard(nextUnsolvedIndex);
                } else {
                    showEndScreen();
                }
            }, 1000);

            updateProgress();

        } else {
            // --- INCORRECT ANSWER ---
            playSound('error');

            cardEl.classList.add('error');

            mascotIcon.textContent = '🐰';
            speechText.textContent = 'Coba lagi ya! 💪';
            speechText.className = 'speech-bubble bubble-error';
            feedbackEl.classList.add('show');

            setTimeout(() => {
                cardEl.classList.remove('error');
                feedbackEl.classList.remove('show');
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
        const unsolvedCount = TOTAL_QUESTIONS - solvedCount;
        const percent = Math.round((solvedCount / TOTAL_QUESTIONS) * 100);

        const fillEls = document.querySelectorAll('.progress-bar-fill');
        const textEls = document.querySelectorAll('.progress-text');
        const percentEls = document.querySelectorAll('.progress-percent');

        fillEls.forEach(el => el.style.width = `${percent}%`);
        textEls.forEach(el => el.textContent = `Soal ${Math.min(solvedCount + 1, TOTAL_QUESTIONS)} dari ${TOTAL_QUESTIONS}`);
        percentEls.forEach(el => el.textContent = `${percent}%`);

        // Update filter chips text count
        const chipAll = document.querySelector('.filter-chip[data-filter="all"]');
        const chipUnsolved = document.querySelector('.filter-chip[data-filter="unsolved"]');
        const chipSolved = document.querySelector('.filter-chip[data-filter="solved"]');

        if (chipAll) chipAll.textContent = `Semua (${TOTAL_QUESTIONS})`;
        if (chipUnsolved) chipUnsolved.textContent = `Belum Selesai (${unsolvedCount})`;
        if (chipSolved) chipSolved.textContent = `Sudah Selesai (${solvedCount})`;
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
                        floatingProgress.classList.add('hidden');
                    } else {
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
        stopTimer();

        // Calculate detailed metrics
        const firstTryCount = questions.filter(q => q.attempts === 1).length;
        const failedAttemptsCount = questions.reduce((sum, q) => sum + Math.max(0, q.attempts - 1), 0);
        const totalAttemptsCount = questions.reduce((sum, q) => sum + q.attempts, 0);

        if (finalScoreVal) finalScoreVal.textContent = `100% (Sempurna!)`;

        const finalTimeVal = document.getElementById('final-time-val');
        if (finalTimeVal) finalTimeVal.textContent = formatTime(timerSeconds);

        // Evaluate Achievement Badges
        const achievementsBox = document.getElementById('achievements-box');
        if (achievementsBox) {
            achievementsBox.innerHTML = '';
            
            // Check Ribuan questions accuracy
            const ribuanSolvedFirstTry = questions.filter(q => q.difficulty === 'ribuan' && q.attempts === 1).length;
            if (ribuanSolvedFirstTry >= 6) {
                achievementsBox.innerHTML += `<div class="achievement-sticker">🎯 Master Ribuan</div>`;
            }

            // Fast speed badge (< 4 mins)
            if (timerSeconds <= 240) {
                achievementsBox.innerHTML += `<div class="achievement-sticker">⚡ Kilat Super</div>`;
            }

            // Perfect first 10
            const first10Correct = questions.slice(0, 10).every(q => q.attempts === 1);
            if (first10Correct) {
                achievementsBox.innerHTML += `<div class="achievement-sticker">🌟 Pembalap Angka</div>`;
            }

            // Perseverance badge
            if (failedAttemptsCount > 0) {
                achievementsBox.innerHTML += `<div class="achievement-sticker">🧠 Pantang Menyerah</div>`;
            }
        }

        // Dynamic Title based on performance
        const titleEl = document.querySelector('.celebration-title');
        if (titleEl) {
            if (firstTryCount === 30) {
                titleEl.textContent = '🏆 Master Matematika Super! 🎉';
            } else if (firstTryCount >= 25) {
                titleEl.textContent = '🌟 Bintang Matematika Hebat! 🎉';
            } else if (firstTryCount >= 18) {
                titleEl.textContent = '💪 Jagoan Matematika Keren! 🎉';
            } else {
                titleEl.textContent = '👏 Pahlawan Pantang Menyerah! 🎉';
            }
        }

        const firstTryEl = document.getElementById('first-try-val');
        const failedEl = document.getElementById('failed-attempts-val');
        if (firstTryEl) firstTryEl.textContent = `${firstTryCount} / ${TOTAL_QUESTIONS} Soal`;
        if (failedEl) failedEl.textContent = `${failedAttemptsCount} Kali`;
        if (finalAttemptsVal) finalAttemptsVal.textContent = `${totalAttemptsCount} Kali`;

        // Dynamic Star Ratings based on first-try accuracy
        const starsContainer = document.querySelector('.stars-display');
        if (starsContainer) {
            if (firstTryCount >= 25) {
                starsContainer.innerHTML = `
                    <span class="star-item star-gold">⭐</span>
                    <span class="star-item star-gold">⭐</span>
                    <span class="star-item star-gold">⭐</span>
                `;
            } else if (firstTryCount >= 18) {
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
        if (endScreenOverlay) endScreenOverlay.classList.remove('hidden');
    }

    function createConfetti() {
        if (!confettiContainer) return;
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
        // Audio Toggle Listener
        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) {
            btnAudio.addEventListener('click', () => {
                isMuted = !isMuted;
                localStorage.setItem('kid_math_muted', isMuted);
                updateAudioBtnUI();
                if (!isMuted) playSound('click');
            });
        }

        // Filter Bar Click Delegate
        const filterBar = document.getElementById('filter-bar');
        if (filterBar) {
            filterBar.addEventListener('click', (e) => {
                const chip = e.target.closest('.filter-chip');
                if (chip) {
                    const filterVal = chip.getAttribute('data-filter');
                    if (filterVal) {
                        applyFilter(filterVal);
                        playSound('click');
                    }
                }
            });
        }

        // Worksheet Card Delegate Click (Hints & Voice Speaker)
        if (worksheetGrid) {
            worksheetGrid.addEventListener('click', (e) => {
                const hintBtn = e.target.closest('.btn-hint-trigger');
                if (hintBtn) {
                    const idx = parseInt(hintBtn.getAttribute('data-idx'), 10);
                    if (!isNaN(idx) && questions[idx]) {
                        questions[idx].showHint = true;
                        renderWorksheet();
                        playSound('click');
                    }
                    return;
                }

                const speechBtn = e.target.closest('.btn-speech');
                if (speechBtn) {
                    const idx = parseInt(speechBtn.getAttribute('data-idx'), 10);
                    if (!isNaN(idx) && questions[idx]) {
                        speakQuestion(idx);
                    }
                    return;
                }
            });
        }

        // Virtual Keyboard Click Handling
        const keysContainer = document.getElementById('virtual-keyboard');
        if (keysContainer) {
            keysContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.jelly-btn');
                if (!btn) return;
                const keyVal = btn.getAttribute('data-key');
                if (keyVal) {
                    handleInput(keyVal);
                }
            });
        }

        // Physical Keyboard Listener Mapping
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            let keyVal = null;
            if (e.key >= '0' && e.key <= '9') {
                keyVal = e.key;
            } else if (e.key === 'Backspace') {
                keyVal = 'Backspace';
            } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
                keyVal = 'Clear';
            } else if (e.key === 'Enter') {
                keyVal = 'Enter';
            }

            if (keyVal) {
                const btn = document.querySelector(`.jelly-btn[data-key="${keyVal}"]`);
                if (btn) {
                    btn.classList.add('pressed');
                    setTimeout(() => btn.classList.remove('pressed'), 120);
                }
                handleInput(keyVal);
            }
        });

        // Review Answers Button Listener
        const btnReview = document.getElementById('btn-review');
        if (btnReview) {
            btnReview.addEventListener('click', () => {
                playSound('click');
                if (endScreenOverlay) endScreenOverlay.classList.add('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Restart Button Event Listener
        if (btnRestart) {
            btnRestart.addEventListener('click', () => {
                playSound('click');
                if (endScreenOverlay) endScreenOverlay.classList.add('hidden');
                initGame();
            });
        }
    }

    /**
     * Initialize Game Session
     */
    function initGame() {
        updateAudioBtnUI();
        generateQuestions();
        renderWorksheet();
        startTimer();
    }

    // --- Start Application ---
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        setupScrollObserver();
        initGame();
    });

})();
