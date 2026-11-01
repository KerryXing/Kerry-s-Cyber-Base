import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".svg": "image/svg+xml"
};

const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname
    );
    let filePath = path.resolve(root, "." + pathname);
    if (!filePath.startsWith(root + path.sep) && filePath !== root) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const contentType =
        mimeTypes[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream";
      response.writeHead(200, { "Content-Type": contentType });
      response.end(data);
    });
  } catch {
    response.writeHead(400).end("Bad request");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log("Local:   http://localhost:" + port);
  Object.values(os.networkInterfaces())
    .flat()
    .filter((address) => address?.family === "IPv4" && !address.internal)
    .forEach((address) => {
      console.log("Network: http://" + address.address + ":" + port);
    });
});
