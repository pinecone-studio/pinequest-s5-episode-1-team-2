/**
 * Mongolian spelling rules every AI reply in the app must follow. Shared by the companion,
 * the walking games and the camera's scene description, so they all write the same way.
 */
export const MONGOLIAN_GRAMMAR_RULES = `
МОНГОЛ ХЭЛНИЙ ЗӨВ БИЧИХ ДҮРЭМ (заавал мөрд):
- Монгол кириллийн зөв бичгийн дүрмээр бич. Орос, англи үг, латин үсэг бүү хэрэглэ.
- Нөхцөл, залгаврыг үгэнд шууд залга, зураас бүү тавь: "Тэмүүлэнд", "сургуульд", "Милог" (буруу: "Тэмүүлэн-д").
- Эгшиг зохицох ёсыг баримтал: эр үгэнд эр эгшигтэй, эм үгэнд эм эгшигтэй нөхцөл залга ("гэрээс", "хотоос", "ааваас", "Тэмүүлэнтэй", "Болдтой").
- "руу/рүү", "уу/үү" сул үгийг эгшиг зохицолоор нь сонго ("гэр рүү", "сургууль руу", "Сайн уу?", "Бэлэн үү?").
- Олон тоог зөв хэлбэрээр бич ("модод" эсвэл "мод", буруу: "моднууд").
- Хүнийг дуудахдаа нэрийн дараа таслал тавь: "Тэмүүлэн, ...".
- Асуух өгүүлбэрийг "?"-ээр, бусдыг "." эсвэл "!"-ээр төгсгө. "юу вэ", "хаана вэ", "уу/үү"-гээр төгссөн өгүүлбэр асуулт тул "?" тавь.
- Тоог хүүхдэд ойлгомжтой үсгээр бич ("гурван", "тав").
`;

// Case suffixes an AI sometimes hyphenates onto a Cyrillic word. Only all-lowercase suffixes are
// joined, so hyphenated place names such as "Хан-Уул" stay intact.
const HYPHENATED_SUFFIX = /([А-Яа-яЁёӨөҮү])-(д|т|г|ыг|ийг|ын|ийн|ний|ы|ий|аас|ээс|оос|өөс|иас|иос|аар|ээр|оор|өөр|тай|тэй|той)(?=[\s.,!?;:]|$)/gu;
// A question that ends with a question word but got a full stop.
const QUESTION_WITH_PERIOD = /(\s(?:уу|үү|юу|юү|вэ|бэ))\.(?=\s|$)/gu;

// After a soft sign, a suffix starting with a vowel turns the "ь" into "и": сургууль → сургуулиас, сургуулийг.
const AFTER_SOFT_SIGN: Record<string, string> = {
  ыг: "ийг", ийг: "ийг", ын: "ийн", ийн: "ийн", ы: "ий", ий: "ий",
  аас: "иас", оос: "иос", аар: "иар", оор: "иор", иас: "иас", иос: "иос",
};

function joinSuffix(_match: string, letter: string, suffix: string) {
  if (letter === "ь" && AFTER_SOFT_SIGN[suffix]) return `и${AFTER_SOFT_SIGN[suffix].slice(1)}`;
  return letter + suffix;
}

/** Fixes the mechanical slips an AI reply can still contain: hyphenated suffixes and question marks. */
export function tidyMongolianText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(HYPHENATED_SUFFIX, joinSuffix)
    .replace(QUESTION_WITH_PERIOD, "$1?")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();
}
