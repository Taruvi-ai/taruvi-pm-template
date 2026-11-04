import DOMPurify from "dompurify";

// Rich-text HTML (task additional notes and their activity history copies) is
// user-controlled and can be written straight through the data API, so it must
// be sanitized at every render sink and before saving.

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export const sanitizeRichText = (dirty?: string | null): string =>
  DOMPurify.sanitize(dirty ?? "", {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["style", "form", "iframe", "object", "embed"],
    FORBID_ATTR: ["srcdoc"],
  });
