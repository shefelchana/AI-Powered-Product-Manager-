// Слово хранится без огласовок: в жизни текст без никуд, и сверка ответа
// их всё равно не считает. Огласованная форма приходит из Pealim и
// показывается на раскрытии, а не в самом термине.
const NIQQUD = /[֑-ׇ]/g;

export function bareTerm(value, max = 200) {
  return (typeof value === "string" ? value : "").replace(NIQQUD, "").replace(/\s+/g, " ").trim().slice(0, max);
}
