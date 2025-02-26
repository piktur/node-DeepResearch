import type { StepAction } from "#src/types.js";
import { getI18nText } from "#src/utils/text-tools.js";
import { EventEmitter } from "events";

interface ActionState {
  thisStep: StepAction;
  gaps: string[];
  badAttempts: number;
  totalStep: number;
}

export class ActionTracker extends EventEmitter {
  private state: ActionState = {
    thisStep: { action: "answer", answer: "", references: [], question: "", think: "", totalStep: 0, isFinal: false },
    gaps: [],
    badAttempts: 0,
    totalStep: 0,
  };

  trackAction(newState: Partial<ActionState>) {
    this.state = { ...this.state, ...newState };
    this.emit("action", this.state.thisStep);
  }

  trackThink(think: string, lang?: string, params = {}) {
    if (lang) {
      think = getI18nText(think, lang, params);
    }
    this.state = { ...this.state, thisStep: { ...this.state.thisStep, think } };
    this.emit("action", this.state.thisStep);
  }

  getState(): ActionState {
    return { ...this.state };
  }

  reset() {
    this.state = {
      thisStep: { action: "answer", answer: "", references: [], think: "", question:"", isFinal: false, totalStep: 0 },
      gaps: [],
      badAttempts: 0,
      totalStep: 0,
    };
  }
}
