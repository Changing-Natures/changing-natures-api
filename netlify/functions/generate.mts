import type { Context } from "@netlify/functions";
import OpenAI from "openai";
import Replicate from "replicate";

// Stable Diffusion model version for image generation
const IMAGE_VERSION =
  "2a865c9a94c9992b6689365b75db2d678d5022505ed3f63a5f53929a31a46947";

// Query params come in as strings from the URL
interface TextQuery {
  type: "text";
  prompt: string;
  system_prompt: string;
  temperature: string;
  model: string;
}

interface ImageQuery {
  type: "image";
  prompt: string;
  negative_prompt?: string;
  width: string;
  height: string;
  webhook?: string;
}

// Discriminated union — narrowed by `type` field
type GenerateQuery = TextQuery | ImageQuery;

interface TextResponse {
  text: string;
}

interface ImageResponse {
  output: unknown;
}

interface ErrorResponse {
  error: string;
}

// CORS headers applied to every response (frontend is on a different origin)
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// OpenAI chat completion with system + user prompt
async function handleTextGeneration(query: TextQuery): Promise<Response> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const textCompletion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: query.system_prompt },
      { role: "user", content: query.prompt },
    ],
    model: query.model,
    temperature: parseFloat(query.temperature),
    max_completion_tokens: 210,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  console.log("OpenAI response:", JSON.stringify(textCompletion, null, 2));

  const result: TextResponse = {
    text: textCompletion.choices[0].message.content ?? "",
  };

  return new Response(JSON.stringify(result), { status: 200, headers });
}

// Replicate Stable Diffusion — creates prediction then polls until complete
async function handleImageGeneration(query: ImageQuery): Promise<Response> {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const input = {
    prompt: query.prompt,
    negative_prompt: query.negative_prompt ?? "",
    width: parseInt(query.width),
    height: parseInt(query.height),
    num_inference_steps: 25,
  };

  let prediction = await replicate.predictions.create({
    version: IMAGE_VERSION,
    input,
    webhook: query.webhook,
  });

  // Poll at 250ms intervals until the prediction resolves
  prediction = await replicate.wait(prediction, { interval: 250 });

  if (prediction.error) {
    throw new Error(String(prediction.error));
  }

  const result: ImageResponse = { output: prediction.output };

  return new Response(JSON.stringify(result), { status: 200, headers });
}

// Netlify Function handler — routes to text or image generation based on ?type=
export default async (req: Request, _context: Context): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (!type || (type !== "text" && type !== "image")) {
    const error: ErrorResponse = { error: "Invalid prediction type." };
    return new Response(JSON.stringify(error), { status: 400, headers });
  }

  try {
    // Cast all search params into our typed query union
    const query = Object.fromEntries(
      url.searchParams,
    ) as unknown as GenerateQuery;

    if (query.type === "text") {
      return await handleTextGeneration(query);
    } else {
      return await handleImageGeneration(query);
    }
  } catch (err) {
    console.error(err);
    const error: ErrorResponse = {
      error: err instanceof Error ? err.message : "Internal server error",
    };
    return new Response(JSON.stringify(error), { status: 500, headers });
  }
};
