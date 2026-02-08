const API_BASE = "/api/v1/gemini";

export const generateStoryStructure = async (prompt: string, styleName: string) => {
  const res = await fetch(`${API_BASE}/story-structure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, styleName }),
  });
  if (!res.ok) throw new Error(`Failed to generate story structure: ${res.status}`);
  return res.json() as Promise<{ title: string; characterDescription: string; pages: { text: string; imagePrompt: string }[] }>;
};

export const generateImage = async (imagePrompt: string, stylePrefix: string, characterDescription: string = "") => {
  const res = await fetch(`${API_BASE}/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imagePrompt, stylePrefix, characterDescription }),
  });
  if (!res.ok) throw new Error(`Failed to generate image: ${res.status}`);
  const data = await res.json() as { imageDataUrl: string };
  return data.imageDataUrl;
};

export const chatWithStoryteller = async (
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  userMessage: string
) => {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, userMessage }),
  });
  if (!res.ok) throw new Error(`Failed to chat: ${res.status}`);
  const data = await res.json() as { reply: string };
  return data.reply;
};
