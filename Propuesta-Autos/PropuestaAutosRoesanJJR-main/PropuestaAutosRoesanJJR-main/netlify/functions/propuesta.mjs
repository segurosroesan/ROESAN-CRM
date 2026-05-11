import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore("propuestas");
  const url = new URL(req.url);

  if (req.method === "POST") {
    const body = await req.text();
    const id = Math.random().toString(36).slice(2, 9);
    await store.set(id, body);
    return Response.json({ id });
  }

  if (req.method === "GET") {
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });
    const data = await store.get(id);
    if (data === null) return new Response("Not found", { status: 404 });
    return new Response(data, { headers: { "Content-Type": "application/json" } });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
