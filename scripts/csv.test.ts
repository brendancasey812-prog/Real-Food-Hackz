// What the shared CSV engine has to cope with, and what a receipt export has
// to survive round-tripping through it. Every sample below is a shape a real
// spreadsheet export (or a person editing one by hand) can produce.

import { parseCsv, stringifyCsv, csvToRecords } from "../src/lib/csv";
import { scannedItemsToCsv, csvToScannedItems } from "../src/lib/receipt";
import type { ScannedItem } from "../src/lib/types";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { failures++; console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
  else console.log(`ok   ${name}`);
}

// 1. Plain cells, comma-separated.
check("plain", parseCsv("a,b,c\n1,2,3"), [["a", "b", "c"], ["1", "2", "3"]]);

// 2. A quoted cell containing a comma.
check("quoted comma", parseCsv('name,note\n"Ground Beef, 80/20",fresh'), [
  ["name", "note"],
  ["Ground Beef, 80/20", "fresh"],
]);

// 3. A quoted cell containing an embedded newline — the case a per-line
// splitter can never get right.
check("quoted newline", parseCsv('name,note\n"multi\nline",ok'), [
  ["name", "note"],
  ["multi\nline", "ok"],
]);

// 4. Escaped ("" doubled) quotes inside a quoted field.
check("doubled quote", parseCsv('name\n"He said ""hi"""'), [
  ["name"],
  ['He said "hi"'],
]);

// 5. CRLF line endings (Excel/Windows export) and a lone CR.
check("crlf", parseCsv("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
check("bare cr", parseCsv("a,b\r1,2"), [["a", "b"], ["1", "2"]]);

// 6. A UTF-8 BOM at the start of the file (very common from Excel "Save As CSV").
check("bom", parseCsv("﻿a,b\n1,2"), [["a", "b"], ["1", "2"]]);

// 7. A ragged row — fewer cells than the header — doesn't crash the mapper.
{
  const rows = parseCsv("Food,Quantity,Unit\nEggs,12,each\nMilk");
  const { records } = csvToRecords(rows, { food: ["food"], quantity: ["quantity"], unit: ["unit"] } as const);
  check("ragged row padded", records[1], { food: "Milk", quantity: "", unit: "" });
}

// 8. Trailing blank lines are dropped, not turned into empty rows.
check("trailing blank lines", parseCsv("a,b\n1,2\n\n\n"), [["a", "b"], ["1", "2"]]);

// 9. Header matching is case/punctuation tolerant and order-independent.
{
  const rows = parseCsv("QTY,Food Name,unit\n2,Bananas,each");
  const { records } = csvToRecords(rows, {
    food: ["food", "foodname", "item"],
    quantity: ["qty", "quantity"],
    unit: ["unit"],
  } as const);
  check("tolerant header", records[0], { food: "Bananas", quantity: "2", unit: "each" });
}

// 10. Write → parse round-trips exactly, including a value that needed quoting.
{
  const rows = [
    ["Food", "Note"],
    ["Ground Beef, 80/20", 'said "hi"\nnext line'],
    ["Plain", "value"],
  ];
  const out = parseCsv(stringifyCsv(rows));
  check("write/parse round trip", out, rows);
}

// ---- Receipt-specific round trip ----

const items: ScannedItem[] = [
  { category: "Protein", food: "Ground Beef", variant: "80/20", quantity: 1, unit: "lb", estimated: false },
  { category: "Fruit", food: "Bananas, organic", variant: "", quantity: 6, unit: "each", estimated: true },
  { category: "Pantry", food: 'Marinara Sauce "Family Size"', variant: "", quantity: 2, unit: "each", estimated: false },
];

// 11. Exporting and re-importing the same items yields the same items.
{
  const csv = scannedItemsToCsv(items);
  const { items: back, errors } = csvToScannedItems(csv);
  check("receipt csv round trip", back, items);
  check("receipt csv round trip — no errors", errors.length, 0);
}

// 12. A hand-edited CSV with reordered/renamed columns and a bad row still
// imports what it can, and reports what it can't.
{
  const csv = [
    "Qty,Item,Food Type",
    "3,Eggs,Protein",
    "not-a-number,Broken Row,Pantry",
    ",Missing Quantity,Pantry",
  ].join("\n");
  const { items: back, errors } = csvToScannedItems(csv);
  check("tolerant import — good rows", back, [
    { category: "Protein", food: "Eggs", variant: "", quantity: 3, unit: "each", estimated: false },
  ]);
  check("tolerant import — error count", errors.length, 2);
}

// 13. A file with no recognizable header is reported clearly, not silently
// empty.
{
  const { items: back, errors } = csvToScannedItems("just,some,prose\nwith no,real,header");
  check("no header — empty", back, []);
  check("no header — error", errors.length > 0, true);
}

console.log(failures ? `\n${failures} failure(s).` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
