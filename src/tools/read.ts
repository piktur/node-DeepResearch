import type { ReadResponse } from "#src/types.js";
import { TokenTracker } from "#src/utils/token-tracker.js";
import https from "node:https";

export function readUrl(
  url: string,
  token: string,
  tracker?: TokenTracker,
): Promise<{ response: ReadResponse; tokens: number }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ url });

    const options = {
      hostname: "r.jina.ai",
      port: 443,
      path: "/",
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": data.length,
        "X-Retain-Images": "none",
        "X-Return-Format": "markdown",
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () => {
        if (responseData.startsWith("error code")) {
          reject(new Error(responseData));
          return;
        }

        const response = JSON.parse(responseData) as ReadResponse;
        console.log("Raw read response:", response);

        if (response.code === 402) {
          reject(new Error(response.readableMessage || "Insufficient balance"));
          return;
        }

        if (!response.data) {
          reject(new Error("Invalid response data"));
          return;
        }

        console.log("Read:", {
          title: response.data.title,
          url: response.data.url,
          tokens: response.data.usage?.tokens || 0,
        });
        const tokens = response.data.usage?.tokens || 0;
        (tracker || new TokenTracker()).trackUsage("read", tokens);
        resolve({ response, tokens });
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
