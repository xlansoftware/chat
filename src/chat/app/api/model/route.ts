import { NextResponse } from "next/server";
import { loadModelConfig } from "@/lib-server/model-store";

export async function GET(req: Request) {

  const models = await loadModelConfig()

  const result = models.map((config) => {
    return {
      name: config.name,
      "model-name": config["model-name"],
      url: config.url
    }
  });

  return NextResponse.json({
    available: result
  });
}