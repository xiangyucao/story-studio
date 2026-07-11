export function firstChapterHeading(text: string) {
  for (const line of text.split(/\r?\n/).slice(0, 8)) {
    const match = line.trim().match(/^(?:#{1,6}\s*)?(第\s*[0-9一二三四五六七八九十百]+\s*章[^\n]*)/);
    if (match) return match[1].trim();
  }
  return null;
}

export function chapterNumber(title: string) {
  return title.match(/第\s*([0-9一二三四五六七八九十百]+)\s*章/)?.[1] || null;
}

export function hasWrongChapterHeading(result: string, targetTitle: string) {
  const returnedHeading = firstChapterHeading(result);
  const expectedNumber = chapterNumber(targetTitle);
  const returnedNumber = returnedHeading ? chapterNumber(returnedHeading) : null;
  return { returnedHeading, wrong: Boolean(expectedNumber && returnedNumber && expectedNumber !== returnedNumber) };
}
