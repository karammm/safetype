import { provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideSafeType } from "@safetype/angular";
import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    // One configuration for the app: mask swearing, block targeted harassment.
    provideSafeType({ mode: "mask", policy: { harassment: { action: "block" } }, customWords: ["frak"] }),
  ],
}).catch((error) => console.error(error));
