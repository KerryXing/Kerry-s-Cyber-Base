window.UPLOAD_CONFIG = {
  // Leave owner and repo empty to detect them from a *.github.io Pages URL.
  owner: "",
  repo: "",
  // Leave empty to use the repository's default branch.
  branch: "",
  contentPath: "content.json",
  assetRoot: "shared",
  // Paste the HTTPS invoke URL created by the Huawei FunctionGraph APIG trigger.
  guestbookEndpoint: "",
  guestbookPath: "guestbook.json",
  // Database REST backend. Fill these to use Supabase directly without cloud functions.
  guestbookProvider: "supabase",
  supabaseUrl: "https://zqwuakfehkbhnfcdefwl.supabase.co",
  supabaseAnonKey: "sb_publishable_rBBtHQatBVxoC5B2JTTbPg_3QLNESP7",
  supabaseGuestbookTable: "guestbook_messages",
  supabaseTranslationTable: "translation_cache",
  // Optional contact used by MyMemory to increase its free translation quota.
  translationEmail: "keryxin@qq.com"
};
