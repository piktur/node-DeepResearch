/**
 * @file src/utils/fetch.ts
 * @description Utility function for making fetch requests with retry logic.
 */

import { sleep } from "#src/utils/sleep.js";
// import { GoogleGenerativeAIFetchError } from "@google/generative-ai";

const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Wraps the native fetch API to include retry logic for rate limiting or transient errors.
 *
 * @async
 * @template T - The type of the fetch function, expected to be a function that returns a Promise.
 * @param {T} fetchFn - The fetch function to execute (e.g., `fetch` or a custom function).
 * @param {Parameters<T>} args - Arguments to pass to the fetch function.
 * @param {RetryConfig} [config={}] - Configuration for retry behavior.
 * @returns {Promise<ReturnType<T>>} - Result of the fetchFn call.
 * @throws {Error} - If the fetch fails after maximum retries or for non-retryable errors.
 */
export async function fetchWithRetry<T extends (...args: any) => Promise<any>>(
  fetchFn: T,
  args: Parameters<T>,
  {
    maxRetries = 3,
    initialDelay = 7_500,
    shouldRetry = _shouldRetry,
  }: RetryConfig = {
    maxRetries: 3,
    initialDelay: 7_500,
    shouldRetry: _shouldRetry,
  },
): Promise<ReturnType<T>> {
  let attempt = 1;
  while (attempt <= maxRetries) {
    try {
      return await fetchFn(...args);
    } catch (error: unknown) {
      if (attempt < maxRetries && shouldRetry(error)) {
        let delay = initialDelay * Math.pow(2, attempt); // Exponential backoff

        // Check for Retry-After header
        if (error instanceof Response && error.headers.has("Retry-After")) {
          const retryAfter = error.headers.get("Retry-After");
          if (retryAfter) {
            const seconds = Number(retryAfter);
            if (!isNaN(seconds)) {
              delay = seconds * 1000;
            }
          }
        }

        console.warn(
          `Retryable error encountered, retrying in ${delay / 1000} seconds...`,
          `Attempt ${attempt} of ${maxRetries}`,
        );

        await sleep(delay);
      } else if (attempt >= maxRetries) {
        console.error(
          `Max retries reached for fetch after ${attempt} attempts.`,
        );
        throw error; // Re-throw the error after max retries
      } else {
        throw error; // Re-throw errors that are not retryable
      }
    }

    attempt++;
  }

  throw new Error(
    "Failed to fetch after maximum retries due to unexpected error.",
  ); // Should not reach here in normal control flow
}

const _shouldRetry = (error: unknown) => {
  // if (error instanceof GoogleGenerativeAIFetchError) {
  //   return (
  //     (error.status ||
  //       (error.cause &&
  //         typeof error.cause === "object" &&
  //         "status" in error.cause &&
  //         error.cause.status)) === HTTP_STATUS_TOO_MANY_REQUESTS
  //   );
  // } else if (error instanceof Error) {
  //   return error.message.includes("Too many requests");
  // }

  return false;
};
