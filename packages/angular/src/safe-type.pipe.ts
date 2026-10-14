import { Pipe, inject, type PipeTransform } from "@angular/core";
import { createModerationEngine, type ModerationEngine } from "@safetype/core";
import { SafeTypeService } from "./safe-type.service";

/**
 * Moderates text for display, e.g. user comments rendered from your API:
 * `{{ comment.body | safeType }}` masks, `{{ comment.body | safeType: 'suggest' }}` applies suggestions.
 */
@Pipe({ name: "safeType", standalone: true, pure: true })
export class SafeTypePipe implements PipeTransform {
  private readonly service = inject(SafeTypeService);
  private suggestEngine: ModerationEngine | null = null;

  transform(value: string | null | undefined, mode: "mask" | "suggest" = "mask"): string {
    if (!value) return value ?? "";
    if (mode === "suggest") {
      this.suggestEngine ??= createModerationEngine({ ...this.service.config, mode: "suggest" });
      return this.suggestEngine.moderate(value).suggestedText;
    }
    return this.service.mask(value);
  }
}
