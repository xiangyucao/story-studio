export function firstChapterHeading(text: string) {
  for (const line of text.split(/\r?\n/).slice(0, 8)) {
    const match = line.trim().match(/^(?:#{1,6}\s*)?((?:第\s*[0-9一二三四五六七八九十百零〇两]+\s*章[^\n]*|chapter\s+[0-9]+(?:\s*[:：.\-–—]\s*[^\n]*)?))\s*$/i);
    if (match) return match[1].trim();
  }
  return null;
}

export function chapterNumber(title: string) {
  return title.match(/第\s*([0-9一二三四五六七八九十百零〇两]+)\s*章/i)?.[1]
    || title.match(/chapter\s+([0-9]+)/i)?.[1]
    || null;
}

function chineseNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = { 零: 0, "〇": 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (!/[十百]/.test(value)) return [...value].reduce((number, digit) => number * 10 + (digits[digit] ?? 0), 0);
  let total = 0;
  let current = 0;
  for (const character of value) {
    if (character === "百") { total += (current || 1) * 100; current = 0; }
    else if (character === "十") { total += (current || 1) * 10; current = 0; }
    else current = digits[character] ?? current;
  }
  return total + current;
}

export function hasWrongChapterHeading(result: string, targetTitle: string) {
  const returnedHeading = firstChapterHeading(result);
  const expectedNumber = chapterNumber(targetTitle);
  const returnedNumber = returnedHeading ? chapterNumber(returnedHeading) : null;
  return { returnedHeading, wrong: Boolean(expectedNumber && returnedNumber && chineseNumber(expectedNumber) !== chineseNumber(returnedNumber)) };
}

/** Removes a model-generated heading so the separately stored chapter title is not printed twice. */
export function stripLeadingChapterHeading(text: string) {
  const heading = firstChapterHeading(text);
  if (!heading) return text.trim();
  const lines = text.trim().split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => {
    const normalized = line.trim().replace(/^#{1,6}\s*/, "");
    return normalized.toLocaleLowerCase() === heading.toLocaleLowerCase();
  });
  if (headingIndex < 0) return text.trim();
  lines.splice(headingIndex, 1);
  while (lines[0]?.trim() === "" || /^```(?:markdown|text)?$/i.test(lines[0]?.trim() || "")) lines.shift();
  if (lines.at(-1)?.trim() === "```") lines.pop();
  return lines.join("\n").trim();
}
