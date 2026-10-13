/* 100 unique Quiz effects: 50 positive and 50 negative.
   Each family has ten themed cards; amount changes with the theme index. */
window.SOAL_EFEK_BANK = (function () {
    'use strict';

    const themes = [
        'Bintang', 'Pelangi', 'Roket', 'Balon', 'Komet',
        'Permata', 'Matahari', 'Bulan', 'Awan', 'Kupu-kupu'
    ];
    const families = [
        { polarity: 'positive', kind: 'gain', label: 'Hadiah' },
        { polarity: 'positive', kind: 'gainIfLast', label: 'Semangat Mengejar' },
        { polarity: 'positive', kind: 'gainTurn', label: 'Bonus Giliran' },
        { polarity: 'positive', kind: 'share', label: 'Berbagi Ceria' },
        { polarity: 'positive', kind: 'catchUp', label: 'Lompatan Skor' },
        { polarity: 'negative', kind: 'lose', label: 'Tantangan' },
        { polarity: 'negative', kind: 'giveLast', label: 'Hadiah untuk Terakhir' },
        { polarity: 'negative', kind: 'giveRandom', label: 'Hadiah Acak' },
        { polarity: 'negative', kind: 'losePercent', label: 'Potongan Persen' },
        { polarity: 'negative', kind: 'giveLastPercent', label: 'Berbagi Persen' }
    ];

    return families.flatMap((family, familyIndex) => themes.map((theme, themeIndex) => ({
        id: familyIndex * themes.length + themeIndex + 1,
        polarity: family.polarity,
        kind: family.kind,
        title: `${family.label} ${theme}`,
        amount: ['losePercent', 'giveLastPercent'].includes(family.kind)
            ? 10 + themeIndex * 5
            : 5 + themeIndex * 5
    })));
})();
