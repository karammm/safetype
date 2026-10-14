import type { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";
import { createModerationEngine, pickEngineConfig, type ModerationAction, type ModerationCategory } from "@safetype/core";
import type { SafeTypeEngineOptions } from "./safe-type.service";

export interface SafeTypeValidatorOptions extends SafeTypeEngineOptions {
  /** `block` (default): invalid when the policy blocks the text. `violation`: invalid on any acted-on match. */
  errorOn?: "block" | "violation";
}

export interface SafeTypeValidationError {
  action: ModerationAction;
  violations: Array<{ category: ModerationCategory; ruleId: string; start: number; end: number; label?: string }>;
}

/**
 * Form validator: `new FormControl("", safeTypeValidator())` sets `errors.safeType` when the value is blocked.
 * Uses `mode: "block"` unless configured otherwise, so profanity, hate and harassment make the control invalid.
 */
export function safeTypeValidator(options: SafeTypeValidatorOptions = {}): ValidatorFn {
  const { errorOn = "block", engine: provided, ...rest } = options;
  const engine = provided ?? createModerationEngine({ mode: "block", ...pickEngineConfig(rest) });
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    if (typeof value !== "string" || value.length === 0) return null;
    const result = engine.moderate(value);
    const violations = result.matches.filter((m) => m.action !== "allow");
    const invalid = errorOn === "block" ? !result.allowed : violations.length > 0;
    if (!invalid) return null;
    const error: SafeTypeValidationError = {
      action: result.action,
      violations: violations.map(({ category, ruleId, start, end, label }) => ({ category, ruleId, start, end, label })),
    };
    return { safeType: error };
  };
}
