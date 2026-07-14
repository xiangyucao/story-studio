import type { Project, WritingLanguage } from "./types";

export type ResolvedWritingLanguage = Exclude<WritingLanguage, "auto">;

export const writingLanguageOptions: Array<{ value: WritingLanguage; label: string }> = [
  { value: "auto", label: "自动识别 / Auto detect" },
  { value: "zh-CN", label: "简体中文" }, { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" }, { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" }, { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" }, { value: "pt-BR", label: "Português" },
  { value: "it", label: "Italiano" }, { value: "ko", label: "한국어" },
];

const specs: Record<ResolvedWritingLanguage, { label: string; directive: string }> = {
  "zh-CN": { label: "简体中文", directive: "要求使用简体中文写作。所有创作性正文、标题、摘要、对话和叙述只能使用简体中文。不要因为指令或资料标签使用其他语言而切换语言。" },
  "zh-TW": { label: "繁體中文", directive: "要求使用繁體中文寫作。所有創作性正文、標題、摘要、對話和敘述只能使用繁體中文。不要因為指令或資料標籤使用其他語言而切換語言。" },
  en: { label: "English", directive: "The required writing language is English. All creative prose, titles, summaries, dialogue, and narrative text must be written only in English. Do not switch languages because instructions or metadata labels use another language." },
  de: { label: "Deutsch", directive: "Die vorgeschriebene Schreibsprache ist Deutsch. Alle kreativen Texte, Titel, Zusammenfassungen, Dialoge und Erzählpassagen dürfen nur auf Deutsch verfasst werden. Wechsle die Sprache nicht, nur weil Anweisungen oder Metadaten eine andere Sprache verwenden." },
  es: { label: "Español", directive: "El idioma de escritura obligatorio es el español. Toda la prosa creativa, los títulos, resúmenes, diálogos y textos narrativos deben escribirse únicamente en español. No cambies de idioma porque las instrucciones o los metadatos estén en otro idioma." },
  fr: { label: "Français", directive: "La langue d’écriture obligatoire est le français. Toute prose créative, tout titre, résumé, dialogue et texte narratif doivent être rédigés uniquement en français. Ne changez pas de langue parce que les instructions ou les métadonnées utilisent une autre langue." },
  ja: { label: "日本語", directive: "執筆言語は日本語です。創作本文、タイトル、要約、会話、地の文はすべて日本語のみで書いてください。指示やメタデータが別の言語で書かれていても、執筆言語を変更しないでください。" },
  "pt-BR": { label: "Português", directive: "O idioma obrigatório de escrita é o português. Toda prosa criativa, títulos, resumos, diálogos e textos narrativos devem ser escritos somente em português. Não mude de idioma porque as instruções ou os metadados estejam em outro idioma." },
  it: { label: "Italiano", directive: "La lingua di scrittura obbligatoria è l’italiano. Tutta la prosa creativa, i titoli, i riassunti, i dialoghi e il testo narrativo devono essere scritti esclusivamente in italiano. Non cambiare lingua solo perché istruzioni o metadati usano un’altra lingua." },
  ko: { label: "한국어", directive: "필수 집필 언어는 한국어입니다. 창작 본문, 제목, 요약, 대화와 서술은 모두 한국어로만 작성하세요. 지시문이나 메타데이터가 다른 언어로 되어 있어도 집필 언어를 바꾸지 마세요." },
};

const stopwords: Record<"en" | "de" | "es" | "fr" | "pt-BR" | "it", Set<string>> = {
  en: new Set("the and of to in is that with for as on from this are was be by not it".split(" ")),
  de: new Set("der die das und ist ein eine mit zu den von nicht im auf für sich dem des".split(" ")),
  es: new Set("el la los las que del una para con por como más pero sus este esta desde".split(" ")),
  fr: new Set("le la les des est une que dans pour avec sur pas plus mais cette aux du".split(" ")),
  "pt-BR": new Set("que não uma para com por mais como dos das seu sua esta esse pelo pela".split(" ")),
  it: new Set("il lo gli le che una per con non più come del della nel questo questa sono".split(" ")),
};

function inferLatinLanguage(text: string): ResolvedWritingLanguage | null {
  const words = text.toLocaleLowerCase().match(/\p{Letter}+(?:['’\-]\p{Letter}+)*/gu) || [];
  if (words.length < 3) return null;
  const scores = Object.entries(stopwords).map(([code, wordsForLanguage]) => ({ code: code as keyof typeof stopwords, score: words.reduce((sum, word) => sum + (wordsForLanguage.has(word) ? 1 : 0), 0) }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores[0].code : "en";
}

function inferFromText(text: string): ResolvedWritingLanguage | null {
  const japanese = text.match(/[\u3040-\u30ff]/g)?.length || 0;
  if (japanese >= 2) return "ja";
  const korean = text.match(/[\uac00-\ud7af]/g)?.length || 0;
  if (korean >= 2) return "ko";
  const cjk = text.match(/[\u3400-\u9fff]/g)?.length || 0;
  const latinWords = text.match(/\p{Letter}+/gu)?.filter((word) => /[A-Za-zÀ-ž]/.test(word)).length || 0;
  if (latinWords >= 3 && latinWords >= cjk * 0.65) return inferLatinLanguage(text);
  if (cjk >= 2) {
    const traditionalHints = text.match(/[體與為這個來時會說書後裡還點開關係寫實應該讓]/g)?.length || 0;
    return traditionalHints >= 3 ? "zh-TW" : "zh-CN";
  }
  return null;
}

export function resolveWritingLanguage(project: Project, priorityText: string[] = []) {
  const configured = project.writingLanguage || "auto";
  const code = configured === "auto"
    ? inferFromText(priorityText.filter(Boolean).join("\n"))
      || inferFromText([project.title, project.genre, project.premise, project.styleGuide, project.referenceText.slice(0, 5000)].join("\n"))
      || "zh-CN"
    : configured;
  return { code, ...specs[code] };
}
