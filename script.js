/* ==========================================================================
   Super Kid Math Adventure - Game Logic & State Management
   ========================================================================== */

(function () {
    'use strict';

    // --- Constants & Config ---
    const TOTAL_QUESTIONS = 10;
    const OPERATORS = ['+', '-'];
    const STORAGE_KEY = 'super_kid_math_session_v8';
    const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Jam Expiration Limit

    // --- State Variables ---
    let gameMode = 'susun'; // 'susun' | 'cerita' | 'gambar'
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

                // Integrity check for mode-specific question structure
                if (mode === 'cerita') {
                    const isValidStorySession = parsed.questions.every(q => q.story && Array.isArray(q.options) && q.options.length === 3);
                    if (!isValidStorySession) {
                        clearSessionForMode(mode);
                        return null;
                    }
                } else if (mode === 'susun') {
                    const isValidSusunSession = parsed.questions.every(q => typeof q.num1 === 'number' && typeof q.num2 === 'number' && typeof q.operator === 'string');
                    if (!isValidSusunSession) {
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
        const switchModal = document.getElementById('switch-mode-modal');
        const endScreen = document.getElementById('end-screen');

        const isStartOpen = startModal && !startModal.classList.contains('hidden');
        const isResumeOpen = resumeModal && !resumeModal.classList.contains('hidden');
        const isSwitchOpen = switchModal && !switchModal.classList.contains('hidden');
        const isEndOpen = endScreen && !endScreen.classList.contains('hidden');

        if (!isStartOpen && !isResumeOpen && !isSwitchOpen && !isEndOpen) {
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
            } else if (gameMode === 'gambar') {
                // Strip emojis from picture story text for clean, natural Indonesian TTS speech
                const cleanStory = q.story.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|\u2640-\u2642|\u2600-\u2B55/gu, '').replace(/\s+/g, ' ').trim();
                text = cleanStory;
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
     * Generate 10 Column Math Questions (Hitung Susun)
     * Exactly 5 Addition (+) and 5 Subtraction (-) with level progression:
     * Soal 1-2: Easy (Satuan & Belasan)
     * Soal 3-5: Puluhan (2 Digits)
     * Soal 6-8: Ratusan (3 Digits)
     * Soal 9-10: Ribuan (4 Digits)
     */
    function generateQuestions() {
        questions = [];
        totalAttempts = 0;
        activeIndex = 0;

        // Structured 10 questions pattern: 5 +, 5 -
        const configs = [
            { op: '+', min: 4, max: 15, difficulty: 'satuan', label: '🌱 Satuan' },
            { op: '-', min: 8, max: 18, difficulty: 'satuan', label: '🌱 Satuan' },
            { op: '+', min: 25, max: 85, difficulty: 'puluhan', label: '🌿 Puluhan' },
            { op: '-', min: 35, max: 95, difficulty: 'puluhan', label: '🌿 Puluhan' },
            { op: '+', min: 45, max: 99, difficulty: 'puluhan', label: '🌿 Puluhan' },
            { op: '-', min: 250, max: 750, difficulty: 'ratusan', label: '🌳 Ratusan' },
            { op: '+', min: 150, max: 650, difficulty: 'ratusan', label: '🌳 Ratusan' },
            { op: '-', min: 350, max: 890, difficulty: 'ratusan', label: '🌳 Ratusan' },
            { op: '+', min: 1200, max: 3500, difficulty: 'ribuan', label: '⛰️ Ribuan' },
            { op: '-', min: 2500, max: 4800, difficulty: 'ribuan', label: '⛰️ Ribuan' }
        ];

        configs.forEach((cfg, idx) => {
            let num1 = getRandomInt(cfg.min, cfg.max);
            let num2 = getRandomInt(Math.floor(cfg.min / 2) || 3, Math.floor(cfg.max * 0.8) || 12);
            let answer = 0;

            if (cfg.op === '-') {
                if (num1 < num2) {
                    const tmp = num1;
                    num1 = num2;
                    num2 = tmp;
                }
                if (num1 === num2) num1 += getRandomInt(2, 6);
                answer = num1 - num2;
            } else {
                answer = num1 + num2;
            }

            questions.push({
                id: idx + 1,
                num1: num1,
                num2: num2,
                operator: cfg.op,
                answer: answer,
                userAnswer: '',
                isSolved: false,
                attempts: 0,
                difficulty: cfg.difficulty,
                difficultyLabel: cfg.label,
                showHint: false
            });
        });
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
     * Generate 10 Story Math Questions (Hitung Cerita from 300 Question Bank)
     * Exactly 5 Addition (+) and 5 Subtraction (-) across levels
     */
    function generateStoryQuestions() {
        const bank = getStoryBank();
        if (!bank || bank.length === 0) {
            console.warn('Story bank not found in window.SOAL_CERITA_BANK');
            questions = [];
            return;
        }

        const additionBank = bank.filter(q => q.hint && q.hint.includes('+'));
        const subtractionBank = bank.filter(q => q.hint && q.hint.includes('-'));

        const pickedAdd = shuffleArray(additionBank).slice(0, 5);
        const pickedSub = shuffleArray(subtractionBank).slice(0, 5);

        const combined = [];
        for (let i = 0; i < 5; i++) {
            if (pickedAdd[i]) combined.push(pickedAdd[i]);
            if (pickedSub[i]) combined.push(pickedSub[i]);
        }

        questions = combined.map((item, idx) => {
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

    /**
     * Helper to retrieve the 300 Picture Questions Bank from window.SOAL_GAMBAR_BANK
     */
    function getPictureBank() {
        if (window.SOAL_GAMBAR_BANK && Array.isArray(window.SOAL_GAMBAR_BANK) && window.SOAL_GAMBAR_BANK.length > 0) {
            return window.SOAL_GAMBAR_BANK;
        }
        return [];
    }

    /**
     * Generate 10 Picture Math Questions (Hitung Bergambar from 300 Question Bank)
     */
    function generatePictureQuestions() {
        const bank = getPictureBank();
        if (!bank || bank.length === 0) {
            console.warn('Picture bank not found in window.SOAL_GAMBAR_BANK');
            questions = [];
            return;
        }

        const additionBank = bank.filter(q => q.hint && q.hint.includes('+'));
        const subtractionBank = bank.filter(q => q.hint && (q.hint.includes('-') || q.hint.includes('dikurangi')));

        const pickedAdd = shuffleArray(additionBank.length > 0 ? additionBank : bank).slice(0, 5);
        const pickedSub = shuffleArray(subtractionBank.length > 0 ? subtractionBank : bank).slice(0, 5);

        const combined = [];
        for (let i = 0; i < 5; i++) {
            if (pickedAdd[i]) combined.push(pickedAdd[i]);
            if (pickedSub[i]) combined.push(pickedSub[i]);
        }

        const picked = shuffleArray(combined.length >= 10 ? combined : shuffleArray(bank).slice(0, 10));

        questions = picked.map((item, idx) => {
            const distractors = item.distractors || [item.answer + 1, item.answer - 1];
            const allValues = shuffleArray([item.answer, ...distractors]);
            const labels = ["A", "B", "C"];
            const options = allValues.map((val, i) => ({
                label: labels[i],
                value: val,
                text: `${val}`
            }));

            return {
                id: idx + 1,
                difficulty: item.difficulty || 'satuan',
                difficultyLabel: item.difficultyLabel || '🎨 Bergambar',
                story: item.story,
                answer: item.answer,
                groups: item.groups,
                options: options,
                hint: item.hint,
                userAnswer: '',
                isSolved: false,
                attempts: 0,
                showHint: false,
                tappedItems: {},
                tappedCount: 0
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

            if (gameMode === 'cerita' || gameMode === 'gambar') {
                // Defensive options fallback in case of legacy cached state
                const optionsList = (Array.isArray(q.options) && q.options.length > 0) ? q.options : [
                    { label: 'A', value: q.answer, text: `${q.answer}` },
                    { label: 'B', value: q.answer + 2, text: `${q.answer + 2}` },
                    { label: 'C', value: q.answer - 1, text: `${q.answer - 1}` }
                ];
                const hintText = q.hint || `💡 Tips: Hitung dengan teliti!`;

                let promptContentHTML = '';
                if (gameMode === 'gambar') {
                    promptContentHTML = `
                        <div class="interactive-object-box">
                            <p class="picture-story-text">🎨 ${q.story}</p>
                            <div class="emoji-groups-container">
                                ${q.groups ? q.groups.map((grp, gIdx) => `
                                    <div class="emoji-group-card">
                                        ${grp.title ? `<span class="emoji-group-title">${grp.title}</span>` : ''}
                                        <div class="emoji-items-row">
                                            ${Array.from({ length: grp.count }).map((_, i) => {
                                                const itemKey = `${gIdx}-${i}`;
                                                const tapState = (q.tappedItems && q.tappedItems[itemKey]) || 0;
                                                const isReduced = grp.reducedCount && i >= (grp.count - grp.reducedCount);
                                                return `
                                                    <div class="emoji-item ${tapState > 0 ? 'tapped' : ''} ${isReduced ? 'reduced' : ''}" 
                                                         data-card-idx="${idx}" 
                                                         data-item-key="${itemKey}"
                                                         title="Klik untuk menghitung">
                                                        <span>${grp.emoji}</span>
                                                        ${tapState > 0 ? `<span class="tap-badge">${tapState}</span>` : ''}
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `).join('') : ''}
                            </div>
                        </div>
                    `;
                } else {
                    promptContentHTML = `
                        <div class="story-text-box">
                            📖 ${q.story}
                        </div>
                    `;
                }

                card.innerHTML = `
                    <div class="card-header-badge">${q.isSolved ? '✅ Selesai' : (gameMode === 'gambar' ? `Gambar #${q.id}` : `Cerita #${q.id}`)}</div>
                    
                    <button type="button" class="btn-speech" data-idx="${idx}" title="Dengarkan Soal"><span>🔊</span></button>

                    ${promptContentHTML}

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
                // --- Column Math Layout (Hitung Susun Boxed Column Grid matching attached sample image) ---
                const num1Str = String(typeof q.num1 === 'number' ? q.num1 : 0);
                const num2Str = String(typeof q.num2 === 'number' ? q.num2 : 0);
                const answerStr = String(q.answer);
                const userValStr = String(q.userAnswer || '');
                const operator = q.operator || '+';
                const hintText = `💡 Tips: Hitung ${num1Str} ${operator} ${num2Str} = ${q.answer}`;

                // Column calculation
                const numCols = Math.max(num1Str.length, num2Str.length, answerStr.length);
                const num1Digits = num1Str.padStart(numCols, ' ').split('');
                const num2Digits = num2Str.padStart(numCols, ' ').split('');
                const userDigits = userValStr.padStart(numCols, ' ').split('');

                if (!q.carryNotes) q.carryNotes = Array(numCols).fill('');

                // Determine active focus box index right-to-left
                const activeBoxIdx = numCols - 1 - userValStr.length;

                card.innerHTML = `
                    <div class="card-header-badge">${q.isSolved ? '✅ Selesai' : `No. ${q.id}`}</div>
                    <button type="button" class="btn-speech" data-idx="${idx}" title="Dengarkan Soal">🔊</button>

                    <div class="math-grid-container ${numCols >= 4 ? 'is-thousands' : ''}">
                        <div class="math-grid-table" style="--grid-cols: ${numCols};">
                            
                            <!-- Row 1: Carry / Borrow Interactive Circles (Scratchpad Helper) -->
                            <div class="grid-cell-op-placeholder"></div>
                            ${Array.from({ length: numCols }).map((_, cIdx) => {
                                if (cIdx === numCols - 1) {
                                    return `<div class="grid-cell-op-placeholder"></div>`;
                                }
                                return `
                                    <input type="text" 
                                           id="carry-${idx}-${cIdx}" 
                                           name="carry-${idx}-${cIdx}" 
                                           class="carry-circle-input" 
                                           maxlength="1" 
                                           placeholder="◯" 
                                           value="${q.carryNotes && q.carryNotes[cIdx] ? q.carryNotes[cIdx] : ''}" 
                                           data-card-idx="${idx}" 
                                           data-col-idx="${cIdx}" 
                                           aria-label="Simpanan kolom ${cIdx + 1}" />
                                `;
                            }).join('')}

                            <!-- Row 2: Top Number Boxed Digits (1px dashed gray border) -->
                            <div class="grid-cell-op-placeholder"></div>
                            ${num1Digits.map(d => `
                                <div class="digit-box-cell ${d === ' ' ? 'empty-cell' : ''}">
                                    ${d === ' ' ? '' : d}
                                </div>
                            `).join('')}

                            <!-- Row 3: Operator & Bottom Number Boxed Digits -->
                            <div class="operator-cell">${operator}</div>
                            ${num2Digits.map(d => `
                                <div class="digit-box-cell ${d === ' ' ? 'empty-cell' : ''}">
                                    ${d === ' ' ? '' : d}
                                </div>
                            `).join('')}

                            <!-- Row 4: Line Separator -->
                            <div class="math-grid-line"></div>

                            <!-- Row 5: Answer Boxed Input Cells (Fixed Right-to-Left Column Mapping) -->
                            <div class="grid-cell-op-placeholder"></div>
                            ${Array.from({ length: numCols }).map((_, cIdx) => {
                                const distFromRight = (numCols - 1) - cIdx;
                                const charVal = userValStr[distFromRight] || '';
                                const isFocus = (idx === activeIndex && !q.isSolved && cIdx === (numCols - 1 - userValStr.length));
                                return `
                                    <div class="answer-box-cell ${charVal !== '' ? 'filled' : ''} ${isFocus ? 'active-box' : ''}">
                                        ${charVal !== '' ? charVal : (isFocus ? '?' : '')}
                                    </div>
                                `;
                            }).join('')}

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
                if (!q.isSolved && activeIndex !== idx && !e.target.closest('.choice-btn') && !e.target.closest('.btn-speech') && !e.target.closest('.btn-hint-trigger') && !e.target.closest('.carry-circle-input')) {
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
        if (!activeCard) return;

        const floatingProgress = document.getElementById('floating-progress');
        const header = document.querySelector('.app-header');

        let topOffset = 80;
        if (floatingProgress && !floatingProgress.classList.contains('hidden')) {
            topOffset = floatingProgress.offsetHeight + 18;
        } else if (header) {
            topOffset = 85;
        }

        const rect = activeCard.getBoundingClientRect();
        const absoluteTop = window.pageYOffset + rect.top;
        const targetScrollTop = absoluteTop - topOffset;

        window.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
        });
    }

    /**
     * Switch Game Mode Handler ('susun' vs 'cerita')
     */
    function setGameMode(mode) {
        if (!worksheetGrid) return;
        gameMode = mode;

        if (gameMode === 'cerita') {
            document.body.classList.add('mode-cerita');
            document.body.classList.remove('mode-gambar');
        } else if (gameMode === 'gambar') {
            document.body.classList.add('mode-gambar');
            document.body.classList.remove('mode-cerita');
        } else {
            document.body.classList.remove('mode-cerita', 'mode-gambar');
        }

        const modeSelect = document.getElementById('game-mode-select');
        if (modeSelect) modeSelect.value = gameMode;

        stopTimer();
        clearSessionForMode(gameMode);

        // Clear worksheet-grid & show cheerful 1.5s loading transition
        let modeLabel = 'Hitung Susun';
        let modeIcon = '📐';
        if (gameMode === 'cerita') {
            modeLabel = 'Soal Cerita';
            modeIcon = '📖';
        } else if (gameMode === 'gambar') {
            modeLabel = 'Hitung Bergambar';
            modeIcon = '🎨';
        }

        worksheetGrid.innerHTML = `
            <div class="loading-mode-container">
                <div class="spinner-mascot">${modeIcon}</div>
                <h3 class="loading-title">Memuat ${modeLabel}...</h3>
                <p class="loading-subtitle">Menyiapkan 10 petualangan matematika baru!</p>
                <div class="loading-progress-bar">
                    <div class="loading-progress-fill"></div>
                </div>
            </div>
        `;

        // Wait 1.5s for smooth transition then populate and render fresh questions
        setTimeout(() => {
            if (gameMode === 'cerita') {
                generateStoryQuestions();
            } else if (gameMode === 'gambar') {
                generatePictureQuestions();
            } else {
                generateQuestions();
            }
            renderWorksheet();
            startTimer(0);
            saveSession();
        }, 1500);
    }

    /**
     * Virtual Keyboard Handler (Hitung Susun)
     */
    function handleInput(key) {
        if (gameMode === 'cerita' || gameMode === 'gambar') return;
        const q = questions[activeIndex];
        if (!q || q.isSolved) return;

        const maxAllowedLength = String(q.answer).length;

        if (key >= '0' && key <= '9') {
            if (q.userAnswer.length < maxAllowedLength) {
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
        if (gameMode === 'cerita') return;
        renderWorksheet();
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

        let userVal = 0;
        if (gameMode === 'cerita') {
            userVal = parseInt(q.userAnswer, 10);
        } else {
            // Hitung Susun: entered right-to-left (ones column first), so reverse digits to get standard number
            const reversedStr = q.userAnswer.split('').reverse().join('');
            userVal = parseInt(reversedStr, 10);
        }

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
        // Mode Selector Listener with Confirmation Warning
        const modeSelect = document.getElementById('game-mode-select');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                const targetMode = e.target.value;
                if (targetMode && targetMode !== gameMode) {
                    modeSelect.setAttribute('data-pending-mode', targetMode);
                    showModal(document.getElementById('switch-mode-modal'));
                }
            });
        }

        // Confirm Mode Switch Button ("✅ Ya, Pindah!")
        const btnConfirmSwitch = document.getElementById('btn-confirm-switch');
        if (btnConfirmSwitch) {
            btnConfirmSwitch.addEventListener('click', () => {
                playSound('click');
                hideModal(document.getElementById('switch-mode-modal'));
                const targetMode = (modeSelect ? modeSelect.getAttribute('data-pending-mode') : null) || (gameMode === 'cerita' ? 'susun' : 'cerita');
                if (modeSelect) modeSelect.removeAttribute('data-pending-mode');
                
                clearSessionForMode(gameMode);
                setGameMode(targetMode);
            });
        }

        // Cancel Mode Switch Button ("❌ Batal")
        const btnCancelSwitch = document.getElementById('btn-cancel-switch');
        if (btnCancelSwitch) {
            btnCancelSwitch.addEventListener('click', () => {
                playSound('click');
                hideModal(document.getElementById('switch-mode-modal'));
                if (modeSelect) {
                    modeSelect.removeAttribute('data-pending-mode');
                    modeSelect.value = gameMode;
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

        let selectedStartMode = 'susun';

        // Mode Choice Button Listener inside Start Modal
        const startModalEl = document.getElementById('start-modal');
        if (startModalEl) {
            startModalEl.addEventListener('click', (e) => {
                const modeBtn = e.target.closest('.mode-choice-btn');
                if (modeBtn) {
                    playSound('click');
                    const mode = modeBtn.getAttribute('data-mode');
                    if (mode) {
                        selectedStartMode = mode;
                        startModalEl.querySelectorAll('.mode-choice-btn').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        modeBtn.classList.add('active');
                    }
                }
            });
        }

        // Start Game Modal Button ("Mulai!")
        const btnStartGame = document.getElementById('btn-start-game');
        if (btnStartGame) {
            btnStartGame.addEventListener('click', () => {
                playSound('click');
                hideModal(document.getElementById('start-modal'));
                setGameMode(selectedStartMode);
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
                // Choice Button Click for Hitung Cerita / Hitung Bergambar
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

                // Emoji Tap-to-Count Click for Hitung Bergambar
                const emojiItem = e.target.closest('.emoji-item');
                if (emojiItem) {
                    const cardIdx = parseInt(emojiItem.getAttribute('data-card-idx'), 10);
                    const itemKey = emojiItem.getAttribute('data-item-key');
                    if (!isNaN(cardIdx) && questions[cardIdx] && !questions[cardIdx].isSolved) {
                        setActiveCard(cardIdx);
                        const q = questions[cardIdx];
                        if (!q.tappedItems) q.tappedItems = {};
                        if (!q.tappedCount) q.tappedCount = 0;

                        if (q.tappedItems[itemKey]) {
                            delete q.tappedItems[itemKey];
                            q.tappedCount = Math.max(0, q.tappedCount - 1);
                        } else {
                            q.tappedCount++;
                            q.tappedItems[itemKey] = q.tappedCount;
                            playSound('click');
                        }
                        renderWorksheet();
                        saveSession();
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

            // Carry Input Event Listener for Scratchpad Helper
            worksheetGrid.addEventListener('input', (e) => {
                const carryInput = e.target.closest('.carry-circle-input');
                if (carryInput) {
                    const cardIdx = parseInt(carryInput.getAttribute('data-card-idx'), 10);
                    const colIdx = parseInt(carryInput.getAttribute('data-col-idx'), 10);
                    if (!isNaN(cardIdx) && !isNaN(colIdx) && questions[cardIdx]) {
                        if (!questions[cardIdx].carryNotes) questions[cardIdx].carryNotes = [];
                        questions[cardIdx].carryNotes[colIdx] = carryInput.value;
                        saveSession();
                    }
                }
            });

            worksheetGrid.addEventListener('focusin', (e) => {
                const carryInput = e.target.closest('.carry-circle-input');
                if (carryInput) {
                    const cardIdx = parseInt(carryInput.getAttribute('data-card-idx'), 10);
                    if (!isNaN(cardIdx) && activeIndex !== cardIdx && questions[cardIdx] && !questions[cardIdx].isSolved) {
                        setActiveCard(cardIdx);
                    }
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
            if (document.activeElement && document.activeElement.classList.contains('carry-circle-input')) {
                return;
            }

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
