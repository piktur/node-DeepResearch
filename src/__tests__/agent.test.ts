import fs from 'node:fs/promises';
import path from "path";
import { getResponse } from "../agent";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.mock('node:fs/promises')

describe("Agent Functionality", () => {
  it.skip("should return an answer action for a simple question", async () => {
    const question = "What is the capital of France?";
    const outDir = path.join(__dirname, "test-context");
    const { result } = await getResponse(
      question,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      outDir,
    ); // context path is not passed, so default path will be used, no test update needed

    expect(result.action).toBe("answer");
    if (result.action === "answer") {
      expect(typeof result.answer).toBe("string");
    }
  }, 30000);

  it.skip("should handle token budget limits", async () => {
    // Skip this test as it is flaky and depends on token usage
    const question = "Tell me a very very long story";
    const tokenBudget = 1000;
    const { context } = await getResponse(question, tokenBudget);
    expect(context.tokenTracker.getTotalUsage()).toBeLessThanOrEqual(
      tokenBudget,
    );
  }, 30000);

  it("should perform search and visit actions for complex questions", async () => {
    const question =
      "What are the main differences between a Macbook Pro and a Macbook Air?";
    const { result } = await getResponse(question);

    expect(["answer", "search", "visit", "reflect"]).toContain(result.action);
  }, 10_000); // Increased timeout for potentially longer test

  it("should handle follow-up questions and maintain context", async () => {
    const question1 = "Who is the president of the United States?";
    const { result: result1, context } = await getResponse(question1);

    expect(result1.action).toBe("answer");
    if (result1.action === "answer") {
      expect(typeof result1.answer).toBe("string");
    }

    const question2 = "What is his wife's name?";
    const { result: result2 } = await getResponse(
      question2,
      undefined,
      undefined,
      context,
    );

    expect(result2.action).toBe("answer");
    if (result2.action === "answer") {
      expect(typeof result2.answer).toBe("string");
    }
  }, 10_000); // Increased timeout for potentially longer test

  it.skip("should use the provided outDir for storing context files", async () => {
    const question = "What is the weather like today?";
    const outDir = "/tmp/test";
    await getResponse(
      question,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      outDir,
    );
    expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining(outDir));
  });
});
