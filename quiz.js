/* Group quiz: instructor-controlled scoring and locally saved turns. */
(function () {
    'use strict';

    const STORAGE_KEY = 'super_kid_math_quiz_v1';
    const TURNS_PER_PLAYER = 10;
    const MAX_PLAYERS = 20;
    const root = document.getElementById('quiz-app');
    const content = document.getElementById('quiz-content');
    let state = null;
    let draftNames = ['', ''];
    let feedbackTimer = null;
    let feedbackPending = false;
    let confettiTimer = null;

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function shuffle(items) {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('Quiz tidak dapat disimpan:', error);
        }
    }

    function clear() {
        if (feedbackTimer) clearTimeout(feedbackTimer);
        if (confettiTimer) clearTimeout(confettiTimer);
        feedbackTimer = null;
        confettiTimer = null;
        feedbackPending = false;
        root.querySelector('.quiz-feedback')?.remove();
        root.querySelector('.quiz-confetti')?.remove();
        state = null;
        localStorage.removeItem(STORAGE_KEY);
    }

    function load() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.players) ||
                parsed.players.length < 2 || parsed.players.length > MAX_PLAYERS ||
                !Array.isArray(parsed.cards) || parsed.cards.length !== parsed.players.length * TURNS_PER_PLAYER ||
                !parsed.players.every(player => typeof player.name === 'string' &&
                    Number.isFinite(player.score) && Number.isInteger(player.turns) &&
                    player.turns >= 0 && player.turns <= TURNS_PER_PLAYER) ||
                !parsed.cards.every(card => Number.isInteger(card.id) &&
                    ['question', 'effect'].includes(card.type) && typeof card.opened === 'boolean') ||
                !Number.isInteger(parsed.activePlayerIndex) ||
                parsed.activePlayerIndex < 0 || parsed.activePlayerIndex >= parsed.players.length) return null;
            // Sessions saved before the tie-breaker existed retain player order as fallback.
            parsed.players.forEach((player, index) => {
                if (!Number.isInteger(player.scoreOrder)) player.scoreOrder = index + 1;
            });
            if (!Number.isInteger(parsed.scoreEventOrder)) {
                parsed.scoreEventOrder = Math.max(...parsed.players.map(player => player.scoreOrder));
            }
            const bank = Array.isArray(window.SOAL_EFEK_BANK) ? window.SOAL_EFEK_BANK : [];
            const legacyKinds = {
                bonus: ['gain', 20], penalty: ['lose', 10],
                last: ['giveLastPercent', 50], random: ['giveRandom', 10]
            };
            parsed.cards.forEach(card => {
                if (card.type !== 'effect' || typeof card.effect !== 'string') return;
                const legacy = legacyKinds[card.effect];
                card.effect = legacy ? bank.find(item => item.kind === legacy[0] && item.amount === legacy[1]) : null;
            });
            if (parsed.cards.some(card => card.type === 'effect' && !card.effect)) return null;
            return parsed;
        } catch (error) {
            return null;
        }
    }

    function show() {
        root.classList.remove('hidden');
        document.body.classList.add('mode-quiz');
        document.body.classList.remove('modal-open');
        window.scrollTo(0, 0);
    }

    function hide() {
        root.classList.add('hidden');
        document.body.classList.remove('mode-quiz');
    }

    function readDraft() {
        draftNames = [...content.querySelectorAll('.quiz-name')].map(input => input.value);
    }

    function renderSetup(message = '') {
        show();
        content.innerHTML = `<div class="quiz-panel quiz-setup">
            <h2>Siapa saja yang bermain?</h2>
            <p>Masukkan 2–20 nama. Setiap pemain mendapat 10 giliran.</p>
            <div class="quiz-name-list">${draftNames.map((name, index) => `
                <div class="quiz-name-card">
                    <div class="quiz-name-card-head"><label for="quiz-player-${index}">Pemain ${index + 1}</label>
                        <button type="button" data-quiz-action="remove" data-index="${index}" aria-label="Hapus pemain ${index + 1}" ${draftNames.length <= 2 ? 'disabled' : ''}>✕</button></div>
                    <span class="quiz-name-card-icon" aria-hidden="true">👤</span>
                    <input id="quiz-player-${index}" class="quiz-name" maxlength="30" value="${escapeHtml(name)}" autocomplete="off" placeholder="Nama pemain">
                </div>`).join('')}
                ${draftNames.length < MAX_PLAYERS ? `<button type="button" class="quiz-add-card" data-quiz-action="add"><span aria-hidden="true">＋</span><strong>Tambah pemain</strong></button>` : ''}
            </div>
            <p class="quiz-error" role="alert">${escapeHtml(message)}</p>
            <div class="quiz-actions"><button type="button" class="quiz-primary" data-quiz-action="start">Mulai Quiz</button></div>
        </div>`;
    }

    function questionPool() {
        const sources = [
            ['cerita', window.SOAL_CERITA_BANK],
            ['gambar', window.SOAL_GAMBAR_BANK],
            ['kosakata', window.SOAL_KOSAKATA_BANK]
        ];
        return sources.map(([kind, bank]) => shuffle((Array.isArray(bank) ? bank : [])
            .filter(item => item && item.answer !== undefined &&
                (kind === 'kosakata' ? item.sentence : item.story))
            .map(item => ({ kind, id: item.id, prompt: kind === 'kosakata' ? item.sentence : item.story,
                answer: item.answer, distractors: item.distractors || [],
                groups: kind === 'gambar' ? item.groups || [] : [] }))));
    }

    function makeCards(playerCount) {
        const count = playerCount * TURNS_PER_PLAYER;
        const effectCount = Math.round(count * 0.2);
        const pools = questionPool();
        const requiredQuestions = count - effectCount;
        if (pools.reduce((sum, pool) => sum + pool.length, 0) < requiredQuestions) return null;
        const bank = Array.isArray(window.SOAL_EFEK_BANK) ? window.SOAL_EFEK_BANK : [];
        const half = effectCount / 2;
        const positives = shuffle(bank.filter(effect => effect.polarity === 'positive')).slice(0, half);
        const negatives = shuffle(bank.filter(effect => effect.polarity === 'negative')).slice(0, half);
        if (positives.length !== half || negatives.length !== half) return null;
        const questions = [];
        let source = 0;
        while (questions.length < requiredQuestions) {
            if (pools[source].length) questions.push(pools[source].pop());
            source = (source + 1) % pools.length;
        }
        return shuffle([
            ...questions.map(question => ({ type: 'question', question,
                options: shuffle([question.answer, ...question.distractors]), opened: false })),
            ...[...positives, ...negatives].map(effect => ({ type: 'effect', effect, opened: false }))
        ]).map((card, index) => ({ ...card, id: index + 1 }));
    }

    function start() {
        readDraft();
        const names = draftNames.map(name => name.trim());
        if (names.length < 2 || names.length > MAX_PLAYERS || names.some(name => !name)) {
            renderSetup('Isi semua nama pemain (2–20 orang).');
            return;
        }
        if (new Set(names.map(name => name.toLocaleLowerCase('id-ID'))).size !== names.length) {
            renderSetup('Setiap pemain harus memiliki nama yang berbeda.');
            return;
        }
        const cards = makeCards(names.length);
        if (!cards) {
            renderSetup('Bank soal atau bank efek belum cukup untuk permainan ini.');
            return;
        }
        state = { version: 1, players: names.map((name, index) => ({
            name, score: 0, turns: 0, scoreOrder: index + 1
        })), scoreEventOrder: names.length,
            cards, activePlayerIndex: 0, selectedCardId: null, effectTargetIndex: null,
            finished: false };
        save();
        renderBoard();
    }

    function scoreBoard() {
        return `<div class="quiz-scores">${state.players.map((player, index) => `
            <div class="quiz-score ${index === state.activePlayerIndex && !state.finished ? 'active' : ''}">
                <strong>${escapeHtml(player.name)}</strong><span>${player.score} poin</span>
                <small>${player.turns}/${TURNS_PER_PLAYER} giliran</small>
            </div>`).join('')}</div>`;
    }

    function renderBoard() {
        show();
        if (state.finished) {
            renderResults();
            return;
        }
        const opened = state.cards.filter(card => card.opened).length;
        const player = state.players[state.activePlayerIndex];
        const selected = state.cards.find(card => card.id === state.selectedCardId);
        content.innerHTML = `<div class="quiz-panel">
            <div class="quiz-status"><h2>Giliran ${escapeHtml(player.name)}</h2>
                <span>${opened} dari ${state.cards.length} kartu dibuka</span></div>
            ${scoreBoard()}
            ${selected ? renderSelected(selected) : `<p class="quiz-instruction">${escapeHtml(player.name)}, pilih satu kartu tertutup.</p>
                <div class="quiz-card-grid">${state.cards.map(card => `<button type="button"
                    class="quiz-card ${card.opened ? 'opened' : ''}" data-quiz-action="pick" data-card="${card.id}"
                    ${card.opened ? 'disabled' : ''} aria-label="Kartu nomor ${card.id}${card.opened ? ', sudah dibuka' : ''}">${card.opened ? '✓' : card.id}</button>`).join('')}</div>`}
            <div class="quiz-actions"><button type="button" class="quiz-secondary" data-quiz-action="new">Mulai permainan baru</button></div>
        </div>`;
    }

    function resolveEffect(card, preferredTarget = null) {
        const effect = card.effect;
        const actorIndex = state.activePlayerIndex;
        const actor = state.players[actorIndex];
        const others = state.players.map((_, index) => index).filter(index => index !== actorIndex);
        let targetIndex = null;
        if (['share', 'giveRandom'].includes(effect.kind)) {
            targetIndex = others.includes(preferredTarget) ? preferredTarget :
                others[Math.floor(Math.random() * others.length)];
        } else if (['giveLast', 'giveLastPercent'].includes(effect.kind)) {
            const lowest = Math.min(...others.map(index => state.players[index].score));
            targetIndex = others.includes(preferredTarget) ? preferredTarget :
                others.find(index => state.players[index].score === lowest);
        }
        const target = targetIndex === null ? null : state.players[targetIndex];
        const amount = effect.amount;
        let message = '';
        let deltas = [];
        if (effect.kind === 'gain') {
            message = `${actor.name} mendapat ${amount} poin.`;
            deltas = [{ index: actorIndex, delta: amount }];
        } else if (effect.kind === 'gainIfLast') {
            const extra = actor.score === Math.min(...state.players.map(player => player.score)) ? 10 : 0;
            message = `${actor.name} mendapat ${amount} poin${extra ? ' dan bonus 10 poin karena berada di posisi terakhir' : ''}.`;
            deltas = [{ index: actorIndex, delta: amount + extra }];
        } else if (effect.kind === 'gainTurn') {
            const extra = actor.turns * 2;
            message = `${actor.name} mendapat ${amount} poin ditambah ${extra} poin dari giliran sebelumnya.`;
            deltas = [{ index: actorIndex, delta: amount + extra }];
        } else if (effect.kind === 'share') {
            const gift = Math.ceil(amount / 2);
            message = `${actor.name} mendapat ${amount} poin dan ${target.name} mendapat hadiah ${gift} poin.`;
            deltas = [{ index: actorIndex, delta: amount }, { index: targetIndex, delta: gift }];
        } else if (effect.kind === 'catchUp') {
            const extra = Math.min(20, Math.max(0, Math.max(...state.players.map(player => player.score)) - actor.score));
            message = `${actor.name} mendapat ${amount} poin ditambah bonus mengejar ${extra} poin.`;
            deltas = [{ index: actorIndex, delta: amount + extra }];
        } else if (effect.kind === 'lose') {
            message = `${actor.name} kehilangan ${amount} poin.`;
            deltas = [{ index: actorIndex, delta: -amount }];
        } else if (effect.kind === 'giveLast' || effect.kind === 'giveRandom') {
            message = `${actor.name} memberikan ${amount} poin kepada ${target.name}${effect.kind === 'giveLast' ? ', pemain lain dengan skor terendah' : ', pemain yang dipilih acak'}.`;
            deltas = [{ index: actorIndex, delta: -amount }, { index: targetIndex, delta: amount }];
        } else if (effect.kind === 'losePercent' || effect.kind === 'giveLastPercent') {
            const loss = Math.max(5, Math.ceil(Math.max(0, actor.score) * amount / 100));
            if (effect.kind === 'losePercent') {
                message = `${actor.name} kehilangan ${loss} poin (${amount}% dari skor positif, minimal 5 poin).`;
                deltas = [{ index: actorIndex, delta: -loss }];
            } else {
                message = `${actor.name} memberikan ${loss} poin kepada ${target.name} (${amount}% dari skor positif, minimal 5 poin).`;
                deltas = [{ index: actorIndex, delta: -loss }, { index: targetIndex, delta: loss }];
            }
        }
        return { message, deltas };
    }

    function renderSelected(card) {
        if (card.type === 'effect') return `<div class="quiz-reveal quiz-effect-${card.effect.polarity}" aria-live="polite">
            <div class="quiz-reveal-icon">${card.effect.polarity === 'positive' ? '✨' : '🎭'}</div>
            <h3>${escapeHtml(card.effect.title)}</h3>
            <p>${escapeHtml(card.outcome.message)}</p>
            <button type="button" class="quiz-primary" data-quiz-action="apply">Terapkan efek & lanjutkan</button></div>`;
        const q = card.question;
        const labels = { cerita: 'Soal Cerita', gambar: 'Hitung Gambar', kosakata: 'Kosakata' };
        const options = card.options;
        return `<div class="quiz-reveal" aria-live="polite">
            <h3>📚 ${labels[q.kind]} #${card.id}</h3>
            <p class="quiz-question">${escapeHtml(q.prompt)}</p>
            ${q.kind === 'gambar' ? `<div class="quiz-picture">${q.groups.map(group => `
                <div><strong>${escapeHtml(group.title || group.emoji || 'Objek')}</strong>
                    <span>${escapeHtml(group.emoji || '●').repeat(Math.min(30, Math.max(0, Number(group.count) || 0)))}</span>
                    <small>× ${Number(group.count) || 0}</small></div>`).join('')}</div>` : ''}
            <div class="quiz-options">${options.map((value, index) => `<span>${'ABC'[index]}. ${escapeHtml(value)}</span>`).join('')}</div>
            <details class="quiz-answer"><summary>Lihat kunci jawaban (instruktur)</summary><strong>${escapeHtml(q.answer)}</strong></details>
            <p class="quiz-instruction">Instruktur pilih hasil jawaban:</p>
            <div class="quiz-actions"><button type="button" class="quiz-primary" data-quiz-action="correct">✓ Benar (+10)</button>
                <button type="button" class="quiz-secondary" data-quiz-action="wrong">✕ Salah (0)</button></div>
        </div>`;
    }

    function pick(cardId) {
        if (!state || state.finished || state.selectedCardId !== null) return;
        const card = state.cards.find(item => item.id === cardId);
        if (!card || card.opened) return;
        state.selectedCardId = cardId;
        if (card.type === 'effect') card.outcome = resolveEffect(card);
        save();
        renderBoard();
    }

    function finishTurn() {
        const card = state.cards.find(item => item.id === state.selectedCardId);
        if (!card || card.opened || state.finished) return;
        card.opened = true;
        state.players[state.activePlayerIndex].turns++;
        state.selectedCardId = null;
        if (state.cards.every(item => item.opened)) {
            state.finished = true;
            save();
            renderResults();
            return;
        }
        for (let step = 1; step <= state.players.length; step++) {
            const next = (state.activePlayerIndex + step) % state.players.length;
            if (state.players[next].turns < TURNS_PER_PLAYER) {
                state.activePlayerIndex = next;
                break;
            }
        }
        save();
        renderBoard();
    }

    function grade(correct) {
        const card = state && state.cards.find(item => item.id === state.selectedCardId);
        if (feedbackPending || !card || card.type !== 'question' || card.opened) return;
        if (correct) setScore(state.activePlayerIndex, state.players[state.activePlayerIndex].score + 10);
        feedbackPending = true;
        finishTurn();
        const feedback = document.createElement('div');
        feedback.className = `quiz-feedback ${correct ? 'correct' : 'wrong'}`;
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('aria-live', 'assertive');
        feedback.innerHTML = correct
            ? '<div class="quiz-feedback-card"><span aria-hidden="true">🌟</span><strong>Benar! +10 poin</strong><small>Hebat, lanjut ke pemain berikutnya!</small></div>'
            : '<div class="quiz-feedback-card"><span aria-hidden="true">💪</span><strong>Belum tepat</strong><small>Tetap semangat! Giliran berikutnya.</small></div>';
        root.appendChild(feedback);
        feedbackTimer = setTimeout(() => {
            feedback.remove();
            feedbackPending = false;
            feedbackTimer = null;
        }, 1200);
    }

    function setScore(index, nextScore) {
        const player = state.players[index];
        if (player.score === nextScore) return;
        player.score = nextScore;
        player.scoreOrder = ++state.scoreEventOrder;
    }

    function applyEffect() {
        const card = state && state.cards.find(item => item.id === state.selectedCardId);
        if (!card || card.type !== 'effect' || card.opened || !card.outcome) return;
        card.outcome.deltas.forEach(({ index, delta }) => {
            setScore(index, state.players[index].score + delta);
        });
        finishTurn();
    }

    function launchConfetti() {
        if (confettiTimer) clearTimeout(confettiTimer);
        root.querySelector('.quiz-confetti')?.remove();
        const layer = document.createElement('div');
        layer.className = 'quiz-confetti';
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = Array.from({ length: 80 }, () => `<span style="--x:${Math.random() * 100}vw;--drift:${Math.random() * 180 - 90}px;--delay:${Math.random() * 1.8}s;--duration:${3 + Math.random() * 1.5}s;--hue:${Math.floor(Math.random() * 360)}"></span>`).join('');
        root.appendChild(layer);
        confettiTimer = setTimeout(() => {
            layer.remove();
            confettiTimer = null;
        }, 6500);
    }

    function renderResults() {
        show();
        const ranking = state.players.map((player, index) => ({ ...player, index }))
            .sort((a, b) => b.score - a.score || a.scoreOrder - b.scoreOrder || a.index - b.index);
        const medals = ['🥇', '🥈', '🥉'];
        content.innerHTML = `<div class="quiz-panel quiz-results"><h2>🏆 Quiz Selesai!</h2>
            <p>Semua ${state.cards.length} kartu sudah dibuka. Inilah peringkat akhir:</p>
            <div class="quiz-podium">${ranking.slice(0, 3).map((player, rank) => `
                <div class="quiz-podium-place place-${rank + 1}">
                    <div class="quiz-podium-person"><span class="quiz-medal" aria-hidden="true">${medals[rank]}</span>
                        <strong>${escapeHtml(player.name)}</strong><span>${player.score} poin</span></div>
                    <div class="quiz-podium-step">${rank + 1}</div>
                </div>`).join('')}</div>
            ${ranking.length > 3 ? `<div class="quiz-rest"><h3>Peringkat lainnya</h3><ol start="4">${ranking.slice(3).map((player, index) => `
                <li><strong>${index + 4}. ${escapeHtml(player.name)}</strong><span>${player.score} poin</span></li>`).join('')}</ol></div>` : ''}
            <button type="button" class="quiz-primary" data-quiz-action="new">Main lagi</button></div>`;
        launchConfetti();
    }

    function openSetup() {
        draftNames = ['', ''];
        renderSetup();
    }

    function init() {
        document.getElementById('quiz-menu').addEventListener('click', () => {
            if (state && !state.finished && !window.confirm('Keluar dari Quiz dan hapus progres permainan?')) return;
            clear();
            hide();
            document.getElementById('start-modal').classList.remove('hidden');
            document.body.classList.add('modal-open');
        });
        content.addEventListener('click', event => {
            if (feedbackPending) return;
            const button = event.target.closest('[data-quiz-action]');
            if (!button || button.disabled) return;
            const action = button.dataset.quizAction;
            if (action === 'add') { readDraft(); draftNames.push(''); renderSetup(); }
            if (action === 'remove') { readDraft(); draftNames.splice(Number(button.dataset.index), 1); renderSetup(); }
            if (action === 'start') start();
            if (action === 'pick') pick(Number(button.dataset.card));
            if (action === 'correct') grade(true);
            if (action === 'wrong') grade(false);
            if (action === 'apply') applyEffect();
            if (action === 'new') {
                if (state && !state.finished && !window.confirm('Hapus progres Quiz dan mulai permainan baru?')) return;
                clear(); openSetup();
            }
            if (action === 'resume') renderBoard();
            if (action === 'discard') { clear(); openSetup(); }
        });
        state = load();
        if (state) {
            const selected = state.cards.find(card => card.id === state.selectedCardId);
            if (selected && selected.type === 'effect' && !selected.outcome) {
                selected.outcome = resolveEffect(selected, state.effectTargetIndex);
                save();
            }
            show();
            for (const id of ['start-modal', 'resume-modal']) document.getElementById(id).classList.add('hidden');
            content.innerHTML = `<div class="quiz-panel quiz-results"><h2>Lanjutkan Quiz?</h2>
                <p>Permainan ${state.players.length} pemain masih tersimpan.</p>
                <div class="quiz-actions"><button type="button" class="quiz-primary" data-quiz-action="resume">Lanjutkan</button>
                <button type="button" class="quiz-secondary" data-quiz-action="discard">Mulai baru</button></div></div>`;
        }
    }

    window.QuizGame = { init, openSetup, hide };
})();
