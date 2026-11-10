window.UPLOAD_CONFIG = {
  // Leave owner and repo empty to detect them from a *.github.io Pages URL.
  owner: "",
  repo: "",
  // Leave empty to use the repository's default branch.
  branch: "",
  contentPath: "content.json",
  assetRoot: "shared",
  // Deploy guestbook-worker.js to Cloudflare Workers and put its URL here.
  guestbookEndpoint: "https://kerry-guestbook.kerry-guestbook.workers.dev",
  guestbookPath: "guestbook.json"
};
