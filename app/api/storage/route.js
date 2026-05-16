export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  // Service Worker nie ma dostępu do localStorage — zwracamy pusty
  return Response.json({ value: null });
}

export async function POST(request) {
  const { key, value } = await request.json();
  // Service Worker zapisuje dane — ale bez dostępu do localStorage
  return Response.json({ success: true });
}
