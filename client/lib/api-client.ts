export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?next=${next}`;
  }
  return res;
}
