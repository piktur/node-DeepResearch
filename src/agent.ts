import {
  DEFAULT_BUDGET_SPLIT_RATIO,
  GEMINI_API_KEY,
  JINA_API_KEY,
  MAX_RECURSION_DEPTH,
  SEARCH_PROVIDER,
  STEP_SLEEP,
  modelConfigs,
} from "#src/config.js";
import { braveSearch } from "#src/tools/brave-search.js";
import { dedupQueries } from "#src/tools/dedup.js";
import { analyzeSteps } from "#src/tools/error-analyzer.js";
import { evaluateAnswer } from "#src/tools/evaluator.js";
import { rewriteQuery } from "#src/tools/query-rewriter.js";
import { readUrl } from "#src/tools/read.js";
import type {
  AnswerAction,
  EvaluationResponse,
  ResponseSchema,
  SchemaProperty,
  StepAction,
  TrackerContext
} from "#src/types.js";
import { ActionTracker } from "#src/utils/action-tracker.js";
import { fetchWithRetry } from "#src/utils/fetch.js";
import { render } from "#src/utils/render.js";
import { sleep } from "#src/utils/sleep.js";
import { TokenTracker } from "#src/utils/token-tracker.js";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SafeSearchType, search as duckSearch } from "duck-duck-scrape";
import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = `/tmp/${Date.now()}`;

class Terminus extends Error {}

function getSchema(
  allowReflect: boolean,
  allowRead: boolean,
  allowAnswer: boolean,
  allowSearch: boolean,
): ResponseSchema {
  const actions: string[] = [];
  const properties: Record<string, SchemaProperty> = {
    action: {
      type: SchemaType.STRING,
      enum: actions,
      description: "Must match exactly one action type",
    },
    thoughts: {
      type: SchemaType.STRING,
      description:
        "Explain why choose this action, what's the thought process behind choosing this action",
    },
  };

  if (allowSearch) {
    actions.push("search");
    properties.searchQuery = {
      type: SchemaType.STRING,
      description:
        "Only required when choosing 'search' action, must be a short, keyword-based query that BM25, tf-idf based search engines can understand.",
    };
  }

  if (allowAnswer) {
    actions.push("answer");
    properties.answer = {
      type: SchemaType.STRING,
      description:
        "Only required when choosing 'answer' action, must be the final answer in natural language",
    };
    properties.references = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          exactQuote: {
            type: SchemaType.STRING,
            description: "Exact relevant quote from the document",
          },
          url: {
            type: SchemaType.STRING,
            description:
              "URL of the document; must be directly from the context",
          },
        },
        required: ["exactQuote", "url"],
      },
      description:
        "Must be an array of references that support the answer, each reference must contain an exact quote and the URL of the document",
    };
  }

  if (allowReflect) {
    actions.push("reflect");
    properties.questionsToAnswer = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.STRING,
        description:
          "each question must be a single line, concise and clear. not composite or compound, less than 20 words.",
      },
      description:
        "List of most important questions to fill the knowledge gaps of finding the answer to the original question",
      maxItems: 2,
    };
  }

  if (allowRead) {
    actions.push("visit");
    properties.URLTargets = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.STRING,
      },
      maxItems: 2,
      description:
        "Must be an array of URLs, choose up the most relevant 2 URLs to visit",
    };
  }

  // Update the enum values after collecting all actions
  properties.action.enum = actions;

  return {
    type: SchemaType.OBJECT,
    properties,
    required: ["action", "thoughts"],
  };
}

function getPrompt(
  question: string,
  context?: string[],
  allQuestions?: string[],
  allowReflect: boolean = true,
  allowAnswer: boolean = true,
  allowRead: boolean = true,
  allowSearch: boolean = true,
  badContext?: {
    question: string;
    answer: string;
    evaluation: string;
    recap: string;
    blame: string;
    improvement: string;
  }[],
  knowledge?: { question: string; answer: string }[],
  allURLs?: Record<string, string>,
  beastMode?: boolean,
): string {
  const sections: string[] = [];

  // Add header section
  sections.push(`Current date: ${new Date().toUTCString()}

You are an advanced AI research analyst specializing in multi-step reasoning. Using your training data and prior lessons learned, answer the following question with absolute certainty:

## Question
${question}`);

  // Add context section if exists
  if (context?.length) {
    sections.push(`## Context
You have conducted the following actions:

${context.join("\n")}`);
  }

  // Add knowledge section if exists
  if (knowledge?.length) {
    const knowledgeItems = knowledge
      .map((k, i) => `### Knowledge ${i + 1}: ${k.question}\n${k.answer}`)
      .join("\n\n");

    sections.push(`## Knowledge
You have successfully gathered some knowledge which might be useful for answering the original question. Here is the knowledge you have gathered so far

${knowledgeItems}`);
  }

  // Add bad context section if exists
  if (badContext?.length) {
    const attempts = badContext
      .map(
        (c, i) => `### Attempt ${i + 1}
- Question: ${c.question}
- Answer: ${c.answer}
- Reject Reason: ${c.evaluation}
- Actions Recap: ${c.recap}
- Actions Blame: ${c.blame}`,
      )
      .join("\n\n");

    const learnedStrategy = badContext.map((c) => c.improvement).join("\n");

    sections.push(`## Unsuccessful Attempts
Your have tried the following actions but failed to find the answer to the question.

${attempts}

## Learned Strategy
${learnedStrategy}
`);
  }

  // Build actions section
  const actions: string[] = [];

  if (allURLs && Object.keys(allURLs).length > 0 && allowRead) {
    const urlList = Object.entries(allURLs)
      .map(([url, desc]) => `  + "${url}": "${desc}"`)
      .join("\n");

    actions.push(`**visit**:
- Visit any URLs from below to gather external knowledge, choose the most relevant URLs that might contain the answer
${urlList}
- When you have enough search result in the context and want to deep dive into specific URLs
- It allows you to access the full content behind any URLs`);
  }

  if (allowSearch) {
    actions.push(`**search**:
- Query external sources using a public search engine
- Focus on solving one specific aspect of the question
- Only give keywords search query, not full sentences`);
  }

  if (allowAnswer) {
    actions.push(`**answer**:
- Provide final response only when 100% certain
- Responses must be definitive (no ambiguity, uncertainty, or disclaimers)${allowReflect ? '\n- If doubts remain, use "reflect" instead' : ""}`);
  }

  if (beastMode) {
    actions.push(`**answer**:
- You have gathered enough information to answer the question; they may not be perfect, but this is your very last chance to answer the question.
- Try the best of the best reasoning ability, investigate every details in the context and provide the best answer you can think of.
- When uncertain, educated guess is allowed and encouraged, but make sure it is based on the context and knowledge you have gathered.
- Responses must be definitive (no ambiguity, uncertainty, or disclaimers`);
  }

  if (allowReflect) {
    actions.push(`**reflect**:
- Perform critical analysis through hypothetical scenarios or systematic breakdowns
- Identify knowledge gaps and formulate essential clarifying questions
- Questions must be:
  - Original (not variations of existing questions)
  - Focused on single concepts
  - Under 20 words
  - Non-compound/non-complex`);
  }

  sections.push(`## Actions

Based on the current context, you must choose one of the following actions:

${actions.join("\n\n")}`);

  // Add footer
  sections.push(`Respond exclusively in valid JSON format matching exact JSON schema.

Critical Requirements:
- Include ONLY ONE action type
- Never add unsupported keys
- Exclude all non-JSON text, markdown, or explanations
- Maintain strict JSON syntax`);

  return sections.join("\n\n");
}

const allContext: StepAction[] = []; // all steps in the current session, including those leads to wrong results

function updateContext(step: any) {
  allContext.push(step);
}

function removeAllLineBreaks(text: string) {
  return text.replace(/(\r\n|\n|\r)/gm, " ");
}

export async function getResponse(
  question: string,
  tokenBudget: number = 1_000_000,
  maxBadAttempts: number = 3,
  existingContext?: Partial<TrackerContext>,
  parentKnowledge: Array<{
    question: string;
    answer: string;
    type: string;
  }> = [],
  budgetSplitRatio: number = DEFAULT_BUDGET_SPLIT_RATIO,
  recursionLevel: number = 0,
  outDir: string = OUT_DIR,
): Promise<{ result: StepAction | AnswerAction; context: TrackerContext }> {
  const context: TrackerContext = {
    tokenTracker:
      existingContext?.tokenTracker || new TokenTracker(tokenBudget),
    actionTracker: existingContext?.actionTracker || new ActionTracker(),
  };
  context.actionTracker.trackAction({
    gaps: [question],
    totalStep: 0,
    badAttempts: 0,
  });
  let step = 0;
  let totalStep = 0;
  let badAttempts = 0;
  const gaps: string[] = [question]; // All questions to be answered including the orginal question
  const allQuestions = [question];
  const allKeywords: string[] = [];
  const allKnowledge = [...parentKnowledge]; // knowledge are intermedidate questions that are answered
  const badContext: {
    question: string;
    answer: string;
    evaluation: string;
    recap: string;
    blame: string;
    improvement: string;
  }[] = [];
  let diaryContext: string[] = [];
  let allowAnswer = true;
  let allowSearch = true;
  let allowRead = true;
  let allowReflect = true;
  let prompt = "";
  let thisStep: StepAction = {
    action: "answer",
    answer: "",
    references: [],
    thoughts: "",
  };
  let isAnswered = false;

  const allURLs: Record<string, string> = {};
  const visitedURLs: string[] = [];

  while (
    context.tokenTracker.getTotalUsage() < tokenBudget &&
    badAttempts <= maxBadAttempts
  ) {
    // add 1s delay to avoid rate limiting
    await sleep(STEP_SLEEP);
    step++;
    totalStep++;
    context.actionTracker.trackAction({
      totalStep,
      thisStep,
      gaps,
      badAttempts,
    });

    const budgetPercentage = (
      (context.tokenTracker.getTotalUsage() / tokenBudget) *
      100
    ).toFixed(0);

    const currentQuestion = question;
    console.log(
      `| Recursion ${recursionLevel} | Step ${totalStep} | Token Budget ${tokenBudget} | Budget Used: ${budgetPercentage}% | Q: ${currentQuestion} |`,
    );

    // update all urls with buildURLMap
    allowReflect = allowReflect && recursionLevel < MAX_RECURSION_DEPTH;
    allowRead = allowRead && Object.keys(allURLs).length > 0;
    allowSearch = allowSearch && Object.keys(allURLs).length < 20; // disable search when too many urls already

    // generate prompt for this step
    prompt = getPrompt(
      currentQuestion,
      diaryContext,
      allQuestions,
      allowReflect,
      allowAnswer,
      allowRead,
      allowSearch,
      badContext,
      allKnowledge,
      allURLs,
      false,
    );

    const model = genAI.getGenerativeModel({
      model: modelConfigs.agent.model,
      generationConfig: {
        temperature: modelConfigs.agent.temperature,
        responseMimeType: "application/json",
        responseSchema: getSchema(
          allowReflect,
          allowRead,
          allowAnswer,
          allowSearch,
        ),
      },
    });

    const { response } = await fetchWithRetry(
      model.generateContent.bind(model),
      [prompt],
    );
    const usage = response.usageMetadata;
    context.tokenTracker.trackUsage("agent", usage?.totalTokenCount || 0);

    thisStep = JSON.parse(response.text());
    // print allowed and chose action
    const actionsStr = [allowSearch, allowRead, allowAnswer, allowReflect]
      .map((a, i) => (a ? ["search", "read", "answer", "reflect"][i] : null))
      .filter((a) => a)
      .join(", ");
    console.log(`${thisStep.action} <- [${actionsStr}]`);
    console.log(thisStep);

    // reset allowAnswer to true
    allowAnswer = true;
    allowReflect = true;
    allowRead = true;
    allowSearch = true;

    // execute the step and action
    if (thisStep.action === "answer") {
      updateContext({
        totalStep,
        question: currentQuestion,
        ...thisStep,
      });

      let evaluation: EvaluationResponse;
      try {
        evaluation = (
          await evaluateAnswer(
            currentQuestion,
            thisStep.answer,
            context.tokenTracker,
          )
        ).response;
      } catch (err) {
        return await finalize({
          question,
          diaryContext,
          allQuestions,
          badContext,
          allKnowledge,
          allURLs,
          allowAnswer,
          modelConfigs,
          genAI,
          allKeywords,
          totalStep,
          recursionLevel,
          thisStep,
          context,
          outDir,
        });
      }

      if (currentQuestion === question) {
        if (badAttempts >= maxBadAttempts) {
          // EXIT POINT OF THE PROGRAM!!!!
          diaryContext.push(`
At step ${step} and ${badAttempts} attempts, you took **answer** action and found an answer, not a perfect one but good enough to answer the original question:

Original question:
${currentQuestion}

Your answer:
${thisStep.answer}

The evaluator thinks your answer is good because:
${evaluation.reasoning}

Your journey ends here.
`);
          isAnswered = false;
          break;
        }

        if (evaluation.is_definitive) {
          if (
            thisStep.references?.length > 0 ||
            Object.keys(allURLs).length === 0
          ) {
            // EXIT POINT OF THE PROGRAM!!!!
            diaryContext.push(`
At step ${step}, you took **answer** action and finally found the answer to the original question:

Original question:
${currentQuestion}

Your answer:
${thisStep.answer}

The evaluator thinks your answer is good because:
${evaluation.reasoning}

Your journey ends here. You have successfully answered the original question. Congratulations! 🎉
`);
            isAnswered = true;
            break;
          } else {
            diaryContext.push(`
At step ${step}, you took **answer** action and finally found the answer to the original question:

Original question:
${currentQuestion}

Your answer:
${thisStep.answer}

Unfortunately, you did not provide any references to support your answer.
You need to find more URL references to support your answer.`);
          }

          isAnswered = true;
          break;
        } else {
          diaryContext.push(`
At step ${step}, you took **answer** action but evaluator thinks it is not a good answer:

Original question:
${currentQuestion}

Your answer:
${thisStep.answer}

The evaluator thinks your answer is bad because:
${evaluation.reasoning}
`);
          // store the bad context and reset the diary context
          const { response: errorAnalysis } = await analyzeSteps(diaryContext);

          badContext.push({
            question: currentQuestion,
            answer: thisStep.answer,
            evaluation: evaluation.reasoning,
            ...errorAnalysis,
          });
          badAttempts++;
          allowAnswer = false; // disable answer action in the immediate next step
          diaryContext = [];
          step = 0;
        }
      } else if (evaluation.is_definitive) {
        diaryContext.push(`
At step ${step}, you took **answer** action. You found a good answer to the sub-question:

Sub-question:
${currentQuestion}

Your answer:
${thisStep.answer}

The evaluator thinks your answer is good because:
${evaluation.reasoning}

Although you solved a sub-question, you still need to find the answer to the original question. You need to keep going.
`);
        allKnowledge.push({
          question: currentQuestion,
          answer: thisStep.answer,
          type: "qa",
        });
      }
    } else if (thisStep.action === "reflect" && thisStep.questionsToAnswer) {
      let newGapQuestions = thisStep.questionsToAnswer;
      const oldQuestions = newGapQuestions;
      if (allQuestions.length) {
        newGapQuestions = (await dedupQueries(newGapQuestions, allQuestions))
          .unique_queries;
      }
      if (newGapQuestions.length > 0) {
        for (const gapQuestion of newGapQuestions) {
          // Create sub-context with remaining token budget
          // Calculate sub-question budget as a fraction of current remaining budget
          const currentRemaining =
            tokenBudget - context.tokenTracker.getTotalUsage();
          const subQuestionBudget = Math.floor(
            currentRemaining * budgetSplitRatio,
          );
          // Log the budget allocation for monitoring
          console.log(
            `Allocating ${subQuestionBudget} tokens for sub-question: "${gapQuestion}"`,
          );

          // Recursively resolve gap question
          const { result: gapResult } = await getResponse(
            gapQuestion,
            subQuestionBudget,
            maxBadAttempts,
            undefined,
            allKnowledge, // Pass current knowledge to sub-question
            budgetSplitRatio,
            recursionLevel + 1,
          );

          // If gap was successfully answered, add to knowledge
          if (gapResult.action === "answer") {
            allKnowledge.push({
              question: gapQuestion,
              answer: gapResult.answer,
              type: "qa",
            });
          }
        }
        diaryContext.push(`
At step ${step}, you took **reflect** and resolved ${newGapQuestions.length} sub-questions:
${newGapQuestions.map((q) => `- ${q}`).join("\n")}
The answers to these questions have been added to your knowledge base.
`);
      } else {
        diaryContext.push(`
At step ${step}, you took **reflect** and think about the knowledge gaps. You tried to break down the question "${currentQuestion}" into gap-questions like this: ${oldQuestions.join(", ")}
But then you realized you have asked them before. You decided to to think out of the box or cut from a completely different angle.
`);
        updateContext({
          totalStep,
          ...thisStep,
          result:
            "I have tried all possible questions and found no useful information. I must think out of the box or different angle!!!",
        });

        allowReflect = false;
      }
    } else if (thisStep.action === "search" && thisStep.searchQuery) {
      // rewrite queries
      let { queries: keywordsQueries } = await rewriteQuery(thisStep);

      const oldKeywords = keywordsQueries;
      // avoid exisitng searched queries
      if (allKeywords.length) {
        const { unique_queries: dedupedQueries } = await dedupQueries(
          keywordsQueries,
          allKeywords,
        );
        keywordsQueries = dedupedQueries;
      }
      if (keywordsQueries.length > 0) {
        const searchResults = [];
        for (const query of keywordsQueries) {
          console.log(`Search query: ${query}`);
          let results: Awaited<ReturnType<typeof duckSearch>>;
          try {
            if (SEARCH_PROVIDER === "duck") {
              results = await duckSearch(query, {
                safeSearch: SafeSearchType.STRICT,
              });
            } else {
              const { response } = await braveSearch(query);
              await sleep(STEP_SLEEP);
              results = {
                results: (response.web?.results ?? []).map((r) => ({
                  title: r.title,
                  url: r.url,
                  description: r.description,
                })),
              };
            }
            const minResults = results.results.map((r) => ({
              title: r.title,
              url: r.url,
              description: r.description,
            }));
            for (const r of minResults) {
              allURLs[r.url] = r.title;
            }
            searchResults.push({ query, results: minResults });
            allKeywords.push(query);
          } catch (err) {
            console.error(err);
            results = [];
          }
        }
        diaryContext.push(`
At step ${step}, you took the **search** action and look for external information for the question: "${currentQuestion}".
In particular, you tried to search for the following keywords: "${keywordsQueries.join(", ")}".
You found quite some information and add them to your URL list and **visit** them later when needed.
`);

        updateContext({
          totalStep,
          question: currentQuestion,
          ...thisStep,
          result: searchResults,
        });
      } else {
        diaryContext.push(`
At step ${step}, you took the **search** action and look for external information for the question: "${currentQuestion}".
In particular, you tried to search for the following keywords: ${oldKeywords.join(", ")}.
But then you realized you have already searched for these keywords before.
You decided to think out of the box or cut from a completely different angle.
`);

        updateContext({
          totalStep,
          ...thisStep,
          result:
            "I have tried all possible queries and found no new information. I must think out of the box or different angle!!!",
        });

        allowSearch = false;
      }
    } else if (thisStep.action === "visit" && thisStep.URLTargets?.length) {
      let uniqueURLs = thisStep.URLTargets;
      if (visitedURLs.length > 0) {
        // check duplicate urls
        uniqueURLs = uniqueURLs.filter(
          (url: string) => !visitedURLs.includes(url),
        );
      }

      if (uniqueURLs.length > 0) {
        const urlResults = (
          await Promise.allSettled(
            uniqueURLs.map(async (url: string) => {
              try {
                const { response, tokens } = await readUrl(
                  url,
                  JINA_API_KEY,
                  context.tokenTracker,
                );
                allKnowledge.push({
                  question: `What is in ${response.data?.url || "the URL"}?`,
                  answer: removeAllLineBreaks(
                    response.data?.content || "No content available",
                  ),
                  type: "url",
                });
                visitedURLs.push(url);
                delete allURLs[url];
                return { url, result: response, tokens };
              } catch (error) {
                console.error(`Failed to read URL ${url}:`, error);
                return null; // Or return a specific error object if needed
              }
            }),
          )
        )
          .filter(
            (result): result is PromiseFulfilledResult<any> =>
              result.status === "fulfilled" && result.value !== null,
          )
          .map((result) => result.value);
        diaryContext.push(`
At step ${step}, you took the **visit** action and deep dive into the following URLs:
${thisStep.URLTargets.join("\n")}
You found some useful information on the web and add them to your knowledge for future reference.
`);
        updateContext({
          totalStep,
          question: currentQuestion,
          ...thisStep,
          result: urlResults,
        });
      } else {
        diaryContext.push(`
At step ${step}, you took the **visit** action and try to visit the following URLs:
${thisStep.URLTargets.join("\n")}
But then you realized you have already visited these URLs and you already know very well about their contents.

You decided to think out of the box or cut from a completely different angle.`);

        updateContext({
          totalStep,
          ...thisStep,
          result:
            "I have visited all possible URLs and found no new information. I must think out of the box or different angle!!!",
        });

        allowRead = false;
      }
    }

    await storeContext(
      prompt,
      [allContext, allKeywords, allQuestions, allKnowledge],
      totalStep,
      recursionLevel,
      outDir,
    );
  }

  try {
    step++;
    totalStep++;

    await storeContext(
      prompt,
      [allContext, allKeywords, allQuestions, allKnowledge],
      totalStep,
      recursionLevel,
      outDir,
    );

    if (isAnswered) {
      return { result: thisStep, context };
    } else {
      throw new Terminus();
    }
  } catch (err) {
    return await finalize({
      question,
      diaryContext,
      allQuestions,
      badContext,
      allKnowledge,
      allURLs,
      allowAnswer,
      modelConfigs,
      genAI,
      allKeywords,
      totalStep,
      recursionLevel,
      thisStep,
      context,
      outDir,
    });
  }
}

interface FinalizeParams {
  question: string;
  diaryContext: string[];
  allQuestions: string[];
  badContext: {
    question: string;
    answer: string;
    evaluation: string;
    recap: string;
    blame: string;
    improvement: string;
  }[];
  allKnowledge: {
    question: string;
    answer: string;
    type: string;
  }[];
  allURLs: Record<string, string>;
  allowAnswer: boolean;
  modelConfigs: any;
  genAI: any;
  allKeywords: string[];
  totalStep: number;
  recursionLevel: number;
  thisStep: any;
  context: TrackerContext;
  outDir: string;
}

const finalize = async ({
  question,
  diaryContext,
  allQuestions,
  badContext,
  allKnowledge,
  allURLs,
  allowAnswer,
  modelConfigs,
  genAI,
  allKeywords,
  totalStep,
  recursionLevel,
  thisStep,
  context,
  outDir,
}: FinalizeParams) => {
  console.log("Enter Beast mode!!!");

  const prompt = getPrompt(
    question,
    diaryContext,
    allQuestions,
    false,
    false,
    false,
    false,
    badContext,
    allKnowledge,
    allURLs,
    true,
  );

  const model = genAI.getGenerativeModel({
    model: modelConfigs.agentBeastMode.model,
    generationConfig: {
      temperature: modelConfigs.agentBeastMode.temperature,
      responseMimeType: "application/json",
      responseSchema: getSchema(false, false, allowAnswer, false),
    },
  });

  const { response } = await fetchWithRetry(model.generateContent.bind(model), [
    prompt,
  ]);
  const usage = response.usageMetadata;
  context.tokenTracker.trackUsage("agent", usage?.totalTokenCount || 0);

  await storeContext(
    prompt,
    [allContext, allKeywords, allQuestions, allKnowledge],
    totalStep,
    recursionLevel,
    outDir,
  );
  thisStep = JSON.parse(response.text());

  return { result: thisStep, context };
};

async function storeContext(
  prompt: string,
  memory: any[][],
  step: number,
  recursionLevel: number,
  outDir: string = OUT_DIR,
) {
  try {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(
      path.join(outDir, `prompt-${recursionLevel}-${step}.txt`),
      prompt,
    );
    const [context, keywords, questions, knowledge] = memory;
    await fs.writeFile(
      path.join(outDir, `context-${recursionLevel}.json`),
      JSON.stringify(context, null, 2),
    );
    await fs.writeFile(
      path.join(outDir, `queries-${recursionLevel}.json`),
      JSON.stringify(keywords, null, 2),
    );
    await fs.writeFile(
      path.join(outDir, `questions-${recursionLevel}.json`),
      JSON.stringify(questions, null, 2),
    );
    await fs.writeFile(
      path.join(outDir, `knowledge-${recursionLevel}.json`),
      JSON.stringify(knowledge, null, 2),
    );
  } catch (error) {
    console.error("Context storage failed:", error);
  }
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function main() {
  const start = Date.now()
  const question = process.argv[2] || "";
  const outDir = `/tmp/${Date.now()}`;
  const { result, context: tracker } = (await getResponse(
    question,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    outDir,
  ));
  const end = Date.now()

  if ('answer' in result) {
    console.log(result.answer)
  }

  const usage = {
    total: tracker.tokenTracker.getTotalUsage(),
    breakdown: tracker.tokenTracker.getUsageBreakdown(),
  }
  await fs.writeFile(path.join(outDir, 'report.md'), render([result], usage, end - start), 'utf-8')

  tracker.tokenTracker.printSummary();
}

// if (import.meta.main) {
main().catch(console.error);
// }
