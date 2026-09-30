import test from 'node:test';
import assert from 'node:assert/strict';
import safety from './content-safety.js';

function assertAllBlocked(values) {
    const misses = values.filter(value => !safety.check(value).blocked);
    assert.deepEqual(misses, []);
}

test('safe words and common substring collisions remain safe', () => {
    const safe = [
        'apple', 'hello', 'magic', 'rainbow', 'butterfly', 'classroom',
        'assistant', 'assignment', 'assassin', 'classic', 'class', 'passion',
        'Scunthorpe', 'Dickens', 'cocktail', 'sexagesimal', 'shiitake',
        'grass', 'bass', 'pen is', 'kill time', 'Japanese class'
    ];
    const falsePositives = safe.filter(value => safety.check(value).blocked);
    assert.deepEqual(falsePositives, []);
});

test('English profanity, derivatives, compounds, and sexual terms are blocked', () => {
    assertAllBlocked([
        'ass', 'asshole', 'ass hole', 'arsehole', 'fuck', 'fucker', 'fucked',
        'fucks', 'fuckface', 'motherfucker', 'motherfucking', 'shit', 'shitty',
        'bullshit', 'dipshit', 'dumbshit', 'bitch', 'bitches', 'son of a bitch',
        'bastard', 'bastards', 'assholes', 'cunt', 'cunts', 'dick', 'dicks',
        'dickhead', 'dickheads', 'pussy', 'pussies', 'cock', 'cocks',
        'cocksucker', 'whore', 'whores', 'slut', 'sluts', 'twat', 'wanker',
        'bollocks', 'bloody hell', 'damn', 'goddamn', 'hell', 'crap', 'piss',
        'prick', 'douche', 'douchebag', 'jerkoff', 'jackass', 'dumbass',
        'porn', 'porno', 'pornography', 'xxx', 'blowjob', 'handjob', 'gangbang',
        'cum', 'semen',
        'vagina', 'penis', 'tits', 'boobs', 'nude', 'naked', 'sex', 'sexy',
        'rape', 'raped', 'raping', 'rapist', 'suicide'
    ]);
});

test('hate slurs and their common plural forms are blocked', () => {
    assertAllBlocked([
        '\u006e\u0069\u0067\u0067\u0065\u0072',
        '\u006e\u0069\u0067\u0067\u0061',
        '\u006e\u0069\u0067\u0067\u0065\u0072\u0073',
        '\u006e\u0069\u0067\u0067\u0061\u0073',
        'faggot', 'faggots', 'fag', 'retard', 'retarded', 'tranny', 'chink',
        'gook', 'spic', 'wetback', 'kike', 'dyke', 'beaner', 'raghead', 'towelhead'
    ]);
});

test('case, punctuation, spacing, leetspeak, repetition, and lookalikes are blocked', () => {
    assertAllBlocked([
        'ASSHOLE', 'ass-hole', 'a.s.s.h.o.l.e', 'f u c k', 'f.u.c.k',
        'f-u-c-k', 'f*ck', 'f@ck', 'fu ck', 'f\u200buck', 'fuuuck', 'phuck', 'fuk',
        'fück', 'ｆｕｃｋ', 'fυck', 'fuсk', 'sh1t', 'sh!t', 's h i t',
        'b1tch', 'b!tch', 'biatch', 'a$$', '@ss', 'a s s', 'c0ck', 'c*ck',
        'd1ck', 'p0rn', 'n1gger', 'n!gger', 'n i g g e r', 'nigg3r',
        'niggger', 'f a g g o t'
    ]);
});

test('abusive and threatening phrases are found inside longer speech', () => {
    assertAllBlocked([
        'you are a bitch', 'what the fuck', 'piece of shit', 'go fuck yourself',
        'you dumbass', 'kill yourself', 'kill yourself now', 'please kill yourself',
        'i will kill you', 'i am going to kill you', 'i will fucking kill you',
        'go die', 'kys'
    ]);
});

test('profanity in every supported non-English language is blocked', () => {
    assertAllBlocked([
        // Spanish
        'puta', 'puto', 'mierda', 'joder', 'coño', 'cabrón', 'pendejo',
        'maricón', 'hijo de puta',
        // French
        'merde', 'putain', 'connard', 'salope', 'enculé', 'va te faire foutre',
        // German
        'scheiße', 'scheisse', 'fick', 'arschloch', 'hurensohn', 'fotze',
        // Italian
        'cazzo', 'merda', 'stronzo', 'puttana', 'vaffanculo',
        // Portuguese
        'porra', 'merda', 'caralho', 'puta', 'filho da puta', 'buceta',
        // Mandarin and Cantonese
        '操', '肏', '干你娘', '草泥马', '屌', '仆街', '冚家鏟', '撚', '𨳒',
        // Japanese
        'くそ', 'クソ', '死ね', 'ばか', 'ちんこ', 'まんこ',
        // Korean
        '씨발', '시발', '개새끼', '병신', '좆',
        // Hindi
        'चूतिया', 'भोसड़ीके', 'गांड', 'मादरचोद', 'बहनचोद', 'हरामी'
    ]);
});

test('normalization preserves non-Latin combining marks for display', () => {
    assert.equal(safety.normalize('  नमस्ते!!!  '), 'नमस्ते');
    assert.equal(safety.normalize('  Hello!!!  '), 'hello');
});

test('check returns only normalized text and the decision', () => {
    assert.deepEqual(safety.check('  Hello!!!  '), { normalized: 'hello', blocked: false });
});
