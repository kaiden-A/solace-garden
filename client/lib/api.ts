import { NextResponse } from "next/server";

export const unauthorized = () => NextResponse.json({ error: "Not signed in." }, { status: 401 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });
export const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
