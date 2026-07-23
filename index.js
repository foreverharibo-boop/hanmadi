// Static import 없음 — 동적 import + window 폴백

const EXT = "한마디";
const OLD_EXT = "해줘"; // ★ 예전 확장 이름 — 설정 마이그레이션용
const DEFAULT_GENRES = ["로맨스코메디", "코메디", "일상", "공포", "슬픔"];

const ICON_COLORS = {
    inherit:      "",
    rainbow:      "background:linear-gradient(135deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;",
    "pink-purple":"background:linear-gradient(135deg,#f472b6,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;",
    coral:        "background:linear-gradient(135deg,#FF6B6B,#ff8e53);-webkit-background-clip:text;-webkit-text-fill-color:transparent;",
    "mint-blue":  "background:linear-gradient(135deg,#34d399,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;",
    blue:         "color:#4D96FF;",
    red:          "color:#e74c3c;",
    black:        "color:#222;",
    navy:         "color:#1e3a5f;",
    gray:         "color:#888;",
};
const EMOJI_MAP = { "e-pencil":"✏️","e-memo":"📝","e-pen":"🖊️","e-brush":"🖌️","e-writing":"✍️","e-speech":"💬","e-palette":"🎨","e-gear":"⚙️","e-sparkles":"✨","e-wrench":"🔧","e-magic":"🪄","e-crystal":"🔮" };
function isEmojiIcon(k) { return k.startsWith("e-"); }
function renderIconHtml(iconKey, colorKey) {
    if (isEmojiIcon(iconKey)) return EMOJI_MAP[iconKey] || "?";
    const style = ICON_COLORS[colorKey] || "";
    return `<i class="fa-solid ${iconKey}" style="${style}"></i>`;
}

let stGenerate  = null;
let stGenerateRaw = null;
let stSave      = null;
let stGetCtx    = null;
let stSettings  = null;
let stPowerUser = null;

// ─────────────────────────────────────────────────────────────────────────────
//  Settings
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TONE = { formality: 50, playfulness: 50 };

function getSettings() {
    if (!stSettings) return {
        genres: [...DEFAULT_GENRES], selectedGenre: 0, writingMode: "both", maxTokens: 500,
        toneFormality: DEFAULT_TONE.formality, tonePlayfulness: DEFAULT_TONE.playfulness,
        outputLang: "ko", presets: [], translateMaxTokens: 1000, person: "1st", person3rdName: "",
        lengthMode: "normal", autoTranslateInst: false, defaultEmotions: [], tense: "present", lastPresetId: null,
        profileName: "", multiCount: 1, lastInstruction: "",
    };
    // ★ 확장 이름이 "해줘" → "한마디"로 바뀌면서, 예전 설정(프리셋 등)을 한 번만 그대로 옮겨옴
    if (!stSettings[EXT] && stSettings[OLD_EXT]) {
        stSettings[EXT] = JSON.parse(JSON.stringify(stSettings[OLD_EXT]));
        console.log("[한마디] 이전 '해줘' 설정을 그대로 이어받았습니다.");
    }
    if (!stSettings[EXT]) stSettings[EXT] = {};
    const s = stSettings[EXT];
    if (!Array.isArray(s.genres) || !s.genres.length) s.genres = [...DEFAULT_GENRES];
    if (s.selectedGenre == null || s.selectedGenre >= s.genres.length) s.selectedGenre = 0;
    if (!s.writingMode) s.writingMode = "both";
    if (!s.maxTokens)   s.maxTokens = 500;
    if (s.toneFormality == null)   s.toneFormality = DEFAULT_TONE.formality;
    if (s.tonePlayfulness == null) s.tonePlayfulness = DEFAULT_TONE.playfulness;
    if (s.outputLang !== "ko" && s.outputLang !== "en") s.outputLang = "ko";
    if (!Array.isArray(s.presets)) s.presets = [];
    if (s.translateMaxTokens == null) s.translateMaxTokens = 1000;
    if (s.person !== "1st" && s.person !== "3rd") s.person = "1st";
    if (s.person3rdName == null) s.person3rdName = "";
    if (!(["short","normal","long"].includes(s.lengthMode) || /^custom:\d+$/.test(s.lengthMode))) s.lengthMode = "normal";
    if (s.customCharLimit == null) s.customCharLimit = 50;
    if (s.autoTranslateInst == null) s.autoTranslateInst = false;
    if (!Array.isArray(s.defaultEmotions)) s.defaultEmotions = [];
    if (!["past","present","future"].includes(s.tense)) s.tense = "present";
    if (s.lastPresetId === undefined) s.lastPresetId = null;
    if (s.lastInstruction == null) s.lastInstruction = "";
    if (s.lastUserMessage == null) s.lastUserMessage = "";
    if (s.quickMode !== true) s.quickMode = false;
    if (s.bgGenerate !== true) s.bgGenerate = false;
    if (s.penIcon == null) s.penIcon = "fa-pen-nib";
    if (s.penColor == null) s.penColor = "rainbow";
    if (s.settingsIcon == null) s.settingsIcon = "fa-palette";
    if (s.settingsColor == null) s.settingsColor = "rainbow";
    if (s.multiCount !== 3) s.multiCount = 1;
    if (s.profileName == null) s.profileName = "";
    return s;
}

function saveSettings() { if (typeof stSave === "function") stSave(); }

// ─────────────────────────────────────────────────────────────────────────────
//  Theme
// ─────────────────────────────────────────────────────────────────────────────

function isLight() {
    try {
        const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
        if (!m || m.length < 3) return false;
        return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 > 0.55;
    } catch { return false; }
}
function tc() { return isLight() ? "dp-light" : "dp-dark"; }
function syncTheme() {
    const p = document.getElementById("dp-panel");
    if (!p) return;
    p.classList.toggle("dp-light", isLight());
    p.classList.toggle("dp-dark", !isLight());
}

// ─────────────────────────────────────────────────────────────────────────────
//  Context
// ─────────────────────────────────────────────────────────────────────────────

function getCtx() {
    if (typeof stGetCtx === "function") return stGetCtx();
    if (typeof window.getContext === "function") return window.getContext();
    return {};
}

function getRecentMsgs(n = 10) {
    return (getCtx().chat || []).filter(m => !m.is_system).slice(-n);
}

// 캐릭터의 가장 최근 메시지 원문 (직전 상황을 놓치지 않도록 프롬프트에 직접 인용)
function getLastTurns(n = 3) {
    const ctx = getCtx();
    const user = ctx.name1 || "사용자";
    const char = ctx.name2 || "캐릭터";
    const chat = (ctx.chat || []).filter(m => !m.is_system && m.mes?.trim());
    return chat.slice(-n).map(m => {
        const speaker = m.is_user ? user : char;
        return `[${speaker}]: ${m.mes.trim().slice(0, 600)}`;
    });
}

// 유저 본인이 실제로 쓴 최근 메시지들 (형식 참고 전용 — 캐릭터의 정보블록 형식이
// 대필에 섞여 들어오는 걸 막기 위해, "유저는 원래 이런 스타일로 쓴다"를 보여줌)
function getUserMessageSamples(n = 3) {
    const ctx = getCtx();
    return (ctx.chat || [])
        .filter(m => !m.is_system && m.is_user && m.mes?.trim())
        .slice(-n)
        .map(m => m.mes.trim().slice(0, 200));
}

function getPersonaDesc() {
    const pu = stPowerUser || window.power_user;
    if (!pu) return "";
    if (pu.persona_description) return pu.persona_description;
    const key = pu.user_avatar;
    if (key && pu.personas?.[key]) {
        const p = pu.personas[key];
        return typeof p === "string" ? p : (p?.description || "");
    }
    return "";
}

// ─────────────────────────────────────────────────────────────────────────────
//  Prompt
// ─────────────────────────────────────────────────────────────────────────────

// 톤 슬라이더(0~100) → 문장 변환
// formality: 0=격식체 ... 100=반말/구어체
// playfulness: 0=진지함 ... 100=가벼움/장난기
function toneLabel(formality, playfulness) {
    const f = Math.max(0, Math.min(100, formality ?? 50));
    const p = Math.max(0, Math.min(100, playfulness ?? 50));
    const fLbl = f <= 20 ? "격식체" : f <= 40 ? "약간 격식체" : f <= 60 ? "중간" : f <= 80 ? "약간 반말/구어체" : "반말/구어체";
    const pLbl = p <= 20 ? "진지함" : p <= 40 ? "약간 진지함" : p <= 60 ? "중간" : p <= 80 ? "약간 장난기" : "장난기";
    return `${fLbl} · ${pLbl}`;
}

function buildToneSentence(formality, playfulness) {
    const f = Math.max(0, Math.min(100, formality ?? 50));
    const p = Math.max(0, Math.min(100, playfulness ?? 50));

    let fSentence;
    if (f <= 20) fSentence = "정중하고 격식 있는 존댓말체로";
    else if (f <= 40) fSentence = "예의를 갖춘 존댓말 위주로";
    else if (f <= 60) fSentence = "존댓말과 반말이 자연스럽게 섞인 어투로";
    else if (f <= 80) fSentence = "편안한 반말과 구어체 위주로";
    else fSentence = "완전히 편한 반말과 구어체로, 격식을 차리지 않고";

    let pSentence;
    if (p <= 20) pSentence = "진지하고 무게감 있는 분위기로";
    else if (p <= 40) pSentence = "차분하고 진지한 톤을 유지하며";
    else if (p <= 60) pSentence = "무난한 톤으로";
    else if (p <= 80) pSentence = "유머와 장난기를 살짝 섞어";
    else pSentence = "장난스럽고 가벼운 분위기로, 유머를 적극적으로 살려";

    return `${fSentence}, ${pSentence} 작성하세요.`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  장르별 톤 슬라이더 자동 추천
// ─────────────────────────────────────────────────────────────────────────────

// 기본 5개 장르 추천값 (formality: 0=격식체~100=반말, playfulness: 0=진지함~100=장난기)
const GENRE_TONE_HINTS = {
    "로맨스코메디": { formality: 70, playfulness: 75 },
    "코메디":       { formality: 75, playfulness: 90 },
    "일상":         { formality: 50, playfulness: 55 },
    "공포":         { formality: 25, playfulness: 10 },
    "슬픔":         { formality: 35, playfulness: 10 },
};

// 커스텀 장르는 이름 속 키워드로 대략 추천 (없으면 중간값 50/50)
const GENRE_KEYWORD_HINTS = [
    { kws: ["로맨스","romance","설렘","연애"],           hint: { formality: 65, playfulness: 65 } },
    { kws: ["코메디","comedy","개그","유머","웃긴"],       hint: { formality: 75, playfulness: 90 } },
    { kws: ["공포","horror","스릴러","thriller","무서운"], hint: { formality: 25, playfulness: 10 } },
    { kws: ["슬픔","sad","비극","tragedy","눈물"],         hint: { formality: 35, playfulness: 10 } },
    { kws: ["액션","action","느와르","noir","전투"],       hint: { formality: 40, playfulness: 20 } },
    { kws: ["일상","daily","슬라이스","slice"],            hint: { formality: 50, playfulness: 55 } },
    { kws: ["판타지","fantasy","모험","adventure"],        hint: { formality: 45, playfulness: 45 } },
];

// "다크"/"dark"가 포함되면 장난기를 낮추는 보정치
const DARK_KEYWORDS = ["다크", "dark"];
const DARK_PLAYFULNESS_REDUCTION = 30;

function applyDarkModifier(genreName, hint) {
    const lower = genreName.toLowerCase();
    const isDark = DARK_KEYWORDS.some(kw => lower.includes(kw));
    if (!isDark) return hint;
    return {
        formality: hint.formality,
        playfulness: Math.max(0, hint.playfulness - DARK_PLAYFULNESS_REDUCTION),
    };
}

function genreToneHint(genreName) {
    if (!genreName) return { formality: 50, playfulness: 50 };
    let hint;
    if (GENRE_TONE_HINTS[genreName]) {
        hint = GENRE_TONE_HINTS[genreName];
    } else {
        const lower = genreName.toLowerCase();
        hint = { formality: 50, playfulness: 50 };
        for (const entry of GENRE_KEYWORD_HINTS) {
            if (entry.kws.some(kw => lower.includes(kw.toLowerCase()))) { hint = entry.hint; break; }
        }
    }
    return applyDarkModifier(genreName, hint);
}

// 길이 모드 → 프롬프트 문장
function lengthSentence(mode) {
    if (mode === "short")
        return "**절대 규칙**: 서술+대사를 전부 합쳐서 문장을 총 3개까지만 쓸 수 있습니다. 마침표(.)·물음표(?)·느낌표(!)·대사 끝(\")을 기준으로 문장이 하나씩 끝난 것으로 셉니다. 쓰기 전에 몇 번째 문장인지 속으로 세면서 쓰고, 3번째 문장을 다 쓰면 그 즉시 멈추세요. 4번째 문장은 존재해서는 안 됩니다.";
    if (mode === "long")
        return "분량에 제한을 두지 말고 충분히 길고 풍부하게 작성하세요.";
    const customMatch = /^custom:(\d+)$/.exec(mode || "");
    if (customMatch) {
        const n = customMatch[1];
        return `**절대 규칙**: 공백을 포함한 전체 글자수가 반드시 ${n}자 이하여야 합니다. ${n}자를 단 한 글자도 넘기면 안 됩니다. 한 글자씩 써나가면서 지금까지 몇 자를 썼는지 계속 세고, ${n}자에 도달하면 문장 중간이라도 즉시 멈추세요.`;
    }
    return "**절대 규칙**: 서술+대사를 전부 합쳐서 문장을 총 10개까지만 쓸 수 있습니다. 10번째 문장을 다 쓰면 그 즉시 멈추세요.";
}

// 지시사항 한→영 자동 번역 (autoTranslateInst 켜져 있을 때)
async function translateInstruction(text) {
    const fn = stGenerate || window.generateQuietPrompt;
    if (typeof fn !== "function") return text;
    const prompt = `Translate the following instruction into natural English. Output ONLY the translated instruction, no explanation or quotes.\n\n${text}`;
    try {
        const out = await fn(prompt, false, false, null, null, 300);
        return out.trim() || text;
    } catch { return text; }
}

function buildPrompt(instruction, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, userMessage, bgMode) {
    // ★ 채팅 히스토리는 ST가 generateQuietPrompt 호출 시 자동으로 컨텍스트에 포함시킴
    //   → 여기서 getRecentMsgs로 다시 넣으면 같은 대화가 중복 주입되므로 넣지 않음
    //   단, bgMode(generateRaw)일 때는 ST가 아무것도 안 넣어주므로 캐릭터 설명 + 긴 히스토리를 직접 주입
    const ctx    = getCtx();
    const user   = ctx.name1 || "사용자";
    const char   = ctx.name2 || "캐릭터";
    const persona = getPersonaDesc();
    const modeLbl = { both:"서술과 대사를 함께", dialogue:"대사만 (서술 없이)", narration:"서술만 (대사 없이)" }[mode] || "서술과 대사를 함께";
    const t      = tone || DEFAULT_TONE;
    const tenseLbl = { past:"과거형", present:"현재형", future:"미래형" }[tense] || "현재형";

    const is3rd = person === "3rd";
    const name3rd = (is3rd && person3rdName?.trim()) ? person3rdName.trim() : null;
    const personLbl = is3rd
        ? (name3rd ? `3인칭 — 주인공 이름: ${name3rd}` : `3인칭 (이름이 별도 지정되지 않음 — 아래 [중요 규칙] 참고)`)
        : "1인칭 (나/저 등 1인칭 시점)";

    // 형식 참고용 — 유저 본인이 과거에 실제로 쓴 메시지 스타일 (내용 아님, 형식만)
    const userSamples = getUserMessageSamples(3);

    let p = `# 대필 지시\n`;
    p += `지금부터 당신은 ${user}(사용자)의 다음 메시지를 대신 작성해야 합니다. 캐릭터 입장이 아닌 ${user} 입장으로 작성하세요.\n\n`;
    p += `장르: ${genre}\n작성 형식: ${modeLbl}\n인칭: ${personLbl}\n시제: ${tenseLbl}\n\n`;
    if (persona) p += `## 사용자 페르소나\n${persona}\n\n`;
    if (bgMode) {
        // generateRaw는 캐릭터 카드가 자동 포함되지 않으므로 직접 주입
        const charObj = ctx.characters?.[ctx.characterId];
        const charDesc = charObj?.description?.trim();
        if (charDesc) p += `## 상대 캐릭터 (${char}) 설명\n${charDesc}\n\n`;
    }
    if (userSamples.length) {
        p += `## 형식 참고 (${user} 본인이 실제로 썼던 메시지 예시 — 내용이 아니라 '형식/문체'만 참고할 것)\n`;
        p += userSamples.map((s,i) => `예시${i+1}: ${s}`).join("\n") + "\n\n";
    }
    if (instruction?.trim()) p += `## 추가 지시\n${instruction.trim()}\n\n`;
    p += `## 톤 지침\n${buildToneSentence(t.formality, t.playfulness)}\n\n`;
    p += `## 분량 지침\n${lengthSentence(lengthMode || "normal")}\n\n`;
    p += `## 시제 지침\n메시지 전체를 ${tenseLbl}으로 작성하세요.\n\n`;
    p += `## 요청\n`;
    p += `직전 대화 흐름을 반드시 읽고, 바로 직전 ${char}의 마지막 메시지와 상황에 자연스럽게 이어지는 ${user}의 다음 메시지를 ${modeLbl}로 대필하세요.\n`;
    p += `\n[중요 규칙]\n`;
    p += `- 반드시 직전 대화 내용과 이어지는 답변/반응을 작성하세요. 대화 흐름을 무시하거나 새로운 상황을 임의로 만들지 마세요.\n`;
    p += `- ${char}이 마지막으로 한 말/행동에 ${user}가 어떻게 반응할지를 중심으로 작성하세요.\n`;
    p += `- 대화에 없는 사건, 인물, 배경을 새로 지어내지 마세요.\n`;
    p += `- 장르(${genre}) 분위기는 유지하되, 내용은 반드시 현재 대화 맥락에서 출발해야 합니다.\n`;
    p += `- [형식 오염 금지] 최근 대화 속 ${char}의 메시지에 날씨/날짜/위치/상태창/스탯 같은 정보블록이나 시스템 태그가 있더라도, 그건 ${char}의 형식일 뿐입니다. 그런 정보블록·태그·괄호 형식을 절대 따라 하지 마세요. 오직 위 [형식 참고]에 나온 것처럼 ${user} 본인이 실제로 쓰는 순수한 대화체 메시지만 작성하세요.\n`;
    if (is3rd && name3rd) {
        p += `- 반드시 3인칭으로 작성하세요. 주인공을 '나'가 아닌 '${name3rd}'(으)로 지칭하세요.\n`;
        p += `- 예시 형식: "${name3rd}가 말했다. \\"대사\\"" / "${name3rd}는 ~했다." 형태로 서술하세요.\n`;
    } else if (is3rd) {
        p += `- 반드시 3인칭으로 작성하세요.\n`;
        p += `- 먼저 위 [사용자 페르소나] 설명에 성별을 짐작할 수 있는 단서(이름, 외모, 관계 호칭 등)가 있는지 확인하세요. 단서가 있으면 그것에 맞춰 '그' 또는 '그녀' 중 하나로만 일관되게 지칭하세요.\n`;
        p += `- 단서가 없어서 성별을 확신할 수 없으면, '그'나 '그녀'를 함부로 추측해서 쓰지 마세요. 대신 '${user}'라는 이름을 대명사처럼 반복해서 사용하세요 (예: "${user}가 ~했다. ${user}는 ~라고 말했다.").\n`;
    } else {
        p += `- 반드시 1인칭(나/저 등)으로 작성하세요.\n`;
    }
    p += `- 반드시 ${tenseLbl}으로 작성하세요.\n`;
    if (persona) p += `- 페르소나 성격·말투를 반드시 반영하세요.\n`;
    p += `- 메타 설명 없이 실제 메시지 내용만 출력하세요.\n\n`;

    // 유저가 이미 작성한 부분 — 직전 대화 뒤, 마지막 정리 직전에 배치
    const hasUserMsg = userMessage?.trim();

    // ★ 프롬프트 맨 끝은 모델이 가장 주의 깊게 보는 위치라서, "직전 상황 이어쓰기"랑
    //   "분량 제한"을 따로 두 번 강조하면 서로 경쟁하게 됨 → 하나로 합쳐서 한 번만 마무리
    const lastTurns = getLastTurns(bgMode ? 8 : 3);
    const lm = lengthMode || "normal";
    const needsStrictLength = lm === "short" || /^custom:\d+$/.test(lm);

    if (lastTurns.length) {
        p += `## 직전 대화 (최근 ${lastTurns.length}턴 — 아래 흐름에 자연스럽게 이어지는 답변을 쓸 것)\n`;
        p += lastTurns.join("\n") + "\n\n";
    }

    // 유저가 이미 작성한 부분 → 직전 대화 뒤, 마지막 정리 직전 = 모델이 가장 직접적으로 이어받는 위치
    if (hasUserMsg) {
        p += `## ${user}가 이미 작성한 부분 (이어쓰기 시작점)\n`;
        p += `${userMessage.trim()}\n\n`;
        p += `[핵심 규칙] 위 텍스트는 ${user}가 이미 직접 쓴 부분입니다.\n`;
        p += `- 이 내용을 절대 반복하거나 요약하지 마세요.\n`;
        p += `- 당신의 출력은 위 텍스트의 마지막 글자 바로 뒤에 붙습니다.\n`;
        p += `- 문장 중간이면 그 문장을 자연스럽게 이어서 완성하세요.\n`;
        p += `- 문장이 끝난 상태면 다음 문장부터 시작하세요.\n`;
        p += `- 문체, 어투, 분위기, 말투를 위 텍스트와 동일하게 유지하세요. 갑자기 톤이 바뀌면 안 됩니다.\n`;
        p += `- 위 텍스트와 당신의 출력을 합쳤을 때, 한 사람이 처음부터 끝까지 쓴 것처럼 읽혀야 합니다.\n\n`;
    }

    p += `## 마지막 정리\n`;
    if (lastTurns.length) {
        p += `위 [직전 대화]가 방금 일어난 일입니다. 절대 무시하거나 다른 상황을 지어내지 말고, 특히 마지막 줄(${char}의 가장 최근 메시지)을 반드시 직접 이어받아서 ${user}의 반응을 쓰세요.\n`;
    }
    if (hasUserMsg) {
        p += `[이어쓰기] 바로 위에 ${user}가 이미 작성한 텍스트가 있습니다. 당신의 출력 첫 글자가 그 텍스트의 마지막 글자 바로 뒤에 자연스럽게 붙어야 합니다. 이미 쓴 부분을 절대 반복하지 말고, 문체와 어투를 일관되게 유지해서 하나의 글처럼 읽히게 하세요.\n`;
    }
    if (needsStrictLength) {
        p += `그리고 그 답변을 쓸 때 ${lengthSentence(lm)}\n`;
        p += `맥락을 잘 이어가는 것과 분량을 지키는 것 둘 다 반드시 지키세요 — 분량 때문에 맥락을 무시하거나, 맥락 때문에 분량을 넘기지 마세요.\n`;
    }
    p += `\n`;

    p += outputLang === "en"
        ? `## Output Language\nWrite only in English.`
        : `## 출력 언어\n반드시 한국어로만 출력하세요.`;
    return p;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Generation
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  연결 프로필 전환 (전용 프로필 지정 시, 생성 동안만 잠깐 전환했다가 복구)
// ─────────────────────────────────────────────────────────────────────────────

function execSlash(cmd) {
    // 슬래시커맨드 실행은 script.js 내부 getContext가 아니라
    // ST가 확장 개발자용으로 공식 제공하는 전역 SillyTavern.getContext()를 써야 함
    // (executeSlashCommandsWithOptions가 내부 getContext엔 없는 경우가 있음)
    const officialCtx = window.SillyTavern?.getContext?.();
    const ctx = (officialCtx && typeof officialCtx.executeSlashCommandsWithOptions === "function")
        ? officialCtx
        : getCtx();
    if (typeof ctx.executeSlashCommandsWithOptions !== "function") {
        console.warn("[한마디] executeSlashCommandsWithOptions를 찾을 수 없음 (SillyTavern.getContext 미노출?)");
        return Promise.resolve(null);
    }
    return ctx.executeSlashCommandsWithOptions(cmd, { handleParserErrors: true, handleExecutionErrors: true });
}

async function getCurrentProfileName() {
    try { return ((await execSlash("/profile"))?.pipe ?? "").trim(); }
    catch { return ""; }
}

async function waitUntilProfileIs(targetName, maxWaitMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const current = await getCurrentProfileName();
        if (current === targetName) return true;
        await new Promise(r => setTimeout(r, 50));
    }
    return false;
}

// 지정된 프로필로 생성 함수(fn)를 실행하고, 끝나면 원래 프로필로 되돌림
async function withProfile(profileName, fn) {
    if (!profileName) return await fn();
    let prevProfile = "";
    let needSwitch = false;
    try {
        prevProfile = await getCurrentProfileName();
        needSwitch = !!prevProfile && prevProfile !== profileName;
    } catch { /* ignore */ }

    try {
        if (needSwitch) {
            await execSlash(`/profile ${profileName}`);
            await waitUntilProfileIs(profileName);
        }
        return await fn();
    } finally {
        if (needSwitch && prevProfile) {
            try {
                await execSlash(`/profile ${prevProfile}`);
                await waitUntilProfileIs(prevProfile);
            } catch { /* ignore */ }
        }
    }
}

async function generate(instruction, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, onTranslated, userMessage) {
    const s = getSettings();
    const useBg = s.bgGenerate && typeof stGenerateRaw === "function";
    const fn = stGenerate || window.generateQuietPrompt;
    if (!useBg && typeof fn !== "function") throw new Error("generateQuietPrompt를 찾을 수 없습니다. ST API 연결을 확인해 주세요.");
    const maxTok = s.maxTokens > 0 ? s.maxTokens : null;
    // 지시사항 자동 번역 (켜져 있고 내용이 한국어인 경우)
    let finalInst = instruction;
    if (s.autoTranslateInst && instruction?.trim()) {
        finalInst = await translateInstruction(instruction.trim());
    }
    // 번역 단계 끝났음을 알려서 로딩 문구를 "AI 대필 중…"으로 바꿀 수 있게 함
    if (typeof onTranslated === "function") onTranslated();
    const prompt = buildPrompt(finalInst, mode, genre, tone, outputLang, person, person3rdName, lengthMode || s.lengthMode, tense || s.tense, userMessage, useBg);
    return await withProfile(s.profileName, async () => {
        if (useBg) {
            // 백그라운드 생성 — 채팅 UI에 생성 중 표시 없음
            try {
                // 신버전 ST: 객체 파라미터
                const r = await stGenerateRaw({ prompt, responseLength: maxTok });
                if (typeof r === "string") return r;
            } catch (e) { /* 구버전 시그니처로 재시도 */ }
            // 구버전 ST: positional (prompt, api, instructOverride, quietToLoud, systemPrompt, responseLength)
            return await stGenerateRaw(prompt, null, false, false, null, maxTok);
        }
        return await fn(prompt, false, false, null, null, maxTok);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Translation
//  참고: ST에 Cat-translator 등 전용 번역 확장을 쓰고 있다면 여기에 연동 지점을
//  추가할 수 있음. 우선은 별도 확장에 의존하지 않도록 현재 연결된 ST API
//  (generateQuietPrompt)로 직접 번역을 요청하는 독립적인 방식으로 구현.
// ─────────────────────────────────────────────────────────────────────────────

async function translateText(text, targetLangLabel, maxTokens) {
    const fn = stGenerate || window.generateQuietPrompt;
    if (typeof fn !== "function") throw new Error("generateQuietPrompt를 찾을 수 없습니다. ST API 연결을 확인해 주세요.");
    const prompt = `다음 텍스트를 자연스러운 ${targetLangLabel}로 번역하세요. 설명이나 추가 코멘트 없이 번역 결과만 출력하세요.\n\n---\n${text}\n---`;
    const budget = !maxTokens || maxTokens <= 0 ? null : maxTokens;
    const out = await fn(prompt, false, false, null, null, budget);
    return out.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Generation History (세션 중에만 유지 — 새로고침 시 초기화)
// ─────────────────────────────────────────────────────────────────────────────

let sessionHistory = [];
let generationToken = 0; // 취소 감지용 — 취소 누르면 증가시켜서 진행 중이던 결과를 무시함
let historyIndex = -1;

function pushHistory(entry) {
    sessionHistory.push(entry);
    historyIndex = sessionHistory.length - 1;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────────────────────

function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function rm(id) { document.getElementById(id)?.remove(); }

function insertToInput(text, genre, mode, instruction, replace = false) {
    const ta = document.getElementById("send_textarea");
    if (ta) {
        ta.value = replace ? text : (ta.value ? `${ta.value}\n${text}` : text);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
    }
    // 인포바 업데이트
    updateInfoBar(genre, mode, instruction);
}

// ★ 모달은 <html>에 붙임 → ST body transform 완전 차단
function mount(el) { document.documentElement.appendChild(el); }

// ─────────────────────────────────────────────────────────────────────────────
//  Info Bar (채팅창 하단 - 현재 설정 표시)
// ─────────────────────────────────────────────────────────────────────────────

function updateInfoBar(genre, mode, instruction) {
    let bar = document.getElementById("dp-infobar");
    if (!bar) {
        bar = document.createElement("div");
        bar.id = "dp-infobar";
        bar.className = `dp-infobar ${tc()}`;
        // send_form 아래에 삽입
        const sendForm = document.getElementById("send_form");
        if (sendForm && sendForm.parentNode) {
            sendForm.parentNode.insertBefore(bar, sendForm.nextSibling);
        } else {
            document.body.appendChild(bar);
        }
    }

    const modeKR  = { both:"서술+대사", dialogue:"대사만", narration:"서술만" }[mode] || "서술+대사";
    const instSnip = instruction?.trim() ? `· "${instruction.trim().slice(0, 20)}${instruction.trim().length > 20 ? "…" : ""}"` : "";

    bar.className = `dp-infobar ${tc()}`;
    bar.innerHTML = `
<span class="dp-ib-icon">✍️</span>
<span class="dp-ib-chip">${esc(genre)}</span>
<span class="dp-ib-chip">${modeKR}</span>
${instSnip ? `<span class="dp-ib-inst">${esc(instSnip)}</span>` : ""}
<button class="dp-ib-clear" id="dp-ib-clear" title="인포바 닫기">✕</button>`;
    bar.style.display = "flex";

    document.getElementById("dp-ib-clear")?.addEventListener("click", () => {
        bar.style.display = "none";
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Modals
// ─────────────────────────────────────────────────────────────────────────────

function showLoading(msg) {
    rm("dp-loading");
    const el = document.createElement("div");
    el.id = "dp-loading"; el.className = "dp-overlay";
    el.innerHTML = `
<div class="dp-modal dp-loading-modal ${tc()}">
    <div class="dp-spinner"></div>
    <p>${esc(msg || "AI 대필 중…")}</p>
    <button id="dp-loading-cancel" class="dp-btn dp-btn-sm">취소</button>
</div>`;
    mount(el);
    el.querySelector("#dp-loading-cancel").addEventListener("click", () => {
        generationToken++; // 진행 중인 생성 결과를 무효화
        hideLoading();
    });
}
function hideLoading() { rm("dp-loading"); }
function updateLoadingMessage(msg) {
    const p = document.querySelector("#dp-loading .dp-loading-modal p");
    if (p) p.textContent = msg;
    else showLoading(msg);
}

function showError(msg) {
    rm("dp-error");
    const el = document.createElement("div");
    el.id = "dp-error"; el.className = "dp-overlay";
    el.innerHTML = `
<div class="dp-modal dp-err-modal ${tc()}">
    <div class="dp-modal-header"><span class="dp-modal-title">⚠️ 오류</span><button class="dp-close" id="dp-err-x">✕</button></div>
    <div class="dp-modal-body"><p>${esc(msg || "알 수 없는 오류")}</p></div>
    <div class="dp-action-bar"><button id="dp-err-ok" class="dp-btn dp-btn-primary">확인</button></div>
</div>`;
    mount(el);
    const close = () => el.remove();
    el.querySelector("#dp-err-x").addEventListener("click", close);
    el.querySelector("#dp-err-ok").addEventListener("click", close);
}

// entry = { result, instruction, mode, genre, tone, outputLang, person, person3rdName, translation? }
function showResult(entry, onBack) {
    rm("dp-result");
    const { result, instruction, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, userMessage } = entry;
    const hasUM = userMessage?.trim();
    const modeKR = { both:"서술+대사", dialogue:"대사만", narration:"서술만" }[mode] || "서술+대사";
    const langKR = outputLang === "en" ? "English" : "한국어";
    const tenseKR = { past:"과거", present:"현재", future:"미래" }[tense] || "현재";
    const idx = sessionHistory.indexOf(entry);
    const hasMulti = sessionHistory.length > 1;

    const el = document.createElement("div");
    el.id = "dp-result"; el.className = "dp-overlay";
    el.innerHTML = `
<div class="dp-modal dp-result-modal ${tc()}">
    <div class="dp-modal-header">
        <span class="dp-modal-title">✍️ 대필 결과</span>
        <button class="dp-close" id="dp-res-x">✕</button>
    </div>
    ${hasMulti ? `
    <div class="dp-history-bar">
        <button id="dp-hist-prev" class="dp-hist-btn"${idx <= 0 ? " disabled" : ""}>◀ 이전</button>
        <span class="dp-hist-count">${idx + 1} / ${sessionHistory.length}</span>
        <button id="dp-hist-next" class="dp-hist-btn"${idx >= sessionHistory.length - 1 ? " disabled" : ""}>다음 ▶</button>
    </div>` : ""}
    <div class="dp-modal-body">
        <div class="dp-tags">
            <span class="dp-tag dp-tag-genre">${esc(genre)}</span>
            <span class="dp-tag dp-tag-mode">${modeKR}</span>
            <span class="dp-tag dp-tag-tone">${esc(toneLabel(tone?.formality, tone?.playfulness))}</span>
            <span class="dp-tag dp-tag-lang">${langKR}</span>
            <span class="dp-tag dp-tag-tense">${tenseKR}형</span>
            <span class="dp-tag dp-tag-count">${result.trim().length}자</span>
        </div>
        ${instruction?.trim() ? `<div class="dp-inst-preview">💬 지시: ${esc(instruction.trim())}</div>` : ""}
        ${hasUM ? `<div class="dp-usermsg-section">
            <div class="dp-usermsg-label">📝 내가 쓴 부분</div>
            <div class="dp-usermsg-text">${esc(userMessage.trim())}</div>
        </div>
        <div class="dp-continuation-label">✍️ AI 이어쓰기 ↓</div>` : ""}
        <textarea id="dp-res-text" class="dp-result-textarea" spellcheck="false">${esc(result)}</textarea>
        <div id="dp-translation-box" class="dp-translation-box" style="display:none">
            <div class="dp-translation-label">
                <i class="fa-solid fa-language"></i> 번역
                <button id="dp-translation-insert" class="dp-btn dp-btn-sm dp-translation-insert-btn">
                    <i class="fa-solid fa-paste"></i> 번역본 삽입
                </button>
            </div>
            <textarea id="dp-translation-text" class="dp-result-textarea" spellcheck="false"></textarea>
        </div>
    </div>
    <div class="dp-action-bar">
        <button id="dp-insert" class="dp-btn dp-btn-primary"><i class="fa-solid fa-paste"></i> 인풋에 삽입</button>
        <button id="dp-regen"  class="dp-btn"><i class="fa-solid fa-rotate"></i> 재생성</button>
        <button id="dp-modify-toggle" class="dp-btn"><i class="fa-solid fa-pen"></i> 수정 재생성</button>
        <button id="dp-translate" class="dp-btn"><i class="fa-solid fa-language"></i> 번역</button>
    </div>
    <div id="dp-modify-box" class="dp-modify-box" style="display:none">
        <textarea id="dp-modify-inp" class="dp-textarea" rows="2" placeholder="수정 지시 입력… (예: 더 짧게, 귀엽게, 슬프게)"></textarea>
        <button id="dp-modify-go" class="dp-btn dp-btn-primary"><i class="fa-solid fa-wand-magic-sparkles"></i> 수정 재생성 실행</button>
    </div>
</div>`;
    mount(el);

    el.querySelector("#dp-res-x").addEventListener("click", () => {
        el.remove();
        if (typeof onBack === "function") onBack();
    });

    el.querySelector("#dp-insert").addEventListener("click", () => {
        const aiText = el.querySelector("#dp-res-text").value;
        const combined = hasUM ? `${userMessage.trim()}\n${aiText}` : aiText;
        insertToInput(combined, genre, mode, instruction, hasUM);
        el.remove();
        rm("dp-multi-result");
    });

    el.querySelector("#dp-regen").addEventListener("click", async () => {
        el.remove();
        const myToken = ++generationToken;
        showLoading();
        try {
            const r = await generate(instruction, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, () => updateLoadingMessage("AI 대필 중…"), userMessage);
            if (myToken !== generationToken) return;
            hideLoading();
            const newEntry = { result: r, instruction, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, userMessage };
            pushHistory(newEntry);
            showResult(newEntry, onBack);
        } catch (e) {
            if (myToken !== generationToken) return;
            hideLoading(); showError(e.message);
        }
    });

    el.querySelector("#dp-modify-toggle").addEventListener("click", () => {
        const box = el.querySelector("#dp-modify-box");
        const hidden = box.style.display === "none";
        box.style.display = hidden ? "flex" : "none";
        if (hidden) el.querySelector("#dp-modify-inp").focus();
    });

    el.querySelector("#dp-modify-go").addEventListener("click", async () => {
        const note = el.querySelector("#dp-modify-inp").value.trim();
        const prev = el.querySelector("#dp-res-text").value;
        const combined = [instruction, `이전 대필 결과:\n${prev}`, note ? `수정 지시: ${note}` : ""].filter(Boolean).join("\n\n");
        el.remove();
        const myToken = ++generationToken;
        showLoading();
        try {
            const r = await generate(combined, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, () => updateLoadingMessage("AI 대필 중…"), userMessage);
            if (myToken !== generationToken) return;
            hideLoading();
            const newEntry = { result: r, instruction: combined, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, userMessage };
            pushHistory(newEntry);
            showResult(newEntry, onBack);
        } catch (e) {
            if (myToken !== generationToken) return;
            hideLoading(); showError(e.message);
        }
    });

    // 히스토리 네비게이션
    el.querySelector("#dp-hist-prev")?.addEventListener("click", () => {
        if (historyIndex > 0) { historyIndex--; showResult(sessionHistory[historyIndex], onBack); }
    });
    el.querySelector("#dp-hist-next")?.addEventListener("click", () => {
        if (historyIndex < sessionHistory.length - 1) { historyIndex++; showResult(sessionHistory[historyIndex], onBack); }
    });

    // 번역
    const translateBtn = el.querySelector("#dp-translate");
    const translationBox = el.querySelector("#dp-translation-box");
    const translationText = el.querySelector("#dp-translation-text");
    if (entry.translation) {
        translationText.value = entry.translation;
        translationBox.style.display = "flex";
        translateBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> 번역 숨기기';
    }
    translateBtn.addEventListener("click", async () => {
        const visible = translationBox.style.display !== "none";
        if (visible) {
            translationBox.style.display = "none";
            translateBtn.innerHTML = '<i class="fa-solid fa-language"></i> 번역';
            return;
        }
        if (entry.translation) {
            translationText.value = entry.translation;
            translationBox.style.display = "flex";
            translateBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> 번역 숨기기';
            return;
        }
        const targetLabel = outputLang === "en" ? "한국어(Korean)" : "영어(English)";
        translateBtn.disabled = true;
        translateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 번역 중…';
        try {
            const tTokens = getSettings().translateMaxTokens;
            const translated = await translateText(el.querySelector("#dp-res-text").value, targetLabel, tTokens);
            entry.translation = translated;
            translationText.value = translated;
            translationBox.style.display = "flex";
            translateBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> 번역 숨기기';
        } catch (e) {
            showError(e.message || "번역 실패. ST API 연결 상태를 확인해 주세요.");
            translateBtn.innerHTML = '<i class="fa-solid fa-language"></i> 번역';
        } finally {
            translateBtn.disabled = false;
        }
    });

    // 번역본 삽입
    el.querySelector("#dp-translation-insert").addEventListener("click", () => {
        const transText = translationText.value;
        const combined = hasUM ? `${userMessage.trim()}\n${transText}` : transText;
        insertToInput(combined, genre, mode, instruction, hasUM);
        el.remove();
        rm("dp-multi-result");
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Genre Manager
// ─────────────────────────────────────────────────────────────────────────────

function openGenreManager(onClose) {
    rm("dp-genre-mgr");
    const s = getSettings();
    const listHtml = () => s.genres.map((g,i) => `
<li class="dp-genre-item" data-i="${i}">
    <span class="dp-genre-name">${esc(g)}</span>
    <div class="dp-genre-acts">
        <button class="dp-icon-btn dp-edit" data-i="${i}">✏️</button>
        <button class="dp-icon-btn dp-del"  data-i="${i}">🗑️</button>
    </div>
</li>`).join("");

    const el = document.createElement("div");
    el.id = "dp-genre-mgr"; el.className = "dp-overlay";
    el.innerHTML = `
<div class="dp-modal dp-genre-modal ${tc()}">
    <div class="dp-modal-header"><span class="dp-modal-title">🎭 장르 관리</span><button class="dp-close" id="dp-gm-x">✕</button></div>
    <div class="dp-modal-body">
        <ul id="dp-gm-list" class="dp-genre-list">${listHtml()}</ul>
        <div class="dp-genre-add">
            <input id="dp-gm-input" class="dp-input" type="text" placeholder="새 장르 이름…">
            <button id="dp-gm-add" class="dp-btn dp-btn-primary">추가</button>
        </div>
    </div>
</div>`;
    mount(el);

    const close = () => { el.remove(); if (typeof onClose === "function") onClose(); };

    const refresh = () => { el.querySelector("#dp-gm-list").innerHTML = listHtml(); refreshGenreSelect(); };
    el.querySelector("#dp-gm-x").addEventListener("click", close);
    const addGenre = () => {
        const inp = el.querySelector("#dp-gm-input");
        const val = inp.value.trim(); if (!val) return;
        s.genres.push(val); saveSettings(); inp.value = ""; refresh();
    };
    el.querySelector("#dp-gm-add").addEventListener("click", addGenre);
    el.querySelector("#dp-gm-input").addEventListener("keydown", e => { if (e.key === "Enter") addGenre(); });
    el.querySelector("#dp-gm-list").addEventListener("click", e => {
        const btn = e.target.closest("button"); if (!btn) return;
        const idx = parseInt(btn.dataset.i);
        if (btn.classList.contains("dp-del")) {
            if (s.genres.length <= 1) { alert("장르는 최소 1개 이상 있어야 합니다."); return; }
            s.genres.splice(idx, 1);
            if (s.selectedGenre >= s.genres.length) s.selectedGenre = s.genres.length - 1;
            saveSettings(); refresh();
        }
        if (btn.classList.contains("dp-edit")) {
            const name = prompt("장르 이름 수정:", s.genres[idx]);
            if (name?.trim()) { s.genres[idx] = name.trim(); saveSettings(); refresh(); }
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Panel
// ─────────────────────────────────────────────────────────────────────────────

function refreshGenreSelect() {
    const s = getSettings();
    const sel = document.getElementById("dp-genre-sel");
    if (!sel) return;
    sel.innerHTML = s.genres.map((g,i)=>`<option value="${i}"${i===s.selectedGenre?" selected":""}>${esc(g)}</option>`).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Trigger
// ─────────────────────────────────────────────────────────────────────────────

async function runGenerate(inst, mode, genre, maxTokens, tone, outputLang, person, person3rdName, lengthMode, tense, userMessage) {
    const s = getSettings();
    const lm = lengthMode || s.lengthMode || "normal";
    const tn = tense || s.tense || "present";
    const um = userMessage || "";
    const myToken = ++generationToken;
    if (s.autoTranslateInst && inst?.trim()) showLoading("지시사항 번역 중…");
    else showLoading();
    try {
        const result = await generate(inst, mode, genre, tone, outputLang, person, person3rdName, lm, tn, () => updateLoadingMessage("AI 대필 중…"), um);
        if (myToken !== generationToken) return;
        hideLoading();
        const entry = { result, instruction: inst, mode, genre, tone, outputLang, person, person3rdName, lengthMode: lm, tense: tn, userMessage: um };
        pushHistory(entry);
        showResult(entry);
    } catch (e) {
        if (myToken !== generationToken) return;
        hideLoading();
        showError(e.message || "생성 실패. ST API 연결 상태를 확인해 주세요.");
    }
}

// 여러 버전(기본 3개) 동시 생성 — 병렬로 요청해서 결과 중 고를 수 있게 보여줌
async function runGenerateMulti(count, inst, mode, genre, maxTokens, tone, outputLang, person, person3rdName, lengthMode, tense, userMessage) {
    const s = getSettings();
    const lm = lengthMode || s.lengthMode || "normal";
    const tn = tense || s.tense || "present";
    const um = userMessage || "";
    const myToken = ++generationToken;
    if (s.autoTranslateInst && inst?.trim()) showLoading("지시사항 번역 중…");
    else showLoading(`${count}개 버전 생성 중…`);
    try {
        const jobs = Array.from({ length: count }, () =>
            generate(inst, mode, genre, tone, outputLang, person, person3rdName, lm, tn, () => updateLoadingMessage(`${count}개 버전 생성 중…`), um)
        );
        const settled = await Promise.allSettled(jobs);
        if (myToken !== generationToken) return; // 취소됨
        hideLoading();
        const results = settled
            .filter(r => r.status === "fulfilled")
            .map(r => r.value);
        if (!results.length) {
            showError("생성 실패. ST API 연결 상태를 확인해 주세요.");
            return;
        }
        const baseEntry = { instruction: inst, mode, genre, tone, outputLang, person, person3rdName, lengthMode: lm, tense: tn, userMessage: um };
        showMultiResult(results, baseEntry);
    } catch (e) {
        if (myToken !== generationToken) return;
        hideLoading();
        showError(e.message || "생성 실패. ST API 연결 상태를 확인해 주세요.");
    }
}

// 여러 버전 중 고르는 모달
function showMultiResult(results, baseEntry) {
    rm("dp-multi-result");
    const { instruction, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, userMessage } = baseEntry;
    const hasUM = userMessage?.trim();
    const modeKR = { both:"서술+대사", dialogue:"대사만", narration:"서술만" }[mode] || "서술+대사";
    const tenseKR = { past:"과거", present:"현재", future:"미래" }[tense] || "현재";

    const el = document.createElement("div");
    el.id = "dp-multi-result"; el.className = "dp-overlay";
    el.innerHTML = `
<div class="dp-modal dp-multi-modal ${tc()}">
    <div class="dp-modal-header">
        <span class="dp-modal-title">✍️ ${results.length}개 버전 중 선택</span>
        <button class="dp-close" id="dp-mr-x">✕</button>
    </div>
    <div class="dp-modal-body">
        <div class="dp-tags">
            <span class="dp-tag dp-tag-genre">${esc(genre)}</span>
            <span class="dp-tag dp-tag-mode">${modeKR}</span>
            <span class="dp-tag dp-tag-tense">${tenseKR}형</span>
        </div>
        ${results.map((r, i) => `
        <div class="dp-multi-card" data-i="${i}">
            <div class="dp-multi-card-header">
                <span class="dp-multi-card-label">버전 ${i + 1}</span>
                <span class="dp-multi-card-count" data-i="${i}">${r.trim().length}자</span>
            </div>
            <textarea class="dp-result-textarea dp-multi-textarea" data-i="${i}" spellcheck="false">${esc(r)}</textarea>
            <div class="dp-multi-card-actions">
                <button class="dp-btn dp-btn-primary dp-multi-insert" data-i="${i}">
                    <i class="fa-solid fa-paste"></i> 이 버전 삽입
                </button>
                <button class="dp-btn dp-btn-sm dp-multi-regen-one" data-i="${i}" title="이 버전만 재생성">
                    <i class="fa-solid fa-rotate"></i>
                </button>
                <button class="dp-btn dp-btn-sm dp-multi-expand" data-i="${i}" title="자세히 (재생성·수정재생성·번역)">
                    <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
                </button>
            </div>
        </div>`).join("")}
    </div>
    <div class="dp-action-bar">
        <button id="dp-mr-regen-all" class="dp-btn"><i class="fa-solid fa-rotate"></i> ${results.length}개 다시 생성</button>
    </div>
</div>`;
    mount(el);

    el.querySelector("#dp-mr-x").addEventListener("click", () => el.remove());

    el.querySelectorAll(".dp-multi-insert").forEach(btn => {
        btn.addEventListener("click", () => {
            const i = parseInt(btn.dataset.i);
            const text = el.querySelector(`.dp-multi-textarea[data-i="${i}"]`).value;
            const combined = hasUM ? `${userMessage.trim()}\n${text}` : text;
            insertToInput(combined, genre, mode, instruction, hasUM);
            el.remove();
        });
    });

    // 카드 하나만 다시 생성 (모달은 안 닫고 그 자리에서 텍스트만 교체)
    el.querySelectorAll(".dp-multi-regen-one").forEach(btn => {
        btn.addEventListener("click", async () => {
            const i = parseInt(btn.dataset.i);
            const ta = el.querySelector(`.dp-multi-textarea[data-i="${i}"]`);
            const countEl = el.querySelector(`.dp-multi-card-count[data-i="${i}"]`);
            btn.disabled = true;
            const originalIcon = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                const r = await generate(instruction, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, null, userMessage);
                ta.value = r;
                countEl.textContent = `${r.trim().length}자`;
                results[i] = r;
            } catch (e) {
                showError(e.message || "재생성 실패");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalIcon;
            }
        });
    });

    // 이 버전만 "자세히" — 기존 단일 결과창(재생성·수정재생성·번역 다 있는)으로 확장
    el.querySelectorAll(".dp-multi-expand").forEach(btn => {
        btn.addEventListener("click", () => {
            const i = parseInt(btn.dataset.i);
            const text = el.querySelector(`.dp-multi-textarea[data-i="${i}"]`).value;
            el.classList.add("dp-hidden"); // 지우지 않고 숨김 — 뒤로가기용
            const entry = { result: text, instruction, mode, genre, tone, outputLang, person, person3rdName, lengthMode, tense, userMessage };
            pushHistory(entry);
            showResult(entry, () => {
                el.classList.remove("dp-hidden"); // 뒤로가기: 3개 목록 화면 복원
            });
        });
    });

    el.querySelector("#dp-mr-regen-all").addEventListener("click", async () => {
        el.remove();
        await runGenerateMulti(results.length, instruction, mode, genre, null, tone, outputLang, person, person3rdName, lengthMode, tense, userMessage);
    });
}

function presetOptionsHtml(presets, selectedId) {
    return `<option value="">-- 프리셋 선택 --</option>` +
        presets.map(p => `<option value="${esc(p.id)}"${p.id === selectedId ? " selected" : ""}>${esc(p.name)}</option>`).join("");
}

function showSettingsPopup() {
    rm("dp-settings-popup");
    const s = getSettings();
    const genre = s.genres[s.selectedGenre] ?? s.genres[0];

    const mb = (mode, label, cur) =>
        `<button class="dp-mode-btn${cur === mode ? " active" : ""}" data-mode="${mode}">${label}</button>`;
    const lb = (lang, label, cur) =>
        `<button class="dp-lang-btn${cur === lang ? " active" : ""}" data-lang="${lang}">${label}</button>`;

    const el = document.createElement("div");
    el.id = "dp-settings-popup";
    el.className = "dp-overlay";
    el.innerHTML = `
<div class="dp-modal dp-settings-modal ${tc()}">
    <div class="dp-modal-header">
        <span class="dp-modal-title">✍️ 대필 설정</span>
        <button class="dp-close" id="dp-sp-x">✕</button>
    </div>
    <div class="dp-modal-body">

        <div class="dp-settings-row">
            <label class="dp-settings-label">프리셋</label>
            <div class="dp-preset-row">
                <select id="dp-sp-preset" class="dp-select">${presetOptionsHtml(s.presets, s.lastPresetId)}</select>
                <button id="dp-sp-preset-save" class="dp-btn dp-btn-sm" title="선택한 프리셋에 현재 설정 덮어쓰기">
                    <i class="fa-solid fa-floppy-disk"></i>
                </button>
                <button id="dp-sp-preset-new" class="dp-btn dp-btn-sm" title="현재 설정을 새 프리셋으로 만들기">
                    <i class="fa-solid fa-plus"></i>
                </button>
                <button id="dp-sp-preset-del" class="dp-btn dp-btn-sm" title="선택한 프리셋 삭제">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <span id="dp-sp-preset-msg" class="dp-preset-msg"></span>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">장르</label>
            <div class="dp-popup-genre-row">
                <select id="dp-sp-genre" class="dp-select">
                    ${s.genres.map((g, i) => `<option value="${esc(g)}"${g === genre ? " selected" : ""}>${esc(g)}</option>`).join("")}
                </select>
                <button id="dp-sp-genre-mgr" class="dp-btn dp-btn-sm">
                    <i class="fa-solid fa-pen-to-square"></i> 장르 관리
                </button>
            </div>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">작성 방식</label>
            <div class="dp-mode-group" id="dp-sp-mode-group">
                ${mb("both", "서술+대사", s.writingMode)}
                ${mb("dialogue", "대사만", s.writingMode)}
                ${mb("narration", "서술만", s.writingMode)}
            </div>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">톤 조절</label>
            <div class="dp-tone-slider-wrap">
                <div class="dp-tone-labels"><span>격식체</span><span id="dp-sp-formality-val">중간</span><span>반말/구어체</span></div>
                <input id="dp-sp-formality" type="range" min="0" max="100" step="5" value="${s.toneFormality}" class="dp-slider">
            </div>
            <div class="dp-tone-slider-wrap">
                <div class="dp-tone-labels"><span>진지함</span><span id="dp-sp-playfulness-val">중간</span><span>가벼움/장난기</span></div>
                <input id="dp-sp-playfulness" type="range" min="0" max="100" step="5" value="${s.tonePlayfulness}" class="dp-slider">
            </div>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">인칭</label>
            <div class="dp-mode-group" id="dp-sp-person-group">
                <button class="dp-person-btn${s.person === "1st" ? " active" : ""}" data-person="1st">1인칭</button>
                <button class="dp-person-btn${s.person === "3rd" ? " active" : ""}" data-person="3rd">3인칭</button>
            </div>
        </div>

        <div class="dp-settings-row" id="dp-sp-name-row" style="${s.person === '3rd' ? '' : 'display:none'}">
            <label class="dp-settings-label">3인칭 이름 <span class="dp-settings-hint">(비우면 그/그녀)</span></label>
            <input id="dp-sp-name" class="dp-input" type="text" placeholder="예: 비비" value="${esc(s.person3rdName||'')}">
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">시제</label>
            <div class="dp-mode-group" id="dp-sp-tense-group">
                <button class="dp-person-btn${s.tense === "past" ? " active" : ""}" data-tense="past">과거</button>
                <button class="dp-person-btn${(s.tense === "present" || !s.tense) ? " active" : ""}" data-tense="present">현재</button>
                <button class="dp-person-btn${s.tense === "future" ? " active" : ""}" data-tense="future">미래</button>
            </div>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">출력 언어</label>
            <div class="dp-lang-group" id="dp-sp-lang-group">
                ${lb("ko", "한국어", s.outputLang)}
                ${lb("en", "English", s.outputLang)}
            </div>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">길이</label>
            <div class="dp-length-group" id="dp-sp-length-group">
                <button class="dp-length-btn${s.lengthMode==="short"?" active":""}" data-len="short">✂️ 짧게<span class="dp-length-sub">3문장 이내</span></button>
                <button class="dp-length-btn${s.lengthMode==="normal"?" active":""}" data-len="normal">📝 보통<span class="dp-length-sub">10문장 이내</span></button>
                <button class="dp-length-btn${s.lengthMode==="long"?" active":""}" data-len="long">📖 길게<span class="dp-length-sub">제한 없음</span></button>
                <button class="dp-length-btn${s.lengthMode.startsWith("custom:")?" active":""}" data-len="custom">🎯 직접 지정<span class="dp-length-sub">글자수 입력</span></button>
            </div>
            <div id="dp-sp-custom-len-row" class="dp-custom-len-row" style="${s.lengthMode.startsWith("custom:") ? "" : "display:none"}">
                <span>정확히</span>
                <input id="dp-sp-custom-len" type="number" class="dp-input dp-custom-len-input" min="1" max="4000"
                    value="${s.lengthMode.startsWith("custom:") ? s.lengthMode.split(":")[1] : (s.customCharLimit || 50)}">
                <span>자 이내로</span>
            </div>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">감정 태그 <span class="dp-settings-hint">(클릭하면 지시사항에 추가)</span></label>
            <div class="dp-emotion-group" id="dp-sp-emotion-group">
                <button class="dp-emotion-btn" data-emotion="기쁨">😄 기쁨</button>
                <button class="dp-emotion-btn" data-emotion="설렘">💗 설렘</button>
                <button class="dp-emotion-btn" data-emotion="슬픔">😢 슬픔</button>
                <button class="dp-emotion-btn" data-emotion="분노">😠 분노</button>
                <button class="dp-emotion-btn" data-emotion="당황">😰 당황</button>
                <button class="dp-emotion-btn" data-emotion="부끄러움">😳 부끄러움</button>
                <button class="dp-emotion-btn" data-emotion="질투">😒 질투</button>
                <button class="dp-emotion-btn" data-emotion="긴장">😬 긴장</button>
                <button class="dp-emotion-btn" data-emotion="놀람">😲 놀람</button>
                <button class="dp-emotion-btn" data-emotion="그리움">🥺 그리움</button>
                <button class="dp-emotion-btn" data-emotion="안도">😌 안도</button>
                <button class="dp-emotion-btn" data-emotion="짜증">😤 짜증</button>
                <button class="dp-emotion-btn" data-emotion="애교">🥰 애교</button>
                <button class="dp-emotion-btn" data-emotion="걱정">😟 걱정</button>
            </div>
        </div>

        <div class="dp-settings-row">
            <div class="dp-autotrans-row">
                <label class="dp-settings-label" for="dp-sp-autotrans">지시사항 자동 번역</label>
                <span class="dp-settings-hint">한국어로 입력해도 AI한테는 영어로 전달</span>
                <button type="button" id="dp-sp-autotrans" class="dp-toggle-btn${s.autoTranslateInst ? " active" : ""}" role="switch" aria-checked="${s.autoTranslateInst ? "true" : "false"}">
                    <span class="dp-toggle-thumb"></span>
                </button>
            </div>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">유저 메시지 <span class="dp-settings-hint">(이미 쓴 부분 — AI가 이 뒤부터 이어씀)</span>
                <button id="dp-sp-import-go" class="dp-import-inline-btn" type="button">가져오기</button>
            </label>
            <textarea id="dp-sp-usermsg" class="dp-textarea" rows="3"
                placeholder="여기에 내가 이미 쓴 부분을 넣으면, AI가 뒷부분을 이어서 대필해요"></textarea>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">지시사항 <span class="dp-settings-hint">(선택 — 비워두면 AI 자동 분석 · 자동 임시저장됨)</span></label>
            <textarea id="dp-sp-inst" class="dp-textarea" rows="3"
                placeholder="예: 수줍게 고백하는 느낌으로, 장난스럽게, 짧게 한 줄만…"></textarea>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">최대 응답 토큰</label>
            <div class="dp-popup-token-row">
                <input id="dp-sp-tokens" type="number" class="dp-input dp-token-input"
                    min="0" max="4096" step="50" value="${s.maxTokens}" placeholder="500">
                <span class="dp-token-unit">tokens</span>
                <span class="dp-token-hint">(0 = 제한 없음)</span>
            </div>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">번역 최대 토큰 <span class="dp-settings-hint">(대필 토큰과 별개)</span></label>
            <div class="dp-popup-token-row">
                <input id="dp-sp-translate-tokens" type="number" class="dp-input dp-token-input"
                    min="0" max="4096" step="50" value="${s.translateMaxTokens}" placeholder="1000">
                <span class="dp-token-unit">tokens</span>
                <span class="dp-token-hint">(0 = 제한 없음)</span>
            </div>
        </div>

        <div class="dp-settings-row">
            <label class="dp-settings-label">생성 개수 <span class="dp-settings-hint">(3개면 병렬로 뽑아서 고를 수 있음)</span></label>
            <div class="dp-mode-group" id="dp-sp-multi-group">
                <button class="dp-person-btn${s.multiCount !== 3 ? " active" : ""}" data-count="1">1개</button>
                <button class="dp-person-btn${s.multiCount === 3 ? " active" : ""}" data-count="3">3개</button>
            </div>
        </div>

    </div>
    <div class="dp-action-bar">
        <button id="dp-sp-go" class="dp-btn dp-btn-primary" style="flex:1">
            <i class="fa-solid fa-pen-nib"></i>&nbsp; 대필 생성
        </button>
        <button id="dp-sp-cancel" class="dp-btn">취소</button>
    </div>
</div>`;
    mount(el);

    // 유저 메시지 칸 — 열 때마다 초기화 (가져오기 버튼으로 불러오면 됨)
    const umTa = el.querySelector("#dp-sp-usermsg");

    // 지시사항 칸 채우기
    const instTa = el.querySelector("#dp-sp-inst");
    if (s.lastInstruction?.trim()) {
        instTa.value = s.lastInstruction;
    } else if (s.defaultEmotions.length) {
        instTa.value = s.defaultEmotions.join(", ");
    }

    // 지시사항 자동 임시저장
    instTa.addEventListener("input", function () {
        s.lastInstruction = this.value;
        saveSettings();
    });

    // 입력창에서 가져오기 버튼
    el.querySelector("#dp-sp-import-go").addEventListener("click", () => {
        const sendTa = document.getElementById("send_textarea");
        const draft = sendTa?.value?.trim();
        if (!draft) return;
        umTa.value = draft;
        umTa.focus();
    });

    // ── 상태 추적 ──
    let currentMode = s.writingMode;
    let currentLang = s.outputLang;
    let currentPerson = s.person || "1st";
    let currentLength = s.lengthMode || "normal";
    let currentTense = s.tense || "present";
    let currentMultiCount = s.multiCount === 3 ? 3 : 1;

    const formalitySlider = el.querySelector("#dp-sp-formality");
    const playfulnessSlider = el.querySelector("#dp-sp-playfulness");
    const formalityValLbl = el.querySelector("#dp-sp-formality-val");
    const playfulnessValLbl = el.querySelector("#dp-sp-playfulness-val");

    const fMidLabel = v => v <= 20 ? "격식체" : v <= 40 ? "약간 격식체" : v <= 60 ? "중간" : v <= 80 ? "약간 반말" : "반말/구어체";
    const pMidLabel = v => v <= 20 ? "진지함" : v <= 40 ? "약간 진지함" : v <= 60 ? "중간" : v <= 80 ? "약간 장난기" : "장난기";
    const refreshToneLabels = () => {
        formalityValLbl.textContent = fMidLabel(parseInt(formalitySlider.value));
        playfulnessValLbl.textContent = pMidLabel(parseInt(playfulnessSlider.value));
    };
    refreshToneLabels();
    formalitySlider.addEventListener("input", refreshToneLabels);
    playfulnessSlider.addEventListener("input", refreshToneLabels);

    // 장르 변경 시 톤 슬라이더 자동 추천
    const applyToneHintPopup = (genreName, flash = true) => {
        const hint = genreToneHint(genreName);
        formalitySlider.value = hint.formality;
        playfulnessSlider.value = hint.playfulness;
        refreshToneLabels();
        if (flash) {
            el.querySelectorAll(".dp-tone-slider-wrap").forEach(w => {
                w.classList.add("dp-tone-flash");
                setTimeout(() => w.classList.remove("dp-tone-flash"), 500);
            });
        }
    };
    el.querySelector("#dp-sp-genre").addEventListener("change", function () {
        applyToneHintPopup(this.value);
        s.selectedGenre = s.genres.indexOf(this.value);
        if (s.selectedGenre < 0) s.selectedGenre = 0;
        s.toneFormality = parseInt(formalitySlider.value);
        s.tonePlayfulness = parseInt(playfulnessSlider.value);
        saveSettings();
    });

    // 톤 슬라이더 — 손 뗄 때(change) 저장 (드래그 중엔 저장 안 함)
    formalitySlider.addEventListener("change", () => {
        s.toneFormality = parseInt(formalitySlider.value);
        saveSettings();
    });
    playfulnessSlider.addEventListener("change", () => {
        s.tonePlayfulness = parseInt(playfulnessSlider.value);
        saveSettings();
    });

    el.querySelector("#dp-sp-mode-group").addEventListener("click", e => {
        const btn = e.target.closest(".dp-mode-btn");
        if (!btn) return;
        currentMode = btn.dataset.mode;
        el.querySelectorAll("#dp-sp-mode-group .dp-mode-btn").forEach(b => b.classList.toggle("active", b === btn));
        s.writingMode = currentMode;
        saveSettings();
    });

    el.querySelector("#dp-sp-lang-group").addEventListener("click", e => {
        const btn = e.target.closest(".dp-lang-btn");
        if (!btn) return;
        currentLang = btn.dataset.lang;
        el.querySelectorAll(".dp-lang-btn").forEach(b => b.classList.toggle("active", b === btn));
        s.outputLang = currentLang;
        saveSettings();
    });

    el.querySelector("#dp-sp-person-group").addEventListener("click", e => {
        const btn = e.target.closest(".dp-person-btn");
        if (!btn) return;
        currentPerson = btn.dataset.person;
        el.querySelectorAll("#dp-sp-person-group .dp-person-btn").forEach(b => b.classList.toggle("active", b === btn));
        el.querySelector("#dp-sp-name-row").style.display = currentPerson === "3rd" ? "" : "none";
        s.person = currentPerson;
        saveSettings();
    });

    el.querySelector("#dp-sp-name").addEventListener("change", function () {
        s.person3rdName = this.value.trim();
        saveSettings();
    });

    el.querySelector("#dp-sp-tense-group").addEventListener("click", e => {
        const btn = e.target.closest(".dp-person-btn");
        if (!btn) return;
        currentTense = btn.dataset.tense;
        el.querySelectorAll("#dp-sp-tense-group .dp-person-btn").forEach(b => b.classList.toggle("active", b === btn));
        s.tense = currentTense;
        saveSettings();
    });

    el.querySelector("#dp-sp-multi-group").addEventListener("click", e => {
        const btn = e.target.closest(".dp-person-btn");
        if (!btn) return;
        currentMultiCount = parseInt(btn.dataset.count);
        el.querySelectorAll("#dp-sp-multi-group .dp-person-btn").forEach(b => b.classList.toggle("active", b === btn));
        s.multiCount = currentMultiCount;
        saveSettings();
    });

    // 길이 버튼
    el.querySelector("#dp-sp-length-group").addEventListener("click", e => {
        const btn = e.target.closest(".dp-length-btn");
        if (!btn) return;
        el.querySelectorAll(".dp-length-btn").forEach(b => b.classList.toggle("active", b === btn));
        const customRow = el.querySelector("#dp-sp-custom-len-row");
        if (btn.dataset.len === "custom") {
            customRow.style.display = "flex";
            const n = Math.max(1, parseInt(el.querySelector("#dp-sp-custom-len").value) || 50);
            currentLength = `custom:${n}`;
        } else {
            customRow.style.display = "none";
            currentLength = btn.dataset.len;
        }
        s.lengthMode = currentLength;
        saveSettings();
    });

    el.querySelector("#dp-sp-custom-len").addEventListener("change", function () {
        const n = Math.max(1, parseInt(this.value) || 50);
        this.value = n;
        s.customCharLimit = n;
        if (currentLength.startsWith("custom:")) {
            currentLength = `custom:${n}`;
            s.lengthMode = currentLength;
        }
        saveSettings();
    });

    el.querySelector("#dp-sp-tokens").addEventListener("change", function () {
        s.maxTokens = Math.max(0, parseInt(this.value) || 0);
        saveSettings();
    });

    // 감정 태그 — 지시사항 textarea에 추가
    el.querySelector("#dp-sp-emotion-group").addEventListener("click", e => {
        const btn = e.target.closest(".dp-emotion-btn");
        if (!btn) return;
        const ta = el.querySelector("#dp-sp-inst");
        const emotion = btn.dataset.emotion;
        const cur = ta.value.trim();
        ta.value = cur ? `${cur}, ${emotion}` : emotion;
        btn.classList.add("dp-emotion-active");
        setTimeout(() => btn.classList.remove("dp-emotion-active"), 600);
        ta.focus();
    });

    // autoTranslateInst 토글 (버튼 기반)
    el.querySelector("#dp-sp-autotrans").addEventListener("click", function () {
        const nowActive = !this.classList.contains("active");
        this.classList.toggle("active", nowActive);
        this.setAttribute("aria-checked", nowActive ? "true" : "false");
        s.autoTranslateInst = nowActive;
        saveSettings();
    });

    el.querySelector("#dp-sp-x").addEventListener("click", () => el.remove());
    el.querySelector("#dp-sp-cancel").addEventListener("click", () => el.remove());

    el.querySelector("#dp-sp-translate-tokens").addEventListener("change", function () {
        s.translateMaxTokens = Math.max(0, parseInt(this.value) || 0);
        saveSettings();
    });

    el.querySelector("#dp-sp-genre-mgr").addEventListener("click", () => {
        // 팝업을 지우지 않고 숨긴 뒤, 장르 관리 닫히면 다시 보여주고 장르 목록만 갱신
        el.classList.add("dp-hidden");
        openGenreManager(() => {
            const sel = el.querySelector("#dp-sp-genre");
            const prevVal = sel.value;
            const sNow = getSettings();
            sel.innerHTML = sNow.genres.map(g => `<option value="${esc(g)}"${g === prevVal ? " selected" : ""}>${esc(g)}</option>`).join("");
            if (!sNow.genres.includes(prevVal)) sel.value = sNow.genres[0];
            el.classList.remove("dp-hidden");
        });
    });

    // ── 프리셋 ──
    el.querySelector("#dp-sp-preset").addEventListener("change", function () {
        // 선택 상태를 즉시 저장 → 다음에 팝업 열 때도 이 프리셋이 계속 선택되어 있음
        s.lastPresetId = this.value || null;
        saveSettings();

        const preset = s.presets.find(p => p.id === this.value);
        if (!preset) return;
        el.querySelector("#dp-sp-genre").value = preset.genre;
        currentMode = preset.writingMode;
        el.querySelectorAll("#dp-sp-mode-group .dp-mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === preset.writingMode));
        el.querySelector("#dp-sp-inst").value = preset.instruction || "";
        s.lastInstruction = preset.instruction || "";
        el.querySelector("#dp-sp-tokens").value = preset.maxTokens ?? 500;
        formalitySlider.value = preset.toneFormality ?? 50;
        playfulnessSlider.value = preset.tonePlayfulness ?? 50;
        refreshToneLabels();
        currentLang = preset.outputLang || "ko";
        el.querySelectorAll(".dp-lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === currentLang));
        currentPerson = preset.person || "1st";
        el.querySelectorAll("#dp-sp-person-group .dp-person-btn").forEach(b => b.classList.toggle("active", b.dataset.person === currentPerson));
        el.querySelector("#dp-sp-name-row").style.display = currentPerson === "3rd" ? "" : "none";
        el.querySelector("#dp-sp-name").value = preset.person3rdName || "";
        // 시제 복원
        currentTense = preset.tense || "present";
        el.querySelectorAll("#dp-sp-tense-group .dp-person-btn").forEach(b => b.classList.toggle("active", b.dataset.tense === currentTense));
        // 길이 복원
        if (preset.lengthMode) {
            currentLength = preset.lengthMode;
            const isCustom = currentLength.startsWith("custom:");
            el.querySelectorAll(".dp-length-btn").forEach(b =>
                b.classList.toggle("active", isCustom ? b.dataset.len === "custom" : b.dataset.len === currentLength)
            );
            const customRow = el.querySelector("#dp-sp-custom-len-row");
            if (isCustom) {
                const n = currentLength.split(":")[1];
                customRow.style.display = "flex";
                el.querySelector("#dp-sp-custom-len").value = n;
                s.customCharLimit = parseInt(n) || 50;
            } else {
                customRow.style.display = "none";
            }
        }

        // ★ 프리셋의 모든 값을 즉시 "현재 설정"으로도 저장
        //   → 팝업을 그냥 닫아버려도(대필 생성 안 눌러도) 이 프리셋 값이 그대로 유지됨
        s.selectedGenre = s.genres.indexOf(preset.genre);
        if (s.selectedGenre < 0) s.selectedGenre = 0;
        s.writingMode = currentMode;
        s.maxTokens = preset.maxTokens ?? s.maxTokens;
        s.toneFormality = preset.toneFormality ?? s.toneFormality;
        s.tonePlayfulness = preset.tonePlayfulness ?? s.tonePlayfulness;
        s.outputLang = currentLang;
        s.person = currentPerson;
        s.person3rdName = preset.person3rdName || "";
        s.lengthMode = currentLength;
        s.tense = currentTense;
        saveSettings();
    });

    // 현재 팝업 상태를 프리셋 필드 형태로 수집 (저장/수정 공용)
    const collectPresetFields = () => ({
        genre: el.querySelector("#dp-sp-genre").value,
        writingMode: currentMode,
        instruction: el.querySelector("#dp-sp-inst").value.trim(),
        maxTokens: Math.max(0, parseInt(el.querySelector("#dp-sp-tokens").value) || 0),
        toneFormality: parseInt(formalitySlider.value),
        tonePlayfulness: parseInt(playfulnessSlider.value),
        outputLang: currentLang,
        person: currentPerson,
        person3rdName: el.querySelector("#dp-sp-name").value.trim(),
        lengthMode: currentLength,
        tense: currentTense,
    });

    // 💾 저장 — 선택된 프리셋에 현재 설정을 덮어씀 (이름은 그대로 유지)
    // 프리셋 버튼 클릭 후 잠깐 뜨는 완료 메시지
    let presetMsgTimer = null;
    const showPresetMsg = (text) => {
        const msgEl = el.querySelector("#dp-sp-preset-msg");
        if (!msgEl) return;
        clearTimeout(presetMsgTimer);
        msgEl.textContent = text;
        msgEl.classList.add("show");
        presetMsgTimer = setTimeout(() => msgEl.classList.remove("show"), 1600);
    };

    el.querySelector("#dp-sp-preset-save").addEventListener("click", () => {
        const sel = el.querySelector("#dp-sp-preset");
        if (!sel.value) {
            alert("덮어쓸 프리셋을 먼저 선택해 주세요. 새로 만들려면 + 버튼을 눌러주세요.");
            return;
        }
        const idx = s.presets.findIndex(p => p.id === sel.value);
        if (idx < 0) return;
        const presetId = sel.value;
        const name = s.presets[idx].name;
        s.presets[idx] = { id: presetId, name, ...collectPresetFields() };
        s.lastPresetId = presetId;
        saveSettings();
        sel.innerHTML = presetOptionsHtml(s.presets, s.lastPresetId);
        sel.value = presetId; // 선택 유지
        showPresetMsg(`✅ "${name}" 저장 완료!`);
    });

    // ➕ 새로 만들기 — 이름 입력받아 현재 설정을 새 프리셋으로 추가
    el.querySelector("#dp-sp-preset-new").addEventListener("click", () => {
        const name = prompt("새 프리셋 이름:");
        if (!name?.trim()) return;
        const preset = { id: `${Date.now()}`, name: name.trim(), ...collectPresetFields() };
        s.presets.push(preset);
        s.lastPresetId = preset.id;
        saveSettings();
        const sel = el.querySelector("#dp-sp-preset");
        sel.innerHTML = presetOptionsHtml(s.presets, s.lastPresetId);
        sel.value = preset.id;
        showPresetMsg(`✅ "${preset.name}" 새 프리셋 생성 완료!`);
    });

    el.querySelector("#dp-sp-preset-del").addEventListener("click", () => {
        const sel = el.querySelector("#dp-sp-preset");
        if (!sel.value) { alert("삭제할 프리셋을 선택해 주세요."); return; }
        const preset = s.presets.find(p => p.id === sel.value);
        if (!preset) return;
        if (!confirm(`"${preset.name}" 프리셋을 삭제할까요?`)) return;
        s.presets = s.presets.filter(p => p.id !== sel.value);
        if (s.lastPresetId === sel.value) s.lastPresetId = null;
        saveSettings();
        sel.innerHTML = presetOptionsHtml(s.presets, s.lastPresetId);
        showPresetMsg(`🗑️ "${preset.name}" 삭제됨`);
    });

    el.querySelector("#dp-sp-go").addEventListener("click", async () => {
        const selGenre = el.querySelector("#dp-sp-genre").value;
        const inst = el.querySelector("#dp-sp-inst").value.trim();
        const umVal = el.querySelector("#dp-sp-usermsg").value.trim();
        const tokens = Math.max(0, parseInt(el.querySelector("#dp-sp-tokens").value) || 0);
        const tone = { formality: parseInt(formalitySlider.value), playfulness: parseInt(playfulnessSlider.value) };
        const name3rd = el.querySelector("#dp-sp-name").value.trim();

        // ★ 방금 고른 설정을 "마지막으로 사용한 설정"으로 영구 저장
        //   → 다음에 팝업 열 때 프리셋 선택했던 대로, 혹은 바꾼 대로 그대로 유지됨
        s.selectedGenre = s.genres.indexOf(selGenre);
        if (s.selectedGenre < 0) s.selectedGenre = 0;
        s.writingMode = currentMode;
        s.maxTokens = tokens;
        s.toneFormality = tone.formality;
        s.tonePlayfulness = tone.playfulness;
        s.outputLang = currentLang;
        s.person = currentPerson;
        s.person3rdName = name3rd;
        s.lengthMode = currentLength;
        s.tense = currentTense;
        s.multiCount = currentMultiCount;
        s.lastPresetId = el.querySelector("#dp-sp-preset").value || null;
        saveSettings();

        el.remove();
        if (currentMultiCount === 3) {
            await runGenerateMulti(3, inst, currentMode, selGenre, tokens, tone, currentLang, currentPerson, name3rd, currentLength, currentTense, umVal);
        } else {
            await runGenerate(inst, currentMode, selGenre, tokens, tone, currentLang, currentPerson, name3rd, currentLength, currentTense, umVal);
        }
    });
}

function triggerGenerate() {
    const s = getSettings();
    if (s.quickMode) {
        quickGenerate();
    } else {
        showSettingsPopup();
    }
}

async function quickGenerate() {
    const s = getSettings();
    const sendTa = document.getElementById("send_textarea");
    const um = sendTa?.value?.trim() || "";
    const inst = s.lastInstruction || "";
    const genre = s.selectedGenre || s.genres?.[0] || "소설";
    const tone = { formality: s.toneFormality ?? 50, playfulness: s.tonePlayfulness ?? 50 };
    const person = s.person || "1st";
    const name3rd = s.person3rdName || "";
    const lm = s.lengthMode || "normal";
    const tn = s.tense || "present";
    const lang = s.outputLang || "";
    const mode = s.writingMode || "continue";

    const myToken = ++generationToken;
    showLoading();
    try {
        const result = await generate(inst, mode, genre, tone, lang, person, name3rd, lm, tn, () => updateLoadingMessage("AI 대필 중…"), um);
        if (myToken !== generationToken) return;
        hideLoading();
        // 결과 모달 없이 바로 인풋에 삽입
        const combined = um ? `${um}\n${result}` : result;
        insertToInput(combined, genre, mode, inst, !!um);
    } catch (e) {
        if (myToken !== generationToken) return;
        hideLoading();
        showError(e.message || "생성 실패. ST API 연결 상태를 확인해 주세요.");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Injection
// ─────────────────────────────────────────────────────────────────────────────

let wandDone  = false;
let panelDone = false;

function buildPanelHtml() {
    return `
<div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
        <b>✍️ 한마디</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
        <div id="dp-panel" class="dp-panel ${tc()}">

            <div class="dp-row">
                <label class="dp-label">퀵 모드</label>
                <div class="dp-genre-row">
                    <label class="dp-toggle" title="켜면 버튼 한 번으로 바로 대필 생성">
                        <input type="checkbox" id="dp-panel-quickmode">
                        <span class="dp-toggle-slider"></span>
                    </label>
                    <span class="dp-hint" style="margin-left:8px;"><i class="fa-solid fa-pen-nib"></i> 바로 생성, 설정은 <i class="fa-solid fa-palette"></i> 버튼으로</span>
                </div>
            </div>

            <div class="dp-row">
                <label class="dp-label">백그라운드 생성</label>
                <div class="dp-genre-row">
                    <label class="dp-toggle" title="켜면 채팅 화면에 생성 중 표시 없이 조용히 생성">
                        <input type="checkbox" id="dp-panel-bggen">
                        <span class="dp-toggle-slider"></span>
                    </label>
                    <span class="dp-hint" style="margin-left:8px;">채팅 UI에 생성 중 표시 없이 조용히 생성</span>
                </div>
            </div>

            <div class="dp-row">
                <label class="dp-label">대필 버튼 아이콘</label>
                <div class="dp-icon-picker" id="dp-pen-icons">
                    <div class="dp-icon-opt" data-icon="fa-pen-nib"><i class="fa-solid fa-pen-nib"></i></div>
                    <div class="dp-icon-opt" data-icon="fa-pen-fancy"><i class="fa-solid fa-pen-fancy"></i></div>
                    <div class="dp-icon-opt" data-icon="fa-pen"><i class="fa-solid fa-pen"></i></div>
                    <div class="dp-icon-opt" data-icon="fa-pencil"><i class="fa-solid fa-pencil"></i></div>
                    <div class="dp-icon-opt" data-icon="e-pencil">✏️</div>
                    <div class="dp-icon-opt" data-icon="e-memo">📝</div>
                    <div class="dp-icon-opt" data-icon="e-pen">🖊️</div>
                    <div class="dp-icon-opt" data-icon="e-brush">🖌️</div>
                    <div class="dp-icon-opt" data-icon="e-writing">✍️</div>
                    <div class="dp-icon-opt" data-icon="e-speech">💬</div>
                </div>
                <div class="dp-color-picker" id="dp-pen-colors">
                    <div class="dp-color-dot" data-color="inherit" style="background:var(--SmartThemeBodyColor,#bbb)"></div>
                    <div class="dp-color-dot" data-color="rainbow" style="background:linear-gradient(135deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF)"></div>
                    <div class="dp-color-dot" data-color="pink-purple" style="background:linear-gradient(135deg,#f472b6,#a78bfa)"></div>
                    <div class="dp-color-dot" data-color="coral" style="background:linear-gradient(135deg,#FF6B6B,#ff8e53)"></div>
                    <div class="dp-color-dot" data-color="mint-blue" style="background:linear-gradient(135deg,#34d399,#3b82f6)"></div>
                    <div class="dp-color-dot" data-color="blue" style="background:#4D96FF"></div>
                    <div class="dp-color-dot" data-color="red" style="background:#e74c3c"></div>
                    <div class="dp-color-dot" data-color="black" style="background:#222"></div>
                    <div class="dp-color-dot" data-color="navy" style="background:#1e3a5f"></div>
                    <div class="dp-color-dot" data-color="gray" style="background:#888"></div>
                </div>
            </div>

            <div class="dp-row">
                <label class="dp-label">설정 버튼 아이콘 <span class="dp-hint">(퀵 모드)</span></label>
                <div class="dp-icon-picker" id="dp-set-icons">
                    <div class="dp-icon-opt" data-icon="fa-palette"><i class="fa-solid fa-palette"></i></div>
                    <div class="dp-icon-opt" data-icon="fa-gear"><i class="fa-solid fa-gear"></i></div>
                    <div class="dp-icon-opt" data-icon="fa-sliders"><i class="fa-solid fa-sliders"></i></div>
                    <div class="dp-icon-opt" data-icon="fa-wand-magic-sparkles"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
                    <div class="dp-icon-opt" data-icon="e-palette">🎨</div>
                    <div class="dp-icon-opt" data-icon="e-gear">⚙️</div>
                    <div class="dp-icon-opt" data-icon="e-sparkles">✨</div>
                    <div class="dp-icon-opt" data-icon="e-wrench">🔧</div>
                    <div class="dp-icon-opt" data-icon="e-magic">🪄</div>
                    <div class="dp-icon-opt" data-icon="e-crystal">🔮</div>
                </div>
                <div class="dp-color-picker" id="dp-set-colors">
                    <div class="dp-color-dot" data-color="inherit" style="background:var(--SmartThemeBodyColor,#bbb)"></div>
                    <div class="dp-color-dot" data-color="rainbow" style="background:linear-gradient(135deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF)"></div>
                    <div class="dp-color-dot" data-color="pink-purple" style="background:linear-gradient(135deg,#f472b6,#a78bfa)"></div>
                    <div class="dp-color-dot" data-color="coral" style="background:linear-gradient(135deg,#FF6B6B,#ff8e53)"></div>
                    <div class="dp-color-dot" data-color="mint-blue" style="background:linear-gradient(135deg,#34d399,#3b82f6)"></div>
                    <div class="dp-color-dot" data-color="blue" style="background:#4D96FF"></div>
                    <div class="dp-color-dot" data-color="red" style="background:#e74c3c"></div>
                    <div class="dp-color-dot" data-color="black" style="background:#222"></div>
                    <div class="dp-color-dot" data-color="navy" style="background:#1e3a5f"></div>
                    <div class="dp-color-dot" data-color="gray" style="background:#888"></div>
                </div>
            </div>

            <div class="dp-row">
                <label class="dp-label">연결 프로필</label>
                <div class="dp-genre-row">
                    <select id="dp-panel-profile" class="dp-select">
                        <option value="">현재 활성 프로필 사용</option>
                    </select>
                    <button id="dp-panel-profile-refresh" class="dp-btn dp-btn-sm" title="프로필 목록 새로고침">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
                <span class="dp-hint">선택하면 대필 생성할 때만 잠깐 이 프로필로 전환했다가, 끝나면 원래 프로필로 자동 복구돼.</span>
            </div>

        </div>
    </div>
</div>`;
}

async function populateProfileSelect(preserveCurrent = true) {
    const sel = document.getElementById("dp-panel-profile");
    if (!sel) return;
    const s = getSettings();
    const keep = preserveCurrent ? (sel.value || s.profileName) : "";

    sel.innerHTML = `<option value="">현재 활성 프로필 사용</option>`;
    try {
        const res = await execSlash("/profile-list");
        console.log("[한마디] /profile-list 원본 응답:", res);
        if (res == null) {
            console.warn("[한마디] execSlash가 null을 반환함 — executeSlashCommandsWithOptions를 못 찾았거나 ST 초기화가 안 끝난 상태일 수 있음");
        }
        const names = JSON.parse(res?.pipe ?? "[]");
        console.log("[한마디] 파싱된 프로필 목록:", names);
        if (!names.length) {
            console.warn("[한마디] 프로필 목록이 비어있음 — ST의 '연결 프로필(Connection Profiles)' 기능이 켜져 있고 프로필이 저장되어 있는지 확인한마디.");
        }
        for (const n of names) {
            if (!n) continue;
            const opt = document.createElement("option");
            opt.value = n;
            opt.textContent = n;
            sel.appendChild(opt);
        }
    } catch (e) {
        console.warn("[한마디] 프로필 목록 조회 실패:", e.message, e);
    }
    sel.value = keep && [...sel.options].some(o => o.value === keep) ? keep : "";
}

function injectPanel() {
    if (panelDone) return;
    const target = document.getElementById("extensions_settings");
    if (!target) return;
    target.insertAdjacentHTML("beforeend", buildPanelHtml());
    panelDone = true;

    // 퀵 모드 토글
    const qmToggle = document.getElementById("dp-panel-quickmode");
    if (qmToggle) {
        const s = getSettings();
        qmToggle.checked = s.quickMode;
        qmToggle.addEventListener("change", () => {
            s.quickMode = qmToggle.checked;
            saveSettings();
            updateWandMode();
        });
    }

    // 백그라운드 생성 토글
    const bgToggle = document.getElementById("dp-panel-bggen");
    if (bgToggle) {
        const s0 = getSettings();
        bgToggle.checked = s0.bgGenerate;
        bgToggle.addEventListener("change", () => {
            s0.bgGenerate = bgToggle.checked;
            saveSettings();
        });
    }

    // 아이콘 커스터마이즈
    const s = getSettings();
    function setupPicker(containerId, settingKey, onApply) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll(".dp-icon-opt, .dp-color-dot").forEach(el => {
            const val = el.dataset.icon || el.dataset.color;
            if (val === s[settingKey]) el.classList.add("dp-sel");
            el.addEventListener("click", () => {
                container.querySelectorAll(".dp-icon-opt, .dp-color-dot").forEach(e => e.classList.remove("dp-sel"));
                el.classList.add("dp-sel");
                s[settingKey] = val;
                saveSettings();
                refreshWandIcons();
            });
        });
    }
    setupPicker("dp-pen-icons", "penIcon");
    setupPicker("dp-pen-colors", "penColor");
    setupPicker("dp-set-icons", "settingsIcon");
    setupPicker("dp-set-colors", "settingsColor");

    populateProfileSelect();
    // ST 슬래시커맨드 등록이 약간 늦게 끝나는 경우를 대비한 재시도
    setTimeout(() => populateProfileSelect(), 2000);
    console.log("[한마디] ✅ 패널 주입 완료");
}

function injectWand() {
    if (wandDone || document.getElementById("dp-wand")) { wandDone = true; updateWandMode(); return; }
    const s = getSettings();
    const btn = document.createElement("div");
    btn.id = "dp-wand"; btn.className = "dp-wand"; btn.title = "한마디 — 인풋 대필";
    btn.innerHTML = renderIconHtml(s.penIcon, s.penColor);
    btn.addEventListener("click", triggerGenerate);
    for (const sel of ["#leftSendForm","#extensionsSendButton","#send_form","#rightSendForm"]) {
        const el = document.querySelector(sel);
        if (el) { el.appendChild(btn); wandDone = true; console.log(`[한마디] ✅ 완드 버튼 → ${sel}`); updateWandMode(); return; }
    }
}

function refreshWandIcons() {
    const s = getSettings();
    const wand = document.getElementById("dp-wand");
    if (wand) wand.innerHTML = renderIconHtml(s.penIcon, s.penColor);
    const settingsBtn = document.getElementById("dp-wand-settings");
    if (settingsBtn) settingsBtn.innerHTML = renderIconHtml(s.settingsIcon, s.settingsColor);
}

function updateWandMode() {
    const s = getSettings();
    const wand = document.getElementById("dp-wand");
    if (!wand) return;
    let settingsBtn = document.getElementById("dp-wand-settings");
    if (s.quickMode) {
        wand.title = "한마디 — 바로 대필";
        if (!settingsBtn) {
            settingsBtn = document.createElement("div");
            settingsBtn.id = "dp-wand-settings";
            settingsBtn.className = "dp-wand dp-wand-settings";
            settingsBtn.title = "한마디 — 대필 설정";
            settingsBtn.innerHTML = renderIconHtml(s.settingsIcon, s.settingsColor);
            settingsBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                showSettingsPopup();
            });
            wand.parentElement.insertBefore(settingsBtn, wand);
        }
    } else {
        wand.title = "한마디 — 인풋 대필";
        if (settingsBtn) settingsBtn.remove();
    }
}

function tryInject() {
    if (!wandDone)  injectWand();
    if (!panelDone) injectPanel();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────────────────────────────

jQuery(async () => {
    console.log("[한마디] 확장 로드 시작");

    try {
        const m = await import("../../../../script.js");
        stGenerate = m.generateQuietPrompt ?? null;
        stGenerateRaw = m.generateRaw ?? null;
        stSave     = m.saveSettingsDebounced ?? null;
        stGetCtx   = m.getContext ?? null;
    } catch (e) { console.warn("[한마디] script.js import 실패:", e.message); }

    try {
        const m = await import("../../../extensions.js");
        stSettings = m.extension_settings ?? null;
    } catch (e) { stSettings = window.extension_settings ?? null; }

    try {
        const m = await import("../../../power-user.js");
        stPowerUser = m.power_user ?? null;
    } catch (e) { stPowerUser = window.power_user ?? null; }

    stGenerate  ??= window.generateQuietPrompt  ?? null;
    stGenerateRaw ??= window.generateRaw        ?? null;
    stSave      ??= window.saveSettingsDebounced ?? null;
    stGetCtx    ??= window.getContext            ?? null;
    stSettings  ??= window.extension_settings    ?? null;
    stPowerUser ??= window.power_user            ?? null;

    tryInject();

    const observer = new MutationObserver(() => { tryInject(); syncTheme(); });
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:["class","style"] });

    const poll = setInterval(() => {
        tryInject();
        if (wandDone && panelDone) { clearInterval(poll); }
    }, 500);
    setTimeout(() => clearInterval(poll), 60000);

    // 이벤트

    $(document)
        .on("change", "#dp-panel-profile", function () {
            const s = getSettings();
            s.profileName = this.value || "";
            saveSettings();
        })
        .on("click", "#dp-panel-profile-refresh", function () {
            populateProfileSelect();
        });

    console.log("[한마디] 초기화 완료");
});
