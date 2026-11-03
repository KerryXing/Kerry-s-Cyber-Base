(function () {
  "use strict";

  const DATA = window.SITE_DATA || {};
  const DB_NAME = "kerry-personal-archive";
  const DB_VERSION = 3;
  const ALBUM_STORE = "albums";
  const DECK_STORE = "decks";
  const SETTINGS_STORE = "settings";
  const GITHUB_API = "https://api.github.com";
  const THEME_META = {
    "deep-blue": { name: "深蓝", color: "#0b192a" },
    "light-blue": { name: "浅蓝", color: "#d8edf9" },
    "night-city": { name: "黑夜城市", color: "#071423" },
    gratitude: { name: "感恩", color: "#c68760" },
    christmas: { name: "圣诞", color: "#103d35" },
    "new-year": { name: "元旦", color: "#11243d" },
    "spring-festival": { name: "春节", color: "#8a1925" },
    qingming: { name: "清明", color: "#9ebfbd" },
    easter: { name: "复活节", color: "#f1dfdc" }
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
    avatarSelectionMode: false,
    selectedAvatarIds: [],
    pendingAvatarItems: [],
    photoSelectionMode: false,
    selectedPhotoIds: [],
    slideRenderToken: 0,
    reportFilePaths: new Set(),
    revealObserver: null,
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
    setupTheme();
    await populateProfile();
    setupNavigation();
    setupDialogs();
    setupRevealAnimations();
    setupDeck();
    setupGallery();
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

    $("#current-year").textContent = String(new Date().getFullYear());

    try {
      await loadSharedContent();
      await restoreReportAccess();
    } catch (error) {
      console.warn("Shared content is unavailable:", error);
      showToast("共享内容加载失败；当前显示网站默认内容。");
      await applyHeroMedia(DATA.profile?.heroMedia);
    }

    renderAlbums();
    renderDeckLibrary();
    await resumeAdminSession();
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
    const content = $("main .section-shell");
    if (!button || !content) return;
    const viewportWidth = document.documentElement.clientWidth;
    const contentRight = content.getBoundingClientRect().right;
    const blankWidth = Math.max(0, viewportWidth - contentRight);
    const buttonWidth = button.offsetWidth || 80;
    button.hidden = blankWidth < buttonWidth * 3;
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
      $("#contact-editor-dialog").close();
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
      $("#profile-editor-dialog").close();
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
      if (state.selectedHeroIds.length === 1) {
        const media = heroMediaById(state.selectedHeroIds[0]);
        if (media) selectHeroImage(media);
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
        button.className = "hero-list-item" +
          (state.selectedHeroIds.includes(key) ? " selected" : "") +
          (key === currentKey ? " in-use" : "");
        button.dataset.heroId = key;
        const preview = document.createElement("div");
        preview.className = "hero-list-preview";
        preview.append(createMediaNode(media, state.mainUrls, true));
        const label = document.createElement("span");
        label.textContent = "背景 " + String(index + 1).padStart(2, "0");
        const stateLabel = document.createElement("small");
        stateLabel.textContent =
          key === currentKey
            ? "当前使用"
            : state.selectedHeroIds.includes(key)
              ? "已选择"
              : state.heroSelectionMode
                ? "点击多选"
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

  function toggleHeroSelectionMode() {
    state.heroSelectionMode = !state.heroSelectionMode;
    state.selectedHeroIds = [];
    syncHeroSelectionUI();
  }

  function syncHeroSelectionUI() {
    $("#hero-multi-toggle").textContent = state.heroSelectionMode
      ? "退出多选"
      : "多选";
    $("#hero-set-cover").hidden = !state.heroSelectionMode;
    $("#hero-delete-button").hidden = !state.heroSelectionMode;
    $("#hero-set-cover").disabled = state.selectedHeroIds.length !== 1;
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
    });
  }

  async function selectHeroImage(media) {
    if (!requireAdmin()) return;
    const previousHero = state.sharedProfile.heroMedia;
    const previousSelectedIds = [...state.selectedHeroIds];
    state.sharedProfile.heroMedia = media;
    displayHeroMedia(media);
    statusToastInDialog("正在切换首页背景...");
    try {
      await publishSharedContent("Change homepage background");
      state.heroSelectionMode = false;
      state.selectedHeroIds = [];
      renderHeroImageList();
      showToast("首页背景已切换并发布。");
    } catch (error) {
      state.sharedProfile.heroMedia = previousHero;
      state.selectedHeroIds = previousSelectedIds;
      if (previousHero) displayHeroMedia(previousHero);
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
    const previousKey = typeof previousHero === "string"
      ? previousHero
      : previousHero?.id || previousHero?.src || "";
    const deletingCurrent = selectedIds.includes(previousKey);
    state.sharedProfile.heroImages = previousImages.filter(
      (media) => !selectedIds.includes(media.id || media.src)
    );
    const next = deletingCurrent
      ? state.sharedProfile.heroImages[0] || null
      : previousHero;
    state.sharedProfile.heroMedia = next;
    state.heroSelectionMode = false;
    state.selectedHeroIds = [];
    if (deletingCurrent) {
      if (next) displayHeroMedia(next);
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
      if (previousHero) displayHeroMedia(previousHero);
      renderHeroImageList();
      showToast("背景删除失败：" + error.message);
    }
  }

  function statusToastInDialog(message) {
    showToast(message);
  }

  function clearHeroDisplay() {
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
    const frame = $(".hero-image-frame");
    const art = $(".hero-placeholder-art");
    if (!frame || !art) return;
    revokeUrls(state.heroUrls);
    state.heroUrls = [];
    $$(".hero-site-media", frame).forEach((element) => element.remove());
    const node = createMediaNode(media, state.heroUrls, false);
    node.classList.add("hero-site-media");
    if (node.tagName === "IMG") node.alt = "";
    node.autoplay = true;
    node.muted = true;
    node.loop = true;
    node.controls = false;
    frame.insertBefore(node, art.nextSibling);
    art.hidden = true;
    watchAdaptiveTitleContrast(node, $("h1", frame));
    activateAnimatedMedia(frame);
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
      assetRoot: (configured.assetRoot || "shared").replace(/\/+$/, "")
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
      ? content.albums.map((album) => ({
          ...album,
          photos: Array.isArray(album.photos)
            ? album.photos.map((photo) => ({
                ...photo,
                kind: photo.kind || "photo"
              }))
            : []
        }))
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

    const hero = profile?.heroMedia;
    if (hero && typeof hero === "object") {
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
        window.setTimeout(() => dialog.close(), 450);
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
        setReportAccessStatus("请输入 Report 只读口令。", "error");
        return;
      }
      $("#report-unlock-button").disabled = true;
      setReportAccessStatus("正在验证并解密...");
      try {
        await unlockReport(token);
        $("#report-access-dialog").close();
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
    $("#report-nav-link").hidden = !visible;
    $("#diary").hidden = !visible;
    const trigger = $("#report-access-trigger");
    trigger.hidden = !state.isAdmin && visible;
    trigger.textContent = state.isAdmin ? "口令编辑" : "查看隐藏内容";
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
        throw new Error("管理员尚未设置日常Report访问口令。");
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
      showToast("日常Report已解锁。");
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
      $("#hidden-password-dialog").close();
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
      "这是 V0.2 旧版直接加密内容。请在本浏览器解锁一次后，V0.3 即可通过管理员 Token 自动解密。"
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
      $("#admin-dialog").close();
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
    $("#report-access-trigger").textContent = "查看隐藏内容";
    updateAdminDialog();
    const adminDialog = $("#admin-dialog");
    if (adminDialog?.open) adminDialog.close();
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
      if (options.includeReports) state.legacyDecks = [];
      state.pendingHeroMedia = null;
      state.pendingHeroItems = [];
      state.pendingAvatarMedia = null;
      state.pendingAvatarItems = [];
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
      profile.heroMedia = heroItems[0];
    }
    profile.heroImages = heroImages;

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
        coverPhotoId: album.coverPhotoId || null,
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
      version: 3,
      updatedAt: new Date().toISOString(),
      defaultTheme,
      profile,
      attributes: state.attributes,
      tagGroups: state.tagGroups,
      contactGroups: state.contactGroups,
      albums,
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
      throw new Error("请先设置并解锁日常Report只读口令");
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
    const homeToggle = $("#nav-home-toggle");
    const dropdown = $("#nav-dropdown");
    const navLinks = $$("a", dropdown);

    const closeDropdown = () => {
      dropdown.classList.remove("open");
      homeToggle.setAttribute("aria-expanded", "false");
      homeToggle.classList.remove("active");
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

    homeToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = !dropdown.classList.contains("open");
      dropdown.classList.toggle("open", isOpen);
      homeToggle.setAttribute("aria-expanded", String(isOpen));
      homeToggle.classList.toggle("active", isOpen);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".nav-dropdown-wrap")) closeDropdown();
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        closeDropdown();
        closeMobileNav();
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDropdown();
        closeMobileNav();
      }
    });

    const sections = ["home", "profile", "diary", "gallery", "contact"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            navLinks.forEach((link) => {
              link.classList.toggle(
                "active",
                link.getAttribute("href") === "#" + entry.target.id
              );
            });
            homeToggle.classList.toggle("active", entry.target.id === "home");
          });
        },
        { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
      );
      sections.forEach((section) => observer.observe(section));
    }
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
        if (dialog) dialog.close();
      });
    });

    $$(".modal").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
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
          openDialog.close();
        }
      }

    });
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    document.body.classList.add("dialog-open");
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
    $("#album-multi-toggle").addEventListener("click", toggleAlbumSelectionMode);
    $("#album-set-cover").addEventListener("click", () => {
      const album = currentAlbum();
      if (album && state.selectedPhotoIds.length === 1) {
        setAlbumCover(album, state.selectedPhotoIds[0]);
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
    const album = {
      id: createId("album"),
      name,
      displayWidth: 60,
      coverPhotoId: null,
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
      $("#create-album-dialog").close();
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
    revokeUrls(state.mainUrls);
    state.mainUrls = [];
    const list = $("#album-list");
    const empty = $("#album-empty");
    empty.hidden = state.albums.length > 0;
    list.hidden = state.albums.length === 0;

    list.replaceChildren(
      ...state.albums.map((album) => createAlbumCard(album))
    );
    observeRevealElements(list);
    activateAnimatedMedia(list);
  }

  function createAlbumCard(album) {
    const card = document.createElement("article");
    card.className = "album-card reveal";
    card.style.setProperty("--album-width", album.displayWidth + "%");
    card.dataset.albumId = album.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "打开相册：" + album.name);

    const cover = document.createElement("div");
    cover.className = "album-cover";
    const coverPhoto = getAlbumCover(album);
    if (coverPhoto) {
      const coverMedia = createMediaNode(coverPhoto, state.mainUrls, true);
      cover.append(coverMedia);
      watchAdaptiveTitleContrast(coverMedia, null, cover);
    } else {
      cover.append(createAlbumPlaceholder());
    }

    const info = document.createElement("div");
    info.className = "album-card-info";
    const title = document.createElement("h3");
    title.textContent = album.name;
    const count = document.createElement("span");
    count.textContent = album.photos.length + " 张照片";
    info.append(title, count);
    cover.append(info);

    const open = () => openAlbum(album.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });

    card.append(cover);
    return card;
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
    if (!album.photos?.length) return null;
    return (
      album.photos.find((photo) => photo.id === album.coverPhotoId) ||
      album.photos[0]
    );
  }

  function openAlbum(albumId) {
    const album = state.albums.find((item) => item.id === albumId);
    if (!album) return;
    state.currentAlbumId = album.id;
    state.photoSelectionMode = false;
    state.selectedPhotoIds = [];
    $("#album-dialog-title").textContent = album.name;
    $("#album-name-edit").value = album.name;
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
    $("#album-set-cover").disabled = count !== 1;
    $("#album-delete-photo").disabled = count === 0;
  }

  function toggleAlbumSelectionMode() {
    state.photoSelectionMode = !state.photoSelectionMode;
    state.selectedPhotoIds = [];
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

    if (album.coverPhotoId === photo.id) {
      const badge = document.createElement("span");
      badge.className = "cover-badge";
      badge.textContent = "置顶封面";
      card.append(badge);
    }

    const footer = document.createElement("div");
    footer.className = "album-photo-footer";
    const title = document.createElement("span");
    title.textContent = photo.title;
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
      renderAlbumPhotos(album);
      renderAlbums();
      status.textContent = "文件已读取，但保存失败。";
    } finally {
      button.disabled = false;
      input.value = "";
      updateAlbumFileLabel();
    }
  }

  async function setAlbumCover(album, photoId) {
    if (!requireAdmin()) return;
    const previousCover = album.coverPhotoId;
    album.coverPhotoId = photoId;
    album.updatedAt = new Date().toISOString();
    try {
      await publishSharedContent("Update album cover: " + album.name);
      state.photoSelectionMode = false;
      state.selectedPhotoIds = [];
      renderAlbumPhotos(album);
      renderAlbums();
      showToast("首页封面已发布。");
    } catch {
      album.coverPhotoId = previousCover;
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
    album.photos = album.photos.filter(
      (photo) => !selectedIds.includes(photo.id)
    );
    if (selectedIds.includes(album.coverPhotoId)) {
      album.coverPhotoId = album.photos[0]?.id || null;
    }
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
      $("#album-dialog").close();
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
    $("#delete-deck").addEventListener("click", deleteCurrentDeck);
  }

  function toggleDeckLibrary() {
    const layout = $("#deck-layout");
    const open = !layout.classList.contains("deck-library-open");
    layout.classList.toggle("deck-library-open", open);
    $("#deck-sidebar").setAttribute("aria-hidden", String(!open));
    $("#deck-library-toggle").setAttribute("aria-expanded", String(open));
  }

  function closeDeckLibrary() {
    $("#deck-layout").classList.remove("deck-library-open");
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
      $("#deck-viewer-title").textContent = "等待一本总结册";
      $("#deck-stage").replaceChildren();
      $("#slide-jump-input").value = "";
      $("#slide-jump-input").max = "";
      return;
    }

    state.currentDeckId = deck.id;
    $("#deck-viewer-title").textContent = deck.name;
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
            throw new Error("请先输入 Report 只读口令");
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
  }

  function currentDeck() {
    return state.decks.find((deck) => deck.id === state.currentDeckId) || null;
  }

  async function uploadDeck(event) {
    event.preventDefault();
    if (!requireAdmin()) return;
    if (!state.reportKey) {
      showToast("请先设置并解锁日常Report只读口令。");
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
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
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
