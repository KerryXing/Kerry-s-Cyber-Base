(function () {
  "use strict";

  const DATA = window.SITE_DATA || {};
  const DB_NAME = "kerry-personal-archive";
  const DB_VERSION = 3;
  const ALBUM_STORE = "albums";
  const DECK_STORE = "decks";
  const SETTINGS_STORE = "settings";
  const GITHUB_API = "https://api.github.com";

  const state = {
    db: null,
    albums: [],
    decks: [],
    attributes: [],
    tagGroups: [],
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
    pendingAvatarMedia: null,
    isPublishing: false,
    reportAccess: null,
    reportKey: null,
    reportSalt: null,
    reportUnlocked: false,
    selectedHeroId: "",
    selectedPhotoId: "",
    slideRenderToken: 0
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    await populateProfile();
    setupNavigation();
    setupDialogs();
    setupRevealAnimations();
    setupDeck();
    setupGallery();
    setupProfileEditor();
    setupReportAccess();
    setupVisualUploads();
    setupAdmin();
    $("#back-to-top").addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

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
    resumeAdminSession();
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

  async function populateProfile() {
    const profile = DATA.profile || {};
    state.attributes = defaultAttributes();
    state.tagGroups = defaultTagGroups();
    renderProfileContent();

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
      { id: "skills", key: "技能", value: (DATA.skills || ["绘画", "代码"]).join(" · ") }
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
          card.className = "taste-card";
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
    const avatarInput = $("#avatar-file-input");

    heroButton.addEventListener("click", () => {
      if (!requireAdmin()) return;
      const current = state.sharedProfile.heroMedia;
      state.selectedHeroId =
        typeof current === "object"
          ? current?.id || ""
          : "";
      renderHeroImageList();
      openDialog($("#hero-dialog"));
    });
    $("#hero-select-button").addEventListener("click", () => {
      const media = selectedHeroImage();
      if (media) selectHeroImage(media);
    });
    $("#hero-delete-button").addEventListener("click", deleteSelectedHeroImage);
    avatarButton.addEventListener("click", () => avatarInput.click());

    heroInput.addEventListener("change", async () => {
      const file = heroInput.files?.[0];
      if (!file || !requireAdmin()) return;
      heroButton.disabled = true;
      showToast("正在处理首页图片...");
      const previousHero = state.sharedProfile.heroMedia;
      const previousPendingHero = state.pendingHeroMedia;
      try {
        const media = await createMediaItem(file);
        state.pendingHeroMedia = media;
        displayHeroMedia(media);
        await publishSharedContent("Update homepage background");
        state.selectedHeroId = state.sharedProfile.heroMedia?.id || "";
        renderHeroImageList();
        showToast("首页背景已发布到共享网站。");
      } catch (error) {
        state.pendingHeroMedia = previousPendingHero;
        state.sharedProfile.heroMedia = previousHero;
        if (previousHero) {
          displayHeroMedia(previousHero);
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
      const file = avatarInput.files?.[0];
      if (!file || !requireAdmin()) return;
      avatarButton.disabled = true;
      showToast("正在处理头像...");
      const slot = $("[data-avatar-slot]");
      const previousBackground = slot.style.backgroundImage;
      const hadImage = slot.classList.contains("has-image");
      const previousAvatar = state.sharedProfile.avatar;
      const previousPendingAvatar = state.pendingAvatarMedia;
      try {
        const media = await createMediaItem(file);
        if (media.kind !== "photo") throw new Error("请选择静态图片作为头像");
        state.pendingAvatarMedia = media;
        displayAvatarMedia(media);
        await publishSharedContent("Update profile avatar");
        showToast("头像已发布到共享网站。");
      } catch (error) {
        state.sharedProfile.avatar = previousAvatar;
        state.pendingAvatarMedia = previousPendingAvatar;
        slot.style.backgroundImage = previousBackground;
        slot.classList.toggle("has-image", hadImage);
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
      $("#hero-select-button").disabled = true;
      $("#hero-delete-button").disabled = true;
      return;
    }

    if (!images.some((media) => (media.id || media.src) === state.selectedHeroId)) {
      state.selectedHeroId = currentKey;
    }

    list.replaceChildren(
      ...images.map((media, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "hero-list-item" +
          ((media.id || media.src) === state.selectedHeroId ? " selected" : "") +
          ((media.id || media.src) === currentKey ? " in-use" : "");
        const preview = document.createElement("div");
        preview.className = "hero-list-preview";
        preview.append(createMediaNode(media, state.mainUrls, true));
        const label = document.createElement("span");
        label.textContent = "背景 " + String(index + 1).padStart(2, "0");
        const stateLabel = document.createElement("small");
        stateLabel.textContent =
          (media.id || media.src) === currentKey
            ? "当前使用"
            : (media.id || media.src) === state.selectedHeroId
              ? "已选择"
              : "点击选择";
        button.append(preview, label, stateLabel);
        button.addEventListener("click", () => {
          state.selectedHeroId = media.id || media.src;
          renderHeroImageList();
        });
        return button;
      })
    );
    $("#hero-select-button").disabled = !state.selectedHeroId;
    $("#hero-delete-button").disabled = !state.selectedHeroId;
    activateAnimatedMedia(list);
  }

  async function selectHeroImage(media) {
    if (!requireAdmin()) return;
    const previousHero = state.sharedProfile.heroMedia;
    const previousSelectedId = state.selectedHeroId;
    state.sharedProfile.heroMedia = media;
    state.selectedHeroId = media.id || media.src || "";
    displayHeroMedia(media);
    statusToastInDialog("正在切换首页背景...");
    try {
      await publishSharedContent("Change homepage background");
      renderHeroImageList();
      showToast("首页背景已切换并发布。");
    } catch (error) {
      state.sharedProfile.heroMedia = previousHero;
      state.selectedHeroId = previousSelectedId;
      if (previousHero) displayHeroMedia(previousHero);
      renderHeroImageList();
      showToast("背景切换失败：" + error.message);
    }
  }

  function selectedHeroImage() {
    return (state.sharedProfile.heroImages || []).find(
      (media) => (media.id || media.src) === state.selectedHeroId
    ) || null;
  }

  async function deleteSelectedHeroImage() {
    if (!requireAdmin()) return;
    const selected = selectedHeroImage();
    if (!selected) return;
    if (!window.confirm("从背景列表中删除当前选中的背景吗？")) return;

    const previousImages = [...(state.sharedProfile.heroImages || [])];
    const previousHero = state.sharedProfile.heroMedia;
    const previousKey = typeof previousHero === "string"
      ? previousHero
      : previousHero?.id || previousHero?.src || "";
    const deletingCurrent = previousKey === state.selectedHeroId;
    state.sharedProfile.heroImages = previousImages.filter(
      (media) => (media.id || media.src) !== state.selectedHeroId
    );
    const next = deletingCurrent
      ? state.sharedProfile.heroImages[0] || null
      : previousHero;
    state.sharedProfile.heroMedia = next;
    state.selectedHeroId = next ? (next.id || next.src) : "";
    if (deletingCurrent && next) displayHeroMedia(next);

    try {
      await publishSharedContent("Delete homepage background");
      if (deletingCurrent && !next) {
        revokeUrls(state.heroUrls);
        state.heroUrls = [];
        $$(".hero-site-media", $(".hero-image-frame")).forEach((node) => node.remove());
        $(".hero-placeholder-art").hidden = false;
        await applyHeroMedia(DATA.profile?.heroMedia);
      }
      renderHeroImageList();
      showToast("背景删除已发布。");
    } catch (error) {
      state.sharedProfile.heroImages = previousImages;
      state.sharedProfile.heroMedia = previousHero;
      state.selectedHeroId = selected.id || selected.src || "";
      if (previousHero) displayHeroMedia(previousHero);
      renderHeroImageList();
      showToast("背景删除失败：" + error.message);
    }
  }

  function statusToastInDialog(message) {
    showToast(message);
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

  function displayHeroMedia(media) {
    const frame = $(".hero-image-frame");
    const art = $(".hero-placeholder-art");
    if (!frame || !art) return;
    revokeUrls(state.heroUrls);
    state.heroUrls = [];
    $$(".hero-site-media", frame).forEach((element) => element.remove());
    const node = createMediaNode(media, state.heroUrls, false);
    node.classList.add("hero-site-media");
    node.autoplay = true;
    node.muted = true;
    node.loop = true;
    node.controls = false;
    frame.insertBefore(node, art.nextSibling);
    art.hidden = true;
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
    await applySharedProfile(state.sharedProfile);
  }

  async function applySharedProfile(profile) {
    const avatarPath = String(profile?.avatar || "").trim();
    if (avatarPath) {
      try {
        revokeUrls(state.avatarUrls);
        state.avatarUrls = [];
        const avatarSource = await resolveImagePath(avatarPath, state.avatarUrls);
        setAvatarSource(avatarSource);
      } catch (error) {
        console.warn("Shared avatar could not be loaded:", error);
      }
    }

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
    $("#report-access-trigger").hidden = visible;
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
    if (state.reportAccess?.manifest && state.reportAccess?.salt) {
      const salt = base64ToBytes(state.reportAccess.salt);
      const key = await deriveReportKey(token, salt);
      const response = await fetch(
        new URL(state.reportAccess.manifest, document.baseURI).href +
          "?v=" + Date.now(),
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("加密的 Report 数据暂时无法加载。");

      let manifest;
      try {
        const plaintext = await decryptBytes(
          new Uint8Array(await response.arrayBuffer()),
          key
        );
        manifest = JSON.parse(new TextDecoder().decode(plaintext));
      } catch {
        throw new Error("Report 口令不正确，或加密数据已损坏。");
      }

      state.reportKey = key;
      state.reportSalt = salt;
      state.decks = normalizeEncryptedDecks(manifest.decks || []);
      state.reportUnlocked = true;
      sessionStorage.setItem("kerry-report-token", token);
      setReportVisibility(true);
      state.currentDeckId = state.decks[0]?.id || null;
      state.renderedDeckId = null;
      renderDeckLibrary();
      if (!silent) {
        $("#diary").scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("日常Report已解锁。");
      }
      return;
    }

    if (!state.isAdmin) {
      throw new Error("管理员尚未设置日常Report访问口令。");
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveReportKey(token, salt);
    state.reportKey = key;
    state.reportSalt = salt;
    state.decks = normalizeEncryptedDecks(state.legacyDecks || []);
    state.reportUnlocked = true;
    state.currentDeckId = state.decks[0]?.id || null;
    sessionStorage.setItem("kerry-report-token", token);
    setReportVisibility(true);
    state.renderedDeckId = null;
    renderDeckLibrary();
    try {
      await publishSharedContent("Enable encrypted report access", {
        includeReports: true
      });
    } catch (error) {
      state.reportKey = null;
      state.reportSalt = null;
      state.decks = [];
      state.reportUnlocked = false;
      sessionStorage.removeItem("kerry-report-token");
      setReportVisibility(false);
      renderDeckLibrary();
      throw error;
    }
    if (!silent) {
      $("#diary").scrollIntoView({ behavior: "smooth", block: "start" });
      showToast("Report 加密口令已设置，旧 Report 已迁移。");
    }
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
      false,
      ["encrypt", "decrypt"]
    );
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
        throw new Error("请先关闭此窗口，点击页面底部“查看日常Report”设置解密口令，再导入旧 Report。");
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
    updateAdminDialog();
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

  async function commitRepositoryFiles(files, message) {
    let lastError = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        return await commitRepositoryFilesOnce(files, message);
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

  async function commitRepositoryFilesOnce(files, message) {
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
    try {
      const content = await buildSharedContent(files, config, options);
      files.push({
        path: config.contentPath,
        content: JSON.stringify(content, null, 2) + "\n"
      });
      await commitRepositoryFiles(files, message);
      state.sharedContent = content;
      state.sharedProfile = content.profile;
      state.reportAccess = content.reportAccess || null;
      if (options.includeReports) state.legacyDecks = [];
      state.pendingHeroMedia = null;
      state.pendingAvatarMedia = null;
      showToast("内容已发布到 GitHub，Pages 更新通常需要约一分钟。");
      return content;
    } finally {
      state.isPublishing = false;
      document.body.classList.remove("is-publishing");
    }
  }

  async function buildSharedContent(files, config, options = {}) {
    const profile = { ...(state.sharedProfile || {}) };
    const heroImages = Array.isArray(profile.heroImages)
      ? [...profile.heroImages]
      : [];
    const stamp = Date.now().toString(36);

    if (state.pendingAvatarMedia) {
      const media = state.pendingAvatarMedia;
      const avatarBlob = media.imageBlob || media.stillBlob;
      if (avatarBlob) {
        const extension = blobExtension(avatarBlob) || ".jpg";
        const path =
          config.assetRoot + "/profile/avatar-" + stamp + extension;
        files.push({ path, content: avatarBlob });
        profile.avatar = path;
      }
    }

    if (state.pendingHeroMedia) {
      const media = state.pendingHeroMedia;
      const hero = {
        id: createId("background"),
        kind: media.kind || "photo",
        createdAt: new Date().toISOString()
      };
      if (media.motionBlob) {
        const path =
          config.assetRoot + "/profile/hero-" + stamp + "-live" +
          (blobExtension(media.motionBlob) || ".mp4");
        files.push({ path, content: media.motionBlob });
        hero.motionSrc = path;
      }
      const stillBlob = media.stillBlob || media.imageBlob || media.videoBlob;
      if (stillBlob) {
        const path =
          config.assetRoot + "/profile/hero-" + stamp +
          (blobExtension(stillBlob) || ".png");
        files.push({ path, content: stillBlob });
        hero.src = path;
        const thumbnailBlob = await createImageThumbnail(stillBlob);
        if (thumbnailBlob) {
          const thumbnailPath =
            config.assetRoot + "/profile/hero-" + stamp + "-thumb.jpg";
          files.push({ path: thumbnailPath, content: thumbnailBlob });
          hero.thumbnail = thumbnailPath;
        }
      }
      heroImages.unshift(hero);
      profile.heroMedia = hero;
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

    return {
      version: 2,
      updatedAt: new Date().toISOString(),
      profile,
      attributes: state.attributes,
      tagGroups: state.tagGroups,
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
    if (!state.reportKey || !state.reportSalt) {
      throw new Error("请先设置并解锁日常Report只读口令");
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

    return {
      manifest: manifestPath,
      salt: bytesToBase64(state.reportSalt)
    };
  }

  function setupNavigation() {
    const menuButton = $("#menu-button");
    const nav = $("#site-nav");
    const navLinks = $$("a", nav);

    menuButton.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "关闭导航" : "打开导航");
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "打开导航");
      });
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
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );
    items.forEach((item) => observer.observe(item));

    window.setTimeout(() => {
      items.forEach((item) => item.classList.add("visible"));
    }, 900);
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
    $("#album-select-cover").addEventListener("click", () => {
      const album = currentAlbum();
      if (album && state.selectedPhotoId) {
        setAlbumCover(album, state.selectedPhotoId);
      }
    });
    $("#album-delete-photo").addEventListener("click", () => {
      const album = currentAlbum();
      if (album && state.selectedPhotoId) {
        deleteAlbumPhoto(album, state.selectedPhotoId);
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
    activateAnimatedMedia(list);
  }

  function createAlbumCard(album) {
    const card = document.createElement("article");
    card.className = "album-card";
    card.style.setProperty("--album-width", album.displayWidth + "%");
    card.dataset.albumId = album.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "打开相册：" + album.name);

    const cover = document.createElement("div");
    cover.className = "album-cover";
    const coverPhoto = getAlbumCover(album);
    if (coverPhoto) {
      cover.append(createMediaNode(coverPhoto, state.mainUrls, true));
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
    state.selectedPhotoId = album.coverPhotoId || album.photos[0]?.id || "";
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
    if (!album.photos.some((photo) => photo.id === state.selectedPhotoId)) {
      state.selectedPhotoId = album.coverPhotoId || album.photos[0]?.id || "";
    }
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
    const album = currentAlbum();
    const selected = Boolean(
      album && album.photos.some((photo) => photo.id === state.selectedPhotoId)
    );
    $("#album-select-cover").disabled = !selected;
    $("#album-delete-photo").disabled = !selected;
  }

  function createAlbumPhotoCard(album, photo) {
    const card = document.createElement("article");
    card.className = "album-photo-card" +
      (photo.id === state.selectedPhotoId ? " selected" : "");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "查看照片：" + photo.title);

    const media = createMediaNode(photo, state.albumUrls, true);
    card.append(media);

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
      state.selectedPhotoId = photo.id;
      $$(".album-photo-card", $("#album-photo-grid")).forEach((element) =>
        element.classList.toggle("selected", element === card)
      );
      openPhotoLightbox(photo);
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
      state.selectedPhotoId = album.coverPhotoId;
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
      state.selectedPhotoId = photoId;
      renderAlbumPhotos(album);
      renderAlbums();
      showToast("首页封面已发布。");
    } catch {
      album.coverPhotoId = previousCover;
      showToast("封面更新失败。");
    }
  }

  async function deleteAlbumPhoto(album, photoId) {
    if (!requireAdmin()) return;
    const confirmed = window.confirm("从相册中删除这张照片吗？");
    if (!confirmed) return;
    const previousPhotos = [...album.photos];
    const previousCover = album.coverPhotoId;
    album.photos = album.photos.filter((photo) => photo.id !== photoId);
    if (album.coverPhotoId === photoId) {
      album.coverPhotoId = album.photos[0]?.id || null;
    }
    album.updatedAt = new Date().toISOString();
    try {
      await publishSharedContent("Delete photo from album: " + album.name);
      state.selectedPhotoId = album.coverPhotoId || album.photos[0]?.id || "";
      renderAlbumPhotos(album);
      renderAlbums();
      showToast("照片删除已发布。");
    } catch {
      album.photos = previousPhotos;
      album.coverPhotoId = previousCover;
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
