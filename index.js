// 객성록 HUD — SillyTavern UI extension
// 현대 동양 크툴루 헌터 시뮬레이션 「객성록」 전용 상태 엔진 + HUD.
// The model only writes per-turn deltas inside <state>…</state>. This extension
// replays every AI message from the start of the chat, so swipes, edits and
// deletions always produce a consistent state. Numbers never live in the prompt
// history; the current state is injected once per generation.

const MODULE = 'gaekseong';
const LOG = '[객성록]';
const INJECT_KEY = 'gaekseong_state';
const PROMPT_IN_CHAT = 1; // extension_prompt_types.IN_CHAT
const ROLE_SYSTEM = 0; // extension_prompt_roles.SYSTEM

const DEFAULTS = Object.freeze({
    enabled: true,
    allCharacters: false,
    hudExpanded: false,
    hudMini: false,
    msgCard: 'compact', // full | compact | off
    choices: 'tense', // tense | always | off
    choiceClick: 'fill', // fill | send
    glitch: true,
    zalgo: true,
    whispers: true,
    injectDepth: 1,
    autoRegister: true,
});

// ───────────────────────────── 데이터 ─────────────────────────────

const TIMES = ['새벽', '아침', '낮', '저녁', '밤', '자정'];
const MODES = { '일상': 'daily', '의뢰': 'case', '전투': 'battle' };
const SAN_STAGE_NAME = ['평정', '불면', '환각', '붕괴', '광인'];
const COR_STAGE_NAME = ['인간', '흔적', '이물', '인외', '객성화'];

const CONTRACTS = [
    {
        id: 'gwanchuk', name: '무명의 관측자', hanja: '無名觀者', element: '토',
        power: '간파(看破) — 괴이의 규칙·약점·진명(眞名)을 본다. 강하게 쓰면 과거나 미래의 한 장면이 보인다.',
        taboo: '매일 자정, 눈을 감은 채 자신의 피 세 스푼을 삼킬 것.',
        curse: '하루 동안 눈을 뜨면 모든 사람의 얼굴이 지워져 보인다.',
        symptom: '눈동자 둘레의 금빛 균열, 눈꺼풀 안쪽에 비치는 별자리, 타인의 시선을 무게로 느낀다.',
        voice: '말하지 않는다. 시야 가장자리에 문장이 "보인다".',
    },
    {
        id: 'sinbu', name: '젖은 신부', hanja: '水婚', element: '수',
        power: '수장(水葬) — 물을 부린다. 상대의 폐를 물로 채우거나, 물이 고인 곳을 통로로 삼는다.',
        taboo: '하루 한 번, 누군가에게 진심으로 "사랑해"라고 말할 것. 거짓이면 무효.',
        curse: '모든 음료에서 강물 맛이 나고, 잠들면 물속에서 깬다(수면 회복 불가).',
        symptom: '늘 젖어 있는 손끝, 귀 뒤의 아가미 같은 주름, 거울 속 젖은 면사포.',
        voice: '질투 많은 연인처럼 귓가에 속삭인다. 계약자가 다른 이에게 다정하면 화를 낸다.',
    },
    {
        id: 'seogi', name: '백골 서기', hanja: '白骨書記', element: '금',
        power: '기명(記名) — 상대의 진짜 이름을 써내면 그 이름에 명령 한 줄을 새긴다. 이름을 모르면 위력이 크게 준다.',
        taboo: '매일 한 사람의 진짜 이름을 받아 적을 것. 그리고 누구에게도 자신의 본명을 말하지 말 것.',
        curse: '자신의 이름이 하나씩 지워진다 — 서류에서, 기억에서, 사람들의 입에서.',
        symptom: '하얗게 드러나는 손가락 마디, 잉크 냄새 나는 땀, 남의 이름을 들으면 손이 저절로 받아 쓴다.',
        voice: '관공서 서기처럼 건조한 존댓말. "접수되었습니다."',
    },
    {
        id: 'adeung', name: '굶주린 등불', hanja: '餓燈', element: '화',
        power: '소진(燒盡) — 무엇이든 태운다. 강하게 쓰면 태운 만큼 계약자의 기억도 한 조각 탄다.',
        taboo: '매 끼니의 첫 숟갈을 불에 바칠 것. 그리고 남이 차려 준 음식을 거절하지 말 것.',
        curse: '채워지지 않는 허기. 하루 동안 회복이 절반이 되고 무엇이든 먹고 싶어진다.',
        symptom: '39도의 체온, 불빛 쪽으로 늘어나는 그림자, 입김에 섞이는 불티.',
        voice: '아이처럼 칭얼댄다. "배고파. 저거 태워도 돼?"',
    },
    {
        id: 'dodong', name: '거꾸로 선 아이', hanja: '倒童', element: '목',
        power: '역행(逆行) — 직전의 몇 초를 되감는다. 하루 한 번, 실패한 판정 하나를 다시 굴린다(오염 +8).',
        taboo: '문지방을 넘을 때는 반드시 뒷걸음으로 넘을 것.',
        curse: '하루 동안 시간이 "튄다" — 대화 중 몇 분씩 기억이 사라지고, 정신을 차리면 다른 곳에 있다.',
        symptom: '거꾸로 찍히는 발자국, 곁에서 느려지는 시계, 웃음소리에 겹치는 아이 웃음.',
        voice: '문장을 거꾸로 말한다. 장난스럽고 잔인한 반말.',
    },
    {
        id: 'cheongong', name: '구멍 난 하늘', hanja: '天孔', element: '무',
        power: '공(空) — 닿은 것을 지운다. 형체도, 소리도, 기록도. 가장 강하고 가장 비싸다(권능 오염 1.5배).',
        taboo: '하루 한 번, 아무도 없는 곳에서 하늘에 대고 자신의 비밀 하나를 말할 것. 말한 비밀은 자신에게서 사라진다.',
        curse: '하늘을 올려다볼 수 없게 된다. 고개를 들면 구멍이 이쪽을 내려다본다.',
        symptom: '군데군데 투명해지는 피부, 곁에서 빨려 들어가듯 사라지는 소리.',
        voice: '없다. 그것은 듣기만 한다. 침묵의 질감이 대답이다.',
    },
];

const JOBS = [
    { id: 'cheon', label: '사천감 사복교련 (하급 헌터)', rank: '사천감 사복교련(하급)', hp: 100, san: 80, cor: 5, cash: 400000, note: '국가 소속. 의뢰가 배정되고 장비가 지급된다. 대신 매주 오염 검사를 받는다.' },
    { id: 'mudang', label: '만신회 애동제자 (새내기 무당)', rank: '만신회 애동제자', hp: 90, san: 90, cor: 5, cash: 150000, note: '굿과 부적에 밝다. 신과 객성 사이에서 몸이 버틴다.' },
    { id: 'heuk', label: '흑첨 해결사 (무허가 프리랜서)', rank: '흑첨 해결사', hp: 100, san: 75, cor: 10, cash: 1200000, note: '돈은 되지만 뒤를 봐주는 사람이 없다.' },
    { id: 'civil', label: '민간인 (첫 괴이 생존자)', rank: '민간인', hp: 100, san: 85, cor: 3, cash: 800000, note: '아무것도 모른다. 모르기에 아직 덜 젖었다.' },
    { id: 'custom', label: '직접 입력', rank: '', hp: 100, san: 80, cor: 5, cash: 500000, note: '' },
];
const BACKGROUNDS = ['회사원', '대학생', '전직 경찰', '퇴마 가문의 낙오자', '편의점 야간 알바', '간호사', '배달 라이더', '직접 입력'];
const PLACES = ['흑수구', '청림구', '적야구', '황궁구', '백철구', '직접 입력'];

const MUTATIONS = {
    1: [
        { name: '검은 실핏줄', desc: '손목 아래로 먹물 같은 혈관이 번진다. 부적 없이도 잡귀의 기척을 느낀다.', en: "ink-black veins spread under the wrists; senses 잡귀 without talismans" },
        { name: '늦는 그림자', desc: '그림자가 반 박자 늦게 움직인다. 가끔 먼저 움직인다.', en: "shadow moves half a beat late — sometimes early" },
        { name: '녹슨 혀', desc: '입안에 늘 쇠 맛. 거짓말을 하면 잇몸에서 피가 난다.', en: "constant iron taste; gums bleed when lying" },
        { name: '물비린내', desc: '씻어도 몸에서 강물 냄새가 난다. 개와 고양이가 피한다.', en: "smells of river water however washed; dogs and cats avoid" },
        { name: '문신의 맥박', desc: '피부 아래로 계약 문양이 떠오르고, 괴이가 가까우면 꿈틀거린다.', en: "contract sigil surfaces under the skin and writhes near 괴이" },
    ],
    2: [
        { name: '세 번째 눈꺼풀', desc: '눈을 감아도 보인다. 그래서 잠들기 어렵다.', en: "sees with eyes closed, so can barely sleep" },
        { name: '이명의 합창', desc: '가끔 타인의 속마음이 라디오 잡음처럼 들린다. 원하지 않아도.', en: "sometimes hears others' thoughts like radio static, unwanted" },
        { name: '옆구리 비늘', desc: '옆구리에 검은 비늘이 돋았다. 칼날을 반쯤은 막아 준다.', en: "black scales on the flank, half-stops blades" },
        { name: '이름 하나의 망각', desc: '가까운 사람 하나의 이름이 머릿속에서 지워졌다. 얼굴은 기억난다.', en: "lost the name of one close person; the face remains" },
        { name: '체온 상실', desc: '몸이 늘 시체처럼 차갑다. 악수한 사람이 손을 뺀다.', en: "corpse-cold body; people pull away from a handshake" },
    ],
    3: [
        { name: '두 번째 입', desc: '쇄골 아래에 입이 생겼다. 밤마다 객성의 말을 대신 속삭인다.', en: "a mouth under the collarbone whispers the 객성's words at night" },
        { name: '빛의 거부', desc: '햇빛 아래에서 피부가 그을린다. 대신 밤에는 비정상적으로 강하다.', en: "skin scorches in sunlight; abnormally strong at night" },
        { name: '비치지 않음', desc: '거울과 사진에 더 이상 제대로 비치지 않는다. 일그러진 얼룩만 남는다.', en: "no longer shows properly in mirrors or photos, only a smear" },
        { name: '재의 맛', desc: '음식이 모두 재 맛이다. 향 연기만이 배를 채운다.', en: "all food tastes of ash; only incense smoke fills the stomach" },
        { name: '인간 아닌 걸음', desc: '관절이 하나 더 생긴 듯 걷는다. 보는 사람이 본능적으로 뒷걸음친다.', en: "walks as if with an extra joint; onlookers instinctively step back" },
    ],
};
const MADNESS = {
    2: [
        { name: '확인 강박', desc: '문과 창을 세 번씩 확인하지 않으면 견딜 수 없다.', en: "must check doors and windows three times" },
        { name: '웃는 얼굴 공포', desc: '웃는 얼굴 뒤에 다른 얼굴이 겹쳐 보인다.', en: "another face overlaps every smile" },
        { name: '부르는 목소리', desc: '누군가 계속 이름을 부른다. 돌아보면 아무도 없다.', en: "someone keeps calling the name; no one there" },
        { name: '숫자 집착', desc: '모든 것을 센다. 계단, 형광등, 상대의 이빨.', en: "counts everything — stairs, lights, teeth" },
    ],
    3: [
        { name: '해리', desc: '가끔 자신을 등 뒤에서 내려다본다. 몸이 남의 것 같다.', en: "sometimes watches self from behind; body feels borrowed" },
        { name: '객성 신앙', desc: '객성의 목소리가 위로처럼 들리기 시작했다. 위험한 징조다.', en: "the 객성's voice has started to feel like comfort — a dangerous sign" },
        { name: '현실 불신', desc: '지금 이 장면이 진짜인지 확신할 수 없다. 모든 사람을 시험하고 싶다.', en: "cannot trust the scene is real; wants to test everyone" },
        { name: '피의 갈망', desc: '피 냄새가 달다. 그 사실이 무섭다.', en: "blood smells sweet, and that is terrifying" },
    ],
};

// 시트 UI용 한국어 설명
const STAGE_DIRECTIVE = {
    san: ['', '잠이 얕고 사소한 착시가 생긴다. 소리가 반 박자 늦게 들린다.', '환각이 현실에 섞인다. 진짜와 가짜를 구분해 주지 않는다.', '서술 자체가 불안정하다. 아는 얼굴이 낯설고, 객성의 목소리가 끼어든다.', '광기에 삼켜졌다.'],
    cor: ['', '몸에 첫 흔적이 남았다. 동물과 아이가 피한다.', '괴이가 동족으로 착각한다. 사람들은 이유 없이 거리를 둔다.', '인간보다 괴이에 가깝다. 사천감은 처분을 검토한다.', '객성의 일부가 되었다.'],
};
// prompt-side (English); #TOKENS trigger matching lorebook entries via WI scan
const STAGE_EN = {
    san: ['', '#SAN1 불면: shallow sleep, small misperceptions, sounds half a beat late.',
        '#SAN2 환각: hallucinations mix with reality; never confirm what is real.',
        '#SAN3 붕괴: narration destabilizes — repeated sentences, familiar faces turn strange, the 객성\'s voice cuts in.',
        '#MAD 광인: madness ending, or the 객성 offers a last bargain.'],
    cor: ['', '#COR1 흔적: first visible mark; animals and children avoid {{user}}.',
        '#COR2 이물: 괴이 mistake {{user}} for kin; people keep distance; 권능 leaks out.',
        '#COR3 인외: closer to 괴이 than human — mirrors, photos and people prove it; 사천감 reviews disposal.',
        '#STARFALL 객성화: {{user}} has become part of the 객성; close with the ending.'],
};
const EL_HANJA = { '목': '木', '화': '火', '토': '土', '금': '金', '수': '水', '무': '無' };
const MODE_TOKEN = { '일상': '#MODE_DAILY', '의뢰': '#MODE_CASE', '전투': '#MODE_BATTLE' };

// ───────────────────────────── 유틸 ─────────────────────────────

const ctx = () => SillyTavern.getContext();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const clone = (o) => structuredClone(o);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');

function hashStr(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
}
function rngFrom(seed) {
    let a = hashStr(String(seed));
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function d100() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] % 100) + 1;
}
function h(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
}
function fuzzyFind(list, name, field = 'name') {
    const n = String(name ?? '').replace(/\s+/g, '');
    if (!n) return null;
    return list.find(x => String(x[field]).replace(/\s+/g, '') === n)
        ?? list.find(x => String(x[field]).replace(/\s+/g, '').includes(n) || n.includes(String(x[field]).replace(/\s+/g, '')))
        ?? null;
}

// ───────────────────────────── 설정 / 메타 ─────────────────────────────

function settings() {
    const { extensionSettings } = ctx();
    if (!extensionSettings[MODULE]) extensionSettings[MODULE] = structuredClone(DEFAULTS);
    for (const k of Object.keys(DEFAULTS)) {
        if (!Object.hasOwn(extensionSettings[MODULE], k)) extensionSettings[MODULE][k] = DEFAULTS[k];
    }
    return extensionSettings[MODULE];
}
function saveSettings() { ctx().saveSettingsDebounced(); }

function getMeta(create = false) {
    const md = ctx().chatMetadata;
    if (!md) return null;
    if (!md[MODULE] && create) md[MODULE] = { v: 1, profile: null, adjust: [] };
    return md[MODULE] ?? null;
}
async function saveMeta(now = false) {
    const c = ctx();
    if (now || !c.saveMetadataDebounced) await c.saveMetadata();
    else c.saveMetadataDebounced();
}

function cardHasFlag(ch) { return !!ch?.data?.extensions?.[MODULE]; }
function isActive() {
    const s = settings();
    if (!s.enabled) return false;
    const c = ctx();
    if (!c.getCurrentChatId?.()) return false;
    if (s.allCharacters) return true;
    if (c.groupId) {
        const g = c.groups?.find(x => x.id == c.groupId);
        return !!g?.members?.some(av => cardHasFlag(c.characters.find(ch => ch.avatar === av)));
    }
    if (c.characterId === undefined) return false;
    return cardHasFlag(c.characters[c.characterId]);
}

// ───────────────────────────── 상태 엔진 ─────────────────────────────

const corStage = (c) => c >= 100 ? 4 : c >= 75 ? 3 : c >= 50 ? 2 : c >= 25 ? 1 : 0;
const sanStage = (v) => v <= 0 ? 4 : v <= 25 ? 3 : v <= 50 ? 2 : v <= 75 ? 1 : 0;

function freshState(profile) {
    const s = {
        registered: false, name: '', rank: '', background: '', story: '',
        hp: 100, san: 80, cor: 5, cash: 0, day: 1, time: '자정', loc: '', mode: '일상',
        case: '', foe: null, contracts: [], taboo: {}, curses: [], mutations: [], madness: [], bonds: [],
        log: [], corPeak: 0, sanPeak: 0, revived: 0, rerollDay: 0, items: [],
    };
    if (!profile) return s;
    Object.assign(s, {
        registered: true,
        name: profile.name, rank: profile.rank, background: profile.background, story: profile.story ?? '',
        hp: profile.hp ?? 100, san: profile.san ?? 80, cor: profile.cor ?? 5, cash: profile.cash ?? 0,
        loc: profile.loc ?? '', time: profile.time ?? '자정',
    });
    s.contracts = clone(profile.contracts ?? []);
    s.items = clone(profile.items ?? []);
    s.corPeak = Math.min(corStage(s.cor), 3);
    s.sanPeak = Math.min(sanStage(s.san), 3);
    s.log.push({ day: 1, text: `입적 — ${s.contracts.map(c => c.name).join(', ') || '계약 없음'}과(와) 계약` });
    return s;
}

const KEYMAP = {
    hp: 'hp', '체력': 'hp', san: 'san', '이성': 'san', '이성치': 'san', '정신': 'san',
    cor: 'cor', '오염': 'cor', '오염도': 'cor', corruption: 'cor', sanity: 'san',
    cash: 'cash', '자금': 'cash', '돈': 'cash', money: 'cash',
    day: 'day', '일차': 'day', '날짜': 'day', time: 'time', '시간': 'time', '시간대': 'time',
    loc: 'loc', '장소': 'loc', '위치': 'loc', location: 'loc', mode: 'mode', '모드': 'mode',
    case: 'case', '의뢰': 'case', foe: 'foe', '적': 'foe', enemy: 'foe',
    taboo: 'taboo', '금기': 'taboo', curse: 'curse', '저주': 'curse',
    mutation: 'mutation', '변이': 'mutation', madness: 'madness', '광기': 'madness',
    item: 'item', items: 'item', '소지품': 'item', '아이템': 'item', '도구': 'item',
    bond: 'bond', '인연': 'bond', rank: 'rank', '계급': 'rank', '직업': 'rank',
    _contract: '_contract', _break: '_break', _reroll: '_reroll', _revive: '_revive',
};

const BLOCK_RE = /<state>([\s\S]*?)(?:<\/state>|$)/gi;
function extractOps(text) {
    const ops = [];
    if (!text || !/<state>/i.test(text)) return ops;
    for (const m of String(text).matchAll(BLOCK_RE)) {
        for (const line of m[1].split(/\r?\n/)) {
            const lm = line.match(/^\s*[-*•]?\s*([A-Za-z_가-힣]+)\s*[:：]\s*(.*?)\s*$/);
            if (lm && KEYMAP[lm[1].toLowerCase()]) ops.push([lm[1], lm[2]]);
        }
    }
    return ops;
}

function parseNum(raw, cur) {
    let t = String(raw ?? '').trim().replace(/[−–—]/g, '-').replace(/[,\s원%]/g, '');
    t = t.split('/')[0];
    const m = t.match(/^([+-])?(\d+(?:\.\d+)?)(만)?/);
    if (!m) return cur;
    const n = parseFloat(m[2]) * (m[3] ? 10000 : 1);
    if (m[1] === '+') return cur + n;
    if (m[1] === '-') return cur - n;
    return n;
}
const normTime = (v) => TIMES.find(t => v.includes(t)) ?? (v || '밤');
const normMode = (v) => v.includes('전투') ? '전투' : v.includes('의뢰') || v.includes('조사') ? '의뢰' : '일상';
const NONE_RE = /^(?:없음|없다|-|—|none|null|해결|완료|종료|퇴치|소멸|사라짐)(?![가-힣A-Za-z0-9])/i;

function addCurse(s, text, until = null, from = '') {
    const ex = s.curses.find(c => c.text === text);
    if (ex) { ex.until = until; ex.stack = (ex.stack ?? 1) + 1; return; }
    s.curses.push({ text, until, from, stack: 1 });
}
function tabooPenalty(s, c, day, kind, info) {
    const heavy = kind === '어김';
    s.san = clamp(s.san - (heavy ? 10 : 8), 0, 100);
    s.cor = clamp(s.cor + (heavy ? 10 : 6), 0, 100);
    addCurse(s, c.curse, (heavy ? s.day : day) + 1, c.name);
    s.log.push({ day: s.day, text: `금기 ${kind} — ${c.name}: 저주 「${c.curse}」` });
    info.events.push({ type: 'curse', text: `금기 ${kind} · ${c.name} → 저주 (이성 −${heavy ? 10 : 8}, 오염 +${heavy ? 10 : 6})` });
}
function tabooRec(s, name) { return (s.taboo[name] ??= { kept: [], broke: [] }); }
// 공명(共鳴): 금기를 지킬수록 계약이 깊어진다 — 권능은 강해지고, 인간성은 깎인다
const RES_AT = [1, 3, 6, 10, 15]; // 누적 이행 횟수 → Lv1~5 (Lv0 = 가계약)
const RES_NAME = ['가계약', '성립', '공명', '심화', '동화', '합일'];
const RES_EN = [
    'unsealed — power is faint (light use only) until the taboo act is performed once; narrate the seal then',
    'sealed — power works as described',
    'resonant — power noticeably stronger; the voice speaks more often',
    'deepened — power bends rules; the symptom spreads visibly',
    'merging — power comes as easily as breathing; {{user}} starts thinking in the 객성\'s cadence',
    'one — power and 객성 are hard to tell apart from {{user}}; humanity is thin',
];
function resLevel(s, c) {
    const n = s.taboo[c.name]?.kept.length ?? 0;
    return RES_AT.filter(x => n >= x).length;
}

function advanceDays(s, nd, info) {
    for (let d = s.day; d < nd; d++) {
        if (d === 1) continue; // 입적 당일은 금기 유예
        for (const c of s.contracts) {
            const t = tabooRec(s, c.name);
            if (!t.kept.includes(d) && !t.broke.includes(d)) {
                t.broke.push(d);
                tabooPenalty(s, c, d, '미이행', info);
            }
        }
    }
    s.day = nd;
    s.curses = s.curses.filter(c => c.until == null || c.until >= s.day);
}

function pickFrom(pool, owned, seed) {
    const free = pool.filter(p => !owned.some(o => o.name === p.name));
    const list = free.length ? free : pool;
    return clone(list[Math.floor(rngFrom(seed)() * list.length)]);
}
function checkStages(s, info) {
    const cs = corStage(s.cor);
    if (cs > s.corPeak) {
        for (let st = s.corPeak + 1; st <= cs; st++) {
            if (st <= 3) {
                const m = pickFrom(MUTATIONS[st], s.mutations, `${info.seed}:mut:${st}:${s.mutations.length}`);
                m.tier = st;
                s.mutations.push(m);
                s.log.push({ day: s.day, text: `오염 ${st * 25}% 돌파 — 변이 「${m.name}」` });
                info.events.push({ type: 'mut', text: `오염 ${st * 25}% 돌파 · 변이 발현 「${m.name}」 — ${m.desc}` });
            } else {
                s.log.push({ day: s.day, text: '오염 100% — 객성화' });
                info.events.push({ type: 'end', text: '오염 100% · 객성화' });
            }
        }
        s.corPeak = cs;
    }
    const ss = sanStage(s.san);
    if (ss > s.sanPeak) {
        for (let st = s.sanPeak + 1; st <= ss; st++) {
            if (st === 2 || st === 3) {
                const m = pickFrom(MADNESS[st], s.madness, `${info.seed}:mad:${st}:${s.madness.length}`);
                s.madness.push(m);
                s.log.push({ day: s.day, text: `이성 ${100 - st * 25} 이하 — 광기 「${m.name}」` });
                info.events.push({ type: 'mad', text: `이성 붕괴 · 광기 발현 「${m.name}」 — ${m.desc}` });
            } else if (st === 1) {
                info.events.push({ type: 'mad', text: '이성 75 이하 · 불면이 시작된다' });
            } else if (st === 4) {
                s.log.push({ day: s.day, text: '이성 0 — 광인' });
                info.events.push({ type: 'end', text: '이성 0 · 광인' });
            }
        }
        s.sanPeak = ss;
    }
}

function applyOp(s, rawKey, rawVal, info) {
    const key = KEYMAP[String(rawKey).trim().toLowerCase()];
    if (!key) return;
    const val = String(rawVal ?? '').trim();
    switch (key) {
        case 'hp': s.hp = clamp(Math.round(parseNum(val, s.hp)), 0, 100); break;
        case 'san': s.san = clamp(Math.round(parseNum(val, s.san)), 0, 100); break;
        case 'cor': s.cor = clamp(Math.round(parseNum(val, s.cor)), 0, 100); break;
        case 'cash': s.cash = Math.round(parseNum(val, s.cash)); break;
        case 'day': {
            const nd = Math.round(parseNum(val, s.day));
            if (nd > s.day) advanceDays(s, Math.min(nd, s.day + 30), info);
            break;
        }
        case 'time': {
            if (!val) break;
            const nt = normTime(val);
            const a = TIMES.indexOf(s.time), b = TIMES.indexOf(nt);
            // 밤·자정 → 새벽·아침·낮 인데 day를 안 썼으면 하루가 지난 것으로 본다
            if (!info.hasDay && a >= 3 && b >= 0 && b <= 2) advanceDays(s, s.day + 1, info);
            s.time = nt;
            break;
        }
        case 'loc': if (val && !NONE_RE.test(val)) s.loc = val; break;
        case 'rank': if (val) s.rank = val; break;
        case 'mode': if (val) { s.mode = normMode(val); if (s.mode === '일상') s.foe = null; } break;
        case 'case': {
            const closing = !val || NONE_RE.test(val);
            if (closing && s.case) {
                s.cor = clamp(s.cor + 3, 0, 100); // 헌터 일을 할수록 오염된다
                s.log.push({ day: s.day, text: `의뢰 종료 — ${s.case} (잔향 오염 +3)` });
                info.events.push({ type: 'curse', text: `의뢰 종료 · 괴이의 잔향이 몸에 남는다 (오염 +3)` });
            }
            s.case = closing ? '' : val;
            break;
        }
        case 'foe': {
            if (!val || NONE_RE.test(val)) { s.foe = null; break; }
            const [name, pct, ...rest] = val.split('|').map(x => x.trim());
            const prev = s.foe && s.foe.name === name ? s.foe : null;
            const p = pct !== undefined && pct !== '' ? clamp(Math.round(parseNum(pct, prev?.pct ?? 100)), 0, 100) : (prev?.pct ?? 100);
            s.foe = { name: name || prev?.name || '이름 모를 것', pct: p, note: rest.join(' | ') || prev?.note || '' };
            if (p <= 0 && (prev?.pct ?? 100) > 0) {
                s.cor = clamp(s.cor + 2, 0, 100);
                s.log.push({ day: s.day, text: `「${s.foe.name}」 소멸 (오염 +2)` });
                info.events.push({ type: 'curse', text: `괴이 소멸 · 「${s.foe.name}」의 마지막 숨이 스며든다 (오염 +2)` });
            }
            break;
        }
        case 'taboo': {
            const m = val.match(/^(.+?)\s*(?:=|:|→|-|—)\s*(.+)$/);
            const cname = m ? m[1] : val;
            const status = m ? m[2] : '지킴';
            const c = fuzzyFind(s.contracts, cname);
            if (!c) break;
            const t = tabooRec(s, c.name);
            if (/어김|어겼|위반|깨/.test(status)) {
                if (!t.broke.includes(s.day)) { t.broke.push(s.day); tabooPenalty(s, c, s.day, '어김', info); }
            } else if (/지킴|지켰|이행|완료|수행/.test(status)) {
                if (!t.kept.includes(s.day) && !t.broke.includes(s.day)) {
                    const before = resLevel(s, c);
                    t.kept.push(s.day);
                    s.cor = clamp(s.cor + 2, 0, 100); // 의식 자체가 사람을 갉아먹는다
                    const after = resLevel(s, c);
                    if (after > before) {
                        s.san = clamp(s.san - 3, 0, 100);
                        s.log.push({ day: s.day, text: `공명 Lv${after} ${RES_NAME[after]} — ${c.name}` });
                        info.events.push({ type: 'mut', text: after === 1 ? `계약 성립 · ${c.name} — 권능이 온전히 깨어난다 (오염 +2, 이성 −3)` : `공명 상승 · ${c.name} Lv${after} ${RES_NAME[after]} — 힘은 강해지고, 무언가가 깎여 나간다 (오염 +2, 이성 −3)` });
                    } else {
                        info.events.push({ type: 'keep', text: `금기 이행 · ${c.name} (오염 +2)` });
                    }
                }
            }
            break;
        }
        case 'curse': {
            if (!val || NONE_RE.test(val)) break;
            if (/^[-−]/.test(val)) {
                const k = val.replace(/^[-−]\s*/, '');
                const ex = fuzzyFind(s.curses, k, 'text');
                if (ex) s.curses = s.curses.filter(c => c !== ex);
            } else {
                const text = val.replace(/^\+\s*/, '');
                addCurse(s, text, null, '서사');
                info.events.push({ type: 'curse', text: `저주 — ${text}` });
            }
            break;
        }
        case 'mutation':
        case 'madness': {
            if (!val || NONE_RE.test(val)) break;
            const list = key === 'mutation' ? s.mutations : s.madness;
            if (/^[-−]/.test(val)) {
                const ex = fuzzyFind(list, val.replace(/^[-−]\s*/, ''));
                if (ex) list.splice(list.indexOf(ex), 1);
            } else {
                const [name, ...d] = val.replace(/^\+\s*/, '').split(/\s*[|:(—-]\s*/);
                if (!fuzzyFind(list, name)) {
                    list.push({ name: name.trim(), desc: d.join(' ').replace(/\)$/, '').trim(), tier: 0 });
                    info.events.push({ type: key === 'mutation' ? 'mut' : 'mad', text: `${key === 'mutation' ? '변이' : '광기'} — ${name.trim()}` });
                }
            }
            break;
        }
        case 'bond': {
            const m = val.match(/^(.+?)\s*([+\-−]\s*\d+)?\s*(?:\|\s*(.*))?$/);
            if (!m || NONE_RE.test(val)) break;
            const name = m[1].trim();
            if (/^[-−]$/.test(name)) break;
            let b = fuzzyFind(s.bonds, name);
            if (!b) { b = { name, trust: 0, note: '' }; s.bonds.push(b); }
            if (m[2]) b.trust = clamp(b.trust + (parseInt(m[2].replace('−', '-').replace(/\s/g, ''), 10) || 0), -5, 5);
            if (m[3]) b.note = m[3].trim();
            if (s.bonds.length > 16) s.bonds.shift();
            break;
        }
        case '_contract': {
            try {
                const c = JSON.parse(val);
                if (c?.name && !s.contracts.some(x => x.name === c.name)) {
                    s.contracts.push(c);
                    s.log.push({ day: s.day, text: `추가 계약 — ${c.name}` });
                    info.events.push({ type: 'mut', text: `새 계약 · ${c.name}` });
                }
            } catch { /* ignore */ }
            break;
        }
        case '_break': {
            const c = fuzzyFind(s.contracts, val);
            if (c) {
                s.contracts = s.contracts.filter(x => x !== c);
                s.log.push({ day: s.day, text: `계약 파기 — ${c.name}` });
                info.events.push({ type: 'curse', text: `계약 파기 · ${c.name} (이성 −15, 오염 +15)` });
            }
            break;
        }
        case 'item': if (val) applyItems(s, val); break;
        case '_reroll': s.rerollDay = s.day; break;
        case '_revive': s.revived++; s.log.push({ day: s.day, text: '빈사에서 객성의 손을 잡았다' }); break;
    }
    checkStages(s, info);
}

const adjEvents = new Map();
function compute(limit) {
    const c = ctx();
    const chat = c.chat ?? [];
    const meta = getMeta();
    const s = freshState(meta?.profile);
    const snaps = new Map();
    if (!s.registered) return { state: s, snaps };
    const adj = (meta.adjust ?? []).slice().sort((a, b) => a.at - b.at || a.t - b.t);
    const seed = String(c.getCurrentChatId?.() ?? 'gaekseong');
    const n = Math.min(limit ?? chat.length, chat.length);
    let ai = 0;
    const runAdjust = (a) => {
        const info = { seed: `${seed}:adj:${a.t}`, events: [], hasDay: a.ops.some(([k]) => KEYMAP[String(k).toLowerCase()] === 'day') };
        const hp0 = s.hp;
        for (const [k, v] of a.ops) applyOp(s, k, v, info);
        if (hp0 > 0 && s.hp <= 0) info.events.push({ type: 'end', text: '체력 0 · 빈사 — 객성이 손을 내민다' });
        if (a.label) s.log.push({ day: s.day, text: a.label });
        adjEvents.set(a.t, info.events);
    };
    for (let i = 0; i < n; i++) {
        while (ai < adj.length && adj[ai].at <= i) runAdjust(adj[ai++]);
        const m = chat[i];
        if (!m || m.is_user) continue; // hidden (/hide) messages are is_system but still hold state
        const ops = extractOps(m.mes);
        if (!ops.length) continue;
        const prev = clone(s);
        const info = { seed: `${seed}:${i}`, events: [], hasDay: ops.some(([k]) => KEYMAP[k.toLowerCase()] === 'day') };
        for (const [k, v] of ops) applyOp(s, k, v, info);
        if (prev.hp > 0 && s.hp <= 0) info.events.push({ type: 'end', text: '체력 0 · 빈사 — 객성이 손을 내민다' });
        snaps.set(i, { state: clone(s), prev, events: info.events });
    }
    while (ai < adj.length) runAdjust(adj[ai++]);
    if (s.log.length > 120) s.log = s.log.slice(-120);
    return { state: s, snaps };
}

async function addAdjust(ops, label = '', at = null) {
    const meta = getMeta(true);
    meta.adjust ??= [];
    const a = { at: at ?? (ctx().chat?.length ?? 0), t: Date.now(), ops, label };
    meta.adjust.push(a);
    await saveMeta();
    refreshNow();
    for (const e of adjEvents.get(a.t) ?? []) notifyEvent(e);
}

// ───────────────────────────── 프롬프트 주입 ─────────────────────────────

function contractLine(s, c) {
    const t = s.taboo[c.name];
    const today = t?.kept.includes(s.day) ? 'KEPT' : t?.broke.includes(s.day) ? 'BROKEN' : s.day === 1 ? 'grace (day 1)' : 'PENDING';
    const lv = resLevel(s, c);
    const res = ` | 공명 Lv${lv} ${RES_NAME[lv]}: ${RES_EN[lv]}`;
    const el = EL_HANJA[c.element] ?? c.element;
    const custom = String(c.id ?? '').startsWith('custom') || !CONTRACTS.some(k => k.name === c.name);
    if (custom) {
        return `- ${c.name}(${el}) | 권능: ${c.power} | 금기: ${c.taboo} | today: ${today}${res}\n  저주 on breach: ${c.curse}${c.symptom ? ` | symptom: ${c.symptom}` : ''}${c.voice ? ` | voice: ${c.voice}` : ''}`;
    }
    return `- ${c.name}(${c.hanja ? `${c.hanja}, ` : ''}${el}) | 권능: ${c.power.split(/\s*—\s*/)[0]} | 금기: ${c.taboo} | today: ${today}${res}`;
}

function buildInjection(s) {
    const set = settings();
    if (!s.registered) {
        return '[객성록 STATE] {{user}} has not registered (입적) yet. Keep the opening tension but stop right before the contract is sealed. Do not write a <state> block. Narrate in Korean.';
    }
    const ss = sanStage(s.san), cs = corStage(s.cor);
    const L = [];
    L.push('[객성록 STATE — authoritative. Never recompute or invent these numbers.]');
    L.push(`{{user}}: ${s.name} · ${s.rank}${s.background ? ` · ${s.background}` : ''} | Day ${s.day} ${s.time} | ${s.loc || 'location unset'} | ${MODE_TOKEN[s.mode] ?? '#MODE_DAILY'}`);
    if (s.story) L.push(`Backstory: ${s.story}`);
    L.push(`HP ${s.hp}/100${s.hp <= 0 ? ' #DYING' : s.hp <= 30 ? ' (badly hurt, sluggish)' : ''} · SAN ${s.san}/100 ${ss ? STAGE_EN.san[ss].split(':')[0] : '(steady)'} · COR ${s.cor}% ${cs ? STAGE_EN.cor[cs].split(':')[0] : '(human)'} · ${won(s.cash)}`);
    if (s.contracts.length) { L.push('Contracts:'); for (const c of s.contracts) L.push(contractLine(s, c)); }
    if (s.curses.length) L.push(`Curses: ${s.curses.map(c => c.text + (c.until ? ` (until Day ${c.until})` : '')).join(' / ')}`);
    if (s.mutations.length) L.push(`Mutations (permanent): ${s.mutations.map(m => `${m.name}${m.en || m.desc ? ` — ${m.en || m.desc}` : ''}`).join(' / ')}`);
    if (s.madness.length) L.push(`Madness: ${s.madness.map(m => `${m.name}${m.en || m.desc ? ` — ${m.en || m.desc}` : ''}`).join(' / ')}`);
    L.push(`Inventory: ${s.items.length ? itemsText(s) : 'nothing useful'} (only these tools exist; using one up → item: -이름 1, getting one → item: +이름 1)`);
    if (s.case) L.push(`Case: ${s.case}`);
    if (s.foe) L.push(`Foe: ${s.foe.name} — ${s.foe.pct}% form left${s.foe.note ? ` (${s.foe.note})` : ''}`);
    if (s.bonds.length) L.push(`Bonds: ${s.bonds.slice(-8).map(b => `${b.name} (trust ${b.trust}${b.note ? `, ${b.note}` : ''})`).join(' / ')}`);
    const dir = [STAGE_EN.san[ss], STAGE_EN.cor[cs]].filter(Boolean);
    if (s.hp <= 0) dir.push('#DYING 빈사: {{user}} is dying; senses recede; the contracted 객성 names the price of survival. Neither revive nor kill {{user}} until they answer.');
    if (dir.length) L.push(`Directives: ${dir.join(' ')}`);
    L.push('');
    L.push('[OUTPUT] Narrate in Korean. After the narration, END with a <state> block: only what changed THIS turn, one key per line, numbers signed (+/-). Nothing changed → <state></state>. No code fences.');
    L.push('Keys: hp, san, cor, cash · day (+1 when the date changes) · time (새벽/아침/낮/저녁/밤/자정) · loc · mode (일상/의뢰/전투) · case (이름 | 진행; 없음 to close) · foe (이름 | form% | trait/weakness; 없음 to clear) · taboo (계약명 = 지킴 or 어김, when the story shows it) · curse (+text / -text) · mutation (+이름 | 묘사; story-only extras) · bond (이름 +1 | short memo) · item (+이름 2 / -이름 1). Values in Korean.');
    L.push('Example:\n<state>\nhp: -8\ncor: +4\nloc: 흑수구 · 흑수역\nfoe: 0호선 안내방송 | 85 | 이름을 부르면 대답하게 만든다\n</state>');
    L.push('Scale: light wound -5~10 / serious -15~25 / critical -30+ · seeing a 괴이 san -2~5, forbidden truth -8~15 · 객성 contact or 괴이 blood cor +5~15 · good sleep hp +15 san +5 · purification cor -3~8 (always a price). Recovery slow, damage honest.');
    L.push('Contract loop: keeping a 금기 deepens 공명 (stronger power, less human); breaking it brings 저주. Make both feel heavy. Every closed case and destroyed 괴이 leaves residue (system adds cor).');
    L.push('Tags in {{user}}\'s message: [판정 …] result is binding. [권능 …] corruption is ALREADY applied — do not add it to cor again (extra narrative costs only). [금기 이행 …] is already recorded. [의뢰 수락 …] opens that case: begin with how the job reaches {{user}}, then the investigation.');
    const tense = s.mode !== '일상';
    if (set.choices === 'always' || (set.choices === 'tense' && tense)) {
        const odd = ss >= 3 ? ' Two choices start with "⟨이질⟩" (abnormal, tempting — what the 객성 wants); even the normal ones read subtly warped.' : ss >= 2 ? ' One choice starts with "⟨이질⟩" (abnormal, tempting — what the 객성 wants).' : '';
        L.push(`[CHOICES] ${set.choices === 'always' ? 'Every reply' : 'At decision points during cases/combat'}: after the narration and before <state>, give 2-4 numbered one-line action choices inside <choices>…</choices>, in Korean.${odd}`);
    }
    if (ss >= 2) L.push('[HALLUCINATION] Wrap what only {{user}} sees or hears in <hallu>…</hallu>. Never reveal whether it is real.');
    return L.join('\n');
}

function setInjection(text) {
    const c = ctx();
    const depth = clamp(parseInt(settings().injectDepth, 10) || 0, 0, 20);
    c.setExtensionPrompt(INJECT_KEY, text ?? '', PROMPT_IN_CHAT, depth, true, ROLE_SYSTEM);
}

// ───────────────────────────── 화면 갱신 ─────────────────────────────

let current = null;
let refreshTimer = null;
let lastNotified = '';

function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshNow, 60);
}
function refreshNow() {
    clearTimeout(refreshTimer);
    try {
        if (!isActive()) {
            current = null;
            setInjection('');
            renderHUD(null);
            setBodyClasses(null);
            return;
        }
        current = compute();
        setInjection(buildInjection(current.state));
        renderHUD(current.state);
        setBodyClasses(current.state);
        decorateAll();
    } catch (e) {
        console.error(LOG, e);
    }
}

function setBodyClasses(s) {
    const b = document.body.classList;
    for (const k of ['gs-on', 'gs-san-1', 'gs-san-2', 'gs-san-3', 'gs-cor-2', 'gs-cor-3', 'gs-dying']) b.remove(k);
    if (!s) return;
    b.add('gs-on');
    if (!settings().glitch || !s.registered) return;
    const ss = Math.min(sanStage(s.san), 3), cs = Math.min(corStage(s.cor), 3);
    if (ss) b.add(`gs-san-${ss}`);
    if (cs >= 2) b.add(`gs-cor-${cs}`);
    if (s.hp <= 0) b.add('gs-dying');
}

function notifyEvent(e) {
    const fn = e.type === 'keep' ? toastr.success : e.type === 'end' ? toastr.error : toastr.warning;
    fn(esc(e.text), '객성록', { timeOut: 6000, escapeHtml: false });
}
function notifyLatest() {
    if (!current) return;
    const c = ctx();
    const last = (c.chat?.length ?? 0) - 1;
    const snap = current.snaps.get(last);
    const key = `${c.getCurrentChatId?.()}:${last}:${c.chat[last]?.swipe_id ?? 0}`;
    if (key === lastNotified || c.chat[last]?.is_user) return;
    lastNotified = key;
    for (const e of snap?.events ?? []) notifyEvent(e);
    setTimeout(() => maybeWhisper(key, (snap?.events ?? []).some(e => /공명|계약 성립|변이|광기/.test(e.text))), 1800);
}

// ───────────────────────────── HUD ─────────────────────────────

function bar(kind, label, value, max, stage, prevVal) {
    const pct = clamp((value / max) * 100, 0, 100);
    const diff = prevVal == null ? 0 : value - prevVal;
    const fx = diff === 0 ? '' : (kind === 'cor' ? (diff > 0 ? 'gs-hurt' : 'gs-heal') : (diff < 0 ? 'gs-hurt' : 'gs-heal'));
    return `<div class="gs-bar gs-bar-${kind} ${fx}" title="${esc(BAR_HELP[kind] ?? label)}">
        <div class="gs-bar-head"><span>${label}</span><b>${value}${kind === 'cor' ? '%' : ''}</b>${stage ? `<em>${esc(stage)}</em>` : ''}</div>
        <div class="gs-bar-track"><i style="width:${pct}%"></i><s style="left:25%"></s><s style="left:50%"></s><s style="left:75%"></s></div>
    </div>`;
}

let hudPrev = null;
function renderHUD(s) {
    let hud = document.getElementById('gs-hud');
    if (!s) { if (hud) hud.style.display = 'none'; return; }
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'gs-hud';
        hud.className = 'gs-root';
        chatEl.parentElement.insertBefore(hud, chatEl);
        hud.addEventListener('click', onHudClick);
    }
    hud.style.display = '';
    const set = settings();
    hud.classList.toggle('gs-mini', !!set.hudMini && s.registered);
    if (!s.registered) {
        hud.innerHTML = `<div class="gs-hud-unreg">
            <i class="fa-solid fa-yin-yang gs-spin"></i>
            <div><b>명부에 없는 자</b><small>이름도, 계약도 아직 없다.</small></div>
            <button class="gs-btn" data-act="guide">처음이세요?</button>
            <button class="gs-btn gs-btn-red" data-act="register">입적하기</button>
        </div>`;
        hudPrev = null;
        return;
    }
    const ss = sanStage(s.san), cs = corStage(s.cor);
    const p = hudPrev;
    const taboos = s.contracts.map(c => {
        const t = s.taboo[c.name];
        const st = t?.kept.includes(s.day) ? 'kept' : t?.broke.includes(s.day) ? 'broke' : 'pending';
        const label = st === 'kept' ? '이행' : st === 'broke' ? '어김' : s.day === 1 ? '첫날 유예' : '미이행';
        return `<button class="gs-taboo gs-taboo-${st}" data-act="keep" data-name="${esc(c.name)}" title="${esc(`금기: ${c.taboo}\n\n오늘 지켰다면 누르세요. 지키면 공명↑(강해짐)·오염 +2, 하루를 그냥 넘기면 저주가 내립니다.\n공명 Lv${resLevel(s, c)} ${RES_NAME[resLevel(s, c)]}`)}">
            <i></i><span>${esc(c.name)}</span><em>Lv${resLevel(s, c)}</em><small>${label}</small></button>`;
    }).join('');
    const mode = MODES[s.mode] ?? 'daily';
    const more = set.hudExpanded ? `<div class="gs-more">
        <div class="gs-row gs-click" data-act="map" title="지도 보기"><i class="fa-solid fa-location-dot"></i> ${esc(s.loc || '—')} <span class="gs-dim">· ${won(s.cash)} · 지도 ›</span></div>
        ${s.case ? `<div class="gs-row"><i class="fa-solid fa-file-signature"></i> ${esc(s.case)}</div>` : ''}
        ${s.items.length ? `<div class="gs-chips">${s.items.map(i => `<span class="gs-chip gs-chip-item">${esc(i.name)}${i.qty > 1 ? ` ×${i.qty}` : ''}</span>`).join('')}</div>` : ''}
        ${s.curses.length ? `<div class="gs-chips">${s.curses.map(c => `<span class="gs-chip gs-chip-curse" title="${esc(c.from)}">咒 ${esc(c.text)}${c.until ? ` <small>~${c.until}일</small>` : ''}</span>`).join('')}</div>` : ''}
        ${s.mutations.length || s.madness.length ? `<div class="gs-chips">${s.mutations.map(m => `<span class="gs-chip gs-chip-mut" title="${esc(m.desc)}">變 ${esc(m.name)}</span>`).join('')}${s.madness.map(m => `<span class="gs-chip gs-chip-mad" title="${esc(m.desc)}">狂 ${esc(m.name)}</span>`).join('')}</div>` : ''}
    </div>` : '';
    const foe = s.foe ? `<div class="gs-foe"><span class="gs-foe-name">怪 ${esc(s.foe.name)}</span>
        <div class="gs-bar-track"><i style="width:${s.foe.pct}%"></i></div><b>${s.foe.pct}%</b>
        ${s.foe.note ? `<small>${esc(s.foe.note)}</small>` : ''}</div>` : '';
    const dying = s.hp <= 0 ? `<div class="gs-alert"><b>빈사</b> 숨이 멎어 간다. 별 하나가 내려다본다.
        <button class="gs-btn gs-btn-red" data-act="revive">객성의 손을 잡는다</button></div>` : '';
    const ending = ss >= 4 ? `<div class="gs-alert"><b>광인</b> 이성이 꺼졌다.</div>` : cs >= 4 ? `<div class="gs-alert"><b>객성화</b> 당신은 더 이상 사람이 아니다.</div>` : '';
    hud.innerHTML = `
        <div class="gs-hud-top">
            <button class="gs-ico" data-act="sheet" title="상태 시트"><i class="fa-solid fa-yin-yang"></i></button>
            <div class="gs-id" data-act="mini" title="한 줄로 접기/펴기"><b>${esc(s.name)}</b><small>${esc(s.rank)} · ${s.day}일차 ${esc(s.time)}</small></div>
            <div class="gs-minis"><span class="gs-m-hp">體 ${s.hp}</span><span class="gs-m-san">心 ${s.san}</span><span class="gs-m-cor">汚 ${s.cor}%</span></div>
            <span class="gs-mode" data-mode="${mode}" title="${MODE_HELP}">${esc(s.mode)}</span>
            <div class="gs-acts">
                <button class="gs-ico" data-act="board" title="의뢰 게시판"><i class="fa-solid fa-clipboard-list"></i></button>
                <button class="gs-ico" data-act="roll" title="판정"><i class="fa-solid fa-dice-d20"></i></button>
                <button class="gs-ico" data-act="power" title="권능 발동"><i class="fa-solid fa-bolt"></i></button>
                <button class="gs-ico gs-ico-q" data-act="guide" title="안내 · 용어 사전">?</button>
                <button class="gs-ico" data-act="expand" title="${set.hudExpanded ? '접기' : '펼치기'}"><i class="fa-solid fa-chevron-${set.hudExpanded ? 'up' : 'down'}"></i></button>
            </div>
        </div>
        <div class="gs-bars">
            ${bar('hp', '체력', s.hp, 100, s.hp <= 0 ? '빈사' : s.hp <= 30 ? '중상' : '', p?.hp)}
            ${bar('san', '이성', s.san, 100, SAN_STAGE_NAME[ss], p?.san)}
            ${bar('cor', '오염', s.cor, 100, COR_STAGE_NAME[cs], p?.cor)}
        </div>
        ${taboos ? `<div class="gs-taboos">${taboos}</div>` : ''}
        ${foe}${dying}${ending}${more}`;
    if (activeWhisper) hud.appendChild(activeWhisper); // 다시 그려도 속삭임은 남는다
    hudPrev = { hp: s.hp, san: s.san, cor: s.cor };
}

async function onHudClick(ev) {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const set = settings();
    switch (act) {
        case 'register': return openRegister();
        case 'sheet': return openSheet();
        case 'roll': return openRoll();
        case 'power': return openPower();
        case 'mini': set.hudMini = !set.hudMini; saveSettings(); return renderHUD(current?.state);
        case 'expand': set.hudExpanded = !set.hudExpanded; saveSettings(); return renderHUD(current?.state);
        case 'keep': return confirmKeep(btn.dataset.name);
        case 'revive': return revive();
        case 'board': return openBoard();
        case 'guide': return openGuide();
        case 'map': return openSheetTab('map');
    }
}

async function confirmKeep(name) {
    const s = current?.state;
    const c = s && fuzzyFind(s.contracts, name);
    if (!c) return;
    const t = s.taboo[c.name];
    if (t?.kept.includes(s.day)) return toastr.info('오늘의 금기는 이미 이행했다.', '객성록');
    if (t?.broke.includes(s.day)) return toastr.warning('오늘은 이미 금기를 어겼다. 저주는 내일까지 이어진다.', '객성록');
    const { Popup, POPUP_RESULT } = ctx();
    const r = await Popup.show.confirm(`금기 이행 — ${c.name}`, `<p>${esc(c.taboo)}</p><p class="gs-dim">${s.day}일차의 금기를 지켰다고 기록합니다. 입력창에 이행 태그가 추가됩니다.</p>`);
    if (r !== POPUP_RESULT.AFFIRMATIVE) return;
    await addAdjust([['taboo', `${c.name} = 지킴`]], '');
    insertInput(`[금기 이행 · ${c.name}] `);
}

async function revive() {
    const { Popup, POPUP_RESULT } = ctx();
    const s = current?.state;
    const r = await Popup.show.confirm('객성의 손', `<p>살려 주마. 대신 조금 더 이쪽으로 오너라.</p><p class="gs-dim">체력 35로 깨어나고, 오염 +25. 이미 ${s?.revived ?? 0}번 손을 잡았다.</p>`);
    if (r !== POPUP_RESULT.AFFIRMATIVE) return;
    await addAdjust([['hp', '35'], ['cor', `+${25 + (s?.revived ?? 0) * 10}`], ['_revive', '1']], '빈사에서 부활 (오염 대가)');
    insertInput('[권능 · 부활 · 객성의 손을 잡았다] ');
}

// mode: 'tag' = 기존 입력 앞에 태그를 붙임(이전 태그는 교체), 'replace' = 입력을 통째로 바꿈
function insertInput(text, send = false, mode = 'tag') {
    const ta = document.getElementById('send_textarea');
    if (!ta) return;
    if (mode === 'replace') {
        const tags = (ta.value.match(/^(\s*\[(?:판정|권능|금기 이행|의뢰 수락)[^\]]*\]\s*)+/) ?? [''])[0];
        ta.value = `${tags}${text}`;
    } else {
        const isTag = /^\[/.test(text);
        const kind = isTag ? text.match(/^\[(판정|권능|금기 이행|의뢰 수락)/)?.[1] : null;
        let rest = ta.value;
        if (kind) rest = rest.replace(new RegExp(`\\[${kind}[^\\]]*\\]\\s*`), '');
        if (!isTag) rest = rest.replace(/^\(.*?\)\s*/, '');
        ta.value = `${text}${rest}`;
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    if (send) document.getElementById('send_but')?.click();
}

// ───────────────────────────── 메시지 장식 ─────────────────────────────

function deltaChip(label, now, before, unit = '', invert = false) {
    const d = now - before;
    const cls = d === 0 ? '' : ((invert ? d > 0 : d < 0) ? 'neg' : 'pos');
    return `<span class="gs-chip">${label} <b>${now}${unit}</b>${d ? ` <em class="${cls}">${signed(d)}</em>` : ''}</span>`;
}

function cardHTML(snap, full) {
    const { state: s, prev: p, events } = snap;
    const ev = events.map(e => `<div class="gs-ev gs-ev-${e.type}">${esc(e.text)}</div>`).join('');
    const changed = [];
    if (s.loc !== p.loc) changed.push(`<span class="gs-chip"><i class="fa-solid fa-location-dot"></i> ${esc(s.loc)}</span>`);
    if (s.mode !== p.mode) changed.push(`<span class="gs-chip" data-mode="${MODES[s.mode]}">${esc(s.mode)}</span>`);
    if (s.cash !== p.cash) changed.push(`<span class="gs-chip">자금 <em class="${s.cash < p.cash ? 'neg' : 'pos'}">${s.cash > p.cash ? '+' : '−'}${won(Math.abs(s.cash - p.cash))}</em></span>`);
    if (s.case !== p.case) changed.push(`<span class="gs-chip"><i class="fa-solid fa-file-signature"></i> ${esc(s.case || '의뢰 종료')}</span>`);
    if (JSON.stringify(s.foe) !== JSON.stringify(p.foe)) {
        changed.push(s.foe ? `<span class="gs-chip gs-chip-foe">怪 ${esc(s.foe.name)} <b>${s.foe.pct}%</b>${p.foe && p.foe.name === s.foe.name && p.foe.pct !== s.foe.pct ? ` <em class="pos">${signed(s.foe.pct - p.foe.pct)}</em>` : ''}</span>` : '<span class="gs-chip">怪 퇴치·이탈</span>');
    }
    for (const b of s.bonds) {
        const pb = p.bonds.find(x => x.name === b.name);
        if (!pb || pb.trust !== b.trust) changed.push(`<span class="gs-chip gs-chip-bond">緣 ${esc(b.name)} ${pb ? `<em class="${b.trust < pb.trust ? 'neg' : 'pos'}">${signed(b.trust - pb.trust)}</em>` : '<em class="pos">새 인연</em>'}</span>`);
    }
    if (full) {
        return `<div class="gs-card gs-full">
            <div class="gs-card-head"><span>${s.day}일차 · ${esc(s.time)}</span><span>${esc(s.loc)}</span></div>
            <div class="gs-bars">
                ${bar('hp', '체력', s.hp, 100, '', p.hp)}${bar('san', '이성', s.san, 100, SAN_STAGE_NAME[sanStage(s.san)], p.san)}${bar('cor', '오염', s.cor, 100, COR_STAGE_NAME[corStage(s.cor)], p.cor)}
            </div>
            ${changed.length ? `<div class="gs-chips">${changed.join('')}</div>` : ''}${ev}</div>`;
    }
    return `<div class="gs-card gs-compact">
        <span class="gs-chip gs-chip-day">${s.day}일차 ${esc(s.time)}</span>
        ${deltaChip('체력', s.hp, p.hp)}${deltaChip('이성', s.san, p.san)}${deltaChip('오염', s.cor, p.cor, '%', true)}
        ${changed.join('')}${ev}</div>`;
}

function choiceItems(box) {
    const lis = box.querySelectorAll('li');
    let raw;
    if (lis.length) raw = [...lis].map(li => li.textContent);
    else {
        const c = box.cloneNode(true);
        c.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        c.querySelectorAll('p, div').forEach(el => el.append('\n'));
        // also split inline numbering such as "1. 가 2. 나"
        raw = c.textContent.replace(/\s+(?=(?:\d{1,2}|[①-⑨])\s*[.)．]\s)/g, '\n').split(/\n+/);
    }
    return raw.map(t => t.trim().replace(/^(?:\d{1,2}|[①-⑨])\s*[.)．:]\s*/, '').replace(/^[-*•]\s*/, '')).filter(Boolean).slice(0, 6);
}

const JAMO_L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JAMO_V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JAMO_T = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
function decompose(ch) {
    const c = ch.charCodeAt(0) - 0xAC00;
    if (c < 0 || c > 11171) return ch;
    return JAMO_L[Math.floor(c / 588)] + JAMO_V[Math.floor((c % 588) / 28)] + JAMO_T[c % 28];
}
// 이성 붕괴 연출: 한글에 어울리는 방식으로 글자를 일그러뜨린다 (화면 표시만, 저장 X)
function zalgoize(root, rate, seed) {
    const rnd = rngFrom(seed);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => n.parentElement?.closest('.gs-card, .gs-choice-list, .gs-z, code, pre') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
        const text = n.nodeValue;
        if (!text.trim()) continue;
        const frag = document.createDocumentFragment();
        let buf = '';
        for (const ch of text) {
            if (!ch.trim() || rnd() >= rate) { buf += ch; continue; }
            if (buf) { frag.append(buf); buf = ''; }
            const kind = Math.floor(rnd() * 5);
            const span = document.createElement('span');
            span.className = `gs-z gs-z${kind}`;
            span.textContent = kind === 0 ? decompose(ch) : kind === 1 ? ch + ch : ch;
            span.dataset.ch = ch;
            frag.append(span);
        }
        if (buf) frag.append(buf);
        n.replaceWith(frag);
    }
    root.dataset.gsZ = '1';
}

function decorateMessage(mesEl, isLastAI) {
    if (!current) return;
    const i = Number(mesEl.getAttribute('mesid'));
    const textEl = mesEl.querySelector('.mes_text');
    if (!textEl || Number.isNaN(i)) return;
    const set = settings();
    const s = current.state;

    // 상태 슬롯
    const slots = textEl.querySelectorAll('.gs-slot, .custom-gs-slot');
    const snap = current.snaps.get(i);
    slots.forEach((slot, k) => {
        if (k > 0 || !snap || set.msgCard === 'off') { slot.innerHTML = ''; slot.style.display = 'none'; return; }
        slot.style.display = '';
        slot.innerHTML = cardHTML(snap, set.msgCard === 'full' && isLastAI);
    });

    // 선택지
    textEl.querySelectorAll('.gs-choices, .custom-gs-choices').forEach(box => {
        if (box.dataset.gsDone === '1') { box.classList.toggle('gs-stale', !isLastAI); return; }
        const items = choiceItems(box);
        if (!items.length) return;
        const list = document.createElement('div');
        list.className = 'gs-choice-list';
        items.forEach((t, n) => {
            const odd = /^[⟨〈<《]\s*이질\s*[⟩〉>》]/.test(t);
            const label = t.replace(/^[⟨〈<《]\s*이질\s*[⟩〉>》]\s*/, '');
            const b = document.createElement('button');
            b.className = `gs-choice${odd ? ' gs-odd' : ''}`;
            b.innerHTML = `<span>${n + 1}</span>${esc(label)}`;
            b.addEventListener('click', () => {
                if (box.classList.contains('gs-stale')) return;
                insertInput(label, settings().choiceClick === 'send', 'replace');
            });
            list.appendChild(b);
        });
        box.replaceChildren(list);
        box.dataset.gsDone = '1';
        box.classList.toggle('gs-stale', !isLastAI);
    });

    // 판정·권능 태그 색
    textEl.querySelectorAll('.gs-tag, .custom-gs-tag').forEach(tag => {
        const t = tag.textContent;
        tag.dataset.kind = t.startsWith('판정') ? (/대성공/.test(t) ? 'crit' : /대실패/.test(t) ? 'fumble' : /성공/.test(t) ? 'ok' : 'fail') : t.startsWith('권능') ? 'power' : t.startsWith('의뢰') ? 'case' : 'taboo';
    });

    // 이성 붕괴 시 글자 일그러짐 (화면 표시만)
    if (isLastAI && set.zalgo && s.registered && s.san <= 25 && !textEl.querySelector('.gs-z')) {
        zalgoize(textEl, 0.025 + (25 - s.san) * 0.003, `${i}:${s.san}`);
    }
}

function decorateAll() {
    if (!current) return;
    const chat = ctx().chat ?? [];
    let lastAI = -1;
    for (let i = chat.length - 1; i >= 0; i--) { if (!chat[i].is_user && !chat[i].is_system) { lastAI = i; break; } }
    document.querySelectorAll('#chat .mes').forEach(el => decorateMessage(el, Number(el.getAttribute('mesid')) === lastAI));
}

// ───────────────────────────── 팝업 공통 ─────────────────────────────

async function popup(el, opts = {}) {
    const { Popup, POPUP_TYPE } = ctx();
    const p = new Popup(el, POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true, okButton: '닫기', ...opts });
    return await p.show();
}

function contractFormHTML(prefix, c = {}) {
    return `<div class="gs-form-grid gs-custom-contract">
        <label>객성의 이름<input class="text_pole" data-f="${prefix}name" value="${esc(c.name ?? '')}" placeholder="예: 울지 않는 상여꾼"></label>
        <label>오행<select class="text_pole" data-f="${prefix}element">${['목', '화', '토', '금', '수', '무'].map(e => `<option ${c.element === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
        <label class="gs-wide">권능<textarea class="text_pole" rows="2" data-f="${prefix}power" placeholder="무엇을 할 수 있는가">${esc(c.power ?? '')}</textarea></label>
        <label class="gs-wide">기괴한 금기 (매일 지켜야 함)<textarea class="text_pole" rows="2" data-f="${prefix}taboo" placeholder="예: 해 질 녘마다 신발을 거꾸로 신을 것">${esc(c.taboo ?? '')}</textarea></label>
        <label class="gs-wide">어기면 내리는 저주<textarea class="text_pole" rows="2" data-f="${prefix}curse">${esc(c.curse ?? '')}</textarea></label>
        <label class="gs-wide">오염 증상<textarea class="text_pole" rows="2" data-f="${prefix}symptom">${esc(c.symptom ?? '')}</textarea></label>
        <label class="gs-wide">말하는 방식<input class="text_pole" data-f="${prefix}voice" value="${esc(c.voice ?? '')}"></label>
        <button type="button" class="gs-btn" data-gen="${prefix}"><i class="fa-solid fa-wand-sparkles"></i> AI에게 지어 달라고 하기</button>
    </div>`;
}
function readContract(root, prefix) {
    const g = (f) => root.querySelector(`[data-f="${prefix}${f}"]`)?.value.trim() ?? '';
    return { id: `custom-${Date.now()}`, name: g('name'), hanja: '', element: g('element') || '무', power: g('power'), taboo: g('taboo'), curse: g('curse'), symptom: g('symptom'), voice: g('voice') };
}

async function aiContract(root, prefix, btn) {
    const { generateRaw } = ctx();
    const hint = root.querySelector(`[data-f="${prefix}name"]`)?.value.trim();
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 별을 읽는 중…';
    try {
        const out = await generateRaw({
            systemPrompt: 'You design lore for a horror TRPG blending Korean shamanism (무속), Taoism (도교) and cosmic horror. Output only the requested format.',
            prompt: `Create one new 객성(客星): an otherworldly being in a present-day Korean exorcism story.${hint ? ` Name or concept: ${hint}.` : ''}
Its 권능 is strong but costly; its 금기 is a bizarre, concrete action that must be done every day in ordinary life.
Write the values in Korean. Output exactly these 7 lines, nothing else:
이름:
오행: (목/화/토/금/수/무 중 하나)
권능:
금기:
저주:
증상:
말투: `,
        });
        const pick = (k) => (String(out).match(new RegExp(`${k}\\s*[:：]\\s*(.+)`)) ?? [])[1]?.trim() ?? '';
        const map = { name: '이름', element: '오행', power: '권능', taboo: '금기', curse: '저주', symptom: '증상', voice: '말투' };
        for (const [f, k] of Object.entries(map)) {
            const v = pick(k);
            const inp = root.querySelector(`[data-f="${prefix}${f}"]`);
            if (!v || !inp) continue;
            if (f === 'element') { const e = ['목', '화', '토', '금', '수', '무'].find(x => v.includes(x)); if (e) inp.value = e; } else inp.value = v;
        }
    } catch (e) {
        console.error(LOG, e);
        toastr.error('생성에 실패했습니다. API 연결을 확인하세요.', '객성록');
    } finally {
        btn.disabled = false;
        btn.innerHTML = old;
    }
}

// ───────────────────────────── 입적 (캐릭터 생성) ─────────────────────────────

async function openRegister(editing = false) {
    if (!isActive()) return toastr.info('객성록 카드가 열린 채팅에서만 사용할 수 있습니다.', '객성록');
    const c = ctx();
    const prof = getMeta()?.profile;
    const p = editing && prof ? prof : null;
    const jobFound = p ? JOBS.findIndex(j => j.rank === p.rank) : 0;
    const jobIdx = jobFound === -1 ? JOBS.length - 1 : jobFound;
    const el = h(`<div class="gs-root gs-pop">
        <h3 class="gs-title">入籍 · 입적</h3>
        <p class="gs-dim gs-center">명부에 이름을 올린다. 이름을 올린 자만이 별과 계약할 수 있다.</p>
        <details class="gs-help"><summary>처음이세요? 30초 안내</summary>${GUIDE[0][1]}</details>
        <div class="gs-form-grid">
            <label>이름<input class="text_pole" data-f="name" value="${esc(p?.name ?? c.name1 ?? '')}"></label>
            <label>나이 (선택)<input class="text_pole" data-f="age" value="${esc(p?.age ?? '')}" placeholder="예: 27"></label>
            <label class="gs-wide">신분
                <select class="text_pole" data-f="job">${JOBS.map((j, i) => `<option value="${i}" ${i === jobIdx ? 'selected' : ''}>${esc(j.label)}</option>`).join('')}</select>
                <small class="gs-dim" data-o="jobnote"></small>
                <input class="text_pole gs-hidden" data-f="jobCustom" placeholder="직접 입력한 신분/직업" value="${esc(p && jobFound === -1 ? p.rank : '')}">
            </label>
            <label>배경
                <select class="text_pole" data-f="bg">${BACKGROUNDS.map(b => `<option ${p?.background === b ? 'selected' : ''}>${b}</option>`).join('')}</select>
                <input class="text_pole gs-hidden" data-f="bgCustom" placeholder="직접 입력" value="${esc(p && !BACKGROUNDS.includes(p.background) ? p.background : '')}">
            </label>
            <label>사는 곳
                <select class="text_pole" data-f="loc">${PLACES.map(b => `<option ${p?.loc === b ? 'selected' : ''}>${b}</option>`).join('')}</select>
                <input class="text_pole gs-hidden" data-f="locCustom" placeholder="직접 입력">
            </label>
            <label class="gs-wide">한 줄 사연 (선택)<textarea class="text_pole" rows="2" data-f="story" placeholder="예: 실종된 동생을 찾다가 처음 괴이를 보았다.">${esc(p?.story ?? '')}</textarea></label>
        </div>
        <h4 class="gs-sub">첫 번째 계약 — 객성(客星)</h4>
        <p class="gs-dim">객성은 힘을 빌려주는 이계의 존재입니다. <b>권능</b>(쓸 수 있는 힘)과 <b>금기</b>(매일 지켜야 하는 이상한 규칙)를 함께 받습니다. 금기를 처음 지키는 순간 계약이 완전히 성립해요. 어느 쪽이든 마음에 드는 이야기를 고르세요 — 정답은 없습니다.</p>
        <div class="gs-contract-pick">
            ${CONTRACTS.map((k, i) => `<label class="gs-ccard" data-el="${k.element}">
                <input type="radio" name="gs-contract" value="${i}" ${(p ? p.contracts?.[0]?.name === k.name : i === 0) ? 'checked' : ''}>
                <div><b>${esc(k.name)}</b><small>${esc(k.hanja)} · ${k.element}</small></div>
                <p><span>권능</span>${esc(k.power)}</p><p><span>금기</span>${esc(k.taboo)}</p>
            </label>`).join('')}
            <label class="gs-ccard gs-ccard-custom"><input type="radio" name="gs-contract" value="custom" ${p && !CONTRACTS.some(k => k.name === p.contracts?.[0]?.name) ? 'checked' : ''}>
                <div><b>직접 만들기</b><small>이름 없는 별</small></div><p>권능과 금기를 직접 정하거나 AI에게 맡깁니다.</p></label>
        </div>
        <div class="gs-hidden" data-o="custom">${contractFormHTML('c_', p && !CONTRACTS.some(k => k.name === p.contracts?.[0]?.name) ? p.contracts?.[0] : {})}</div>
        <div class="gs-preview" data-o="preview"></div>
    </div>`);
    const q = (s) => el.querySelector(s);
    const sync = () => {
        const job = JOBS[q('[data-f="job"]').value];
        q('[data-o="jobnote"]').textContent = job.note ? `${job.note} — 체력 ${job.hp} · 이성 ${job.san} · 오염 ${job.cor}% · ${won(job.cash)}` : '';
        q('[data-f="jobCustom"]').classList.toggle('gs-hidden', job.id !== 'custom');
        q('[data-f="bgCustom"]').classList.toggle('gs-hidden', q('[data-f="bg"]').value !== '직접 입력');
        q('[data-f="locCustom"]').classList.toggle('gs-hidden', q('[data-f="loc"]').value !== '직접 입력');
        const v = el.querySelector('input[name="gs-contract"]:checked')?.value;
        q('[data-o="custom"]').classList.toggle('gs-hidden', v !== 'custom');
        const k = v === 'custom' ? null : CONTRACTS[Number(v)];
        q('[data-o="preview"]').innerHTML = k ? `<p><span>저주</span>${esc(k.curse)}</p><p><span>증상</span>${esc(k.symptom)}</p><p><span>목소리</span>${esc(k.voice)}</p>` : '';
    };
    el.addEventListener('change', sync);
    el.addEventListener('click', (e) => {
        const g = e.target.closest('[data-gen]');
        if (g) aiContract(el, g.dataset.gen, g);
    });
    sync();

    const { POPUP_RESULT } = c;
    const r = await popup(el, { okButton: editing ? '수정한다' : '계약한다', cancelButton: '나중에' });
    if (r !== POPUP_RESULT.AFFIRMATIVE) return;

    const job = JOBS[q('[data-f="job"]').value];
    const v = el.querySelector('input[name="gs-contract"]:checked')?.value;
    let contract = v === 'custom' ? readContract(el, 'c_') : clone(CONTRACTS[Number(v)]);
    if (!contract.name) contract.name = '이름 없는 별';
    if (!contract.taboo) contract.taboo = '매일 해가 질 때, 아무도 없는 방에 인사할 것.';
    if (!contract.curse) contract.curse = '하루 동안 아무도 당신의 말을 끝까지 듣지 못한다.';
    if (!contract.power) contract.power = '정체불명의 힘. 쓸 때마다 무엇이 일어날지 모른다.';
    const bg = q('[data-f="bg"]').value === '직접 입력' ? q('[data-f="bgCustom"]').value.trim() : q('[data-f="bg"]').value;
    const loc = q('[data-f="loc"]').value === '직접 입력' ? q('[data-f="locCustom"]').value.trim() : q('[data-f="loc"]').value;
    const profile = {
        name: q('[data-f="name"]').value.trim() || c.name1 || '이름 없는 자',
        age: q('[data-f="age"]').value.trim(),
        rank: job.id === 'custom' ? (q('[data-f="jobCustom"]').value.trim() || '계약자') : job.rank,
        background: bg, loc, story: q('[data-f="story"]').value.trim(),
        hp: job.hp, san: job.san, cor: job.cor, cash: job.cash, time: '자정',
        contracts: editing && p ? [contract, ...(p.contracts ?? []).slice(1)] : [contract],
        items: editing && p?.items ? p.items : (KITS[job.id] ?? KITS.custom).map(([name, qty]) => ({ name, qty })),
    };
    if (profile.age) profile.background = `${profile.age}세 ${profile.background}`.trim();
    const meta = getMeta(true);
    meta.profile = profile;
    if (!editing) meta.adjust = [];
    await saveMeta(true);
    refreshNow();
    if (!editing) {
        toastr.success(`${esc(profile.name)} — 「${esc(contract.name)}」과(와) 계약했다. 첫 행동을 보내면 이야기가 시작된다.`, '입적 완료', { timeOut: 7000 });
        insertInput(`(${contract.name}의 손을 잡는다.) `);
    }
}

// ───────────────────────────── 판정 ─────────────────────────────

const ROLL_TYPES = [
    { id: 'body', name: '육체', desc: '달리기·힘·버티기·격투' },
    { id: 'sense', name: '감지', desc: '살피기·기척·단서 찾기' },
    { id: 'magic', name: '주술', desc: '부적·진언·결계·권능 제어' },
    { id: 'mind', name: '정신', desc: '공포 버티기·유혹 거부' },
    { id: 'talk', name: '교섭', desc: '설득·거짓말·괴이와의 흥정' },
    { id: 'stealth', name: '은신', desc: '숨기·몰래 움직이기' },
];
const DIFFS = [{ name: '쉬움', t: 75 }, { name: '보통', t: 55 }, { name: '어려움', t: 35 }, { name: '절망', t: 15 }];

function rollMods(s, type) {
    const m = [];
    if (s.hp <= 30 && ['body', 'stealth'].includes(type)) m.push(['중상', -15]);
    const ss = sanStage(s.san);
    if (ss >= 2 && ['sense', 'mind', 'talk'].includes(type)) m.push([ss >= 3 ? '이성 붕괴' : '환각', ss >= 3 ? -20 : -10]);
    if (type === 'magic' && s.cor >= 10) m.push(['오염의 친화', Math.floor(s.cor / 5)]);
    const best = Math.max(0, ...s.contracts.map(c => resLevel(s, c)));
    if (type === 'magic' && best >= 2) m.push([`공명 Lv${best}`, (best - 1) * 4]);
    if (type === 'sense' && s.mutations.length) m.push(['변이 감각', Math.min(15, s.mutations.length * 5)]);
    if (type === 'talk' && corStage(s.cor) >= 2) m.push(['인외의 기색', -10]);
    const activeCurses = s.curses.length;
    if (activeCurses) m.push(['저주', -5 * Math.min(activeCurses, 3)]);
    return m;
}
function judge(roll, target, s) {
    const fumbleAt = sanStage(s.san) >= 3 ? 91 : 96;
    if (roll <= Math.max(1, Math.floor(target / 5))) return '대성공';
    if (roll >= fumbleAt) return '대실패';
    return roll <= target ? '성공' : '실패';
}

async function openRoll(preType, preDiff) {
    const s = current?.state;
    if (!s?.registered) return openRegister();
    const canReroll = s.contracts.some(c => c.id === 'dodong' || c.name === '거꾸로 선 아이') && s.rerollDay !== s.day;
    const el = h(`<div class="gs-root gs-pop">
        <h3 class="gs-title">判定 · 판정</h3>
        <p class="gs-dim gs-center">위험한 행동의 성패를 주사위(1~100)로 정합니다. 목표 이하면 성공 · 목표의 1/5 이하면 대성공 · 96 이상은 대실패. 결과를 입력창에 넣으면 AI가 그대로 따릅니다.</p>
        <div class="gs-seg" data-g="type">${ROLL_TYPES.map((t, i) => `<button type="button" data-v="${t.id}" class="${(preType ? t.id === preType : i === 0) ? 'on' : ''}"><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}</div>
        <div class="gs-seg gs-seg-sm" data-g="diff">${DIFFS.map((d, i) => `<button type="button" data-v="${i}" class="${(preDiff != null ? i === preDiff : i === 1) ? 'on' : ''}"><b>${d.name}</b><small>${d.t}</small></button>`).join('')}</div>
        <label class="gs-wide">무엇을 하는가 (선택)<input class="text_pole" data-f="what" placeholder="예: 소금으로 원을 그리고 그 안에 앉는다"></label>
        <div class="gs-mods" data-o="mods"></div>
        <div class="gs-dice" data-o="dice"><div class="gs-dice-in"><span>?</span></div></div>
        <div class="gs-roll-actions">
            <button type="button" class="gs-btn gs-btn-red" data-a="roll"><i class="fa-solid fa-dice-d20"></i> 굴린다</button>
            <button type="button" class="gs-btn gs-hidden" data-a="reroll"><i class="fa-solid fa-backward"></i> 역행 (오염 +8)</button>
            <button type="button" class="gs-btn gs-hidden" data-a="use"><i class="fa-solid fa-arrow-turn-down"></i> 입력창에 넣기</button>
        </div>
    </div>`);
    const q = (x) => el.querySelector(x);
    let type = preType ?? 'body', diff = preDiff ?? 1, result = null, rerolled = false;
    const target = () => clamp(DIFFS[diff].t + rollMods(s, type).reduce((a, [, v]) => a + v, 0), 1, 95);
    const showMods = () => {
        const mods = rollMods(s, type);
        q('[data-o="mods"]').innerHTML = `기본 ${DIFFS[diff].t}${mods.map(([n, v]) => ` <span class="${v < 0 ? 'neg' : 'pos'}">${n} ${signed(v)}</span>`).join('')} → <b>목표 ${target()}</b>`;
    };
    const doRoll = () => {
        const t = target();
        const r = d100();
        const j = judge(r, t, s);
        result = { r, t, j };
        const d = q('[data-o="dice"]');
        d.className = 'gs-dice gs-rolling';
        let n = 0;
        const iv = setInterval(() => {
            d.innerHTML = `<div class="gs-dice-in"><span>${d100()}</span></div>`;
            if (++n > 9) {
                clearInterval(iv);
                d.className = `gs-dice gs-j-${{ 대성공: 'crit', 성공: 'ok', 실패: 'fail', 대실패: 'fumble' }[j]}`;
                d.innerHTML = `<div class="gs-dice-in"><span>${r}</span><b>${j}</b><small>목표 ${t}</small></div>`;
                q('[data-a="use"]').classList.remove('gs-hidden');
                q('[data-a="reroll"]').classList.toggle('gs-hidden', !(canReroll && !rerolled && (j === '실패' || j === '대실패')));
            }
        }, 55);
    };
    el.addEventListener('click', async (e) => {
        const seg = e.target.closest('.gs-seg button');
        if (seg) {
            const g = seg.parentElement.dataset.g;
            seg.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === seg));
            if (g === 'type') type = seg.dataset.v; else diff = Number(seg.dataset.v);
            showMods();
            return;
        }
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'roll') { q('[data-a="roll"]').classList.add('gs-hidden'); doRoll(); }
        if (a === 'reroll') {
            rerolled = true;
            await addAdjust([['cor', '+8'], ['_reroll', '1']], '역행 — 판정을 되감았다');
            doRoll();
        }
        if (a === 'use' && result) {
            const tn = ROLL_TYPES.find(t => t.id === type).name;
            const what = q('[data-f="what"]').value.trim();
            insertInput(`[판정 · ${tn} · ${DIFFS[diff].name} · 목표 ${result.t} · 굴림 ${result.r} → ${result.j}${rerolled ? ' · 역행' : ''}] ${what}`);
            el.closest('dialog')?.querySelector('.popup-button-ok')?.click();
        }
    });
    showMods();
    await popup(el, { okButton: '닫기' });
}

// ───────────────────────────── 권능 ─────────────────────────────

const POWER_LV = [{ name: '약', cor: 4, d: '손끝만 빌린다' }, { name: '중', cor: 10, d: '목소리를 빌린다' }, { name: '강', cor: 22, d: '몸을 내준다' }];

async function openPower() {
    const s = current?.state;
    if (!s?.registered) return openRegister();
    if (!s.contracts.length) return toastr.warning('계약한 객성이 없다.', '객성록');
    const el = h(`<div class="gs-root gs-pop">
        <h3 class="gs-title">權能 · 권능 발동</h3>
        <p class="gs-dim gs-center">객성의 힘을 빌립니다. 세게 빌릴수록 효과는 크지만 오염이 오릅니다. 오염이 25·50·75%를 넘으면 몸에 변이가 생겨요.</p>
        <div class="gs-contract-pick">${s.contracts.map((c, i) => `<label class="gs-ccard" data-el="${esc(c.element)}">
            <input type="radio" name="gs-pw" value="${i}" ${i === 0 ? 'checked' : ''}><div><b>${esc(c.name)}</b><small>${esc(c.element)} · 공명 Lv${resLevel(s, c)} ${RES_NAME[resLevel(s, c)]}</small></div><p>${esc(c.power)}</p></label>`).join('')}</div>
        <div class="gs-seg gs-seg-sm" data-g="lv">${POWER_LV.map((l, i) => `<button type="button" data-v="${i}" class="${i === 1 ? 'on' : ''}"><b>${l.name}</b><small>${l.d}</small></button>`).join('')}</div>
        <label class="gs-wide">어떻게 쓰는가<input class="text_pole" data-f="what" placeholder="예: 우산 속 여자의 진명을 본다"></label>
        <div class="gs-mods" data-o="cost"></div>
    </div>`);
    const q = (x) => el.querySelector(x);
    let lv = 1;
    const cost = () => {
        const c = s.contracts[Number(el.querySelector('input[name="gs-pw"]:checked').value)];
        const mult = c.id === 'cheongong' || c.name === '구멍 난 하늘' ? 1.5 : 1;
        return Math.round(POWER_LV[lv].cor * mult);
    };
    const show = () => {
        const c = s.contracts[Number(el.querySelector('input[name="gs-pw"]:checked').value)];
        const sealed = resLevel(s, c) >= 1;
        el.querySelectorAll('[data-g="lv"] button').forEach((b, i) => { b.disabled = !sealed && i > 0; b.style.opacity = b.disabled ? .35 : ''; });
        if (!sealed && lv > 0) { lv = 0; el.querySelectorAll('[data-g="lv"] button').forEach((b, i) => b.classList.toggle('on', i === 0)); }
        const n = cost();
        const after = clamp(s.cor + n, 0, 100);
        const cross = corStage(after) > s.corPeak && corStage(after) <= 3;
        q('[data-o="cost"]').innerHTML = `오염 <b>${s.cor}% → ${after}%</b> <span class="neg">+${n}</span>${cross ? ' <span class="gs-warn">⚠ 임계점을 넘는다 — 변이가 발현된다</span>' : ''}${sealed ? '' : '<br><span class="gs-dim">가계약 상태 — 금기를 한 번 지켜 계약을 성립시키기 전에는 손끝만 빌릴 수 있다.</span>'}`;
    };
    el.addEventListener('click', (e) => {
        const seg = e.target.closest('.gs-seg button');
        if (seg && !seg.disabled) { seg.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === seg)); lv = Number(seg.dataset.v); show(); }
    });
    el.addEventListener('change', show);
    show();
    const { POPUP_RESULT } = ctx();
    const r = await popup(el, { okButton: '발동한다', cancelButton: '그만둔다' });
    if (r !== POPUP_RESULT.AFFIRMATIVE) return;
    const c = s.contracts[Number(el.querySelector('input[name="gs-pw"]:checked').value)];
    const n = cost();
    const what = q('[data-f="what"]').value.trim();
    await addAdjust([['cor', `+${n}`]], `권능 — ${c.name} (${POWER_LV[lv].name})`);
    insertInput(`[권능 · ${c.name} · ${POWER_LV[lv].name} · 오염 +${n} 반영됨] ${what}`);
}

// ───────────────────────────── 소지품 · 상점 ─────────────────────────────

const SHOP = [
    { name: '소금', qty: 1, price: 5000, desc: '결계·잡귀 퇴치. 원을 그리면 水 괴이를 막는다.' },
    { name: '팥', qty: 1, price: 3000, desc: '잡귀를 흩는다.' },
    { name: '부적', qty: 10, price: 200000, desc: '황지에 경면주사. 10장 묶음.' },
    { name: '쇠못', qty: 10, price: 3000, desc: '木 괴이의 상극. 10개.' },
    { name: '라이터', qty: 1, price: 2000, desc: '金 괴이의 상극. 불.' },
    { name: '정화수', qty: 1, price: 10000, desc: '새벽 첫 우물물. 火 괴이를 식힌다.' },
    { name: '향', qty: 5, price: 5000, desc: '정화·공양. 5개.' },
    { name: '거울', qty: 1, price: 20000, desc: '정체를 비춘다. 오염된 계약자도.' },
    { name: '방울', qty: 1, price: 150000, desc: '잡귀를 물리고 넋을 진정시킨다(이성 +1~2).' },
    { name: '복숭아나무 목검', qty: 1, price: 350000, desc: '귀신이 가장 싫어하는 나무. 土 괴이 특효.' },
    { name: '오방기', qty: 1, price: 800000, desc: '다섯 깃발. 방위 결계.' },
];
const KITS = {
    cheon: [['부적', 5], ['소금', 2], ['무전기', 1], ['위장 신분증', 1]],
    mudang: [['부적', 8], ['방울', 1], ['향', 5]],
    heuk: [['소금', 1], ['라이터', 1], ['쇠못', 6]],
    civil: [['소금', 1]],
    custom: [['소금', 1], ['부적', 2]],
};

function addItem(s, name, qty) {
    name = name.trim();
    if (!name) return;
    let it = s.items.find(x => x.name === name) ?? fuzzyFind(s.items, name);
    if (!it) { if (qty <= 0) return; it = { name, qty: 0 }; s.items.push(it); }
    it.qty = Math.max(0, it.qty + qty);
    if (it.qty === 0) s.items = s.items.filter(x => x !== it);
}
function applyItems(s, val) {
    for (const part of val.split(/\s*[,/]\s*/)) {
        const m = part.trim().match(/^([+\-−])?\s*(.+?)\s*(?:[x×*]\s*)?(\d+)?(?:개|장|병)?$/);
        if (!m || NONE_RE.test(m[2])) continue;
        const n = parseInt(m[3] ?? '1', 10) || 1;
        addItem(s, m[2], m[1] && m[1] !== '+' ? -n : n);
    }
}
const itemsText = (s) => s.items.map(i => `${i.name}${i.qty > 1 ? `×${i.qty}` : ''}`).join(', ');

function shopHTML(s) {
    return `<div class="gs-shop">${SHOP.map((x, i) => `<div class="gs-item">
        <b>${esc(x.name)}${x.qty > 1 ? ` ×${x.qty}` : ''}</b><span>${esc(x.desc)}</span>
        <button type="button" class="gs-btn gs-btn-sm" data-a="buy" data-i="${i}" ${s.cash < x.price ? 'disabled' : ''}>${won(x.price)}</button></div>`).join('')}</div>`;
}

// ───────────────────────────── 의뢰 게시판 ─────────────────────────────

const BOARD_POOL = [
    { src: '사천감', title: '청림 1단지 104동 엘리베이터', area: '청림구', grade: 3, pay: '80만원', hook: '13층이 없는 동에서 13층 버튼이 켜진다. 사흘 새 실종 3명.' },
    { src: '사천감', title: '적야 먹자골목 우산 민원', area: '적야구', grade: 2, pay: '50만원', hook: '비 오는 밤마다 붉은 우산을 든 여자를 따라간 취객이 사라진다.' },
    { src: '흑첨', title: '백철 무인 은행의 이상 출금', area: '백철구', grade: 4, pay: '500만원', hook: '의뢰인은 통장 잔고 대신 아버지의 이름이 빠져나갔다고 주장한다.' },
    { src: '만신회', title: '소란당 단골의 넋 찾기', area: '흑수구', grade: 2, pay: '정화 1회', hook: '막차를 탄 손녀가 돌아왔는데, 신발이 계속 젖어 있다.' },
    { src: '소문', title: '구청 지하 기록실의 야근자', area: '황궁구', grade: 3, pay: '30만원', hook: '같은 날짜의 결재 서류만 매일 새로 쌓인다는 청소 노동자의 제보.' },
    { src: '흑첨', title: '재개발 조합장의 의뢰', area: '청림구', grade: 3, pay: '300만원', hook: '철거만 하면 인부가 다친다. 조합장은 이유를 묻지 말라고 한다.' },
    { src: '사천감', title: '화장장 야간 경비 실종', area: '적야구', grade: 3, pay: '120만원', hook: '소각로가 꺼진 시간에도 굴뚝에서 연기가 오른다.' },
    { src: '만신회', title: '굿판에서 도망친 손님', area: '황궁구', grade: 4, pay: '부적 10장 + 정화', hook: '내림굿 도중 신이 아닌 무언가가 내려와 아이 몸으로 도망쳤다.' },
    { src: '소문', title: '배달 앱 리뷰의 별점 0개', area: '백철구', grade: 1, pay: '없음', hook: '"문 앞에 두고 갔는데 누가 계속 문을 두드려요" 리뷰가 하루 서른 개.' },
    { src: '흑첨', title: '컨테이너 야적장 18번', area: '흑수구', grade: 4, pay: '700만원', hook: '안에서 노크 소리가 나는 컨테이너. 화주는 연락이 끊겼다.' },
    { src: '사천감', title: '놀이터 그네 민원', area: '청림구', grade: 1, pay: '30만원', hook: '자정마다 혼자 흔들리는 그네. 주민들이 아이 웃음소리를 들었다.' },
    { src: '소문', title: '붉은 방의 마지막 손님', area: '적야구', grade: 2, pay: '없음', hook: '지하 클럽 "붉은 방"에서 나온 사람들이 웃음을 잃었다.' },
];

function parseBoard(text) {
    const out = [];
    for (const blk of String(text).split(/#{3,}/)) {
        const g = (k) => (blk.match(new RegExp(`${k}\\s*[:：]\\s*(.+)`)) ?? [])[1]?.trim() ?? '';
        const title = g('제목');
        if (!title) continue;
        out.push({ src: g('출처') || '소문', title, area: g('구역') || '한성', grade: clamp(parseInt(g('등급'), 10) || 2, 1, 5), pay: g('보수') || '협의', hook: g('개요') });
    }
    return out.slice(0, 3);
}

async function fetchBoard(s) {
    const { generateRaw } = ctx();
    try {
        const out = await generateRaw({
            systemPrompt: 'You write job postings for a Korean occult-horror hunter game. Output only the requested format, in Korean.',
            prompt: `Setting: 한성특별시 — districts 청림구(木, redevelopment), 적야구(火, nightlife), 황궁구(土, old downtown), 백철구(金, finance/industry), 흑수구(水, harbor/closed subway). Sources: 사천감 (government, modest pay), 만신회 (shamans, may pay in rites), 흑첨 (black-market, high pay, shady), 소문 (rumor, no pay).
Hunter: ${s.rank}, day ${s.day}, at ${s.loc || '한성'}, corruption ${s.cor}%${s.bonds.length ? `, knows ${s.bonds.slice(-3).map(b => b.name).join(', ')}` : ''}.
Write 3 different commissions (mix sources and districts; one may involve a known person). Each hides a 괴이 with a rule and a weakness — don't reveal them, only an eerie concrete hook.
Format exactly, separated by ###:
###
출처:
제목:
구역:
등급: (1-5)
보수:
개요: (one or two sentences)`,
        });
        const list = parseBoard(out);
        if (list.length) return list;
    } catch (e) { console.warn(LOG, 'board generation failed', e); }
    const rnd = rngFrom(`${ctx().getCurrentChatId?.()}:${s.day}:${Date.now()}`);
    return BOARD_POOL.slice().sort(() => rnd() - .5).slice(0, 3);
}

async function openBoard(force = false) {
    const s = current?.state;
    if (!s?.registered) return openRegister();
    const meta = getMeta(true);
    const el = h(`<div class="gs-root gs-pop">
        <h3 class="gs-title">依賴 · 의뢰 게시판</h3>
        <p class="gs-dim gs-center">${s.day}일차 · ${esc(s.loc || '한성')}${s.case ? ` · <span class="gs-warn">진행 중: ${esc(s.case)}</span>` : ''}</p>
        <p class="gs-dim gs-center">◆ 개수 = 위험도. 사천감은 안정적, 흑첨은 돈이 크지만 위험, 만신회는 정화로 갚기도, 소문은 보수가 없습니다. 의뢰를 끝내면 괴이의 잔향으로 오염 +3.</p>
        <div class="gs-board" data-o="list"><div class="gs-center gs-dim"><i class="fa-solid fa-spinner fa-spin"></i> 쪽지와 문자, 전화가 도착하는 중…</div></div>
        <div class="gs-roll-actions"><button type="button" class="gs-btn" data-a="reload"><i class="fa-solid fa-rotate"></i> 다른 의뢰 받기</button></div>
    </div>`);
    const draw = (list) => {
        el.querySelector('[data-o="list"]').innerHTML = list.map((b, i) => `<div class="gs-job" data-src="${esc(b.src)}">
            <div class="gs-job-head"><span class="gs-job-src">${esc(b.src)}</span><b>${esc(b.title)}</b><span class="gs-job-grade">${'◆'.repeat(b.grade)}${'◇'.repeat(5 - b.grade)}</span></div>
            <p>${esc(b.hook)}</p>
            <div class="gs-job-foot"><span><i class="fa-solid fa-location-dot"></i> ${esc(b.area)}</span><span><i class="fa-solid fa-coins"></i> ${esc(b.pay)}</span>
            <button type="button" class="gs-btn gs-btn-red gs-btn-sm" data-a="take" data-i="${i}">수락</button></div></div>`).join('');
    };
    const load = async (regen) => {
        if (!regen && meta.board?.day === s.day && meta.board.list?.length) return draw(meta.board.list);
        el.querySelector('[data-o="list"]').innerHTML = '<div class="gs-center gs-dim"><i class="fa-solid fa-spinner fa-spin"></i> 쪽지와 문자, 전화가 도착하는 중…</div>';
        const list = await fetchBoard(s);
        meta.board = { day: s.day, list };
        saveMeta();
        draw(list);
    };
    el.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-a]');
        if (!a || a.disabled) return;
        if (a.dataset.a === 'reload') { a.disabled = true; await load(true); a.disabled = false; }
        if (a.dataset.a === 'take') {
            const b = meta.board.list[Number(a.dataset.i)];
            await addAdjust([['case', `${b.title} | 수락`], ['mode', '의뢰']], `의뢰 수락 — ${b.title} (${b.src})`);
            meta.board.list.splice(Number(a.dataset.i), 1);
            saveMeta();
            insertInput(`[의뢰 수락 · ${b.src} · ${b.title} · ${b.area} · 보수 ${b.pay} · ${b.hook}] `);
            el.closest('dialog')?.querySelector('.popup-button-ok')?.click();
        }
    });
    setTimeout(() => load(force), 0);
    await popup(el, { okButton: '닫기' });
}

// ───────────────────────────── 객성의 속삭임 ─────────────────────────────

const WHISPERS = {
    gwanchuk: ['〈 오른쪽. 세 걸음. 아직 돌아보지 마라. 〉', '〈 그녀는 내일 거짓말을 했다. 〉', '〈 너의 피는 맛있었다. 세 스푼. 〉', '〈 보고 있다. 너도 이제 보인다. 〉', '〈 눈을 감아라. 그래야 더 잘 보인다. 〉', '〈 이름: ████. 너는 아직 읽지 못한다. 〉'],
    sinbu: ['그 사람한테 웃어 줬지. 봤어.', '사랑한다고 말해. 나한테. 지금.', '물이 차오르면 우리 둘만 남을 거야.', '당신 손, 왜 이렇게 말라 있어?', '다른 사람 냄새가 나.', '괜찮아. 다 젖으면 안 추워.'],
    seogi: ['금일 기재 건수: 0. 미비합니다.', '접수되었습니다. 대가는 추후 청구됩니다.', '방금 그분의 성함을 받아 적으셨어야 합니다.', '귀하의 성함 중 한 글자가 반려되었습니다.', '서명란이 비어 있습니다. 피로 대신하셔도 됩니다.', '처리 기한이 임박했습니다.'],
    adeung: ['배고파. 배고파. 배고파.', '저 사람 따뜻해 보여. 태워도 돼?', '첫 숟갈 잊었지. 나 다 봤어.', '불 꺼지면 무서워. 계속 켜 줘.', '기억 하나만. 작은 거. 응?', '너도 따뜻해. 제일 따뜻해.'],
    dodong: ['.야했말 고라돌아 지말', '!다았찾 ~다았찾', '.어있 에뒤 너 이문', '.야지 고면잡 을손 내', '?야몇 금지 ,아', '.해 다시 번 한'],
    cheongong: ['(주변의 소리가 한 박자 사라진다)', '(냉장고 소음이 멎는다. 다시 돌아오지 않는다)', '(당신의 숨소리만 들리지 않는다)', '(머리 위가 비어 있는 느낌)', '(방금 무슨 말을 하려 했는지 잊는다)', '(침묵이 대답한다)'],
    custom: ['…듣고 있어.', '조금만 더 가까이.', '약속, 잊지 않았지?', '너는 이미 반쯤 내 것이야.', '오늘은 무엇을 줄 거니?', '사람들이 너를 보는 눈이 달라졌어.'],
};
function whisperLine(s, seed) {
    const c = s.contracts.length ? s.contracts[Math.floor(rngFrom(seed + 'c')() * s.contracts.length)] : null;
    if (!c) return null;
    const pool = WHISPERS[c.id] ?? WHISPERS.custom;
    return { name: c.name, text: pool[Math.floor(rngFrom(seed)() * pool.length)] };
}
let activeWhisper = null;
function maybeWhisper(seed, force = false) {
    const s = current?.state;
    if (!s?.registered || !settings().whispers) return;
    const lvl = Math.max(sanStage(s.san), corStage(s.cor), ...s.contracts.map(c => resLevel(s, c) >= 3 ? 1 : 0));
    if (!force && (lvl === 0 || rngFrom(seed + 'p')() > 0.12 + 0.13 * Math.min(lvl, 3))) return;
    const w = whisperLine(s, seed);
    const hud = document.getElementById('gs-hud');
    if (!w || !hud) return;
    hud.querySelector('.gs-whisper')?.remove();
    const el = document.createElement('div');
    el.className = 'gs-whisper';
    el.innerHTML = `<small>${esc(w.name)}</small><span>${esc(w.text)}</span>`;
    hud.appendChild(el);
    activeWhisper = el;
    setTimeout(() => el.classList.add('gs-out'), 6500);
    setTimeout(() => { el.remove(); if (activeWhisper === el) activeWhisper = null; }, 8000);
}

// ───────────────────────────── 안내 · 지도 · 관계도 (화면 전용, 토큰 0) ─────────────────────────────

const BAR_HELP = {
    hp: '체력 — 몸이 버티는 정도. 0이 되면 빈사(죽기 직전). 잠·병원으로 회복합니다.',
    san: '이성 — 정신이 버티는 정도. 괴이를 보거나 끔찍한 진실을 알면 줄어듭니다.\n75↓ 불면 · 50↓ 환각(이상한 선택지가 섞임) · 25↓ 붕괴(화면·글자가 일그러짐) · 0 광인',
    cor: '오염 — 사람이 아니게 된 정도. 권능을 쓰거나, 금기를 지키거나, 헌터 일을 하면 오릅니다.\n25·50·75%마다 영구 변이 · 100% 객성화(엔딩). 잘 줄지 않습니다.',
};
const MODE_HELP = '일상 = 쉬고 사람을 만나고 준비하는 시간 · 의뢰 = 괴이를 조사하는 중 · 전투 = 괴이와 대치 중(선택지가 나옴)';

const DISTRICTS = [
    { name: '흑수구', alias: ['흑수'], el: '水', god: '玄武', dir: '북', pos: 'n', color: '#5aa7e0', weak: '흙 · 소금 · 황토 부적',
      desc: '한강 하구와 항만, 폐쇄된 지하철역. 가장 오래되고 가장 위험한 구역. 만신회의 소란당이 수로변에 있다.',
      places: ['흑수역(폐역)', '항만 컨테이너 야적장', '소란당', '수로변 빌라촌'], foes: ['0호선 안내방송', '수문의 신부', '노크하는 컨테이너'] },
    { name: '청림구', alias: ['청림'], el: '木', god: '靑龍', dir: '동', pos: 'e', color: '#6fbf73', weak: '쇠 · 칼 · 쇠못',
      desc: '철거를 앞둔 아파트 단지와 방치된 녹지. 빈집 3,000세대 중 몇 곳에 밤마다 불이 켜진다.',
      places: ['청림 1단지', '폐업 화원 골목', '재개발 조합 사무실', '놀이터'], foes: ['13층 손님', '그네 타는 아이', '뿌리 내린 세입자'] },
    { name: '황궁구', alias: ['황궁'], el: '土', god: '黃龍', dir: '중앙', pos: 'c', color: '#d9b25c', weak: '나무 · 복숭아 목검 · 버드나무',
      desc: '구도심과 관청가. 궁궐터 아래 묘역이 겹겹이 묻혀 있다. 사천감 본청이 "문화재 관리소" 간판을 달고 있다.',
      places: ['옛 궁궐터', '문화재 관리소(사천감)', '폐쇄된 지하상가', '구청 기록실'], foes: ['행진하는 무덤', '반복되는 결재', '무너지지 않는 집'] },
    { name: '백철구', alias: ['백철'], el: '金', god: '白虎', dir: '서', pos: 'w', color: '#d8d8e0', weak: '불 · 향 · 붉은 부적',
      desc: '공단과 물류 창고, 유리 빌딩의 증권가. 흑첨이 지하 PC방 뒤에 있다.',
      places: ['백철 공단', '백철 파이낸스 타워', '24시 무인 은행', '흑첨(지하 PC방)'], foes: ['출금하는 자', '야근하는 층', '손가락 프레스'] },
    { name: '적야구', alias: ['적야'], el: '火', god: '朱雀', dir: '남', pos: 's', color: '#ff6a4a', weak: '물 · 정화수 · 빗물',
      desc: '간판이 꺼지지 않는 번화가와 유흥가, 그리고 구 끝의 시립 화장장.',
      places: ['적야 먹자골목', '지하 클럽 붉은 방', '시립 화장장', '새벽 해장국집'], foes: ['붉은 우산 여자', '웃음을 먹는 방', '굴뚝의 손님'] },
];
const districtOf = (loc) => DISTRICTS.find(d => [d.name, ...d.alias].some(a => String(loc ?? '').includes(a))) ?? null;

function mapHTML(s) {
    const here = districtOf(s.loc);
    const cell = (pos) => {
        const d = DISTRICTS.find(x => x.pos === pos);
        if (!d) return `<div class="gs-map-void"></div>`;
        return `<button type="button" class="gs-map-cell${here === d ? ' here' : ''}" data-a="dist" data-n="${d.name}" style="--c:${d.color}">
            <em>${d.el}</em><b>${d.name}</b><small>${d.god} · ${d.dir}</small>${here === d ? '<i class="gs-pin">● 현재</i>' : ''}</button>`;
    };
    return `<div class="gs-map">
        <div class="gs-map-void gs-map-river">한강 하구</div>${cell('n')}<div class="gs-map-void gs-map-river">한강</div>
        ${cell('w')}${cell('c')}${cell('e')}
        <div class="gs-map-void"></div>${cell('s')}<div class="gs-map-void"></div>
    </div>
    <div class="gs-map-info" data-o="dist">${here ? distInfo(here) : '<p class="gs-dim gs-center">구역을 누르면 정보가 보입니다.</p>'}</div>
    <p class="gs-dim">오행 상극: 쇠는 나무를, 물은 불을, 나무는 흙을, 불은 쇠를, 흙은 물을 이깁니다. 그 구역의 괴이는 구역의 기운을 띠므로, <b>약점</b> 칸의 도구가 잘 듣습니다.</p>`;
}
function distInfo(d) {
    return `<div class="gs-dist" style="--c:${d.color}">
        <div class="gs-dist-head"><em>${d.el}</em><b>${d.name}</b><small>${d.god} · ${d.dir}쪽</small></div>
        <p>${esc(d.desc)}</p>
        <p><span>장소</span>${d.places.map(esc).join(' · ')}</p>
        <p><span>소문</span>${d.foes.map(esc).join(' · ')}</p>
        <p><span>약점</span>${esc(d.weak)}</p>
        <button type="button" class="gs-btn gs-btn-sm" data-a="goto" data-n="${d.name}"><i class="fa-solid fa-person-walking"></i> 이곳으로 향한다</button>
    </div>`;
}

function webHTML(s) {
    const nodes = [];
    s.contracts.forEach((c, i, a) => nodes.push({ kind: 'star', name: c.name, sub: `공명 Lv${resLevel(s, c)}`, r: 24, a: -90 + (360 / Math.max(a.length, 1)) * i + (a.length === 1 ? 0 : 0), tone: '#a98bff' }));
    const bonds = s.bonds.slice(-10);
    bonds.forEach((b, i, a) => nodes.push({ kind: 'bond', name: b.name, sub: b.trust > 0 ? `신뢰 ${b.trust}` : b.trust < 0 ? `적의 ${-b.trust}` : '안면', r: 41, a: 90 + (360 / a.length) * i - (a.length > 1 ? 180 / a.length : 0), tone: b.trust >= 3 ? '#7fd1b9' : b.trust > 0 ? '#c9a24b' : b.trust < 0 ? '#ff7a63' : '#b8ad97', w: Math.abs(b.trust) }));
    const lines = nodes.map(n => `<i class="gs-web-line" style="width:${n.r}%;transform:rotate(${n.a}deg);border-color:${n.tone};opacity:${n.kind === 'star' ? .7 : .25 + Math.min(n.w ?? 0, 5) * .12};${n.kind === 'star' ? 'border-top-style:dashed;' : ''}"></i>`).join('');
    const dots = nodes.map(n => {
        const rad = n.a * Math.PI / 180;
        return `<div class="gs-web-node gs-web-${n.kind}" style="left:${50 + n.r * Math.cos(rad)}%;top:${50 + n.r * Math.sin(rad)}%;--t:${n.tone}"><b>${esc(n.name)}</b><small>${esc(n.sub)}</small></div>`;
    }).join('');
    return `<div class="gs-web">${lines}${dots}<div class="gs-web-node gs-web-me" style="left:50%;top:50%"><b>${esc(s.name)}</b><small>오염 ${s.cor}%</small></div></div>
    <p class="gs-dim gs-center">보라 점선 = 계약한 객성 · 실선 = 인연 (초록 깊은 신뢰 · 금색 호감 · 회색 안면 · 붉은색 적의)</p>`;
}

const GUIDE = [
    ['처음이라면', `
        <p><b>객성록</b>은 괴이(귀신·괴물)를 퇴치하는 헌터가 되어, 평범한 일상과 위험한 의뢰를 오가며 살아남는 이야기입니다. 장르를 몰라도 괜찮아요. 하고 싶은 행동을 평소처럼 쓰면 됩니다.</p>
        <ol>
            <li><b>입적</b> — 이름과 신분, 그리고 힘을 빌려줄 존재(객성)를 고릅니다.</li>
            <li><b>행동 쓰기</b> — "편의점에 간다", "소금으로 원을 그린다"처럼 자유롭게. 숫자는 확장이 알아서 계산합니다.</li>
            <li><b>매일 금기 지키기</b> — 상태창의 금기 칩(노란 점)을 누르면 오늘 지켰다고 기록됩니다.</li>
            <li><b>의뢰 받기</b> — 📋 게시판에서 의뢰를 고르면 사건이 시작됩니다.</li>
            <li><b>위험할 땐</b> — 🎲 판정으로 주사위를 굴리거나, ⚡ 권능으로 객성의 힘을 빌립니다. 대신 대가가 있어요.</li>
        </ol>
        <p class="gs-dim">이야기의 핵심: 힘을 쓰고 금기를 따를수록 강해지지만, 그만큼 사람이 아니게 됩니다. 어디까지 갈지는 당신이 정합니다.</p>`],
    ['용어 사전', `<dl class="gs-dl">
        <dt>객성(客星)</dt><dd>"손님으로 온 별". 하늘에 떠 있는, 이 세계 바깥에서 온 존재. 대가를 받고 힘을 빌려준다. 다른 작품의 '성좌'와 비슷하다.</dd>
        <dt>괴이(怪異)</dt><dd>객성의 빛을 받아 변한 귀신·괴물. 반드시 <b>규칙</b>(어기면 위험)과 <b>약점</b>이 있다.</dd>
        <dt>계약 · 가계약 · 공명</dt><dd>객성과 맺은 약속. 처음엔 가계약(힘이 약함) → 금기를 한 번 지키면 성립 → 계속 지키면 공명 레벨이 올라 강해진다.</dd>
        <dt>권능</dt><dd>객성에게 빌린 초능력. 쓰면 오염이 오른다.</dd>
        <dt>금기 · 저주</dt><dd>계약의 대가로 매일 해야 하는 기묘한 행동. 안 하면 다음 날 저주(불이익)가 내린다.</dd>
        <dt>오염 · 변이</dt><dd>사람에서 멀어진 정도. 쌓이면 몸에 영구적인 변이가 생긴다.</dd>
        <dt>이성 · 광기</dt><dd>정신력. 낮아지면 환청이 들리고 이상한 선택지가 섞인다.</dd>
        <dt>오행 · 상극</dt><dd>나무·불·흙·쇠·물 다섯 기운. 쇠>나무, 물>불, 나무>흙, 불>쇠, 흙>물 순으로 이긴다.</dd>
        <dt>사천감</dt><dd>괴이를 숨기고 처리하는 정부 비밀 부서. 안정적이지만 계약자를 감시한다.</dd>
        <dt>만신회</dt><dd>무당 조합. 오염을 씻는 굿을 해 준다(비싸고 아프다).</dd>
        <dt>흑첨</dt><dd>불법 의뢰 중개소. 돈은 많이 주지만 위험하다.</dd>
        <dt>개안회</dt><dd>객성을 숭배하는 적대 단체. 오염된 계약자를 포섭하려 한다.</dd>
    </dl>`],
    ['상태 읽는 법', `
        <p><b>體 체력</b> 몸. 0이면 빈사 — 객성의 손을 잡으면 살아나지만 오염이 크게 오른다.</p>
        <p><b>心 이성</b> 정신. <span class="gs-dim">75↓ 불면 · 50↓ 환각 · 25↓ 붕괴 · 0 광인</span></p>
        <p><b>汚 오염</b> 인간에서 멀어진 정도. <span class="gs-dim">25 · 50 · 75%마다 변이 · 100% 객성화</span></p>
        <p><b>금기 칩</b> <span class="gs-dim">노란 점 = 오늘 아직 안 지킴 · 초록 = 지킴 · 빨강 = 어김 · Lv = 공명 단계</span></p>
        <p><b>오염이 오르는 때</b> <span class="gs-dim">권능 사용(약 +4 · 중 +10 · 강 +22) · 금기 이행(+2) · 의뢰 종료(+3) · 괴이 소멸(+2) · 이야기 속 사건</span></p>
        <p><b>회복</b> <span class="gs-dim">잠(체력·이성) · 병원(체력) · 사람과의 대화(이성) · 굿과 정화(오염, 대가 있음)</span></p>
        <p><b>판정</b> <span class="gs-dim">주사위 1~100. 목표 이하면 성공, 목표의 1/5 이하는 대성공, 96 이상은 대실패. 다치거나 미치면 목표가 낮아지고, 오염될수록 주술은 잘 듣는다.</span></p>`],
    ['진행 팁', `
        <ul>
            <li>막히면 📋 의뢰 게시판을 열어 보세요. 의뢰가 없으면 이웃이나 단골집에 가 보는 것도 좋아요.</li>
            <li>괴이를 만나면 바로 싸우기보다 <b>규칙</b>을 먼저 알아내세요. 단서는 항상 미리 깔려 있습니다.</li>
            <li>시트 › 지도에서 구역별 약점 도구를 확인하고, 소지품 탭 상점에서 미리 사 두세요.</li>
            <li>금기는 귀찮아도 지키는 게 대개 낫습니다. 다만 너무 깊이 따르면… 그것도 대가입니다.</li>
            <li>상태가 이상하면 해당 AI 메시지를 수정하거나 스와이프하세요. 수치가 자동으로 다시 계산됩니다.</li>
            <li>모바일에서는 상태창의 이름을 누르면 한 줄로 접힙니다.</li>
        </ul>`],
];
function guideHTML(start = 0) {
    return `<div class="gs-guide">
        <div class="gs-tabs gs-tabs-guide">${GUIDE.map(([n], i) => `<button type="button" data-g="${i}" class="${i === start ? 'on' : ''}">${n}</button>`).join('')}</div>
        ${GUIDE.map(([, body], i) => `<div class="gs-guide-p${i === start ? '' : ' gs-hidden'}" data-gp="${i}">${body}</div>`).join('')}
    </div>`;
}
function bindGuide(root) {
    root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-g]');
        if (!b) return;
        const box = b.closest('.gs-guide');
        box.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b));
        box.querySelectorAll('[data-gp]').forEach(p => p.classList.toggle('gs-hidden', p.dataset.gp !== b.dataset.g));
    });
}
async function openGuide(start = 0) {
    const el = h(`<div class="gs-root gs-pop"><h3 class="gs-title">案內 · 안내</h3>${guideHTML(start)}</div>`);
    bindGuide(el);
    await popup(el, { okButton: '닫기' });
}

// ───────────────────────────── 상태 시트 ─────────────────────────────

async function openSheetTab(tab) {
    const p = openSheet();
    setTimeout(() => document.querySelector(`dialog [data-tab="${tab}"]`)?.click(), 60);
    return p;
}

async function openSheet() {
    if (!isActive()) return toastr.info('객성록 카드가 열린 채팅에서만 사용할 수 있습니다.', '객성록');
    const s = current?.state;
    if (!s?.registered) return openRegister();
    const ss = sanStage(s.san), cs = corStage(s.cor);
    const tabs = [['stat', '상태'], ['pact', '계약'], ['inv', '소지품'], ['map', '지도'], ['web', '관계'], ['body', '변이·광기'], ['log', '기록'], ['help', '안내'], ['admin', '관리']];
    const el = h(`<div class="gs-root gs-pop gs-sheet">
        <div class="gs-sheet-head">
            <div class="gs-seal">${esc(s.name.slice(0, 1))}</div>
            <div><h3>${esc(s.name)}</h3><small>${esc(s.rank)}${s.background ? ` · ${esc(s.background)}` : ''}</small><small>${s.day}일차 ${esc(s.time)} · ${esc(s.loc || '—')} · ${won(s.cash)}</small></div>
        </div>
        <div class="gs-tabs">${tabs.map(([k, n], i) => `<button type="button" data-tab="${k}" class="${i === 0 ? 'on' : ''}">${n}</button>`).join('')}</div>
        <section data-p="stat">
            <div class="gs-bars">${bar('hp', '체력', s.hp, 100, s.hp <= 30 ? '중상' : '')}${bar('san', '이성', s.san, 100, SAN_STAGE_NAME[ss])}${bar('cor', '오염', s.cor, 100, COR_STAGE_NAME[cs])}</div>
            <p class="gs-dim">이성 ${SAN_STAGE_NAME[ss]} — ${esc(STAGE_DIRECTIVE.san[ss].replace(/^.*?:\s*/, '') || '아직 버틸 만하다.')}</p>
            <p class="gs-dim">오염 ${COR_STAGE_NAME[cs]} — ${esc(STAGE_DIRECTIVE.cor[cs].replace(/^.*?:\s*/, '') || '아직 사람이다.')}</p>
            ${s.case ? `<p><b>의뢰</b> ${esc(s.case)}</p>` : ''}
            ${s.foe ? `<p><b>대치</b> ${esc(s.foe.name)} — ${s.foe.pct}% ${esc(s.foe.note)}</p>` : ''}
            ${s.curses.length ? `<p><b>저주</b> ${s.curses.map(c => esc(c.text) + (c.until ? ` (~${c.until}일차)` : '')).join(' / ')}</p>` : ''}
            <details class="gs-edit"><summary>수치 직접 고치기</summary>
                <div class="gs-form-grid">
                    ${[['hp', '체력', s.hp], ['san', '이성', s.san], ['cor', '오염', s.cor], ['cash', '자금', s.cash], ['day', '일차', s.day]].map(([k, n, v]) => `<label>${n}<input type="number" class="text_pole" data-e="${k}" value="${v}"></label>`).join('')}
                    <label>시간대<select class="text_pole" data-e="time">${TIMES.map(t => `<option ${t === s.time ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                    <label>모드<select class="text_pole" data-e="mode">${Object.keys(MODES).map(t => `<option ${t === s.mode ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
                    <label class="gs-wide">장소<input class="text_pole" data-e="loc" value="${esc(s.loc)}"></label>
                    <label class="gs-wide">신분<input class="text_pole" data-e="rank" value="${esc(s.rank)}"></label>
                    <button type="button" class="gs-btn gs-btn-red" data-a="apply">적용</button>
                </div>
                <p class="gs-dim">일차를 늘리면 그 사이 지키지 않은 금기의 저주가 내려진다.</p>
            </details>
        </section>
        <section data-p="pact" class="gs-hidden">
            ${s.contracts.map(c => {
                const t = s.taboo[c.name] ?? { kept: [], broke: [] };
                const days = Array.from({ length: Math.min(s.day, 14) }, (_, k) => s.day - Math.min(s.day, 14) + 1 + k)
                    .map(d => `<i class="${t.kept.includes(d) ? 'k' : t.broke.includes(d) ? 'b' : d === s.day ? 'p' : 'b'}" title="${d}일차"></i>`).join('');
                return `<div class="gs-pact" data-el="${esc(c.element)}">
                    <div class="gs-pact-head"><b>${esc(c.name)}</b><small>${esc(c.hanja || '')} · ${esc(c.element)} · 공명 Lv${resLevel(s, c)} ${RES_NAME[resLevel(s, c)]} (이행 ${t.kept.length}회${resLevel(s, c) < 5 ? ` / 다음 ${RES_AT[resLevel(s, c)]}회` : ''})</small>
                        <button type="button" class="gs-btn gs-btn-sm" data-a="break" data-n="${esc(c.name)}">파기</button></div>
                    <p><span>권능</span>${esc(c.power)}</p><p><span>금기</span>${esc(c.taboo)}</p>
                    <p><span>저주</span>${esc(c.curse)}</p><p><span>증상</span>${esc(c.symptom)}</p><p><span>목소리</span>${esc(c.voice)}</p>
                    <div class="gs-days">${days}</div></div>`;
            }).join('')}
            <button type="button" class="gs-btn" data-a="addpact"><i class="fa-solid fa-plus"></i> 새 객성과 계약 (오염 +5)</button>
            <p class="gs-dim">금기를 지킬 때마다 오염 +2, 공명이 쌓인다. 첫 이행으로 계약이 성립하고(그전엔 권능 약만 가능), 공명이 오를수록 권능과 주술 판정이 강해지는 대신 이성 −3. 계약이 늘수록 매일 지켜야 할 금기도 는다. 파기에는 이성 −15, 오염 +15의 대가가 따른다.</p>
        </section>
        <section data-p="body" class="gs-hidden">
            <h4 class="gs-sub">변이 (영구)</h4>
            ${s.mutations.length ? s.mutations.map(m => `<div class="gs-item"><b>變 ${esc(m.name)}</b><span>${esc(m.desc)}</span><button type="button" class="gs-x" data-a="rm" data-k="mutation" data-n="${esc(m.name)}">×</button></div>`).join('') : '<p class="gs-dim">아직 몸은 사람의 것이다.</p>'}
            <h4 class="gs-sub">광기</h4>
            ${s.madness.length ? s.madness.map(m => `<div class="gs-item"><b>狂 ${esc(m.name)}</b><span>${esc(m.desc)}</span><button type="button" class="gs-x" data-a="rm" data-k="madness" data-n="${esc(m.name)}">×</button></div>`).join('') : '<p class="gs-dim">아직 정신은 제자리에 있다.</p>'}
            <p class="gs-dim">오염 25·50·75%를 넘을 때마다 변이가, 이성 50·25 이하로 떨어질 때 광기가 하나씩 새겨진다.</p>
        </section>
        <section data-p="map" class="gs-hidden">${mapHTML(s)}</section>
        <section data-p="help" class="gs-hidden">${guideHTML(0)}</section>
        <section data-p="web" class="gs-hidden">
            ${webHTML(s)}
            <h4 class="gs-sub">인연</h4>
            ${s.bonds.length ? s.bonds.map(b => `<div class="gs-item"><b>緣 ${esc(b.name)}</b><span>${'●'.repeat(Math.max(0, b.trust))}${'○'.repeat(Math.max(0, 5 - Math.max(0, b.trust)))}${b.trust < 0 ? ` 적의 ${-b.trust}` : ''} ${esc(b.note)}</span>
                <span class="gs-mini"><button type="button" data-a="bond" data-n="${esc(b.name)}" data-v="-1">−</button><button type="button" data-a="bond" data-n="${esc(b.name)}" data-v="+1">+</button></span></div>`).join('') : '<p class="gs-dim">아직 이름을 아는 사람이 없다. 일상에서 만난 사람들이 여기에 남는다.</p>'}
            <p class="gs-dim">이야기 속에서 이름을 알게 된 사람이 자동으로 추가됩니다. ± 버튼으로 직접 고칠 수도 있어요. 가까운 사람을 잃으면 이성이 크게 깎입니다.</p>
        </section>
        <section data-p="inv" class="gs-hidden">
            <h4 class="gs-sub">소지품 · ${won(s.cash)}</h4>
            ${s.items.length ? s.items.map(i => `<div class="gs-item"><b>${esc(i.name)}</b><span>×${i.qty}</span>
                <span class="gs-mini"><button type="button" data-a="use" data-n="${esc(i.name)}" title="하나 쓰기">−</button><button type="button" data-a="addone" data-n="${esc(i.name)}" title="하나 추가">+</button></span></div>`).join('') : '<p class="gs-dim">빈손이다.</p>'}
            <h4 class="gs-sub">만신회 · 흑첨 상점</h4>
            ${shopHTML(s)}
            <p class="gs-dim">"−"는 하나를 쓰고 입력창에 태그 없이 기록만 남깁니다. 구입하면 자금이 바로 빠집니다.</p>
        </section>
        <section data-p="log" class="gs-hidden">
            <div class="gs-log">${s.log.slice().reverse().map(l => `<div><span>${l.day}일차</span>${esc(l.text)}</div>`).join('')}</div>
        </section>
        <section data-p="admin" class="gs-hidden">
            <button type="button" class="gs-btn" data-a="undo"><i class="fa-solid fa-rotate-left"></i> 마지막 수동 조정 되돌리기</button>
            <button type="button" class="gs-btn" data-a="editprof"><i class="fa-solid fa-pen"></i> 프로필·첫 계약 수정</button>
            <button type="button" class="gs-btn gs-btn-red" data-a="reset"><i class="fa-solid fa-skull"></i> 이 채팅의 객성록 초기화</button>
            <p class="gs-dim">수동 조정 ${getMeta()?.adjust?.length ?? 0}건 · AI 응답의 상태 변화는 메시지를 수정·삭제·스와이프하면 자동으로 다시 계산됩니다.</p>
        </section>
    </div>`);
    bindGuide(el);
    const close = () => el.closest('dialog')?.querySelector('.popup-button-ok')?.click();
    el.addEventListener('click', async (e) => {
        const tab = e.target.closest('[data-tab]');
        if (tab) {
            el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === tab));
            el.querySelectorAll('section[data-p]').forEach(p => p.classList.toggle('gs-hidden', p.dataset.p !== tab.dataset.tab));
            return;
        }
        const b = e.target.closest('[data-a]');
        if (!b) return;
        const a = b.dataset.a;
        const { Popup, POPUP_RESULT } = ctx();
        if (a === 'apply') {
            const ops = [];
            for (const k of ['hp', 'san', 'cor', 'cash', 'day']) {
                const v = Number(el.querySelector(`[data-e="${k}"]`).value);
                if (!Number.isNaN(v) && v !== s[k]) ops.push([k, String(v)]);
            }
            for (const k of ['time', 'mode', 'loc', 'rank']) {
                const v = el.querySelector(`[data-e="${k}"]`).value.trim();
                if (v && v !== s[k]) ops.push([k, v]);
            }
            if (!ops.length) return toastr.info('바뀐 값이 없다.');
            await addAdjust(ops, '수동 조정');
            close(); toastr.success('적용했다.', '객성록');
        }
        if (a === 'break') {
            const r = await Popup.show.confirm(`계약 파기 — ${b.dataset.n}`, '이성 −15, 오염 +15. 객성은 떠나면서도 무언가를 가져간다.');
            if (r !== POPUP_RESULT.AFFIRMATIVE) return;
            await addAdjust([['_break', b.dataset.n], ['san', '-15'], ['cor', '+15']], '');
            close();
        }
        if (a === 'addpact') { close(); setTimeout(openAddContract, 200); }
        if (a === 'rm') { await addAdjust([[b.dataset.k, `-${b.dataset.n}`]], `${b.dataset.k === 'mutation' ? '변이' : '광기'} 제거 — ${b.dataset.n}`); close(); }
        if (a === 'bond') { await addAdjust([['bond', `${b.dataset.n} ${b.dataset.v}`]], ''); close(); setTimeout(openSheet, 200); }
        if (a === 'dist') {
            const d = DISTRICTS.find(x => x.name === b.dataset.n);
            el.querySelector('[data-o="dist"]').innerHTML = distInfo(d);
            el.querySelectorAll('.gs-map-cell').forEach(c => c.classList.toggle('sel', c === b));
            return;
        }
        if (a === 'goto') { insertInput(`(${b.dataset.n}(으)로 향한다.) `, false, 'replace'); close(); return; }
        if (a === 'buy') {
            const x = SHOP[Number(b.dataset.i)];
            if (s.cash < x.price) return toastr.warning('돈이 모자라다.', '객성록');
            await addAdjust([['cash', `-${x.price}`], ['item', `+${x.name} ${x.qty}`]], `구입 — ${x.name}${x.qty > 1 ? ` ×${x.qty}` : ''}`);
            toastr.success(`${esc(x.name)} 구입`, '객성록'); close(); setTimeout(() => openSheetTab('inv'), 200); return;
        }
        if (a === 'use' || a === 'addone') {
            await addAdjust([['item', `${a === 'use' ? '-' : '+'}${b.dataset.n} 1`]], `${a === 'use' ? '사용' : '추가'} — ${b.dataset.n}`);
            close(); setTimeout(() => openSheetTab('inv'), 200); return;
        }
        if (a === 'undo') {
            const m = getMeta();
            if (!m?.adjust?.length) return toastr.info('되돌릴 조정이 없다.');
            const last = m.adjust.sort((x, y) => x.t - y.t).pop();
            await saveMeta(); refreshNow(); close();
            toastr.info(`되돌렸다: ${esc(last.label || last.ops.map(o => o.join(' ')).join(', '))}`, '객성록');
        }
        if (a === 'editprof') { close(); setTimeout(() => openRegister(true), 200); }
        if (a === 'reset') {
            const r = await Popup.show.confirm('객성록 초기화', '이 채팅의 프로필·계약·수동 조정 기록이 모두 지워집니다. AI 메시지는 남습니다.');
            if (r !== POPUP_RESULT.AFFIRMATIVE) return;
            const m = getMeta(true); m.profile = null; m.adjust = [];
            await saveMeta(true); refreshNow(); close();
        }
    });
    await popup(el, { okButton: '닫기' });
}

async function openAddContract() {
    const el = h(`<div class="gs-root gs-pop">
        <h3 class="gs-title">再契 · 새 계약</h3>
        <div class="gs-contract-pick">${CONTRACTS.filter(k => !current.state.contracts.some(c => c.name === k.name)).map(k => `<label class="gs-ccard" data-el="${k.element}">
            <input type="radio" name="gs-nc" value="${k.id}"><div><b>${esc(k.name)}</b><small>${k.element}</small></div><p><span>금기</span>${esc(k.taboo)}</p></label>`).join('')}
            <label class="gs-ccard gs-ccard-custom"><input type="radio" name="gs-nc" value="custom" checked><div><b>직접 만들기</b></div></label></div>
        ${contractFormHTML('n_')}
    </div>`);
    el.addEventListener('click', (e) => { const g = e.target.closest('[data-gen]'); if (g) aiContract(el, g.dataset.gen, g); });
    const { POPUP_RESULT } = ctx();
    const r = await popup(el, { okButton: '계약한다', cancelButton: '그만둔다' });
    if (r !== POPUP_RESULT.AFFIRMATIVE) return;
    const v = el.querySelector('input[name="gs-nc"]:checked')?.value;
    const c = v === 'custom' ? readContract(el, 'n_') : clone(CONTRACTS.find(k => k.id === v));
    if (!c.name || !c.taboo) return toastr.warning('이름과 금기는 반드시 있어야 한다.', '객성록');
    c.curse ||= '하루 동안 그림자가 당신을 따르지 않는다.';
    await addAdjust([['_contract', JSON.stringify(c)], ['cor', '+5']], '');
    insertInput(`(${c.name}과(와) 새로 계약한다.) `);
}

// ───────────────────────────── 설정 패널 ─────────────────────────────

function renderSettings() {
    if (document.getElementById('gs-settings')) return;
    const s = settings();
    const opt = (k, v, label) => `<option value="${v}" ${s[k] === v ? 'selected' : ''}>${label}</option>`;
    const el = h(`<div id="gs-settings" class="gs-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header"><b>객성록 HUD</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
            <div class="inline-drawer-content">
                <label class="checkbox_label"><input type="checkbox" data-s="enabled" ${s.enabled ? 'checked' : ''}> 사용</label>
                <label class="checkbox_label"><input type="checkbox" data-s="allCharacters" ${s.allCharacters ? 'checked' : ''}> 모든 캐릭터에서 사용 (기본: 객성록 카드에서만)</label>
                <label class="checkbox_label"><input type="checkbox" data-s="autoRegister" ${s.autoRegister ? 'checked' : ''}> 입적하지 않은 채팅을 열면 입적 창 자동 열기</label>
                <label class="checkbox_label"><input type="checkbox" data-s="glitch" ${s.glitch ? 'checked' : ''}> 이성·오염 연출 효과 (화면 일렁임, 붉은 비네트)</label>
                <label class="checkbox_label"><input type="checkbox" data-s="whispers" ${s.whispers ? 'checked' : ''}> 객성의 속삭임 (이성·오염이 오르면 HUD에 대사가 스친다, 토큰 0)</label>
                <label class="checkbox_label"><input type="checkbox" data-s="zalgo" ${s.zalgo ? 'checked' : ''}> 이성 25 이하에서 최신 응답 글자 일그러뜨리기 (표시만)</label>
                <label>메시지 상태 카드<select class="text_pole" data-s="msgCard">${opt('msgCard', 'compact', '간단 (변동 칩)')}${opt('msgCard', 'full', '최신 응답은 게이지까지')}${opt('msgCard', 'off', '숨기기')}</select></label>
                <label>선택지<select class="text_pole" data-s="choices">${opt('choices', 'tense', '의뢰·전투 중에만')}${opt('choices', 'always', '항상')}${opt('choices', 'off', '쓰지 않음')}</select></label>
                <label>선택지를 누르면<select class="text_pole" data-s="choiceClick">${opt('choiceClick', 'fill', '입력창에 넣기')}${opt('choiceClick', 'send', '바로 보내기')}</select></label>
                <label>상태 주입 깊이 (0 = 맨 마지막)<input type="number" min="0" max="20" class="text_pole" data-s="injectDepth" value="${s.injectDepth}"></label>
                <div class="gs-set-btns">
                    <button class="menu_button" data-s-act="sheet">상태 시트</button>
                    <button class="menu_button" data-s-act="register">입적 창</button>
                    <button class="menu_button" data-s-act="preview">주입 프롬프트 보기</button>
                </div>
            </div>
        </div></div>`);
    el.addEventListener('change', (e) => {
        const k = e.target.dataset.s;
        if (!k) return;
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        settings()[k] = v;
        saveSettings();
        refreshNow();
    });
    el.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-s-act]')?.dataset.sAct;
        if (a === 'sheet') openSheet();
        if (a === 'register') openRegister(!!getMeta()?.profile);
        if (a === 'preview') {
            const txt = current ? ctx().substituteParams(buildInjection(current.state)) : '(객성록이 활성화된 채팅이 아닙니다)';
            const pre = document.createElement('pre');
            pre.className = 'gs-pre';
            pre.textContent = txt;
            popup(pre);
        }
    });
    document.getElementById('extensions_settings2')?.appendChild(el);
}

// ───────────────────────────── 슬래시 커맨드 ─────────────────────────────

function registerCommands() {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, SlashCommandNamedArgument, ARGUMENT_TYPE } = ctx();
    if (!SlashCommandParser?.addCommandObject) return;
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'gs-sheet', callback: () => { openSheet(); return ''; },
        helpString: '객성록 상태 시트를 연다.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'gs-board', callback: () => { openBoard(); return ''; },
        helpString: '객성록 의뢰 게시판을 연다.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'gs-new', callback: () => { openRegister(!!getMeta()?.profile); return ''; },
        helpString: '객성록 입적(캐릭터 생성) 창을 연다. 이미 입적했다면 수정 창.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'gs-roll',
        callback: (_n, type) => {
            const t = ROLL_TYPES.find(x => x.name === String(type ?? '').trim() || x.id === String(type ?? '').trim());
            openRoll(t?.id);
            return '';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '판정 종류 (육체/감지/주술/정신/교섭/은신)', typeList: ARGUMENT_TYPE.STRING, isRequired: false })],
        helpString: '객성록 판정 창을 연다. 예: /gs-roll 주술',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'gs-set',
        callback: async (named, text) => {
            if (!current?.state?.registered) return '';
            const key = String(named.key ?? '').trim();
            if (!key || !KEYMAP[key.toLowerCase()]) { toastr.warning('key가 올바르지 않습니다. 예: /gs-set key=san -5'); return ''; }
            await addAdjust([[key, String(text ?? '')]], `수동 조정 — ${key} ${text}`);
            return '';
        },
        namedArgumentList: [SlashCommandNamedArgument.fromProps({ name: 'key', description: 'hp, san, cor, cash, day, time, loc, mode, case, foe, taboo, curse, mutation, bond', typeList: ARGUMENT_TYPE.STRING, isRequired: true })],
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '값 (+/- 부호는 증감, 없으면 그 값으로 설정)', typeList: ARGUMENT_TYPE.STRING, isRequired: true })],
        helpString: '객성록 상태를 직접 조정한다. 예: /gs-set key=cor +10',
    }));
}

// ───────────────────────────── 이벤트 ─────────────────────────────

let autoOpened = new Set();

function onChatChanged() {
    lastNotified = '';
    hudPrev = null;
    refreshNow();
    const id = ctx().getCurrentChatId?.();
    if (isActive() && settings().autoRegister && !getMeta()?.profile && id && !autoOpened.has(id)) {
        autoOpened.add(id);
        setTimeout(() => { if (isActive() && !getMeta()?.profile) openRegister(); }, 900);
    }
}

function onBeforeGenerate(type, _opts, dryRun) {
    if (dryRun || !isActive()) return;
    const chat = ctx().chat ?? [];
    let limit = chat.length;
    const last = chat[chat.length - 1];
    if ((type === 'swipe' || type === 'regenerate') && last && !last.is_user) limit = chat.length - 1;
    try {
        const r = compute(limit);
        setInjection(buildInjection(r.state));
    } catch (e) { console.error(LOG, e); }
}

function onRendered() {
    refreshNow();
    notifyLatest();
}

function init() {
    const { eventSource, event_types: E } = ctx();
    settings();
    renderSettings();
    registerCommands();
    const on = (name, fn) => { if (E[name]) eventSource.on(E[name], fn); };
    on('CHAT_CHANGED', onChatChanged);
    on('GENERATION_AFTER_COMMANDS', onBeforeGenerate);
    on('CHARACTER_MESSAGE_RENDERED', onRendered);
    on('USER_MESSAGE_RENDERED', refresh);
    on('MESSAGE_RECEIVED', refresh);
    on('MESSAGE_EDITED', refresh);
    on('MESSAGE_UPDATED', refresh);
    on('MESSAGE_DELETED', refresh);
    on('MESSAGE_SWIPED', refresh);
    on('MORE_MESSAGES_LOADED', refresh);
    on('GENERATION_ENDED', refresh);
    on('GENERATION_STOPPED', refresh);
    on('CHARACTER_EDITED', refresh);
    refreshNow();
    console.log(LOG, 'loaded');
}

const { eventSource: _es, event_types: _et } = SillyTavern.getContext();
_es.on(_et.APP_READY, init);

// test hook (Node harness only)
if (globalThis.__GS_TEST__) globalThis.__GS_TEST__.api = { compute, extractOps, applyOp, freshState, buildInjection, parseNum, CONTRACTS };
