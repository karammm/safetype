import { createModerationEngine, type ModerationResult } from "@safetype/core";
import { DEFAULT_SELECTOR, isEligible, isTextControl } from "./eligibility";
import { FieldController, type FieldContext } from "./field-controller";
import { STYLES } from "./messages";
import { ContentEditableSurface, NativeSurface } from "./surface";
import type { FieldResult, SafeTypeEventName, SafeTypeInstance, SafeTypeOptions } from "./types";

const WATCHED_ATTRIBUTES = ["type", "contenteditable", "data-safetype", "readonly", "disabled", "autocomplete", "name"];

const styleRefs = new WeakMap<Node, { node: HTMLStyleElement; count: number }>();

function acquireStyles(target: Document | ShadowRoot): void {
  const ref = styleRefs.get(target);
  if (ref) {
    ref.count++;
    return;
  }
  const doc = target.nodeType === 9 ? (target as Document) : target.ownerDocument!;
  const node = doc.createElement("style");
  node.setAttribute("data-safetype", "");
  node.textContent = STYLES;
  (target.nodeType === 9 ? (doc.head ?? doc.documentElement) : target).appendChild(node);
  styleRefs.set(target, { node, count: 1 });
}

function releaseStyles(target: Document | ShadowRoot): void {
  const ref = styleRefs.get(target);
  if (!ref) return;
  if (--ref.count === 0) {
    ref.node.remove();
    styleRefs.delete(target);
  }
}

const CALLBACKS = {
  moderated: "onModerated",
  violation: "onViolation",
  warning: "onWarning",
  blocked: "onBlocked",
} as const;

export function createSafeType(options: SafeTypeOptions = {}): SafeTypeInstance {
  const {
    selector = DEFAULT_SELECTOR,
    root: rootOption,
    engine: providedEngine,
    observeDynamicElements = true,
    excludeSelectors = [],
    showMessages = true,
    messages = {},
    injectStyles = true,
    blockSubmit = true,
    asyncModeration,
    asyncDebounceMs = 300,
    onModerated,
    onViolation,
    onWarning,
    onBlocked,
    onError,
    ...engineConfig
  } = options;
  const callbacks = { onModerated, onViolation, onWarning, onBlocked };

  const engine = providedEngine ?? createModerationEngine(engineConfig);
  const reportError = (error: unknown, element?: HTMLElement) => {
    if (onError) onError(error, element);
    else console.error("[safetype]", error);
  };
  if (!providedEngine) engine.on("error", ({ error }) => reportError(error));

  const controllers = new Map<HTMLElement, FieldController>();
  let observer: MutationObserver | null = null;
  let root: Document | Element | ShadowRoot | null = null;
  let running = false;
  let destroyed = false;

  const dispatch = (name: SafeTypeEventName, result: ModerationResult, element: HTMLElement) => {
    try {
      callbacks[CALLBACKS[name]]?.(result, element);
    } catch (error) {
      reportError(error, element);
    }
    const view = element.ownerDocument.defaultView;
    if (view) {
      element.dispatchEvent(new view.CustomEvent(`safetype:${name}`, { bubbles: true, composed: true, detail: { result, element } }));
    }
  };

  const context: FieldContext = {
    engine,
    showMessages,
    messages,
    asyncModeration: asyncModeration ?? (engineConfig.classifiers?.length ?? 0) > 0,
    asyncDebounceMs,
    dispatch,
    reportError,
  };

  function attach(element: Element): boolean {
    const el = element as HTMLElement;
    if (destroyed) return false;
    if (controllers.has(el)) return true;
    if (!isEligible(el, excludeSelectors)) return false;
    const surface = isTextControl(el) ? new NativeSurface(el) : new ContentEditableSurface(el);
    const controller = new FieldController(el, surface, context);
    controller.attach();
    controllers.set(el, controller);
    return true;
  }

  function detach(element: Element): void {
    const controller = controllers.get(element as HTMLElement);
    if (!controller) return;
    controller.detach();
    controllers.delete(element as HTMLElement);
  }

  const matches = (el: Element) => el.matches(selector);

  function discover(el: Element): void {
    if (matches(el)) attach(el);
    el.querySelectorAll(selector).forEach(attach);
  }

  function reevaluate(el: Element): void {
    const ok = matches(el) && isEligible(el, excludeSelectors);
    const has = controllers.has(el as HTMLElement);
    if (ok && !has) attach(el);
    else if (!ok && has) detach(el);
  }

  function prune(): void {
    for (const el of [...controllers.keys()]) if (!el.isConnected) detach(el);
  }

  const onMutations = (records: MutationRecord[]) => {
    let removed = false;
    for (const record of records) {
      if (record.type === "childList") {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1) discover(node as Element);
        });
        if (record.removedNodes.length) removed = true;
      } else if (record.type === "attributes" && record.target.nodeType === 1) {
        const target = record.target as Element;
        reevaluate(target);
        target.querySelectorAll(selector).forEach(reevaluate);
      }
    }
    if (removed) prune();
  };

  const onSubmit = (event: Event) => {
    const form = event.target as Element | null;
    if (!form || form.nodeType !== 1) return;
    let firstBlocked: HTMLElement | null = null;
    for (const [el, controller] of controllers) {
      const owner = isTextControl(el) ? el.form : null;
      if (owner !== form && !form.contains(el)) continue;
      const result = controller.run("final");
      if (result.action === "block") {
        firstBlocked ??= el;
        dispatch("blocked", result, el);
      }
    }
    if (firstBlocked && blockSubmit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      firstBlocked.focus();
    }
  };

  const styleTarget = (r: Document | Element | ShadowRoot): Document | ShadowRoot =>
    r.nodeType === 9 || r.nodeType === 11 ? (r as Document | ShadowRoot) : (r.ownerDocument ?? document);

  const instance: SafeTypeInstance = {
    engine,
    get running() {
      return running;
    },
    get elements() {
      return [...controllers.keys()];
    },

    start() {
      if (destroyed) throw new Error("This SafeType instance was destroyed. Create a new one with createSafeType().");
      if (running) return;
      const resolved = rootOption ?? (typeof document === "undefined" ? null : document);
      if (!resolved) throw new Error("@safetype/dom needs a DOM. Pass `root` or call start() in a browser.");
      root = resolved;
      running = true;
      if (injectStyles && showMessages) acquireStyles(styleTarget(root));
      if (root.nodeType === 1) discover(root as Element);
      else root.querySelectorAll(selector).forEach(attach);
      root.addEventListener("submit", onSubmit, true);
      if (observeDynamicElements) {
        const view = (root.nodeType === 9 ? (root as Document) : root.ownerDocument)?.defaultView;
        const Observer = view?.MutationObserver ?? globalThis.MutationObserver;
        observer = new Observer(onMutations);
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: WATCHED_ATTRIBUTES });
      }
    },

    stop() {
      if (!running || !root) return;
      running = false;
      observer?.disconnect();
      observer = null;
      root.removeEventListener("submit", onSubmit, true);
      for (const el of [...controllers.keys()]) detach(el);
      if (injectStyles && showMessages) releaseStyles(styleTarget(root));
      root = null;
    },

    destroy() {
      instance.stop();
      destroyed = true;
    },

    attach,
    detach,

    getResult(element) {
      return controllers.get(element as HTMLElement)?.result;
    },

    validate() {
      prune();
      const results: FieldResult[] = [];
      for (const [element, controller] of controllers) results.push({ element, result: controller.run("final") });
      return { valid: results.every((r) => r.result.allowed), results };
    },
  };

  return instance;
}
