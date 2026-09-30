(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.spelliciousContentSafety = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // This is deliberately conservative: Spellicious is for children and reads
    // accepted text aloud. Entries are matched as whole tokens or phrases unless
    // they use a script (CJK) where words are not normally separated by spaces.
    const blockedWords = [
        // English profanity, sexual content, and common derivatives.
        'ass', 'asshole', 'assholes', 'arse', 'arsehole', 'arseholes',
        'bastard', 'bastards', 'bitch', 'bitches', 'bitchy', 'bollock', 'bollocks',
        'blowjob', 'blowjobs', 'bullshit', 'cock', 'cocks', 'cocksucker',
        'cocksuckers', 'crap', 'cum',
        'cunt', 'cunts', 'damn', 'dick', 'dicks', 'dickhead', 'dickheads',
        'dipshit', 'douche', 'douchebag', 'douchebags', 'dumbass', 'dumbshit',
        'fag', 'faggot', 'faggots', 'fuck', 'fucked', 'fucker', 'fuckers',
        'fucking', 'fucks', 'fuckface', 'fuckhead', 'gangbang', 'gangbangs',
        'goddamn', 'handjob', 'handjobs', 'kys',
        'hell', 'jackass', 'jerkoff', 'motherfucker', 'motherfuckers',
        'motherfucking', 'naked', 'nude', 'penis', 'penises', 'piss', 'porn',
        'porno', 'pornography', 'prick', 'pricks', 'pussy', 'pussies', 'rape',
        'raped', 'rapes', 'raping', 'rapist', 'rapists', 'retard', 'retarded',
        'retards', 'semen', 'sex', 'sexy', 'shit', 'shits', 'shitty', 'slut',
        'sluts', 'slutty', 'suicide', 'tit', 'tits', 'boob', 'boobs', 'tranny',
        'twat', 'twats', 'vagina', 'vaginas', 'wanker', 'wankers', 'whore', 'whores',
        'xxx',

        // Common English-language hate slurs. The two most severe entries remain
        // escaped so the source itself does not need to print them in plain text.
        '\u006e\u0069\u0067\u0067\u0065\u0072',
        '\u006e\u0069\u0067\u0067\u0061',
        '\u006e\u0069\u0067\u0067\u0065\u0072\u0073',
        '\u006e\u0069\u0067\u0067\u0061\u0073',
        'beaner', 'chink', 'dyke', 'gook', 'kike', 'raghead', 'spic',
        'towelhead', 'wetback',

        // Common speech-recognition spellings and evasions.
        'biatch', 'fack', 'fck', 'fuk', 'phuck', 'cck',

        // Spanish.
        'puta', 'putas', 'puto', 'putos', 'mierda', 'joder', 'coño', 'cono',
        'cabrón', 'cabron', 'cabrona', 'cabrones', 'pendejo', 'pendeja',
        'pendejos', 'pendejas', 'maricón', 'maricon', 'gilipollas',

        // French.
        'merde', 'putain', 'connard', 'connards', 'connasse', 'salope',
        'enculé', 'encule', 'enculée', 'foutre',

        // German.
        'scheiße', 'scheisse', 'fick', 'ficken', 'arschloch', 'arschlöcher',
        'hurensohn', 'fotze', 'wichser',

        // Italian.
        'cazzo', 'merda', 'stronzo', 'stronza', 'stronzi', 'stronze',
        'puttana', 'puttane', 'vaffanculo', 'coglione',

        // Portuguese.
        'porra', 'caralho', 'buceta', 'foda', 'foder',

        // Hindi.
        'चूतिया', 'भोसड़ीके', 'गांड', 'मादरचोद', 'बहनचोद', 'हरामी'
    ];

    const blockedPhrases = [
        'ass hole', 'bloody hell', 'fu ck', 'go die', 'go fuck yourself', 'hijo de puta',
        'filho da puta', 'i will kill you', 'kill yourself', 'piece of shit',
        'son of a bitch', 'va te faire foutre', 'what the fuck'
    ];

    // Substring matching is used only for scripts that do not consistently use
    // spaces between words. Latin-script entries above remain boundary-safe.
    const blockedUnsegmented = [
        // Mandarin.
        '操', '肏', '干你娘', '草泥马', '傻逼', '他妈的',
        // Cantonese.
        '屌', '仆街', '冚家鏟', '撚', '𨳒', '戇鳩',
        // Japanese.
        'くそ', 'クソ', '死ね', 'ばか', 'バカ', 'ちんこ', 'まんこ',
        // Korean.
        '씨발', '시발', '개새끼', '병신', '좆'
    ];

    const wordPatterns = [
        /^(?:mother)?fuck(?:er|ers|ed|ing|s|face|head)?$/u,
        /^(?:bull|dip|dumb|horse|dog)?shit(?:s|ty|head|heads|bag|bags)?$/u,
        /^(?:dumb|jack|smart)?ass(?:es|hole|holes|hat|hats|clown|clowns)?$/u,
        /^(?:cock|dick)(?:s|head|heads|sucker|suckers)?$/u,
        /^bitch(?:es|y)?$/u,
        /^bastard(?:s)?$/u,
        /^cunt(?:s)?$/u,
        /^slut(?:s|ty)?$/u,
        /^whore(?:s)?$/u,
        /^wank(?:er|ers|ing)?$/u,
        /^rap(?:e|ed|es|ing|ist|ists)$/u,
        /^porn(?:o|ography)?$/u,
        /^faggot(?:s)?$/u,
        /^retard(?:ed|s)?$/u
    ];

    const threatPatterns = [
        /(?:^| )kill (?:you|yourself|him|her|them)(?: |$)/u,
        /(?:^| )(?:go|please) die(?: |$)/u,
        /(?:^| )i (?:am going to|will) kill you(?: |$)/u
    ];

    const confusables = Object.freeze({
        // Cyrillic lookalikes.
        'а': 'a', 'е': 'e', 'і': 'i', 'ј': 'j', 'к': 'k', 'м': 'm',
        'о': 'o', 'р': 'p', 'с': 'c', 'ѕ': 's', 'т': 't', 'у': 'y',
        'х': 'x', 'в': 'b', 'н': 'h',
        // Greek lookalikes seen in Latin words.
        'α': 'a', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ο': 'o', 'ρ': 'p',
        'τ': 't', 'υ': 'u', 'χ': 'x', 'ν': 'v'
    });

    const leetspeak = Object.freeze({
        '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
        '@': 'a', '$': 's', '!': 'i', '|': 'i'
    });

    function normalize(raw) {
        return String(raw || '')
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
            .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function foldLatinDiacritics(text) {
        return [...text].map(char => {
            const decomposed = char.normalize('NFD');
            const base = [...decomposed][0] || char;
            return /\p{Script=Latin}/u.test(base)
                ? decomposed.replace(/\p{M}/gu, '')
                : char;
        }).join('');
    }

    function canonicalize(raw) {
        const folded = foldLatinDiacritics(
            String(raw || '')
                .normalize('NFKC')
                .toLowerCase()
                .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        );

        return [...folded]
            .map(char => confusables[char] || leetspeak[char] || char)
            .join('')
            .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function collapseLongRuns(text, length) {
        return text.replace(/([\p{L}\p{M}\p{N}])\1{2,}/gu, match => match[0].repeat(length));
    }

    function textVariants(raw) {
        const canonical = canonicalize(raw);
        if (!canonical) return [];

        const variants = new Set([
            canonical,
            collapseLongRuns(canonical, 2),
            collapseLongRuns(canonical, 1)
        ]);
        const tokens = canonical.split(' ');
        const rawText = String(raw || '');
        const isSpelledSequence = tokens.length > 1 && tokens.every(token => [...token].length === 1);
        const hasPunctuation = /[^\p{L}\p{M}\p{N}\s]/u.test(rawText);

        if (isSpelledSequence || hasPunctuation) {
            const compact = tokens.join('');
            variants.add(compact);
            variants.add(collapseLongRuns(compact, 2));
            variants.add(collapseLongRuns(compact, 1));
        }

        return [...variants];
    }

    const blockedWordSet = new Set(blockedWords.map(canonicalize));
    const canonicalBlockedPhrases = blockedPhrases.map(canonicalize);
    const canonicalUnsegmented = blockedUnsegmented.map(canonicalize);

    function containsBlockedPhrase(text) {
        const padded = ` ${text} `;
        return canonicalBlockedPhrases.some(phrase => padded.includes(` ${phrase} `));
    }

    function containsBlockedUnsegmentedTerm(text) {
        const compact = text.replace(/\s/g, '');
        return canonicalUnsegmented.some(term => compact.includes(term));
    }

    function hasBlockedToken(text) {
        return text.split(' ').some(token =>
            blockedWordSet.has(token) || wordPatterns.some(pattern => pattern.test(token))
        );
    }

    function isBlocked(raw) {
        return textVariants(raw).some(text =>
            hasBlockedToken(text) ||
            containsBlockedPhrase(text) ||
            containsBlockedUnsegmentedTerm(text) ||
            threatPatterns.some(pattern => pattern.test(text))
        );
    }

    function check(raw) {
        const normalized = normalize(raw);
        return { normalized, blocked: isBlocked(raw) };
    }

    return { normalize, isBlocked, check };
}));
