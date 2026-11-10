const API_VERSION = "2022-11-28";
const MAX_MESSAGES = 500;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }
    try {
      const body = await request.json();
      const content = String(body.content || "").trim();
      const anonymous = Boolean(body.anonymous);
      const name = anonymous
        ? "匿名"
        : String(body.name || "").trim().slice(0, 30) || "访客";
      if (!content) return json({ error: "留言内容不能为空" }, 400, cors);
      if (content.length > 800) {
        return json({ error: "留言不能超过 800 个字符" }, 400, cors);
      }
      if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
        return json({ error: "留言服务环境变量未配置完整" }, 500, cors);
      }

      const message = {
        id: "message-" + crypto.randomUUID(),
        content,
        name,
        anonymous,
        createdAt: new Date().toISOString()
      };
      const result = await appendMessage(env, message);
      return json({ ok: true, message, total: result.messages.length }, 200, cors);
    } catch (error) {
      return json(
        { error: error.message || "留言写入失败" },
        Number(error.status) || 500,
        cors
      );
    }
  }
};

async function appendMessage(env, message) {
  const owner = encodeURIComponent(env.GITHUB_OWNER);
  const repo = encodeURIComponent(env.GITHUB_REPO);
  const branch = env.GITHUB_BRANCH || "main";
  const path = String(env.GUESTBOOK_PATH || "guestbook.json")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + env.GITHUB_TOKEN,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "Kerry-Guestbook-Worker"
  };
  let lastError;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const existingResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
      { headers }
    );
    let sha = "";
    let data = { version: 1, messages: [] };
    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      sha = existing.sha || "";
      data = JSON.parse(decodeBase64(existing.content || ""));
    } else if (existingResponse.status !== 404) {
      const error = new Error("无法读取留言数据");
      error.status = existingResponse.status;
      throw error;
    }
    const next = {
      version: 1,
      messages: [message, ...(Array.isArray(data.messages) ? data.messages : [])]
        .slice(0, MAX_MESSAGES)
    };
    const updateResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Add guestbook message",
          content: encodeBase64(JSON.stringify(next, null, 2) + "\n"),
          branch,
          ...(sha ? { sha } : {})
        })
      }
    );
    if (updateResponse.ok) return next;

    lastError = new Error("留言写入失败");
    lastError.status = updateResponse.status;
    if (![409, 422, 429, 500, 502, 503, 504].includes(updateResponse.status)) {
      throw lastError;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(2500, 300 * attempt * attempt))
    );
  }
  throw lastError;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN || origin || "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(value, status, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(String(value).replace(/\s+/g, ""));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0))
  );
}
