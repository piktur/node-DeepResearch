import type { StepAction } from "#src/types.js";

/**
 * Renders a document from a given array of result objects.
 * The answer is expected to be in the last element of the array.
 *
 * @param {Array<object>} results - An array of result objects, each containing question, answer, thoughts, and references.
 * @returns {string} - The rendered document in Markdown format.
 */
export function render(
  results: StepAction[],
  usage: {
    total: number;
    breakdown: {
      total: number;
    };
  },
  duration: number,
) {
  if (!Array.isArray(results) || results.length === 0) {
    return "Error: Invalid input. Expected a non-empty array of results.";
  }

  const lastResult = results.at(-1)!;

  if (lastResult.action !== "answer") {
    return "Non definitive result.";
  }

  const { answer, thoughts, references } = lastResult;

  let markdown: string = `# Report

|         | |
|---------|-|
| Date    | ${new Date().toLocaleDateString()} |
| Usage   | ${usage.total} |
| Duration | ${duration / 1000} seconds |

---

> ${answer}

## Considerations

${thoughts}

## References

`;

  (references ?? []).reduce(
    (markdown, e, i) =>
      markdown +
      `
[^${i + 1}]: ${e.exactQuote} [${e.url}](${e.url})`,
    markdown,
  );

  return markdown;
}
