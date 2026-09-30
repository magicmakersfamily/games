(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.spelliciousContentSafety = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    // Keep this list local and easy to expand. Matching is exact-token/phrase only.
    const blockedPhrases = new Set([
        'ass', 'asshole', 'ass hole', 'fuck', 'fucking', 'shit', 'bitch', 'bastard',
        'cunt', 'dick', 'dickhead', 'pussy', 'cock', 'whore', 'slut', 'porn', 'porno',
        'rape', 'rapist', 'kill yourself', 'i will kill you',
        '\u006e\u0069\u0067\u0067\u0065\u0072', '\u006e\u0069\u0067\u0067\u0061'
    ]);

    function normalize(raw) {
        return String(raw || '')
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isBlocked(raw) {
        const normalized = normalize(raw);
        if (!normalized) return false;
        const compact = normalized.replace(/\s/g, '');
        return blockedPhrases.has(normalized) || blockedPhrases.has(compact) ||
            normalized.split(' ').some(token => blockedPhrases.has(token));
    }

    function check(raw) {
        const normalized = normalize(raw);
        return { normalized, blocked: isBlocked(normalized) };
    }

    return { normalize, isBlocked, check };
}));
