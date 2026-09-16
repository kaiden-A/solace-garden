export type ToastListener = (message: string) => void;

let listener: ToastListener | null = null;

export function toast(message: string) {
  listener?.(message);
}

export function registerToastListener(fn: ToastListener | null) {
  listener = fn;
}
