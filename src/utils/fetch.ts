/**
 * @file src/utils/fetch.ts
 * @description Utility function for making fetch requests with retry logic.
 */

/**
 * Wraps the native fetch API to include retry logic for rate limiting or transient errors.
 *
 * @async
 * @template T - The type of the fetch function, expected to be a function that returns a Promise.
 * @param {T} fetchFn - The fetch function to execute (e.g., `fetch` or a custom function).
 * @param {Parameters<T>} args - Arguments to pass to the fetch function.
 * @param {number} [maxRetries=3] - Maximum number of retry attempts.
 * @param {number} [delay=2000] - Initial delay in milliseconds before retrying.
 * @returns {Promise<any>} - Result of the fetchFn call.
 * @throws {Error} - If the fetch fails after maximum retries or for non-rate-limit errors.
 */
export async function fetchWithRetry<T extends (...args: any) => Promise<any>>(
  fetchFn: T,
  args: Parameters<T>,
  maxRetries: number = 3,
  delay: number = 2000,
): Promise<any> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fetchFn(...args);
    } catch (error: any) {
      if (attempt < maxRetries && error.status === 429) {
        const sleepTime = delay * Math.pow(2, attempt); // Exponential backoff
        console.warn(
          `Rate limit encountered, retrying in ${sleepTime / 1000} seconds...`,
          `Attempt ${attempt + 1} of ${maxRetries + 1}`,
        );
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
      } else if (attempt >= maxRetries) {
        console.error(`Max retries reached for fetch after ${attempt} attempts.`);
        throw error; // Re-throw the error after max retries
      } else {
        throw error; // Re-throw errors that are not rate limit related
      }
    }
    attempt++;
  }
  throw new Error("Failed to fetch after maximum retries due to unexpected error."); // Should not reach here in normal control flow
}
