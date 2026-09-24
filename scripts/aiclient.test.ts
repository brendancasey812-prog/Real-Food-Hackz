// parseJsonLoose is the one JSON parser every AI-scan feature relies on to
// turn a vision-model reply into data. These are the malformed shapes a real
// model response (or a flaky one) can actually produce.

import { parseJsonLoose, ReceiptError } from "../src/lib/aiclient";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) { failures++; console.log(`FAIL ${name}${detail !== undefined ? `\n  ${JSON.stringify(detail)}` : ""}`); }
  else console.log(`ok   ${name}`);
}

const FALLBACK = "couldn't read it";

// 1. Plain JSON, no fence.
check("plain json", JSON.stringify(parseJsonLoose('{"a":1}', FALLBACK)) === '{"a":1}');

// 2. Fenced with ```json ... ```.
check("fenced json", JSON.stringify(parseJsonLoose('```json\n{"a":1}\n```', FALLBACK)) === '{"a":1}');

// 3. Fenced with a bare ``` (no "json" language tag).
check("bare fence", JSON.stringify(parseJsonLoose('```\n{"a":1}\n```', FALLBACK)) === '{"a":1}');

// 4. JSON preceded and followed by prose the model added despite instructions.
check(
  "surrounded by prose",
  JSON.stringify(parseJsonLoose('Sure, here is the JSON:\n{"a":1}\nLet me know if you need anything else!', FALLBACK)) === '{"a":1}',
);

// 5. Nested braces inside the JSON (an object value) don't confuse the
// {...} fallback regex.
check(
  "nested braces",
  JSON.stringify(parseJsonLoose('noise {"a":{"b":2},"c":[1,2,3]} trailing', FALLBACK)) === '{"a":{"b":2},"c":[1,2,3]}',
);

// 6. Genuinely unparsable text throws ReceiptError with the caller's message
// — never a raw SyntaxError leaking out.
{
  let threw: unknown;
  try { parseJsonLoose("not json at all, no braces here", FALLBACK); }
  catch (e) { threw = e; }
  check("unparsable throws ReceiptError", threw instanceof ReceiptError, threw);
  check("unparsable message is the caller's", threw instanceof ReceiptError && threw.message === FALLBACK);
}

// 7. A {...} block that LOOKS present but is itself malformed also throws
// the caller's message, not a SyntaxError.
{
  let threw: unknown;
  try { parseJsonLoose('prose { this is not valid json } more prose', FALLBACK); }
  catch (e) { threw = e; }
  check("malformed brace block throws ReceiptError", threw instanceof ReceiptError, threw);
}

// 8. Empty string input.
{
  let threw: unknown;
  try { parseJsonLoose("", FALLBACK); }
  catch (e) { threw = e; }
  check("empty string throws ReceiptError", threw instanceof ReceiptError, threw);
}

// 9. Whitespace-only fence markers around otherwise valid JSON with leading/
// trailing blank lines.
check(
  "fence with extra blank lines",
  JSON.stringify(parseJsonLoose('\n\n```json\n\n{"a":1}\n\n```\n\n', FALLBACK)) === '{"a":1}',
);

console.log(failures ? `\n${failures} failure(s).` : "\nAll aiclient checks passed.");
process.exit(failures ? 1 : 0);
