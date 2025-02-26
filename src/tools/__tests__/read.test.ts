import { readUrl } from "#src/read.js";
import { TokenTracker } from "#src/utils/token-tracker.js";

describe("readUrl", () => {
  it.skip("should read and parse URL content (skipped due to insufficient balance)", async () => {
    const tokenTracker = new TokenTracker();
    const { response } = await readUrl('https://www.typescriptlang.org', tokenTracker);
    expect(response).toHaveProperty('code');
    expect(response).toHaveProperty('status');
    expect(response.data).toHaveProperty('content');
    expect(response.data).toHaveProperty('title');
  }, 15000);

  it.skip('should handle invalid URLs (skipped due to insufficient balance)', async () => {
    await expect(readUrl('invalid-url')).rejects.toThrow();
  }, 15000);

  beforeEach(() => {
    jest.setTimeout(15000);
  });
});
