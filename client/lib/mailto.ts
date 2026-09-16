export function mailtoFor(opts: { email: string; to: string; url: string }) {
  const subject = "A piece of my garden, for you";
  const lines = [
    opts.to ? `${opts.to},` : "",
    "",
    "I grew something for you. When you have a quiet moment, open this:",
    "",
    opts.url,
    "",
    "— from Solace",
  ];
  const body = lines.join("\n");
  return `mailto:${opts.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
