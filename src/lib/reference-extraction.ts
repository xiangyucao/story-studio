export type ReferenceCandidate = { id: string; text: string; position: number };

function splitLongBlock(block: string, maxLength: number) {
  if (block.length <= maxLength) return [block];
  const sentences = block.match(/[^。！？!?]+[。！？!?]?/g)?.map((item) => item.trim()).filter(Boolean) || [block];
  const pieces: string[] = [];
  let current = "";
  sentences.forEach((sentence) => {
    if (sentence.length > maxLength) {
      if (current) { pieces.push(current); current = ""; }
      for (let offset = 0; offset < sentence.length; offset += maxLength) pieces.push(sentence.slice(offset, offset + maxLength));
    } else if (!current || current.length + sentence.length <= maxLength) {
      current += sentence;
    } else {
      pieces.push(current);
      current = sentence;
    }
  });
  if (current) pieces.push(current);
  return pieces;
}

export function buildReferenceCandidates(text: string, maxLength = 900) {
  const raw = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const pieces = raw.flatMap((block) => splitLongBlock(block, maxLength));
  const grouped: string[] = [];
  let current = "";
  pieces.forEach((piece) => {
    if (!current || current.length + piece.length + 2 <= maxLength) current += `${current ? "\n\n" : ""}${piece}`;
    else { grouped.push(current); current = piece; }
  });
  if (current) grouped.push(current);
  return grouped.map((candidate, index): ReferenceCandidate => ({ id: `R${String(index + 1).padStart(4, "0")}`, text: candidate, position: index }));
}

export function selectReferenceCandidates(rawResponse: string, candidates: ReferenceCandidate[], targetLength: number) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const ids = [...new Set(rawResponse.match(/R\d{4}/gi)?.map((id) => id.toUpperCase()) || [])];
  const selected = ids.map((id) => byId.get(id)).filter((candidate): candidate is ReferenceCandidate => Boolean(candidate));
  if (!selected.length) throw new Error("模型没有返回有效的范本段落编号，已保留当前范本");
  selected.sort((a, b) => a.position - b.position);
  const maximum = Math.max(1200, Math.round(targetLength * 1.2));
  const accepted: ReferenceCandidate[] = [];
  let length = 0;
  selected.forEach((candidate) => {
    if (accepted.length && length + candidate.text.length > maximum) return;
    accepted.push(candidate);
    length += candidate.text.replace(/\s/g, "").length;
  });
  if (length < Math.min(500, Math.round(targetLength * 0.25))) throw new Error("模型选择的代表段落太少，已保留当前范本，请重试");
  return accepted.map((candidate) => candidate.text).join("\n\n---\n\n");
}
