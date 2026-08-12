export const runtime = "edge";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const body = (await request.json().catch(() => ({}))) as { prompt?: string; name?: string };
  const prompt = String(body.prompt || "An impossible but appetizing surreal cheesecake").slice(0, 1600);

  if (!apiKey) {
    return Response.json({ image: null, demo: true });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt: `${prompt}\nSquare editorial food photograph, dramatic direct flash, appetizing, intricate physical textures. No words, labels, menus, watermarks, or logos.`,
        size: "1024x1024",
        quality: "low",
        output_format: "webp",
      }),
    });
    if (!response.ok) throw new Error("Image generation failed");
    const data = (await response.json()) as { data?: Array<{ b64_json?: string }> };
    const encoded = data.data?.[0]?.b64_json;
    if (!encoded) throw new Error("No image returned");
    return Response.json({ image: `data:image/webp;base64,${encoded}`, demo: false });
  } catch {
    return Response.json({ image: null, demo: true });
  }
}
