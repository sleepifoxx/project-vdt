// Vietnamese text utilities for search

// NFC Vietnamese characters decompose via NFD + strip U+0300..U+036F combining marks
// back to base ASCII. Character count is preserved, so index mappings into the
// original string remain valid after normalization.
export function removeVietnameseTones(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks (U+0300..U+036F)
        .replace(/đ/g, 'd')  // đ does not decompose via NFD
        .replace(/Đ/g, 'D'); // Đ
}

// Returns true if normalized `query` is a substring of normalized `target`.
// Enables matching without-tone input against with-tone data: "ban do" finds "ban do".
export function vietnameseIncludes(query: string, target: string): boolean {
    const q = removeVietnameseTones(query).toLowerCase();
    const t = removeVietnameseTones(target).toLowerCase();
    return t.includes(q);
}

// Returns start index of `query` inside `target` after normalizing both, or -1.
// The index is into the ORIGINAL target string (1-to-1 char mapping holds after NFD-strip).
export function vietnameseIndexOf(query: string, target: string): number {
    const q = removeVietnameseTones(query).toLowerCase();
    const t = removeVietnameseTones(target).toLowerCase();
    return t.indexOf(q);
}

// Builds a DataHub search query with wildcard suffix on each word so that partial /
// incomplete words match: "ban do" -> "ban* do*" finds anything starting with those prefixes.
export function buildSmartQuery(keyword: string): string {
    if (!keyword || !keyword.trim()) return '*';
    const trimmed = keyword.trim();
    if (trimmed === '*') return '*';

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '*';

    return words.map((w) => `${w}*`).join(' ');
}
