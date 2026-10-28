import { describe, expect, it } from "vitest";
import cases from "../../../tests/fixtures/mapping/cases.json";
import type { FixtureCase } from "../../../tests/fixtures/mapping/make-fixtures";
import { matchFields } from "./match";

const fixtures = cases as unknown as FixtureCase[];

type Tally = {
  correct: number;
  missed: number;
  wrong: number;
  wrongRule: number;
  details: string[];
};

/** Score the fixtures at one threshold: a wrong column is far worse than a missed one. */
function evaluate(threshold: number, confirmWords = true): Tally {
  const t: Tally = { correct: 0, missed: 0, wrong: 0, wrongRule: 0, details: [] };
  for (const c of fixtures) {
    const got = matchFields(c.fields, c.columns, { threshold, confirmWords });
    for (const m of got) {
      const want = c.expected[m.field];
      if (want === undefined)
        throw new Error(`fixture ${c.name} lacks an expectation for ${m.field}`);
      if (m.column === null) {
        if (want === null) t.correct++;
        else {
          t.missed++;
          t.details.push(`MISSED ${c.name}: ${m.field} wanted "${want.column}"`);
        }
      } else if (want?.column === m.column) {
        t.correct++;
        if (want.rule !== m.rule) {
          t.wrongRule++;
          t.details.push(`RULE ${c.name}: ${m.field} "${m.column}" ${m.rule}, wanted ${want.rule}`);
        }
      } else {
        t.wrong++;
        t.details.push(
          `WRONG ${c.name}: ${m.field} -> "${m.column}" (${m.rule}), wanted ${want?.column ?? "none"}`,
        );
      }
    }
  }
  return t;
}

describe("fuzzy threshold on the fixtures", () => {
  it("prints precision for candidate thresholds", () => {
    const rows = [0.1, 0.15, 0.25, 0.35, 0.45].flatMap((th) =>
      [true, false].map((confirm) => {
        const t = evaluate(th, confirm);
        return {
          threshold: th,
          wordCheck: confirm,
          correct: t.correct,
          missed: t.missed,
          wrong: t.wrong,
          wrongRule: t.wrongRule,
        };
      }),
    );
    console.table(rows);
    expect(rows.length).toBe(10);
  });

  it("the chosen default never maps wrongly and finds every wanted column", () => {
    const t = evaluate(0.25);
    expect(t.details).toEqual([]);
  });
});
