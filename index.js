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
        { name: '검은 실핏줄', desc: '손목 아래로 먹물 같은 혈관이 번진다. 부적 없이도 잡귀의 기척을 느낀다.' },
        { name: '늦는 그림자', desc: '그림자가 반 박자 늦게 움직인다. 가끔 먼저 움직인다.' },
        { name: '녹슨 혀', desc: '입안에 늘 쇠 맛. 거짓말을 하면 잇몸에서 피가 난다.' },
        { name: '물비린내', desc: '씻어도 몸에서 강물 냄새가 난다. 개와 고양이가 피한다.' },
        { name: '문신의 맥박', desc: '피부 아래로 계약 문양이 떠오르고, 괴이가 가까우면 꿈틀거린다.' },
    ],
    2: [
        { name: '세 번째 눈꺼풀', desc: '눈을 감아도 보인다. 그래서 잠들기 어렵다.' },
        { name: '이명의 합창', desc: '가끔 타인의 속마음이 라디오 잡음처럼 들린다. 원하지 않아도.' },
        { name: '옆구리 비늘', desc: '옆구리에 검은 비늘이 돋았다. 칼날을 반쯤은 막아 준다.' },
        { name: '이름 하나의 망각', desc: '가까운 사람 하나의 이름이 머릿속에서 지워졌다. 얼굴은 기억난다.' },
        { name: '체온 상실', desc: '몸이 늘 시체처럼 차갑다. 악수한 사람이 손을 뺀다.' },
    ],
    3: [
        { name: '두 번째 입', desc: '쇄골 아래에 입이 생겼다. 밤마다 객성의 말을 대신 속삭인다.' },
        { name: '빛의 거부', desc: '햇빛 아래에서 피부가 그을린다. 대신 밤에는 비정상적으로 강하다.' },
        { name: '비치지 않음', desc: '거울과 사진에 더 이상 제대로 비치지 않는다. 일그러진 얼룩만 남는다.' },
        { name: '재의 맛', desc: '음식이 모두 재 맛이다. 향 연기만이 배를 채운다.' },
        { name: '인간 아닌 걸음', desc: '관절이 하나 더 생긴 듯 걷는다. 보는 사람이 본능적으로 뒷걸음친다.' },
    ],
};
const MADNESS = {
    2: [
        { name: '확인 강박', desc: '문과 창을 세 번씩 확인하지 않으면 견딜 수 없다.' },
        { name: '웃는 얼굴 공포', desc: '웃는 얼굴 뒤에 다른 얼굴이 겹쳐 보인다.' },
        { name: '부르는 목소리', desc: '누군가 계속 이름을 부른다. 돌아보면 아무도 없다.' },
        { name: '숫자 집착', desc: '모든 것을 센다. 계단, 형광등, 상대의 이빨.' },
    ],
    3: [
        { name: '해리', desc: '가끔 자신을 등 뒤에서 내려다본다. 몸이 남의 것 같다.' },
        { name: '객성 신앙', desc: '객성의 목소리가 위로처럼 들리기 시작했다. 위험한 징조다.' },
        { name: '현실 불신', desc: '지금 이 장면이 진짜인지 확신할 수 없다. 모든 사람을 시험하고 싶다.' },
        { name: '피의 갈망', desc: '피 냄새가 달다. 그 사실이 무섭다.' },
    ],
};

const STAGE_DIRECTIVE = {
    san: [
        '',
        '이성 ⟦이성1⟧ 불면: 잠이 얕고 사소한 착시가 생긴다. 소리가 반 박자 늦게 들린다.',
        '이성 ⟦이성2⟧ 환각: 환각이 현실에 섞인다. 진짜와 가짜를 서술로 구분해 주지 않는다.',
        '이성 ⟦이성3⟧ 붕괴: 서술 자체가 불안정하다 — 문장이 되풀이되고, 아는 얼굴이 다른 얼굴로 보이며, 객성의 목소리가 본문에 끼어든다.',
        '이성 ⟦광인⟧ 0: {{user}}는 광기에 삼켜졌다. 광인 엔딩으로 서사를 마무리하거나, 객성이 마지막 거래를 제안한다.',
    ],
    cor: [
        '',
        '오염 ⟦오염1⟧ 흔적: 몸에 첫 흔적이 남았다. 동물과 아이가 {{user}}를 피한다.',
        '오염 ⟦오염2⟧ 이물: 괴이가 {{user}}를 동족으로 착각한다. 사람들은 이유 없이 거리를 둔다. 권능이 너무 쉽게 흘러나온다.',
        '오염 ⟦오염3⟧ 인외: 인간보다 괴이에 가깝다. 거울·사진·사람들의 반응이 그것을 증명한다. 사천감은 {{user}}를 처분 검토 대상으로 본다.',
        '오염 ⟦객성화⟧ 100%: {{user}}는 객성의 일부가 되었다. 객성화 엔딩으로 서사를 마무리한다.',
    ],
};

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
        log: [], corPeak: 0, sanPeak: 0, revived: 0, rerollDay: 0,
    };
    if (!profile) return s;
    Object.assign(s, {
        registered: true,
        name: profile.name, rank: profile.rank, background: profile.background, story: profile.story ?? '',
        hp: profile.hp ?? 100, san: profile.san ?? 80, cor: profile.cor ?? 5, cash: profile.cash ?? 0,
        loc: profile.loc ?? '', time: profile.time ?? '자정',
    });
    s.contracts = clone(profile.contracts ?? []);
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
const NONE_RE = /^(없음|없다|-|—|none|null|해결|완료|종료|퇴치|소멸|사라짐)\b/i;

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

function advanceDays(s, nd, info) {
    for (let d = s.day; d < nd; d++) {
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
        case 'time': if (val) s.time = normTime(val); break;
        case 'loc': if (val && !NONE_RE.test(val)) s.loc = val; break;
        case 'rank': if (val) s.rank = val; break;
        case 'mode': if (val) { s.mode = normMode(val); if (s.mode === '일상') s.foe = null; } break;
        case 'case': s.case = (!val || NONE_RE.test(val)) ? '' : val; break;
        case 'foe': {
            if (!val || NONE_RE.test(val)) { s.foe = null; break; }
            const [name, pct, ...rest] = val.split('|').map(x => x.trim());
            const prev = s.foe && s.foe.name === name ? s.foe : null;
            const p = pct !== undefined && pct !== '' ? clamp(Math.round(parseNum(pct, prev?.pct ?? 100)), 0, 100) : (prev?.pct ?? 100);
            s.foe = { name: name || prev?.name || '이름 모를 것', pct: p, note: rest.join(' | ') || prev?.note || '' };
            if (p <= 0) s.log.push({ day: s.day, text: `「${s.foe.name}」 소멸` });
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
                    t.kept.push(s.day);
                    info.events.push({ type: 'keep', text: `금기 이행 · ${c.name}` });
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
        const info = { seed: `${seed}:adj:${a.t}`, events: [] };
        const hp0 = s.hp;
        for (const [k, v] of a.ops) applyOp(s, k, v, info);
        if (hp0 > 0 && s.hp <= 0) info.events.push({ type: 'end', text: '체력 0 · 빈사 — 객성이 손을 내민다' });
        if (a.label) s.log.push({ day: s.day, text: a.label });
        adjEvents.set(a.t, info.events);
    };
    for (let i = 0; i < n; i++) {
        while (ai < adj.length && adj[ai].at <= i) runAdjust(adj[ai++]);
        const m = chat[i];
        if (!m || m.is_user || m.is_system) continue;
        const ops = extractOps(m.mes);
        if (!ops.length) continue;
        const prev = clone(s);
        const info = { seed: `${seed}:${i}`, events: [] };
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
    const today = t?.kept.includes(s.day) ? '이행함' : t?.broke.includes(s.day) ? '어김' : '아직 미이행';
    return `- ${c.name}(${c.element}) | 권능: ${c.power} | 금기: ${c.taboo} | 오늘: ${today}`;
}

function buildInjection(s) {
    const set = settings();
    if (!s.registered) {
        return '[객성록 시스템] {{user}}는 아직 입적(캐릭터 생성)을 마치지 않았다. 오프닝의 긴장을 유지하되 계약이 성립하는 순간 직전에서 멈춘다. <state> 블록은 쓰지 않는다.';
    }
    const ss = sanStage(s.san), cs = corStage(s.cor);
    const L = [];
    L.push('[객성록 시스템 · 현재 상태 — 이 값이 유일한 진실이다. 스스로 다시 계산하지 말 것]');
    L.push(`{{user}}: ${s.name} · ${s.rank}${s.background ? ` · ${s.background}` : ''} | ${s.day}일차 ${s.time} | ${s.loc || '장소 미정'} | 모드 ⟦모드:${s.mode}⟧`);
    if (s.story) L.push(`사연: ${s.story}`);
    L.push(`체력 ${s.hp}/100${s.hp <= 0 ? ' ⟦빈사⟧' : s.hp <= 30 ? ' (중상: 움직임이 둔하다)' : ''} · 이성 ${s.san}/100 (${SAN_STAGE_NAME[ss]}) · 오염 ${s.cor}% (${COR_STAGE_NAME[cs]}) · 자금 ${won(s.cash)}`);
    if (s.contracts.length) { L.push('계약:'); for (const c of s.contracts) L.push(contractLine(s, c)); }
    if (s.curses.length) L.push(`저주: ${s.curses.map(c => c.text + (c.until ? `(${c.until}일차까지)` : '')).join(' / ')}`);
    if (s.mutations.length) L.push(`변이(영구): ${s.mutations.map(m => `${m.name}${m.desc ? `—${m.desc}` : ''}`).join(' / ')}`);
    if (s.madness.length) L.push(`광기: ${s.madness.map(m => m.name).join(', ')}`);
    if (s.case) L.push(`진행 중 의뢰: ${s.case}`);
    if (s.foe) L.push(`대치 중인 괴이: ${s.foe.name} — 남은 형체 ${s.foe.pct}%${s.foe.note ? ` (${s.foe.note})` : ''}`);
    if (s.bonds.length) L.push(`인연: ${s.bonds.slice(-8).map(b => `${b.name}(신뢰 ${b.trust}${b.note ? `, ${b.note}` : ''})`).join(' / ')}`);
    const dir = [STAGE_DIRECTIVE.san[ss], STAGE_DIRECTIVE.cor[cs]].filter(Boolean);
    if (s.hp <= 0) dir.push('⟦빈사⟧ 체력 0: {{user}}는 죽어 가고 있다. 감각이 멀어지는 가운데 계약한 객성이 생존의 대가를 제시한다. {{user}}가 받아들이기 전까지 살려 두지 말고, 죽이지도 말 것.');
    if (dir.length) L.push(`서술 지시: ${dir.join(' ')}`);
    L.push('');
    L.push('[출력 규칙] 본문이 끝난 뒤 맨 끝에 <state> 블록을 붙인다. 이번 턴에 실제로 바뀐 항목만 한 줄에 하나씩. 수치 변화에는 반드시 + 또는 − 부호를 붙인다. 바뀐 것이 없으면 <state></state>. 코드블록으로 감싸지 않는다.');
    L.push('키: hp, san, cor, cash, day(+1 = 날짜가 넘어감), time(새벽/아침/낮/저녁/밤/자정), loc, mode(일상/의뢰/전투), case(의뢰명 | 진행, 끝나면 없음), foe(이름 | 남은형체% | 특징·약점, 사라지면 없음), taboo(계약명 = 지킴 또는 어김), curse(+내용 / −내용), mutation(+이름 | 묘사 — 시스템 외 서사적 변이만), bond(이름 +1 | 한 줄 메모)');
    L.push('예시:\n<state>\nhp: -8\ncor: +4\nloc: 흑수구 · 폐지하철역\nfoe: 0호선 안내방송 | 85 | 이름을 부르면 대답하게 만든다\n</state>');
    L.push('수치 감각: 경상 −5~10 / 중상 −15~25 / 치명 −30 이상 · 괴이 목격 이성 −2~5, 금지된 진실 −8~15 · 객성과의 접촉·괴이의 피 오염 +5~15 · 숙면 hp +15 san +5 · 정화 의식 cor −3~8(대가 필수). 회복은 느리고 피해는 정직하게.');
    L.push('[판정 …] 태그가 있으면 그 결과를 반드시 따른다. [권능 …] 태그의 오염은 이미 반영됐으니 cor에 다시 더하지 않는다(서사적 추가 대가만 별도로). [금기 이행 …] 태그는 이미 기록됐다.');
    const tense = s.mode !== '일상';
    if (set.choices === 'always' || (set.choices === 'tense' && tense)) {
        L.push(`[선택지] ${set.choices === 'always' ? '매 응답' : '의뢰·전투 중 결정의 순간'}마다 본문 뒤, <state> 앞에 <choices> 블록으로 2~4개의 행동 선택지를 번호 목록으로 제시한다.${ss >= 2 ? ` 이성이 낮으므로 그중 ${ss >= 3 ? '둘' : '하나'}은 "⟨이질⟩"로 시작하는 비정상적이고 유혹적인 선택지로 만든다${ss >= 3 ? '. 정상 선택지의 문장도 미묘하게 비틀린다' : ''}.` : ''} 선택지는 짧게(한 줄).`);
    }
    if (ss >= 2) L.push('[환각 표기] {{user}}만 보고 듣는 환청·환각은 <hallu>…</hallu>로 감싼다. 그것이 진짜인지 서술로 밝히지 않는다.');
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
    if (!snap) return;
    const key = `${c.getCurrentChatId?.()}:${last}:${c.chat[last]?.swipe_id ?? 0}`;
    if (key === lastNotified) return;
    lastNotified = key;
    for (const e of snap.events) notifyEvent(e);
}

// ───────────────────────────── HUD ─────────────────────────────

function bar(kind, label, value, max, stage, prevVal) {
    const pct = clamp((value / max) * 100, 0, 100);
    const diff = prevVal == null ? 0 : value - prevVal;
    const fx = diff === 0 ? '' : (kind === 'cor' ? (diff > 0 ? 'gs-hurt' : 'gs-heal') : (diff < 0 ? 'gs-hurt' : 'gs-heal'));
    return `<div class="gs-bar gs-bar-${kind} ${fx}" title="${esc(label)} ${value}${kind === 'cor' ? '%' : ''}">
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
        const label = st === 'kept' ? '이행' : st === 'broke' ? '어김' : '미이행';
        return `<button class="gs-taboo gs-taboo-${st}" data-act="keep" data-name="${esc(c.name)}" title="${esc(c.taboo)}">
            <i></i><span>${esc(c.name)}</span><small>${label}</small></button>`;
    }).join('');
    const mode = MODES[s.mode] ?? 'daily';
    const more = set.hudExpanded ? `<div class="gs-more">
        <div class="gs-row"><i class="fa-solid fa-location-dot"></i> ${esc(s.loc || '—')} <span class="gs-dim">· ${won(s.cash)}</span></div>
        ${s.case ? `<div class="gs-row"><i class="fa-solid fa-file-signature"></i> ${esc(s.case)}</div>` : ''}
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
            <span class="gs-mode" data-mode="${mode}">${esc(s.mode)}</span>
            <div class="gs-acts">
                <button class="gs-ico" data-act="roll" title="판정"><i class="fa-solid fa-dice-d20"></i></button>
                <button class="gs-ico" data-act="power" title="권능 발동"><i class="fa-solid fa-bolt"></i></button>
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
        const tags = (ta.value.match(/^(\s*\[(?:판정|권능|금기 이행)[^\]]*\]\s*)+/) ?? [''])[0];
        ta.value = `${tags}${text}`;
    } else {
        const isTag = /^\[/.test(text);
        const kind = isTag ? text.match(/^\[(판정|권능|금기 이행)/)?.[1] : null;
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
        tag.dataset.kind = t.startsWith('판정') ? (/대성공/.test(t) ? 'crit' : /대실패/.test(t) ? 'fumble' : /성공/.test(t) ? 'ok' : 'fail') : t.startsWith('권능') ? 'power' : 'taboo';
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
            systemPrompt: '너는 한국 무속·도교·크툴루 신화를 섞은 호러 TRPG의 설정 작가다. 요청된 형식만 출력한다.',
            prompt: `현대 한국 퇴마물에 등장하는 이계의 존재 "객성(客星)" 하나를 새로 만들어라. ${hint ? `이름 또는 콘셉트: ${hint}.` : ''}
권능은 강력하지만 대가가 있고, 금기는 일상에서 매일 지켜야 하는 기괴하고 구체적인 행동이어야 한다.
아래 7줄 형식만 출력:
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
        <div class="gs-contract-pick">${s.contracts.map((c, i) => `<label class="gs-ccard" data-el="${esc(c.element)}">
            <input type="radio" name="gs-pw" value="${i}" ${i === 0 ? 'checked' : ''}><div><b>${esc(c.name)}</b><small>${esc(c.element)}</small></div><p>${esc(c.power)}</p></label>`).join('')}</div>
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
        const n = cost();
        const after = clamp(s.cor + n, 0, 100);
        const cross = corStage(after) > s.corPeak && corStage(after) <= 3;
        q('[data-o="cost"]').innerHTML = `오염 <b>${s.cor}% → ${after}%</b> <span class="neg">+${n}</span>${cross ? ' <span class="gs-warn">⚠ 임계점을 넘는다 — 변이가 발현된다</span>' : ''}`;
    };
    el.addEventListener('click', (e) => {
        const seg = e.target.closest('.gs-seg button');
        if (seg) { seg.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === seg)); lv = Number(seg.dataset.v); show(); }
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

// ───────────────────────────── 상태 시트 ─────────────────────────────

async function openSheet() {
    if (!isActive()) return toastr.info('객성록 카드가 열린 채팅에서만 사용할 수 있습니다.', '객성록');
    const s = current?.state;
    if (!s?.registered) return openRegister();
    const ss = sanStage(s.san), cs = corStage(s.cor);
    const tabs = [['stat', '상태'], ['pact', '계약'], ['body', '변이·광기'], ['bond', '인연'], ['log', '기록'], ['admin', '관리']];
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
                    <div class="gs-pact-head"><b>${esc(c.name)}</b><small>${esc(c.hanja || '')} · ${esc(c.element)}</small>
                        <button type="button" class="gs-btn gs-btn-sm" data-a="break" data-n="${esc(c.name)}">파기</button></div>
                    <p><span>권능</span>${esc(c.power)}</p><p><span>금기</span>${esc(c.taboo)}</p>
                    <p><span>저주</span>${esc(c.curse)}</p><p><span>증상</span>${esc(c.symptom)}</p><p><span>목소리</span>${esc(c.voice)}</p>
                    <div class="gs-days">${days}</div></div>`;
            }).join('')}
            <button type="button" class="gs-btn" data-a="addpact"><i class="fa-solid fa-plus"></i> 새 객성과 계약 (오염 +5)</button>
            <p class="gs-dim">계약이 늘수록 매일 지켜야 할 금기도 는다. 파기에는 이성 −15, 오염 +15의 대가가 따른다.</p>
        </section>
        <section data-p="body" class="gs-hidden">
            <h4 class="gs-sub">변이 (영구)</h4>
            ${s.mutations.length ? s.mutations.map(m => `<div class="gs-item"><b>變 ${esc(m.name)}</b><span>${esc(m.desc)}</span><button type="button" class="gs-x" data-a="rm" data-k="mutation" data-n="${esc(m.name)}">×</button></div>`).join('') : '<p class="gs-dim">아직 몸은 사람의 것이다.</p>'}
            <h4 class="gs-sub">광기</h4>
            ${s.madness.length ? s.madness.map(m => `<div class="gs-item"><b>狂 ${esc(m.name)}</b><span>${esc(m.desc)}</span><button type="button" class="gs-x" data-a="rm" data-k="madness" data-n="${esc(m.name)}">×</button></div>`).join('') : '<p class="gs-dim">아직 정신은 제자리에 있다.</p>'}
            <p class="gs-dim">오염 25·50·75%를 넘을 때마다 변이가, 이성 50·25 이하로 떨어질 때 광기가 하나씩 새겨진다.</p>
        </section>
        <section data-p="bond" class="gs-hidden">
            ${s.bonds.length ? s.bonds.map(b => `<div class="gs-item"><b>緣 ${esc(b.name)}</b><span>${'●'.repeat(Math.max(0, b.trust))}${'○'.repeat(Math.max(0, 5 - Math.max(0, b.trust)))}${b.trust < 0 ? ` 적의 ${-b.trust}` : ''} ${esc(b.note)}</span>
                <span class="gs-mini"><button type="button" data-a="bond" data-n="${esc(b.name)}" data-v="-1">−</button><button type="button" data-a="bond" data-n="${esc(b.name)}" data-v="+1">+</button></span></div>`).join('') : '<p class="gs-dim">아직 이름을 아는 사람이 없다. 일상에서 만난 사람들이 여기에 남는다.</p>'}
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
