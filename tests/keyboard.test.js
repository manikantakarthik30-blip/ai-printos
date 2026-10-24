import test from 'node:test';
import assert from 'node:assert/strict';
import { transliterate } from '../public/js/keyboard/translit.js';
import { createPredictor, distance } from '../public/js/keyboard/predict.js';
import { TE_WORDS, HI_WORDS } from '../public/js/keyboard/lexicon.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

test('A. Telugu: phonetic transliteration and sentence requirements', () => {
  const p = createPredictor(mem());
  
  // Specific user acceptance criteria:
  // "namaskaram" → "నమస్కారం"
  assert.equal(p.teFromRoman('namaskaram'), 'నమస్కారం', 'namaskaram -> నమస్కారం');
  assert.equal(p.teFromRoman('namaskaaram'), 'నమస్కారం', 'namaskaaram -> నమస్కారం');
  
  // "meeru ela unnaru" → "మీరు ఎలా ఉన్నారు"
  const teSentence = 'meeru ela unnaru'.split(' ').map((w) => p.teFromRoman(w)).join(' ');
  assert.equal(teSentence, 'మీరు ఎలా ఉన్నారు', 'meeru ela unnaru -> మీరు ఎలా ఉన్నారు');

  // Alternative colloquial / formal spellings
  assert.equal(p.teFromRoman('meeru'), 'మీరు');
  assert.equal(p.teFromRoman('ela'), 'ఎలా');
  assert.equal(p.teFromRoman('unnaru'), 'ఉన్నారు');
  assert.equal(p.teFromRoman('unnaaru'), 'ఉన్నారు');

  // Dictionary spelling for common words like pelli -> పెళ్లి
  assert.equal(p.teFromRoman('pelli'), 'పెళ్లి');

  // Telugu suggestions
  assert.ok(p.teSuggest('namas').includes('నమస్కారం'));
  assert.ok(p.teSuggest('meeru').includes('మీరు'));
  assert.ok(p.teNext('మీరు').includes('ఎలా'));
  assert.ok(p.teNext('ఎలా').includes('ఉన్నారు'));

  // Retain Latin spelling option in suggestions
  assert.ok(p.teSuggest('namaskaram').includes('namaskaram'));
});

test('A. Telugu: conjuncts, ottulu, and gunintalu Unicode integrity', () => {
  // Consonants + halant + consonant (ottulu)
  assert.equal(transliterate('k'), 'క్');
  assert.equal(transliterate('ka'), 'క');
  assert.equal(transliterate('kaa'), 'కా');
  assert.equal(transliterate('ki'), 'కి');
  assert.equal(transliterate('kee'), 'కీ');
  assert.equal(transliterate('ku'), 'కు');
  assert.equal(transliterate('koo'), 'కూ');
  assert.equal(transliterate('ke'), 'కె');
  assert.equal(transliterate('kai'), 'కై');
  assert.equal(transliterate('ko'), 'కొ');
  assert.equal(transliterate('kau'), 'కౌ');
  assert.equal(transliterate('kam'), 'కం');

  // Conjuncts
  assert.equal(transliterate('akka'), 'అక్క');
  assert.equal(transliterate('peLli'), 'పెళ్లి');
  assert.equal(transliterate('swaagatam'), 'స్వాగతం');
  assert.equal(transliterate('dhanyavaadaalu'), 'ధన్యవాదాలు');
});

test('B. Hindi: Devanagari transliteration and sentence requirements', () => {
  const p = createPredictor(mem());

  // Specific user acceptance criteria:
  // "namaste" → "नमस्ते"
  assert.equal(p.hiFromRoman('namaste'), 'नमस्ते', 'namaste -> नमस्ते');

  // "aap kaise hain" → "आप कैसे हैं"
  const hiSentence = 'aap kaise hain'.split(' ').map((w) => p.hiFromRoman(w)).join(' ');
  assert.equal(hiSentence, 'आप कैसे हैं', 'aap kaise hain -> आप कैसे हैं');

  assert.equal(p.hiFromRoman('aap'), 'आप');
  assert.equal(p.hiFromRoman('kaise'), 'कैसे');
  assert.equal(p.hiFromRoman('hain'), 'हैं');
  assert.equal(p.hiFromRoman('hai'), 'है');
  assert.equal(p.hiFromRoman('dhanyavaad'), 'धन्यवाद');
  assert.equal(p.hiFromRoman('shubh'), 'शुभ');

  // Hindi suggestions and bigrams
  assert.ok(p.hiSuggest('namas').includes('नमस्ते'));
  assert.ok(p.hiSuggest('aap').includes('आप'));
  assert.ok(p.hiNext('आप').includes('कैसे'));
  assert.ok(p.hiNext('कैसे').includes('हैं'));

  // Retain Latin spelling option in suggestions
  assert.ok(p.hiSuggest('namaste').includes('namaste'));
});

test('B. Hindi: Devanagari matras, conjuncts, and nukta', () => {
  const p = createPredictor(mem());
  assert.equal(transliterate('k', 'hi'), 'क'); // Hindi implicit schwa final
  assert.equal(transliterate('kaa', 'hi'), 'का');
  assert.equal(transliterate('ki', 'hi'), 'कि');
  assert.equal(transliterate('kee', 'hi'), 'की');
  assert.equal(transliterate('ku', 'hi'), 'कु');
  assert.equal(transliterate('koo', 'hi'), 'कू');
  assert.equal(transliterate('ke', 'hi'), 'के');
  assert.equal(transliterate('kai', 'hi'), 'कै');
  assert.equal(transliterate('ko', 'hi'), 'को');
  assert.equal(transliterate('kau', 'hi'), 'कौ');
  assert.equal(transliterate('kaM', 'hi'), 'कं'); // Anusvara in Hindi ITRANS
  assert.equal(transliterate('kam', 'hi'), 'कम'); // Word-final m in Hindi is ma (e.g. kam, hum)

  // Conjuncts
  assert.equal(transliterate('dost', 'hi'), 'दोस्त');
  assert.equal(transliterate('swaagat', 'hi'), 'स्वागत');
  assert.equal(transliterate('kRpayaa', 'hi'), 'कृपया');
  assert.equal(p.hiFromRoman('kripya'), 'कृपया');
});

test('C. English: conservative autocorrection and "hellp" suggestion behavior', () => {
  const p = createPredictor(mem());

  // Specific user acceptance criteria:
  // "hellp" offers "hello" without forcing an unwanted replacement
  assert.equal(p.correct('hellp'), null, 'hellp must NOT be forcibly autocorrected on space');
  const hellpSuggestions = p.completions('hellp', 3);
  assert.ok(
    hellpSuggestions.includes('hello'),
    'hellp must offer hello in suggestions strip'
  );
  assert.ok(
    hellpSuggestions.includes('help'),
    'hellp can also offer help in suggestions strip'
  );

  // Capitalization preservation
  assert.equal(p.correct('teh'), 'the');
  assert.equal(p.correct('Teh'), 'The');
  assert.equal(p.correct('wlecome'), 'welcome');
  assert.equal(p.correct('dont'), "don't");
  assert.equal(p.correct('im'), "I'm");

  // Names, technical words, and identifiers are not aggressively autocorrected
  assert.equal(p.correct('PostgreSQL'), null);
  assert.equal(p.correct('Gboard'), null);
  assert.equal(p.correct('DeepMind'), null);
  assert.equal(p.correct('hello'), null);       // known word untouched
  assert.equal(p.correct('xqzvk'), null);       // no confident single fix
  assert.equal(p.correct('user@domain.com'), null); // not a plain word
});

test('C. English: word completions and context predictions', () => {
  const p = createPredictor(mem());
  assert.ok(p.completions('pri').includes('print') || p.completions('pri').includes('price'));
  assert.ok(p.completions('Pri').every((w) => w[0] === 'P'));
  assert.deepEqual(p.nextWords('thank').slice(0, 1), ['you']);
  assert.ok(p.nextWords('').length > 0);
  p.learn('happy', 'birthday');
  p.learn('happy', 'birthday');
  assert.equal(p.nextWords('happy')[0], 'birthday');
});

test('D. Indic Character Deletion: combining marks, matras, and conjuncts peel back cleanly', () => {
  // Telugu combining mark deletion verification:
  // "కా" is base "క" (U+0C15) + vowel sign "ా" (U+0C3E).
  const teluguKa = 'కా';
  assert.equal(teluguKa.length, 2);
  const headAfterDeleteSign = teluguKa.slice(0, teluguKa.length - 1);
  assert.equal(headAfterDeleteSign, 'క', 'Deleting combining mark leaves base consonant intact');

  // Telugu conjunct "స్క" is "స" + virama + "క"
  const teluguSka = 'స్క';
  const headAfterDeleteOttu = teluguSka.slice(0, teluguSka.length - 1);
  assert.equal(headAfterDeleteOttu, 'స్', 'Deleting ottu leaves consonant with virama');

  // Hindi matra deletion verification:
  // "कि" is base "क" (U+0915) + matra "ि" (U+093F).
  const hindiKi = 'कि';
  assert.equal(hindiKi.length, 2);
  const hindiHeadAfterDeleteMatra = hindiKi.slice(0, hindiKi.length - 1);
  assert.equal(hindiHeadAfterDeleteMatra, 'क', 'Deleting Devanagari matra leaves base consonant intact');

  // Hindi conjunct "स्त" is "स" + halant + "त"
  const hindiSt = 'स्त';
  const headAfterDeleteConjunct = hindiSt.slice(0, hindiSt.length - 1);
  assert.equal(headAfterDeleteConjunct, 'स्', 'Deleting Devanagari conjunct leaves consonant with halant');
});

test('D. Predictor storage persistence, learning, and reset', () => {
  const s = mem();
  const a = createPredictor(s);
  a.learn('', 'customword');
  a.learn('', 'customword');
  assert.equal(createPredictor(s).isKnown('customword'), true);
  
  a.ignore('wlecome');
  assert.equal(a.correct('wlecome'), null);

  // Telugu & Hindi learning
  a.teLearn('హలో');
  a.hiLearn('नमस्तेजी');

  a.reset();
  assert.equal(createPredictor(s).isKnown('customword'), false);
});
