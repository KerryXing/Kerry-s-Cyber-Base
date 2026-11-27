(function () {
  "use strict";

  const DATA = window.SITE_DATA || {};
  const DB_NAME = "kerry-personal-archive";
  const DB_VERSION = 3;
  const ALBUM_STORE = "albums";
  const DECK_STORE = "decks";
  const SETTINGS_STORE = "settings";
  const GITHUB_API = "https://api.github.com";
  const COVER_ROTATION_INTERVAL_MS = 5000;
  const COVER_CROSSFADE_MS = 1100;
  const ALBUM_COVER_ANIMATIONS = new Set([
    "fade",
    "slide-right",
    "zoom",
    "slide-vertical",
    "flip-vertical",
    "page-transition"
  ]);
  const THEME_META = {
    "deep-blue": { name: "深蓝", color: "#0b192a" },
    "light-blue": { name: "浅蓝", color: "#d8edf9" },
    "night-city": { name: "黑夜城市", color: "#071423" },
    gratitude: { name: "感恩", color: "#c68760" },
    christmas: { name: "圣诞", color: "#103d35" },
    "new-year": { name: "元旦", color: "#11243d" },
    "spring-festival": { name: "春节", color: "#8a1925" },
    qingming: { name: "清明", color: "#9ebfbd" },
    easter: { name: "复活节", color: "#f1dfdc" },
    lantern: { name: "元宵", color: "#5d243a" },
    labor: { name: "劳动", color: "#1d5b63" },
    "dragon-boat": { name: "端午", color: "#1f5a45" },
    "mid-autumn": { name: "中秋", color: "#172b4a" },
    "national-day": { name: "中国国庆", color: "#9f1e27" },
    "double-ninth": { name: "重阳", color: "#8a5d34" }
  };
  const SPRING_FESTIVAL_DATES = {
    2024: [2, 10],
    2025: [1, 29],
    2026: [2, 17],
    2027: [2, 6],
    2028: [1, 26],
    2029: [2, 13],
    2030: [2, 3],
    2031: [1, 23],
    2032: [2, 11],
    2033: [1, 31],
    2034: [2, 19],
    2035: [2, 8],
    2036: [1, 28],
    2037: [2, 15],
    2038: [2, 4],
    2039: [1, 24],
    2040: [2, 12]
  };
  const QINGMING_DATES = {
    2024: [4, 4],
    2025: [4, 4],
    2026: [4, 5],
    2027: [4, 5],
    2028: [4, 4],
    2029: [4, 4],
    2030: [4, 5],
    2031: [4, 5],
    2032: [4, 4],
    2033: [4, 4],
    2034: [4, 5],
    2035: [4, 5],
    2036: [4, 4],
    2037: [4, 4],
    2038: [4, 5],
    2039: [4, 5],
    2040: [4, 4]
  };
  const state = {
    db: null,
    albums: [],
    decks: [],
    attributes: [],
    tagGroups: [],
    contactGroups: [],
    legacyDecks: [],
    currentAlbumId: null,
    currentDeckId: null,
    renderedDeckId: null,
    currentSlide: 0,
    mainUrls: [],
    heroUrls: [],
    avatarUrls: [],
    albumUrls: [],
    deckUrls: [],
    lightboxUrls: [],
    toastTimer: null,
    isAdmin: false,
    adminToken: "",
    repoInfo: null,
    sharedProfile: {},
    pendingHeroMedia: null,
    pendingHeroItems: [],
    pendingAvatarMedia: null,
    isPublishing: false,
    reportAccess: null,
    reportKey: null,
    reportRawKey: null,
    reportUnlocked: false,
    reportUnlockedByVisitor: false,
    heroSelectionMode: false,
    selectedHeroIds: [],
    heroRotationTimer: null,
    heroRotationLayers: [],
    heroRotationIndex: 0,
    albumRotationTimers: new Map(),
    avatarSelectionMode: false,
    selectedAvatarIds: [],
    pendingAvatarItems: [],
    photoSelectionMode: false,
    selectedPhotoIds: [],
    pendingAlbumCoverAnimation: "fade",
    galleryLayoutMode: false,
    galleryDraftLayouts: new Map(),
    currentPage: "home",
    pageSwitchToken: 0,
    guestbook: [],
    pendingGuestbookDeleteId: "",
    guestbookComposeOpen: false,
    guestbookShape: "circle",
    guestbookPlacement: null,
    guestbookAdjustMode: false,
    guestbookLayoutSnapshot: [],
    footprints: [],
    pendingFootprintItems: [],
    footprintSelectionMode: false,
    selectedFootprintIds: [],
    footprintMap: null,
    footprintMarkers: [],
    footprintMarkerLookup: new Map(),
    footprintUrls: [],
    userLocationMarker: null,
    mapReady: false,
    map3dEnabled: false,
    deckAutoplayTimer: null,
    deckControlsTimer: null,
    slideRenderToken: 0,
    reportFilePaths: new Set(),
    revealObserver: null,
    language: "zh-CN",
    languageUserOverride: false,
    themeUserOverride: false,
    seasonalThemeKey: "",
    defaultTheme: THEME_META[window.SHARED_DEFAULT_THEME]
      ? window.SHARED_DEFAULT_THEME
      : "deep-blue"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    setupDeviceProfile();
    await setupLanguage();
    setupTheme();
    await populateProfile();
    setupNavigation();
    setupDialogs();
    setupRevealAnimations();
    setupDeck();
    setupGallery();
    setupGuestbook();
    setupFootprints();
    setupProfileEditor();
    setupContactEditor();
    setupReportAccess();
    setupVisualUploads();
    setupAdmin();
    $("#back-to-top").addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    updateBackToTopPlacement();
    window.addEventListener("resize", updateBackToTopPlacement);
    window.addEventListener("scroll", updateBackToTopPlacement, { passive: true });
    let galleryResizeTimer = null;
    let lastGalleryViewportWidth = Math.round(
      window.visualViewport?.width || window.innerWidth
    );
    window.addEventListener("resize", () => {
      const currentWidth = Math.round(
        window.visualViewport?.width || window.innerWidth
      );
      if (Math.abs(currentWidth - lastGalleryViewportWidth) < 2) return;
      lastGalleryViewportWidth = currentWidth;
      if (
        !state.galleryLayoutMode &&
        !state.albums.some((album) => album.layout)
      ) {
        return;
      }
      window.clearTimeout(galleryResizeTimer);
      galleryResizeTimer = window.setTimeout(renderAlbums, 180);
    });

    $("#current-year").textContent = String(new Date().getFullYear());

    try {
      await loadSharedContent();
      await loadGuestbook();
      await restoreReportAccess();
    } catch (error) {
      console.warn("Shared content is unavailable:", error);
      showToast("共享内容加载失败；当前显示网站默认内容。");
      await applyHeroMedia(DATA.profile?.heroMedia);
    }

    renderAlbums();
    renderGuestbook();
    renderFootprints();
    renderDeckLibrary();
    await resumeAdminSession();
    applyLanguageToDom();
    activateAnimatedMedia();
    document.addEventListener(
      "pointerdown",
      () => activateAnimatedMedia(),
      { capture: true, passive: true }
    );
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) activateAnimatedMedia();
    });
  }

  function setupDeviceProfile() {
    const apply = () => {
      const width = Math.round(window.visualViewport?.width || window.innerWidth);
      const touch = navigator.maxTouchPoints > 0;
      const device = width <= 720 ? "phone" : width <= 1100 ? "tablet" : "desktop";
      document.body.classList.remove(
        "device-phone",
        "device-tablet",
        "device-desktop"
      );
      document.body.classList.add("device-" + device);
      document.body.classList.toggle(
        "orientation-portrait",
        window.innerHeight > width
      );
      document.body.classList.toggle("touch-device", touch);
      document.documentElement.style.setProperty("--viewport-width", width + "px");
    };
    apply();
    window.addEventListener("resize", apply, { passive: true });
    window.addEventListener("orientationchange", () => {
      window.setTimeout(apply, 80);
    });
    window.visualViewport?.addEventListener("resize", apply, { passive: true });
  }

  async function setupLanguage() {
    const data = window.KERRY_I18N || { languages: [], dict: {} };
    const supported = new Set(data.languages.map((item) => item.code));
    const detectDeviceLanguage = () => {
      const candidates = Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language || ""];
      for (const raw of candidates) {
        const value = String(raw || "").toLowerCase();
        if (!value) continue;
        if (value.startsWith("zh")) {
          return /hant|tw|hk|mo/.test(value) ? "zh-TW" : "zh-CN";
        }
        const base = value.split("-")[0];
        if (supported.has(base)) return base;
      }
      return data.fallback || "zh-CN";
    };
    let saved = "";
    try {
      saved = localStorage.getItem("kerry-site-language") || "";
    } catch {
      saved = "";
    }
    const initial = supported.has(saved) ? saved : detectDeviceLanguage();
    state.languageUserOverride = supported.has(saved);
    state.language = supported.has(initial) ? initial : "zh-CN";
    state.languageTextSources = new WeakMap();
    state.userTranslationCache = loadTranslationCache();
    await loadCloudTranslationCache();
    state.userTranslationToken = 0;
    state.userTranslationNodes = new WeakMap();
    state.applyLanguage = applyLanguage;
    state.translateUiText = translateUiText;
    applyLanguage(state.language);

    $("#language-entry").addEventListener("click", () => {
      syncLanguageOptions();
      openDialog($("#language-dialog"));
    });
    $("#language-grid").addEventListener("click", (event) => {
      const option = event.target.closest("[data-language]");
      if (!option) return;
      const language = option.dataset.language;
      if (!supported.has(language)) return;
      state.languageUserOverride = true;
      try {
        localStorage.setItem("kerry-site-language", language);
      } catch {
        // Language still applies for this session when storage is unavailable.
      }
      applyLanguage(language);
      closeDialogAnimated($("#language-dialog"));
    });
    syncLanguageOptions();
    let languageRefreshTimer = null;
    const observer = new MutationObserver(() => {
      window.clearTimeout(languageRefreshTimer);
      languageRefreshTimer = window.setTimeout(() => {
        applyLanguageToDom();
        translateUserContentDom();
      }, 20);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    state.languageObserver = observer;
  }

  function translateUiText(text) {
    if (!text || state.language === "zh-CN") return text;
    const data = window.KERRY_I18N;
    const selected = data?.dict?.[state.language] || {};
    return selected[text] || data?.dict?.en?.[text] || text;
  }

  function applyLanguage(language) {
    const supported = new Set(
      (window.KERRY_I18N?.languages || []).map((item) => item.code)
    );
    state.language = supported.has(language)
      ? language
      : window.KERRY_I18N?.fallback || "zh-CN";
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === "fa" ? "rtl" : "ltr";
    document.documentElement.dataset.language = state.language;
    state.userTranslationToken = (state.userTranslationToken || 0) + 1;
    state.userTranslationCache =
      state.userTranslationCache || loadTranslationCache();
    applyLanguageToDom();
    translateMissingStaticUi();
    translateUserContentDom();
    if (state.mapReady) applyBuiltInBilingualLabels();
    syncLanguageOptions();
  }

  function loadTranslationCache() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem("kerry-user-translation-cache-v1") || "{}"
      );
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveTranslationCache() {
    try {
      const entries = Object.entries(state.userTranslationCache || {});
      const trimmed = Object.fromEntries(entries.slice(-1200));
      state.userTranslationCache = trimmed;
      localStorage.setItem(
        "kerry-user-translation-cache-v1",
        JSON.stringify(trimmed)
      );
    } catch {
      // Translation still works for this page when storage is unavailable.
    }
  }

  async function loadCloudTranslationCache() {
    try {
      const url = new URL("translation-cache.json?v=" + Date.now(), document.baseURI);
      const response = await fetch(url.href, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      for (const entry of payload?.entries || []) {
        const language = String(entry?.language || "");
        const source = String(entry?.source || "");
        const translation = String(entry?.translation || "");
        if (!language || !source || !translation) continue;
        state.userTranslationCache[language + "\u0000" + source] = translation;
      }
      saveTranslationCache();
    } catch {
      // The local cache still provides fast switching when the shared file is unavailable.
    }
  }

  function queueCloudTranslation(language, source, translation) {
    const config = getUploadConfig();
    if (!config.guestbookEndpoint) return;
    state.cloudTranslationQueue =
      state.cloudTranslationQueue || new Map();
    state.cloudTranslationQueue.set(language + "\u0000" + source, {
      language,
      source,
      translation
    });
    window.clearTimeout(state.cloudTranslationTimer);
    state.cloudTranslationTimer = window.setTimeout(
      flushCloudTranslationQueue,
      1400
    );
  }

  async function flushCloudTranslationQueue() {
    const config = getUploadConfig();
    if (!config.guestbookEndpoint || !state.cloudTranslationQueue?.size) return;
    const entries = [...state.cloudTranslationQueue.values()].slice(0, 60);
    entries.forEach((entry) =>
      state.cloudTranslationQueue.delete(
        entry.language + "\u0000" + entry.source
      )
    );
    try {
      const response = await fetch(config.guestbookEndpoint, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translation-cache",
          entries
        })
      });
      if (!response.ok) throw new Error("Translation cache write failed");
    } catch {
      // Keep the result locally; it can be translated again on a future visit.
    }
  }

  function detectTranslationSource(text) {
    if (/[\u0600-\u06ff]/i.test(text)) return "fa";
    if (/[\u0f00-\u0fff]/u.test(text)) return "bo";
    if (/[\u3040-\u30ff]/i.test(text)) return "ja";
    if (/[\uac00-\ud7af]/i.test(text)) return "ko";
    if (/[\u0e00-\u0e7f]/i.test(text)) return "th";
    if (/[\u0400-\u04ff]/i.test(text)) return "ru";
    if (/[\u0370-\u03ff]/u.test(text)) return "el";
    if (/[\u4e00-\u9fff]/i.test(text)) return "zh-CN";
    if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/iu.test(text)) {
      return "vi";
    }
    if (/[ãõ]/iu.test(text) || /\b(não|você|uma|para|com|obrigado|olá)\b/iu.test(text)) {
      return "pt";
    }
    if (/[ñ¿¡]/u.test(text) || /\b(el|los|las|una|pero|gracias|hola)\b/iu.test(text)) {
      return "es";
    }
    if (/[äöüß]/iu.test(text) || /\b(der|die|das|und|nicht|danke|hallo)\b/iu.test(text)) {
      return "de";
    }
    if (/[àâçéèêëîïôùûüÿœ]/iu.test(text) || /\b(le|les|une|des|merci|bonjour)\b/iu.test(text)) {
      return "fr";
    }
    if (/\b(yang|dan|dengan|terima|kasih|selamat)\b/iu.test(text)) {
      return /\b(saya|anda|tidak|ialah|adalah)\b/iu.test(text) ? "ms" : "id";
    }
    return "en";
  }

  async function fetchTranslationChunk(chunk, source) {
    const config = getUploadConfig();
    if (config.guestbookEndpoint) {
      try {
        const response = await fetch(config.guestbookEndpoint, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "translate",
            text: chunk,
            source,
            target: state.language
          })
        });
        if (response.ok) {
          const payload = await response.json();
          if (payload?.translation) {
            return cleanTranslatedText(payload.translation);
          }
        }
      } catch {
        // Fall back to the public endpoint below.
      }
    }
    try {
      const email =
        window.UPLOAD_CONFIG?.translationEmail || "keryxin@qq.com";
      const url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(chunk) +
        "&langpair=" +
        encodeURIComponent(source + "|" + state.language) +
        "&de=" +
        encodeURIComponent(email);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return null;
      const payload = await response.json();
      if (
        payload?.responseStatus &&
        Number(payload.responseStatus) !== 200
      ) {
        return null;
      }
      return cleanTranslatedText(payload?.responseData?.translatedText) || null;
    } catch {
      return null;
    }
  }

  function cleanTranslatedText(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  async function translateUserText(text, options = {}) {
    const sourceText = String(text || "").trim();
    if (
      !sourceText ||
      !/[\p{L}]/u.test(sourceText)
    ) {
      return text;
    }
    const hasChinese = /\p{Script=Han}/u.test(sourceText);
    if (options.chineseOnly && !hasChinese) return text;
    const source = options.chineseOnly
      ? "zh-CN"
      : detectTranslationSource(sourceText);
    if (source === state.language) return text;
    const cacheKey = state.language + "\u0000" + sourceText;
    if (state.userTranslationCache?.[cacheKey]) {
      queueCloudTranslation(
        state.language,
        sourceText,
        state.userTranslationCache[cacheKey]
      );
      return state.userTranslationCache[cacheKey];
    }
    const chunks = [];
    for (let index = 0; index < sourceText.length; index += 100) {
      chunks.push(sourceText.slice(index, index + 100));
    }
    const translated = [];
    for (const chunk of chunks) {
      const value = await fetchTranslationChunk(chunk, source);
      if (!value) return text;
      translated.push(value);
    }
    const result = translated.join("");
    state.userTranslationCache[cacheKey] = result;
    saveTranslationCache();
    queueCloudTranslation(state.language, sourceText, result);
    return result;
  }

  async function translateUserContentDom(root = document) {
    const token = state.userTranslationToken;
    const selectors = [
      ".attribute-row > span",
      ".attribute-row > strong",
      ".taste-title > strong",
      ".tag-list > span",
      ".contact-group-card > strong",
      ".contact-group-items b",
      ".album-card-info h3",
      ".album-photo-footer .renameable-photo-title",
      ".guestbook-sticker .guestbook-card-content",
      ".footprint-card-info > strong",
      ".deck-list-item > strong"
    ];
    const elements = $$(selectors.join(","), root);
    let cursor = 0;
    const worker = async () => {
      while (cursor < elements.length) {
        const index = cursor++;
        const element = elements[index];
        if (!state.userTranslationNodes.has(element)) {
          state.userTranslationNodes.set(element, element.textContent);
        }
        const original = state.userTranslationNodes.get(element);
        const translated = await translateUserText(original);
        if (
          token !== state.userTranslationToken ||
          !element.isConnected
        ) {
          continue;
        }
        if (element.textContent !== translated) {
          element.textContent = translated;
          if (element.closest(".guestbook-sticker")) {
            refreshGuestbookStickerSize(element);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
  }

  function refreshGuestbookStickerSize(element) {
    const card = element.closest(".guestbook-sticker");
    const board = $("#guestbook-board");
    if (!card || !board) return;
    const id = card.dataset.messageId;
    const message =
      state.guestbook.find((item) => item.id === id) ||
      (state.guestbookPlacement?.id === id
        ? state.guestbookPlacement
        : null);
    if (!message) return;
    const displayedMessage = {
      ...message,
      content:
        card.querySelector(".guestbook-card-content")?.textContent ||
        message.content
    };
    applyGuestbookStickerLayout(
      card,
      displayedMessage,
      Math.max(320, board.clientWidth || 720)
    );
    updateGuestbookBoardHeight();
  }

  async function translateMissingStaticUi(root = document) {
    if (
      !state.language ||
      state.language === "zh-CN" ||
      typeof translateUserText !== "function"
    ) {
      return;
    }
    const token = state.userTranslationToken;
    const selected =
      window.KERRY_I18N?.dict?.[state.language] || {};
    const skipped = [
      "script",
      "style",
      "[data-i18n-skip]",
      ".album-card",
      ".guestbook-card",
      ".deck-list",
      ".attribute-row strong",
      ".tag-list",
      ".contact-group-items",
      ".lightbox-media"
    ].join(",");
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (
            !node.nodeValue.trim() ||
            !parent ||
            parent.closest(skipped)
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const groups = new Map();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const original = state.languageTextSources.get(node) || node.nodeValue;
      const source = original.trim();
      if (!source || selected[source] || !/[\p{L}]/u.test(source)) continue;
      if (!groups.has(source)) groups.set(source, []);
      groups.get(source).push({ node, original });
    }
    const entries = [...groups.entries()].slice(0, 140);
    let cursor = 0;
    const worker = async () => {
      while (cursor < entries.length) {
        const [source, nodes] = entries[cursor++];
        const translated = await translateUserText(source);
        if (
          token !== state.userTranslationToken ||
          translated === source
        ) {
          continue;
        }
        nodes.forEach(({ node, original }) => {
          if (!node.isConnected) return;
          const match = original.match(/^(\s*)(.*?)(\s*)$/s);
          const value = match[1] + translated + match[3];
          if (node.nodeValue !== value) node.nodeValue = value;
        });
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
  }

  function applyLanguageToDom(root = document) {
    const skipped = [
      "script",
      "style",
      "[data-i18n-skip]",
      ".album-card",
      ".guestbook-card",
      ".deck-list",
      ".attribute-row strong",
      ".tag-list",
      ".contact-group-items",
      ".lightbox-media"
    ].join(",");
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || parent.closest(skipped)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (!state.languageTextSources.has(node)) {
        state.languageTextSources.set(node, node.nodeValue);
      }
      const original = state.languageTextSources.get(node);
      const match = original.match(/^(\s*)(.*?)(\s*)$/s);
      const nextValue = match[1] + translateUiText(match[2]) + match[3];
      if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
    });
    $$("input[placeholder], textarea[placeholder]", root).forEach((input) => {
      if (!input.dataset.i18nPlaceholder) {
        input.dataset.i18nPlaceholder = input.placeholder;
      }
      input.placeholder = translateUiText(input.dataset.i18nPlaceholder);
    });
    $$("[title], [aria-label]", root).forEach((element) => {
      if (element.title) {
        if (!element.dataset.i18nTitle) element.dataset.i18nTitle = element.title;
        element.title = translateUiText(element.dataset.i18nTitle);
      }
      if (element.getAttribute("aria-label")) {
        if (!element.dataset.i18nAriaLabel) {
          element.dataset.i18nAriaLabel = element.getAttribute("aria-label");
        }
        element.setAttribute(
          "aria-label",
          translateUiText(element.dataset.i18nAriaLabel)
        );
      }
    });
  }

  function syncLanguageOptions() {
    $$("[data-language]", $("#language-grid")).forEach((button) => {
      const active = button.dataset.language === state.language;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setupTheme() {
    const dialog = $("#theme-dialog");
    const syncDefaultControls = () => {
      const currentTheme = document.documentElement.dataset.theme;
      const button = $("#set-default-theme");
      const status = $("#default-theme-status");
      if (!button || !status) return;
      button.disabled = currentTheme === state.defaultTheme;
      status.textContent =
        "当前默认：" + THEME_META[state.defaultTheme].name;
    };
    const applyTheme = (theme) => {
      const normalized = THEME_META[theme] ? theme : "deep-blue";
      document.documentElement.dataset.theme = normalized;
      $$("[data-theme-option]").forEach((button) => {
        const active = button.dataset.themeOption === normalized;
        button.classList.toggle("selected", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = THEME_META[normalized].color;
      syncDefaultControls();
    };
    const updateSeasonalBadges = (seasonal) => {
      $$("[data-seasonal-badge]").forEach((badge) => {
        const active = badge.dataset.seasonalBadge === seasonal?.theme;
        badge.hidden = !active;
        if (active) badge.textContent = seasonal.label;
      });
    };
    const seasonal = getSeasonalTheme(new Date());
    state.seasonalThemeKey = seasonal?.theme || "";
    updateSeasonalBadges(seasonal);
    applyTheme(seasonal?.theme || state.defaultTheme);
    state.applyTheme = applyTheme;
    state.updateSeasonalBadges = updateSeasonalBadges;
    state.syncDefaultThemeControls = syncDefaultControls;

    $("#theme-entry").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme);
      updateSeasonalBadges(getSeasonalTheme(new Date()));
      syncDefaultControls();
      openDialog(dialog);
    });
    $$("[data-theme-option]").forEach((button) => {
      button.addEventListener("click", () => {
        const theme = button.dataset.themeOption;
        state.themeUserOverride = true;
        applyTheme(theme);
        showToast("已切换为" + THEME_META[theme].name + "主题。");
      });
    });
    $("#set-default-theme").addEventListener("click", async () => {
      if (!requireAdmin()) return;
      const theme = document.documentElement.dataset.theme;
      if (!THEME_META[theme] || theme === state.defaultTheme) return;
      const previousDefault = state.defaultTheme;
      const button = $("#set-default-theme");
      const status = $("#default-theme-status");
      button.disabled = true;
      status.textContent = "正在发布默认主题...";
      state.defaultTheme = theme;
      try {
        await publishSharedContent(
          "Set shared default theme: " + THEME_META[theme].name
        );
        syncDefaultControls();
        showToast(
          "已将" + THEME_META[theme].name + "设为全站默认主题。"
        );
      } catch (error) {
        state.defaultTheme = previousDefault;
        syncDefaultControls();
        showToast("默认主题设置失败：" + error.message);
      }
    });

    window.setInterval(() => {
      const currentSeasonal = getSeasonalTheme(new Date());
      const nextKey = currentSeasonal?.theme || "";
      if (nextKey === state.seasonalThemeKey) return;
      state.seasonalThemeKey = nextKey;
      updateSeasonalBadges(currentSeasonal);
      if (nextKey) {
        state.themeUserOverride = false;
        applyTheme(nextKey);
      } else if (!state.themeUserOverride) {
        applyTheme(state.defaultTheme);
      }
    }, 60_000);
  }

  function getSeasonalTheme(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateValue = year * 10000 + month * 100 + day;
    const lunar = getChineseLunarDate(date);

    if (lunar && !lunar.leap) {
      if (lunar.month === 1 && lunar.day === 15) {
        return { theme: "lantern", label: "元宵主题" };
      }
      if (lunar.month === 5 && lunar.day === 5) {
        return { theme: "dragon-boat", label: "端午主题" };
      }
      if (lunar.month === 8 && lunar.day === 15) {
        return { theme: "mid-autumn", label: "中秋主题" };
      }
      if (lunar.month === 9 && lunar.day === 9) {
        return { theme: "double-ninth", label: "重阳主题" };
      }
    }

    if (month === 5 && day >= 1 && day <= 5) {
      return { theme: "labor", label: "劳动主题" };
    }
    if (month === 10 && day >= 1 && day <= 7) {
      return { theme: "national-day", label: "中国国庆主题" };
    }

    if (
      (month === 12 && day === 31) ||
      (month === 1 && day <= 2)
    ) {
      return { theme: "new-year", label: "元旦主题" };
    }

    const qingming = QINGMING_DATES[year];
    if (qingming && month === qingming[0] && day === qingming[1]) {
      return { theme: "qingming", label: "清明主题" };
    }

    const easter = getEasterDate(year);
    const easterValue =
      easter.getFullYear() * 10000 +
      (easter.getMonth() + 1) * 100 +
      easter.getDate();
    if (
      dateValue >= shiftDateValue(easter, -2) &&
      dateValue <= shiftDateValue(easter, 1)
    ) {
      return { theme: "easter", label: "复活节主题" };
    }

    if (month === 12 && day >= 24 && day <= 26) {
      return { theme: "christmas", label: "圣诞主题" };
    }

    const thanksgivingStart = getThanksgivingDate(year);
    const thanksgivingDay = thanksgivingStart.getDate();
    if (
      month === 11 &&
      day >= thanksgivingDay &&
      day <= thanksgivingDay + 3
    ) {
      return { theme: "gratitude", label: "感恩主题" };
    }

    for (const springYear of [year - 1, year]) {
      const parts = SPRING_FESTIVAL_DATES[springYear];
      if (!parts) continue;
      const springDate = new Date(
        springYear,
        parts[0] - 1,
        parts[1],
        12
      );
      const springValue =
        springDate.getFullYear() * 10000 +
        (springDate.getMonth() + 1) * 100 +
        springDate.getDate();
      const eve = shiftDateValue(springDate, -1);
      const end = shiftDateValue(springDate, 7);
      if (dateValue >= eve && dateValue <= end) {
        return { theme: "spring-festival", label: "春节主题" };
      }
    }
    return null;
  }

  function getChineseLunarDate(date) {
    try {
      const label = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
        month: "long",
        day: "numeric"
      }).format(date);
      const match = label.match(/^(闰)?(.+?)月(\d+)日$/);
      if (!match) return null;
      const monthNames = {
        正: 1,
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
        十一: 11,
        冬: 11,
        十二: 12,
        腊: 12
      };
      return {
        leap: Boolean(match[1]),
        month: monthNames[match[2]] || 0,
        day: Number(match[3])
      };
    } catch {
      return null;
    }
  }

  function getEasterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day, 12);
  }

  function getThanksgivingDate(year) {
    const firstDay = new Date(year, 10, 1, 12).getDay();
    const firstThursday = 1 + ((4 - firstDay + 7) % 7);
    return new Date(year, 10, firstThursday + 21, 12);
  }

  function shiftDateValue(date, days) {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + days);
    return (
      shifted.getFullYear() * 10000 +
      (shifted.getMonth() + 1) * 100 +
      shifted.getDate()
    );
  }

  function updateBackToTopPlacement() {
    const button = $("#back-to-top");
    const activeView = $$("[data-page-view]").find((view) => !view.hidden);
    const content = activeView
      ? (activeView.matches(".section-shell")
          ? activeView
          : $(".section-shell", activeView))
      : null;
    if (!button || !content) return;
    const viewportWidth = document.documentElement.clientWidth;
    const contentRight = content.getBoundingClientRect().right;
    const blankWidth = Math.max(0, viewportWidth - contentRight);
    const buttonWidth = button.offsetWidth || 80;
    const showAfterScroll = Math.max(360, window.innerHeight * 0.32);
    button.hidden =
      window.scrollY < showAfterScroll ||
      blankWidth < buttonWidth * 3;
    if (!button.hidden) {
      button.style.right = Math.max(
        0,
        blankWidth / 2 - buttonWidth / 2
      ) + "px";
    }
  }

  async function populateProfile() {
    const profile = DATA.profile || {};
    state.attributes = defaultAttributes();
    state.tagGroups = defaultTagGroups();
    state.contactGroups = defaultContactGroups();
    renderProfileContent();
    renderContactContent();

    if (profile.avatar) {
      const slot = $("[data-avatar-slot]");
      try {
        const avatarSource = await resolveImagePath(profile.avatar, state.avatarUrls);
        slot.style.backgroundImage =
          "linear-gradient(180deg, rgba(7,20,35,.02), rgba(7,20,35,.22)), url(\"" +
          escapeCssUrl(avatarSource) +
          "\")";
        slot.style.backgroundSize = "cover";
        slot.style.backgroundPosition = "center";
        slot.classList.add("has-image");
      } catch (error) {
        console.warn("Avatar could not be loaded:", error);
      }
    }
  }

  function defaultAttributes() {
    const profile = DATA.profile || {};
    return [
      { id: "nickname", key: "昵称", value: profile.name || "Kerry Xing" },
      { id: "identity", key: "身份", value: profile.identity || "研究生" },
      { id: "mbti", key: "MBTI", value: "ENFP · 灵感型冒险家" },
      { id: "location", key: "坐标", value: profile.location || "中国 · 广东 · 深圳" },
      { id: "skills", key: "技能", value: (DATA.skills || ["绘画", "代码"]).join(" · ") },
      {
        id: "hobbies",
        key: "爱好",
        value: (DATA.hobbies || ["电游", "锻炼", "桌游", "聚会"]).join("，")
      }
    ];
  }

  function defaultTagGroups() {
    return [
      {
        id: "anime",
        title: "看过的番",
        tags: [...(DATA.animes || [])]
      },
      {
        id: "games",
        title: "游戏宇宙",
        tags: [...(DATA.games || [])]
      }
    ];
  }

  function defaultContactGroups() {
    return [
      {
        id: "social",
        title: "社交平台",
        items: [
          { id: "bilibili", key: "Bilibili", value: "361404379" },
          { id: "douyin", key: "抖音", value: "Kr." },
          { id: "steam", key: "Steam", value: "keryxin" }
        ]
      },
      {
        id: "contact",
        title: "联系方式",
        items: [
          { id: "qq", key: "QQ", value: "1265856193" },
          { id: "wechat", key: "微信", value: "KeryXing" },
          { id: "email", key: "Email", value: "keryxin@qq.com" }
        ]
      }
    ];
  }

  function renderProfileContent() {
    const table = $("#attribute-table");
    if (table) {
      table.replaceChildren(
        ...state.attributes.map((row) => {
          const element = document.createElement("div");
          element.className = "attribute-row";
          element.setAttribute("role", "row");
          const key = document.createElement("span");
          key.setAttribute("role", "rowheader");
          key.textContent = row.key;
          const value = document.createElement("strong");
          value.setAttribute("role", "cell");
          value.textContent = row.value;
          element.append(key, value);
          return element;
        })
      );
    }

    const groupContainer = $("#tag-groups");
    if (groupContainer) {
      groupContainer.replaceChildren(
        ...state.tagGroups.map((group) => {
          const card = document.createElement("article");
          card.className = "taste-card reveal";
          const title = document.createElement("div");
          title.className = "taste-title";
          const heading = document.createElement("strong");
          heading.textContent = group.title;
          title.append(heading);
          const tags = document.createElement("div");
          tags.className = "tag-list";
          tags.replaceChildren(
            ...group.tags.map((tagText) => {
              const tag = document.createElement("span");
              tag.textContent = tagText;
              return tag;
            })
          );
          card.append(title, tags);
          return card;
        })
      );
      observeRevealElements(groupContainer);
    }
  }

  function setupProfileEditor() {
    $("#edit-profile-button").addEventListener("click", openProfileEditor);
    $("#add-attribute-row").addEventListener("click", () => {
      addAttributeEditorRow({ id: createId("attribute"), key: "", value: "" });
    });
    $("#add-tag-group").addEventListener("click", () => {
      addTagGroupEditor({ id: createId("group"), title: "", tags: [] });
    });
    $("#save-profile-editor").addEventListener("click", saveProfileEditor);
  }

  function renderContactContent() {
    const container = $("#contact-groups");
    if (!container) return;
    container.replaceChildren(
      ...state.contactGroups.map((group) => {
        const card = document.createElement("article");
        card.className = "contact-group-card reveal";
        const title = document.createElement("strong");
        title.textContent = group.title;
        const items = document.createElement("div");
        items.className = "contact-group-items";
        items.replaceChildren(
          ...group.items.map((item) => {
            const row = document.createElement("span");
            const key = document.createElement("b");
            key.textContent = item.key;
            const value = document.createElement("i");
            value.textContent = item.value;
            row.append(key, value);
            return row;
          })
        );
        card.append(title, items);
        return card;
      })
    );
    observeRevealElements(container);
  }

  function setupContactEditor() {
    $("#edit-contact-button").addEventListener("click", openContactEditor);
    $("#add-contact-group").addEventListener("click", () => {
      addContactGroupEditor({
        id: createId("contact-group"),
        title: "",
        items: []
      });
    });
    $("#save-contact-editor").addEventListener("click", saveContactEditor);
  }

  function openContactEditor() {
    if (!requireAdmin()) return;
    $("#contact-group-editor").replaceChildren();
    state.contactGroups.forEach(addContactGroupEditor);
    $("#contact-editor-status").textContent = "";
    openDialog($("#contact-editor-dialog"));
  }

  function addContactGroupEditor(group) {
    const container = document.createElement("div");
    container.className = "editor-row contact-group-editor-row";
    container.dataset.id = group.id || createId("contact-group");
    const title = document.createElement("input");
    title.type = "text";
    title.dataset.field = "title";
    title.placeholder = "标签框标题";
    title.value = group.title || "";
    const items = document.createElement("textarea");
    items.dataset.field = "items";
    items.placeholder = "每行一项，格式：Bilibili | 我的主页";
    items.value = (group.items || [])
      .map((item) => item.key + " | " + item.value)
      .join("\n");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "editor-remove";
    remove.setAttribute("aria-label", "删除这个联系标签框");
    remove.textContent = "×";
    remove.addEventListener("click", () => container.remove());
    container.append(title, items, remove);
    $("#contact-group-editor").append(container);
  }

  async function saveContactEditor() {
    if (!requireAdmin()) return;
    const previousGroups = state.contactGroups;
    const groups = $$("#contact-group-editor .contact-group-editor-row")
      .map((row) => ({
        id: row.dataset.id,
        title: row.querySelector('[data-field="title"]').value.trim(),
        items: row.querySelector('[data-field="items"]').value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const separator = line.indexOf("|");
            return {
              id: createId("contact-item"),
              key: separator === -1 ? line : line.slice(0, separator).trim(),
              value: separator === -1 ? "" : line.slice(separator + 1).trim()
            };
          })
      }))
      .filter((group) => group.title || group.items.length);

    state.contactGroups = groups;
    renderContactContent();
    const button = $("#save-contact-editor");
    const status = $("#contact-editor-status");
    button.disabled = true;
    status.textContent = "正在发布联系信息...";
    try {
      await publishSharedContent("Update contact information");
      status.textContent = "联系信息已发布。";
      closeDialogAnimated($("#contact-editor-dialog"));
      showToast("联系信息已发布。");
    } catch (error) {
      state.contactGroups = previousGroups;
      renderContactContent();
      status.textContent = "发布失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  }

  function openProfileEditor() {
    if (!requireAdmin()) return;
    $("#attribute-editor-rows").replaceChildren();
    $("#tag-group-editor").replaceChildren();
    state.attributes.forEach(addAttributeEditorRow);
    state.tagGroups.forEach(addTagGroupEditor);
    $("#profile-editor-status").textContent = "";
    openDialog($("#profile-editor-dialog"));
  }

  function addAttributeEditorRow(row) {
    const container = document.createElement("div");
    container.className = "editor-row attribute-editor-row";
    container.dataset.id = row.id || createId("attribute");
    const key = document.createElement("input");
    key.type = "text";
    key.dataset.field = "key";
    key.placeholder = "属性名";
    key.value = row.key || "";
    const value = document.createElement("input");
    value.type = "text";
    value.dataset.field = "value";
    value.placeholder = "属性内容";
    value.value = row.value || "";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "editor-remove";
    remove.setAttribute("aria-label", "删除这一行");
    remove.textContent = "×";
    remove.addEventListener("click", () => container.remove());
    container.append(key, value, remove);
    $("#attribute-editor-rows").append(container);
  }

  function addTagGroupEditor(group) {
    const container = document.createElement("div");
    container.className = "editor-row tag-group-editor-row";
    container.dataset.id = group.id || createId("group");
    const title = document.createElement("input");
    title.type = "text";
    title.dataset.field = "title";
    title.placeholder = "标签框标题";
    title.value = group.title || "";
    const tags = document.createElement("textarea");
    tags.dataset.field = "tags";
    tags.placeholder = "每行一个标签";
    tags.value = (group.tags || []).join("\n");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "editor-remove";
    remove.setAttribute("aria-label", "删除这个标签框");
    remove.textContent = "×";
    remove.addEventListener("click", () => container.remove());
    container.append(title, tags, remove);
    $("#tag-group-editor").append(container);
  }

  async function saveProfileEditor() {
    if (!requireAdmin()) return;
    const previousAttributes = state.attributes;
    const previousGroups = state.tagGroups;
    const attributes = $$("#attribute-editor-rows .attribute-editor-row")
      .map((row) => ({
        id: row.dataset.id,
        key: row.querySelector('[data-field="key"]').value.trim(),
        value: row.querySelector('[data-field="value"]').value.trim()
      }))
      .filter((row) => row.key || row.value);
    const tagGroups = $$("#tag-group-editor .tag-group-editor-row")
      .map((row) => ({
        id: row.dataset.id,
        title: row.querySelector('[data-field="title"]').value.trim(),
        tags: row.querySelector('[data-field="tags"]').value
          .split(/\r?\n|,/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      }))
      .filter((group) => group.title || group.tags.length);

    state.attributes = attributes;
    state.tagGroups = tagGroups;
    renderProfileContent();
    const button = $("#save-profile-editor");
    const status = $("#profile-editor-status");
    button.disabled = true;
    status.textContent = "正在发布属性表...";
    try {
      await publishSharedContent("Update profile attributes");
      status.textContent = "属性表已发布。";
      closeDialogAnimated($("#profile-editor-dialog"));
      showToast("属性表已发布到共享网站。");
    } catch (error) {
      state.attributes = previousAttributes;
      state.tagGroups = previousGroups;
      renderProfileContent();
      status.textContent = "发布失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  }

  function escapeCssUrl(value) {
    return String(value).replace(/["\\\n\r]/g, "");
  }

  function setupVisualUploads() {
    const heroButton = $("#hero-upload-button");
    const heroInput = $("#hero-file-input");
    const avatarButton = $("#avatar-upload-button");
    const avatarInput = $("#avatar-history-file-input");

    heroButton.addEventListener("click", () => {
      if (!requireAdmin()) return;
      state.heroSelectionMode = false;
      state.selectedHeroIds = [];
      renderHeroImageList();
      openDialog($("#hero-dialog"));
    });
    $("#hero-multi-toggle").addEventListener("click", toggleHeroSelectionMode);
    $("#hero-set-cover").addEventListener("click", () => {
      if (state.selectedHeroIds.length) {
        const media = state.selectedHeroIds
          .map(heroMediaById)
          .filter(Boolean);
        if (media.length) selectHeroImages(media);
      }
    });
    $("#hero-delete-button").addEventListener("click", deleteSelectedHeroImages);
    avatarButton.addEventListener("click", () => {
      if (!requireAdmin()) return;
      state.avatarSelectionMode = false;
      state.selectedAvatarIds = [];
      $("#avatar-dialog-status").textContent = "";
      renderAvatarHistory();
      openDialog($("#avatar-dialog"));
    });
    $("#avatar-multi-toggle").addEventListener("click", toggleAvatarSelectionMode);
    $("#avatar-set-current").addEventListener("click", useSelectedAvatar);
    $("#avatar-delete-selected").addEventListener("click", deleteSelectedAvatars);

    heroInput.addEventListener("change", async () => {
      const selectedFiles = [...(heroInput.files || [])];
      if (!selectedFiles.length || !requireAdmin()) return;
      heroButton.disabled = true;
      showToast("正在处理 " + selectedFiles.length + " 个首页背景文件...");
      const previousPendingHero = state.pendingHeroMedia;
      const previousPendingItems = [...state.pendingHeroItems];
      try {
        const items = [];
        for (const file of selectedFiles) {
          items.push(await createMediaItem(file));
        }
        state.pendingHeroItems = items;
        state.pendingHeroMedia = null;
        if (items[0]) displayHeroMedia(items[0]);
        await publishSharedContent("Upload homepage backgrounds");
        state.heroSelectionMode = false;
        state.selectedHeroIds = [];
        renderHeroImageList();
        showToast("首页背景已发布到共享网站。");
      } catch (error) {
        state.pendingHeroMedia = previousPendingHero;
        state.pendingHeroItems = previousPendingItems;
        if (state.sharedProfile.heroMedia) {
          displayHeroMedia(state.sharedProfile.heroMedia);
        } else {
          await applyHeroMedia(DATA.profile?.heroMedia);
        }
        showToast("首页图片处理失败：" + error.message);
      } finally {
        heroButton.disabled = false;
        heroInput.value = "";
      }
    });

    avatarInput.addEventListener("change", async () => {
      const files = [...(avatarInput.files || [])];
      if (!files.length || !requireAdmin()) return;
      avatarButton.disabled = true;
      const status = $("#avatar-dialog-status");
      status.textContent = "正在处理 " + files.length + " 张头像...";
      const previousPendingItems = [...state.pendingAvatarItems];
      const previousPendingAvatar = state.pendingAvatarMedia;
      try {
        const items = [];
        for (const file of files) {
          const media = await createMediaItem(file);
          if (media.kind !== "photo") {
            throw new Error("请选择图片文件作为头像");
          }
          items.push(media);
        }
        state.pendingAvatarItems = items;
        state.pendingAvatarMedia = null;
        if (items[0]) displayAvatarMedia(items[0]);
        await publishSharedContent("Upload profile avatars");
        state.avatarSelectionMode = false;
        state.selectedAvatarIds = [];
        renderAvatarHistory();
        status.textContent = "头像已上传并发布。";
        showToast("头像已发布到共享网站。");
      } catch (error) {
        state.pendingAvatarItems = previousPendingItems;
        state.pendingAvatarMedia = previousPendingAvatar;
        await renderSharedAvatar();
        status.textContent = "头像处理失败：" + error.message;
        showToast("头像处理失败：" + error.message);
      } finally {
        avatarButton.disabled = false;
        avatarInput.value = "";
      }
    });
  }

  function renderHeroImageList() {
    const list = $("#hero-image-list");
    const images = Array.isArray(state.sharedProfile.heroImages)
      ? state.sharedProfile.heroImages
      : [];
    const rotationIds = heroCoverMedia().map(heroMediaKey);
    const current = state.sharedProfile.heroMedia;
    const currentKey = typeof current === "string"
      ? current
      : current?.id || current?.src || "";

    if (!images.length) {
      const empty = document.createElement("p");
      empty.className = "hero-list-empty";
      empty.textContent = "还没有上传过新的首页背景。";
      list.replaceChildren(empty);
      syncHeroSelectionUI();
      return;
    }

    state.selectedHeroIds = state.selectedHeroIds.filter((id) =>
      images.some((media) => (media.id || media.src) === id)
    );

    list.replaceChildren(
      ...images.map((media, index) => {
        const button = document.createElement("button");
        button.type = "button";
        const key = media.id || media.src;
        const rotationIndex = rotationIds.indexOf(key);
        const selectedIndex = state.selectedHeroIds.indexOf(key);
        button.className = "hero-list-item" +
          (selectedIndex >= 0 ? " selected" : "") +
          (rotationIndex >= 0 || key === currentKey ? " in-use" : "");
        button.dataset.heroId = key;
        const preview = document.createElement("div");
        preview.className = "hero-list-preview";
        preview.append(createMediaNode(media, state.mainUrls, true));
        const label = document.createElement("span");
        label.textContent = "背景 " + String(index + 1).padStart(2, "0");
        const stateLabel = document.createElement("small");
        stateLabel.textContent =
          selectedIndex >= 0
            ? "已选择 · 第 " + (selectedIndex + 1) + " 位"
            : rotationIndex >= 0
              ? "轮换封面 " + (rotationIndex + 1) + " / " + rotationIds.length
              : state.heroSelectionMode
                ? "点击加入轮换"
                : "点击进入多选";
        button.append(preview, label, stateLabel);
        button.addEventListener("click", () => {
          if (!state.heroSelectionMode) {
            state.heroSelectionMode = true;
          }
          const selected = state.selectedHeroIds.includes(key);
          state.selectedHeroIds = selected
            ? state.selectedHeroIds.filter((id) => id !== key)
            : [...state.selectedHeroIds, key];
          syncHeroSelectionUI();
        });
        return button;
      })
    );
    syncHeroSelectionUI();
    activateAnimatedMedia(list);
  }

  function heroMediaById(id) {
    return (state.sharedProfile.heroImages || []).find(
      (media) => (media.id || media.src) === id
    ) || null;
  }

  function heroMediaKey(media) {
    if (typeof media === "string") return media;
    return media?.id || media?.src || "";
  }

  function heroCoverMedia() {
    const images = Array.isArray(state.sharedProfile.heroImages)
      ? state.sharedProfile.heroImages
      : [];
    const ids = Array.isArray(state.sharedProfile.heroCoverIds)
      ? state.sharedProfile.heroCoverIds
      : [];
    const media = ids
      .map((id) => images.find((item) => heroMediaKey(item) === id))
      .filter(Boolean);
    if (media.length) return media;
    const current = state.sharedProfile.heroMedia;
    return current ? [current] : [];
  }

  function toggleHeroSelectionMode() {
    if (state.heroSelectionMode) {
      state.heroSelectionMode = false;
      state.selectedHeroIds = [];
    } else {
      state.heroSelectionMode = true;
      state.selectedHeroIds = heroCoverMedia().map(heroMediaKey);
    }
    syncHeroSelectionUI();
  }

  function syncHeroSelectionUI() {
    $("#hero-multi-toggle").textContent = state.heroSelectionMode
      ? "退出多选"
      : "多选";
    $("#hero-set-cover").hidden = !state.heroSelectionMode;
    $("#hero-delete-button").hidden = !state.heroSelectionMode;
    $("#hero-set-cover").disabled = state.selectedHeroIds.length === 0;
    $("#hero-delete-button").disabled = state.selectedHeroIds.length === 0;
    $$(".hero-list-item", $("#hero-image-list")).forEach((card) => {
      const selected = state.selectedHeroIds.includes(card.dataset.heroId);
      card.classList.toggle("selected", selected);
      let check = card.querySelector(".photo-selected-check");
      if (selected && !check) {
        check = document.createElement("span");
        check.className = "photo-selected-check";
        check.textContent = "✓";
        card.append(check);
      } else if (!selected && check) {
        check.remove();
      }
      let order = card.querySelector(".cover-order-badge");
      const orderIndex = state.selectedHeroIds.indexOf(card.dataset.heroId);
      if (selected && orderIndex >= 0) {
        if (!order) {
          order = document.createElement("span");
          order.className = "cover-order-badge";
          card.append(order);
        }
        order.textContent = String(orderIndex + 1);
      } else if (order) {
        order.remove();
      }
    });
  }

  async function selectHeroImages(mediaList) {
    if (!requireAdmin()) return;
    const previousHero = state.sharedProfile.heroMedia;
    const previousCoverIds = [...(state.sharedProfile.heroCoverIds || [])];
    const previousSelectedIds = [...state.selectedHeroIds];
    state.sharedProfile.heroMedia = mediaList[0];
    state.sharedProfile.heroCoverIds = mediaList.map(heroMediaKey);
    displayHeroCarousel(mediaList);
    statusToastInDialog("正在发布首页封面轮换...");
    try {
      await publishSharedContent("Update homepage cover rotation");
      state.heroSelectionMode = false;
      state.selectedHeroIds = [];
      renderHeroImageList();
      showToast("首页封面轮换已发布。");
    } catch (error) {
      state.sharedProfile.heroMedia = previousHero;
      state.sharedProfile.heroCoverIds = previousCoverIds;
      state.selectedHeroIds = previousSelectedIds;
      displayHeroCarousel(heroCoverMedia());
      renderHeroImageList();
      showToast("背景切换失败：" + error.message);
    }
  }

  async function deleteSelectedHeroImages() {
    if (!requireAdmin()) return;
    const selectedIds = [...state.selectedHeroIds];
    if (!selectedIds.length) return;
    if (!window.confirm("从背景列表中删除选中的 " + selectedIds.length + " 个背景吗？")) {
      return;
    }

    const previousImages = [...(state.sharedProfile.heroImages || [])];
    const previousHero = state.sharedProfile.heroMedia;
    const previousCoverIds = [...(state.sharedProfile.heroCoverIds || [])];
    const previousKey = typeof previousHero === "string"
      ? previousHero
      : previousHero?.id || previousHero?.src || "";
    const deletingCurrent = selectedIds.includes(previousKey);
    state.sharedProfile.heroImages = previousImages.filter(
      (media) => !selectedIds.includes(media.id || media.src)
    );
    state.sharedProfile.heroCoverIds = previousCoverIds.filter(
      (id) => !selectedIds.includes(id)
    );
    const next = deletingCurrent
      ? heroMediaById(state.sharedProfile.heroCoverIds[0]) ||
        state.sharedProfile.heroImages[0] ||
        null
      : previousHero;
    state.sharedProfile.heroMedia = next;
    state.heroSelectionMode = false;
    state.selectedHeroIds = [];
    if (deletingCurrent) {
      if (next) displayHeroCarousel(heroCoverMedia());
      else clearHeroDisplay();
    }

    try {
      await publishSharedContent("Delete homepage background");
      if (deletingCurrent && !next) {
        await applyHeroMedia(DATA.profile?.heroMedia);
      }
      renderHeroImageList();
      showToast("背景删除已发布。");
    } catch (error) {
      state.sharedProfile.heroImages = previousImages;
      state.sharedProfile.heroMedia = previousHero;
      state.sharedProfile.heroCoverIds = previousCoverIds;
      if (previousHero) displayHeroCarousel(heroCoverMedia());
      renderHeroImageList();
      showToast("背景删除失败：" + error.message);
    }
  }

  function statusToastInDialog(message) {
    showToast(message);
  }

  function clearHeroDisplay() {
    stopHeroRotation();
    revokeUrls(state.heroUrls);
    state.heroUrls = [];
    $$(".hero-site-media", $(".hero-image-frame")).forEach((node) => node.remove());
    const art = $(".hero-placeholder-art");
    if (art) art.hidden = false;
  }

  function displayAvatarMedia(media) {
    const blob = media.imageBlob || media.stillBlob;
    if (!blob) return;
    revokeUrls(state.avatarUrls);
    state.avatarUrls = [];
    const source = registerUrl(blob, state.avatarUrls);
    const slot = $("[data-avatar-slot]");
    slot.style.backgroundImage =
      "linear-gradient(180deg, rgba(7,20,35,.02), rgba(7,20,35,.22)), url(\"" +
      escapeCssUrl(source) +
      "\")";
    slot.style.backgroundSize = "cover";
    slot.style.backgroundPosition = "center";
    slot.classList.add("has-image");
  }

  function avatarHistoryItems() {
    const history = Array.isArray(state.sharedProfile.avatarImages)
      ? state.sharedProfile.avatarImages.filter((item) => item?.src)
      : [];
    if (
      state.sharedProfile.avatar &&
      !history.some((item) => item.src === state.sharedProfile.avatar)
    ) {
      history.unshift({
        id: "avatar-legacy",
        src: state.sharedProfile.avatar,
        title: "当前头像",
        createdAt: ""
      });
    }
    return history;
  }

  function renderAvatarHistory() {
    const list = $("#avatar-history-list");
    const history = avatarHistoryItems();
    state.selectedAvatarIds = state.selectedAvatarIds.filter((id) =>
      history.some((item) => item.id === id)
    );
    if (!history.length) {
      const empty = document.createElement("p");
      empty.className = "avatar-history-empty";
      empty.textContent = "还没有上传过头像。";
      list.replaceChildren(empty);
      syncAvatarSelectionUI();
      return;
    }

    list.replaceChildren(
      ...history.map((item) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "avatar-history-card" +
          (state.selectedAvatarIds.includes(item.id) ? " selected" : "") +
          (item.src === state.sharedProfile.avatar ? " in-use" : "");
        card.dataset.avatarId = item.id;
        const image = document.createElement("img");
        image.src = item.src;
        image.alt = item.title || "历史头像";
        image.loading = "lazy";
        const title = document.createElement("span");
        title.textContent = item.src === state.sharedProfile.avatar
          ? "当前头像"
          : item.title || "历史头像";
        if (state.selectedAvatarIds.includes(item.id)) {
          const check = document.createElement("span");
          check.className = "photo-selected-check";
          check.textContent = "✓";
          card.append(check);
        }
        card.append(image, title);
        card.addEventListener("click", () => {
          if (!state.avatarSelectionMode) state.avatarSelectionMode = true;
          const selected = state.selectedAvatarIds.includes(item.id);
          state.selectedAvatarIds = selected
            ? state.selectedAvatarIds.filter((id) => id !== item.id)
            : [...state.selectedAvatarIds, item.id];
          syncAvatarSelectionUI();
        });
        return card;
      })
    );
    syncAvatarSelectionUI();
  }

  function toggleAvatarSelectionMode() {
    state.avatarSelectionMode = !state.avatarSelectionMode;
    state.selectedAvatarIds = [];
    syncAvatarSelectionUI();
  }

  function syncAvatarSelectionUI() {
    $("#avatar-multi-toggle").textContent = state.avatarSelectionMode
      ? "退出多选"
      : "多选";
    $("#avatar-set-current").hidden = !state.avatarSelectionMode;
    $("#avatar-delete-selected").hidden = !state.avatarSelectionMode;
    $("#avatar-set-current").disabled = state.selectedAvatarIds.length !== 1;
    $("#avatar-delete-selected").disabled = state.selectedAvatarIds.length === 0;
    $$(".avatar-history-card", $("#avatar-history-list")).forEach((card) => {
      const selected = state.selectedAvatarIds.includes(card.dataset.avatarId);
      card.classList.toggle("selected", selected);
      let check = card.querySelector(".photo-selected-check");
      if (selected && !check) {
        check = document.createElement("span");
        check.className = "photo-selected-check";
        check.textContent = "✓";
        card.append(check);
      } else if (!selected && check) {
        check.remove();
      }
    });
  }

  async function useSelectedAvatar() {
    if (!requireAdmin() || state.selectedAvatarIds.length !== 1) return;
    const avatar = avatarHistoryItems().find(
      (item) => item.id === state.selectedAvatarIds[0]
    );
    if (!avatar) return;
    const previousAvatar = state.sharedProfile.avatar;
    state.sharedProfile.avatar = avatar.src;
    try {
      await publishSharedContent("Choose profile avatar");
      state.avatarSelectionMode = false;
      state.selectedAvatarIds = [];
      await renderSharedAvatar();
      renderAvatarHistory();
      $("#avatar-dialog-status").textContent = "当前头像已更新。";
    } catch (error) {
      state.sharedProfile.avatar = previousAvatar;
      $("#avatar-dialog-status").textContent = "头像切换失败：" + error.message;
    }
  }

  async function deleteSelectedAvatars() {
    if (!requireAdmin() || !state.selectedAvatarIds.length) return;
    const ids = new Set(state.selectedAvatarIds);
    const previousHistory = [...avatarHistoryItems()];
    const previousAvatar = state.sharedProfile.avatar;
    const history = previousHistory.filter((item) => !ids.has(item.id));
    state.sharedProfile.avatarImages = history;
    if (ids.has("avatar-legacy") || !history.some((item) => item.src === previousAvatar)) {
      state.sharedProfile.avatar = history[0]?.src || "";
    }
    try {
      await publishSharedContent("Delete profile avatars");
      state.avatarSelectionMode = false;
      state.selectedAvatarIds = [];
      await renderSharedAvatar();
      renderAvatarHistory();
      $("#avatar-dialog-status").textContent = "所选头像已从仓库中删除。";
    } catch (error) {
      state.sharedProfile.avatarImages = previousHistory;
      state.sharedProfile.avatar = previousAvatar;
      await renderSharedAvatar();
      renderAvatarHistory();
      $("#avatar-dialog-status").textContent = "头像删除失败：" + error.message;
    }
  }

  function displayHeroMedia(media) {
    displayHeroCarousel(media ? [media] : []);
  }

  function displayHeroCarousel(mediaList) {
    const frame = $(".hero-image-frame");
    const art = $(".hero-placeholder-art");
    if (!frame || !art) return;
    stopHeroRotation();
    revokeUrls(state.heroUrls);
    state.heroUrls = [];
    $$(".hero-site-media", frame).forEach((element) => element.remove());
    const media = (mediaList || []).filter(Boolean);
    if (!media.length) {
      art.hidden = false;
      return;
    }

    const layers = media.map((item) => {
      const node = createMediaNode(item, state.heroUrls, false);
      node.classList.add("hero-site-media", "hero-rotation-layer");
      if (node.tagName === "IMG") node.alt = "";
      node.autoplay = true;
      node.muted = true;
      node.loop = true;
      node.controls = false;
      node.style.opacity = "0";
      node.style.zIndex = "1";
      node.style.transition =
        "opacity " + COVER_CROSSFADE_MS + "ms ease";
      frame.insertBefore(node, art.nextSibling);
      return node;
    });
    layers[0].style.opacity = "1";
    layers[0].style.zIndex = "2";
    state.heroRotationLayers = layers;
    state.heroRotationIndex = 0;
    art.hidden = true;
    watchAdaptiveTitleContrast(layers[0], $("h1", frame));
    activateAnimatedMedia(frame);

    if (layers.length > 1) {
      state.heroRotationTimer = window.setInterval(() => {
        if (state.heroRotationLayers.length !== layers.length) return;
        const previousIndex = state.heroRotationIndex;
        const nextIndex = (previousIndex + 1) % layers.length;
        const previous = layers[previousIndex];
        const next = layers[nextIndex];
        previous.style.zIndex = "2";
        next.style.zIndex = "3";
        next.style.opacity = "1";
        previous.style.opacity = "0";
        state.heroRotationIndex = nextIndex;
        watchAdaptiveTitleContrast(next, $("h1", frame));
        window.setTimeout(() => {
          layers.forEach((layer, index) => {
            layer.style.zIndex = index === state.heroRotationIndex ? "2" : "1";
          });
        }, COVER_CROSSFADE_MS + 60);
      }, COVER_ROTATION_INTERVAL_MS);
    }
  }

  function stopHeroRotation() {
    if (state.heroRotationTimer) {
      window.clearInterval(state.heroRotationTimer);
      state.heroRotationTimer = null;
    }
    state.heroRotationLayers = [];
    state.heroRotationIndex = 0;
  }

  async function applyHeroMedia(path) {
    if (!path) return;
    const frame = $(".hero-image-frame");
    const art = $(".hero-placeholder-art");
    if (!frame || !art) return;
    revokeUrls(state.heroUrls);
    state.heroUrls = [];
    $$(".hero-site-media", frame).forEach((node) => node.remove());
    art.hidden = false;

    try {
      if (/\.livp$/i.test(path)) {
        const response = await fetch(path);
        if (!response.ok) throw new Error("无法读取首页 LIVP");
        const extracted = await extractLivePhoto(new Blob([await response.arrayBuffer()]));
        const media = createMediaNode(
          {
            title: "首页动态图片",
            stillBlob: extracted.still,
            motionBlob: extracted.motion
          },
          state.heroUrls,
          false
        );
        media.classList.add("hero-site-media");
        media.autoplay = true;
        media.muted = true;
        media.loop = true;
        frame.insertBefore(media, art.nextSibling);
        art.hidden = true;
        watchAdaptiveTitleContrast(media, $("h1", frame));
        activateAnimatedMedia(frame);
        return;
      }

      if (/\.(mp4|webm|mov|m4v)$/i.test(path)) {
        const video = document.createElement("video");
        video.className = "hero-site-media";
        video.src = path;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        frame.insertBefore(video, art.nextSibling);
        art.hidden = true;
        watchAdaptiveTitleContrast(video, $("h1", frame));
        activateAnimatedMedia(frame);
        return;
      }

      const imageSource = await resolveImagePath(path, state.heroUrls);
      const image = document.createElement("img");
      image.className = "hero-site-media";
      image.src = imageSource;
      image.alt = "";
      frame.insertBefore(image, art.nextSibling);
      art.hidden = true;
      watchAdaptiveTitleContrast(image, $("h1", frame));
      activateAnimatedMedia(frame);
    } catch (error) {
      console.warn("Hero media could not be loaded:", error);
    }
  }

  async function resolveImagePath(path, urlBucket) {
    if (!/\.(heic|heif)$/i.test(path)) return path;
    if (location.protocol === "file:") {
      throw new Error("直接打开 HTML 时请点击 + 上传 HEIC 图片");
    }
    const response = await fetch(path);
    if (!response.ok) throw new Error("无法读取 HEIC 图片");
    const converted = await convertHeicBlob(await response.blob());
    return registerUrl(converted, urlBucket);
  }

  function getUploadConfig() {
    const configured = window.UPLOAD_CONFIG || {};
    let owner = String(configured.owner || "").trim();
    let repo = String(configured.repo || "").trim();

    if ((!owner || !repo) && location.hostname.endsWith(".github.io")) {
      owner = owner || location.hostname.split(".")[0];
      const segments = location.pathname.split("/").filter(Boolean);
      repo = repo || (segments.length ? segments[0] : owner + ".github.io");
    }

    return {
      owner,
      repo,
      branch: String(configured.branch || "").trim(),
      contentPath: configured.contentPath || "content.json",
      assetRoot: (configured.assetRoot || "shared").replace(/\/+$/, ""),
      guestbookEndpoint: String(configured.guestbookEndpoint || "").trim(),
      guestbookPath: configured.guestbookPath || "guestbook.json"
    };
  }

  function getContentUrl() {
    const config = getUploadConfig();
    return new URL(config.contentPath, document.baseURI).href;
  }

  async function loadSharedContent() {
    const response = await fetch(getContentUrl() + "?v=" + Date.now(), {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error("共享内容文件不存在，请确认已上传 content.json");
    }
    const content = await response.json();
    state.sharedContent = content;
    state.sharedProfile = { ...(content.profile || {}) };
    if (!Array.isArray(state.sharedProfile.heroCoverIds)) {
      state.sharedProfile.heroCoverIds = state.sharedProfile.heroMedia
        ? [heroMediaKey(state.sharedProfile.heroMedia)]
        : [];
    }
    state.defaultTheme = THEME_META[content.defaultTheme]
      ? content.defaultTheme
      : state.defaultTheme;
    const seasonalTheme = getSeasonalTheme(new Date());
    if (!state.themeUserOverride) {
      state.applyTheme?.(seasonalTheme?.theme || state.defaultTheme);
    }
    state.updateSeasonalBadges?.(seasonalTheme);
    state.syncDefaultThemeControls?.();
    if (
      state.sharedProfile.avatar &&
      !Array.isArray(state.sharedProfile.avatarImages)
    ) {
      state.sharedProfile.avatarImages = [{
        id: "avatar-legacy",
        src: state.sharedProfile.avatar,
        title: "当前头像",
        createdAt: ""
      }];
    }
    if (
      state.sharedProfile.heroMedia &&
      typeof state.sharedProfile.heroMedia === "object"
    ) {
      const heroImages = Array.isArray(state.sharedProfile.heroImages)
        ? [...state.sharedProfile.heroImages]
        : [];
      if (!heroImages.some(
        (media) => media.id === state.sharedProfile.heroMedia.id
      )) {
        heroImages.unshift(state.sharedProfile.heroMedia);
      }
      state.sharedProfile.heroImages = heroImages;
    }
    state.attributes = Array.isArray(content.attributes)
      ? content.attributes.map((row) => ({
          id: row.id || createId("attribute"),
          key: String(row.key || ""),
          value: String(row.value || "")
        }))
      : defaultAttributes();
    state.tagGroups = Array.isArray(content.tagGroups)
      ? content.tagGroups.map((group) => ({
          id: group.id || createId("group"),
          title: String(group.title || ""),
          tags: Array.isArray(group.tags) ? group.tags.map(String) : []
        }))
      : defaultTagGroups();
    state.contactGroups = Array.isArray(content.contactGroups)
      ? content.contactGroups.map((group) => ({
          id: group.id || createId("contact-group"),
          title: String(group.title || ""),
          items: Array.isArray(group.items)
            ? group.items.map((item) => ({
                id: item.id || createId("contact-item"),
                key: String(item.key || ""),
                value: String(item.value || "")
              }))
            : []
        }))
      : defaultContactGroups();
    state.albums = Array.isArray(content.albums)
      ? content.albums.map((album) => {
          const photos = Array.isArray(album.photos)
            ? album.photos.map((photo) => ({
                ...photo,
                kind: photo.kind || "photo"
              }))
            : [];
          const photoIds = new Set(photos.map((photo) => photo.id));
          const coverPhotoIds = (
            Array.isArray(album.coverPhotoIds)
              ? album.coverPhotoIds
              : album.coverPhotoId
                ? [album.coverPhotoId]
                : []
          ).filter((id) => photoIds.has(id));
          return {
            ...album,
            photos,
            layout:
              album.layout &&
              Number.isFinite(Number(album.layout.x)) &&
              Number.isFinite(Number(album.layout.y)) &&
              Number.isFinite(Number(album.layout.width)) &&
              Number.isFinite(Number(album.layout.height))
                ? {
                    x: Math.max(0, Math.min(1, Number(album.layout.x))),
                    y: Math.max(0, Number(album.layout.y)),
                    width: Math.max(0.2, Math.min(1, Number(album.layout.width))),
                    height: Math.max(180, Number(album.layout.height))
                  }
                : null,
            coverAnimation: ALBUM_COVER_ANIMATIONS.has(album.coverAnimation)
              ? album.coverAnimation
              : "fade",
            coverPhotoIds: coverPhotoIds.length
              ? coverPhotoIds
              : photos[0]?.id
                ? [photos[0].id]
                : [],
            coverPhotoId: coverPhotoIds[0] || photos[0]?.id || null
          };
        })
      : [];
    state.footprints = Array.isArray(content.footprints)
      ? content.footprints.map((item) => sanitizeFootprintRecord(item))
      : [];
    state.legacyDecks = Array.isArray(content.decks)
      ? content.decks.map((deck) => ({
          ...deck,
          slides: Array.isArray(deck.slides)
            ? deck.slides.map((slide) => ({
                ...slide,
                imageOnly: true,
                images: slide.images?.length
                  ? slide.images
                  : slide.src
                    ? [{ src: slide.src, name: "slide-image" }]
                    : []
              }))
            : []
        }))
      : [];
    state.decks = [];
    state.reportAccess = content.reportAccess || null;
    renderProfileContent();
    renderContactContent();
    await applySharedProfile(state.sharedProfile);
  }

  async function applySharedProfile(profile) {
    await renderSharedAvatar();

    const heroImages = Array.isArray(profile?.heroImages)
      ? profile.heroImages
      : [];
    const rotation = (profile?.heroCoverIds || [])
      .map((id) => heroImages.find((item) => heroMediaKey(item) === id))
      .filter(Boolean);
    const hero = profile?.heroMedia;
    if (rotation.length) {
      displayHeroCarousel(rotation);
    } else if (hero && typeof hero === "object") {
      displayHeroMedia(hero);
    } else {
      await applyHeroMedia(hero || DATA.profile?.heroMedia);
    }
  }

  function setAvatarSource(source) {
    const slot = $("[data-avatar-slot]");
    slot.style.backgroundImage =
      "linear-gradient(180deg, rgba(7,20,35,.02), rgba(7,20,35,.22)), url(\"" +
      escapeCssUrl(source) +
      "\")";
    slot.style.backgroundSize = "cover";
    slot.style.backgroundPosition = "center";
    slot.classList.add("has-image");
  }

  async function renderSharedAvatar() {
    const avatarPath = String(state.sharedProfile?.avatar || "").trim();
    if (!avatarPath) {
      clearAvatarSource();
      return;
    }
    try {
      revokeUrls(state.avatarUrls);
      state.avatarUrls = [];
      const avatarSource = await resolveImagePath(avatarPath, state.avatarUrls);
      setAvatarSource(avatarSource);
    } catch (error) {
      console.warn("Shared avatar could not be loaded:", error);
      clearAvatarSource();
    }
  }

  function clearAvatarSource() {
    revokeUrls(state.avatarUrls);
    state.avatarUrls = [];
    const slot = $("[data-avatar-slot]");
    slot.style.backgroundImage = "";
    slot.classList.remove("has-image");
  }

  function setupAdmin() {
    const dialog = $("#admin-dialog");
    $("#admin-entry").addEventListener("click", () => {
      updateAdminDialog();
      openDialog(dialog);
    });
    $("#admin-login-button").addEventListener("click", async () => {
      const token = $("#admin-token-input").value.trim();
      if (!token) {
        setAdminStatus("请输入 GitHub Token。", "error");
        return;
      }
      $("#admin-login-button").disabled = true;
      setAdminStatus("正在验证仓库权限...");
      try {
        await authenticateAdmin(token, false);
        setAdminStatus("管理员登录成功，编辑按钮已显示。", "success");
        window.setTimeout(() => closeDialogAnimated(dialog), 450);
      } catch (error) {
        setAdminStatus(error.message, "error");
      } finally {
        $("#admin-login-button").disabled = false;
      }
    });
    $("#admin-logout-button").addEventListener("click", logoutAdmin);
    $("#download-content-backup").addEventListener("click", downloadContentBackup);
    $("#import-local-content").addEventListener("click", importLegacyLocalContent);
    $("#admin-token-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("#admin-login-button").click();
      }
    });
  }

  function setAdminStatus(message, type = "") {
    const status = $("#admin-status");
    status.textContent = message;
    status.classList.toggle("error", type === "error");
    status.classList.toggle("success", type === "success");
  }

  function setupReportAccess() {
    $("#report-access-trigger").addEventListener("click", () => {
      if (state.isAdmin) {
        $("#hidden-new-password").value = "";
        $("#hidden-confirm-password").value = "";
        $("#hidden-password-status").textContent =
          state.reportAccess?.version === 2
            ? "管理员已通过 Token 自动解锁，可以直接设置新的访客口令。"
            : "设置口令后，Report 页面和图片会以加密形式保存。";
        openDialog($("#hidden-password-dialog"));
        window.setTimeout(() => $("#hidden-new-password").focus(), 60);
        return;
      }
      $("#report-token-input").value = "";
      $("#report-access-status").textContent = "";
      openDialog($("#report-access-dialog"));
      window.setTimeout(() => $("#report-token-input").focus(), 60);
    });
    $("#report-unlock-button").addEventListener("click", async () => {
      const token = $("#report-token-input").value.trim();
      if (!token) {
        setReportAccessStatus("请输入隐藏内容口令。", "error");
        return;
      }
      $("#report-unlock-button").disabled = true;
      setReportAccessStatus("正在验证并解密...");
      try {
        await unlockReport(token);
        closeDialogAnimated($("#report-access-dialog"));
      } catch (error) {
        setReportAccessStatus(error.message, "error");
      } finally {
        $("#report-unlock-button").disabled = false;
      }
    });
    $("#report-token-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("#report-unlock-button").click();
      }
    });
    $("#save-hidden-password").addEventListener(
      "click",
      saveHiddenContentPassword
    );
  }

  function setReportAccessStatus(message, type = "") {
    const status = $("#report-access-status");
    status.textContent = message;
    status.classList.toggle("error", type === "error");
    status.classList.toggle("success", type === "success");
  }

  function setReportVisibility(visible) {
    if (!visible) stopDeckAutoplay();
    $("#diary").hidden = !visible;
    const trigger = $("#report-access-trigger");
    trigger.hidden = !state.isAdmin && visible;
    trigger.textContent = state.isAdmin ? "口令编辑" : "隐藏内容";
  }

  async function restoreReportAccess() {
    const token = sessionStorage.getItem("kerry-report-token");
    if (!token || !state.reportAccess?.manifest) return;
    try {
      await unlockReport(token, true);
    } catch {
      sessionStorage.removeItem("kerry-report-token");
      state.reportUnlocked = false;
      setReportVisibility(false);
    }
  }

  async function unlockReport(token, silent = false) {
    if (!state.reportAccess?.manifest) {
      if (!state.isAdmin) {
        throw new Error("管理员尚未设置日常访问口令。");
      }
      state.decks = normalizeEncryptedDecks(state.legacyDecks || []);
      state.reportUnlocked = true;
      setReportVisibility(true);
      state.currentDeckId = state.decks[0]?.id || null;
      state.renderedDeckId = null;
      renderDeckLibrary();
      return;
    }

    let key;
    let rawKey;
    if (state.reportAccess.version === 2 && state.reportAccess.visitorWrap) {
      const wrappingKey = await deriveReportKey(
        token,
        base64ToBytes(state.reportAccess.visitorSalt)
      );
      rawKey = await decryptBytes(
        base64ToBytes(state.reportAccess.visitorWrap),
        wrappingKey
      );
      key = await importReportContentKey(rawKey);
    } else {
      if (!state.reportAccess.salt) {
        throw new Error("旧版隐藏内容缺少解密参数。");
      }
      const salt = base64ToBytes(state.reportAccess.salt);
      key = await deriveReportKey(token, salt);
      rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    }

    const manifest = await readEncryptedManifest(key);
    state.reportKey = key;
    state.reportRawKey = new Uint8Array(rawKey);
    state.decks = normalizeEncryptedDecks(manifest.decks || []);
    trackReportFilePaths(manifest);
    state.reportUnlocked = true;
    state.reportUnlockedByVisitor = true;
    sessionStorage.setItem("kerry-report-token", token);
    setReportVisibility(true);
    state.currentDeckId = state.decks[0]?.id || null;
    state.renderedDeckId = null;
    renderDeckLibrary();
    if (!silent) {
      $("#diary").scrollIntoView({ behavior: "smooth", block: "start" });
      showToast("日常已解锁。");
    }
  }

  async function readEncryptedManifest(key) {
    const response = await fetch(
      new URL(state.reportAccess.manifest, document.baseURI).href +
        "?v=" + Date.now(),
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error("加密的隐藏内容暂时无法加载。");
    try {
      const plaintext = await decryptBytes(
        new Uint8Array(await response.arrayBuffer()),
        key
      );
      return JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
      throw new Error("隐藏内容口令不正确，或加密数据已损坏。");
    }
  }

  async function saveHiddenContentPassword() {
    if (!requireAdmin()) return;
    const next = $("#hidden-new-password").value.trim();
    const confirmation = $("#hidden-confirm-password").value.trim();
    const status = $("#hidden-password-status");
    const button = $("#save-hidden-password");

    if (!next) {
      status.textContent = "请输入新的访问口令。";
      return;
    }
    if (next !== confirmation) {
      status.textContent = "两次输入的新口令不一致。";
      return;
    }

    button.disabled = true;
    status.textContent = "正在更新加密口令...";
    try {
      if (!state.reportAccess?.manifest && !state.legacyDecks.length) {
        state.decks = state.decks || [];
      }
      if (state.reportAccess?.manifest && !state.reportRawKey) {
        throw new Error(
          "该内容来自 V0.2 的旧版直接加密。请先用旧访客口令解锁一次，再修改口令。"
        );
      }
      if (!state.reportRawKey) {
        const generated = crypto.getRandomValues(new Uint8Array(32));
        state.reportRawKey = generated;
        state.reportKey = await importReportContentKey(generated);
      }
      const visitorSalt = crypto.getRandomValues(new Uint8Array(16));
      const visitorWrappingKey = await deriveReportKey(next, visitorSalt);
      const visitorWrap = await encryptBytes(
        state.reportRawKey,
        visitorWrappingKey
      );
      state.reportAccess = {
        version: 2,
        manifest: state.reportAccess?.manifest || null,
        visitorSalt: bytesToBase64(visitorSalt),
        visitorWrap: bytesToBase64(visitorWrap)
      };
      if (!state.decks.length) {
        state.decks = normalizeEncryptedDecks(state.legacyDecks || []);
      }
      state.reportUnlocked = true;
      sessionStorage.removeItem("kerry-report-token");
      setReportVisibility(true);
      state.renderedDeckId = null;
      renderDeckLibrary();
      await publishSharedContent("Update hidden content password", {
        includeReports: true
      });
      status.textContent = "访客口令已更新并发布。";
      closeDialogAnimated($("#hidden-password-dialog"));
      showToast("隐藏内容口令已更新。");
    } catch (error) {
      status.textContent = "口令更新失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function autoUnlockReportForAdmin() {
    if (!state.reportAccess?.manifest) {
      state.decks = normalizeEncryptedDecks(state.legacyDecks || []);
      state.reportUnlocked = true;
      state.reportUnlockedByVisitor = false;
      setReportVisibility(true);
      return;
    }
    if (
      state.reportAccess.version === 2 &&
      state.reportAccess.adminWrap &&
      state.reportAccess.adminSalt
    ) {
      const wrappingKey = await deriveReportKey(
        state.adminToken,
        base64ToBytes(state.reportAccess.adminSalt)
      );
      const rawKey = await decryptBytes(
        base64ToBytes(state.reportAccess.adminWrap),
        wrappingKey
      );
      const key = await importReportContentKey(rawKey);
      const manifest = await readEncryptedManifest(key);
      state.reportRawKey = new Uint8Array(rawKey);
      state.reportKey = key;
      state.decks = normalizeEncryptedDecks(manifest.decks || []);
      trackReportFilePaths(manifest);
      state.reportUnlocked = true;
      state.reportUnlockedByVisitor = false;
      state.currentDeckId = state.decks[0]?.id || null;
      state.renderedDeckId = null;
      setReportVisibility(true);
      renderDeckLibrary();
      return;
    }

    const cachedVisitorPassword =
      sessionStorage.getItem("kerry-report-token");
    if (cachedVisitorPassword) {
      await unlockReport(cachedVisitorPassword, true);
      return;
    }
    setReportVisibility(true);
    throw new Error(
      "这是 V0.2 旧版直接加密内容。请在本浏览器解锁一次后，V0.5 即可通过管理员 Token 自动解密。"
    );
  }

  function normalizeEncryptedDecks(decks) {
    return (Array.isArray(decks) ? decks : []).map((deck) => ({
      ...deck,
      slides: Array.isArray(deck.slides)
        ? deck.slides.map((slide) => ({
            ...slide,
            imageOnly: true,
            images: slide.images?.length
              ? slide.images
              : slide.image
                ? [{ encPath: slide.image, name: "encrypted-slide" }]
                : []
          }))
        : []
    }));
  }

  async function deriveReportKey(token, salt) {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(token),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 210000,
        hash: "SHA-256"
      },
      material,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async function importReportContentKey(rawKey) {
    return crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  function trackReportFilePaths(manifest) {
    const paths = new Set();
    if (state.reportAccess?.manifest) paths.add(state.reportAccess.manifest);
    for (const deck of manifest?.decks || []) {
      for (const slide of deck.slides || []) {
        if (slide.image) paths.add(slide.image);
        for (const image of slide.images || []) {
          if (image.encPath) paths.add(image.encPath);
        }
      }
    }
    state.reportFilePaths = paths;
  }

  async function encryptBytes(bytes, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes)
    );
    const output = new Uint8Array(iv.length + cipher.length);
    output.set(iv, 0);
    output.set(cipher, iv.length);
    return output;
  }

  async function decryptBytes(bytes, key) {
    if (bytes.length < 29) throw new Error("加密数据格式不正确");
    const iv = bytes.slice(0, 12);
    const cipher = bytes.slice(12);
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher)
    );
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(index, index + chunkSize)
      );
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function updateAdminDialog() {
    const config = getUploadConfig();
    $("#admin-session-actions").hidden = !state.isAdmin;
    $("#admin-token-input").value = "";
    $("#admin-token-input").closest("label").hidden = state.isAdmin;
    $(".admin-login-actions").hidden = state.isAdmin;
    $("#admin-login-button").hidden = state.isAdmin;
    $("#admin-session-label").textContent = state.isAdmin
      ? config.owner + "/" + config.repo + " · " + (state.repoInfo.default_branch || config.branch)
      : "";
    if (!config.owner || !config.repo) {
      setAdminStatus(
        "无法自动识别仓库。请先在网站根目录的 config.js 填写 owner 和 repo。",
        "error"
      );
    } else if (!state.isAdmin) {
      setAdminStatus("访客模式只读。登录后才能修改共享内容。");
    } else {
      setAdminStatus("当前已开启管理员编辑权限。", "success");
    }
  }

  async function authenticateAdmin(token, fromSession) {
    const config = getUploadConfig();
    if (!config.owner || !config.repo) {
      throw new Error("请先在网站根目录的 config.js 填写 GitHub 仓库信息。");
    }

    const user = await githubRequest("/user", token);
    if (user.login.toLowerCase() !== config.owner.toLowerCase()) {
      throw new Error("只有仓库所有者本人才能进入管理员模式。");
    }

    let repo;
    try {
      repo = await githubRequest(
        "/repos/" + config.owner + "/" + config.repo,
        token
      );
    } catch (error) {
      if (/\(404\)/.test(error.message)) {
        throw new Error(
          "找不到仓库 " + config.owner + "/" + config.repo +
          "。请检查仓库名，并确认 Token 的 Repository access 已选中该仓库。"
        );
      }
      throw error;
    }
    if (!repo.permissions?.admin) {
      throw new Error("这个 Token 没有该仓库的管理员权限。");
    }

    state.adminToken = token;
    state.repoInfo = repo;
    state.isAdmin = true;
    sessionStorage.setItem("kerry-github-admin-token", token);
    document.body.classList.add("is-admin");
    $("#admin-entry").textContent = "管理已登录";
    setReportVisibility(true);
    renderDeckLibrary();
    try {
      await autoUnlockReportForAdmin();
    } catch (error) {
      showToast(error.message);
    }
    updateAdminDialog();

    if (!fromSession) {
      showToast("管理员模式已开启。修改内容后会发布到 GitHub。");
    }
  }

  async function resumeAdminSession() {
    const token = sessionStorage.getItem("kerry-github-admin-token");
    if (!token) return;
    try {
      await authenticateAdmin(token, true);
    } catch {
      sessionStorage.removeItem("kerry-github-admin-token");
      document.body.classList.remove("is-admin");
      $("#admin-entry").textContent = "管理";
    }
  }

  async function importLegacyLocalContent() {
    if (!requireAdmin()) return;
    if (!window.confirm(
      "将当前浏览器中由旧版本保存的相册、Report、头像和首页背景合并并发布到 GitHub 吗？"
    )) return;

    try {
      await openDB();
      const [albums, decks, avatarSetting, heroSetting] = await Promise.all([
        dbGetAll(ALBUM_STORE),
        dbGetAll(DECK_STORE),
        dbGet(SETTINGS_STORE, "avatar"),
        dbGet(SETTINGS_STORE, "hero")
      ]);
      if ((decks.length || state.decks.length) && !state.reportKey) {
        throw new Error("请先关闭此窗口，点击页面底部“口令编辑”设置或输入口令，再导入旧 Report。");
      }
      const albumMap = new Map(state.albums.map((album) => [album.id, album]));
      albums.forEach((album) => albumMap.set(album.id, album));
      const deckMap = new Map(state.decks.map((deck) => [deck.id, deck]));
      decks.forEach((deck) => deckMap.set(deck.id, deck));
      state.albums = [...albumMap.values()];
      state.decks = [...deckMap.values()];
      if (avatarSetting?.media) state.pendingAvatarMedia = avatarSetting.media;
      if (heroSetting?.media) state.pendingHeroMedia = heroSetting.media;
      renderAlbums();
      state.renderedDeckId = null;
      renderDeckLibrary();
      await publishSharedContent("Import legacy local content", {
        includeReports: Boolean(state.reportKey)
      });
      closeDialogAnimated($("#admin-dialog"));
      showToast("本机旧内容已合并并发布。");
    } catch (error) {
      setAdminStatus("导入失败：" + error.message, "error");
    }
  }

  async function downloadContentBackup() {
    if (!requireAdmin()) return;
    try {
      const response = await fetch(getContentUrl() + "?v=" + Date.now(), {
        cache: "no-store"
      });
      if (!response.ok) throw new Error("共享内容读取失败");
      const text = await response.text();
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "content-backup-" +
        new Date().toISOString().slice(0, 10) + ".json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAdminStatus("内容索引备份已下载。", "success");
    } catch (error) {
      setAdminStatus("备份下载失败：" + error.message, "error");
    }
  }

  function logoutAdmin() {
    state.isAdmin = false;
    state.adminToken = "";
    sessionStorage.removeItem("kerry-github-admin-token");
    document.body.classList.remove("is-admin");
    $("#admin-entry").textContent = "管理";
    if (!state.reportUnlockedByVisitor) {
      state.reportUnlocked = false;
      state.reportKey = null;
      state.reportRawKey = null;
      state.decks = [];
      state.currentDeckId = null;
      state.renderedDeckId = null;
      sessionStorage.removeItem("kerry-report-token");
      setReportVisibility(false);
      renderDeckLibrary();
    } else {
      setReportVisibility(true);
    }
    $("#report-access-trigger").textContent = "隐藏内容";
    updateAdminDialog();
    const adminDialog = $("#admin-dialog");
    if (adminDialog?.open) closeDialogAnimated(adminDialog);
    showToast("已退出管理员模式，当前页面为只读状态。");
  }

  function requireAdmin() {
    if (state.isAdmin) return true;
    showToast("只有管理员登录后才能修改网站内容。");
    return false;
  }

  async function githubRequest(endpoint, token, options = {}) {
    const response = await fetch(GITHUB_API + endpoint, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      let message = "";
      try {
        const payload = await response.json();
        message = payload.message || "";
      } catch {
        message = await response.text().catch(() => "");
      }
      const error = new Error(
        "GitHub 请求失败（" + response.status + "）" +
        (message ? "：" + message : "")
      );
      error.status = response.status;
      error.retryAfter = response.headers.get("retry-after");
      error.rateRemaining = response.headers.get("x-ratelimit-remaining");
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }

  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function commitRepositoryFiles(files, message, options = {}) {
    let lastError = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        return await commitRepositoryFilesOnce(files, message, options);
      } catch (error) {
        lastError = error;
        const retryable =
          !error.status ||
          error.status === 409 ||
          error.status === 422 ||
          error.status === 429 ||
          error.status >= 500;
        if (!retryable || attempt === 4) throw error;
        const delay = Math.min(6000, 600 * 2 ** (attempt - 1));
        showToast(
          "GitHub 暂时繁忙，正在重试（" + attempt + "/3）..."
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  async function commitRepositoryFilesOnce(files, message, options = {}) {
    if (!state.isAdmin) throw new Error("管理员尚未登录");
    const config = getUploadConfig();
    const repoInfo = state.repoInfo ||
      await githubRequest(
        "/repos/" + config.owner + "/" + config.repo,
        state.adminToken
      );
    const branch = config.branch || repoInfo.default_branch || "main";
    const encodedBranch = branch.split("/").map(encodeURIComponent).join("/");
    const readRefPath =
      "/repos/" + config.owner + "/" + config.repo +
      "/git/ref/heads/" + encodedBranch;
    const updateRefPath =
      "/repos/" + config.owner + "/" + config.repo +
      "/git/refs/heads/" + encodedBranch;
    const ref = await githubRequest(readRefPath, state.adminToken);
    const parentSha = ref.object.sha;
    const parent = await githubRequest(
      "/repos/" + config.owner + "/" + config.repo +
        "/git/commits/" + parentSha,
      state.adminToken
    );

    const treeEntries = [];
    for (const file of files) {
      const blob = file.content instanceof Blob
        ? file.content
        : new Blob([String(file.content)], { type: "text/plain;charset=utf-8" });
      const created = await githubRequest(
        "/repos/" + config.owner + "/" + config.repo + "/git/blobs",
        state.adminToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: await blobToBase64(blob),
            encoding: "base64"
          })
        }
      );
      treeEntries.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: created.sha
      });
    }
    const writtenPaths = new Set(treeEntries.map((entry) => entry.path));
    for (const path of options.deletions || []) {
      if (!path || writtenPaths.has(path)) continue;
      writtenPaths.add(path);
      treeEntries.push({
        path,
        mode: "100644",
        type: "blob",
        sha: null
      });
    }

    const tree = await githubRequest(
      "/repos/" + config.owner + "/" + config.repo + "/git/trees",
      state.adminToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_tree: parent.tree.sha,
          tree: treeEntries
        })
      }
    );

    const commit = await githubRequest(
      "/repos/" + config.owner + "/" + config.repo + "/git/commits",
      state.adminToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          tree: tree.sha,
          parents: [parentSha]
        })
      }
    );

    await githubRequest(updateRefPath, state.adminToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false })
    });
    return commit;
  }

  async function publishSharedContent(message, options = {}) {
    if (!state.isAdmin) throw new Error("管理员尚未登录");
    if (state.isPublishing) {
      throw new Error("上一项内容仍在发布，请稍候再试。");
    }
    state.isPublishing = true;
    document.body.classList.add("is-publishing");
    showToast("正在提交到 GitHub，请稍候...");
    const config = getUploadConfig();
    const files = [];
    const previousContent = state.sharedContent
      ? JSON.parse(JSON.stringify(state.sharedContent))
      : null;
    const previousReportPaths = new Set(state.reportFilePaths);
    try {
      const content = await buildSharedContent(files, config, options);
      files.push({
        path: config.contentPath,
        content: JSON.stringify(content, null, 2) + "\n"
      });
      const currentAssetPaths = collectContentAssetPaths(content);
      const previousAssetPaths = collectContentAssetPaths(previousContent);
      const currentReportPaths = options.includeReports
        ? collectReportPathsFromDecks(state.decks)
        : previousReportPaths;
      if (content.reportAccess?.manifest) {
        currentReportPaths.add(content.reportAccess.manifest);
      }
      const deletions = [
        ...difference(previousAssetPaths, currentAssetPaths),
        ...difference(previousReportPaths, currentReportPaths)
      ].filter((path) => path.startsWith(config.assetRoot + "/"));
      await commitRepositoryFiles(files, message, {
        deletions: [...new Set(deletions)]
      });
      state.sharedContent = content;
      if (THEME_META[content.defaultTheme]) {
        state.defaultTheme = content.defaultTheme;
      }
      state.sharedProfile = {
        ...content.profile,
        avatarImages: [...(content.profile?.avatarImages || [])],
        heroImages: [...(content.profile?.heroImages || [])]
      };
      state.reportAccess = content.reportAccess || null;
      state.reportFilePaths = currentReportPaths;
      state.footprints = Array.isArray(content.footprints)
        ? content.footprints.map((item) => sanitizeFootprintRecord(item))
        : state.footprints;
      if (options.includeReports) state.legacyDecks = [];
      state.pendingHeroMedia = null;
      state.pendingHeroItems = [];
      state.pendingAvatarMedia = null;
      state.pendingAvatarItems = [];
      state.pendingFootprintItems = [];
      showToast("内容已发布到 GitHub，Pages 更新通常需要约一分钟。");
      return content;
    } finally {
      state.isPublishing = false;
      document.body.classList.remove("is-publishing");
    }
  }

  function collectContentAssetPaths(content) {
    const paths = new Set();
    const add = (path) => {
      if (typeof path === "string" && path.trim()) paths.add(path.trim());
    };
    const addMedia = (media) => {
      if (!media) return;
      add(media.src);
      add(media.motionSrc);
      add(media.thumbnail);
    };
    const profile = content?.profile || {};
    add(profile.avatar);
    for (const avatar of profile.avatarImages || []) add(avatar.src);
    addMedia(profile.heroMedia);
    for (const media of profile.heroImages || []) addMedia(media);
    for (const album of content?.albums || []) {
      for (const photo of album.photos || []) addMedia(photo);
    }
    for (const footprint of content?.footprints || []) addMedia(footprint);
    return paths;
  }

  function collectReportPathsFromDecks(decks) {
    const paths = new Set();
    for (const deck of decks || []) {
      for (const slide of deck.slides || []) {
        for (const image of slide.images || []) {
          if (image.encPath) paths.add(image.encPath);
        }
      }
    }
    return paths;
  }

  function difference(left, right) {
    return [...left].filter((value) => !right.has(value));
  }

  async function buildSharedContent(files, config, options = {}) {
    const profile = { ...(state.sharedProfile || {}) };
    const heroImages = Array.isArray(profile.heroImages)
      ? [...profile.heroImages]
      : [];
    const heroCoverIds = Array.isArray(profile.heroCoverIds)
      ? [...profile.heroCoverIds]
      : [];
    const avatarImages = Array.isArray(profile.avatarImages)
      ? [...profile.avatarImages]
      : [];
    const stamp = Date.now().toString(36);

    const pendingAvatars = [
      ...(state.pendingAvatarItems || []),
      ...(state.pendingAvatarMedia ? [state.pendingAvatarMedia] : [])
    ];
    const avatarItems = [];
    for (let index = 0; index < pendingAvatars.length; index += 1) {
      const media = pendingAvatars[index];
      const avatarBlob = media.imageBlob || media.stillBlob;
      if (avatarBlob) {
        const extension = blobExtension(avatarBlob) || ".jpg";
        const path =
          config.assetRoot + "/profile/avatar-" + stamp + "-" + index + extension;
        files.push({ path, content: avatarBlob });
        avatarItems.push({
          id: media.id || createId("avatar"),
          src: path,
          title: media.title || "头像 " + (index + 1),
          createdAt: media.createdAt || new Date().toISOString()
        });
      }
    }
    if (avatarItems.length) {
      avatarImages.unshift(...avatarItems);
      profile.avatar = avatarItems[0].src;
    }
    profile.avatarImages = avatarImages;

    const pendingHeroes = [
      ...(state.pendingHeroItems || []),
      ...(state.pendingHeroMedia ? [state.pendingHeroMedia] : [])
    ];
    const heroItems = [];
    for (let index = 0; index < pendingHeroes.length; index += 1) {
      const media = pendingHeroes[index];
      const hero = {
        id: createId("background"),
        kind: media.kind || "photo",
        createdAt: new Date().toISOString()
      };
      if (media.motionBlob) {
        const path =
          config.assetRoot + "/profile/hero-" + stamp + "-" + index + "-live" +
          (blobExtension(media.motionBlob) || ".mp4");
        files.push({ path, content: media.motionBlob });
        hero.motionSrc = path;
      }
      const stillBlob = media.stillBlob || media.imageBlob || media.videoBlob;
      if (stillBlob) {
        const path =
          config.assetRoot + "/profile/hero-" + stamp + "-" + index +
          (blobExtension(stillBlob) || ".png");
        files.push({ path, content: stillBlob });
        hero.src = path;
        const thumbnailBlob = await createImageThumbnail(stillBlob);
        if (thumbnailBlob) {
          const thumbnailPath =
            config.assetRoot + "/profile/hero-" + stamp + "-" + index + "-thumb.jpg";
          files.push({ path: thumbnailPath, content: thumbnailBlob });
          hero.thumbnail = thumbnailPath;
        }
      }
      if (hero.src || hero.motionSrc) heroItems.push(hero);
    }
    if (heroItems.length) {
      heroImages.unshift(...heroItems);
      if (!heroCoverIds.length) heroCoverIds.push(heroItems[0].id);
    }
    profile.heroImages = heroImages;
    const heroKeys = new Set(heroImages.map(heroMediaKey));
    profile.heroCoverIds = [...new Set(heroCoverIds)]
      .filter((id) => heroKeys.has(id));
    profile.heroMedia =
      heroImages.find(
        (item) => heroMediaKey(item) === profile.heroCoverIds[0]
      ) ||
      profile.heroMedia ||
      heroImages[0] ||
      null;

    const albums = [];
    for (const album of state.albums) {
      const photos = [];
      for (const photo of album.photos || []) {
        const item = {
          id: photo.id,
          title: photo.title,
          kind: photo.kind || "photo",
          createdAt: photo.createdAt || new Date().toISOString()
        };

        if (item.kind === "live") {
          const stillBlob = photo.stillBlob || photo.imageBlob;
          if (photo.src) {
            item.src = photo.src;
          } else if (stillBlob) {
            const path =
              config.assetRoot + "/media/" + photo.id + "-still" +
              (blobExtension(stillBlob) || ".jpg");
            files.push({ path, content: stillBlob });
            item.src = path;
            photo.src = path;
          }
          if (photo.motionSrc) {
            item.motionSrc = photo.motionSrc;
          } else if (photo.motionBlob) {
            const path =
              config.assetRoot + "/media/" + photo.id + "-live" +
              (blobExtension(photo.motionBlob) || ".mp4");
            files.push({ path, content: photo.motionBlob });
            item.motionSrc = path;
            photo.motionSrc = path;
          }
          const thumbnail = await ensureSharedThumbnail(
            files,
            config,
            photo,
            stillBlob
          );
          if (thumbnail) item.thumbnail = thumbnail;
        } else if (item.kind === "video") {
          if (photo.src) {
            item.src = photo.src;
          } else if (photo.videoBlob) {
            const path =
              config.assetRoot + "/media/" + photo.id +
              (blobExtension(photo.videoBlob) || ".mp4");
            files.push({ path, content: photo.videoBlob });
            item.src = path;
            photo.src = path;
          }
        } else {
          if (photo.src) {
            item.src = photo.src;
          } else if (photo.imageBlob) {
            const path =
              config.assetRoot + "/media/" + photo.id +
              (blobExtension(photo.imageBlob) || ".jpg");
            files.push({ path, content: photo.imageBlob });
            item.src = path;
            photo.src = path;
          }
          const thumbnail = await ensureSharedThumbnail(
            files,
            config,
            photo,
            photo.imageBlob
          );
          if (thumbnail) item.thumbnail = thumbnail;
        }
        if (item.src || item.motionSrc) photos.push(item);
      }

      albums.push({
        id: album.id,
        name: album.name,
        displayWidth: album.displayWidth || 60,
        layout: album.layout || null,
        coverPhotoId: album.coverPhotoIds?.[0] || album.coverPhotoId || null,
        coverAnimation: ALBUM_COVER_ANIMATIONS.has(album.coverAnimation)
          ? album.coverAnimation
          : "fade",
        coverPhotoIds: (
          album.coverPhotoIds?.length
            ? album.coverPhotoIds
            : album.coverPhotoId
              ? [album.coverPhotoId]
              : []
        ).filter((id) => photos.some((photo) => photo.id === id)),
        createdAt: album.createdAt,
        updatedAt: new Date().toISOString(),
        photos
      });
    }

    let reportAccess = state.reportAccess || null;
    let legacyDecks = state.legacyDecks || [];
    if (options.includeReports) {
      reportAccess = await buildEncryptedReportPackage(files, config);
      legacyDecks = [];
    }

    const footprints = [];
    const materializeFootprint = async (record) => {
      const item = {
        id: record.id || createId("footprint"),
        title: record.title || "旅行照片",
        kind: "photo",
        lat: parseCoordinateValue(record.lat, 90),
        lng: parseCoordinateValue(record.lng, 180),
        createdAt: record.createdAt || new Date().toISOString()
      };
      if (item.lat === 0 && item.lng === 0) {
        item.lat = null;
        item.lng = null;
      }
      if (record.src) {
        item.src = record.src;
        if (record.thumbnail) item.thumbnail = record.thumbnail;
        return item;
      }
      const media = record.media || {};
      const sourceBlob = media.imageBlob || media.stillBlob || null;
      if (!sourceBlob) return null;
      const path =
        config.assetRoot + "/footprints/" + item.id +
        (blobExtension(sourceBlob) || ".jpg");
      files.push({ path, content: sourceBlob });
      item.src = path;
      const thumbnail = await ensureSharedThumbnail(
        files,
        config,
        media,
        sourceBlob
      );
      if (thumbnail) item.thumbnail = thumbnail;
      return item;
    };
    for (const record of state.footprints || []) {
      const item = await materializeFootprint(record);
      if (item) footprints.push(item);
    }
    for (const record of state.pendingFootprintItems || []) {
      const item = await materializeFootprint(record);
      if (item) footprints.push(item);
    }

    const defaultTheme = THEME_META[state.defaultTheme]
      ? state.defaultTheme
      : "deep-blue";
    files.push({
      path: "theme-default.js",
      content:
        "window.SHARED_DEFAULT_THEME = " +
        JSON.stringify(defaultTheme) +
        ";\n"
    });
    return {
      version: 4,
      updatedAt: new Date().toISOString(),
      defaultTheme,
      profile,
      attributes: state.attributes,
      tagGroups: state.tagGroups,
      contactGroups: state.contactGroups,
      albums,
      footprints,
      decks: reportAccess ? [] : legacyDecks,
      reportAccess
    };
  }

  async function ensureSharedThumbnail(files, config, photo, sourceBlob) {
    if (photo.thumbnail) return photo.thumbnail;
    const thumbnailBlob =
      photo.thumbnailBlob ||
      (sourceBlob ? await createImageThumbnail(sourceBlob) : null);
    if (!thumbnailBlob) return "";
    const path =
      config.assetRoot + "/thumbnails/" + photo.id + ".jpg";
    files.push({ path, content: thumbnailBlob });
    photo.thumbnailBlob = thumbnailBlob;
    photo.thumbnail = path;
    return path;
  }

  async function buildEncryptedReportPackage(files, config) {
    if (!state.reportKey || !state.reportRawKey) {
      throw new Error("请先设置并解锁隐藏内容口令");
    }
    if (
      !state.reportAccess?.visitorWrap ||
      !state.reportAccess?.visitorSalt
    ) {
      throw new Error("旧版 Report 需要先设置一次新的访客口令，才能启用管理员自动解密。");
    }

    const encryptedDecks = [];
    for (const deck of state.decks) {
      const slides = [];
      for (const slide of deck.slides || []) {
        const image = slide.images?.[0];
        if (!image) continue;
        let encryptedPath = image.encPath || "";

        if (!encryptedPath) {
          let sourceBlob = image.blob || null;
          if (!sourceBlob && image.src) {
            const response = await fetch(
              new URL(image.src, document.baseURI).href
            );
            if (response.ok) sourceBlob = await response.blob();
          }
          if (sourceBlob) {
            encryptedPath =
              config.assetRoot + "/reports/" + deck.id + "/" +
              slide.id + ".enc";
            const encrypted = await encryptBytes(
              new Uint8Array(await sourceBlob.arrayBuffer()),
              state.reportKey
            );
            files.push({ path: encryptedPath, content: new Blob([encrypted]) });
            image.encPath = encryptedPath;
          }
        }

        if (encryptedPath) {
          slides.push({
            id: slide.id,
            title: slide.title,
            image: encryptedPath
          });
        }
      }

      if (slides.length) {
        encryptedDecks.push({
          id: deck.id,
          name: deck.name,
          createdAt: deck.createdAt,
          slides
        });
      }
    }

    const manifestBytes = new TextEncoder().encode(
      JSON.stringify({ version: 1, decks: encryptedDecks })
    );
    const encryptedManifest = await encryptBytes(
      manifestBytes,
      state.reportKey
    );
    const manifestPath = config.assetRoot + "/reports/report-data.enc";
    files.push({
      path: manifestPath,
      content: new Blob([encryptedManifest])
    });

    const adminSalt = crypto.getRandomValues(new Uint8Array(16));
    const adminWrappingKey = await deriveReportKey(
      state.adminToken,
      adminSalt
    );
    const adminWrap = await encryptBytes(
      state.reportRawKey,
      adminWrappingKey
    );

    return {
      version: 2,
      manifest: manifestPath,
      visitorSalt: state.reportAccess.visitorSalt,
      visitorWrap: state.reportAccess.visitorWrap,
      adminSalt: bytesToBase64(adminSalt),
      adminWrap: bytesToBase64(adminWrap)
    };
  }

  function setupNavigation() {
    const menuButton = $("#menu-button");
    const nav = $("#site-nav");
    const settingsToggle = $("#settings-toggle");
    const settingsDropdown = $("#settings-dropdown");
    const pageButtons = $$("[data-page-target]");
    const pageViews = $$("[data-page-view]");

    const closeSettings = () => {
      settingsDropdown.classList.remove("open");
      settingsToggle.setAttribute("aria-expanded", "false");
      settingsToggle.classList.remove("active");
    };
    const closeMobileNav = () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "打开导航");
    };

    menuButton.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "关闭导航" : "打开导航");
    });

    settingsToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = !settingsDropdown.classList.contains("open");
      settingsDropdown.classList.toggle("open", isOpen);
      settingsToggle.setAttribute("aria-expanded", String(isOpen));
      settingsToggle.classList.toggle("active", isOpen);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".settings-dropdown")) closeSettings();
    });

    $$(".nav-dropdown-item", settingsDropdown).forEach((item) => {
      item.addEventListener("click", () => {
        closeSettings();
        closeMobileNav();
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSettings();
        closeMobileNav();
      }
    });

    const revealPage = (target) => {
      target.hidden = false;
      target.classList.remove("page-leaving");
      target.classList.add("page-entering");
      observeRevealElements(target);
      const finishReveal = (event) => {
        if (event && event.target !== target) return;
        target.classList.remove("page-entering");
        updateBackToTopPlacement();
      };
      target.addEventListener("animationend", finishReveal, { once: true });
      window.setTimeout(() => finishReveal(), 520);
      window.requestAnimationFrame(() => {
        updateBackToTopPlacement();
        if (target.dataset.pageView === "footprints") {
          ensureFootprintsMap();
          state.footprintMap?.resize();
        } else if (target.dataset.pageView === "guestbook") {
          renderGuestbook();
        }
      });
    };

    const switchPage = (pageName) => {
      const target = pageViews.find(
        (view) => view.dataset.pageView === pageName
      );
      const current = pageViews.find(
        (view) => view.dataset.pageView === state.currentPage
      );
      if (!target) return;
      if (current === target && !target.hidden) {
        closeSettings();
        closeMobileNav();
        return;
      }

      const switchToken = ++state.pageSwitchToken;
      state.currentPage = pageName;
      if (pageName !== "home") stopDeckAutoplay();
      pageButtons.forEach((button) => {
        const active = button.dataset.pageTarget === pageName;
        button.classList.toggle("active", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
      closeSettings();
      closeMobileNav();
      closeDeckLibrary();
      window.scrollTo({ top: 0, behavior: "auto" });
      updateBackToTopPlacement();

      if (!current || current.hidden || current === target) {
        pageViews.forEach((view) => {
          if (view !== target) view.hidden = true;
        });
        revealPage(target);
      } else {
        current.classList.remove("page-entering");
        current.classList.add("page-leaving");
        window.setTimeout(() => {
          if (switchToken !== state.pageSwitchToken) return;
          current.hidden = true;
          current.classList.remove("page-leaving");
          revealPage(target);
        }, 300);
      }

    };

    pageButtons.forEach((button) => {
      button.addEventListener("click", () => {
        switchPage(button.dataset.pageTarget);
      });
    });

    $(".brand").addEventListener("click", (event) => {
      event.preventDefault();
      switchPage("home");
    });

    state.switchPage = switchPage;
  }

  function setupRevealAnimations() {
    const items = $$(".reveal");
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      items.forEach((item) => item.classList.add("visible"));
      return;
    }

    items.forEach((item) => item.classList.add("reveal-pending"));
    state.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          state.revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );
    items.forEach((item) => state.revealObserver.observe(item));

    window.setTimeout(() => {
      items.forEach((item) => item.classList.add("visible"));
    }, 900);
  }

  function observeRevealElements(root = document) {
    const scope = root instanceof Element ? root : document;
    const items = [
      ...(scope.matches?.(".reveal") ? [scope] : []),
      ...scope.querySelectorAll(".reveal")
    ];
    items.forEach((item) => {
      if (!item.classList.contains("visible")) {
        item.classList.add("reveal-pending");
      }
      if (state.revealObserver) state.revealObserver.observe(item);
    });
  }

  function setupDialogs() {
    $$("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => {
        const dialog = document.getElementById(button.dataset.closeDialog);
        if (dialog) closeDialogAnimated(dialog);
      });
    });

    $$(".modal").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialogAnimated(dialog);
      });
      dialog.addEventListener("close", () => {
        if (!$("dialog[open]")) document.body.classList.remove("dialog-open");
        if (dialog.id === "lightbox") clearLightboxUrls();
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const openDialog = $$("dialog[open]").pop();
        if (openDialog) {
          event.preventDefault();
          closeDialogAnimated(openDialog);
        }
      }

    });
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.classList.remove("modal-closing");
    dialog.showModal();
    document.body.classList.add("dialog-open");
  }

  function closeDialogAnimated(dialog) {
    if (!dialog?.open || dialog.classList.contains("modal-closing")) return;
    dialog.classList.add("modal-closing");
    window.setTimeout(() => {
      dialog.classList.remove("modal-closing");
      if (dialog.open) dialog.close();
    }, 170);
  }

  async function openDB() {
    if (state.db) return state.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ALBUM_STORE)) {
          db.createObjectStore(ALBUM_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(DECK_STORE)) {
          db.createObjectStore(DECK_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        state.db = request.result;
        resolve(state.db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function dbGetAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbGet(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function setupGallery() {
    const createDialog = $("#create-album-dialog");

    const openCreate = () => {
      $("#new-album-name").value = "";
      openDialog(createDialog);
      window.setTimeout(() => $("#new-album-name").focus(), 60);
    };

    $("#create-album-button").addEventListener("click", openCreate);
    $("#empty-create-album").addEventListener("click", openCreate);
    $("#gallery-adjust-button").addEventListener(
      "click",
      enterGalleryAdjustMode
    );
    $("#gallery-adjust-cancel").addEventListener(
      "click",
      cancelGalleryAdjustMode
    );
    $("#gallery-adjust-confirm").addEventListener(
      "click",
      confirmGalleryAdjustMode
    );

    $("#confirm-create-album").addEventListener("click", createAlbum);
    $("#new-album-name").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        createAlbum();
      }
    });

    $("#album-size-edit").addEventListener("input", () => {
      $("#album-size-value").textContent = $("#album-size-edit").value + "%";
    });
    $("#save-album-settings").addEventListener("click", saveAlbumSettings);
    $("#album-upload-form").addEventListener("submit", uploadAlbumPhotos);
    $("#album-photo-files").addEventListener("change", updateAlbumFileLabel);
    $("#album-rotation-button").addEventListener(
      "click",
      openAlbumRotationDialog
    );
    $("#album-rotation-options").addEventListener("click", (event) => {
      const option = event.target.closest("[data-cover-animation]");
      if (!option) return;
      selectAlbumRotationOption(option.dataset.coverAnimation);
    });
    $("#save-album-rotation").addEventListener(
      "click",
      saveAlbumRotationAnimation
    );
    $("#album-multi-toggle").addEventListener("click", toggleAlbumSelectionMode);
    $("#album-set-cover").addEventListener("click", () => {
      const album = currentAlbum();
      if (album && state.selectedPhotoIds.length) {
        setAlbumCovers(album, state.selectedPhotoIds);
      }
    });
    $("#album-delete-photo").addEventListener("click", () => {
      const album = currentAlbum();
      if (album && state.selectedPhotoIds.length) {
        deleteSelectedAlbumPhotos(album);
      }
    });
    $("#delete-album-button").addEventListener("click", deleteCurrentAlbum);
  }

  async function createAlbum() {
    if (!requireAdmin()) return;
    const name = $("#new-album-name").value.trim();
    if (!name) {
      $("#new-album-name").focus();
      showToast("请先填写相册名称。");
      return;
    }

    const now = new Date().toISOString();
    const customAlbums = state.albums.filter((item) => item.layout);
    const album = {
      id: createId("album"),
      name,
      displayWidth: 60,
      coverPhotoId: null,
      coverPhotoIds: [],
      coverAnimation: "fade",
      layout: customAlbums.length
        ? {
            x: 0,
            y: Math.max(
              ...customAlbums.map((item) => item.layout.y + item.layout.height)
            ) + 24,
            width: 0.6,
            height: 420
          }
        : null,
      photos: [],
      createdAt: now,
      updatedAt: now
    };

    const button = $("#confirm-create-album");
    const status = $("#create-album-status");
    button.disabled = true;
    status.textContent = "正在创建并发布到 GitHub...";
    state.albums.unshift(album);
    try {
      await publishSharedContent("Create album: " + album.name);
      renderAlbums();
      closeDialogAnimated($("#create-album-dialog"));
      openAlbum(album.id);
      status.textContent = "";
      showToast("相册已创建并发布。");
    } catch (error) {
      state.albums = state.albums.filter((item) => item.id !== album.id);
      renderAlbums();
      status.textContent = "创建失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  }

  function renderAlbums() {
    stopAlbumCoverRotations();
    revokeUrls(state.mainUrls);
    state.mainUrls = [];
    const list = $("#album-list");
    const empty = $("#album-empty");
    const hasCustomLayout =
      state.galleryLayoutMode ||
      state.albums.some((album) => Boolean(album.layout));
    empty.hidden = state.albums.length > 0;
    list.hidden = state.albums.length === 0;
    list.classList.toggle("album-layout-custom", hasCustomLayout);
    list.classList.toggle("album-layout-adjusting", state.galleryLayoutMode);

    list.replaceChildren(
      ...state.albums.map((album) => createAlbumCard(album))
    );
    observeRevealElements(list);
    activateAnimatedMedia(list);
    syncGalleryAdjustUi();
    window.requestAnimationFrame(updateGalleryLayoutHeight);
    applyLanguageToDom();
  }

  function createAlbumCard(album) {
    const card = document.createElement("article");
    card.className = "album-card reveal";
    card.style.setProperty("--album-width", album.displayWidth + "%");
    card.dataset.albumId = album.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "打开相册：" + album.name);
    const layout = state.galleryLayoutMode
      ? state.galleryDraftLayouts.get(album.id)
      : album.layout;
    if (layout) {
      card.classList.add("album-card-positioned");
      applyAlbumCardLayout(card, layout);
    }
    if (state.galleryLayoutMode) {
      card.classList.add("album-card-adjusting");
      appendGalleryResizeHandles(card);
      card.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        startAlbumLayoutPointer(event, album, card, "move");
      });
    }

    const cover = document.createElement("div");
    cover.className = "album-cover";
    const coverPhotos = getAlbumCovers(album);
    if (coverPhotos.length) {
      const stack = document.createElement("div");
      stack.className = "album-cover-stack";
      const slides = coverPhotos.map((coverPhoto, index) => {
        const slide = document.createElement("div");
        slide.className = "album-cover-slide" + (index === 0 ? " active" : "");
        const coverMedia = createMediaNode(coverPhoto, state.mainUrls, true);
        slide.append(coverMedia);
        stack.append(slide);
        return slide;
      });
      cover.append(stack);
      watchAdaptiveTitleContrast(slides[0].firstElementChild, null, cover);
      if (slides.length > 1) {
        state.albumRotationTimers.set(
          album.id,
          startCoverRotation(slides, album.id, album.coverAnimation)
        );
      }
    } else {
      cover.append(createAlbumPlaceholder());
    }

    const info = document.createElement("div");
    info.className = "album-card-info";
    const title = document.createElement("h3");
    title.textContent = album.name;
    info.append(title);
    cover.append(info);

    const open = () => openAlbum(album.id);
    card.addEventListener("click", () => {
      if (!state.galleryLayoutMode) open();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!state.galleryLayoutMode) open();
      }
    });

    card.append(cover);
    return card;
  }

  function enterGalleryAdjustMode() {
    if (!requireAdmin()) return;
    if (!state.albums.length) {
      showToast("还没有可以调整的相册。");
      return;
    }
    const list = $("#album-list");
    const listRect = list.getBoundingClientRect();
    state.galleryDraftLayouts = new Map();
    state.albums.forEach((album) => {
      const card = $(
        '.album-card[data-album-id="' + CSS.escape(album.id) + '"]',
        list
      );
      const rect = card?.getBoundingClientRect();
      state.galleryDraftLayouts.set(
        album.id,
        rect
          ? {
              x: Math.max(0, Math.min(1, (rect.left - listRect.left) / listRect.width)),
              y: Math.max(0, rect.top - listRect.top),
              width: Math.max(0.2, Math.min(1, rect.width / listRect.width)),
              height: Math.max(180, rect.height)
            }
          : { x: 0, y: 0, width: 0.6, height: 420 }
      );
    });
    state.galleryLayoutMode = true;
    document.body.classList.add("gallery-layout-mode");
    renderAlbums();
    showToast("拖动相册封面调整位置，拖动边缘调整尺寸。");
  }

  function cancelGalleryAdjustMode() {
    state.galleryLayoutMode = false;
    state.galleryDraftLayouts.clear();
    document.body.classList.remove("gallery-layout-mode");
    renderAlbums();
  }

  async function confirmGalleryAdjustMode() {
    if (!requireAdmin() || !state.galleryLayoutMode) return;
    const previousLayouts = new Map(
      state.albums.map((album) => [album.id, album.layout || null])
    );
    state.albums.forEach((album) => {
      const layout = state.galleryDraftLayouts.get(album.id);
      if (layout) album.layout = { ...layout };
    });
    const button = $("#gallery-adjust-confirm");
    button.disabled = true;
    try {
      await publishSharedContent("Update gallery layout");
      state.galleryLayoutMode = false;
      state.galleryDraftLayouts.clear();
      document.body.classList.remove("gallery-layout-mode");
      renderAlbums();
      showToast("相册布局已发布。");
    } catch (error) {
      state.albums.forEach((album) => {
        album.layout = previousLayouts.get(album.id) || null;
      });
      showToast("布局发布失败：" + error.message);
    } finally {
      button.disabled = false;
    }
  }

  function syncGalleryAdjustUi() {
    const editing = state.galleryLayoutMode;
    $("#gallery-adjust-button").hidden = editing;
    $("#gallery-adjust-cancel").hidden = !editing;
    $("#gallery-adjust-confirm").hidden = !editing;
    $("#create-album-button").hidden = editing;
  }

  function appendGalleryResizeHandles(card) {
    ["n", "ne", "e", "se", "s", "sw", "w", "nw"].forEach((handle) => {
      const grip = document.createElement("span");
      grip.className = "album-resize-handle handle-" + handle;
      grip.dataset.handle = handle;
      grip.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        startAlbumLayoutPointer(
          event,
          state.albums.find((album) => album.id === card.dataset.albumId),
          card,
          "resize",
          handle
        );
      });
      card.append(grip);
    });
  }

  function startAlbumLayoutPointer(event, album, card, mode, handle = "") {
    if (!state.galleryLayoutMode || !album) return;
    event.preventDefault();
    event.stopPropagation();
    const list = $("#album-list");
    const listWidth = list.getBoundingClientRect().width;
    const layout = { ...state.galleryDraftLayouts.get(album.id) };
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...layout };
    const minWidth = 0.24;
    const minHeight = 210;
    card.classList.add("is-adjusting");
    card.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / listWidth;
      const dy = moveEvent.clientY - startY;
      const next = { ...start };
      if (mode === "move") {
        next.x = Math.max(0, Math.min(1 - start.width, start.x + dx));
        next.y = Math.max(0, start.y + dy);
      } else {
        if (handle.includes("e")) {
          next.width = Math.max(
            minWidth,
            Math.min(1 - start.x, start.width + dx)
          );
        }
        if (handle.includes("s")) {
          next.height = Math.max(minHeight, start.height + dy);
        }
        if (handle.includes("w")) {
          const right = start.x + start.width;
          next.x = Math.max(0, Math.min(right - minWidth, start.x + dx));
          next.width = right - next.x;
        }
        if (handle.includes("n")) {
          const bottom = start.y + start.height;
          next.y = Math.max(0, Math.min(bottom - minHeight, start.y + dy));
          next.height = bottom - next.y;
        }
      }
      state.galleryDraftLayouts.set(album.id, next);
      applyAlbumCardLayout(card, next);
      updateGalleryLayoutHeight();
    };

    const finish = () => {
      card.classList.remove("is-adjusting");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  }

  function applyAlbumCardLayout(card, layout) {
    const list = $("#album-list");
    const listWidth = Math.max(1, list.getBoundingClientRect().width);
    const width = Math.max(240, layout.width * listWidth);
    const x = Math.max(
      0,
      Math.min(listWidth - width, layout.x * listWidth)
    );
    card.style.left = x + "px";
    card.style.top = layout.y + "px";
    card.style.width = width + "px";
    card.style.height = Math.max(210, layout.height) + "px";
  }

  function updateGalleryLayoutHeight() {
    const list = $("#album-list");
    if (!list.classList.contains("album-layout-custom")) {
      list.style.removeProperty("height");
      return;
    }
    const bottom = [...list.querySelectorAll(".album-card-positioned")]
      .reduce((maximum, card) => {
        return Math.max(maximum, card.offsetTop + card.offsetHeight);
      }, 0);
    list.style.height = Math.max(520, bottom + 36) + "px";
  }

  function createAlbumPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.className = "album-cover-placeholder";
    const mark = document.createElement("span");
    mark.textContent = "✦";
    const label = document.createElement("small");
    label.textContent = "上传第一张照片";
    placeholder.append(mark, label);
    return placeholder;
  }

  function getAlbumCover(album) {
    return getAlbumCovers(album)[0] || null;
  }

  function getAlbumCovers(album) {
    if (!album.photos?.length) return [];
    const ids = Array.isArray(album.coverPhotoIds)
      ? album.coverPhotoIds
      : album.coverPhotoId
        ? [album.coverPhotoId]
        : [];
    const covers = ids
      .map((id) => album.photos.find((photo) => photo.id === id))
      .filter(Boolean);
    return covers.length ? covers : [album.photos[0]];
  }

  function startCoverRotation(slides, key, animation = "fade") {
    let index = 0;
    return window.setInterval(() => {
      const nextIndex = (index + 1) % slides.length;
      const previous = slides[index];
      const next = slides[nextIndex];
      next.style.zIndex = "3";
      previous.style.zIndex = "2";
      animateAlbumCoverSlide(previous, next, animation);
      index = nextIndex;
      window.setTimeout(() => {
        slides.forEach((slide, slideIndex) => {
          slide.style.zIndex = slideIndex === index ? "2" : "1";
          slide.style.removeProperty("clip-path");
          slide.style.removeProperty("transform");
          slide.style.removeProperty("opacity");
        });
      }, COVER_CROSSFADE_MS + 60);
    }, COVER_ROTATION_INTERVAL_MS);
  }

  function animateAlbumCoverSlide(previous, next, animation = "fade") {
    next.getAnimations().forEach((item) => item.cancel());
    previous.getAnimations().forEach((item) => item.cancel());
    next.style.clipPath = "";
    next.style.transform = "";
    previous.style.transform = "";

    if (animation === "page-transition") {
      next.style.clipPath = "inset(0 100% 0 0)";
      next.style.opacity = "1";
      next.animate(
        [
          { clipPath: "inset(0 100% 0 0)", opacity: 0.92 },
          { clipPath: "inset(0 0 0 0)", opacity: 1 }
        ],
        {
          duration: COVER_CROSSFADE_MS,
          easing: "cubic-bezier(.4,0,.2,1)",
          fill: "forwards"
        }
      );
      next.classList.add("active");
      window.setTimeout(() => previous.classList.remove("active"), 60);
      return;
    }

    const presets = {
      fade: {
        next: [
          { opacity: 0, transform: "translate3d(0,0,0)" },
          { opacity: 1, transform: "translate3d(0,0,0)" }
        ],
        previous: [{ opacity: 1 }, { opacity: 0 }]
      },
      "slide-right": {
        next: [
          { opacity: 0, transform: "translate3d(-14%,0,0)" },
          { opacity: 1, transform: "translate3d(0,0,0)" }
        ],
        previous: [
          { opacity: 1, transform: "translate3d(0,0,0)" },
          { opacity: 0, transform: "translate3d(8%,0,0)" }
        ]
      },
      zoom: {
        next: [
          { opacity: 0, transform: "scale(.72)" },
          { opacity: 1, transform: "scale(1)" }
        ],
        previous: [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(1.08)" }
        ]
      },
      "slide-vertical": {
        next: [
          { opacity: 0, transform: "translate3d(0,-18%,0)" },
          { opacity: 1, transform: "translate3d(0,0,0)" }
        ],
        previous: [
          { opacity: 1, transform: "translate3d(0,0,0)" },
          { opacity: 0, transform: "translate3d(0,14%,0)" }
        ]
      },
      "flip-vertical": {
        next: [
          {
            opacity: 0,
            transform: "rotateX(-90deg)",
            transformOrigin: "center top"
          },
          {
            opacity: 1,
            transform: "rotateX(0deg)",
            transformOrigin: "center top"
          }
        ],
        previous: [
          {
            opacity: 1,
            transform: "rotateX(0deg)",
            transformOrigin: "center bottom"
          },
          {
            opacity: 0,
            transform: "rotateX(90deg)",
            transformOrigin: "center bottom"
          }
        ]
      }
    };
    const preset = presets[animation] || presets.fade;
    next.style.opacity = "1";
    next.classList.add("active");
    previous.classList.add("active");
    next.animate(preset.next, {
      duration: COVER_CROSSFADE_MS,
      easing: "cubic-bezier(.22,.75,.25,1)",
      fill: "forwards"
    });
    const previousAnimation = previous.animate(preset.previous, {
      duration: COVER_CROSSFADE_MS,
      easing: "cubic-bezier(.22,.75,.25,1)",
      fill: "forwards"
    });
    previousAnimation.finished.catch(() => {}).then(() => {
      previous.classList.remove("active");
    });
  }

  function stopAlbumCoverRotations() {
    state.albumRotationTimers.forEach((timer) => window.clearInterval(timer));
    state.albumRotationTimers.clear();
  }

  function openAlbumRotationDialog() {
    if (!requireAdmin()) return;
    const album = currentAlbum();
    if (!album) return;
    state.pendingAlbumCoverAnimation = ALBUM_COVER_ANIMATIONS.has(
      album.coverAnimation
    )
      ? album.coverAnimation
      : "fade";
    $("#album-rotation-status").textContent = "";
    syncAlbumRotationOptions();
    openDialog($("#album-rotation-dialog"));
  }

  function selectAlbumRotationOption(animation) {
    if (!ALBUM_COVER_ANIMATIONS.has(animation)) return;
    state.pendingAlbumCoverAnimation = animation;
    syncAlbumRotationOptions();
  }

  function syncAlbumRotationOptions() {
    $$("[data-cover-animation]", $("#album-rotation-options")).forEach(
      (button) => {
        const active =
          button.dataset.coverAnimation === state.pendingAlbumCoverAnimation;
        button.classList.toggle("selected", active);
        button.setAttribute("aria-pressed", String(active));
      }
    );
  }

  async function saveAlbumRotationAnimation() {
    if (!requireAdmin()) return;
    const album = currentAlbum();
    if (!album) return;
    const previous = album.coverAnimation || "fade";
    const next = state.pendingAlbumCoverAnimation;
    if (!ALBUM_COVER_ANIMATIONS.has(next) || next === previous) {
      closeDialogAnimated($("#album-rotation-dialog"));
      return;
    }
    const button = $("#save-album-rotation");
    const status = $("#album-rotation-status");
    button.disabled = true;
    status.textContent = "正在保存轮换动画...";
    album.coverAnimation = next;
    album.updatedAt = new Date().toISOString();
    try {
      await publishSharedContent("Update album cover animation: " + album.name);
      renderAlbums();
      closeDialogAnimated($("#album-rotation-dialog"));
      showToast("相册轮换动画已更新。");
    } catch (error) {
      album.coverAnimation = previous;
      status.textContent = "保存失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  }

  function openAlbum(albumId) {
    const album = state.albums.find((item) => item.id === albumId);
    if (!album) return;
    state.currentAlbumId = album.id;
    state.photoSelectionMode = false;
    state.selectedPhotoIds = [];
    $("#album-dialog-title").textContent = album.name;
    $("#album-name-edit").value = album.name;
    state.pendingAlbumCoverAnimation = album.coverAnimation || "fade";
    syncAlbumRotationOptions();
    $("#album-size-edit").value = String(album.displayWidth);
    $("#album-size-value").textContent = album.displayWidth + "%";
    $("#album-photo-files").value = "";
    $("#album-upload-status").textContent = "";
    updateAlbumFileLabel();
    renderAlbumPhotos(album);
    openDialog($("#album-dialog"));
  }

  function renderAlbumPhotos(album) {
    revokeUrls(state.albumUrls);
    state.albumUrls = [];
    const grid = $("#album-photo-grid");
    state.selectedPhotoIds = state.selectedPhotoIds.filter((id) =>
      album.photos.some((photo) => photo.id === id)
    );
    $("#album-multi-toggle").textContent = state.photoSelectionMode
      ? "退出多选"
      : "多选";
    updateAlbumFooterActions();

    if (!album.photos.length) {
      const empty = document.createElement("div");
      empty.className = "album-photo-empty";
      empty.innerHTML = "<span>+</span><strong>相册里还没有照片</strong><p>从上方选择照片、视频或 LIVP 上传。</p>";
      grid.replaceChildren(empty);
      return;
    }

    grid.replaceChildren(
      ...album.photos.map((photo) => createAlbumPhotoCard(album, photo))
    );
    activateAnimatedMedia(grid);
  }

  function updateAlbumFooterActions() {
    const count = state.selectedPhotoIds.length;
    $("#album-set-cover").hidden = !state.photoSelectionMode;
    $("#album-delete-photo").hidden = !state.photoSelectionMode;
    $("#album-set-cover").disabled = count === 0;
    $("#album-delete-photo").disabled = count === 0;
  }

  function toggleAlbumSelectionMode() {
    if (state.photoSelectionMode) {
      state.photoSelectionMode = false;
      state.selectedPhotoIds = [];
    } else {
      state.photoSelectionMode = true;
      state.selectedPhotoIds = [
        ...(currentAlbum()?.coverPhotoIds || [])
      ];
    }
    syncAlbumSelectionUI();
  }

  function syncAlbumSelectionUI() {
    $("#album-multi-toggle").textContent = state.photoSelectionMode
      ? "退出多选"
      : "多选";
    updateAlbumFooterActions();
    $$(".album-photo-card", $("#album-photo-grid")).forEach((card) => {
      const selected = state.selectedPhotoIds.includes(card.dataset.photoId);
      card.classList.toggle("selected", selected);
      let check = card.querySelector(".photo-selected-check");
      if (selected && !check) {
        check = document.createElement("span");
        check.className = "photo-selected-check";
        check.textContent = "✓";
        card.append(check);
      } else if (!selected && check) {
        check.remove();
      }
      let order = card.querySelector(".cover-order-badge");
      const orderIndex = state.selectedPhotoIds.indexOf(card.dataset.photoId);
      if (selected && orderIndex >= 0) {
        if (!order) {
          order = document.createElement("span");
          order.className = "cover-order-badge";
          card.append(order);
        }
        order.textContent = String(orderIndex + 1);
      } else if (order) {
        order.remove();
      }
    });
  }

  function createAlbumPhotoCard(album, photo) {
    const card = document.createElement("article");
    card.className = "album-photo-card" +
      (state.selectedPhotoIds.includes(photo.id) ? " selected" : "");
    card.dataset.photoId = photo.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "查看照片：" + photo.title);

    const media = createMediaNode(photo, state.albumUrls, true);
    card.append(media);

    if (state.selectedPhotoIds.includes(photo.id)) {
      const check = document.createElement("span");
      check.className = "photo-selected-check";
      check.textContent = "✓";
      card.append(check);
    }

    const footer = document.createElement("div");
    footer.className = "album-photo-footer";
    const title = document.createElement("span");
    title.textContent = photo.title;
    title.className = "renameable-photo-title";
    title.title = "双击重命名";
    title.addEventListener("click", (event) => {
      if (state.isAdmin && !state.photoSelectionMode) {
        event.stopPropagation();
      }
    });
    title.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!state.isAdmin || state.photoSelectionMode) return;
      beginInlineRename(title, photo.title, async (name) => {
        await renameAlbumPhoto(album.id, photo.id, name);
      });
    });
    footer.append(title);
    card.append(footer);

    card.addEventListener("click", () => {
      if (!state.photoSelectionMode) {
        openPhotoLightbox(photo);
        return;
      }
      if (state.selectedPhotoIds.includes(photo.id)) {
        state.selectedPhotoIds = state.selectedPhotoIds.filter(
          (id) => id !== photo.id
        );
      } else {
        state.selectedPhotoIds.push(photo.id);
      }
      syncAlbumSelectionUI();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        openPhotoLightbox(photo);
      }
    });
    return card;
  }

  async function renameAlbumPhoto(albumId, photoId, name) {
    if (!requireAdmin()) return;
    const album = state.albums.find((item) => item.id === albumId);
    const photo = album?.photos?.find((item) => item.id === photoId);
    if (!album || !photo) return;
    const previous = photo.title;
    photo.title = name;
    album.updatedAt = new Date().toISOString();
    try {
      await publishSharedContent("Rename album photo: " + name);
      renderAlbumPhotos(album);
      renderAlbums();
      showToast("照片名称已更新。");
    } catch (error) {
      photo.title = previous;
      album.updatedAt = new Date().toISOString();
      renderAlbumPhotos(album);
      renderAlbums();
      showToast("重命名失败：" + error.message);
    }
  }

  function beginInlineRename(titleElement, currentName, saveHandler) {
    if (!requireAdmin()) return;
    if (state.activeInlineRename?.save) {
      state.activeInlineRename.save().catch(() => {});
    }

    const form = document.createElement("form");
    form.className = "inline-rename-form";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 100;
    input.value = currentName;
    input.className = "inline-rename-input";
    input.setAttribute("aria-label", "输入新名称");
    const confirm = document.createElement("button");
    confirm.type = "submit";
    confirm.className = "inline-rename-confirm";
    confirm.textContent = "确认命名";
    form.append(input, confirm);

    let saving = false;
    let closed = false;
    const cleanup = () => {
      closed = true;
      document.removeEventListener("pointerdown", outside, true);
      if (state.activeInlineRename?.form === form) {
        state.activeInlineRename = null;
      }
    };
    const close = () => {
      cleanup();
      if (form.isConnected) form.replaceWith(titleElement);
    };
    const save = async () => {
      if (saving || closed) return;
      const nextName = input.value.trim();
      if (!nextName) {
        input.focus();
        showToast("名称不能为空。");
        return;
      }
      if (nextName === currentName) {
        close();
        return;
      }
      saving = true;
      input.disabled = true;
      confirm.disabled = true;
      try {
        await saveHandler(nextName);
        cleanup();
      } catch (error) {
        saving = false;
        input.disabled = false;
        confirm.disabled = false;
        input.focus();
        showToast("重命名失败：" + error.message);
      }
    };
    const outside = (event) => {
      if (form.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      save();
    };

    form.addEventListener("click", (event) => event.stopPropagation());
    form.addEventListener("dblclick", (event) => event.stopPropagation());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      save();
    });
    document.addEventListener("pointerdown", outside, true);
    state.activeInlineRename = { form, save };
    titleElement.replaceWith(form);
    input.focus();
    input.select();
  }

  async function saveAlbumSettings() {
    if (!requireAdmin()) return;
    const album = currentAlbum();
    if (!album) return;
    const name = $("#album-name-edit").value.trim();
    if (!name) {
      showToast("相册名称不能为空。");
      return;
    }

    const previousName = album.name;
    const previousWidth = album.displayWidth;
    album.name = name;
    album.displayWidth = Number($("#album-size-edit").value) || 60;
    album.updatedAt = new Date().toISOString();

    try {
      await publishSharedContent("Update album settings: " + album.name);
      $("#album-dialog-title").textContent = name;
      renderAlbums();
      showToast("相册设置已发布。");
    } catch {
      album.name = previousName;
      album.displayWidth = previousWidth;
      $("#album-name-edit").value = previousName;
      $("#album-size-edit").value = String(previousWidth);
      $("#album-size-value").textContent = previousWidth + "%";
      showToast("设置保存失败。");
    }
  }

  function updateAlbumFileLabel() {
    const input = $("#album-photo-files");
    const label = $(".album-upload-row label strong");
    const count = input.files?.length || 0;
    label.textContent = count
      ? "已选择 " + count + " 个文件"
      : "选择照片 / 视频 / LIVP";
  }

  async function uploadAlbumPhotos(event) {
    event.preventDefault();
    if (!requireAdmin()) return;
    const album = currentAlbum();
    const input = $("#album-photo-files");
    const files = [...(input.files || [])];
    const status = $("#album-upload-status");
    const button = $("#album-upload-button");

    if (!album) return;
    if (!files.length) {
      status.textContent = "请先选择照片、视频或 LIVP 文件。";
      return;
    }

    button.disabled = true;
    const failures = [];
    let imported = 0;
    const previousPhotos = [...album.photos];
    const previousCover = album.coverPhotoId;
    const previousCoverIds = [...(album.coverPhotoIds || [])];

    for (let index = 0; index < files.length; index += 1) {
      status.textContent =
        "正在处理 " + (index + 1) + " / " + files.length + " · " + files[index].name;
      try {
        const photo = await createMediaItem(files[index]);
        album.photos.push(photo);
        imported += 1;
      } catch (error) {
        console.warn("Album upload failed:", error);
        failures.push(files[index].name + "：" + error.message);
      }
    }

    if (imported && !album.coverPhotoId) {
      album.coverPhotoId = album.photos[album.photos.length - imported].id;
      album.coverPhotoIds = [album.coverPhotoId];
    }
    album.updatedAt = new Date().toISOString();

    try {
      await publishSharedContent("Upload photos to album: " + album.name);
      renderAlbumPhotos(album);
      renderAlbums();
      status.textContent = imported
        ? "已发布 " + imported + " 张照片" +
          (failures.length ? "，另有 " + failures.length + " 个失败" : "")
        : "上传失败：" + failures[0];
    } catch {
      album.photos = previousPhotos;
      album.coverPhotoId = previousCover;
      album.coverPhotoIds = previousCoverIds;
      renderAlbumPhotos(album);
      renderAlbums();
      status.textContent = "文件已读取，但保存失败。";
    } finally {
      button.disabled = false;
      input.value = "";
      updateAlbumFileLabel();
    }
  }

  async function setAlbumCovers(album, photoIds) {
    if (!requireAdmin()) return;
    const previousCover = album.coverPhotoId;
    const previousCoverIds = [...(album.coverPhotoIds || [])];
    album.coverPhotoIds = [...photoIds];
    album.coverPhotoId = photoIds[0] || null;
    album.updatedAt = new Date().toISOString();
    try {
      await publishSharedContent("Update album cover rotation: " + album.name);
      state.photoSelectionMode = false;
      state.selectedPhotoIds = [];
      renderAlbumPhotos(album);
      renderAlbums();
      showToast("相册封面轮换已发布。");
    } catch {
      album.coverPhotoId = previousCover;
      album.coverPhotoIds = previousCoverIds;
      showToast("封面更新失败。");
    }
  }

  async function deleteSelectedAlbumPhotos(album) {
    if (!requireAdmin()) return;
    const selectedIds = [...state.selectedPhotoIds];
    if (!selectedIds.length) return;
    const confirmed = window.confirm(
      "从相册中删除选中的 " + selectedIds.length + " 张照片吗？"
    );
    if (!confirmed) return;
    const previousPhotos = [...album.photos];
    const previousCover = album.coverPhotoId;
    const previousCoverIds = [...(album.coverPhotoIds || [])];
    album.photos = album.photos.filter(
      (photo) => !selectedIds.includes(photo.id)
    );
    album.coverPhotoIds = (album.coverPhotoIds || []).filter(
      (id) => !selectedIds.includes(id)
    );
    if (!album.coverPhotoIds.length) {
      album.coverPhotoIds = album.photos[0]?.id
        ? [album.photos[0].id]
        : [];
    }
    album.coverPhotoId = album.coverPhotoIds[0] || null;
    album.updatedAt = new Date().toISOString();
    try {
      await publishSharedContent("Delete photos from album: " + album.name);
      state.photoSelectionMode = false;
      state.selectedPhotoIds = [];
      renderAlbumPhotos(album);
      renderAlbums();
      showToast("所选照片删除已发布。");
    } catch {
      album.photos = previousPhotos;
      album.coverPhotoId = previousCover;
      album.coverPhotoIds = previousCoverIds;
      renderAlbumPhotos(album);
      showToast("照片删除失败。");
    }
  }

  async function deleteCurrentAlbum() {
    if (!requireAdmin()) return;
    const album = currentAlbum();
    if (!album) return;
    const confirmed = window.confirm("删除“" + album.name + "”及其中全部照片吗？");
    if (!confirmed) return;
    state.albums = state.albums.filter((item) => item.id !== album.id);
    try {
      await publishSharedContent("Delete album: " + album.name);
      state.currentAlbumId = null;
      closeDialogAnimated($("#album-dialog"));
      renderAlbums();
      showToast("相册删除已发布。");
    } catch {
      state.albums.unshift(album);
      showToast("相册删除失败。");
    }
  }

  function currentAlbum() {
    return state.albums.find((album) => album.id === state.currentAlbumId) || null;
  }

  async function loadGuestbook() {
    const config = getUploadConfig();
    const endpoint = new URL(config.guestbookPath, document.baseURI);
    try {
      const response = await fetch(endpoint.href + "?v=" + Date.now(), {
        cache: "no-store"
      });
      if (!response.ok) {
        state.guestbook = [];
        return;
      }
      const data = await response.json();
      state.guestbook = Array.isArray(data.messages)
        ? data.messages
            .filter((item) => item && item.id && item.content)
            .map((item) => ({
              id: String(item.id),
              content: String(item.content),
              name: String(item.name || "访客"),
              anonymous: Boolean(item.anonymous),
              createdAt: String(item.createdAt || ""),
              shape: normalizeGuestbookShape(item.shape),
              x: Number.isFinite(Number(item.x))
                ? Math.max(0, Math.min(1, Number(item.x)))
                : null,
              y: Number.isFinite(Number(item.y))
                ? Math.max(0, Number(item.y))
                : null
            }))
        : [];
    } catch (error) {
      console.warn("Guestbook could not be loaded:", error);
      state.guestbook = [];
    }
  }

  function setupGuestbook() {
    const anonymousButton = $("#guestbook-anonymous");
    const nameInput = $("#guestbook-name");
    const form = $("#guestbook-form");
    const status = $("#guestbook-status");
    const toggle = $("#guestbook-toggle");

    anonymousButton.addEventListener("click", () => {
      nameInput.value = "匿名";
      anonymousButton.classList.add("active");
      anonymousButton.setAttribute("aria-pressed", "true");
      nameInput.focus();
    });
    nameInput.addEventListener("input", () => {
      const anonymous = nameInput.value.trim() === "匿名";
      anonymousButton.classList.toggle("active", anonymous);
      anonymousButton.setAttribute("aria-pressed", String(anonymous));
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      prepareGuestbookPlacement();
    });
    toggle.addEventListener("click", async () => {
      if (state.guestbookPlacement) {
        await confirmGuestbookPlacement();
        return;
      }
      setGuestbookComposeOpen(!state.guestbookComposeOpen);
    });
    $("#guestbook-shape-options").addEventListener("click", (event) => {
      const option = event.target.closest("[data-shape]");
      if (!option) return;
      state.guestbookShape = normalizeGuestbookShape(option.dataset.shape);
      syncGuestbookShapeOptions();
    });
    $("#guestbook-adjust").addEventListener(
      "click",
      enterGuestbookAdjustMode
    );
    $("#guestbook-adjust-cancel").addEventListener(
      "click",
      cancelGuestbookAdjustMode
    );
    $("#guestbook-adjust-confirm").addEventListener(
      "click",
      confirmGuestbookAdjustMode
    );
    $("#confirm-delete-guestbook").addEventListener(
      "click",
      deletePendingGuestbookMessage
    );
    syncGuestbookShapeOptions();
    syncGuestbookModeUi();
    status.textContent = getUploadConfig().guestbookEndpoint
      ? ""
      : "留言写入服务尚未配置；管理员登录后仍可通过 GitHub 保存留言。";
  }

  function normalizeGuestbookShape(value) {
    return ["circle", "oval", "star", "chat", "octagon", "square"].includes(value)
      ? value
      : "circle";
  }

  function setGuestbookComposeOpen(open) {
    if (state.guestbookPlacement) return;
    state.guestbookComposeOpen = Boolean(open);
    $("#guestbook-form").hidden = !state.guestbookComposeOpen;
    if (state.guestbookComposeOpen) {
      $("#guestbook-message").focus();
    }
    syncGuestbookModeUi();
  }

  function syncGuestbookShapeOptions() {
    $$("[data-shape]", $("#guestbook-shape-options")).forEach((button) => {
      const active = button.dataset.shape === state.guestbookShape;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function syncGuestbookModeUi() {
    const placing = Boolean(state.guestbookPlacement);
    const adjusting = state.guestbookAdjustMode;
    $("#guestbook-toggle").textContent = placing ? "确认" : "留言";
    $("#guestbook-toggle").hidden = adjusting;
    $("#guestbook-adjust").hidden = adjusting || placing;
    $("#guestbook-adjust-cancel").hidden = !adjusting;
    $("#guestbook-adjust-confirm").hidden = !adjusting;
    document.body.classList.toggle("guestbook-placement-mode", placing);
    document.body.classList.toggle("guestbook-adjust-mode", adjusting);
    applyLanguageToDom($(".guestbook-toolbar"));
  }

  function renderGuestbook() {
    const grid = $("#guestbook-grid");
    const empty = $("#guestbook-empty");
    if (!grid || !empty) return;
    const messages = [...state.guestbook].sort((left, right) =>
      String(right.createdAt).localeCompare(String(left.createdAt))
    );
    const board = $("#guestbook-board");
    const boardWidth = Math.max(320, board.clientWidth || 720);
    ensureGuestbookLayouts(messages, boardWidth);
    const placementMessage = state.guestbookPlacement;
    empty.hidden = messages.length > 0 || Boolean(placementMessage);
    grid.hidden = messages.length === 0 && !placementMessage;
    const cards = messages.map((message) =>
      createGuestbookSticker(message, boardWidth, false)
    );
    if (placementMessage) {
      cards.push(createGuestbookSticker(placementMessage, boardWidth, true));
    }
    grid.replaceChildren(...cards);
    observeRevealElements(grid);
    activateAnimatedMedia(grid);
    updateGuestbookBoardHeight();
    applyLanguageToDom(board);
  }

  function guestbookShapeSize(shape, boardWidth, content = "") {
    const scale = Math.min(1, boardWidth / 420);
    const sizes = {
      circle: [210, 210],
      oval: [285, 165],
      star: [245, 245],
      chat: [300, 185],
      octagon: [250, 195],
      square: [225, 225]
    };
    const normalizedShape = normalizeGuestbookShape(shape);
    const [baseWidth, baseHeight] = sizes[normalizedShape];
    let width = Math.min(
      Math.max(180, boardWidth - 20),
      Math.round(baseWidth * scale)
    );
    let height = Math.round(baseHeight * scale);
    const text = String(content || "");
    const length = [...text].length;
    const wideCharacters = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af\u0e00-\u0e7f]/u.test(text);
    const contentWidth = width * (normalizedShape === "star" ? 0.48 : 0.7);
    const averageGlyph = wideCharacters ? 15 : 8.2;
    const charsPerLine = Math.max(7, Math.floor(contentWidth / averageGlyph));
    const lines = Math.max(1, Math.ceil(length / charsPerLine));
    const reservedHeight = normalizedShape === "star" ? 112 : 88;
    height = Math.max(height, lines * 25 + reservedHeight);
    if (normalizedShape === "circle" || normalizedShape === "square") {
      const side = Math.max(width, height);
      width = Math.min(side, boardWidth - 16);
      height = side;
    } else if (normalizedShape === "star") {
      width = Math.min(
        Math.max(width, height * 0.92),
        boardWidth - 16
      );
    }
    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  function ensureGuestbookLayouts(messages, boardWidth) {
    const columns = Math.max(1, Math.floor(boardWidth / 330));
    messages.forEach((message, index) => {
      message.shape = normalizeGuestbookShape(message.shape);
      if (Number.isFinite(message.x) && Number.isFinite(message.y)) return;
      const size = guestbookShapeSize(
        message.shape,
        boardWidth,
        message.content
      );
      const column = index % columns;
      const row = Math.floor(index / columns);
      message.x = Math.min(
        0.92,
        (20 + column * (size.width + 24)) / boardWidth
      );
      message.y = 24 + row * (size.height + 24) + (index % 2) * 18;
    });
  }

  function createGuestbookSticker(message, boardWidth, preview) {
    const card = document.createElement("article");
    const shape = normalizeGuestbookShape(message.shape);
    card.className =
      "guestbook-card guestbook-sticker shape-" + shape +
      (preview ? " guestbook-preview" : "") +
      (state.guestbookAdjustMode && !preview ? " guestbook-adjustable" : "");
    card.dataset.messageId = message.id;
    card.tabIndex = preview || state.guestbookAdjustMode ? 0 : -1;
    applyGuestbookStickerLayout(card, message, boardWidth);

    const content = document.createElement("p");
    content.className = "guestbook-card-content";
    content.textContent = message.content;
    const footer = document.createElement("div");
    footer.className = "guestbook-card-footer";
    const name = document.createElement("strong");
    name.textContent = message.name || (message.anonymous ? "匿名" : "访客");
    const date = document.createElement("time");
    if (message.createdAt) {
      const parsed = new Date(message.createdAt);
      date.textContent = Number.isNaN(parsed.getTime())
        ? ""
        : parsed.toLocaleDateString(document.documentElement.lang || "zh-CN");
      date.dateTime = message.createdAt;
    }
    footer.append(name, date);
    card.append(content, footer);

    if (!preview) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "guestbook-delete admin-only";
      remove.setAttribute("aria-label", "删除这条留言");
      remove.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"></path>' +
        "</svg>";
      remove.addEventListener("pointerdown", (event) => event.stopPropagation());
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        state.pendingGuestbookDeleteId = message.id;
        $("#guestbook-delete-copy").textContent =
          "确定删除“" + (message.name || "匿名") +
          "”的这条留言吗？删除后会同步更新 GitHub。";
        openDialog($("#guestbook-delete-dialog"));
      });
      card.append(remove);
      if (state.guestbookAdjustMode) {
        card.addEventListener("pointerdown", (event) => {
          if (event.button === 0 && !event.target.closest(".guestbook-delete")) {
            startGuestbookDrag(event, message, card);
          }
        });
      }
    } else {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "guestbook-preview-cancel";
      cancel.textContent = state.translateUiText?.("取消") || "取消";
      if (
        state.language &&
        state.language !== "zh-CN" &&
        !window.KERRY_I18N?.dict?.[state.language]?.["取消"]
      ) {
        translateUserText("取消").then((translated) => {
          if (cancel.isConnected && translated !== "取消") {
            cancel.textContent = translated;
          }
        });
      }
      cancel.addEventListener("pointerdown", (event) => event.stopPropagation());
      cancel.addEventListener("click", (event) => {
        event.stopPropagation();
        cancelGuestbookPlacement();
      });
      card.append(cancel);
      card.addEventListener("pointerdown", (event) => {
        if (event.button === 0) startGuestbookDrag(event, message, card);
      });
    }
    return card;
  }

  function applyGuestbookStickerLayout(card, message, boardWidth) {
    const size = guestbookShapeSize(
      message.shape,
      boardWidth,
      message.content
    );
    const x = Math.max(0, Math.min(boardWidth - size.width - 8, message.x * boardWidth));
    const y = Math.max(8, message.y || 8);
    card.style.left = x + "px";
    card.style.top = y + "px";
    card.style.width = size.width + "px";
    card.style.height = size.height + "px";
  }

  function startGuestbookDrag(event, message, card) {
    if (!state.guestbookPlacement && !state.guestbookAdjustMode) return;
    const board = $("#guestbook-board");
    const grid = $("#guestbook-grid");
    const boardWidth = Math.max(320, board.clientWidth || 720);
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { x: message.x || 0, y: message.y || 0 };
    const displayedMessage = {
      ...message,
      content:
        card.querySelector(".guestbook-card-content")?.textContent ||
        message.content
    };
    let lastValid = { ...initial };
    event.preventDefault();
    event.stopPropagation();
    card.classList.add("is-dragging");
    card.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      message.x = Math.max(
        0,
        Math.min(0.96, initial.x + (moveEvent.clientX - startX) / boardWidth)
      );
      message.y = Math.max(8, initial.y + moveEvent.clientY - startY);
      displayedMessage.x = message.x;
      displayedMessage.y = message.y;
      applyGuestbookStickerLayout(card, displayedMessage, boardWidth);
      const invalid = guestbookStickerOverlaps(card, grid);
      card.classList.toggle("position-invalid", invalid);
      if (!invalid) lastValid = { x: message.x, y: message.y };
      updateGuestbookBoardHeight();
    };
    const finish = () => {
      const invalid = card.classList.contains("position-invalid");
      if (invalid) {
        message.x = lastValid.x;
        message.y = lastValid.y;
        displayedMessage.x = message.x;
        displayedMessage.y = message.y;
        applyGuestbookStickerLayout(card, displayedMessage, boardWidth);
      } else {
        lastValid = { x: message.x, y: message.y };
      }
      card.classList.remove("is-dragging", "position-invalid");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  }

  function guestbookStickerOverlaps(card, grid) {
    const base = grid.getBoundingClientRect();
    const own = card.getBoundingClientRect();
    const rect = {
      left: own.left - base.left,
      top: own.top - base.top,
      right: own.right - base.left,
      bottom: own.bottom - base.top
    };
    return $$(".guestbook-sticker", grid).some((other) => {
      if (other === card) return false;
      const candidate = other.getBoundingClientRect();
      const otherRect = {
        left: candidate.left - base.left,
        top: candidate.top - base.top,
        right: candidate.right - base.left,
        bottom: candidate.bottom - base.top
      };
      return !(
        rect.right + 8 <= otherRect.left ||
        rect.left >= otherRect.right + 8 ||
        rect.bottom + 8 <= otherRect.top ||
        rect.top >= otherRect.bottom + 8
      );
    });
  }

  function updateGuestbookBoardHeight() {
    const grid = $("#guestbook-grid");
    const board = $("#guestbook-board");
    const bottom = $$(".guestbook-sticker", grid).reduce((maximum, card) => {
      return Math.max(maximum, card.offsetTop + card.offsetHeight);
    }, 0);
    const height = Math.max(620, bottom + 40);
    board.style.setProperty("--guestbook-board-height", height + "px");
    grid.style.height = height + "px";
  }

  function prepareGuestbookPlacement() {
    const messageInput = $("#guestbook-message");
    const nameInput = $("#guestbook-name");
    const status = $("#guestbook-status");
    const content = messageInput.value.trim();
    if (!content) {
      status.textContent = "请先写下留言内容。";
      messageInput.focus();
      return;
    }
    const name = nameInput.value.trim() || "访客";
    const board = $("#guestbook-board");
    const boardWidth = Math.max(320, board.clientWidth || 720);
    const size = guestbookShapeSize(
      state.guestbookShape,
      boardWidth,
      content
    );
    const placement = {
      id: createId("guestbook-draft"),
      content,
      name,
      anonymous: name === "匿名",
      shape: state.guestbookShape,
      x: Math.max(0, (boardWidth - size.width) / (2 * boardWidth)),
      y: 60,
      createdAt: new Date().toISOString()
    };
    findAvailableGuestbookPosition(placement, boardWidth);
    state.guestbookPlacement = placement;
    state.guestbookComposeOpen = false;
    $("#guestbook-form").hidden = true;
    status.textContent = "";
    renderGuestbook();
    syncGuestbookModeUi();
    board.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast("拖动留言贴纸选择位置，然后点击“确认”。");
  }

  function findAvailableGuestbookPosition(message, boardWidth) {
    const size = guestbookShapeSize(
      message.shape,
      boardWidth,
      message.content
    );
    const candidates = state.guestbook.map((item) => {
      const itemSize = guestbookShapeSize(
        item.shape,
        boardWidth,
        item.content
      );
      return {
        left: item.x * boardWidth,
        top: item.y,
        right: item.x * boardWidth + itemSize.width,
        bottom: item.y + itemSize.height
      };
    });
    const overlaps = (left, top) =>
      candidates.some((rect) =>
        !(
          left + size.width + 8 <= rect.left ||
          left >= rect.right + 8 ||
          top + size.height + 8 <= rect.top ||
          top >= rect.bottom + 8
        )
      );
    let y = 28;
    while (overlaps((boardWidth - size.width) / 2, y)) {
      y += size.height + 24;
    }
    message.y = y;
  }

  async function confirmGuestbookPlacement() {
    if (!state.guestbookPlacement) return;
    const preview = $(".guestbook-preview", $("#guestbook-grid"));
    if (preview?.classList.contains("position-invalid")) {
      $("#guestbook-status").textContent = "当前位置与其他留言重叠，请重新放置。";
      return;
    }
    const draft = state.guestbookPlacement;
    const toggle = $("#guestbook-toggle");
    toggle.disabled = true;
    toggle.textContent = "正在发布...";
    try {
      const saved = await publishGuestbookMessage(draft);
      state.guestbook = [
        saved,
        ...state.guestbook.filter((item) => item.id !== saved.id)
      ];
      state.guestbookPlacement = null;
      state.guestbookComposeOpen = false;
      $("#guestbook-message").value = "";
      $("#guestbook-name").value = "";
      $("#guestbook-status").textContent = "";
      renderGuestbook();
      syncGuestbookModeUi();
      showToast("留言已张贴。");
    } catch (error) {
      restoreGuestbookCompose(draft, error.message);
    } finally {
      toggle.disabled = false;
    }
  }

  function cancelGuestbookPlacement() {
    if (!state.guestbookPlacement) return;
    const draft = state.guestbookPlacement;
    restoreGuestbookCompose(draft, "");
  }

  function restoreGuestbookCompose(draft, errorMessage = "") {
    state.guestbookPlacement = null;
    state.guestbookComposeOpen = true;
    state.guestbookShape = normalizeGuestbookShape(draft.shape);
    $("#guestbook-message").value = draft.content;
    $("#guestbook-name").value = draft.name;
    $("#guestbook-form").hidden = false;
    $("#guestbook-status").textContent = errorMessage
      ? "张贴失败：" + errorMessage
      : "";
    $("#guestbook-anonymous").classList.toggle("active", draft.anonymous);
    $("#guestbook-anonymous").setAttribute("aria-pressed", String(draft.anonymous));
    syncGuestbookShapeOptions();
    renderGuestbook();
    syncGuestbookModeUi();
    if (!errorMessage) {
      $("#guestbook-form").scrollIntoView({ behavior: "smooth", block: "center" });
      $("#guestbook-message").focus();
    }
  }

  async function publishGuestbookMessage(message) {
    const config = getUploadConfig();
    let savedMessage;
    if (state.isAdmin) {
      const remoteMessage = {
        id: createId("message"),
        content: message.content,
        name: message.name,
        anonymous: Boolean(message.anonymous),
        shape: normalizeGuestbookShape(message.shape),
        x: message.x,
        y: message.y,
        createdAt: new Date().toISOString()
      };
      const next = await mutateRemoteGuestbook(
        (data) => ({
          version: 1,
          messages: [remoteMessage, ...(data.messages || [])].slice(0, 500)
        }),
        "Add guestbook message"
      );
      state.guestbook = next.messages.map((item) => ({
        ...item,
        shape: normalizeGuestbookShape(item.shape),
        x: Number.isFinite(Number(item.x)) ? Number(item.x) : null,
        y: Number.isFinite(Number(item.y)) ? Number(item.y) : null
      }));
      savedMessage = remoteMessage;
    } else if (config.guestbookEndpoint) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch(config.guestbookEndpoint, {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: message.content,
            name: message.name,
            anonymous: Boolean(message.anonymous),
            shape: normalizeGuestbookShape(message.shape),
            x: message.x,
            y: message.y
          }),
          signal: controller.signal
        });
      } catch (error) {
        throw new Error(
          error.name === "AbortError"
            ? "留言服务响应超时。请检查腾讯云函数和 API 网关是否正常运行。"
            : "无法连接留言服务。请检查 config.js 中的 guestbookEndpoint 是否为部署后的实际地址。"
        );
      } finally {
        window.clearTimeout(timeout);
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error(payload?.error || "留言服务暂时不可用");
      }
      savedMessage = {
        ...(payload?.message || {}),
        id: payload?.message?.id || createId("message"),
        content: message.content,
        name: message.name,
        anonymous: Boolean(message.anonymous),
        shape: normalizeGuestbookShape(message.shape),
        x: message.x,
        y: message.y,
        createdAt: payload?.message?.createdAt || new Date().toISOString()
      };
    } else {
      throw new Error(
        "留言服务尚未配置。请先部署留言写入服务，或由管理员登录后发布留言。"
      );
    }
    return savedMessage;
  }

  function enterGuestbookAdjustMode() {
    if (!requireAdmin()) return;
    state.guestbookLayoutSnapshot = JSON.parse(JSON.stringify(state.guestbook));
    state.guestbookAdjustMode = true;
    renderGuestbook();
    syncGuestbookModeUi();
  }

  function cancelGuestbookAdjustMode() {
    state.guestbook = JSON.parse(JSON.stringify(state.guestbookLayoutSnapshot));
    state.guestbookAdjustMode = false;
    state.guestbookLayoutSnapshot = [];
    renderGuestbook();
    syncGuestbookModeUi();
  }

  async function confirmGuestbookAdjustMode() {
    if (!requireAdmin() || !state.guestbookAdjustMode) return;
    const button = $("#guestbook-adjust-confirm");
    button.disabled = true;
    try {
      const next = await mutateRemoteGuestbook(
        () => ({
          version: 1,
          messages: state.guestbook.map((message) => ({
            ...message,
            shape: normalizeGuestbookShape(message.shape),
            x: Number(message.x || 0),
            y: Number(message.y || 0)
          }))
        }),
        "Update guestbook sticker layout"
      );
      state.guestbook = next.messages;
      state.guestbookAdjustMode = false;
      state.guestbookLayoutSnapshot = [];
      renderGuestbook();
      syncGuestbookModeUi();
      showToast("留言贴纸布局已发布。");
    } catch (error) {
      showToast("留言布局保存失败：" + error.message);
    } finally {
      button.disabled = false;
    }
  }

  async function deletePendingGuestbookMessage() {
    if (!requireAdmin()) return;
    const id = state.pendingGuestbookDeleteId;
    const message = state.guestbook.find((item) => item.id === id);
    if (!message) return;
    const button = $("#confirm-delete-guestbook");
    button.disabled = true;
    try {
      const next = await mutateRemoteGuestbook(
        (data) => ({
          version: 1,
          messages: (data.messages || []).filter((item) => item.id !== id)
        }),
        "Delete guestbook message"
      );
      const card = $(
        '.guestbook-card[data-message-id="' + CSS.escape(id) + '"]',
        $("#guestbook-grid")
      );
      if (card) {
        card.classList.add("is-removing");
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
      state.guestbook = next.messages;
      state.pendingGuestbookDeleteId = "";
      closeDialogAnimated($("#guestbook-delete-dialog"));
      renderGuestbook();
      showToast("留言已删除。");
    } catch (error) {
      $("#guestbook-delete-copy").textContent = "删除失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function mutateRemoteGuestbook(mutator, commitMessage) {
    if (!state.isAdmin) throw new Error("管理员尚未登录");
    const config = getUploadConfig();
    const branch = config.branch || state.repoInfo?.default_branch || "main";
    const path = config.guestbookPath.split("/").map(encodeURIComponent).join("/");
    let lastError = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        let sha = "";
        let current = { version: 1, messages: [] };
        try {
          const existing = await githubRequest(
            "/repos/" + config.owner + "/" + config.repo +
              "/contents/" + path + "?ref=" + encodeURIComponent(branch),
            state.adminToken
          );
          sha = existing.sha || "";
          if (existing.content) {
            const decoded = new TextDecoder().decode(
              base64ToBytes(String(existing.content).replace(/\s+/g, ""))
            );
            current = JSON.parse(decoded);
          }
        } catch (error) {
          if (error.status !== 404) throw error;
        }
        const next = mutator(current);
        const encoded = bytesToBase64(
          new TextEncoder().encode(JSON.stringify(next, null, 2) + "\n")
        );
        await githubRequest(
          "/repos/" + config.owner + "/" + config.repo + "/contents/" + path,
          state.adminToken,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: commitMessage,
              content: encoded,
              branch,
              ...(sha ? { sha } : {})
            })
          }
        );
        return next;
      } catch (error) {
        lastError = error;
        if (
          !error.status ||
          ![409, 422, 429, 500, 502, 503, 504].includes(error.status) ||
          attempt === 4
        ) {
          throw error;
        }
        await new Promise((resolve) =>
          window.setTimeout(resolve, 450 * attempt)
        );
      }
    }
    throw lastError;
  }

  function setupFootprints() {
    $("#map-zoom-in").addEventListener("click", () => {
      ensureFootprintsMap();
      state.footprintMap?.zoomIn();
    });
    $("#map-zoom-out").addEventListener("click", () => {
      ensureFootprintsMap();
      state.footprintMap?.zoomOut();
    });
    $("#map-locate").addEventListener("click", locateCurrentPosition);
    $("#map-3d-toggle").addEventListener("click", toggleFootprintMap3D);
    $("#footprint-multi-toggle").addEventListener(
      "click",
      toggleFootprintSelectionMode
    );
    $("#footprint-delete-selected").addEventListener(
      "click",
      deleteSelectedFootprints
    );
    $("#open-footprint-upload").addEventListener("click", () => {
      if (!requireAdmin()) return;
      $("#footprint-files").value = "";
      $("#footprint-latitude").value = "";
      $("#footprint-longitude").value = "";
      $("#footprint-preview-list").replaceChildren();
      $("#footprint-upload-status").textContent = "";
      openDialog($("#footprint-upload-dialog"));
    });
    $("#footprint-files").addEventListener("change", () => {
      const files = [...($("#footprint-files").files || [])];
      $("#footprint-preview-list").replaceChildren(
        ...files.map((file) => {
          const item = document.createElement("span");
          item.textContent = file.name;
          return item;
        })
      );
    });
    $("#footprint-upload-form").addEventListener(
      "submit",
      uploadFootprintPhotos
    );
  }

  function renderFootprints() {
    revokeUrls(state.footprintUrls);
    state.footprintUrls = [];
    const gallery = $("#footprint-gallery");
    const empty = $("#footprint-empty");
    const actions = $("#footprint-actions");
    const items = [...state.footprints].sort((left, right) =>
      String(right.createdAt).localeCompare(String(left.createdAt))
    );
    state.selectedFootprintIds = state.selectedFootprintIds.filter((id) =>
      items.some((item) => item.id === id)
    );
    empty.hidden = items.length > 0;
    gallery.hidden = items.length === 0;
    actions.hidden = items.length === 0;
    gallery.replaceChildren(
      ...items.map((item) => createFootprintCard(item))
    );
    observeRevealElements(gallery);
    activateAnimatedMedia(gallery);
    updateFootprintMapMarkers();
    syncFootprintSelectionUI();
  }

  function createFootprintCard(item) {
    const card = document.createElement("article");
    const selected = state.selectedFootprintIds.includes(item.id);
    card.className = "footprint-card reveal" + (selected ? " selected" : "");
    card.dataset.footprintId = item.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute(
      "aria-label",
      "查看足迹：" + (item.title || "旅行照片")
    );
    const media = createMediaNode(item, state.footprintUrls, true);
    const info = document.createElement("div");
    info.className = "footprint-card-info";
    const title = document.createElement("strong");
    title.textContent = item.title || "旅行照片";
    title.className = "renameable-photo-title";
    title.title = "双击重命名";
    const coordinate = document.createElement("span");
    coordinate.textContent =
      hasValidFootprintCoordinates(item)
        ? Number(item.lat).toFixed(3) + "°, " + Number(item.lng).toFixed(3) + "°"
        : "未记录坐标";
    info.append(title, coordinate);
    card.append(media, info);
    if (selected) {
      const check = document.createElement("span");
      check.className = "photo-selected-check";
      check.textContent = "✓";
      card.append(check);
    }

    title.addEventListener("click", (event) => {
      if (state.isAdmin && !state.footprintSelectionMode) {
        event.stopPropagation();
      }
    });
    title.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!state.isAdmin || state.footprintSelectionMode) return;
      beginInlineRename(title, item.title || "旅行照片", async (name) => {
        await renameFootprint(item.id, name);
      });
    });

    const open = () => openPhotoLightbox(item);
    let locateTimer = null;
    card.addEventListener("click", () => {
      if (state.footprintSelectionMode) {
        toggleFootprintSelection(item.id);
        return;
      }
      clearTimeout(locateTimer);
      locateTimer = window.setTimeout(() => {
        focusFootprintOnMap(item);
      }, 230);
    });
    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      clearTimeout(locateTimer);
      if (!state.footprintSelectionMode) open();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (state.footprintSelectionMode) toggleFootprintSelection(item.id);
        else focusFootprintOnMap(item);
      }
    });
    return card;
  }

  function parseCoordinateValue(value, maximum) {
    if (value === null || value === undefined || value === "") return null;
    let numeric = value;
    if (Array.isArray(value)) {
      if (!value.length) return null;
      numeric = value.reduce(
        (total, part, index) => total + Number(part) / 60 ** index,
        0
      );
    }
    const parsed = Number(numeric);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > maximum) return null;
    return parsed;
  }

  function hasValidFootprintCoordinates(item) {
    const latitude = parseCoordinateValue(item?.lat, 90);
    const longitude = parseCoordinateValue(item?.lng, 180);
    return (
      latitude !== null &&
      longitude !== null &&
      !(latitude === 0 && longitude === 0)
    );
  }

  function sanitizeFootprintRecord(item) {
    const latitude = parseCoordinateValue(item?.lat, 90);
    const longitude = parseCoordinateValue(item?.lng, 180);
    const valid =
      latitude !== null &&
      longitude !== null &&
      !(latitude === 0 && longitude === 0);
    return {
      ...item,
      lat: valid ? latitude : null,
      lng: valid ? longitude : null
    };
  }

  function toggleFootprintSelectionMode() {
    state.footprintSelectionMode = !state.footprintSelectionMode;
    state.selectedFootprintIds = [];
    syncFootprintSelectionUI();
  }

  function toggleFootprintSelection(id) {
    state.selectedFootprintIds = state.selectedFootprintIds.includes(id)
      ? state.selectedFootprintIds.filter((itemId) => itemId !== id)
      : [...state.selectedFootprintIds, id];
    syncFootprintSelectionUI();
  }

  function syncFootprintSelectionUI() {
    const toggle = $("#footprint-multi-toggle");
    const remove = $("#footprint-delete-selected");
    if (!toggle || !remove) return;
    toggle.textContent = state.footprintSelectionMode
      ? "退出多选"
      : "多选";
    remove.hidden = !state.footprintSelectionMode;
    remove.disabled = state.selectedFootprintIds.length === 0;
    $$(".footprint-card", $("#footprint-gallery")).forEach((card) => {
      const selected = state.selectedFootprintIds.includes(
        card.dataset.footprintId
      );
      card.classList.toggle("selected", selected);
      let check = card.querySelector(".photo-selected-check");
      if (selected && !check) {
        check = document.createElement("span");
        check.className = "photo-selected-check";
        check.textContent = "✓";
        card.append(check);
      } else if (!selected && check) {
        check.remove();
      }
    });
  }

  async function deleteSelectedFootprints() {
    if (!requireAdmin()) return;
    const selectedIds = [...state.selectedFootprintIds];
    if (!selectedIds.length) return;
    if (
      !window.confirm(
        "从足迹中删除选中的 " + selectedIds.length + " 张照片吗？"
      )
    ) {
      return;
    }
    const previous = [...state.footprints];
    state.footprints = state.footprints.filter(
      (item) => !selectedIds.includes(item.id)
    );
    state.footprintSelectionMode = false;
    state.selectedFootprintIds = [];
    const button = $("#footprint-delete-selected");
    button.disabled = true;
    try {
      await publishSharedContent("Delete footprint photos");
      renderFootprints();
      showToast("所选足迹照片已删除。");
    } catch (error) {
      state.footprints = previous;
      renderFootprints();
      showToast("足迹照片删除失败：" + error.message);
    } finally {
      button.disabled = false;
    }
  }

  function focusFootprintOnMap(item) {
    if (!hasValidFootprintCoordinates(item)) {
      showToast("这张照片没有可用的地理位置。");
      return;
    }
    ensureFootprintsMap();
    if (!state.footprintMap || !state.mapReady) {
      state.footprintMap?.once("load", () => focusFootprintOnMap(item));
      return;
    }
    const marker = state.footprintMarkerLookup.get(item.id);
    if (!marker) return;
    $("#footprints-map").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    state.footprintMap.flyTo({
      center: marker.getLngLat(),
      zoom: Math.max(12, state.footprintMap.getZoom()),
      duration: 800
    });
    marker.togglePopup();
  }

  function highlightFootprintCard(footprintId) {
    const card = $(
      '.footprint-card[data-footprint-id="' +
        CSS.escape(footprintId) +
        '"]',
      $("#footprint-gallery")
    );
    if (!card) return;
    card.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    card.classList.remove("is-locating-photo");
    void card.offsetWidth;
    card.classList.add("is-locating-photo");
    card.addEventListener(
      "animationend",
      () => card.classList.remove("is-locating-photo"),
      { once: true }
    );
    window.setTimeout(
      () => card.classList.remove("is-locating-photo"),
      4200
    );
  }

  async function renameFootprint(id, name) {
    if (!requireAdmin()) return;
    const item = state.footprints.find((footprint) => footprint.id === id);
    if (!item) return;
    const previous = item.title;
    item.title = name;
    try {
      await publishSharedContent("Rename footprint photo: " + name);
      renderFootprints();
      showToast("足迹照片名称已更新。");
    } catch (error) {
      item.title = previous;
      renderFootprints();
      showToast("重命名失败：" + error.message);
    }
  }

  function ensureFootprintsMap() {
    if (!window.maplibregl) {
      showToast("地图组件加载失败，请检查 vendor/maplibre-gl.js。");
      return;
    }
    if (state.footprintMap) return;
    state.mapReady = false;
    state.footprintMap = new window.maplibregl.Map({
      container: "footprints-map",
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [18, 24],
      zoom: 3,
      minZoom: 3,
      maxZoom: 18,
      maxPitch: 85,
      renderWorldCopies: false,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 180
    });
    state.footprintMap.dragRotate.disable();
    state.footprintMap.touchZoomRotate.disableRotation();
    setupFootprintMapTiltInteraction();
    state.footprintMap.on("load", () => {
      state.mapReady = true;
      applyBuiltInBilingualLabels();
      updateFootprintMapMarkers();
    });
  }

  function setupFootprintMapTiltInteraction() {
    const map = state.footprintMap;
    if (!map || map.__dualButtonTiltReady) return;
    const container = map.getCanvasContainer();
    const root = map.getContainer();
    const heldButtons = new Set();
    let session = null;
    map.__dualButtonTiltReady = true;

    const setInteractionClass = (mode = "") => {
      container.classList.toggle("is-tilting", mode === "tilt");
      root.classList.toggle("is-tilting", mode === "tilt");
      container.classList.toggle("is-rotating", mode === "rotate");
      root.classList.toggle("is-rotating", mode === "rotate");
    };

    const finish = () => {
      if (!session) return;
      session = null;
      map.dragPan.enable();
      setInteractionClass();
    };

    const isInsideMap = (event) => {
      const rect = root.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    };

    const startIfReady = (event) => {
      if (!isInsideMap(event)) return false;
      if (heldButtons.has(0) && heldButtons.has(2)) {
        session = {
          mode: "tilt",
          startX: event.clientX,
          startY: event.clientY,
          startPitch: map.getPitch(),
          startBearing: map.getBearing()
        };
        map.dragPan.disable();
        setInteractionClass("tilt");
        return true;
      }
      if (heldButtons.has(2) && !heldButtons.has(0) && !session) {
        session = {
          mode: "rotate",
          startX: event.clientX,
          startY: event.clientY,
          startPitch: map.getPitch(),
          startBearing: map.getBearing()
        };
        map.dragPan.disable();
        setInteractionClass("rotate");
        return true;
      }
      return false;
    };

    root.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    window.addEventListener(
      "mousedown",
      (event) => {
        if (!isInsideMap(event) && !session) return;
        heldButtons.add(event.button);
        if (startIfReady(event)) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );

    window.addEventListener(
      "mousemove",
      (event) => {
        if (!session) return;
        if (session.mode === "tilt") {
          if (!heldButtons.has(0) || !heldButtons.has(2)) {
            finish();
            return;
          }
          const pitch = Math.min(
            85,
            Math.max(
              20,
              session.startPitch + (session.startY - event.clientY) * 0.32
            )
          );
          map.setPitch(pitch);
          root.dataset.mapPitch = pitch.toFixed(1);
        } else {
          if (!heldButtons.has(2) || heldButtons.has(0)) {
            finish();
            return;
          }
          const bearing =
            session.startBearing + (event.clientX - session.startX) * 0.28;
          map.setBearing(bearing);
          root.dataset.mapBearing = bearing.toFixed(1);
        }
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );

    window.addEventListener(
      "mouseup",
      (event) => {
        heldButtons.delete(event.button);
        if (session) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (
          (session?.mode === "tilt" &&
            (!heldButtons.has(0) || !heldButtons.has(2))) ||
          (session?.mode === "rotate" && !heldButtons.has(2))
        ) {
          finish();
        }
      },
      true
    );

    window.addEventListener("blur", () => {
      heldButtons.clear();
      finish();
    });
    container.addEventListener("mouseleave", (event) => {
      if (
        session &&
        ((session.mode === "tilt" && (event.buttons & 3) !== 3) ||
          (session.mode === "rotate" && (event.buttons & 2) !== 2))
      ) {
        heldButtons.clear();
        finish();
      }
    });
  }

  function toggleFootprintMap3D() {
    ensureFootprintsMap();
    if (!state.footprintMap) return;
    if (!state.mapReady) {
      state.footprintMap.once("load", toggleFootprintMap3D);
      return;
    }
    const map = state.footprintMap;
    const button = $("#map-3d-toggle");
    const layerId = "footprint-3d-buildings";
    const enabled = !state.map3dEnabled;

    if (enabled) {
      const style = map.getStyle();
      const buildingLayer = (style.layers || []).find(
        (layer) =>
          layer["source-layer"] === "building" &&
          layer.source &&
          layer.type !== "symbol"
      );
      if (!buildingLayer) {
        showToast("当前地图样式暂不包含 3D 建筑数据。");
        return;
      }
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "fill-extrusion",
          source: buildingLayer.source,
          "source-layer": buildingLayer["source-layer"],
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#91afc4",
            "fill-extrusion-height": [
              "max",
              4,
              [
                "coalesce",
                ["get", "render_height"],
                ["get", "height"],
                ["*", ["coalesce", ["get", "levels"], 3], 3],
                12
              ]
            ],
            "fill-extrusion-base": [
              "coalesce",
              ["get", "render_min_height"],
              ["get", "min_height"],
              0
            ],
            "fill-extrusion-opacity": 0.82
          }
        });
      }
      const firstLocatedFootprint = state.footprints.find(
        hasValidFootprintCoordinates
      );
      const targetCenter =
        map.getZoom() >= 12
          ? map.getCenter()
          : firstLocatedFootprint
            ? {
                lng: parseCoordinateValue(firstLocatedFootprint.lng, 180),
                lat: parseCoordinateValue(firstLocatedFootprint.lat, 90)
              }
            : { lng: 114.0579, lat: 22.5431 };
      map.easeTo({
        center: targetCenter,
        pitch: 60,
        bearing: -18,
        zoom: Math.max(map.getZoom(), 15.2),
        duration: 900
      });
    } else {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    }
    state.map3dEnabled = enabled;
    button.classList.toggle("active", enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("aria-label", enabled ? "关闭 3D 建筑" : "开启 3D 建筑");
  }

  function applyBuiltInBilingualLabels() {
    if (!state.footprintMap || !state.mapReady) return;
    const style = state.footprintMap.getStyle();
    const localName = [
      "coalesce",
      ["get", "name"],
      ["get", "name:en"],
      ["get", "name:latin"],
      ""
    ];
    const languageFields = {
      "zh-CN": ["name:zh", "name:zh-Hans"],
      "zh-TW": ["name:zh-Hant", "name:zh"],
      en: ["name:en"],
      ja: ["name:ja"],
      es: ["name:es"],
      ko: ["name:ko"],
      ru: ["name:ru"],
      de: ["name:de"],
      fa: ["name:fa"],
      fr: ["name:fr"],
      id: ["name:id"],
      th: ["name:th"],
      vi: ["name:vi"],
      pt: ["name:pt"],
      bo: ["name:bo"],
      el: ["name:el"],
      ms: ["name:ms"]
    };
    const selectedName = [
      "coalesce",
      ...(languageFields[state.language] || []).map((field) => ["get", field]),
      ["get", "name:en"],
      localName
    ];
    const bilingualLabel = [
      "case",
      ["==", selectedName, localName],
      localName,
      ["concat", localName, "\n", selectedName]
    ];
    const labelSources = new Set([
      "place",
      "transportation_name",
      "water_name",
      "poi",
      "aerodrome_label"
    ]);
    for (const layer of style.layers || []) {
      if (
        layer.type !== "symbol" ||
        !layer.layout?.["text-field"] ||
        !labelSources.has(layer["source-layer"]) ||
        layer.id.includes("shield")
      ) {
        continue;
      }
      try {
        state.footprintMap.setLayoutProperty(
          layer.id,
          "text-field",
          bilingualLabel
        );
        const existingFilter = state.footprintMap.getFilter(layer.id);
        const hideTaiwanLabel = [
          "!",
          [
            "match",
            [
              "coalesce",
              ["get", "name:zh"],
              ["get", "name:zh-Hant"],
              ["get", "name"],
              ["get", "name:en"],
              ""
            ],
            ["台湾", "臺灣", "Taiwan"],
            true,
            false
          ]
        ];
        state.footprintMap.setFilter(
          layer.id,
          existingFilter
            ? ["all", existingFilter, hideTaiwanLabel]
            : hideTaiwanLabel
        );
      } catch {
        // Keep the original label when a style layer uses a special expression.
      }
    }
    if (state.footprintMap.getLayer("label_city_capital")) {
      try {
        state.footprintMap.setLayoutProperty(
          "label_city_capital",
          "text-font",
          [
            "case",
            [
              "any",
              ["==", ["get", "name"], "臺北市"],
              ["==", ["get", "name"], "台北市"],
              ["==", ["get", "name:zh"], "臺北市"],
              ["==", ["get", "name:zh"], "台北市"],
              ["==", ["get", "name:en"], "Taipei"]
            ],
            ["literal", ["Noto Sans Regular"]],
            ["literal", ["Noto Sans Bold"]]
          ]
        );
      } catch {
        // Leave the original capital-city font stack if this style is unavailable.
      }
    }
  }

  function locateCurrentPosition() {
    ensureFootprintsMap();
    if (!state.footprintMap) return;
    if (!state.mapReady) {
      state.footprintMap.once("load", locateCurrentPosition);
      return;
    }
    if (!navigator.geolocation) {
      showToast("当前浏览器不支持位置定位。");
      return;
    }
    const button = $("#map-locate");
    button.disabled = true;
    button.classList.add("is-locating");
    button.setAttribute("aria-busy", "true");
    const finish = () => {
      button.disabled = false;
      button.classList.remove("is-locating");
      button.removeAttribute("aria-busy");
    };
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawLatitude = Number(position.coords.latitude);
        const rawLongitude = Number(position.coords.longitude);
        if (
          !Number.isFinite(rawLatitude) ||
          !Number.isFinite(rawLongitude)
        ) {
          showToast("未能读取有效的位置坐标。");
          finish();
          return;
        }
        const coordinate = { lat: rawLatitude, lng: rawLongitude };
        if (state.userLocationMarker) state.userLocationMarker.remove();
        const markerElement = document.createElement("span");
        markerElement.className = "user-location-marker";
        markerElement.append(document.createElement("i"));
        const popup = new window.maplibregl.Popup({
          offset: 18,
          closeButton: true
        }).setText("我的位置");
        state.userLocationMarker = new window.maplibregl.Marker({
          element: markerElement,
          anchor: "center"
        })
          .setLngLat([coordinate.lng, coordinate.lat])
          .setPopup(popup)
          .addTo(state.footprintMap);
        state.userLocationMarker.togglePopup();
        state.footprintMap.flyTo({
          center: [coordinate.lng, coordinate.lat],
          zoom: 13,
          duration: 900
        });
        showToast("已定位到你的当前位置。");
        finish();
      },
      (error) => {
        const reason =
          error.code === error.PERMISSION_DENIED
            ? "定位权限被拒绝，请在浏览器中允许位置访问。"
            : "暂时无法获取当前位置，请稍后重试。";
        showToast(reason);
        finish();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  function updateFootprintMapMarkers() {
    if (!state.footprintMap || !state.mapReady) return;
    state.footprintMarkers.forEach((marker) => marker.remove());
    state.footprintMarkers = [];
    state.footprintMarkerLookup.clear();
    const mapItems = state.footprints
      .filter(hasValidFootprintCoordinates)
      .map((item) => ({
        item,
        coordinate: {
          lat: parseCoordinateValue(item.lat, 90),
          lng: parseCoordinateValue(item.lng, 180)
        }
      }));
    mapItems.forEach(({ item, coordinate }) => {
      const markerElement = document.createElement("span");
      markerElement.className = "footprint-marker-wrap";
      const markerPin = document.createElement("span");
      markerPin.className = "footprint-marker";
      markerPin.append(document.createElement("i"));
      markerElement.append(markerPin);
      markerElement.addEventListener("click", (event) => {
        event.stopPropagation();
        highlightFootprintCard(item.id);
      });
      const popup = document.createElement("div");
      popup.className = "footprint-popup";
      const title = document.createElement("strong");
      title.textContent = item.title || "旅行足迹";
      const coordinateLabel = document.createElement("small");
      coordinateLabel.textContent =
        Number(item.lat).toFixed(3) + ", " + Number(item.lng).toFixed(3);
      popup.append(title, coordinateLabel);
      const marker = new window.maplibregl.Marker({
        element: markerElement,
        anchor: "bottom"
      })
        .setLngLat([coordinate.lng, coordinate.lat])
        .setPopup(
          new window.maplibregl.Popup({
            offset: 28,
            closeButton: true
          }).setDOMContent(popup)
        )
        .addTo(state.footprintMap);
      state.footprintMarkers.push(marker);
      state.footprintMarkerLookup.set(item.id, marker);
    });
    if (mapItems.length) {
      const longitudes = mapItems.map(({ coordinate }) => coordinate.lng);
      const latitudes = mapItems.map(({ coordinate }) => coordinate.lat);
      state.footprintMap.fitBounds([
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)]
      ], {
        padding: 44,
        maxZoom: 5,
        duration: 650
      });
    }
  }

  async function readPhotoGps(file) {
    try {
      await loadScriptOnce("vendor/exifr.full.umd.js");
    } catch {
      return null;
    }
    if (!window.exifr) return null;

    const readers = [
      async () => {
        if (typeof window.exifr.gps !== "function") return null;
        return coordinatesFromExif(await window.exifr.gps(file));
      },
      async () => {
        if (typeof window.exifr.parse !== "function") return null;
        const metadata = await window.exifr.parse(file, {
          tiff: true,
          ifd0: true,
          exif: true,
          gps: true,
          translateKeys: true,
          translateValues: true,
          reviveValues: true,
          silentErrors: true,
          chunked: false
        });
        return coordinatesFromExif(metadata);
      }
    ];

    // Some HEIC files keep the EXIF block beyond exifr's fast GPS read range.
    // Retry each parser independently so one failure does not discard the other.
    for (const read of readers) {
      try {
        const coordinates = await read();
        if (coordinates) return coordinates;
      } catch {
        // Try the next parser.
      }
    }
    return null;
  }

  function coordinatesFromExif(metadata) {
    if (!metadata || typeof metadata !== "object") return null;
    const candidates = [
      metadata,
      metadata.gps,
      metadata.GPS,
      metadata.exif,
      metadata.ifd0
    ].filter((item) => item && typeof item === "object");

    for (const data of candidates) {
      const latitudeValue =
        data.latitude ?? data.lat ?? data.GPSLatitude;
      const longitudeValue =
        data.longitude ?? data.lng ?? data.lon ?? data.GPSLongitude;
      const latitudeRef = String(
        data.GPSLatitudeRef ?? data.latitudeRef ?? ""
      ).toUpperCase();
      const longitudeRef = String(
        data.GPSLongitudeRef ?? data.longitudeRef ?? ""
      ).toUpperCase();
      let latitude = parseCoordinateValue(latitudeValue, 90);
      let longitude = parseCoordinateValue(longitudeValue, 180);
      if (latitude === null || longitude === null) continue;
      if (latitudeRef.startsWith("S")) latitude = -Math.abs(latitude);
      if (longitudeRef.startsWith("W")) longitude = -Math.abs(longitude);
      if (latitude === 0 && longitude === 0) continue;
      return { lat: latitude, lng: longitude };
    }
    return null;
  }

  async function uploadFootprintPhotos(event) {
    event.preventDefault();
    if (!requireAdmin()) return;
    const files = [...($("#footprint-files").files || [])];
    const button = $("#upload-footprint-button");
    const status = $("#footprint-upload-status");
    const fallbackLat = parseCoordinateValue(
      $("#footprint-latitude").value,
      90
    );
    const fallbackLng = parseCoordinateValue(
      $("#footprint-longitude").value,
      180
    );
    const fallbackValid =
      fallbackLat !== null &&
      fallbackLng !== null &&
      !(fallbackLat === 0 && fallbackLng === 0);

    if (!files.length) {
      status.textContent = "请先选择旅行照片。";
      return;
    }
    button.disabled = true;
    status.textContent = "正在读取照片位置并处理图片...";
    const pending = [];
      let missingGpsCount = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!isImageLike(file)) continue;
        status.textContent =
          "正在读取 GPS " + (index + 1) + " / " + files.length + " · " +
          file.name;
        const gps = await readPhotoGps(file);
        if (!gps && !fallbackValid) missingGpsCount += 1;
        const media = await createMediaItem(file);
        pending.push({
          id: createId("footprint"),
          title: stripFileExtension(file.name) || "旅行照片 " + (index + 1),
          createdAt: new Date().toISOString(),
          lat: gps?.lat ?? (fallbackValid ? fallbackLat : null),
          lng: gps?.lng ?? (fallbackValid ? fallbackLng : null),
          media
        });
      }
      if (!pending.length) throw new Error("没有可上传的图片文件");
      state.pendingFootprintItems = pending;
      status.textContent = "正在将 " + pending.length + " 张照片发布到 GitHub...";
      await publishSharedContent("Upload footprint photos");
      closeDialogAnimated($("#footprint-upload-dialog"));
      renderFootprints();
      ensureFootprintsMap();
      status.textContent = "足迹照片已发布。";
      showToast(
        missingGpsCount
          ? "足迹照片已上传；其中 " +
              missingGpsCount +
              " 张未读取到 GPS 位置。"
          : "足迹照片已上传。"
      );
    } catch (error) {
      state.pendingFootprintItems = [];
      status.textContent = "上传失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  }

  function setupDeck() {
    $("#deck-upload-form").addEventListener("submit", uploadDeck);
    $("#deck-library-toggle").addEventListener("click", toggleDeckLibrary);
    $("#deck-library-close").addEventListener("click", closeDeckLibrary);
    $("#deck-drawer-backdrop").addEventListener("click", closeDeckLibrary);
    $("#deck-search").addEventListener("input", renderDeckLibrary);
    $("#deck-files").addEventListener("change", () => {
      const count = $("#deck-files").files?.length || 0;
      $("#deck-file-label").textContent = count
        ? "已选择 " + count + " 个文件"
        : "选择 PPTX 或逐页图片";
    });
    $("#slide-prev").addEventListener("click", () => changeSlide(-1));
    $("#slide-next").addEventListener("click", () => changeSlide(1));
    $("#slide-jump-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        jumpToSlide(Number(event.currentTarget.value));
      }
    });
    $("#slide-jump-button").addEventListener("click", () => {
      jumpToSlide(Number($("#slide-jump-input").value));
    });
    $("#deck-fullscreen-button").addEventListener(
      "click",
      toggleDeckFullscreen
    );
    $("#deck-autoplay-button").addEventListener(
      "click",
      toggleDeckAutoplay
    );
    document.addEventListener("fullscreenchange", updateDeckFullscreenUi);
    document.addEventListener(
      "webkitfullscreenchange",
      updateDeckFullscreenUi
    );
    document.addEventListener("pointermove", handleDeckFullscreenPointer, {
      passive: true
    });
    document.addEventListener("keydown", handleDeckKeyboardShortcut);
    $("#delete-deck").addEventListener("click", deleteCurrentDeck);
  }

  async function toggleDeckFullscreen() {
    const layout = $("#deck-layout");
    if (!layout) return;
    try {
      if (document.fullscreenElement === layout) {
        await document.exitFullscreen();
        return;
      }
      if (document.webkitFullscreenElement === layout) {
        document.webkitExitFullscreen?.();
        return;
      }
      const request =
        layout.requestFullscreen ||
        layout.webkitRequestFullscreen ||
        layout.msRequestFullscreen;
      if (!request) {
        showToast("当前浏览器不支持网页全屏。");
        return;
      }
      await request.call(layout);
    } catch {
      showToast("无法进入全屏，请检查浏览器权限。");
    }
  }

  function updateDeckFullscreenUi() {
    const layout = $("#deck-layout");
    if (!layout) return;
    const fullscreen =
      document.fullscreenElement === layout ||
      document.webkitFullscreenElement === layout;
    layout.classList.toggle("deck-controls-visible", false);
    $("#deck-fullscreen-button").textContent = fullscreen
      ? "退出全屏"
      : "全屏";
    $("#deck-fullscreen-button").setAttribute(
      "aria-pressed",
      String(fullscreen)
    );
  }

  function handleDeckFullscreenPointer(event) {
    const layout = $("#deck-layout");
    if (!layout) return;
    const fullscreen =
      document.fullscreenElement === layout ||
      document.webkitFullscreenElement === layout;
    if (!fullscreen) return;
    const nearBottom = event.clientY >= window.innerHeight - 160;
    layout.classList.toggle("deck-controls-visible", nearBottom);
  }

  function handleDeckKeyboardShortcut(event) {
    const layout = $("#deck-layout");
    const fullscreen =
      document.fullscreenElement === layout ||
      document.webkitFullscreenElement === layout;
    if (!fullscreen) return;
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      event.target?.isContentEditable
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "a" || event.key === "ArrowLeft") {
      event.preventDefault();
      changeSlide(-1);
    } else if (key === "d" || event.key === "ArrowRight") {
      event.preventDefault();
      changeSlide(1);
    }
  }

  function toggleDeckAutoplay() {
    if (state.deckAutoplayTimer) {
      stopDeckAutoplay();
      return;
    }
    const deck = currentDeck();
    if (!deck || !deck.slides.length) {
      showToast("请先选择一份日常总结。");
      return;
    }
    if (deck.slides.length < 2) {
      showToast("当前总结只有一页，无需自动放映。");
      return;
    }
    state.deckAutoplayTimer = window.setInterval(() => {
      const activeDeck = currentDeck();
      if (!activeDeck?.slides.length) {
        stopDeckAutoplay();
        return;
      }
      state.currentSlide =
        state.currentSlide >= activeDeck.slides.length - 1
          ? 0
          : state.currentSlide + 1;
      renderSlide();
    }, 10000);
    $("#deck-autoplay-button").textContent = "取消自动放映";
    $("#deck-autoplay-button").classList.add("active");
    $("#deck-autoplay-button").setAttribute("aria-pressed", "true");
    showToast("自动放映已开启，每 10 秒切换一页。");
  }

  function stopDeckAutoplay() {
    if (state.deckAutoplayTimer) {
      window.clearInterval(state.deckAutoplayTimer);
      state.deckAutoplayTimer = null;
    }
    const button = $("#deck-autoplay-button");
    if (button) {
      button.textContent = "自动放映";
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    }
  }

  function restartDeckAutoplay() {
    if (!state.deckAutoplayTimer) return;
    window.clearInterval(state.deckAutoplayTimer);
    const deck = currentDeck();
    if (!deck?.slides.length) {
      stopDeckAutoplay();
      return;
    }
    state.deckAutoplayTimer = window.setInterval(() => {
      const activeDeck = currentDeck();
      if (!activeDeck?.slides.length) {
        stopDeckAutoplay();
        return;
      }
      state.currentSlide =
        state.currentSlide >= activeDeck.slides.length - 1
          ? 0
          : state.currentSlide + 1;
      renderSlide();
    }, 10000);
  }

  function toggleDeckLibrary() {
    const layout = $("#deck-layout");
    const open = !layout.classList.contains("deck-library-open");
    layout.classList.toggle("deck-library-open", open);
    $("#deck-sidebar").setAttribute("aria-hidden", String(!open));
    $("#deck-library-toggle").setAttribute("aria-expanded", String(open));
  }

  function closeDeckLibrary() {
    const layout = $("#deck-layout");
    if (!layout) return;
    layout.classList.remove("deck-library-open");
    $("#deck-sidebar").setAttribute("aria-hidden", "true");
    $("#deck-library-toggle").setAttribute("aria-expanded", "false");
  }

  function renderDeckLibrary() {
    const query = ($("#deck-search")?.value || "").trim().toLowerCase();
    const visibleDecks = query
      ? state.decks.filter((deck) => deck.name.toLowerCase().includes(query))
      : state.decks;
    $("#deck-total").textContent = query
      ? visibleDecks.length + " / " + state.decks.length
      : state.decks.length + " 本";
    const list = $("#deck-list");

    if (!state.decks.length) {
      stopDeckAutoplay();
      const empty = document.createElement("p");
      empty.className = "deck-list-empty";
      empty.textContent = "还没有上传总结。";
      list.replaceChildren(empty);
      showDeck(null);
      return;
    }

    if (!state.decks.some((deck) => deck.id === state.currentDeckId)) {
      state.currentDeckId = state.decks[0].id;
    }

    if (!visibleDecks.length) {
      const empty = document.createElement("p");
      empty.className = "deck-list-empty";
      empty.textContent = "没有找到匹配的总结册。";
      list.replaceChildren(empty);
      const current = state.decks.find((deck) => deck.id === state.currentDeckId);
      if (state.renderedDeckId !== current?.id) showDeck(current);
      return;
    }

    list.replaceChildren(
      ...visibleDecks.map((deck) => {
        const button = document.createElement("button");
        button.className = "deck-list-item" +
          (deck.id === state.currentDeckId ? " active" : "");
        button.type = "button";
        const title = document.createElement("strong");
        title.textContent = deck.name;
        const meta = document.createElement("span");
        meta.textContent =
          deck.slides.length + " 页 · " +
          new Date(deck.createdAt).toLocaleDateString("zh-CN");
        button.append(title, meta);
        button.addEventListener("click", () => {
          state.currentDeckId = deck.id;
          renderDeckLibrary();
          closeDeckLibrary();
        });
        return button;
      })
    );

    const current = state.decks.find((deck) => deck.id === state.currentDeckId);
    if (state.renderedDeckId !== current?.id) showDeck(current);
  }

  function showDeck(deck) {
    revokeUrls(state.deckUrls);
    state.deckUrls = [];
    state.currentSlide = 0;
    state.renderedDeckId = deck?.id || null;

    $("#deck-empty").hidden = Boolean(deck);
    $("#deck-stage-wrap").hidden = !deck;
    $("#delete-deck").hidden = !deck;

    if (!deck) {
      stopDeckAutoplay();
      $("#deck-stage").replaceChildren();
      $("#slide-jump-input").value = "";
      $("#slide-jump-input").max = "";
      return;
    }

    state.currentDeckId = deck.id;
    renderSlide();
  }

  async function renderSlide() {
    const deck = currentDeck();
    if (!deck || !deck.slides.length) return;
    state.currentSlide = Math.max(0, Math.min(state.currentSlide, deck.slides.length - 1));
    const slide = deck.slides[state.currentSlide];
    const renderToken = ++state.slideRenderToken;
    revokeUrls(state.deckUrls);
    state.deckUrls = [];
    const canvas = document.createElement("article");
    canvas.className = "slide-canvas image-slide";

    const slideImage = slide.images?.[0] || (slide.src ? { src: slide.src } : null);
    if (slideImage) {
      const loader = document.createElement("div");
      loader.className = "slide-page-loader";
      loader.setAttribute("role", "status");
      loader.innerHTML = "<span></span><small>正在加载页面</small>";
      canvas.setAttribute("aria-busy", "true");
      canvas.append(loader);
      $("#deck-stage").replaceChildren(canvas);

      try {
        let sourceBlob = slideImage.blob || null;
        if (!sourceBlob && slideImage.encPath) {
          if (!state.reportKey) {
            throw new Error("请先输入隐藏内容口令");
          }
          sourceBlob = await decryptReportImage(slideImage.encPath);
          slideImage.blob = sourceBlob;
        }
        if (renderToken !== state.slideRenderToken) return;
        const imageUrl = sourceBlob
          ? URL.createObjectURL(sourceBlob)
          : slideImage.src;
        if (sourceBlob) state.deckUrls.push(imageUrl);

        const image = document.createElement("img");
        image.className = "slide-page-image";
        const startedAt = performance.now();
        let revealed = false;
        const reveal = () => {
          if (revealed || renderToken !== state.slideRenderToken) return;
          revealed = true;
          const wait = Math.max(0, 160 - (performance.now() - startedAt));
          window.setTimeout(() => {
            image.classList.add("is-ready");
            loader.remove();
            canvas.setAttribute("aria-busy", "false");
          }, wait);
        };
        image.addEventListener("load", reveal, { once: true });
        image.addEventListener("error", () => {
          loader.innerHTML = "<small>页面图片加载失败</small>";
          canvas.setAttribute("aria-busy", "false");
        }, { once: true });
        image.src = imageUrl;
        image.alt = slide.title || "总结第 " + (state.currentSlide + 1) + " 页";
        canvas.append(image);
        if (image.complete && image.naturalWidth) reveal();
      } catch (error) {
        if (renderToken === state.slideRenderToken) {
          const errorText = document.createElement("small");
          errorText.textContent = error.message;
          loader.replaceChildren(errorText);
          canvas.setAttribute("aria-busy", "false");
        }
      }
    } else {
      const empty = document.createElement("div");
      empty.className = "slide-image-fallback";
      empty.innerHTML = "<span>✦</span><p>此总结册为旧版格式，请重新上传 PPTX 生成图片页面。</p>";
      canvas.append(empty);
      $("#deck-stage").replaceChildren(canvas);
    }

    activateAnimatedMedia(canvas);
    const jumpInput = $("#slide-jump-input");
    jumpInput.max = String(deck.slides.length);
    jumpInput.value = String(state.currentSlide + 1);
    $("#slide-prev").disabled = state.currentSlide === 0;
    $("#slide-next").disabled = state.currentSlide === deck.slides.length - 1;
  }

  async function decryptReportImage(path) {
    const response = await fetch(
      new URL(path, document.baseURI).href + "?v=" + Date.now(),
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error("加密报告图片加载失败");
    const decrypted = await decryptBytes(
      new Uint8Array(await response.arrayBuffer()),
      state.reportKey
    );
    return new Blob([decrypted], { type: "image/png" });
  }

  function changeSlide(direction) {
    const deck = currentDeck();
    if (!deck) return;
    const next = state.currentSlide + direction;
    if (next < 0 || next >= deck.slides.length) return;
    state.currentSlide = next;
    renderSlide();
    restartDeckAutoplay();
  }

  function jumpToSlide(page) {
    const deck = currentDeck();
    if (!deck || !Number.isInteger(page)) return;
    if (page < 1 || page > deck.slides.length) {
      showToast("请输入 1 到 " + deck.slides.length + " 之间的页码。");
      $("#slide-jump-input").value = String(state.currentSlide + 1);
      return;
    }
    state.currentSlide = page - 1;
    renderSlide();
    restartDeckAutoplay();
  }

  function currentDeck() {
    return state.decks.find((deck) => deck.id === state.currentDeckId) || null;
  }

  async function uploadDeck(event) {
    event.preventDefault();
    if (!requireAdmin()) return;
    if (!state.reportKey) {
      showToast("请先设置并解锁隐藏内容口令。");
      return;
    }
    const files = [...($("#deck-files").files || [])];
    const status = $("#deck-status");
    const button = $("#upload-deck-button");

    if (!files.length) {
      status.textContent = "请选择 .pptx 或逐页图片。";
      return;
    }

    button.disabled = true;
    status.textContent = "正在整理总结内容...";

    try {
      const pptx = files.find((file) => /\.pptx$/i.test(file.name));
      const imageFiles = files.filter((file) => isImageLike(file));
      let slides = [];
      let defaultName = "";

      if (pptx) {
        if (files.length > 1) {
          status.textContent = "检测到 PPTX，将优先解析它。";
        }
        slides = await renderPptxToImageSlides(pptx);
        defaultName = stripFileExtension(pptx.name);
      } else if (imageFiles.length) {
        const sorted = [...imageFiles].sort((a, b) =>
          a.name.localeCompare(b.name, "zh-CN", { numeric: true })
        );
        slides = [];
        for (let index = 0; index < sorted.length; index += 1) {
          const file = sorted[index];
          const displayBlob = await convertHeicBlob(file);
          slides.push({
            id: createId("slide"),
            title: stripFileExtension(file.name) || "第 " + (index + 1) + " 页",
            body: "",
            images: [{ blob: displayBlob, name: file.name }],
            imageOnly: true
          });
        }
        defaultName = stripFileExtension(sorted[0].name);
      } else {
        throw new Error("请选择 .pptx，或上传按顺序命名的逐页图片");
      }

      if (!slides.length) throw new Error("没有从文件中提取到可展示的幻灯片");

      const deck = {
        id: createId("deck"),
        name: defaultName || "生活总结",
        createdAt: new Date().toISOString(),
        slides
      };

      state.decks.unshift(deck);
      state.currentDeckId = deck.id;
      renderDeckLibrary();
      status.textContent = "正在将 " + slides.length + " 页图片发布到 GitHub...";
      try {
        await publishSharedContent("Upload report: " + deck.name, {
          includeReports: true
        });
      } catch (publishError) {
        state.decks = state.decks.filter((item) => item.id !== deck.id);
        state.currentDeckId = state.decks[0]?.id || null;
        state.renderedDeckId = null;
        renderDeckLibrary();
        throw publishError;
      }
      $("#deck-files").value = "";
      $("#deck-file-label").textContent = "选择 PPTX 或逐页图片";
      status.textContent = "总结已上传，共 " + slides.length + " 页。";
      showToast("总结册已加入放映厅。");
      closeDeckLibrary();
    } catch (error) {
      status.textContent = "上传失败：" + error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function renderPptxToImageSlides(file) {
    await loadScriptOnce("vendor/pptx-preview.umd.js");
    await loadScriptOnce("vendor/html2canvas.min.js");

    if (!window.pptxPreview?.init || typeof window.html2canvas !== "function") {
      throw new Error("PPT 图片渲染组件加载失败");
    }

    const host = document.createElement("div");
    host.className = "pptx-render-host";
    host.setAttribute("aria-hidden", "true");
    document.body.append(host);

    let previewer = null;
    try {
      previewer = window.pptxPreview.init(host, {
        width: 1280,
        height: 720,
        mode: "list"
      });
      await previewer.preview(await file.arrayBuffer());
      if (document.fonts?.ready) await document.fonts.ready;

      const slideElements = [
        ...host.querySelectorAll(".pptx-preview-slide-wrapper")
      ];
      if (!slideElements.length) {
        throw new Error("没有从 PPTX 中渲染出幻灯片");
      }

      await waitForSlideAssets(host);
      const slides = [];

      for (let index = 0; index < slideElements.length; index += 1) {
        const element = slideElements[index];
        const rendered = await window.html2canvas(element, {
          backgroundColor: "#ffffff",
          scale: 1.5,
          useCORS: false,
          logging: false,
          width: element.scrollWidth,
          height: element.scrollHeight
        });
        const blob = await canvasToBlob(rendered);
        slides.push({
          id: createId("slide"),
          title: "第 " + (index + 1) + " 页",
          images: [{ blob, name: "slide-" + (index + 1) + ".png" }],
          imageOnly: true
        });
      }

      return slides;
    } finally {
      previewer?.destroy();
      host.remove();
    }
  }

  async function waitForSlideAssets(host) {
    const pending = [...host.querySelectorAll("img")].map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        const finish = () => resolve();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 6000);
      });
    });
    await Promise.all(pending);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("无法生成幻灯片图片")),
        "image/png"
      );
    });
  }

  async function deleteCurrentDeck() {
    if (!requireAdmin()) return;
    const deck = currentDeck();
    if (!deck) return;
    if (!window.confirm("删除总结册“" + deck.name + "”吗？")) return;
    stopDeckAutoplay();
    const originalDecks = [...state.decks];
    state.decks = state.decks.filter((item) => item.id !== deck.id);
    state.currentDeckId = state.decks[0]?.id || null;
    state.renderedDeckId = null;
    renderDeckLibrary();
    try {
      await publishSharedContent("Delete report: " + deck.name, {
        includeReports: true
      });
      renderDeckLibrary();
      $("#deck-status").textContent = "总结册已删除。";
    } catch {
      state.decks = originalDecks;
      state.currentDeckId = deck.id;
      state.renderedDeckId = null;
      renderDeckLibrary();
      $("#deck-status").textContent = "删除失败，请重试。";
    }
  }

  function normalizeZipPath(path) {
    const parts = [];
    path.replace(/\\/g, "/").split("/").forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") parts.pop();
      else parts.push(part);
    });
    return parts.join("/");
  }

  function openPhotoLightbox(photo) {
    clearLightboxUrls();
    const dialog = $("#lightbox");
    $("#lightbox-title").textContent = photo.title;
    $("#lightbox-caption").textContent = photo.kind === "live"
      ? "Live Photo · 已从 LIVP 提取动态文件"
      : photo.kind === "video"
        ? "视频"
        : "照片";

    const media = createMediaNode(photo, state.lightboxUrls, false);
    $("#lightbox-media").replaceChildren(media);
    activateAnimatedMedia($("#lightbox-media"));
    $("#lightbox-downloads").replaceChildren();

    if (photo.kind === "live") {
      addDownload(
        photo.stillBlob,
        photo.title + "-still" + blobExtension(photo.stillBlob),
        "下载照片",
        photo.src
      );
      addDownload(
        photo.motionBlob,
        photo.title + "-live" + blobExtension(photo.motionBlob),
        "下载视频",
        photo.motionSrc
      );
    } else if (photo.kind === "video") {
      addDownload(
        photo.videoBlob,
        photo.title + blobExtension(photo.videoBlob),
        "下载视频",
        photo.src
      );
    } else {
      addDownload(
        photo.imageBlob,
        photo.title + blobExtension(photo.imageBlob),
        "下载照片",
        photo.src
      );
    }

    openDialog(dialog);
  }

  function addDownload(blob, name, label, remoteUrl = "") {
    if (!blob && !remoteUrl) return;
    const link = document.createElement("a");
    link.className = "download-link";
    link.href = blob
      ? registerUrl(blob, state.lightboxUrls)
      : remoteUrl;
    link.download = safeFileName(name);
    link.textContent = label;
    $("#lightbox-downloads").append(link);
  }

  function watchAdaptiveTitleContrast(media, title, hostOverride = null) {
    const host = hostOverride ||
      title?.closest(".hero-image-frame, .album-cover");
    if (!host || !media) return;

    let lastSample = 0;
    const sample = () => {
      const now = performance.now();
      if (now - lastSample < 1800) return;
      lastSample = now;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(media, 0, 0, 48, 48);
        const data = context.getImageData(0, 24, 48, 24).data;
        let weighted = 0;
        let weightTotal = 0;
        for (let index = 0; index < data.length; index += 16) {
          const alpha = data[index + 3] / 255;
          const luminance =
            (0.2126 * data[index] +
              0.7152 * data[index + 1] +
              0.0722 * data[index + 2]) /
            255;
          weighted += luminance * alpha;
          weightTotal += alpha;
        }
        const brightness = weightTotal ? weighted / weightTotal : 0.3;
        const useDarkInk = brightness > 0.67;
        host.style.setProperty(
          "--adaptive-text",
          useDarkInk ? "#102c40" : "#f7fcff"
        );
        host.style.setProperty(
          "--adaptive-shadow",
          useDarkInk
            ? "0 2px 18px rgba(244, 252, 255, 0.88)"
            : "0 3px 24px rgba(1, 9, 17, 0.82)"
        );
        host.style.setProperty(
          "--adaptive-scrim",
          useDarkInk
            ? "rgba(236, 249, 255, 0.32)"
            : "rgba(3, 13, 23, 0.72)"
        );
      } catch {
        host.style.setProperty("--adaptive-text", "#f7fcff");
        host.style.setProperty(
          "--adaptive-shadow",
          "0 3px 24px rgba(1, 9, 17, 0.82)"
        );
        host.style.setProperty("--adaptive-scrim", "rgba(3, 13, 23, 0.72)");
      }
    };

    if (media.tagName === "VIDEO") {
      const onLoaded = () => sample();
      media.addEventListener("loadeddata", onLoaded);
      media.addEventListener("timeupdate", sample);
      if (media.readyState >= 2) onLoaded();
    } else {
      const onLoaded = () => sample();
      media.addEventListener("load", onLoaded, { once: true });
      if (media.complete && media.naturalWidth) onLoaded();
    }
  }

  function clearLightboxUrls() {
    revokeUrls(state.lightboxUrls);
    state.lightboxUrls = [];
  }

  function createMediaNode(media, urlBucket, thumbnail) {
    const motionBlob = media.motionBlob || media.videoBlob || null;
    const stillBlob = media.stillBlob || media.imageBlob || null;
    const motionSource =
      media.motionSrc ||
      (media.kind === "video" ? media.src : "");
    const stillSource =
      media.kind === "live" || media.kind === "photo"
        ? media.src
        : "";

    if (motionBlob || motionSource) {
      const video = document.createElement("video");
      video.src = motionBlob
        ? registerUrl(motionBlob, urlBucket)
        : motionSource;
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.controls = !thumbnail;
      video.preload = "auto";
      video.setAttribute("muted", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("loop", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      if (stillBlob && isBrowserDisplayableImage(stillBlob)) {
        video.poster = registerUrl(stillBlob, urlBucket);
      } else if (stillSource) {
        video.poster = stillSource;
      }
      video.setAttribute("aria-label", media.title || "媒体预览");
      return video;
    }

    if (stillBlob || stillSource) {
      const image = document.createElement("img");
      const thumbBlob = thumbnail ? media.thumbnailBlob : null;
      const thumbSource = thumbnail ? media.thumbnail : "";
      image.src = thumbBlob
        ? registerUrl(thumbBlob, urlBucket)
        : thumbSource
          ? thumbSource
          : stillBlob
            ? registerUrl(stillBlob, urlBucket)
            : stillSource;
      image.alt = media.title || "照片";
      image.loading = thumbnail ? "lazy" : "eager";
      return image;
    }

    const empty = document.createElement("div");
    empty.className = "media-unavailable";
    empty.textContent = "此格式暂时无法预览";
    return empty;
  }

  function registerUrl(blob, bucket) {
    const url = URL.createObjectURL(blob);
    bucket.push(url);
    return url;
  }

  function revokeUrls(bucket) {
    bucket.forEach((url) => URL.revokeObjectURL(url));
  }

  async function createImageThumbnail(blob) {
    if (!blob || /^image\/(gif|webp|svg\+xml)$/i.test(blob.type || "")) {
      return null;
    }
    try {
      const bitmap = await createImageBitmap(blob);
      const maximumSide = 1600;
      const ratio = Math.min(
        1,
        maximumSide / Math.max(bitmap.width, bitmap.height)
      );
      if (ratio === 1 && blob.size < 450 * 1024) {
        bitmap.close?.();
        return null;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const context = canvas.getContext("2d", { alpha: false });
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();
      return await new Promise((resolve) => {
        canvas.toBlob(
          (thumbnail) => resolve(thumbnail),
          "image/jpeg",
          0.88
        );
      });
    } catch {
      return null;
    }
  }

  function activateAnimatedMedia(root = document) {
    const scope = root instanceof Element ? root : document;
    scope.querySelectorAll("video").forEach((video) => {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;

      const play = () => {
        const promise = video.play();
        if (promise?.catch) promise.catch(() => {});
      };

      if (!video.dataset.loopPlaybackBound) {
        video.dataset.loopPlaybackBound = "true";
        ["loadedmetadata", "loadeddata", "canplay"].forEach((eventName) => {
          video.addEventListener(eventName, play);
        });
      }

      if (video.readyState >= 2) {
        play();
      } else {
        video.load();
      }
    });
  }

  async function createMediaItem(file) {
    const base = {
      id: createId("photo"),
      title: stripFileExtension(file.name) || "未命名照片",
      createdAt: new Date().toISOString(),
      originalName: file.name
    };

    if (/\.livp$/i.test(file.name)) {
      const extracted = await extractLivePhoto(file);
      if (!extracted.still && !extracted.motion) {
        throw new Error("LIVP 中没有识别到照片或视频");
      }
      return {
        ...base,
        kind: extracted.motion ? "live" : "photo",
        stillBlob: extracted.still || null,
        motionBlob: extracted.motion || null,
        imageBlob: extracted.still || null,
        thumbnailBlob: extracted.still
          ? await createImageThumbnail(extracted.still)
          : null
      };
    }

    if (isImageLike(file)) {
      const displayBlob = await convertHeicBlob(file);
      return {
        ...base,
        kind: "photo",
        imageBlob: displayBlob,
        thumbnailBlob: await createImageThumbnail(displayBlob)
      };
    }
    if (isVideoLike(file)) {
      return { ...base, kind: "video", videoBlob: file };
    }
    throw new Error("不支持的格式");
  }

  async function extractLivePhoto(file) {
    const entries = await extractZipEntries(await file.arrayBuffer());
    const mediaEntries = entries.filter(
      (entry) =>
        !entry.name.startsWith("__MACOSX/") &&
        !entry.name.endsWith("/") &&
        entry.uncompressedSize < 180 * 1024 * 1024
    );
    const motionEntry = mediaEntries.find((entry) =>
      /\.(mov|mp4|m4v|webm)$/i.test(entry.name)
    );
    const stillEntry =
      mediaEntries.find((entry) => /\.(jpe?g|png|webp|avif)$/i.test(entry.name)) ||
      mediaEntries.find((entry) => /\.(heic|heif)$/i.test(entry.name));

    if (!motionEntry && !stillEntry) {
      throw new Error("没有找到 LIVP 内的照片或视频");
    }

    let still = stillEntry
      ? new Blob([stillEntry.data], { type: mimeFromFileName(stillEntry.name) })
      : null;
    if (still) {
      still = await convertHeicBlob(still, stillEntry.name);
    }

    return {
      still,
      motion: motionEntry
        ? new Blob([motionEntry.data], { type: mimeFromFileName(motionEntry.name) })
        : null
    };
  }

  async function extractZipEntries(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let eocd = -1;
    const minimum = Math.max(0, bytes.length - 22 - 0xffff);

    for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        eocd = offset;
        break;
      }
    }
    if (eocd === -1) throw new Error("文件不是可识别的 ZIP / PPTX / LIVP");

    const entryCount = view.getUint16(eocd + 10, true);
    let directoryOffset = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder("utf-8");
    const entries = [];

    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(directoryOffset, true) !== 0x02014b50) break;
      const flags = view.getUint16(directoryOffset + 8, true);
      const method = view.getUint16(directoryOffset + 10, true);
      const compressedSize = view.getUint32(directoryOffset + 20, true);
      const uncompressedSize = view.getUint32(directoryOffset + 24, true);
      const nameLength = view.getUint16(directoryOffset + 28, true);
      const extraLength = view.getUint16(directoryOffset + 30, true);
      const commentLength = view.getUint16(directoryOffset + 32, true);
      const localOffset = view.getUint32(directoryOffset + 42, true);
      const name = decoder.decode(
        bytes.slice(directoryOffset + 46, directoryOffset + 46 + nameLength)
      );

      if (!(flags & 0x0001) && view.getUint32(localOffset, true) === 0x04034b50) {
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
        const data = await inflateZipEntry(compressed, method);
        entries.push({ name: normalizeZipPath(name), data, uncompressedSize });
      }

      directoryOffset += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
  }

  async function inflateZipEntry(bytes, method) {
    if (method === 0) return bytes;
    if (method !== 8) throw new Error("不支持当前 ZIP 压缩方式");
    if (typeof DecompressionStream === "undefined") {
      throw new Error("当前浏览器不支持解压，请使用新版 Chrome / Edge / Safari");
    }
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function mimeFromFileName(name) {
    const ext = name.split(".").pop().toLowerCase();
    const types = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      avif: "image/avif",
      gif: "image/gif",
      heic: "image/heic",
      heif: "image/heif",
      mov: "video/quicktime",
      mp4: "video/mp4",
      m4v: "video/x-m4v",
      webm: "video/webm",
      svg: "image/svg+xml"
    };
    return types[ext] || "application/octet-stream";
  }

  function blobExtension(blob) {
    if (!blob) return "";
    const map = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
      "image/gif": ".gif",
      "image/heic": ".heic",
      "image/heif": ".heif",
      "video/quicktime": ".mov",
      "video/mp4": ".mp4",
      "video/x-m4v": ".m4v",
      "video/webm": ".webm"
    };
    return map[(blob.type || "").toLowerCase()] || "";
  }

  function isBrowserDisplayableImage(blob) {
    return /^image\/(jpeg|png|webp|avif|gif)$/i.test(blob.type || "");
  }

  function isImageLike(file) {
    return (
      /^image\//i.test(file.type) ||
      /\.(jpe?g|png|webp|avif|gif|heic|heif)$/i.test(file.name)
    );
  }

  function isHeicLike(fileOrName, mimeType = "") {
    const name = typeof fileOrName === "string"
      ? fileOrName
      : fileOrName?.name || "";
    const type = typeof fileOrName === "string"
      ? mimeType
      : fileOrName?.type || "";
    return /\.(heic|heif)$/i.test(name) || /^image\/hei[cf]\b/i.test(type);
  }

  async function convertHeicBlob(blob, fileName = "") {
    if (!isHeicLike(fileName || blob)) return blob;
    try {
      if (typeof window.HeicTo !== "function") {
        await loadScriptOnce("vendor/heic-to.js");
      }
      const result = await window.HeicTo({
        blob,
        type: "image/jpeg",
        quality: 0.9
      });
      return Array.isArray(result) ? result[0] : result;
    } catch (primaryError) {
      try {
        if (typeof window.heic2any !== "function") {
          await loadScriptOnce("vendor/heic2any.min.js");
        }
        const result = await window.heic2any({
          blob,
          toType: "image/jpeg",
          quality: 0.9,
          multiple: false
        });
        return Array.isArray(result) ? result[0] : result;
      } catch {
        throw new Error("该 HEIC 编码暂不受浏览器转换组件支持");
      }
    }
  }

  const loadedScripts = new Map();
  function loadScriptOnce(source) {
    if (loadedScripts.has(source)) return loadedScripts.get(source);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error("无法加载 HEIC 转换组件"));
      document.head.append(script);
    });
    loadedScripts.set(source, promise);
    return promise;
  }

  function isVideoLike(file) {
    return (
      /^video\//i.test(file.type) ||
      /\.(mp4|webm|mov|m4v)$/i.test(file.name)
    );
  }

  function stripFileExtension(name) {
    return String(name || "").replace(/\.[^.]+$/, "");
  }

  function safeFileName(name) {
    return String(name || "media")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "media";
  }

  function createId(prefix) {
    const random = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : Date.now() + "-" + Math.random().toString(16).slice(2);
    return prefix + "-" + random;
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    const token = (state.toastTranslationToken || 0) + 1;
    state.toastTranslationToken = token;
    const selectedTranslation =
      state.language && state.language !== "zh-CN"
        ? window.KERRY_I18N?.dict?.[state.language]?.[message]
        : message;
    const fallbackTranslation =
      selectedTranslation ||
      (state.language !== "zh-CN"
        ? window.KERRY_I18N?.dict?.en?.[message]
        : message);
    toast.textContent = fallbackTranslation || message;
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
    if (
      state.language &&
      state.language !== "zh-CN" &&
      !selectedTranslation &&
      typeof translateUserText === "function"
    ) {
      translateUserText(message).then((translated) => {
        if (
          token !== state.toastTranslationToken ||
          !toast.classList.contains("show") ||
          translated === message
        ) {
          return;
        }
        toast.textContent = translated;
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(
          () => toast.classList.remove("show"),
          3200
        );
      });
    }
  }

  window.addEventListener("beforeunload", () => {
    revokeUrls(state.mainUrls);
    revokeUrls(state.heroUrls);
    revokeUrls(state.avatarUrls);
    revokeUrls(state.albumUrls);
    revokeUrls(state.deckUrls);
    ensureNoLightboxLeak();
  });

  function ensureNoLightboxLeak() {
    state.lightboxUrls.forEach((url) => URL.revokeObjectURL(url));
  }
})();
