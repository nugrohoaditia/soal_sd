/* ==========================================================================
   Super Kid Math Adventure - Game Logic & State Management
   ========================================================================== */

(function () {
    'use strict';

    // --- Constants & Config ---
    const TOTAL_QUESTIONS = 30;
    const OPERATORS = ['+', '-'];
    const STORAGE_KEY = 'super_kid_math_session_v4';
    const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Jam Expiration Limit

    // --- State Variables ---
    let gameMode = 'susun'; // 'susun' | 'cerita'
    let questions = [];
    let activeIndex = 0;
    let totalAttempts = 0;
    let isMuted = localStorage.getItem('kid_math_muted') === 'true';
    let currentFilter = 'all';
    let timerSeconds = 0;
    let timerInterval = null;

    // --- Utility: Fisher-Yates Array Shuffle ---
    function shuffleArray(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    // --- State Persistence System (localStorage) ---
    function loadRawStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveSession() {
        if (!questions || questions.length === 0) return;
        try {
            const currentData = loadRawStorage() || {};
            currentData[gameMode] = {
                questions: questions,
                activeIndex: activeIndex,
                timerSeconds: timerSeconds,
                totalAttempts: totalAttempts,
                timestamp: Date.now()
            };
            currentData.activeMode = gameMode;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
        } catch (e) {
            console.warn('Could not save session to localStorage:', e);
        }
    }

    function loadSessionForMode(mode) {
        try {
            const currentData = loadRawStorage();
            if (!currentData || !currentData[mode]) return null;
            const parsed = currentData[mode];
            if (parsed && Array.isArray(parsed.questions) && parsed.questions.length === TOTAL_QUESTIONS) {
                const now = Date.now();
                if (parsed.timestamp && (now - parsed.timestamp > SESSION_TTL_MS)) {
                    clearSessionForMode(mode);
                    return null;
                }

                // Validation check for story mode options integrity
                if (mode === 'cerita') {
                    const isValidStorySession = parsed.questions.every(q => Array.isArray(q.options) && q.options.length === 3);
                    if (!isValidStorySession) {
                        clearSessionForMode(mode);
                        return null;
                    }
                }

                const hasUnsolved = parsed.questions.some(q => !q.isSolved);
                if (hasUnsolved) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Could not load session from localStorage:', e);
        }
        return null;
    }

    function clearSessionForMode(mode) {
        try {
            const currentData = loadRawStorage();
            if (currentData && currentData[mode]) {
                delete currentData[mode];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
            }
        } catch (e) {
            console.warn('Could not clear session from localStorage:', e);
        }
    }

    // --- Live Timer System ---
    function startTimer(initialSeconds = 0) {
        stopTimer();
        timerSeconds = initialSeconds;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();
            saveSession();
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
        const timeStr = `⏱️ ${formatTime(timerSeconds)}`;
        const timerBadge = document.getElementById('timer-badge');
        if (timerBadge) {
            timerBadge.textContent = timeStr;
        }
        document.querySelectorAll('.progress-timer').forEach(el => {
            el.textContent = timeStr;
        });
    }

    // --- Modal Overlay Helpers & Lock Scroll ---
    function showModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function hideModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add('hidden');

        const startModal = document.getElementById('start-modal');
        const resumeModal = document.getElementById('resume-modal');
        const endScreen = document.getElementById('end-screen');

        const isStartOpen = startModal && !startModal.classList.contains('hidden');
        const isResumeOpen = resumeModal && !resumeModal.classList.contains('hidden');
        const isEndOpen = endScreen && !endScreen.classList.contains('hidden');

        if (!isStartOpen && !isResumeOpen && !isEndOpen) {
            document.body.classList.remove('modal-open');
        }
    }

    // --- Voice Reader (Web Speech API) ---
    function speakQuestion(idx) {
        const q = questions[idx];
        if (!q) return;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            let text = '';
            if (gameMode === 'cerita') {
                text = q.story;
            } else {
                const opText = q.operator === '+' ? 'ditambah' : 'dikurang';
                text = `Berapa ${q.num1} ${opText} ${q.num2}?`;
            }
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
        if (isMuted) return;
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
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(140, now + 0.25);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'win') {
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
     * Generate 30 Column Math Questions (Hitung Susun)
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

    /**
     * Helper to retrieve the 300 Story Questions Bank from window.SOAL_CERITA_BANK
     */
    function getStoryBank() {
        if (window.SOAL_CERITA_BANK && Array.isArray(window.SOAL_CERITA_BANK) && window.SOAL_CERITA_BANK.length > 0) {
            return window.SOAL_CERITA_BANK;
        }
        return [];
    }

    /**
     * Generate 30 Story Math Questions (Hitung Cerita from 300 Question Bank)
     * Randomly picks 6 Satuan, 9 Puluhan, 9 Ratusan, 6 Ribuan from window.SOAL_CERITA_BANK.
     * Shuffles A, B, C options randomly every single session!
     */
    function generateStoryQuestions() {
        const bank = getStoryBank();
        if (!bank || bank.length === 0) {
            console.warn('Story bank not found in window.SOAL_CERITA_BANK');
            questions = [];
            return;
        }

        const satuanList = bank.filter(q => q.difficulty === 'satuan');
        const puluhanList = bank.filter(q => q.difficulty === 'puluhan');
        const ratusanList = bank.filter(q => q.difficulty === 'ratusan');
        const ribuanList = bank.filter(q => q.difficulty === 'ribuan');

        const picked = [
            ...shuffleArray(satuanList).slice(0, 6),
            ...shuffleArray(puluhanList).slice(0, 9),
            ...shuffleArray(ratusanList).slice(0, 9),
            ...shuffleArray(ribuanList).slice(0, 6)
        ];

        questions = picked.map((item, idx) => {
            const distractors = Array.isArray(item.distractors) ? item.distractors : [item.answer + 2, item.answer - 1];
            const allValues = shuffleArray([item.answer, ...distractors]);
            const labels = ["A", "B", "C"];
            const options = allValues.map((val, i) => ({
                label: labels[i],
                value: val,
                text: val >= 1000 ? `${val.toLocaleString('id-ID')}` : `${val}`
            }));

            return {
                id: idx + 1,
                difficulty: item.difficulty,
                difficultyLabel: item.difficultyLabel,
                story: item.story,
                answer: item.answer,
                options: options,
                hint: item.hint,
                userAnswer: '',
                isSolved: false,
                attempts: 0,
                showHint: false
            };
        });

        totalAttempts = 0;
        activeIndex = 0;
    }

    // --- DOM Element References ---
    const worksheetGrid = document.getElementById('worksheet-grid');
    const endScreenOverlay = document.getElementById('end-screen');
    const confettiContainer = document.getElementById('confetti-container');
    const finalScoreVal = document.getElementById('final-score-val');
    const finalAttemptsVal = document.getElementById('final-attempts-val');
    const btnRestart = document.getElementById('btn-restart');

    /**
     * Render Worksheet Cards (Supports both Susun and Cerita modes)
     */
    function renderWorksheet() {
        if (!worksheetGrid) return;
        worksheetGrid.innerHTML = '';

        questions.forEach((q, idx) => {
            const card = document.createElement('div');
            card.className = `card-problem ${idx === activeIndex ? 'active' : ''} ${q.isSolved ? 'success' : ''}`;
            card.id = `card-${idx}`;
            card.setAttribute('data-index', idx);

            const showHintBtn = (!q.isSolved && q.attempts >= 2 && !q.showHint);

            if (gameMode === 'cerita') {
                // Defensive options fallback in case of legacy cached state
                const optionsList = (Array.isArray(q.options) && q.options.length > 0) ? q.options : [
                    { label: 'A', value: q.answer, text: `${q.answer}` },
                    { label: 'B', value: q.answer + 2, text: `${q.answer + 2}` },
                    { label: 'C', value: q.answer - 1, text: `${q.answer - 1}` }
                ];
                const hintText = q.hint || `💡 Tips: Hitung dengan teliti!`;

                card.innerHTML = `
                    <div class="card-header-badge">${q.isSolved ? '✅ Selesai' : `Cerita #${q.id}`}</div>
                    
                    <button type="button" class="btn-speech" data-idx="${idx}" title="Dengarkan Soal"><span>🔊</span></button>

                    <div class="story-text-box">
                        📖 ${q.story}
                    </div>

                    <div class="choices-group">
                        ${optionsList.map(opt => {
                            const isSelected = (q.userAnswer === String(opt.value));
                            let selectedClass = '';
                            if (isSelected) {
                                selectedClass = q.isSolved ? 'selected-success' : 'selected-error';
                            }
                            return `
                                <button type="button" 
                                        class="choice-btn ${selectedClass}" 
                                        data-card-idx="${idx}" 
                                        data-val="${opt.value}">
                                    <span class="choice-badge">${opt.label}</span>
                                    <span>${opt.text || opt.value}</span>
                                </button>
                            `;
                        }).join('')}
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
            } else {
                // --- Column Math Layout (Hitung Susun) ---
                let hintText = '';
                if (q.operator === '+') {
                    hintText = `💡 Tips: Hitung ${q.num1} + ${q.num2} = ${q.answer}`;
                } else {
                    hintText = `💡 Tips: Hitung ${q.num1} - ${q.num2} = ${q.answer}`;
                }

                card.innerHTML = `
                    <div class="card-header-badge">${q.isSolved ? '✅ Selesai' : `No. ${q.id}`}</div>
                    
                    <button type="button" class="btn-speech" data-idx="${idx}" title="Dengarkan Soal">🔊</button>

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
            }

            // Click card to make it active (if not yet solved)
            card.addEventListener('click', (e) => {
                if (!q.isSolved && activeIndex !== idx && !e.target.closest('.choice-btn') && !e.target.closest('.btn-speech') && !e.target.closest('.btn-hint-trigger')) {
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
        saveSession();
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
     * Switch Game Mode Handler ('susun' vs 'cerita')
     */
    function setGameMode(mode) {
        gameMode = mode;
        if (gameMode === 'cerita') {
            document.body.classList.add('mode-cerita');
        } else {
            document.body.classList.remove('mode-cerita');
        }

        const modeSelect = document.getElementById('game-mode-select');
        if (modeSelect) modeSelect.value = gameMode;

        const savedModeSession = loadSessionForMode(gameMode);
        if (savedModeSession) {
            questions = savedModeSession.questions;
            activeIndex = savedModeSession.activeIndex || 0;
            totalAttempts = savedModeSession.totalAttempts || 0;
        } else {
            if (gameMode === 'cerita') {
                generateStoryQuestions();
            } else {
                generateQuestions();
            }
        }
        renderWorksheet();
        saveSession();
    }

    /**
     * Virtual Keyboard Handler (Hitung Susun)
     */
    function handleInput(key) {
        if (gameMode === 'cerita') return;
        const q = questions[activeIndex];
        if (!q || q.isSolved) return;

        if (key >= '0' && key <= '9') {
            if (q.userAnswer.length < 5) {
                q.userAnswer += key;
                updateInputDisplay(activeIndex);
                saveSession();
                playSound('click');
            }
        } else if (key === 'Backspace') {
            if (q.userAnswer.length > 0) {
                q.userAnswer = q.userAnswer.slice(0, -1);
                updateInputDisplay(activeIndex);
                saveSession();
                playSound('click');
            }
        } else if (key === 'Clear') {
            if (q.userAnswer.length > 0) {
                q.userAnswer = '';
                updateInputDisplay(activeIndex);
                saveSession();
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
     * Validation Logic (Handles both Susun input and Cerita choice)
     */
    function validateAnswer(idx) {
        const q = questions[idx];
        if (!q || q.isSolved) return;

        if (q.userAnswer === '') return;

        const cardEl = document.getElementById(`card-${idx}`);
        const feedbackEl = document.getElementById(`feedback-${idx}`);
        const mascotIcon = document.getElementById(`mascot-icon-${idx}`);
        const speechText = document.getElementById(`speech-text-${idx}`);

        const userVal = parseInt(q.userAnswer, 10);
        q.attempts++;
        totalAttempts++;
        saveSession();

        if (userVal === q.answer) {
            // --- CORRECT ANSWER ---
            q.isSolved = true;
            saveSession();
            playSound('success');

            cardEl.classList.remove('active', 'error');
            cardEl.classList.add('success');

            mascotIcon.textContent = '☀️';
            speechText.textContent = 'Hebat! 🌟';
            speechText.className = 'speech-bubble bubble-success';
            feedbackEl.classList.add('show');

            if (gameMode === 'cerita') {
                renderWorksheet();
            }

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

            if (gameMode === 'cerita') {
                renderWorksheet();
            }

            setTimeout(() => {
                cardEl.classList.remove('error');
                feedbackEl.classList.remove('show');
                q.userAnswer = '';
                if (gameMode === 'cerita') {
                    renderWorksheet();
                } else {
                    updateInputDisplay(idx);
                }
                saveSession();
            }, 1100);
        }
    }

    /**
     * Update Progress Trackers
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

        const chipAll = document.querySelector('.filter-chip[data-filter="all"]');
        const chipUnsolved = document.querySelector('.filter-chip[data-filter="unsolved"]');
        const chipSolved = document.querySelector('.filter-chip[data-filter="solved"]');

        if (chipAll) chipAll.textContent = `Semua (${TOTAL_QUESTIONS})`;
        if (chipUnsolved) chipUnsolved.textContent = `Belum Selesai (${unsolvedCount})`;
        if (chipSolved) chipSolved.textContent = `Sudah Selesai (${solvedCount})`;
    }

    /**
     * Scroll Observer for Floating Progress Bar
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
     * Scoring & Celebratory End Screen
     */
    function showEndScreen() {
        playSound('win');
        stopTimer();
        clearSessionForMode(gameMode);

        const firstTryCount = questions.filter(q => q.attempts === 1).length;
        const failedAttemptsCount = questions.reduce((sum, q) => sum + Math.max(0, q.attempts - 1), 0);
        const totalAttemptsCount = questions.reduce((sum, q) => sum + q.attempts, 0);

        if (finalScoreVal) finalScoreVal.textContent = `100% (Sempurna!)`;

        const finalTimeVal = document.getElementById('final-time-val');
        if (finalTimeVal) finalTimeVal.textContent = formatTime(timerSeconds);

        const achievementsBox = document.getElementById('achievements-box');
        if (achievementsBox) {
            achievementsBox.innerHTML = '';
            
            const ribuanSolvedFirstTry = questions.filter(q => q.difficulty === 'ribuan' && q.attempts === 1).length;
            if (ribuanSolvedFirstTry >= 6) {
                achievementsBox.innerHTML += `<div class="achievement-sticker">🎯 Master Ribuan</div>`;
            }

            if (timerSeconds <= 240) {
                achievementsBox.innerHTML += `<div class="achievement-sticker">⚡ Kilat Super</div>`;
            }

            const first10Correct = questions.slice(0, 10).every(q => q.attempts === 1);
            if (first10Correct) {
                achievementsBox.innerHTML += `<div class="achievement-sticker">🌟 Pembalap Angka</div>`;
            }

            if (failedAttemptsCount > 0) {
                achievementsBox.innerHTML += `<div class="achievement-sticker">🧠 Pantang Menyerah</div>`;
            }
        }

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
        showModal(endScreenOverlay);
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
        // Mode Selector Listener
        const modeSelect = document.getElementById('game-mode-select');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                const selectedMode = e.target.value;
                if (selectedMode) {
                    playSound('click');
                    setGameMode(selectedMode);
                }
            });
        }

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

        // Start Game Modal Button ("Mulai!")
        const btnStartGame = document.getElementById('btn-start-game');
        if (btnStartGame) {
            btnStartGame.addEventListener('click', () => {
                playSound('click');
                hideModal(document.getElementById('start-modal'));
                startTimer(0);
                saveSession();
            });
        }

        // Resume Game Modal Button ("Lanjutkan")
        const btnResumeGame = document.getElementById('btn-resume-game');
        if (btnResumeGame) {
            btnResumeGame.addEventListener('click', () => {
                playSound('click');
                hideModal(document.getElementById('resume-modal'));
                const savedSession = loadSessionForMode(gameMode);
                if (savedSession) {
                    questions = savedSession.questions;
                    activeIndex = savedSession.activeIndex || 0;
                    totalAttempts = savedSession.totalAttempts || 0;
                    renderWorksheet();
                    startTimer(savedSession.timerSeconds || 0);
                } else {
                    initGame(true);
                }
            });
        }

        // New Game Modal Button ("Mulai Baru")
        const btnNewGame = document.getElementById('btn-new-game');
        if (btnNewGame) {
            btnNewGame.addEventListener('click', () => {
                playSound('click');
                hideModal(document.getElementById('resume-modal'));
                clearSessionForMode(gameMode);
                initGame(true);
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

        // Worksheet Card Delegate Click (Multiple Choice, Hints & Voice Reader)
        if (worksheetGrid) {
            worksheetGrid.addEventListener('click', (e) => {
                // Choice Button Click for Hitung Cerita
                const choiceBtn = e.target.closest('.choice-btn');
                if (choiceBtn) {
                    const cardIdx = parseInt(choiceBtn.getAttribute('data-card-idx'), 10);
                    const valStr = choiceBtn.getAttribute('data-val');
                    if (!isNaN(cardIdx) && questions[cardIdx] && !questions[cardIdx].isSolved) {
                        setActiveCard(cardIdx);
                        questions[cardIdx].userAnswer = valStr;
                        validateAnswer(cardIdx);
                    }
                    return;
                }

                // Hint Button Trigger
                const hintBtn = e.target.closest('.btn-hint-trigger');
                if (hintBtn) {
                    const idx = parseInt(hintBtn.getAttribute('data-idx'), 10);
                    if (!isNaN(idx) && questions[idx]) {
                        questions[idx].showHint = true;
                        renderWorksheet();
                        saveSession();
                        playSound('click');
                    }
                    return;
                }

                // Voice Speaker Button
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
                hideModal(endScreenOverlay);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Restart Button Event Listener
        if (btnRestart) {
            btnRestart.addEventListener('click', () => {
                playSound('click');
                hideModal(endScreenOverlay);
                clearSessionForMode(gameMode);
                initGame(true);
            });
        }
    }

    /**
     * Initialize Game Session
     */
    function initGame(autoStartTimer = false) {
        updateAudioBtnUI();
        if (gameMode === 'cerita') {
            generateStoryQuestions();
        } else {
            generateQuestions();
        }
        renderWorksheet();
        if (autoStartTimer) {
            startTimer(0);
            saveSession();
        } else {
            showModal(document.getElementById('start-modal'));
        }
    }

    // --- Start Application ---
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        setupScrollObserver();
        updateAudioBtnUI();

        // Prevent touch scrolling when overlay is active
        document.querySelectorAll('.end-screen-overlay').forEach(overlay => {
            overlay.addEventListener('touchmove', (e) => {
                if (!overlay.classList.contains('hidden')) {
                    e.preventDefault();
                }
            }, { passive: false });
        });

        // Load active mode or saved session
        const rawStorage = loadRawStorage();
        if (rawStorage && rawStorage.activeMode) {
            gameMode = rawStorage.activeMode;
        }

        if (gameMode === 'cerita') {
            document.body.classList.add('mode-cerita');
        } else {
            document.body.classList.remove('mode-cerita');
        }

        const modeSelect = document.getElementById('game-mode-select');
        if (modeSelect) modeSelect.value = gameMode;

        const savedSession = loadSessionForMode(gameMode);
        if (savedSession) {
            questions = savedSession.questions;
            activeIndex = savedSession.activeIndex || 0;
            totalAttempts = savedSession.totalAttempts || 0;
            timerSeconds = savedSession.timerSeconds || 0;
            renderWorksheet();
            updateTimerDisplay();
            showModal(document.getElementById('resume-modal'));
        } else {
            if (gameMode === 'cerita') {
                generateStoryQuestions();
            } else {
                generateQuestions();
            }
            renderWorksheet();
            showModal(document.getElementById('start-modal'));
        }

        // Print Cute Watermark Banner in Console
        printWatermark();
    });

    /**
     * Cute Console Watermark Banner to encourage children
     */
    function printWatermark() {
        const headerStyle = "font-family: 'Fredoka', 'Quicksand', sans-serif; font-size: 16px; font-weight: 800; color: #E91E63; background: #FCE4EC; padding: 8px 16px; border-radius: 12px 12px 0 0; border: 2.5px solid #F8BBD0; border-bottom: none;";
        const mascotStyle = "font-family: monospace; font-size: 13px; font-weight: bold; color: #0288D1; background: #E1F5FE; padding: 12px 16px; border-left: 2.5px solid #81D4FA; border-right: 2.5px solid #81D4FA; line-height: 1.4;";
        const quoteStyle = "font-family: 'Fredoka', sans-serif; font-size: 14px; font-weight: 700; color: #2E7D32; background: #E8F5E9; padding: 8px 16px; border-left: 2.5px solid #A5D6A7; border-right: 2.5px solid #A5D6A7;";
        const creditStyle = "font-family: 'Fredoka', sans-serif; font-size: 13px; font-weight: 700; color: #F57F17; background: #FFFDE7; padding: 8px 16px; border-radius: 0 0 12px 12px; border: 2.5px solid #FFF59D; border-top: none;";

        console.log("%c 🚀 SUPER KID MATH ADVENTURE 🌟 ", headerStyle);
        console.log(
            "%c" +
            "   /\\_/\\   \n" +
            "  ( o.o )  \"Semangat terus ya belajarnya anak pintar! 🌈\"\n" +
            "   > ^ <   \"Kamu pasti bisa jadi Master Matematika Hebat! 💪\"",
            mascotStyle
        );
        console.log("%c✨ \"Setiap angka yang kamu hitung adalah langkah menuju cita-citamu!\" 🎯", quoteStyle);
        console.log("%cMade with ❤️ for kids everywhere - aditianugroho", creditStyle);
    }

})();
