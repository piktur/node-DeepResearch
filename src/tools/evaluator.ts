import { GEMINI_API_KEY, modelConfigs } from "#src/config.js";
import type { EvaluationResponse } from "#src/types.js";
import { fetchWithRetry } from "#src/utils/fetch.js";
import { TokenTracker } from "#src/utils/token-tracker.js";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    is_definitive: {
      type: SchemaType.BOOLEAN,
      description:
        "Whether the answer provides a definitive response without uncertainty or 'I don't know' type statements",
    },
    reasoning: {
      type: SchemaType.STRING,
      description: "Explanation of why the answer is or isn't definitive",
    },
  },
  required: ["is_definitive", "reasoning"],
};

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: modelConfigs.evaluator.model,
  generationConfig: {
    temperature: modelConfigs.evaluator.temperature,
    responseMimeType: "application/json",
    responseSchema: responseSchema,
  },
});

function getPrompt(question: string, answer: string): string {
  return `You are an evaluator of answer definitiveness. Analyze if the given answer provides a definitive response or not.

Core Evaluation Criterion:
- Definitiveness: "I don't know", "lack of information", "doesn't exist", "not sure" or highly uncertain/ambiguous responses are **not** definitive, must return false!

Examples:

Question: "What are the system requirements for running Python 3.9?"
Answer: "I'm not entirely sure, but I think you need a computer with some RAM."
Evaluation: {
  "is_definitive": false,
  "reasoning": "The answer contains uncertainty markers like 'not entirely sure' and 'I think', making it non-definitive."
}

Question: "What are the system requirements for running Python 3.9?"
Answer: "Python 3.9 requires Windows 7 or later, macOS 10.11 or later, or Linux."
Evaluation: {
  "is_definitive": true,
  "reasoning": "The answer makes clear, definitive statements without uncertainty markers or ambiguity."
}

Question: "what is the twitter account of jina ai's founder?"
Answer: "The provided text does not contain the Twitter account of Jina AI's founder."
Evaluation: {
  "is_definitive": false,
  "reasoning": "The answer indicates a lack of information rather than providing a definitive response."
}

Now evaluate this pair:
Question: ${JSON.stringify(question)}
Answer: ${JSON.stringify(answer)}`;
}

/** @note Gemini free-tier limit 2RPM */
export async function evaluateAnswer(
  question: string,
  answer: string,
  tracker?: TokenTracker,
): Promise<{ response: EvaluationResponse; tokens: number }> | never {
  const prompt = getPrompt(question, answer);
  const { response } = await fetchWithRetry(model.generateContent.bind(model), [
    prompt,
  ]);
  const json = JSON.parse(response.text()) as EvaluationResponse;
  const tokens = response.usageMetadata?.totalTokenCount || 0;
  (tracker || new TokenTracker()).trackUsage("evaluator", tokens);
  return { response: json, tokens };
}

// Example usage
async function main() {
  const question = process.argv[2] || "";
  const answer = process.argv[3] || "";

  if (!question || !answer) {
    console.error(
      "Please provide both question and answer as command line arguments",
    );
    process.exit(1);
  }

  try {
    await evaluateAnswer(question, answer);
  } catch (error) {
    console.error("Failed to evaluate answer:", error);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
