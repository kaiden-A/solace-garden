export function fineFocus(node: HTMLElement | null) {
  if (node && typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
    node.focus();
  }
}
