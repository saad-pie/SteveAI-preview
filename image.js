import config from './config.js';

// 🌟 IMAGE GENERATION (HTTP FETCH | IMAGEN-4)
async function generateImage(prompt) {
  if (!prompt) throw new Error("No prompt provided");

  try {
    const response = await fetch("https://api.a4f.co/v1/images/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEYS[0]}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "provider-4/imagen-4",
        prompt,
        n: 1,
        size: "1024x1024"
      })
    });

    const data = await response.json();
    return data?.data?.[0]?.url || null;

  } catch (err) {
    console.error("Image generation error:", err);
    throw err;
  }
}
