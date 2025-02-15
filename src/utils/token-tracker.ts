import type { TokenUsage } from "#src/types.js";
import { EventEmitter } from "events";

export class TokenTracker extends EventEmitter {
  private usages: TokenUsage[] = [];
  private budget?: number;

  constructor(budget?: number) {
    super();
    this.budget = budget;
  }

  trackUsage(tool: string, tokens: number) {
    const currentTotal = this.getTotalUsage();
    if (this.budget && currentTotal + tokens > this.budget) {
      // Instead of adding tokens and then throwing, we'll throw before adding
      console.error(
        `Token budget exceeded: ${currentTotal + tokens} > ${this.budget}`,
      );
    }
    // Only track usage if we're within budget
    if (!this.budget || currentTotal + tokens <= this.budget) {
      this.usages.push({ tool, tokens });
      this.emit("usage", { tool, tokens });
    }
  }

  getTotalUsage(): number {
    return this.usages.reduce((sum, usage) => sum + usage.tokens, 0);
  }

  getUsageBreakdown(): Record<string, number> {
    return this.usages.reduce(
      (acc, { tool, tokens }) => {
        acc[tool] = (acc[tool] || 0) + tokens;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  printSummary() {
    console.log("Token Usage Summary:", {
      total: this.getTotalUsage(),
      breakdown: this.getUsageBreakdown(),
    });
  }

  reset() {
    this.usages = [];
  }
}
