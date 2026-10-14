import { Component, signal } from "@angular/core";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { SafeTypeDirective, SafeTypePipe, safeTypeValidator } from "@safetype/angular";
import { SafeTypeEditorComponent } from "@safetype/angular/editor";

interface Comment {
  name: string;
  body: string;
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, SafeTypeDirective, SafeTypePipe, SafeTypeEditorComponent],
  template: `
    <main>
      <h1>Comments</h1>
      <form (ngSubmit)="post()">
        <label for="name">Name</label>
        <!-- Template-driven: ngModel receives the masked text -->
        <input id="name" name="name" safeType [(ngModel)]="name" />

        <label for="body">Comment</label>
        <!-- Reactive: the validator keeps the control invalid while content is blocked -->
        <textarea id="body" rows="4" safeType [formControl]="body"></textarea>
        <p class="state" data-testid="body-state">{{ body.value }}</p>
        <p class="state" data-testid="validity">{{ body.valid ? "valid" : "invalid" }}</p>

        <button type="submit">Post</button>
      </form>

      <h2>Rich text</h2>
      <!-- Built-in editor as a form control -->
      <safe-type-editor [formControl]="article" label="Article" placeholder="Write an article..." [maxLength]="500" />
      <p class="state" data-testid="article-state">{{ article.value }}</p>

      <button type="button" (click)="showExtra.set(!showExtra())">Toggle extra field</button>
      @if (showExtra()) {
        <input aria-label="extra" safeType="warn" />
      }

      <ul>
        <!-- Pipe: mask stored content when displaying it -->
        @for (c of comments(); track $index) {
          <li><strong>{{ c.name || "Anonymous" }}:</strong> {{ c.body | safeType }}</li>
        }
      </ul>
      <p class="state">Your server should still re-check comments with &#64;safetype/core.</p>
    </main>
  `,
  styles: `
    main { max-width: 560px; margin: 40px auto; padding: 0 16px; font: 16px/1.5 system-ui, sans-serif; }
    form { display: grid; gap: 8px; }
    input, textarea { font: inherit; padding: 8px; }
    .state { color: #666; font-size: 14px; margin: 0; }
  `,
})
export class AppComponent {
  name = "";
  readonly body = new FormControl("", { nonNullable: true, validators: [safeTypeValidator()] });
  readonly comments = signal<Comment[]>([
    { name: "Seeded from the API", body: "This old comment says shit and is masked by the pipe" },
  ]);
  readonly showExtra = signal(true);
  readonly article = new FormControl("<p></p>", { nonNullable: true });

  post(): void {
    // Only runs when no field is blocked: SafeType stops blocked submissions first.
    this.comments.update((list) => [...list, { name: this.name, body: this.body.value }]);
    this.body.reset();
  }
}
