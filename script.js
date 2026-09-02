/* ==========================================================================
   Super Kid Math Adventure - Modular Architecture & High Performance Engine
   Target Audience: Grade 1-3 Elementary School Kids (SD)
   Features: 6 Distinct Modes (Susun, Cerita, Pembagian, Perkalian, Gambar, Kosakata),
             Flexible Question Counts (10, 15, 20), Virtual Keypad & Carry Circles
   ========================================================================== */

(function () {
    'use strict';

    // =========================================================================
    // 1. CONFIGURATION & CONSTANTS
    // =========================================================================
    const CONFIG = {
        DEFAULT_TOTAL_QUESTIONS: 10,
        STORAGE_KEY: 'super_kid_math_session_v11',
        SESSION_TTL_MS: 24 * 60 * 60 * 1000, // 24 Hours
        AUDIO_STORAGE_KEY: 'kid_math_muted'
    };

    // =========================================================================
    // 2. AUDIO SYSTEM (Web Audio API Synthesizer & Web Speech TTS)
    // =========================================================================
    const AudioSystem = (function () {
        let audioCtx = null;
        let isMuted = localStorage.getItem(CONFIG.AUDIO_STORAGE_KEY) === 'true';

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

        function speakQuestion(q, gameMode) {
            if (!q) return;
            if (gameMode === 'kosakata') return; // Speak is hidden and disabled on Kosakata mode
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                let text = '';
                if (gameMode === 'cerita' || gameMode === 'gambar') {
                    text = (q.story || '').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|\u2640-\u2642|\u2600-\u2B55/gu, '').replace(/\s+/g, ' ').trim();
                } else if (gameMode === 'perkalian') {
                    text = `Berapa ${q.num1} dikali ${q.num2}?`;
                } else if (gameMode === 'pembagian') {
                    text = `Berapa ${q.num1} dibagi ${q.num2}?`;
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

        function toggleMute() {
            isMuted = !isMuted;
            localStorage.setItem(CONFIG.AUDIO_STORAGE_KEY, isMuted);
            updateAudioBtnUI();
            if (!isMuted) playSound('click');
            return isMuted;
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

        return {
            playSound,
            speakQuestion,
            toggleMute,
            updateAudioBtnUI,
            get isMuted() { return isMuted; }
        };
    })();

    // =========================================================================
    // 3. STORAGE SYSTEM (Session Persistence & Integrity Validation)
    // =========================================================================
    const StorageSystem = (function () {
        function loadRawStorage() {
            try {
                const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        }

        function saveSession(mode, data) {
            if (!data.questions || data.questions.length === 0) return;
            try {
                const currentData = loadRawStorage() || {};
                currentData[mode] = {
                    questions: data.questions,
                    activeIndex: data.activeIndex,
                    timerSeconds: data.timerSeconds,
                    totalAttempts: data.totalAttempts,
                    totalQuestions: data.totalQuestions || data.questions.length,
                    timestamp: Date.now()
                };
                currentData.activeMode = mode;
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(currentData));
            } catch (e) {
                console.warn('Could not save session to localStorage:', e);
            }
        }

        function loadSessionForMode(mode) {
            try {
                const currentData = loadRawStorage();
                if (!currentData || !currentData[mode]) return null;
                const parsed = currentData[mode];
                if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                    const now = Date.now();
                    if (parsed.timestamp && (now - parsed.timestamp > CONFIG.SESSION_TTL_MS)) {
                        clearSessionForMode(mode);
                        return null;
                    }

                    // Mode structure integrity checks
                    if (mode === 'cerita') {
                        const isValid = parsed.questions.every(q => q.story && Array.isArray(q.options) && q.options.length === 3);
                        if (!isValid) { clearSessionForMode(mode); return null; }
                    } else if (mode === 'kosakata') {
                        const isValid = parsed.questions.every(q => q.sentence && Array.isArray(q.options) && q.options.length === 3);
                        if (!isValid) { clearSessionForMode(mode); return null; }
                    } else if (mode === 'gambar') {
                        const isValid = parsed.questions.every(q => q.story && Array.isArray(q.groups) && q.groups.length > 0 && Array.isArray(q.options) && q.options.length === 3);
                        if (!isValid) { clearSessionForMode(mode); return null; }
                    } else {
                        const isValid = parsed.questions.every(q => typeof q.num1 === 'number' && typeof q.num2 === 'number' && typeof q.operator === 'string');
                        if (!isValid) { clearSessionForMode(mode); return null; }
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
                    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(currentData));
                }
            } catch (e) {
                console.warn('Could not clear session from localStorage:', e);
            }
        }

        function getActiveMode() {
            const raw = loadRawStorage();
            return (raw && raw.activeMode) ? raw.activeMode : 'susun';
        }

        return {
            saveSession,
            loadSessionForMode,
            clearSessionForMode,
            getActiveMode
        };
    })();

    // =========================================================================
    // 4. QUESTION GENERATOR (6 Modes: Susun, Cerita, Pembagian, Perkalian, Gambar, Kosakata)
    // =========================================================================
    const QuestionGenerator = (function () {
        function shuffleArray(arr) {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        function generateSusunQuestions(totalCount = 10) {
            const baseConfigs = [
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

            let configs = [];
            while (configs.length < totalCount) {
                configs = configs.concat(baseConfigs);
            }
            configs = configs.slice(0, totalCount);

            return configs.map((cfg, idx) => {
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

                return {
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
                    showHint: false,
                    carryNotes: []
                };
            });
        }

        function generatePerkalianQuestions(totalCount = 10) {
            const list = [];
            for (let i = 0; i < totalCount; i++) {
                let num1, num2, difficulty, label;

                const ratio = i / totalCount;
                if (ratio < 0.4) {
                    num1 = getRandomInt(2, 9);
                    num2 = getRandomInt(2, 9);
                    difficulty = 'satuan';
                    label = '🌱 Satuan';
                } else if (ratio < 0.75) {
                    num1 = getRandomInt(11, 19);
                    num2 = getRandomInt(2, 5);
                    difficulty = 'belasan';
                    label = '🌿 Belasan';
                } else {
                    num1 = getRandomInt(20, 45);
                    num2 = getRandomInt(2, 4);
                    difficulty = 'puluhan';
                    label = '🌳 Puluhan';
                }

                const answer = num1 * num2;
                list.push({
                    id: i + 1,
                    num1: num1,
                    num2: num2,
                    operator: '×',
                    answer: answer,
                    userAnswer: '',
                    isSolved: false,
                    attempts: 0,
                    difficulty: difficulty,
                    difficultyLabel: label,
                    showHint: false,
                    carryNotes: []
                });
            }
            return list;
        }

        function generatePembagianQuestions(totalCount = 10) {
            const list = [];
            for (let i = 0; i < totalCount; i++) {
                let divisor, quotient, difficulty, label;

                const ratio = i / totalCount;
                if (ratio < 0.45) {
                    divisor = getRandomInt(2, 9);
                    quotient = getRandomInt(2, 9);
                    difficulty = 'satuan';
                    label = '🌱 Satuan';
                } else if (ratio < 0.8) {
                    divisor = getRandomInt(2, 5);
                    quotient = getRandomInt(11, 20);
                    difficulty = 'belasan';
                    label = '🌿 Belasan';
                } else {
                    divisor = getRandomInt(2, 4);
                    quotient = getRandomInt(21, 35);
                    difficulty = 'puluhan';
                    label = '🌳 Puluhan';
                }

                const dividend = divisor * quotient;
                list.push({
                    id: i + 1,
                    num1: dividend,
                    num2: divisor,
                    operator: '÷',
                    answer: quotient,
                    userAnswer: '',
                    isSolved: false,
                    attempts: 0,
                    difficulty: difficulty,
                    difficultyLabel: label,
                    showHint: false
                });
            }
            return list;
        }

        function generateCeritaQuestions(totalCount = 10) {
            const bank = (window.SOAL_CERITA_BANK && Array.isArray(window.SOAL_CERITA_BANK)) ? window.SOAL_CERITA_BANK : [];
            if (bank.length === 0) return [];

            const additionBank = bank.filter(q => q.hint && q.hint.includes('+'));
            const subtractionBank = bank.filter(q => q.hint && q.hint.includes('-'));

            const half = Math.ceil(totalCount / 2);
            const pickedAdd = shuffleArray(additionBank).slice(0, half);
            const pickedSub = shuffleArray(subtractionBank).slice(0, totalCount - pickedAdd.length);

            const combined = shuffleArray([...pickedAdd, ...pickedSub]).slice(0, totalCount);

            return combined.map((item, idx) => {
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
                    difficulty: item.difficulty || 'satuan',
                    difficultyLabel: item.difficultyLabel || '🌱 Satuan',
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
        }

        function generateGambarQuestions(totalCount = 10) {
            const bank = (window.SOAL_GAMBAR_BANK && Array.isArray(window.SOAL_GAMBAR_BANK)) ? window.SOAL_GAMBAR_BANK : [];
            if (bank.length === 0) return [];

            const picked = shuffleArray(bank).slice(0, totalCount);

            return picked.map((item, idx) => {
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
        }

        function generateKosakataQuestions(totalCount = 10) {
            const bank = (window.SOAL_KOSAKATA_BANK && Array.isArray(window.SOAL_KOSAKATA_BANK)) ? window.SOAL_KOSAKATA_BANK : [];
            if (bank.length === 0) return [];

            const picked = shuffleArray(bank).slice(0, totalCount);

            return picked.map((item, idx) => {
                const allValues = shuffleArray([item.answer, ...item.distractors]);
                const labels = ["A", "B", "C"];
                const options = allValues.map((val, i) => ({
                    label: labels[i],
                    value: val,
                    text: val
                }));

                return {
                    id: idx + 1,
                    category: item.category || 'Kosakata',
                    sentence: item.sentence,
                    answer: item.answer,
                    options: options,
                    hint: item.hint,
                    userAnswer: '',
                    isSolved: false,
                    attempts: 0,
                    showHint: false
                };
            });
        }

        return {
            generateSusunQuestions,
            generatePerkalianQuestions,
            generatePembagianQuestions,
            generateCeritaQuestions,
            generateGambarQuestions,
            generateKosakataQuestions
        };
    })();

    // =========================================================================
    // 5. UI CONTROLLER (DOM Rendering, Partial Digit Updates & Modals)
    // =========================================================================
    const UIController = (function () {
        const worksheetGrid = document.getElementById('worksheet-grid');
        const endScreenOverlay = document.getElementById('end-screen');
        const confettiContainer = document.getElementById('confetti-container');
        const finalScoreVal = document.getElementById('final-score-val');
        const finalAttemptsVal = document.getElementById('final-attempts-val');
        const topProgress = document.getElementById('top-progress');
        const floatingProgress = document.getElementById('floating-progress');

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

        /**
         * Render Full Worksheet (6 Modes: susun, cerita, pembagian, perkalian, gambar, kosakata)
         */
        function renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol = null) {
            if (!worksheetGrid) return;
            worksheetGrid.innerHTML = '';

            questions.forEach((q, idx) => {
                const card = document.createElement('div');
                card.className = `card-problem ${idx === activeIndex ? 'active' : ''} ${q.isSolved ? 'success' : ''}`;
                card.id = `card-${idx}`;
                card.setAttribute('data-index', idx);

                const showHintBtn = (!q.isSolved && q.attempts >= 2 && !q.showHint);

                if (gameMode === 'kosakata') {
                    // Mode Kosakata: 1-Column Layout without Speak Button (TTS Hidden for reading practice)
                    const optionsList = (Array.isArray(q.options) && q.options.length > 0) ? q.options : [
                        { label: 'A', value: q.answer, text: q.answer },
                        { label: 'B', value: 'bukan', text: 'bukan' },
                        { label: 'C', value: 'salah', text: 'salah' }
                    ];
                    const hintText = q.hint || `💡 Tips: Pilihlah kata yang paling tepat melengkapi kalimat di atas.`;

                    card.innerHTML = `
                        <div class="card-header-badge">${q.isSolved ? '✅ Selesai' : `📚 Kosakata #${q.id} • ${q.category || 'Membaca'}`}</div>

                        <div class="vocabulary-text-box">
                            📝 ${q.sentence}
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
                } else if (gameMode === 'cerita' || gameMode === 'gambar') {
                    const optionsList = (Array.isArray(q.options) && q.options.length > 0) ? q.options : [
                        { label: 'A', value: q.answer, text: `${q.answer}` },
                        { label: 'B', value: q.answer + 2, text: `${q.answer + 2}` },
                        { label: 'C', value: q.answer - 1, text: `${q.answer - 1}` }
                    ];
                    const hintText = q.hint || `💡 Tips: Hitung dengan teliti!`;

                    let promptContentHTML = '';
                    if (gameMode === 'gambar') {
                        const storyText = q.story || 'Hitunglah jumlah objek di bawah ini:';
                        promptContentHTML = `
                            <div class="interactive-object-box">
                                <p class="picture-story-text">🎨 ${storyText}</p>
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
                } else if (gameMode === 'pembagian') {
                    const num1Str = String(q.num1);
                    const num2Str = String(q.num2);
                    const userValStr = String(q.userAnswer || '');
                    const hintText = `💡 Tips: ${num1Str} ÷ ${num2Str} = ${q.answer}`;
                    const isFocus = (idx === activeIndex && !q.isSolved);

                    card.innerHTML = `
                        <div class="card-header-badge">${q.isSolved ? '✅ Selesai' : `No. ${q.id} (${q.difficultyLabel || '➗ Bagi'})`}</div>
                        <button type="button" class="btn-speech" data-idx="${idx}" title="Dengarkan Soal">🔊</button>

                        <div class="division-container">
                            <div class="division-row">
                                <span class="division-num">${num1Str}</span>
                                <span class="division-op">÷</span>
                                <span class="division-num">${num2Str}</span>
                                <span class="division-eq">=</span>
                                <div class="answer-box-cell ${userValStr !== '' ? 'filled' : ''} ${isFocus ? 'active-box' : ''}" data-col-idx="0">
                                    ${userValStr !== '' ? userValStr : (isFocus ? '?' : '')}
                                </div>
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
                } else {
                    // Hitung Susun & Perkalian (Column Boxed Grid with Carry Circles, rightmost empty)
                    const num1Str = String(typeof q.num1 === 'number' ? q.num1 : 0);
                    const num2Str = String(typeof q.num2 === 'number' ? q.num2 : 0);
                    const answerStr = String(q.answer);
                    const userValStr = String(q.userAnswer || '');
                    const operator = q.operator || '+';
                    const hintText = `💡 Tips: Hitung ${num1Str} ${operator} ${num2Str} = ${q.answer}`;

                    const numCols = Math.max(num1Str.length, num2Str.length, answerStr.length);
                    const num1Digits = num1Str.padStart(numCols, ' ').split('');
                    const num2Digits = num2Str.padStart(numCols, ' ').split('');

                    if (!q.carryNotes) q.carryNotes = Array(numCols).fill('');

                    card.innerHTML = `
                        <div class="card-header-badge">${q.isSolved ? '✅ Selesai' : `No. ${q.id}`}</div>
                        <button type="button" class="btn-speech" data-idx="${idx}" title="Dengarkan Soal">🔊</button>

                        <div class="math-grid-container ${numCols >= 4 ? 'is-thousands' : ''}">
                            <div class="math-grid-table" style="--grid-cols: ${numCols};">
                                
                                <!-- Row 1: Carry / Borrow Scratchpad (Rightmost column empty placeholder) -->
                                <div class="grid-cell-op-placeholder"></div>
                                ${Array.from({ length: numCols }).map((_, cIdx) => {
                                    if (cIdx === numCols - 1) {
                                        return `<div class="grid-cell-op-placeholder"></div>`;
                                    }
                                    const val = (q.carryNotes && q.carryNotes[cIdx]) ? q.carryNotes[cIdx] : '';
                                    const isCarryActive = (idx === activeIndex && activeCarryCol === cIdx);
                                    return `
                                        <div class="carry-circle-cell ${val !== '' ? 'filled' : ''} ${isCarryActive ? 'active-carry' : ''}" 
                                             data-card-idx="${idx}" 
                                             data-col-idx="${cIdx}" 
                                             role="button" 
                                             tabindex="0"
                                             aria-label="Simpanan kolom ${cIdx + 1}"
                                             title="Klik untuk mengisi angka simpanan">
                                            ${val !== '' ? val : '◯'}
                                        </div>
                                    `;
                                }).join('')}

                                <!-- Row 2: Top Number Boxed Digits -->
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
                                    const isFocus = (idx === activeIndex && activeCarryCol === null && !q.isSolved && cIdx === (numCols - 1 - userValStr.length));
                                    return `
                                        <div class="answer-box-cell ${charVal !== '' ? 'filled' : ''} ${isFocus ? 'active-box' : ''}" data-col-idx="${cIdx}">
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

                worksheetGrid.appendChild(card);
            });

            updateProgress(questions);
            applyFilter(currentFilter, questions);
            scrollToActiveCard(activeIndex);
        }

        /**
         * PARTIAL DOM UPDATE: High Performance in-place digit box updates
         */
        function updateDigitBoxes(cardIdx, question, isActive, gameMode) {
            const cardEl = document.getElementById(`card-${cardIdx}`);
            if (!cardEl) return;

            const userValStr = String(question.userAnswer || '');

            if (gameMode === 'pembagian') {
                const answerCell = cardEl.querySelector('.answer-box-cell');
                if (answerCell) {
                    if (userValStr !== '') {
                        answerCell.textContent = userValStr;
                        answerCell.classList.add('filled');
                        answerCell.classList.remove('active-box');
                    } else {
                        answerCell.textContent = isActive ? '?' : '';
                        answerCell.classList.remove('filled');
                        if (isActive) {
                            answerCell.classList.add('active-box');
                        } else {
                            answerCell.classList.remove('active-box');
                        }
                    }
                }
                return;
            }

            const num1Str = String(typeof question.num1 === 'number' ? question.num1 : 0);
            const num2Str = String(typeof question.num2 === 'number' ? question.num2 : 0);
            const answerStr = String(question.answer);
            const numCols = Math.max(num1Str.length, num2Str.length, answerStr.length);

            const answerCells = cardEl.querySelectorAll('.answer-box-cell');
            answerCells.forEach((cell, cIdx) => {
                const distFromRight = (numCols - 1) - cIdx;
                const charVal = userValStr[distFromRight] || '';
                const isFocus = (isActive && !question.isSolved && cIdx === (numCols - 1 - userValStr.length));

                if (charVal !== '') {
                    cell.textContent = charVal;
                    cell.classList.add('filled');
                    cell.classList.remove('active-box');
                } else {
                    cell.textContent = isFocus ? '?' : '';
                    cell.classList.remove('filled');
                    if (isFocus) {
                        cell.classList.add('active-box');
                    } else {
                        cell.classList.remove('active-box');
                    }
                }
            });
        }

        function updateCarryCells(cardIdx, question, activeCarryCol) {
            const cardEl = document.getElementById(`card-${cardIdx}`);
            if (!cardEl) return;

            const carryCells = cardEl.querySelectorAll('.carry-circle-cell');
            carryCells.forEach((cell) => {
                const colIdx = parseInt(cell.getAttribute('data-col-idx'), 10);
                const val = (question.carryNotes && question.carryNotes[colIdx]) ? question.carryNotes[colIdx] : '';
                const isFocus = (activeCarryCol === colIdx);

                if (val !== '') {
                    cell.textContent = val;
                    cell.classList.add('filled');
                } else {
                    cell.textContent = '◯';
                    cell.classList.remove('filled');
                }

                if (isFocus) {
                    cell.classList.add('active-carry');
                } else {
                    cell.classList.remove('active-carry');
                }
            });
        }

        function setSubmitDisabled(disabled) {
            const submitBtn = document.querySelector('.key-submit');
            if (submitBtn) {
                submitBtn.disabled = disabled;
                if (disabled) {
                    submitBtn.classList.add('is-disabled');
                    submitBtn.setAttribute('aria-disabled', 'true');
                } else {
                    submitBtn.classList.remove('is-disabled');
                    submitBtn.removeAttribute('aria-disabled');
                }
            }
        }

        function setActiveCard(index, total) {
            if (index < 0 || index >= total) return;
            const currentActiveCard = document.querySelector('.card-problem.active');
            if (currentActiveCard) {
                currentActiveCard.classList.remove('active');
            }

            const newActiveCard = document.getElementById(`card-${index}`);
            if (newActiveCard) {
                newActiveCard.classList.add('active');
                scrollToActiveCard(index);
            }
        }

        function scrollToActiveCard(activeIndex) {
            const activeCard = document.getElementById(`card-${activeIndex}`);
            if (!activeCard) return;

            let topOffset = 80;
            if (floatingProgress && !floatingProgress.classList.contains('hidden')) {
                topOffset = floatingProgress.offsetHeight + 18;
            } else {
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

        function applyFilter(filter, questions) {
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

        function updateProgress(questions) {
            const total = questions.length;
            const solvedCount = questions.filter(q => q.isSolved).length;
            const unsolvedCount = total - solvedCount;
            const percent = total > 0 ? Math.round((solvedCount / total) * 100) : 0;

            const fillEls = document.querySelectorAll('.progress-bar-fill');
            const textEls = document.querySelectorAll('.progress-text');
            const percentEls = document.querySelectorAll('.progress-percent');

            fillEls.forEach(el => el.style.width = `${percent}%`);
            textEls.forEach(el => el.textContent = `Soal ${Math.min(solvedCount + 1, total)} dari ${total}`);
            percentEls.forEach(el => el.textContent = `${percent}%`);

            const chipAll = document.querySelector('.filter-chip[data-filter="all"]');
            const chipUnsolved = document.querySelector('.filter-chip[data-filter="unsolved"]');
            const chipSolved = document.querySelector('.filter-chip[data-filter="solved"]');

            if (chipAll) chipAll.textContent = `Semua (${total})`;
            if (chipUnsolved) chipUnsolved.textContent = `Belum Selesai (${unsolvedCount})`;
            if (chipSolved) chipSolved.textContent = `Sudah Selesai (${solvedCount})`;
        }

        function formatTime(totalSec) {
            const mins = Math.floor(totalSec / 60);
            const secs = totalSec % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        function updateTimerDisplay(timerSeconds) {
            const timeStr = `⏱️ ${formatTime(timerSeconds)}`;
            const timerBadge = document.getElementById('timer-badge');
            if (timerBadge) {
                timerBadge.textContent = timeStr;
            }
            document.querySelectorAll('.progress-timer').forEach(el => {
                el.textContent = timeStr;
            });
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

        function setupScrollObserver() {
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
                }, { threshold: 0.1 });
                observer.observe(topProgress);
            } else {
                window.addEventListener('scroll', () => {
                    const rect = topProgress.getBoundingClientRect();
                    if (rect.bottom < 0) {
                        floatingProgress.classList.remove('hidden');
                    } else {
                        floatingProgress.classList.remove('hidden');
                    }
                });
            }
        }

        function showLoadingMode(modeLabel, modeIcon, count) {
            if (!worksheetGrid) return;
            worksheetGrid.innerHTML = `
                <div class="loading-mode-container">
                    <div class="spinner-mascot">${modeIcon}</div>
                    <h3 class="loading-title">Memuat ${modeLabel}...</h3>
                    <p class="loading-subtitle">Menyiapkan ${count} petualangan belajar baru!</p>
                    <div class="loading-progress-bar">
                        <div class="loading-progress-fill"></div>
                    </div>
                </div>
            `;
        }

        return {
            showModal,
            hideModal,
            renderWorksheet,
            updateDigitBoxes,
            updateCarryCells,
            setSubmitDisabled,
            setActiveCard,
            scrollToActiveCard,
            applyFilter,
            updateProgress,
            updateTimerDisplay,
            formatTime,
            createConfetti,
            setupScrollObserver,
            showLoadingMode,
            get endScreenOverlay() { return endScreenOverlay; },
            get finalScoreVal() { return finalScoreVal; },
            get finalAttemptsVal() { return finalAttemptsVal; }
        };
    })();

    // =========================================================================
    // 6. GAME ENGINE (Core Controller & State Machine)
    // =========================================================================
    const GameEngine = (function () {
        let gameMode = 'susun'; // 'susun' | 'cerita' | 'pembagian' | 'perkalian' | 'gambar' | 'kosakata'
        let totalQuestions = 10; // 10 | 15 | 20
        let questions = [];
        let activeIndex = 0;
        let activeCarryCol = null; // null = Answer row focus; 0, 1, ... = Carry circle col focus
        let totalAttempts = 0;
        let currentFilter = 'all';
        let timerSeconds = 0;
        let timerInterval = null;

        function startTimer(initialSeconds = 0) {
            stopTimer();
            timerSeconds = initialSeconds;
            UIController.updateTimerDisplay(timerSeconds);
            timerInterval = setInterval(() => {
                timerSeconds++;
                UIController.updateTimerDisplay(timerSeconds);
                saveCurrentSession();
            }, 1000);
        }

        function stopTimer() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }

        function saveCurrentSession() {
            StorageSystem.saveSession(gameMode, {
                questions: questions,
                activeIndex: activeIndex,
                timerSeconds: timerSeconds,
                totalAttempts: totalAttempts,
                totalQuestions: totalQuestions
            });
        }

        function setCarryFocus(colIdx) {
            activeCarryCol = colIdx;
            const q = questions[activeIndex];
            if (q) {
                UIController.updateCarryCells(activeIndex, q, activeCarryCol);
                UIController.updateDigitBoxes(activeIndex, q, activeCarryCol === null, gameMode);
            }
            UIController.setSubmitDisabled(activeCarryCol !== null);
        }

        function setGameMode(mode, count = 10, skipLoading = false) {
            gameMode = mode;
            totalQuestions = count;
            activeCarryCol = null;
            UIController.setSubmitDisabled(false);

            document.body.classList.remove('mode-cerita', 'mode-gambar', 'mode-perkalian', 'mode-pembagian', 'mode-kosakata');
            if (gameMode === 'cerita') {
                document.body.classList.add('mode-cerita');
            } else if (gameMode === 'gambar') {
                document.body.classList.add('mode-gambar');
            } else if (gameMode === 'perkalian') {
                document.body.classList.add('mode-perkalian');
            } else if (gameMode === 'pembagian') {
                document.body.classList.add('mode-pembagian');
            } else if (gameMode === 'kosakata') {
                document.body.classList.add('mode-kosakata');
            }

            stopTimer();
            StorageSystem.clearSessionForMode(gameMode);

            if (skipLoading) {
                generateAndRender(true);
                return;
            }

            let modeLabel = 'Hitung Susun';
            let modeIcon = '📐';
            if (gameMode === 'cerita') {
                modeLabel = 'Soal Cerita';
                modeIcon = '📖';
            } else if (gameMode === 'pembagian') {
                modeLabel = 'Pembagian';
                modeIcon = '➗';
            } else if (gameMode === 'perkalian') {
                modeLabel = 'Perkalian';
                modeIcon = '✖️';
            } else if (gameMode === 'gambar') {
                modeLabel = 'Hitung Bergambar';
                modeIcon = '🎨';
            } else if (gameMode === 'kosakata') {
                modeLabel = 'Kosakata';
                modeIcon = '📚';
            }

            UIController.showLoadingMode(modeLabel, modeIcon, totalQuestions);

            setTimeout(() => {
                generateAndRender(true);
            }, 1000);
        }

        function generateAndRender(autoStart = true) {
            activeCarryCol = null;
            UIController.setSubmitDisabled(false);

            if (gameMode === 'cerita') {
                questions = QuestionGenerator.generateCeritaQuestions(totalQuestions);
            } else if (gameMode === 'gambar') {
                questions = QuestionGenerator.generateGambarQuestions(totalQuestions);
            } else if (gameMode === 'perkalian') {
                questions = QuestionGenerator.generatePerkalianQuestions(totalQuestions);
            } else if (gameMode === 'pembagian') {
                questions = QuestionGenerator.generatePembagianQuestions(totalQuestions);
            } else if (gameMode === 'kosakata') {
                questions = QuestionGenerator.generateKosakataQuestions(totalQuestions);
            } else {
                questions = QuestionGenerator.generateSusunQuestions(totalQuestions);
            }
            activeIndex = 0;
            totalAttempts = 0;

            UIController.renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol);
            if (autoStart) {
                startTimer(0);
                saveCurrentSession();
            }
        }

        function handleKeyInput(key) {
            if (gameMode === 'cerita' || gameMode === 'gambar' || gameMode === 'kosakata') return;
            const q = questions[activeIndex];
            if (!q || q.isSolved) return;

            // Carry Circle Focus Input (for susun & perkalian)
            if (activeCarryCol !== null && (gameMode === 'susun' || gameMode === 'perkalian')) {
                if (!q.carryNotes) q.carryNotes = [];
                if (key >= '0' && key <= '9') {
                    q.carryNotes[activeCarryCol] = key;
                    UIController.updateCarryCells(activeIndex, q, activeCarryCol);
                    saveCurrentSession();
                    AudioSystem.playSound('click');
                } else if (key === 'Backspace' || key === 'Clear') {
                    q.carryNotes[activeCarryCol] = '';
                    UIController.updateCarryCells(activeIndex, q, activeCarryCol);
                    saveCurrentSession();
                    AudioSystem.playSound('click');
                } else if (key === 'Enter') {
                    setCarryFocus(null);
                    AudioSystem.playSound('click');
                }
                return;
            }

            // Answer Row Input
            const maxAllowedLength = String(q.answer).length;

            if (key >= '0' && key <= '9') {
                if (q.userAnswer.length < maxAllowedLength) {
                    q.userAnswer += key;
                    UIController.updateDigitBoxes(activeIndex, q, true, gameMode);
                    saveCurrentSession();
                    AudioSystem.playSound('click');
                }
            } else if (key === 'Backspace') {
                if (q.userAnswer.length > 0) {
                    q.userAnswer = q.userAnswer.slice(0, -1);
                    UIController.updateDigitBoxes(activeIndex, q, true, gameMode);
                    saveCurrentSession();
                    AudioSystem.playSound('click');
                }
            } else if (key === 'Clear') {
                if (q.userAnswer.length > 0) {
                    q.userAnswer = '';
                    UIController.updateDigitBoxes(activeIndex, q, true, gameMode);
                    saveCurrentSession();
                    AudioSystem.playSound('click');
                }
            } else if (key === 'Enter') {
                validateAnswer(activeIndex);
            }
        }

        function validateAnswer(idx) {
            const q = questions[idx];
            if (!q || q.isSolved) return;
            if (q.userAnswer === '') return;

            const cardEl = document.getElementById(`card-${idx}`);
            const feedbackEl = document.getElementById(`feedback-${idx}`);
            const mascotIcon = document.getElementById(`mascot-icon-${idx}`);
            const speechText = document.getElementById(`speech-text-${idx}`);

            let isCorrect = false;
            if (gameMode === 'kosakata') {
                isCorrect = (String(q.userAnswer).trim().toLowerCase() === String(q.answer).trim().toLowerCase());
            } else if (gameMode === 'cerita' || gameMode === 'gambar' || gameMode === 'pembagian') {
                const userVal = parseInt(q.userAnswer, 10);
                isCorrect = (userVal === q.answer);
            } else {
                // Hitung Susun & Perkalian: entered right-to-left
                const reversedStr = q.userAnswer.split('').reverse().join('');
                const userVal = parseInt(reversedStr, 10);
                isCorrect = (userVal === q.answer);
            }

            q.attempts++;
            totalAttempts++;
            saveCurrentSession();

            if (isCorrect) {
                // CORRECT ANSWER
                q.isSolved = true;
                activeCarryCol = null;
                UIController.setSubmitDisabled(false);
                saveCurrentSession();
                AudioSystem.playSound('success');

                if (cardEl) {
                    cardEl.classList.remove('active', 'error');
                    cardEl.classList.add('success');
                }

                if (mascotIcon) mascotIcon.textContent = '☀️';
                if (speechText) {
                    speechText.textContent = 'Hebat! 🌟';
                    speechText.className = 'speech-bubble bubble-success';
                }
                if (feedbackEl) feedbackEl.classList.add('show');

                if (gameMode === 'cerita' || gameMode === 'gambar' || gameMode === 'kosakata') {
                    UIController.renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol);
                } else {
                    UIController.updateDigitBoxes(idx, q, false, gameMode);
                    if (gameMode === 'susun' || gameMode === 'perkalian') {
                        UIController.updateCarryCells(idx, q, null);
                    }
                }

                setTimeout(() => {
                    if (feedbackEl) feedbackEl.classList.remove('show');

                    const nextUnsolvedIndex = questions.findIndex(item => !item.isSolved);
                    if (nextUnsolvedIndex !== -1) {
                        activeIndex = nextUnsolvedIndex;
                        activeCarryCol = null;
                        UIController.setActiveCard(activeIndex, totalQuestions);
                        UIController.setSubmitDisabled(false);
                        saveCurrentSession();
                    } else {
                        showEndScreen();
                    }
                }, 1000);

                UIController.updateProgress(questions);

            } else {
                // INCORRECT ANSWER
                AudioSystem.playSound('error');

                if (cardEl) cardEl.classList.add('error');

                if (mascotIcon) mascotIcon.textContent = '🐰';
                if (speechText) {
                    speechText.textContent = 'Coba lagi ya! 💪';
                    speechText.className = 'speech-bubble bubble-error';
                }
                if (feedbackEl) feedbackEl.classList.add('show');

                if (gameMode === 'cerita' || gameMode === 'gambar' || gameMode === 'kosakata') {
                    UIController.renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol);
                }

                setTimeout(() => {
                    if (cardEl) cardEl.classList.remove('error');
                    if (feedbackEl) feedbackEl.classList.remove('show');
                    q.userAnswer = '';
                    
                    // Clear carry notes on incorrect answer for susun and perkalian
                    if (q.carryNotes) {
                        q.carryNotes = q.carryNotes.map(() => '');
                    }
                    activeCarryCol = null;
                    UIController.setSubmitDisabled(false);

                    if (gameMode === 'cerita' || gameMode === 'gambar' || gameMode === 'kosakata') {
                        UIController.renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol);
                    } else {
                        UIController.updateDigitBoxes(idx, q, true, gameMode);
                        if (gameMode === 'susun' || gameMode === 'perkalian') {
                            UIController.updateCarryCells(idx, q, null);
                        }
                    }
                    saveCurrentSession();
                }, 1100);
            }
        }

        function showEndScreen() {
            AudioSystem.playSound('win');
            stopTimer();
            activeCarryCol = null;
            UIController.setSubmitDisabled(false);
            StorageSystem.clearSessionForMode(gameMode);

            const count = questions.length || totalQuestions;
            const firstTryCount = questions.filter(q => q.attempts === 1).length;
            const failedAttemptsCount = questions.reduce((sum, q) => sum + Math.max(0, q.attempts - 1), 0);
            const totalAttemptsCount = questions.reduce((sum, q) => sum + q.attempts, 0);

            if (UIController.finalScoreVal) UIController.finalScoreVal.textContent = `100% (Sempurna!)`;

            const finalTimeVal = document.getElementById('final-time-val');
            if (finalTimeVal) finalTimeVal.textContent = UIController.formatTime(timerSeconds);

            const achievementsBox = document.getElementById('achievements-box');
            if (achievementsBox) {
                achievementsBox.innerHTML = '';
                
                const specialSolvedFirstTry = questions.filter(q => (q.difficulty === 'ribuan' || q.difficulty === 'puluhan' || q.category) && q.attempts === 1).length;
                if (specialSolvedFirstTry >= 2) {
                    achievementsBox.innerHTML += `<div class="achievement-sticker">🎯 Master Kata & Angka</div>`;
                }

                if (timerSeconds <= (count * 18)) {
                    achievementsBox.innerHTML += `<div class="achievement-sticker">⚡ Kilat Super</div>`;
                }

                const allFirstTry = questions.every(q => q.attempts === 1);
                if (allFirstTry) {
                    achievementsBox.innerHTML += `<div class="achievement-sticker">🌟 Juara Sejati</div>`;
                }

                if (failedAttemptsCount > 0) {
                    achievementsBox.innerHTML += `<div class="achievement-sticker">🧠 Pantang Menyerah</div>`;
                }
            }

            const titleEl = document.querySelector('.celebration-title');
            if (titleEl) {
                const ratio = firstTryCount / count;
                if (ratio >= 0.95) {
                    titleEl.textContent = '🏆 Master Petualangan Super! 🎉';
                } else if (ratio >= 0.8) {
                    titleEl.textContent = '🌟 Bintang Belajar Hebat! 🎉';
                } else if (ratio >= 0.6) {
                    titleEl.textContent = '💪 Jagoan Pintar Keren! 🎉';
                } else {
                    titleEl.textContent = '👏 Pahlawan Pantang Menyerah! 🎉';
                }
            }

            const firstTryEl = document.getElementById('first-try-val');
            const failedEl = document.getElementById('failed-attempts-val');
            if (firstTryEl) firstTryEl.textContent = `${firstTryCount} / ${count} Soal`;
            if (failedEl) failedEl.textContent = `${failedAttemptsCount} Kali`;
            if (UIController.finalAttemptsVal) UIController.finalAttemptsVal.textContent = `${totalAttemptsCount} Kali`;

            const starsContainer = document.querySelector('.stars-display');
            if (starsContainer) {
                const ratio = firstTryCount / count;
                if (ratio >= 0.85) {
                    starsContainer.innerHTML = `
                        <span class="star-item star-gold">⭐</span>
                        <span class="star-item star-gold">⭐</span>
                        <span class="star-item star-gold">⭐</span>
                    `;
                } else if (ratio >= 0.65) {
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

            UIController.createConfetti();
            UIController.showModal(UIController.endScreenOverlay);
        }

        function setupEventListeners() {
            // Header Ganti Mode Button
            const btnChangeMode = document.getElementById('btn-change-mode');
            if (btnChangeMode) {
                btnChangeMode.addEventListener('click', () => {
                    AudioSystem.playSound('click');
                    UIController.showModal(document.getElementById('switch-mode-modal'));
                });
            }

            // Confirm Mode Switch -> Returns to Start Modal with all choices!
            const btnConfirmSwitch = document.getElementById('btn-confirm-switch');
            if (btnConfirmSwitch) {
                btnConfirmSwitch.addEventListener('click', () => {
                    AudioSystem.playSound('click');
                    UIController.hideModal(document.getElementById('switch-mode-modal'));
                    UIController.showModal(document.getElementById('start-modal'));
                });
            }

            // Cancel Mode Switch Button
            const btnCancelSwitch = document.getElementById('btn-cancel-switch');
            if (btnCancelSwitch) {
                btnCancelSwitch.addEventListener('click', () => {
                    AudioSystem.playSound('click');
                    UIController.hideModal(document.getElementById('switch-mode-modal'));
                });
            }

            // Audio Toggle
            const btnAudio = document.getElementById('btn-audio');
            if (btnAudio) {
                btnAudio.addEventListener('click', () => {
                    AudioSystem.toggleMute();
                });
            }

            let selectedStartMode = 'susun';
            let selectedStartCount = 10;

            // Start Modal Mode Choice & Question Count Selection
            const startModalEl = document.getElementById('start-modal');
            if (startModalEl) {
                startModalEl.addEventListener('click', (e) => {
                    // Mode Card Click
                    const modeBtn = e.target.closest('.mode-choice-btn');
                    if (modeBtn) {
                        AudioSystem.playSound('click');
                        const mode = modeBtn.getAttribute('data-mode');
                        if (mode) {
                            selectedStartMode = mode;
                            startModalEl.querySelectorAll('.mode-choice-btn').forEach(btn => btn.classList.remove('active'));
                            modeBtn.classList.add('active');
                        }
                        return;
                    }

                    // Count Chip Click
                    const countChip = e.target.closest('.count-chip');
                    if (countChip) {
                        AudioSystem.playSound('click');
                        const count = parseInt(countChip.getAttribute('data-count'), 10);
                        if (!isNaN(count)) {
                            selectedStartCount = count;
                            startModalEl.querySelectorAll('.count-chip').forEach(btn => btn.classList.remove('active'));
                            countChip.classList.add('active');
                        }
                        return;
                    }
                });
            }

            // Start Game Modal Button
            const btnStartGame = document.getElementById('btn-start-game');
            if (btnStartGame) {
                btnStartGame.addEventListener('click', () => {
                    AudioSystem.playSound('click');
                    UIController.hideModal(document.getElementById('start-modal'));
                    setGameMode(selectedStartMode, selectedStartCount, true);
                });
            }

            // Resume Game Modal Button
            const btnResumeGame = document.getElementById('btn-resume-game');
            if (btnResumeGame) {
                btnResumeGame.addEventListener('click', () => {
                    AudioSystem.playSound('click');
                    UIController.hideModal(document.getElementById('resume-modal'));
                    const savedSession = StorageSystem.loadSessionForMode(gameMode);
                    if (savedSession) {
                        questions = savedSession.questions;
                        activeIndex = savedSession.activeIndex || 0;
                        totalAttempts = savedSession.totalAttempts || 0;
                        totalQuestions = savedSession.totalQuestions || questions.length;
                        activeCarryCol = null;
                        UIController.setSubmitDisabled(false);
                        UIController.renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol);
                        startTimer(savedSession.timerSeconds || 0);
                    } else {
                        generateAndRender(true);
                    }
                });
            }

            // New Game Modal Button
            const btnNewGame = document.getElementById('btn-new-game');
            if (btnNewGame) {
                btnNewGame.addEventListener('click', () => {
                    AudioSystem.playSound('click');
                    UIController.hideModal(document.getElementById('resume-modal'));
                    StorageSystem.clearSessionForMode(gameMode);
                    generateAndRender(true);
                });
            }

            // Filter Bar Navigation
            const filterBar = document.getElementById('filter-bar');
            if (filterBar) {
                filterBar.addEventListener('click', (e) => {
                    const chip = e.target.closest('.filter-chip');
                    if (chip) {
                        const filterVal = chip.getAttribute('data-filter');
                        if (filterVal) {
                            currentFilter = filterVal;
                            UIController.applyFilter(filterVal, questions);
                            AudioSystem.playSound('click');
                        }
                    }
                });
            }

            // Worksheet Card Delegate Click Handler
            const worksheetGrid = document.getElementById('worksheet-grid');
            if (worksheetGrid) {
                worksheetGrid.addEventListener('click', (e) => {
                    // Carry Circle Cell Click (Hitung Susun & Perkalian)
                    const carryCell = e.target.closest('.carry-circle-cell');
                    if (carryCell) {
                        const cardIdx = parseInt(carryCell.getAttribute('data-card-idx'), 10);
                        const colIdx = parseInt(carryCell.getAttribute('data-col-idx'), 10);
                        if (!isNaN(cardIdx) && !isNaN(colIdx) && questions[cardIdx] && !questions[cardIdx].isSolved) {
                            if (activeIndex !== cardIdx) {
                                const oldIdx = activeIndex;
                                activeIndex = cardIdx;
                                UIController.setActiveCard(activeIndex, totalQuestions);
                                UIController.updateDigitBoxes(oldIdx, questions[oldIdx], false, gameMode);
                                UIController.updateCarryCells(oldIdx, questions[oldIdx], null);
                            }
                            if (activeCarryCol === colIdx) {
                                setCarryFocus(null);
                            } else {
                                setCarryFocus(colIdx);
                            }
                            AudioSystem.playSound('click');
                        }
                        return;
                    }

                    // Choice Button Click for Cerita, Gambar, Kosakata
                    const choiceBtn = e.target.closest('.choice-btn');
                    if (choiceBtn) {
                        const cardIdx = parseInt(choiceBtn.getAttribute('data-card-idx'), 10);
                        const valStr = choiceBtn.getAttribute('data-val');
                        if (!isNaN(cardIdx) && questions[cardIdx] && !questions[cardIdx].isSolved) {
                            activeIndex = cardIdx;
                            activeCarryCol = null;
                            UIController.setSubmitDisabled(false);
                            UIController.setActiveCard(cardIdx, totalQuestions);
                            questions[cardIdx].userAnswer = valStr;
                            validateAnswer(cardIdx);
                        }
                        return;
                    }

                    // Emoji Tap-to-Count for Gambar
                    const emojiItem = e.target.closest('.emoji-item');
                    if (emojiItem) {
                        const cardIdx = parseInt(emojiItem.getAttribute('data-card-idx'), 10);
                        const itemKey = emojiItem.getAttribute('data-item-key');
                        if (!isNaN(cardIdx) && questions[cardIdx] && !questions[cardIdx].isSolved) {
                            activeIndex = cardIdx;
                            activeCarryCol = null;
                            UIController.setSubmitDisabled(false);
                            UIController.setActiveCard(cardIdx, totalQuestions);
                            const q = questions[cardIdx];
                            if (!q.tappedItems) q.tappedItems = {};
                            if (!q.tappedCount) q.tappedCount = 0;

                            if (q.tappedItems[itemKey]) {
                                delete q.tappedItems[itemKey];
                                q.tappedCount = Math.max(0, q.tappedCount - 1);
                            } else {
                                q.tappedCount++;
                                q.tappedItems[itemKey] = q.tappedCount;
                                AudioSystem.playSound('click');
                            }
                            UIController.renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol);
                            saveCurrentSession();
                        }
                        return;
                    }

                    // Hint Button Trigger
                    const hintBtn = e.target.closest('.btn-hint-trigger');
                    if (hintBtn) {
                        const idx = parseInt(hintBtn.getAttribute('data-idx'), 10);
                        if (!isNaN(idx) && questions[idx]) {
                            questions[idx].showHint = true;
                            UIController.renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol);
                            saveCurrentSession();
                            AudioSystem.playSound('click');
                        }
                        return;
                    }

                    // Voice Speaker Button (Cerita, Gambar, Susun, Perkalian, Pembagian)
                    const speechBtn = e.target.closest('.btn-speech');
                    if (speechBtn) {
                        const idx = parseInt(speechBtn.getAttribute('data-idx'), 10);
                        if (!isNaN(idx) && questions[idx]) {
                            AudioSystem.speakQuestion(questions[idx], gameMode);
                        }
                        return;
                    }

                    // Click Card Body / Answer Box to Activate Answer Focus
                    const card = e.target.closest('.card-problem');
                    if (card && !e.target.closest('.carry-circle-cell') && !e.target.closest('.choice-btn') && !e.target.closest('.btn-speech') && !e.target.closest('.btn-hint-trigger')) {
                        const cardIdx = parseInt(card.getAttribute('data-index'), 10);
                        if (!isNaN(cardIdx) && !questions[cardIdx].isSolved) {
                            const changedCard = (activeIndex !== cardIdx);
                            const oldIdx = activeIndex;
                            activeIndex = cardIdx;
                            
                            if (changedCard) {
                                UIController.setActiveCard(activeIndex, totalQuestions);
                                UIController.updateDigitBoxes(oldIdx, questions[oldIdx], false, gameMode);
                                if (gameMode === 'susun' || gameMode === 'perkalian') {
                                    UIController.updateCarryCells(oldIdx, questions[oldIdx], null);
                                }
                            }

                            setCarryFocus(null);
                            AudioSystem.playSound('click');
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
                    if (btn.disabled || btn.classList.contains('is-disabled')) return;
                    const keyVal = btn.getAttribute('data-key');
                    if (keyVal) {
                        handleKeyInput(keyVal);
                    }
                });
            }

            // Physical Keyboard Listener
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
                    if (btn && !(btn.disabled || btn.classList.contains('is-disabled'))) {
                        btn.classList.add('pressed');
                        setTimeout(() => btn.classList.remove('pressed'), 120);
                    }
                    handleKeyInput(keyVal);
                }
            });

            // Review Answers Button
            const btnReview = document.getElementById('btn-review');
            if (btnReview) {
                btnReview.addEventListener('click', () => {
                    AudioSystem.playSound('click');
                    UIController.hideModal(UIController.endScreenOverlay);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }

            // Restart Button
            const btnRestart = document.getElementById('btn-restart');
            if (btnRestart) {
                btnRestart.addEventListener('click', () => {
                    AudioSystem.playSound('click');
                    UIController.hideModal(UIController.endScreenOverlay);
                    StorageSystem.clearSessionForMode(gameMode);
                    generateAndRender(true);
                });
            }
        }

        function init() {
            setupEventListeners();
            UIController.setupScrollObserver();
            AudioSystem.updateAudioBtnUI();

            gameMode = StorageSystem.getActiveMode();
            document.body.classList.remove('mode-cerita', 'mode-gambar', 'mode-perkalian', 'mode-pembagian', 'mode-kosakata');
            if (gameMode === 'cerita') {
                document.body.classList.add('mode-cerita');
            } else if (gameMode === 'gambar') {
                document.body.classList.add('mode-gambar');
            } else if (gameMode === 'perkalian') {
                document.body.classList.add('mode-perkalian');
            } else if (gameMode === 'pembagian') {
                document.body.classList.add('mode-pembagian');
            } else if (gameMode === 'kosakata') {
                document.body.classList.add('mode-kosakata');
            }

            const savedSession = StorageSystem.loadSessionForMode(gameMode);
            if (savedSession) {
                questions = savedSession.questions;
                activeIndex = savedSession.activeIndex || 0;
                totalAttempts = savedSession.totalAttempts || 0;
                totalQuestions = savedSession.totalQuestions || questions.length;
                timerSeconds = savedSession.timerSeconds || 0;
                activeCarryCol = null;
                UIController.setSubmitDisabled(false);
                UIController.renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol);
                UIController.updateTimerDisplay(timerSeconds);
                UIController.showModal(document.getElementById('resume-modal'));
            } else {
                totalQuestions = 10;
                questions = QuestionGenerator.generateSusunQuestions(totalQuestions);
                activeCarryCol = null;
                UIController.setSubmitDisabled(false);
                UIController.renderWorksheet(questions, activeIndex, gameMode, currentFilter, activeCarryCol);
                UIController.showModal(document.getElementById('start-modal'));
            }

            printWatermark();
        }

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

        return {
            init
        };
    })();

    // Start application on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        GameEngine.init();
    });

})();
