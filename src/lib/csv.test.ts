import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("separates with semicolons and rows with CRLF, for Excel on kk/ru locales", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a;b\r\nc;d");
  });

  it("writes decimals with a comma, because that is what those locales read as a number", () => {
    expect(toCsv([[0.75, 12, -3.5]])).toBe("0,75;12;-3,5");
  });

  it("leaves null, undefined and non-finite numbers as empty cells", () => {
    expect(toCsv([[null, undefined, NaN, Infinity, 0]])).toBe(";;;;0");
  });

  it("quotes cells that contain the separator, a quote or a line break", () => {
    expect(toCsv([["a;b", 'say "hi"', "line\nbreak"]])).toBe('"a;b";"say ""hi""";"line\nbreak"');
  });

  it("neutralises spreadsheet formulas in user-supplied text", () => {
    expect(toCsv([["=HYPERLINK(\"http://x\")"]])).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(toCsv([["+1", "-1", "@SUM(A1)"]])).toBe("'+1;'-1;'@SUM(A1)");
  });

  it("does not mangle real negative numbers", () => {
    expect(toCsv([[-5]])).toBe("-5");
  });

  it("keeps Cyrillic and Kazakh letters intact", () => {
    expect(toCsv([["Айгерім Болатқызы", "Ғ ң ө ұ ү қ ә і"]])).toBe("Айгерім Болатқызы;Ғ ң ө ұ ү қ ә і");
  });
});
