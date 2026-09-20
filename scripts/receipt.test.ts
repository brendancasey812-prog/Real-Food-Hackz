// What the paste-a-receipt parser has to cope with.
//
// Receipts are not one format. The emailed kind writes "$4.99"; the till kind
// prints a bare "4.99" and a tax letter, and often has no per-unit column at
// all. Every sample below is a shape a real shop hands out, and the job of
// this file is to fail loudly when one of them stops being read.

import { parseReceiptText } from "../src/lib/receipttext";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { failures++; console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
  else console.log(`ok   ${name}`);
}

/** Item names and line totals, which is what every sample is really asserting. */
const read = (text: string) =>
  parseReceiptText(text).map((l) => [l.food, l.total] as const);

// 1. A plain till receipt: no dollar signs, no unit column, a tax letter.
check("bare till", read(`
SAFEWAY
BANANAS                 2.60
WHOLE MILK GAL          4.99 F
PAPER TOWELS            8.99 T
TOTAL                  16.58
`), [["bananas", 2.6], ["milk", 4.99], ["paper towels", 8.99]]);

// 2. The emailed kind, with dollar signs.
check("emailed", read(`
PRODUCE
Bananas - 2.63lb @0.99/lb\t$2.60
Quantity: 1
Organic Spinach Bag 5oz\t$3.99
`), [["bananas", 2.6], ["spinach", 3.99]]);

// 3. Full till format, with its own amount and unit-price columns.
check("full till", read(`
7\tWHITE ONIONS\t0.44 lb\t1.09\t0.48\tF
12\tCHICKEN THIGHS\t2.15 lb\t3.99\t8.58\tF
`), [["white onions", 0.48], ["chicken thighs", 8.58]]);

// 4. A counted multiple: "2 @ 1.29".
check("multiples", read(`
GREEK YOGURT     2 @ 1.29        2.58
`), [["greek yogurt", 2.58]]);

// 5. Weighed, till style, without a dollar sign.
check("weighed bare", read(`
RED GRAPES
   1.86 lb @ 2.99 /lb          5.56
`), [["red grapes", 5.56]]);

// 6. Totals, tenders and savings are never items.
check("not items", read(`
SUBTOTAL               16.58
SALES TAX               0.79
TOTAL                  17.37
VISA                   17.37
CHANGE                  0.00
MEMBER SAVINGS          3.20
`), []);

// 7. Nothing usable at all still parses, to nothing, rather than throwing.
check("gibberish", read("hello there\nno prices here"), []);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
