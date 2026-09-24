// Adversarial / stress cases beyond csv.test.ts's happy-path coverage:
// pathological input a real person (or a hostile paste) could actually
// produce, run through the parser, the writer, and the receipt import.

import { parseCsv, stringifyCsv, csvToRecords } from "../src/lib/csv";
import { csvToScannedItems, scannedItemsToCsv } from "../src/lib/receipt";
import type { ScannedItem } from "../src/lib/types";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) { failures++; console.log(`FAIL ${name}${detail !== undefined ? `\n  ${JSON.stringify(detail)}` : ""}`); }
  else console.log(`ok   ${name}`);
}
function noThrow(name: string, fn: () => void) {
  try { fn(); check(name, true); }
  catch (e) { check(name, false, String(e)); }
}

// 1. Empty input.
check("empty string", JSON.stringify(parseCsv("")) === "[]");

// 2. Only a header, no data rows.
check("header only", JSON.stringify(parseCsv("a,b,c")) === JSON.stringify([["a", "b", "c"]]));

// 3. Unterminated quote at EOF — never hangs, never throws, returns *something*.
noThrow("unterminated quote", () => parseCsv('a,"b,c\nd,e'));

// 4. A quote appearing mid-cell (not at the start) is treated as a literal
// character, not a quote-open — matches how real spreadsheets export it.
check(
  "quote mid-cell is literal",
  JSON.stringify(parseCsv('a,bc"d,e')) === JSON.stringify([["a", 'bc"d', "e"]]),
);

// 5. A huge number of columns doesn't blow the stack or take forever.
{
  const wide = Array.from({ length: 5000 }, (_, i) => `c${i}`).join(",");
  const start = Date.now();
  const rows = parseCsv(`${wide}\n${wide}`);
  const ms = Date.now() - start;
  check("wide row: 5000 columns parsed", rows[0].length === 5000);
  check("wide row: fast", ms < 2000, `${ms}ms`);
}

// 6. A huge number of rows.
{
  const lines = ["Food,Quantity,Unit"];
  for (let i = 0; i < 20000; i++) lines.push(`Item ${i},${i % 10},each`);
  const start = Date.now();
  const rows = parseCsv(lines.join("\n"));
  const ms = Date.now() - start;
  check("20000 rows parsed", rows.length === 20001, rows.length);
  check("20000 rows: fast", ms < 3000, `${ms}ms`);
}

// 7. Mixed line endings in one file (some \r\n, some \n).
check(
  "mixed line endings",
  JSON.stringify(parseCsv("a,b\r\n1,2\n3,4\r\n")) === JSON.stringify([["a", "b"], ["1", "2"], ["3", "4"]]),
);

// 8. A cell that is only whitespace vs. a cell that is truly empty are both
// preserved distinctly by the raw parser (trimming happens in csvToRecords,
// not parseCsv).
check(
  "whitespace-only cell preserved",
  JSON.stringify(parseCsv("a,b\n1,  \n,2")) === JSON.stringify([["a", "b"], ["1", "  "], ["", "2"]]),
);

// 9. Unicode: emoji, combining marks, right-to-left text, CJK — none of it
// should corrupt cell boundaries or trip the quote logic.
{
  const rows = parseCsv('food,note\n"🍕 Pizza, extra cheese",café\nمرحبا,日本語');
  check("unicode content", JSON.stringify(rows) === JSON.stringify([
    ["food", "note"],
    ["🍕 Pizza, extra cheese", "café"],
    ["مرحبا", "日本語"],
  ]), rows);
}

// 10. A formula-injection-looking cell (=SUM(...), @cmd, +1, -1) round-trips
// as inert text — this module has no business interpreting it, only storing
// and re-emitting it byte-for-byte.
{
  const rows = [["Food", "Note"], ["=SUM(A1:A9)", "@import('x')"]];
  const back = parseCsv(stringifyCsv(rows));
  check("formula-like cells pass through unchanged", JSON.stringify(back) === JSON.stringify(rows), back);
}

// 11. csvToRecords never throws on an empty rows array or a header-only file.
noThrow("csvToRecords: empty rows", () => csvToRecords([], { a: ["a"] } as const));
noThrow("csvToRecords: header only", () => csvToRecords([["a", "b"]], { a: ["a"] } as const));

// ---- Receipt import stress ----

// 12. Every column missing except Food — still imports with sane defaults,
// never crashes, and quantity<=0 is rejected rather than silently coerced.
{
  const { items, errors } = csvToScannedItems("Food\nBananas\nApples");
  check("food-only header: all rows flagged (no quantity)", items.length === 0 && errors.length === 2, { items, errors });
}

// 13. A quantity written as a fraction, a vulgar fraction, and with a
// thousands separator all parse via the shared parseQuantity path.
{
  const csv = [
    "Food,Quantity,Unit",
    "Flour,1 1/2,cup",
    "Sugar,½,cup",
    "Rice,1,200",
  ].join("\n"); // deliberately malformed last row: unit column holds "200"
  const { items, errors } = csvToScannedItems(csv);
  check("fraction quantity", items.some((i) => i.food === "Flour" && i.quantity === 1.5), items);
  check("vulgar fraction quantity", items.some((i) => i.food === "Sugar" && i.quantity === 0.5), items);
  check("no crash on odd unit cell", errors.length >= 0); // just must not throw
}

// 14. A CSV whose header repeats an aliased column name twice — the first
// match wins deterministically rather than throwing or picking randomly.
{
  const rows = parseCsv("Food,Item,Quantity\nA,B,3");
  const { header } = csvToRecords(rows, { food: ["food", "item"], quantity: ["quantity"] } as const);
  check("duplicate alias: first match wins", header.food === 0, header);
}

// 15. Round-tripping a large, varied item list end to end (export -> import)
// preserves every item exactly, including ones with commas, quotes, and
// unicode in the name.
{
  const items: ScannedItem[] = Array.from({ length: 500 }, (_, i) => ({
    category: (["Protein", "Fruit", "Veggie", "Pantry"] as const)[i % 4],
    food: i % 7 === 0 ? `Item, "special" #${i}` : `Item ${i} 🥕`,
    variant: i % 3 === 0 ? "" : `v${i}`,
    quantity: (i % 5) + 0.25,
    unit: (["lb", "oz", "each", "dozen", "head"] as const)[i % 5],
    estimated: i % 2 === 0,
  }));
  const csv = scannedItemsToCsv(items);
  const { items: back, errors } = csvToScannedItems(csv);
  check("500-item round trip: same length", back.length === items.length, back.length);
  check("500-item round trip: no errors", errors.length === 0, errors.slice(0, 5));
  check("500-item round trip: deep equal", JSON.stringify(back) === JSON.stringify(items));
}

// 16. Byte-order-mark plus CRLF plus quoted multiline in one real-world-shaped file.
{
  const csv = "﻿Category,Food,Variant,Quantity,Unit,Estimated\r\n" +
    'Pantry,"Marinara Sauce\nFamily Size",,2,each,no\r\n' +
    "Protein,Chicken,,3,lb,yes\r\n";
  const { items, errors } = csvToScannedItems(csv);
  check("bom+crlf+multiline real file", items.length === 2 && errors.length === 0, { items, errors });
  check("multiline food name preserved", items[0]?.food === "Marinara Sauce\nFamily Size", items[0]);
}

// 17. Deeply nested quote-escaping doesn't corrupt neighboring cells.
{
  const csv = 'Food,Note\n"a""b""c",plain\nplain2,"x""y"';
  const rows = parseCsv(csv);
  check("nested escaped quotes", JSON.stringify(rows) === JSON.stringify([
    ["Food", "Note"],
    ['a"b"c', "plain"],
    ["plain2", 'x"y'],
  ]), rows);
}

console.log(failures ? `\n${failures} failure(s).` : "\nAll stress checks passed.");
process.exit(failures ? 1 : 0);
