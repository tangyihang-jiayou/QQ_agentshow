((cssText, artDataUrl, themeConfig) => {
  const STATE_KEY = "__CODEX_DREAM_SKIN_STATE__";
  const DISABLED_KEY = "__CODEX_DREAM_SKIN_DISABLED__";
  const STYLE_ID = "codex-dream-skin-style";
  const CHROME_ID = "codex-dream-skin-chrome";
  const SHELL_ATTR = "data-dream-shell";
  const ART_ATTRS = [
    "data-dream-art-wide", "data-dream-art-safe", "data-dream-task-mode",
    "data-dream-art-safe-area", "data-dream-art-task-mode", "data-dream-art-aspect",
    "data-dream-art-ready",
    "data-dream-skin-mode",
    "data-ds1907-status",
    "data-ds2007-friends",
    "data-ds2007-native-right",
    "data-ds2007-native-right-label",
    "data-ds2007-native-right-layout",
    "data-ds2007-agent-layout",
    "data-ds2007-pet-motion",
    "data-ds2007-conversation-preview",
    "data-ds2007-view",
  ];
  const VERSION = __DREAM_SKIN_VERSION_JSON__;
  const STYLE_REVISION = __DREAM_SKIN_STYLE_REVISION_JSON__;
  const THEME = themeConfig && typeof themeConfig === "object" ? themeConfig : {};
  const ART = THEME.art && typeof THEME.art === "object" ? THEME.art : {};
  const PROFILE = THEME.profile && typeof THEME.profile === "object" ? THEME.profile : {};
  const AGENT_SHOW = THEME.agentShow && typeof THEME.agentShow === "object" ? THEME.agentShow : {};
  const AGENT_LAYOUT = ["classic-chat", "workbench", "minimal"].includes(AGENT_SHOW.layout)
    ? AGENT_SHOW.layout : "classic-chat";
  const PET_MOTION = ["off", "calm", "playful"].includes(AGENT_SHOW.petMotion)
    ? AGENT_SHOW.petMotion : "calm";
  const COMPLETION_SOUND = AGENT_SHOW.completionSound !== false;
  const CONVERSATION_PREVIEW = ["real", "masked", "off"].includes(AGENT_SHOW.conversationPreview)
    ? AGENT_SHOW.conversationPreview : "real";
  const QQ_SIGNATURES = [
    "不要迷恋哥，哥只是个传说",
    "如果爱，请深爱；若不爱，请离开",
    "哥抽的不是烟，是寂寞",
    "我们是糖，甜到悲伤",
    "再牛的肖邦，也弹不出我的悲伤",
    "叶子的离开，是风的追求，还是树的不挽留",
    "45° 仰望天空，不让眼泪掉下来",
    "我颠覆整个世界，只为摆正你的倒影",
    "≒.▂ 当囿一兲，你蕞爱的吥是莪，请你一定葽骗莪",
    "莪茬怀淰，沵芣侢怀淰旳",
    "籹亽╮崾庅忍，崾庅殘忍 √",
    "這個世界納么脏，誰铕资格說悲傷 ζ",
    "︶ㄣ莣記過呿，從薪開始",
  ];
  const LEGACY_PROFILE_SIGNATURES = new Set([
    "",
    "代码有问题？找我。",
    "别迷恋姐，姐只是个传说。",
  ]);
  const configuredSignature = String(PROFILE.signature || "").trim();
  const QQ_SIGNATURE_OPTIONS = LEGACY_PROFILE_SIGNATURES.has(configuredSignature) ||
    QQ_SIGNATURES.includes(configuredSignature)
    ? QQ_SIGNATURES
    : [configuredSignature, ...QQ_SIGNATURES];
  const DEFAULT_QQ_SIGNATURE = QQ_SIGNATURE_OPTIONS[0];
  const DECORATION_DATA = THEME.decorationData && typeof THEME.decorationData === "object"
    ? THEME.decorationData : {};
  const NOTIFICATION_DATA = THEME.notificationData && typeof THEME.notificationData === "object"
    ? THEME.notificationData : {};
  const ART_METADATA = THEME.artMetadata && typeof THEME.artMetadata === "object"
    ? THEME.artMetadata : null;
  const ANALYSIS_CACHE_KEY = "__CODEX_DREAM_SKIN_ANALYSIS_CACHE__";
  const THEME_VARIABLES = [
    "--ds-bg", "--ds-panel", "--ds-panel-2", "--ds-green", "--ds-lime",
    "--ds-cyan", "--ds-purple", "--ds-text", "--ds-muted", "--ds-line",
    "--ds-bg-rgb", "--ds-panel-rgb", "--ds-panel-2-rgb", "--ds-accent-rgb",
    "--ds-accent-alt-rgb", "--ds-secondary-rgb", "--ds-highlight-rgb",
    "--ds-text-rgb", "--ds-muted-rgb", "--ds-line-rgb",
    "--dream-art-focus-x", "--dream-art-focus-y", "--dream-art-position",
    "--dream-skin-focus-x", "--dream-skin-focus-y", "--dream-skin-art-position",
    "--dream-skin-name", "--dream-skin-tagline", "--dream-skin-project-prefix",
    "--dream-skin-project-label",
    "--ds1907-assistant-avatar",
    "--ds1907-sidebar-width",
  ];
  const installToken = {};
  const existingAnalysisCache = window[ANALYSIS_CACHE_KEY];
  const analysisCache = existingAnalysisCache && typeof existingAnalysisCache.get === "function" &&
    typeof existingAnalysisCache.set === "function" ? existingAnalysisCache : new Map();
  window[ANALYSIS_CACHE_KEY] = analysisCache;
  let artAnalysis = typeof THEME.artKey === "string" ? analysisCache.get(THEME.artKey) ?? null : null;
  let analysisTimer = null;
  let samplingNativeShell = false;
  let rootObserver = null;
  const now = () => typeof performance === "object" && typeof performance.now === "function"
    ? performance.now() : Date.now();
  const metrics = {
    ensureCalls: 0,
    rootPasses: 0,
    routePasses: 0,
    layoutReads: 0,
    attributeWrites: 0,
    styleWrites: 0,
    textWrites: 0,
    analysisRuns: 0,
    analysisCacheHits: artAnalysis ? 1 : 0,
    firstEnsureMs: null,
    analysisMs: null,
  };
  window[DISABLED_KEY] = false;

  const previous = window[STATE_KEY];
  const artUrl = (() => {
    const comma = artDataUrl.indexOf(",");
    const mime = /^data:([^;,]+)/.exec(artDataUrl)?.[1] || "image/png";
    const binary = atob(artDataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  })();

  if (previous?.observer) previous.observer.disconnect();
  if (previous?.rootObserver) previous.rootObserver.disconnect();
  if (previous?.resizeObserver) previous.resizeObserver.disconnect();
  if (previous?.timer) clearInterval(previous.timer);
  if (previous?.scheduler?.timeout) clearTimeout(previous.scheduler.timeout);
  if (previous?.scheduler?.frame != null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(previous.scheduler.frame);
  }
  if (previous?.analysisTimer) clearTimeout(previous.analysisTimer);
  if (previous?.resizeHandler) window.removeEventListener("resize", previous.resizeHandler);
  previous?.cancelFrameLayout?.();
  previous?.disposeInteractions?.();
  previous?.disposeAuxiliary?.();
  if (previous?.mediaHandler && previous?.mediaQuery) {
    try { previous.mediaQuery.removeEventListener("change", previous.mediaHandler); } catch {}
  }

  const cssString = (value) => JSON.stringify(String(value ?? ""));
  const setStyleProperty = (root, name, value) => {
    if (root.style.getPropertyValue(name) !== value) {
      root.style.setProperty(name, value);
      metrics.styleWrites += 1;
    }
  };

  const setAttribute = (root, name, value) => {
    const normalized = String(value);
    if (root.getAttribute(name) !== normalized) {
      root.setAttribute(name, normalized);
      metrics.attributeWrites += 1;
    }
  };

  const setTextContent = (node, value) => {
    if (node && node.textContent !== value) {
      node.textContent = value;
      metrics.textWrites += 1;
    }
  };

  const parseRgb = (value) => {
    if (!value || value === "transparent") return null;
    const hex = String(value).trim().match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const number = Number.parseInt(hex[1], 16);
      return { r: number >> 16, g: (number >> 8) & 255, b: number & 255 };
    }
    const m = String(value).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const rgbString = (value) => {
    const rgb = parseRgb(value);
    return rgb ? `${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)}` : null;
  };

  const rgbToHex = ({ r, g, b }) => `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

  const rgbToHsl = ({ r, g, b }) => {
    const values = [r, g, b].map((value) => value / 255);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const lightness = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: lightness };
    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue;
    if (max === values[0]) hue = (values[1] - values[2]) / delta + (values[1] < values[2] ? 6 : 0);
    else if (max === values[1]) hue = (values[2] - values[0]) / delta + 2;
    else hue = (values[0] - values[1]) / delta + 4;
    return { h: hue * 60, s: saturation, l: lightness };
  };

  const hslToRgb = ({ h, s, l }) => {
    const hue = ((h % 360) + 360) % 360 / 360;
    if (s === 0) {
      const neutral = Math.round(l * 255);
      return { r: neutral, g: neutral, b: neutral };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (offset) => {
      let t = hue + offset;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return { r: channel(1 / 3) * 255, g: channel(0) * 255, b: channel(-1 / 3) * 255 };
  };

  const luminance = ({ r, g, b }) => {
    const lin = [r, g, b].map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };

  /** Detect Codex app light/dark shell for CSS branching. */
  const detectShellMode = () => {
    const root = document.documentElement;
    const body = document.body;
    const cls = `${root.className || ""} ${body?.className || ""}`.toLowerCase();

    if (/\b(dark|theme-dark|appearance-dark)\b/.test(cls)) return "dark";
    if (/\b(light|theme-light|appearance-light)\b/.test(cls)) return "light";

    const dataTheme = (
      root.getAttribute("data-theme") ||
      root.getAttribute("data-appearance") ||
      root.getAttribute("data-color-mode") ||
      body?.getAttribute("data-theme") ||
      body?.getAttribute("data-appearance") ||
      ""
    ).toLowerCase();
    if (dataTheme.includes("dark")) return "dark";
    if (dataTheme.includes("light")) return "light";

    // Radios in profile menu (if present in DOM)
    const checked = document.querySelector('input[name="appearance-theme"]:checked');
    if (checked) {
      const label = (checked.getAttribute("aria-label") || checked.value || "").toLowerCase();
      if (label.includes("暗") || label.includes("dark")) return "dark";
      if (label.includes("浅") || label.includes("light")) return "light";
      if (label.includes("系统") || label.includes("system")) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    }

    // The skin itself declares color-scheme on :root.  Once installed,
    // reading getComputedStyle(root) directly would therefore keep `auto`
    // themes locked to the previous shell mode. Temporarily remove only our
    // own root class/attribute, sample the native computed scheme, then restore
    // synchronously. Mutation records created by this probe are drained below
    // so the root observer does not schedule a redundant ensure pass.
    try {
      const hadSkin = root.classList.contains("codex-dream-skin");
      const savedShell = root.getAttribute(SHELL_ATTR);
      samplingNativeShell = true;
      if (hadSkin) root.classList.remove("codex-dream-skin");
      if (savedShell !== null) root.removeAttribute(SHELL_ATTR);
      let colorScheme = "";
      try {
        colorScheme = getComputedStyle(root).colorScheme || "";
      } finally {
        if (hadSkin) root.classList.add("codex-dream-skin");
        if (savedShell !== null) root.setAttribute(SHELL_ATTR, savedShell);
        rootObserver?.takeRecords?.();
        samplingNativeShell = false;
      }
      if (colorScheme.includes("dark") && !colorScheme.includes("light")) return "dark";
      if (colorScheme.includes("light") && !colorScheme.includes("dark")) return "light";
    } catch {
      samplingNativeShell = false;
    }

    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {}

    // Only use surface luminance before the skin owns those surfaces. Sampling
    // our own translucent layers would create route-dependent light/dark flips.
    if (!root.classList.contains("codex-dream-skin")) {
      const samples = [
        body,
        document.querySelector("main.main-surface"),
        document.querySelector("aside.app-shell-left-panel"),
      ].filter(Boolean);
      let votesLight = 0;
      let votesDark = 0;
      for (const el of samples) {
        try {
          const rgb = parseRgb(getComputedStyle(el).backgroundColor);
          if (!rgb) continue;
          const L = luminance(rgb);
          if (L >= 0.55) votesLight += 1;
          else if (L <= 0.25) votesDark += 1;
        } catch {}
      }
      if (votesLight > votesDark) return "light";
      if (votesDark > votesLight) return "dark";
    }
    return "light";
  };

  const makeAdaptivePalette = (sample, shell) => {
    const source = sample || { r: 108, g: 126, b: 136 };
    const hsl = rgbToHsl(source);
    const hue = hsl.s < 0.12 ? 214 : hsl.h;
    const saturation = clamp(hsl.s, 0.38, 0.72);
    const accent = hslToRgb({ h: hue, s: saturation, l: shell === "light" ? 0.42 : 0.66 });
    const accentAlt = hslToRgb({ h: hue + 12, s: saturation * 0.82, l: shell === "light" ? 0.52 : 0.73 });
    const secondary = hslToRgb({ h: hue - 24, s: saturation * 0.64, l: shell === "light" ? 0.56 : 0.62 });
    const highlight = hslToRgb({ h: hue + 24, s: saturation * 0.76, l: shell === "light" ? 0.36 : 0.58 });
    const neutral = (lightness, chroma = 0.08) => rgbToHex(hslToRgb({ h: hue, s: chroma, l: lightness }));
    return shell === "light" ? {
      background: neutral(0.965, 0.07),
      panel: neutral(0.987, 0.035),
      panelAlt: neutral(0.945, 0.09),
      accent: rgbToHex(accent),
      accentAlt: rgbToHex(accentAlt),
      secondary: rgbToHex(secondary),
      highlight: rgbToHex(highlight),
      text: neutral(0.13, 0.10),
      muted: neutral(0.42, 0.08),
      line: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, .24)`,
    } : {
      background: neutral(0.055, 0.045),
      panel: neutral(0.085, 0.04),
      panelAlt: neutral(0.125, 0.05),
      accent: rgbToHex(accent),
      accentAlt: rgbToHex(accentAlt),
      secondary: rgbToHex(secondary),
      highlight: rgbToHex(highlight),
      text: neutral(0.93, 0.025),
      muted: neutral(0.69, 0.03),
      line: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, .28)`,
    };
  };

  const resolvedShell = () => {
    if (THEME.appearance === "light" || THEME.appearance === "dark") return THEME.appearance;
    // Image luminance may tune accents and scrims, but auto appearance follows
    // Codex/ChatGPT (or the OS fallback) so a bright wallpaper cannot flip a
    // native dark session back to a light shell after analysis.
    return detectShellMode();
  };

  const applyTheme = (root, shell) => {
    const colors = THEME.colors || {};
    const explicit = new Set(Array.isArray(THEME.explicitColorKeys) ? THEME.explicitColorKeys : []);
    const adaptive = makeAdaptivePalette(artAnalysis?.accentRgb, shell);
    const legacyLight = !THEME.appearance && shell === "light";
    const structural = new Set(["background", "panel", "panelAlt", "text", "muted"]);
    const pick = (name) => {
      const allowExplicit = explicit.has(name) && !(legacyLight && structural.has(name));
      return allowExplicit && typeof colors[name] === "string" ? colors[name] : adaptive[name];
    };
    const accent = pick("accent");
    const accentAlt = explicit.has("accentAlt") ? pick("accentAlt") : (explicit.has("accent") ? accent : adaptive.accentAlt);
    const variables = {
      "--ds-bg": pick("background"),
      "--ds-panel": pick("panel"),
      "--ds-panel-2": pick("panelAlt"),
      "--ds-green": accent,
      "--ds-lime": accentAlt,
      "--ds-cyan": pick("secondary"),
      "--ds-purple": pick("highlight"),
      "--ds-text": pick("text"),
      "--ds-muted": pick("muted"),
      "--ds-line": explicit.has("line") && typeof colors.line === "string" ? colors.line : adaptive.line,
    };

    for (const [name, value] of Object.entries(variables)) {
      if (typeof value === "string" && value) setStyleProperty(root, name, value);
    }
    const rgbVariables = {
      "--ds-bg-rgb": variables["--ds-bg"],
      "--ds-panel-rgb": variables["--ds-panel"],
      "--ds-panel-2-rgb": variables["--ds-panel-2"],
      "--ds-accent-rgb": variables["--ds-green"],
      "--ds-accent-alt-rgb": variables["--ds-lime"],
      "--ds-secondary-rgb": variables["--ds-cyan"],
      "--ds-highlight-rgb": variables["--ds-purple"],
      "--ds-text-rgb": variables["--ds-text"],
      "--ds-muted-rgb": variables["--ds-muted"],
      "--ds-line-rgb": variables["--ds-line"],
    };
    for (const [name, value] of Object.entries(rgbVariables)) {
      const rgb = rgbString(value);
      if (rgb) setStyleProperty(root, name, rgb);
    }
    setStyleProperty(root, "--dream-skin-name", cssString(THEME.name || "Codex Dream Skin"));
    setStyleProperty(root, "--dream-skin-tagline", cssString(THEME.tagline || "Make something wonderful."));
    setStyleProperty(root, "--dream-skin-project-prefix", cssString(THEME.projectPrefix || "选择项目 · "));
    setStyleProperty(root, "--dream-skin-project-label", cssString(THEME.projectLabel || "◉  选择项目"));
  };

  const applyArtMetadata = (root) => {
    const profile = artAnalysis || ART_METADATA;
    const inferredSafe = profile?.safeArea || "center";
    const safeArea = ART.safeArea && ART.safeArea !== "auto" ? ART.safeArea : inferredSafe;
    const canonicalSafe = ["left", "right", "center", "none"].includes(safeArea)
      ? safeArea : "center";
    const focusX = typeof ART.focusX === "number" ? ART.focusX
      : profile?.focusX ?? (safeArea === "left" ? 0.72 : safeArea === "right" ? 0.28 : 0.5);
    const focusY = typeof ART.focusY === "number" ? ART.focusY : profile?.focusY ?? 0.5;
    const taskMode = ART.taskMode && ART.taskMode !== "auto"
      ? ART.taskMode : profile?.taskMode || "ambient";
    const wide = profile?.wide || false;
    const aspect = profile?.aspect || "unknown";
    const focusXValue = `${(clamp(focusX, 0, 1) * 100).toFixed(2)}%`;
    const focusYValue = `${(clamp(focusY, 0, 1) * 100).toFixed(2)}%`;

    setAttribute(root, "data-dream-art-wide", wide ? "true" : "false");
    setAttribute(root, "data-dream-art-safe", canonicalSafe);
    setAttribute(root, "data-dream-task-mode", taskMode);
    setAttribute(root, "data-dream-art-safe-area", safeArea);
    setAttribute(root, "data-dream-art-task-mode", taskMode);
    setAttribute(root, "data-dream-art-aspect", aspect);
    setAttribute(root, "data-dream-art-ready", artAnalysis ? "true" : "false");
    setStyleProperty(root, "--dream-art-focus-x", focusXValue);
    setStyleProperty(root, "--dream-art-focus-y", focusYValue);
    setStyleProperty(root, "--dream-art-position", `${focusXValue} ${focusYValue}`);
    setStyleProperty(root, "--dream-skin-focus-x", focusXValue);
    setStyleProperty(root, "--dream-skin-focus-y", focusYValue);
    setStyleProperty(root, "--dream-skin-art-position", `${focusXValue} ${focusYValue}`);
  };

  const analyzeArt = () => new Promise((resolve) => {
    const startedAt = now();
    metrics.analysisRuns += 1;
    if (typeof window.Image !== "function" || !document?.createElement) {
      metrics.analysisMs = Number((now() - startedAt).toFixed(3));
      resolve(null);
      return;
    }
    const image = new window.Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (analysisTimer) clearTimeout(analysisTimer);
      analysisTimer = null;
      metrics.analysisMs = Number((now() - startedAt).toFixed(3));
      resolve(value);
    };
    analysisTimer = setTimeout(() => finish(null), 6000);
    image.onerror = () => finish(null);
    image.onload = () => {
      try {
        const ratio = image.naturalWidth / image.naturalHeight;
        if (!Number.isFinite(ratio) || ratio <= 0) throw new Error("Invalid image dimensions");
        const maxDimension = 96;
        const width = Math.max(16, Math.round(ratio >= 1 ? maxDimension : maxDimension * ratio));
        const height = Math.max(16, Math.round(ratio >= 1 ? maxDimension / ratio : maxDimension));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext?.("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas is unavailable");
        context.drawImage(image, 0, 0, width, height);
        const data = context.getImageData(0, 0, width, height).data;
        const samples = new Array(width * height);
        const bins = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
        let lightTotal = 0;
        let count = 0;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            if (data[offset + 3] < 32) continue;
            const rgb = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
            const light = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
            const hsl = rgbToHsl(rgb);
            samples[y * width + x] = { light, saturation: hsl.s };
            lightTotal += light;
            count += 1;
            if (hsl.s >= 0.16 && hsl.l >= 0.16 && hsl.l <= 0.86) {
              const bin = bins[Math.min(23, Math.floor(hsl.h / 15))];
              const weight = hsl.s * (1 - Math.abs(hsl.l - 0.52) * 0.85);
              bin.weight += weight;
              bin.r += rgb.r * weight;
              bin.g += rgb.g * weight;
              bin.b += rgb.b * weight;
            }
          }
        }
        if (!count) throw new Error("Image has no visible pixels");
        const brightness = lightTotal / count;
        const information = (start, end) => {
          let total = 0;
          let totalSquared = 0;
          let edges = 0;
          let edgeCount = 0;
          let pixels = 0;
          for (let y = 0; y < height; y += 1) {
            for (let x = start; x < end; x += 1) {
              const sample = samples[y * width + x];
              if (!sample) continue;
              total += sample.light;
              totalSquared += sample.light * sample.light;
              pixels += 1;
              const previous = x > start ? samples[y * width + x - 1] : null;
              const above = y > 0 ? samples[(y - 1) * width + x] : null;
              if (previous) { edges += Math.abs(sample.light - previous.light); edgeCount += 1; }
              if (above) { edges += Math.abs(sample.light - above.light); edgeCount += 1; }
            }
          }
          const mean = pixels ? total / pixels : 0;
          const variance = pixels ? Math.max(0, totalSquared / pixels - mean * mean) : 1;
          return Math.sqrt(variance) * 0.58 + (edgeCount ? edges / edgeCount : 1) * 0.42;
        };
        const zoneWidth = Math.max(1, Math.floor(width * 0.38));
        const leftInformation = information(0, zoneWidth);
        const rightInformation = information(width - zoneWidth, width);
        let safeArea = "center";
        if (leftInformation < rightInformation * 0.86) safeArea = "left";
        else if (rightInformation < leftInformation * 0.86) safeArea = "right";

        let saliencyTotal = 0;
        let saliencyX = 0;
        let saliencyY = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const sample = samples[y * width + x];
            if (!sample) continue;
            const previous = x > 0 ? samples[y * width + x - 1] : null;
            const above = y > 0 ? samples[(y - 1) * width + x] : null;
            const edge = (previous ? Math.abs(sample.light - previous.light) : 0) +
              (above ? Math.abs(sample.light - above.light) : 0);
            const weight = 0.01 + Math.abs(sample.light - brightness) * 0.48 +
              sample.saturation * 0.34 + edge * 0.28;
            saliencyTotal += weight;
            saliencyX += (x + 0.5) / width * weight;
            saliencyY += (y + 0.5) / height * weight;
          }
        }
        let focusX = saliencyTotal ? saliencyX / saliencyTotal : 0.5;
        let focusY = saliencyTotal ? saliencyY / saliencyTotal : 0.5;
        if (safeArea === "left") focusX = Math.max(0.64, focusX);
        if (safeArea === "right") focusX = Math.min(0.36, focusX);
        focusX = clamp(focusX, 0.12, 0.88);
        focusY = clamp(focusY, 0.18, 0.82);

        const accentBin = bins.reduce((best, candidate) => candidate.weight > best.weight ? candidate : best, bins[0]);
        const accentRgb = accentBin.weight > 0 ? {
          r: accentBin.r / accentBin.weight,
          g: accentBin.g / accentBin.weight,
          b: accentBin.b / accentBin.weight,
        } : null;
        const aspect = ratio >= 2.25 ? "ultrawide" : ratio >= 1.45 ? "wide"
          : ratio >= 1.08 ? "landscape" : ratio >= 0.9 ? "square" : "portrait";
        finish({
          width: image.naturalWidth,
          height: image.naturalHeight,
          ratio,
          wide: ratio >= 1.75,
          aspect,
          brightness,
          shell: brightness >= 0.58 ? "light" : "dark",
          safeArea,
          focusX,
          focusY,
          taskMode: ratio >= 2.25 ? "banner" : "ambient",
          accentRgb,
        });
      } catch {
        finish(null);
      }
    };
    image.src = artUrl;
  });

  let chromeParts = null;
  let codexPetSnapshot;
  let completionSoundTimer = null;
  let completionSoundRunning = false;
  let completionSoundArmed = false;
  let completionRunCancelled = false;
  let completionRunId = 0;
  let confirmationSoundTimer = null;
  let confirmationSoundActive = false;
  let confirmationSoundRequest = null;
  let confirmationSoundRequestKey = null;
  let completionRunRoute = "";
  let completionRunAssistantKey = "";
  let chatPreviewTimer = null;
  let petMotionTimer = null;
  let petActionTimer = null;
  let notificationAudioContext = null;
  let notificationActivePlayback = null;
  let notificationStartingKind = null;
  let notificationPendingConfirmationKey = null;
  let notificationReplayPendingConfirmation = () => {};
  let notificationPlaybackId = 0;
  const notificationAudioBuffers = new Map();
  const FRIENDS_KEY = "codex-dream-skin.qq2007.friends";
  const VIEW_KEY = "codex-dream-skin.qq2007.view";
  const PET_CELEBRATE_KEY = "codex-dream-skin.qq2007.pet-celebrate";
  const COMPLETION_SOUND_PLAYED_KEY = "codex-dream-skin.qq2007.completion-sound-last-played";
  const QQ_SHOW_KEY = "codex-dream-skin.qq2007.qq-show";
  const QQ_SIGNATURE_KEY = "codex-dream-skin.qq2007.signature";
  const confirmationPlayedKeys = window.__CODEX_DREAM_SKIN_CONFIRMATION_KEYS__ instanceof Set
    ? window.__CODEX_DREAM_SKIN_CONFIRMATION_KEYS__ : new Set();
  window.__CODEX_DREAM_SKIN_CONFIRMATION_KEYS__ = confirmationPlayedKeys;
  const CODEX_PET_SELECTOR = '[data-testid="codex-avatar"][data-avatar-asset-ref]';
  const TASK_STOP_SELECTOR = 'button[aria-label="Stop"], button[aria-label="停止"]';
  // NOTIFICATION_POLICY_START
  const createNotificationPolicy = () => {
    const acceptLabels = new Set([
      "allow", "allow once", "always allow", "approve", "confirm", "continue",
      "run", "run command", "submit", "yes",
      "允许", "允许一次", "始终允许", "批准", "确认", "继续", "运行", "运行命令", "提交", "是",
    ]);
    const rejectLabels = new Set([
      "cancel", "deny", "deny and tell codex what to do differently", "no",
      "取消", "拒绝", "否",
    ]);
    const labels = new Set([...acceptLabels, ...rejectLabels]);
    const labelOf = (button) => String(button?.getAttribute?.("aria-label") || button?.textContent || "")
      .replace(/\s+/g, " ").trim().toLowerCase();
    const actionLabels = (request) => [...(request?.querySelectorAll?.("button") || [])]
      .map(labelOf).filter((label) => labels.has(label));
    const isConfirmationRequest = (request) => {
      const requestLabels = actionLabels(request);
      return requestLabels.some((label) => acceptLabels.has(label)) &&
        requestLabels.some((label) => rejectLabels.has(label));
    };
    const remember = (keys, key) => {
      if (!key) return false;
      if (keys.has(key)) return false;
      keys.add(key);
      while (keys.size > 128) keys.delete(keys.values().next().value);
      return true;
    };
    const completionShouldPlay = ({ armed, cancelled, sameRun, running, looksSuccessful }) =>
      Boolean(armed && !cancelled && sameRun && !running && looksSuccessful);
    const completionTextLooksSuccessful = (text) => {
      const prefix = String(text || "").replace(/^\s+/, "").slice(0, 120);
      if (!prefix) return false;
      if (/^(?:you stopped|stopped|cancelled|canceled|failed|error|interrupted)\b/i.test(prefix)) return false;
      // JavaScript \b is ASCII-word based and does not form a useful boundary
      // after Han characters, so Chinese failure prefixes need their own test.
      if (/^(?:已停止|已取消|失败|错误|中断)/.test(prefix)) return false;
      return true;
    };
    return {
      labels, labelOf, actionLabels, isConfirmationRequest, remember,
      completionShouldPlay, completionTextLooksSuccessful,
    };
  };
  // NOTIFICATION_POLICY_END
  const notificationPolicy = createNotificationPolicy();
  const NATIVE_RIGHT_PORTAL_SELECTOR = [
    '[data-slot="popover-content"]',
    '[data-slot="dialog-content"]',
    '[role="dialog"]',
  ].join(", ");
  const NATIVE_RIGHT_PANEL_SELECTOR = [
    "aside:not(.app-shell-left-panel):not(.ds2007-friends)",
    '[data-testid*="side-panel"]',
    '[data-testid*="review-panel"]',
  ].join(", ");
  const NATIVE_RIGHT_SIGNAL_SELECTOR = [
    '[data-slot="thread-summary-panel-section-actions"]',
    'button[aria-label="关闭审阅标签页"]',
    'button[aria-label="Close review tab"]',
  ].join(", ");
  const NATIVE_RIGHT_TOGGLE_SELECTOR = [
    'button[aria-label="切换摘要"]',
    'button[aria-label="Toggle summary"]',
    'button[aria-label="切换置顶摘要"]',
    'button[aria-label="Toggle pinned summary"]',
    'button[aria-label="切换侧边面板"]',
    'button[aria-label="切换侧面板"]',
    'button[aria-label="Toggle side panel"]',
  ].join(", ");
  const interactionBindings = [];
  const bindInteraction = (target, type, handler, marker, options) => {
    if (!target?.addEventListener || target.dataset?.[marker]) return;
    if (target.dataset) target.dataset[marker] = "true";
    target.addEventListener(type, handler, options);
    interactionBindings.push(() => {
      target.removeEventListener?.(type, handler, options);
      if (target.dataset) delete target.dataset[marker];
    });
  };
  const disposeInteractions = () => {
    while (interactionBindings.length) interactionBindings.pop()?.();
    document.querySelectorAll?.(".ds2007-context-menu")?.forEach?.((node) => node.remove?.());
  };

  // COMPOSER_SCROLL_POLICY_START
  const createComposerScrollPolicy = () => {
    const navigationKeys = new Set([
      "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp",
      "PageDown", "PageUp", "Home", "End", "Escape", "Tab",
    ]);
    const shouldProtect = ({ view, scrollTop, editable }) =>
      view === "deep" && editable === true && Number.isFinite(scrollTop) && Math.abs(scrollTop) >= 2;
    const isTextEditingKey = (key) =>
      String(key || "").length === 1 || ["Backspace", "Delete", "Enter"].includes(String(key || ""));
    const cancelsForUserIntent = ({ type, key, isComposing = false, compositionActive = false }) =>
      ["wheel", "pointerdown", "touchstart"].includes(String(type || "")) ||
      (type === "keydown" && !isComposing && !compositionActive &&
        navigationKeys.has(String(key || "")));
    return { shouldProtect, isTextEditingKey, cancelsForUserIntent };
  };
  // COMPOSER_SCROLL_POLICY_END
  const composerScrollPolicy = createComposerScrollPolicy();
  let composerScrollAnchor = null;
  let composerCompositionActive = false;
  let composerScrollReleaseTimer = null;
  const composerEditorForEvent = (event) =>
    event.target?.closest?.('.composer-surface-chrome [contenteditable="true"]') || null;
  const clearComposerScrollAnchor = () => {
    if (composerScrollReleaseTimer !== null) clearTimeout(composerScrollReleaseTimer);
    composerScrollReleaseTimer = null;
    composerScrollAnchor = null;
  };
  const captureComposerScrollAnchor = (event) => {
    const editor = composerEditorForEvent(event);
    const thread = editor?.closest?.(".thread-scroll-container");
    if (!composerScrollPolicy.shouldProtect({
      view: skinView,
      scrollTop: thread?.scrollTop,
      editable: Boolean(editor),
    })) {
      clearComposerScrollAnchor();
      return null;
    }
    if (composerScrollReleaseTimer !== null) clearTimeout(composerScrollReleaseTimer);
    composerScrollReleaseTimer = null;
    composerScrollAnchor = { thread, top: thread.scrollTop };
    return composerScrollAnchor;
  };
  const restoreComposerScrollAnchor = () => {
    const saved = composerScrollAnchor;
    if (skinView !== "deep" || !saved?.thread?.isConnected) return;
    saved.thread.scrollTop = saved.top;
  };
  const scheduleComposerScrollRestore = ({ release = false } = {}) => {
    if (!composerScrollAnchor) return;
    queueMicrotask(restoreComposerScrollAnchor);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        restoreComposerScrollAnchor();
        requestAnimationFrame(restoreComposerScrollAnchor);
      });
    }
    setTimeout(restoreComposerScrollAnchor, 0);
    setTimeout(restoreComposerScrollAnchor, 48);
    if (!release) return;
    if (composerScrollReleaseTimer !== null) clearTimeout(composerScrollReleaseTimer);
    composerScrollReleaseTimer = setTimeout(() => {
      restoreComposerScrollAnchor();
      clearComposerScrollAnchor();
    }, 96);
  };
  bindInteraction(document, "keydown", (event) => {
    if (composerScrollPolicy.cancelsForUserIntent({
      type: event.type,
      key: event.key,
      isComposing: event.isComposing,
      compositionActive: composerCompositionActive,
    })) {
      clearComposerScrollAnchor();
      return;
    }
    if (composerCompositionActive || !composerEditorForEvent(event) ||
      !composerScrollPolicy.isTextEditingKey(event.key)) return;
    captureComposerScrollAnchor(event);
  }, "qq2007ComposerScrollKeydownBound", true);
  for (const [type, marker] of [
    ["wheel", "qq2007ComposerScrollWheelBound"],
    ["pointerdown", "qq2007ComposerScrollPointerBound"],
    ["touchstart", "qq2007ComposerScrollTouchBound"],
  ]) {
    bindInteraction(document, type, (event) => {
      if (composerScrollPolicy.cancelsForUserIntent({ type: event.type })) clearComposerScrollAnchor();
    }, marker, true);
  }
  bindInteraction(document, "compositionstart", (event) => {
    composerCompositionActive = true;
    captureComposerScrollAnchor(event);
  }, "qq2007ComposerScrollStartBound", true);
  bindInteraction(document, "compositionupdate", () => {
    scheduleComposerScrollRestore();
  }, "qq2007ComposerScrollUpdateBound", true);
  bindInteraction(document, "compositionend", () => {
    composerCompositionActive = false;
    scheduleComposerScrollRestore({ release: true });
  }, "qq2007ComposerScrollEndBound", true);
  bindInteraction(document, "beforeinput", (event) => {
    if (!composerScrollAnchor) captureComposerScrollAnchor(event);
    scheduleComposerScrollRestore();
  }, "qq2007ComposerScrollBeforeInputBound", true);
  bindInteraction(document, "input", () => {
    scheduleComposerScrollRestore({ release: !composerCompositionActive });
  }, "qq2007ComposerScrollInputBound", true);

  const readStoredJson = (key, fallback) => {
    try {
      const value = window.localStorage?.getItem?.(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeStoredJson = (key, value) => {
    try { window.localStorage?.setItem?.(key, JSON.stringify(value)); } catch {}
  };
  let skinView = readStoredJson(VIEW_KEY, "deep") === "native" ? "native" : "deep";
  let qqSignature = readStoredJson(QQ_SIGNATURE_KEY, DEFAULT_QQ_SIGNATURE);
  if (!QQ_SIGNATURE_OPTIONS.includes(qqSignature)) qqSignature = DEFAULT_QQ_SIGNATURE;
  const syncQqSignature = ({ persist = false } = {}) => {
    setTextContent(chromeParts?.profileSignature, qqSignature);
    if (persist) writeStoredJson(QQ_SIGNATURE_KEY, qqSignature);
  };
  const qqLevelNumber = () => {
    const matched = String(PROFILE.level || "255").match(/\d+/);
    const parsed = Number.parseInt(matched?.[0] || "255", 10);
    return Math.min(255, Math.max(1, Number.isFinite(parsed) ? parsed : 255));
  };
  const syncQqLevel = (node) => {
    if (!node) return;
    const level = qqLevelNumber();
    let remaining = level;
    const crowns = Math.floor(remaining / 64);
    remaining %= 64;
    const suns = Math.floor(remaining / 16);
    remaining %= 16;
    const moons = Math.floor(remaining / 4);
    const stars = remaining % 4;
    const symbols = `${"♛".repeat(crowns)}${"☀".repeat(suns)}${"☾".repeat(moons)}${"★".repeat(stars)}`;
    const detail = [
      crowns && `${crowns} 皇冠`,
      suns && `${suns} 太阳`,
      moons && `${moons} 月亮`,
      stars && `${stars} 星星`,
    ].filter(Boolean).join("、");
    setTextContent(node, symbols);
    node.setAttribute?.("aria-label", `QQ 等级 ${level}：${detail}`);
    node.setAttribute?.("title", `QQ 等级 ${level}：${detail}`);
  };
  // QQ_SHOW_SELECTION_POLICY_START
  const createQqShowSelectionPolicy = () => {
    const initialSelection = ({ options, storedSelection }) => {
      const availableIds = options.map((option) => option.id);
      if (availableIds.includes(storedSelection)) return storedSelection;
      if (availableIds.includes("custom")) return "custom";
      return availableIds[0] || "custom";
    };
    return { initialSelection };
  };
  // QQ_SHOW_SELECTION_POLICY_END
  const qqShowSelectionPolicy = createQqShowSelectionPolicy();
  const QQ_SHOW_OPTIONS = [
    { id: "classic-girl", label: "经典女", data: DECORATION_DATA.qqShowClassicGirl },
    { id: "classic-boy", label: "经典男", data: DECORATION_DATA.qqShowClassicBoy },
    { id: "custom", label: "自定义", data: DECORATION_DATA.qqShow },
  ].filter((option) => option.data && (
    option.id !== "custom" || ![
      DECORATION_DATA.qqShowClassicGirl,
      DECORATION_DATA.qqShowClassicBoy,
    ].includes(option.data)
  ));
  let qqShowSelection = qqShowSelectionPolicy.initialSelection({
    options: QQ_SHOW_OPTIONS,
    storedSelection: readStoredJson(QQ_SHOW_KEY, null),
  });
  const syncQqShow = ({ persist = false } = {}) => {
    const option = QQ_SHOW_OPTIONS.find((candidate) => candidate.id === qqShowSelection) || QQ_SHOW_OPTIONS[0];
    const media = chromeParts?.qqShowMedia;
    if (!option || !media?.appendChild) return;
    const current = media.querySelector?.(":scope > img");
    if (!current || current.src !== option.data) {
      const qqShow = document.createElement("img");
      qqShow.src = option.data;
      qqShow.alt = `QQ 秀 · ${option.label}`;
      media.replaceChildren?.(qqShow);
    }
    media.dataset.qqShowSource = option.id;
    media.dataset.qqShowCustomAvailable = QQ_SHOW_OPTIONS.some((candidate) => candidate.id === "custom")
      ? "true" : "false";
    for (const button of chromeParts?.qqShowControls || []) {
      const selected = button.getAttribute?.("data-qq-show") === option.id;
      button.setAttribute?.("data-qq-show-selected", selected ? "true" : "false");
      button.setAttribute?.("aria-pressed", selected ? "true" : "false");
    }
    if (persist) writeStoredJson(QQ_SHOW_KEY, option.id);
  };

  const shortenPreview = (value, fallback) => {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) return fallback;
    const characters = Array.from(normalized);
    return characters.length > 88 ? `${characters.slice(0, 87).join("")}…` : normalized;
  };
  const topLevelMarkdownRoots = () => {
    const scope = document.querySelector?.("main.main-surface .thread-scroll-container") ||
      document.querySelector?.("main.main-surface") || document;
    return [...(scope.querySelectorAll?.('[class*="_markdownContent_"]') || [])]
    .filter((node) => !node.parentElement?.closest?.('[class*="_markdownContent_"]'));
  };
  const isUserMarkdownRoot = (node) => {
    if (node.closest?.("[data-local-conversation-user-anchor]")) return true;
    let ancestor = node.parentElement;
    for (let depth = 0; ancestor && depth < 6; depth += 1, ancestor = ancestor.parentElement) {
      if (ancestor.classList?.contains?.("items-end") && ancestor.classList?.contains?.("flex-col")) return true;
      if (ancestor.hasAttribute?.("data-turn-key")) break;
    }
    return false;
  };
  const isAssistantMarkdownRoot = (node) => {
    if (isUserMarkdownRoot(node)) return false;
    const parent = node.parentElement;
    return Boolean(parent?.classList?.contains?.("group") && parent.classList?.contains?.("min-w-0") &&
      parent.classList?.contains?.("flex-col"));
  };
  const syncConversationPreview = () => {
    if (!chromeParts) return;
    if (CONVERSATION_PREVIEW !== "real") {
      const message = CONVERSATION_PREVIEW === "masked" ? "最近消息已隐藏（隐私模式）" : "对话预览已关闭";
      setTextContent(chromeParts.chatUserMessage, message);
      setTextContent(chromeParts.chatAssistantMessage, message);
      return;
    }
    const roots = topLevelMarkdownRoots();
    const user = [...roots].reverse().find(isUserMarkdownRoot);
    const assistant = [...roots].reverse().find(isAssistantMarkdownRoot);
    setTextContent(chromeParts.chatUserMessage,
      shortenPreview(user?.textContent, "还没有最近消息"));
    setTextContent(chromeParts.chatAssistantMessage,
      shortenPreview(assistant?.textContent, "发一条消息开始聊天"));
  };
  const scheduleConversationPreview = () => {
    if (chatPreviewTimer !== null) return;
    chatPreviewTimer = setTimeout(() => {
      chatPreviewTimer = null;
      syncConversationPreview();
    }, 480);
  };

  const clearPetMotionTimers = () => {
    if (petMotionTimer !== null) clearTimeout(petMotionTimer);
    if (petActionTimer !== null) clearTimeout(petActionTimer);
    petMotionTimer = null;
    petActionTimer = null;
  };
  const reducedPetMotion = () => {
    try { return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches); } catch { return false; }
  };
  const schedulePetMotion = () => {
    const media = chromeParts?.petMedia;
    if (!media || !media.querySelector?.(":scope > img") || PET_MOTION === "off" || reducedPetMotion()) {
      clearPetMotionTimers();
      media?.removeAttribute?.("data-pet-action");
      return;
    }
    if (petMotionTimer !== null || petActionTimer !== null) return;
    const active = Boolean(document.querySelector?.(TASK_STOP_SELECTOR));
    const delay = PET_MOTION === "playful" || active
      ? 2200 + Math.random() * 3600 : 5200 + Math.random() * 6000;
    petMotionTimer = setTimeout(() => {
      petMotionTimer = null;
      const playfulActions = ["sway", "nod", "hop", "wave"];
      const activeActions = ["type", "nod", "shuffle", "wave"];
      const calmActions = ["sway", "nod", "wave", "peek"];
      const actions = active ? activeActions : PET_MOTION === "playful" ? playfulActions : calmActions;
      const action = actions[Math.floor(Math.random() * actions.length)] || "nod";
      media.setAttribute?.("data-pet-action", action);
      petActionTimer = setTimeout(() => {
        petActionTimer = null;
        media.removeAttribute?.("data-pet-action");
        schedulePetMotion();
      }, action === "hop" ? 900 : action === "type" ? 1250 : 1050);
    }, delay);
  };
  const celebratePet = () => {
    const media = chromeParts?.petMedia;
    if (!media || PET_MOTION === "off" || reducedPetMotion()) return false;
    clearPetMotionTimers();
    media.setAttribute?.("data-pet-action", "hop");
    petActionTimer = setTimeout(() => {
      petActionTimer = null;
      media.removeAttribute?.("data-pet-action");
      schedulePetMotion();
    }, 900);
    try { window.localStorage?.setItem?.(PET_CELEBRATE_KEY, String(Date.now())); } catch {}
    return true;
  };

  const notificationEligible = () => {
    if (document.visibilityState && document.visibilityState !== "visible") return false;
    if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
    return true;
  };
  const decodeNotificationBytes = (dataUrl) => {
    const comma = String(dataUrl || "").indexOf(",");
    if (comma < 0) throw new Error("Notification sound is missing its data payload");
    const binary = atob(String(dataUrl).slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  };
  // NOTIFICATION_PLAYER_START
  const flushPendingConfirmation = () => {
    if (notificationActivePlayback || notificationStartingKind) return false;
    const pendingKey = notificationPendingConfirmationKey;
    notificationPendingConfirmationKey = null;
    if (!pendingKey) return false;
    notificationReplayPendingConfirmation(pendingKey);
    return true;
  };
  const playQqNotification = async (kind, eventKey = "") => {
    const dataUrl = kind === "confirmation"
      ? NOTIFICATION_DATA.needsConfirmation : NOTIFICATION_DATA.taskComplete;
    if (!dataUrl) return false;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (typeof AudioContextCtor !== "function") return false;
    // Do not layer notifications and do not hard-stop a waveform at an
    // arbitrary non-zero sample, which can create an audible electrical click.
    if (notificationActivePlayback || notificationStartingKind) {
      // Confirmation is the higher-priority cue. Keep one current request and
      // replay it only after the active waveform has ended cleanly.
      if (kind === "confirmation" && eventKey) notificationPendingConfirmationKey = eventKey;
      return false;
    }
    const playbackId = ++notificationPlaybackId;
    notificationStartingKind = kind;
    try {
      if (!notificationAudioContext || notificationAudioContext.state === "closed") {
        notificationAudioContext = new AudioContextCtor();
      }
      const context = notificationAudioContext;
      if (context.state === "suspended") await context.resume?.();
      if (context.state === "suspended") {
        notificationStartingKind = null;
        flushPendingConfirmation();
        return false;
      }
      if (context.state === "closed") {
        notificationStartingKind = null;
        flushPendingConfirmation();
        return false;
      }
      let decoded = notificationAudioBuffers.get(kind);
      if (!decoded) {
        decoded = context.decodeAudioData(decodeNotificationBytes(dataUrl));
        notificationAudioBuffers.set(kind, decoded);
      }
      const buffer = await decoded;
      if (playbackId !== notificationPlaybackId) {
        notificationStartingKind = null;
        return false;
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      const targetGain = kind === "confirmation" ? 0.72 : 0.68;
      const startAt = context.currentTime + 0.02;
      const endAt = startAt + Math.max(0.03, Number(buffer.duration) || 0.03);
      const attackEnd = Math.min(endAt, startAt + 0.008);
      const releaseStart = Math.max(attackEnd, endAt - 0.018);
      gain.gain.cancelScheduledValues(startAt);
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(targetGain, attackEnd);
      gain.gain.setValueAtTime(targetGain, releaseStart);
      gain.gain.linearRampToValueAtTime(0, endAt);
      source.buffer = buffer;
      source.connect(gain).connect(context.destination);
      notificationStartingKind = null;
      notificationActivePlayback = { source, gain };
      source.onended = () => {
        if (notificationActivePlayback?.source !== source) return;
        try { source.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
        notificationActivePlayback = null;
        flushPendingConfirmation();
      };
      source.start(startAt);
      if (kind === "completion") {
        try { window.localStorage?.setItem?.(COMPLETION_SOUND_PLAYED_KEY, String(Date.now())); } catch {}
      }
      return true;
    } catch {
      notificationStartingKind = null;
      if (notificationActivePlayback) {
        try { notificationActivePlayback.source.disconnect(); } catch {}
        try { notificationActivePlayback.gain.disconnect(); } catch {}
        notificationActivePlayback = null;
      }
      notificationAudioBuffers.delete(kind);
      flushPendingConfirmation();
      return false;
    }
  };
  // NOTIFICATION_PLAYER_END
  // NOTIFICATION_DISPOSER_START
  const disposeNotificationRuntime = () => {
    if (completionSoundTimer !== null) clearTimeout(completionSoundTimer);
    completionSoundTimer = null;
    completionSoundArmed = false;
    completionSoundRunning = false;
    completionRunCancelled = false;
    if (confirmationSoundTimer !== null) clearTimeout(confirmationSoundTimer);
    confirmationSoundTimer = null;
    confirmationSoundActive = false;
    confirmationSoundRequest = null;
    confirmationSoundRequestKey = null;
    notificationPendingConfirmationKey = null;
    notificationStartingKind = null;
    notificationPlaybackId += 1;
    const contextToClose = notificationAudioContext;
    const activePlayback = notificationActivePlayback;
    if (activePlayback && contextToClose && contextToClose.state !== "closed") {
      const now = contextToClose.currentTime;
      try {
        const currentGain = Number(activePlayback.gain.gain.value) || 0.68;
        activePlayback.gain.gain.cancelScheduledValues(now);
        activePlayback.gain.gain.setValueAtTime(currentGain, now);
        activePlayback.gain.gain.linearRampToValueAtTime(0, now + 0.012);
        activePlayback.source.stop(now + 0.014);
      } catch {}
      setTimeout(() => {
        try { activePlayback.source.disconnect(); } catch {}
        try { activePlayback.gain.disconnect(); } catch {}
        contextToClose.close?.().catch?.(() => {});
      }, 24);
    } else {
      contextToClose?.close?.().catch?.(() => {});
    }
    notificationActivePlayback = null;
    notificationAudioContext = null;
    notificationAudioBuffers.clear();
  };
  // NOTIFICATION_DISPOSER_END

  const humanConfirmationAction = () => {
    const main = document.querySelector?.("main.main-surface");
    if (!main) return null;
    const buttons = [...(main.querySelectorAll?.("button") || [])];
    for (const button of buttons) {
      if (button.closest?.(".composer-surface-chrome, #codex-dream-skin-chrome")) continue;
      const style = typeof getComputedStyle === "function" ? getComputedStyle(button) : null;
      const box = button.getBoundingClientRect?.();
      if (style && (style.display === "none" || style.visibility === "hidden")) continue;
      if (box && (box.width <= 0 || box.height <= 0)) continue;
      const label = notificationPolicy.labelOf(button);
      if (!notificationPolicy.labels.has(label)) continue;
      const request = button.closest?.('[role="dialog"], [data-slot="dialog-content"], [data-turn-key]');
      if (!request) continue;
      if (!notificationPolicy.isConfirmationRequest(request)) continue;
      return request;
    }
    return null;
  };
  const needsHumanConfirmation = () => humanConfirmationAction();
  const privacySafeKey = (value) => {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  };
  const confirmationRequestKey = (request) => {
    if (!request) return "";
    const turnKey = request.closest?.("[data-turn-key]")?.getAttribute?.("data-turn-key") || "";
    const actions = notificationPolicy.actionLabels(request).sort().join("|");
    const promptShape = String(request.textContent || "").replace(/\s+/g, " ").trim().slice(0, 240);
    const route = String(window.location?.href || "");
    return privacySafeKey(`${route}|${turnKey}|${actions}|${promptShape}`);
  };
  const syncHumanConfirmationSound = () => {
    const request = needsHumanConfirmation();
    if (!request) {
      confirmationSoundActive = false;
      confirmationSoundRequest = null;
      confirmationSoundRequestKey = null;
      notificationPendingConfirmationKey = null;
      if (confirmationSoundTimer !== null) clearTimeout(confirmationSoundTimer);
      confirmationSoundTimer = null;
      return;
    }
    const requestKey = confirmationRequestKey(request);
    if (confirmationSoundActive && confirmationSoundRequestKey === requestKey) return;
    confirmationSoundActive = true;
    confirmationSoundRequest = request;
    confirmationSoundRequestKey = requestKey;
    if (confirmationSoundTimer !== null) clearTimeout(confirmationSoundTimer);
    confirmationSoundTimer = setTimeout(() => {
      confirmationSoundTimer = null;
      notificationReplayPendingConfirmation(requestKey);
    }, 320);
  };

  notificationReplayPendingConfirmation = (expectedKey) => {
    const currentRequest = needsHumanConfirmation();
    const currentKey = confirmationRequestKey(currentRequest);
    if (!confirmationSoundActive || !currentRequest || confirmationSoundRequestKey !== expectedKey ||
      currentKey !== expectedKey || confirmationPlayedKeys.has(currentKey) ||
      !COMPLETION_SOUND || !notificationEligible()) return false;
    playQqNotification("confirmation", currentKey).then((played) => {
      if (!played) return;
      notificationPolicy.remember(confirmationPlayedKeys, currentKey);
    });
    return true;
  };

  const assistantCompletionSnapshot = () => {
    const nodes = [...(document.querySelectorAll?.('[class*="_markdownContent_"]') || [])]
      .filter((node) => !node.parentElement?.closest?.('[class*="_markdownContent_"]') &&
        !node.closest?.("[data-local-conversation-user-anchor]"));
    const text = String(nodes.at(-1)?.textContent || "").replace(/\s+/g, " ").trim();
    return { key: privacySafeKey(text), text };
  };
  const completionLooksSuccessful = (beforeKey, route) => {
    if (String(window.location?.href || "") !== route) return false;
    const current = assistantCompletionSnapshot();
    if (!current.text || current.key === beforeKey) return false;
    return notificationPolicy.completionTextLooksSuccessful(current.text);
  };
  completionSoundRunning = Boolean(document.querySelector?.(TASK_STOP_SELECTOR));
  completionSoundArmed = completionSoundRunning;
  if (completionSoundRunning) {
    completionRunRoute = String(window.location?.href || "");
    completionRunAssistantKey = assistantCompletionSnapshot().key;
  }
  const syncCompletionSound = () => {
    const running = Boolean(document.querySelector?.(TASK_STOP_SELECTOR));
    if (running) {
      if (!completionSoundRunning) {
        completionRunId += 1;
        completionRunRoute = String(window.location?.href || "");
        completionRunAssistantKey = assistantCompletionSnapshot().key;
        completionRunCancelled = false;
      }
      completionSoundRunning = true;
      completionSoundArmed = true;
      if (completionSoundTimer !== null) clearTimeout(completionSoundTimer);
      completionSoundTimer = null;
      return;
    }
    if (completionSoundRunning && completionSoundArmed) {
      const finishedRunId = completionRunId;
      if (completionSoundTimer !== null) clearTimeout(completionSoundTimer);
      completionSoundTimer = setTimeout(() => {
        completionSoundTimer = null;
        const successful = notificationPolicy.completionShouldPlay({
          armed: completionSoundArmed,
          cancelled: completionRunCancelled,
          sameRun: completionRunId === finishedRunId,
          running: Boolean(document.querySelector?.(TASK_STOP_SELECTOR)),
          looksSuccessful: completionLooksSuccessful(completionRunAssistantKey, completionRunRoute),
        });
        completionSoundArmed = false;
        if (successful) {
          if (COMPLETION_SOUND && notificationEligible()) playQqNotification("completion");
          celebratePet();
        }
      }, 720);
    }
    completionSoundRunning = false;
  };
  bindInteraction(document, "click", (event) => {
    if (!event.target?.closest?.(TASK_STOP_SELECTOR)) return;
    completionRunCancelled = true;
    completionSoundArmed = false;
    if (completionSoundTimer !== null) clearTimeout(completionSoundTimer);
    completionSoundTimer = null;
  }, "completionStopBound", true);

  const normalizedLabel = (node) => (node?.textContent || "").replace(/\s+/g, " ").trim();
  const nativeProfileName = () => {
    const profileButton = document.querySelector?.(
      'aside.app-shell-left-panel button[aria-label="打开个人资料菜单"], ' +
      'aside.app-shell-left-panel button[aria-label="Open profile menu"]',
    );
    const value = normalizedLabel(profileButton);
    if (!value || value.length > 40 || value.includes("@") || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
      return PROFILE.nickname || "Codex 小企鹅";
    }
    return value;
  };
  const nativeRightToggles = () => [
    ...(document.querySelectorAll?.(NATIVE_RIGHT_TOGGLE_SELECTOR) || []),
  ];
  const nativeToggleScore = (candidate) => {
    const rect = candidate?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return -1;
    const style = getComputedStyle(candidate);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.01) return -1;
    return rect.right;
  };
  const nativeToggleByState = (labels, pressed) => nativeRightToggles()
    .filter((candidate) => labels.includes(candidate.getAttribute?.("aria-label")) &&
      candidate.getAttribute?.("aria-pressed") === pressed)
    .sort((left, right) => nativeToggleScore(right) - nativeToggleScore(left))[0];
  const setNativeRightVisible = (visible) => {
    const pinLabels = ["切换置顶摘要", "Toggle pinned summary"];
    const summaryLabels = ["切换摘要", "Toggle summary"];
    const sidePanelLabels = ["切换侧边面板", "切换侧面板", "Toggle side panel"];
    if (visible) {
      const summary = nativeToggleByState(summaryLabels, "false");
      const fallback = nativeToggleByState(pinLabels, "false");
      const sidePanel = nativeToggleByState(sidePanelLabels, "false");
      const toggle = summary || fallback || sidePanel;
      if (!toggle) return false;
      toggle.click?.();
      scheduleEnsure({ route: true, layout: false });
      return true;
    }
    const toggles = [
      nativeToggleByState(pinLabels, "true"),
      nativeToggleByState(summaryLabels, "true"),
      nativeToggleByState(sidePanelLabels, "true"),
    ].filter(Boolean);
    const close = visible ? null : document.querySelector?.(
      'button[aria-label="关闭审阅标签页"], button[aria-label="Close review tab"]',
    );
    if (!toggles.length && !close) return false;
    for (const toggle of toggles) toggle.click?.();
    close?.click?.();
    scheduleEnsure({ route: true, layout: false });
    return true;
  };
  const bindNativeRightToggleGuards = (root) => {
    for (const toggle of nativeRightToggles()) {
      bindInteraction(toggle, "click", () => {
        const opening = toggle.getAttribute?.("aria-pressed") !== "true";
        setAttribute(root, "data-ds2007-native-right", opening ? "open" : "closed");
        setAttribute(root, "data-ds2007-native-right-layout", opening ? "pending" : "none");
        scheduleEnsure({ route: true, layout: false });
      }, "ds2007NativeRightGuardBound", true);
    }
  };
  const readCodexPetSnapshot = () => {
    if (codexPetSnapshot !== undefined) return codexPetSnapshot;
    const source = document.querySelector?.(CODEX_PET_SELECTOR);
    const backgroundImage = source ? getComputedStyle(source).backgroundImage : "";
    codexPetSnapshot = source && backgroundImage && backgroundImage !== "none"
      ? { assetRef: source.getAttribute?.("data-avatar-asset-ref") || "codex", backgroundImage }
      : null;
    return codexPetSnapshot;
  };
  const isVisiblyOpen = (node, shellMain) => {
    const box = node?.getBoundingClientRect?.();
    const shellBox = shellMain?.getBoundingClientRect?.();
    if (!box || !shellBox || box.width <= 0 || box.height <= 0 ||
      box.right <= shellBox.left || box.left >= innerWidth ||
      box.bottom <= shellBox.top || box.top >= shellBox.bottom) return false;
    let current = node;
    while (current && current !== shellMain.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.01) return false;
      if (current === shellMain) break;
      current = current.parentElement;
    }
    return true;
  };
  const persistentNativeRightOwner = (candidate, shellMain) => {
    if (candidate.matches?.(NATIVE_RIGHT_PANEL_SELECTOR)) return candidate;
    let current = candidate.parentElement;
    while (current && current !== shellMain) {
      const box = current.getBoundingClientRect?.();
      if (box?.width >= 220 && box?.height >= 240) return current;
      current = current.parentElement;
    }
    return null;
  };
  const nativeRightLabel = (owner) => {
    if (!owner) return "环境信息";
    const signature = [
      owner.getAttribute?.("data-testid") || "",
      owner.getAttribute?.("aria-label") || "",
      String(owner.className || ""),
      normalizedLabel(owner),
    ].join(" ");
    if (/(环境|environment)/i.test(signature)) return "环境信息";
    if (/(审查|review|diff|变更)/i.test(signature)) return "代码审查";
    if (/(文件|file)/i.test(signature)) return "文件详情";
    return "Codex 信息";
  };
  const readNativeRightState = (shellMain) => {
    const summaryToggles = nativeRightToggles();
    const pinnedSummaryOpen = summaryToggles.some((toggle) =>
      /^(切换置顶摘要|Toggle pinned summary)$/.test(toggle.getAttribute?.("aria-label") || "") &&
      toggle.getAttribute?.("aria-pressed") === "true");
    const summaryExplicitlyClosed = summaryToggles.length > 0 &&
      summaryToggles.every((toggle) => toggle.getAttribute?.("aria-pressed") !== "true");
    return [
      ...(document.querySelectorAll?.(NATIVE_RIGHT_PANEL_SELECTOR) || []),
      ...(document.querySelectorAll?.(NATIVE_RIGHT_SIGNAL_SELECTOR) || []),
    ].map((candidate) => {
      if (candidate.closest?.(`#${CHROME_ID}`)) return false;
      if (summaryExplicitlyClosed &&
        candidate.matches?.('[data-slot="thread-summary-panel-section-actions"]')) return false;
      const structural = candidate.matches?.(NATIVE_RIGHT_PANEL_SELECTOR);
      const owner = persistentNativeRightOwner(candidate, shellMain);
      const box = owner?.getBoundingClientRect?.();
      return owner && isVisiblyOpen(candidate, shellMain) && isVisiblyOpen(owner, shellMain) &&
        box.width >= 220 && box.height >= 240
        ? { owner, layout: structural ? "structural" : pinnedSummaryOpen ? "pinned" : "floating" }
        : null;
    }).find(Boolean) || null;
  };
  const markNativeRightDock = (root, nativeRightState) => {
    const portal = nativeRightState?.owner?.closest?.('[data-slot="popover-content"]');
    const pinnedOwner = !portal && nativeRightState?.layout === "pinned"
      ? nativeRightState.owner : null;
    const dock = portal || pinnedOwner;
    for (const candidate of document.querySelectorAll?.("[data-ds2007-native-dock]") || []) {
      if (candidate !== dock) candidate.removeAttribute?.("data-ds2007-native-dock");
    }
    if (!dock) return;
    setAttribute(dock, "data-ds2007-native-dock", portal ? "true" : "pinned");
    if (!portal) return;
    const keepEnvironmentDockOpen = (event) => {
      const dock = document.querySelector?.('[data-ds2007-native-dock="true"]');
      const target = event.detail?.originalEvent?.target;
      if (dock && (!target || !dock.contains?.(target))) event.preventDefault?.();
    };
    bindInteraction(
      root,
      "dismissableLayer.pointerDownOutside",
      keepEnvironmentDockOpen,
      "ds2007NativeDockPointerBound",
      true,
    );
    bindInteraction(
      root,
      "dismissableLayer.focusOutside",
      keepEnvironmentDockOpen,
      "ds2007NativeDockFocusBound",
      true,
    );
  };
  const SIDEBAR_SECTIONS = new Map([
    ["置顶", "pinned"],
    ["Pinned", "pinned"],
    ["项目", "projects"],
    ["Projects", "projects"],
    ["展开显示", "expanded"],
    ["任务", "tasks"],
    ["Tasks", "tasks"],
    ["最近", "tasks"],
    ["Recents", "tasks"],
  ]);

  const clearSidebarMarker = (node) => {
    node?.classList?.remove("ds2007-toolbar-duplicate", "ds2007-project-entry", "ds2007-pinned-source", "ds2007-section-label");
    node?.removeAttribute?.("data-ds2007-project");
    node?.removeAttribute?.("data-ds2007-group");
    node?.removeAttribute?.("data-ds2007-section");
    node?.removeAttribute?.("data-ds2007-global-nav-source");
    node?.removeAttribute?.("data-ds2007-collapse-bound");
    node?.removeAttribute?.("data-ds2007-context-bound");
    node?.removeAttribute?.("data-qq2007-styled");
    node?.removeAttribute?.("data-qq2007-section");
    node?.removeAttribute?.("data-qq2007-toolbar-duplicate");
    node?.removeAttribute?.("data-qq2007-auto-expanded");
  };

  const syncRecentsEmpty = (panel) => {
    if (!panel || panel.dataset?.qq2007Section !== "tasks") return;
    const rowCount = panel.querySelectorAll?.(
      '[data-app-action-sidebar-thread-row], [role="listitem"]',
    )?.length || 0;
    let empty = panel.querySelector?.(".ds2007-recents-empty");
    if (rowCount === 0 && !empty) {
      empty = document.createElement("div");
      empty.className = "ds2007-recents-empty";
      empty.textContent = "暂无最近任务";
      empty.setAttribute("aria-live", "polite");
      panel.appendChild?.(empty);
    } else if (rowCount > 0) {
      empty?.remove?.();
    }
  };

  const styleSidebarSubtree = (node) => {
    if (!node || node.nodeType !== 1) return;
    const sidebar = node.matches?.("aside.app-shell-left-panel")
      ? node
      : node.closest?.("aside.app-shell-left-panel");
    if (!sidebar) return;
    const candidates = [];
    if (node.matches?.('button[class*="group/section-toggle"]')) candidates.push(node);
    candidates.push(...(node.querySelectorAll?.('button[class*="group/section-toggle"]') || []));
    for (const candidate of candidates) {
      const label = normalizedLabel(candidate);
      const section = SIDEBAR_SECTIONS.get(label);
      if (!section) continue;
      if (!candidate.dataset?.qq2007Styled) {
        candidate.dataset.qq2007Styled = "section";
        candidate.dataset.qq2007Section = section;
      }
      const panel = candidate.closest?.("[data-app-action-sidebar-section]");
      if (panel) {
        panel.dataset.qq2007Styled = "panel";
        panel.dataset.qq2007Section = section;
      }
      const isCollapsedRecents = section === "tasks" && /^(最近|Recents)$/i.test(label) &&
        panel?.getAttribute?.("data-app-action-sidebar-section-collapsed") === "true";
      if (isCollapsedRecents && candidate.dataset.qq2007AutoExpanded !== "true") {
        candidate.dataset.qq2007AutoExpanded = "true";
        requestAnimationFrame(() => {
          if (candidate.isConnected &&
            panel?.getAttribute?.("data-app-action-sidebar-section-collapsed") === "true") {
            candidate.click();
          }
        });
      }
      if (section === "tasks" && panel) syncRecentsEmpty(panel);
    }
    const tasksPanel = node.closest?.('[data-qq2007-section="tasks"]')
      || sidebar.querySelector?.('[data-qq2007-section="tasks"]');
    syncRecentsEmpty(tasksPanel);
    if (node === sidebar) sidebar.dataset.qq2007Styled = "sidebar";
  };

  const clearComposerMarker = (node) => {
    node?.removeAttribute?.("data-qq2007-styled");
    node?.removeAttribute?.("data-qq2007-composer-region");
    node?.removeAttribute?.("data-qq2007-composer-control");
    node?.removeAttribute?.("data-qq2007-composer-mode");
    node?.removeAttribute?.("data-qq2007-home-layout");
    node?.removeAttribute?.("data-qq2007-home-region");
  };
  const directComposerBranch = (container, node) => {
    let branch = node;
    while (branch?.parentElement && branch.parentElement !== container) branch = branch.parentElement;
    return branch?.parentElement === container ? branch : null;
  };
  // COMPOSER_RESTYLE_POLICY_START
  const createComposerRestylePolicy = () => {
    const normalized = (values) => [...(values || [])].map(String).sort();
    const sameValues = (left, right) => {
      const a = normalized(left);
      const b = normalized(right);
      return a.length === b.length && a.every((value, index) => value === b[index]);
    };
    const needsRestyle = ({ expected, current }) => {
      if (!expected || !current || expected.mode !== current.mode) return true;
      return !sameValues(expected.regions, current.regions) ||
        !sameValues(expected.controls, current.controls) ||
        !sameValues(expected.styled, current.styled);
    };
    return { needsRestyle };
  };
  // COMPOSER_RESTYLE_POLICY_END
  const composerRestylePolicy = createComposerRestylePolicy();
  const composerStyleSnapshot = (composer) => ({
    mode: composer?.dataset?.qq2007Styled === "composer"
      ? composer.dataset.qq2007ComposerMode || null
      : null,
    regions: [...(composer?.querySelectorAll?.("[data-qq2007-composer-region]") || [])]
      .map((candidate) => candidate.dataset.qq2007ComposerRegion),
    controls: [...(composer?.querySelectorAll?.("[data-qq2007-composer-control]") || [])]
      .map((candidate) => candidate.dataset.qq2007ComposerControl),
    styled: [...(composer?.querySelectorAll?.("[data-qq2007-styled]") || [])]
      .map((candidate) => candidate.dataset.qq2007Styled),
  });
  const markHomeComposerLayout = (composer) => {
    if (!composer) return;
    let stack = composer.parentElement;
    let composerBranch = null;
    let contextBranch = null;
    while (stack && stack !== document.body) {
      const children = [...(stack.children || [])];
      composerBranch = children.find((candidate) => candidate === composer || candidate.contains?.(composer));
      contextBranch = children.find((candidate) =>
        candidate.querySelector?.('[class~="group/project-selector"]'));
      if (composerBranch && contextBranch && composerBranch !== contextBranch) break;
      stack = stack.parentElement;
    }
    if (!stack || stack === document.body || !composerBranch || !contextBranch) return;
    const homeScope = composer.closest?.('[role="main"]') || document;
    const suggestionSection = homeScope.querySelector?.('[class~="group/home-suggestions"]');
    if (!suggestionSection) return;
    let layout = stack.parentElement;
    while (layout && layout !== document.body && !layout.contains?.(suggestionSection)) {
      layout = layout.parentElement;
    }
    if (!layout || layout === document.body) return;
    const suggestions = directComposerBranch(layout, suggestionSection);
    const layoutStack = directComposerBranch(layout, stack);
    if (!suggestions || !layoutStack || suggestions === layoutStack) return;
    layout.dataset.qq2007HomeLayout = "native-flow";
    for (let current = stack; current && current !== layout; current = current.parentElement) {
      current.dataset.qq2007HomeRegion = "stack";
    }
    contextBranch.dataset.qq2007HomeRegion = "context";
    suggestions.dataset.qq2007HomeRegion = "suggestions";
    composerBranch.dataset.qq2007HomeRegion = "composer";
  };
  const styleComposerSubtree = (node) => {
    if (!node || node.nodeType !== 1) return;
    const composers = new Set();
    const closest = node.matches?.(".composer-surface-chrome")
      ? node
      : node.closest?.(".composer-surface-chrome");
    if (closest) composers.add(closest);
    for (const composer of node.querySelectorAll?.(".composer-surface-chrome") || []) composers.add(composer);
    for (const composer of composers) {
      const editor = composer.querySelector?.('[contenteditable="true"]');
      const attachment = composer.querySelector?.(
        'button[aria-label="添加文件等内容"], button[aria-label="Add files and more"]',
      );
      const voice = composer.querySelector?.(
        'button[aria-label="听写"], button[aria-label="Dictate"], button[aria-label="语音"], button[aria-label="Voice"]',
      );
      const sendCandidates = [...(composer.querySelectorAll?.('button[class~="bg-token-foreground"]') || [])];
      const send = sendCandidates.find((candidate) =>
        !candidate.closest?.(".composer-attachment-surface"));
      if (!editor || !attachment || !send) continue;
      let footer = editor.parentElement;
      while (footer && footer !== composer && !(footer.contains(attachment) && footer.contains(send))) {
        footer = footer.parentElement;
      }
      if (!footer || footer === composer) continue;
      const editorRegion = directComposerBranch(footer, editor);
      const toolActions = directComposerBranch(footer, attachment);
      const actionFooter = directComposerBranch(footer, send);
      const permission = [...(toolActions?.querySelectorAll?.("button") || [])]
        .find((candidate) => candidate !== attachment);
      const model = [...(actionFooter?.querySelectorAll?.("button") || [])]
        .find((candidate) => candidate !== voice && candidate !== send);
      const attachmentSurface = composer.querySelector?.(".composer-attachment-surface");
      let attachmentTray = null;
      if (attachmentSurface) {
        let branch = attachmentSurface;
        while (branch?.parentElement && branch.parentElement !== composer &&
          !branch.parentElement.contains(editor) && !branch.parentElement.contains(attachment)) {
          branch = branch.parentElement;
        }
        if (branch?.children?.length === 1 && branch.firstElementChild?.contains?.(attachmentSurface)) {
          branch = branch.firstElementChild;
        }
        attachmentTray = branch;
      }
      attachmentTray ||= footer.parentElement?.previousElementSibling?.firstElementChild;
      if (attachmentTray && (attachmentTray.contains(editor) || attachmentTray.contains(attachment))) {
        attachmentTray = null;
      }
      const regionAssignments = [
        [footer, "footer"], [attachmentTray, "attachments"],
        [editorRegion, "editor"], [toolActions, "tool-actions"], [actionFooter, "action-footer"],
      ].filter(([candidate]) => candidate);
      const controlAssignments = [
        [attachment, "attachment"], [editor, "editor"], [permission, "permission"],
        [model, "model"], [voice, "voice"], [send, "send"],
      ].filter(([candidate]) => candidate);
      const styledAssignments = [
        [footer, "composer-footer"],
        [editorRegion, "composer-editor"], [toolActions, "composer-tool-actions"],
        [actionFooter, "composer-action-footer"],
      ].filter(([candidate]) => candidate);
      const expected = {
        mode: permission ? "codex" : "compact",
        regions: regionAssignments.map(([, region]) => region),
        controls: controlAssignments.map(([, control]) => control),
        styled: styledAssignments.map(([, value]) => value),
      };
      if (!composerRestylePolicy.needsRestyle({ expected, current: composerStyleSnapshot(composer) })) {
        const homeScope = composer.closest?.('[role="main"]');
        const homeNeedsLayout = homeScope?.querySelector?.('[class~="group/home-suggestions"]') &&
          !composer.closest?.("[data-qq2007-home-layout]");
        if (homeNeedsLayout) markHomeComposerLayout(composer);
        continue;
      }
      for (const marked of composer.querySelectorAll?.(
        '[data-qq2007-styled], [data-qq2007-composer-region], ' +
        '[data-qq2007-composer-control], [data-qq2007-composer-mode]',
      ) || []) clearComposerMarker(marked);
      clearComposerMarker(composer);
      composer.dataset.qq2007Styled = "composer";
      composer.dataset.qq2007ComposerMode = expected.mode;
      for (const [candidate, region] of regionAssignments) {
        candidate.dataset.qq2007ComposerRegion = region;
      }
      for (const [candidate, value] of styledAssignments) {
        if (!candidate) continue;
        candidate.dataset.qq2007Styled = value;
      }
      for (const [candidate, control] of controlAssignments) {
        candidate.dataset.qq2007ComposerControl = control;
      }
      markHomeComposerLayout(composer);
    }
  };

  // CONVERSATION_MEDIA_POLICY_START
  const CONVERSATION_IMAGE_SELECTOR = [
    'button[data-markdown-image-preview-trigger="true"] > img',
    '[role="button"][aria-label="User attachment"] > img',
  ].join(", ");
  const normalizeConversationMedia = (node) => {
    if (!node || node.nodeType !== 1) return;
    const images = [];
    if (node.matches?.(CONVERSATION_IMAGE_SELECTOR)) images.push(node);
    images.push(...(node.querySelectorAll?.(CONVERSATION_IMAGE_SELECTOR) || []));
    for (const image of images) {
      image.loading = "eager";
      image.decoding = "async";
      if (image.dataset) image.dataset.qq2007MediaReady = "true";
      const preview = image.closest?.(
        '[role="button"][aria-label="User attachment"], button[data-markdown-image-preview-trigger="true"]',
      );
      if (!preview) continue;
      preview.dataset.qq2007ConversationMedia = "image";
      if (preview.getAttribute?.("aria-label") !== "User attachment") continue;
      const row = preview.parentElement;
      const gallery = row?.parentElement;
      if (!row || !gallery) continue;
      const previews = [...(row.querySelectorAll?.('[role="button"][aria-label="User attachment"]') || [])];
      if (!previews.includes(preview)) continue;
      row.dataset.qq2007ConversationGalleryRow = "true";
      gallery.dataset.qq2007ConversationGallery = "true";
      gallery.dataset.qq2007ConversationCount = String(previews.length);
    }
  };
  // CONVERSATION_MEDIA_POLICY_END

  const findPrimaryNavDestination = (sidebar, label) => {
    if (!sidebar) return null;
    if (label === "聊天") {
      return sidebar.querySelector?.('button[aria-label="Quick chat"], button[aria-label="快速聊天"]') ||
        [...(sidebar.querySelectorAll?.('button, a, [role="button"]') || [])]
          .find((candidate) => ["New chat", "新建任务"].includes(normalizedLabel(candidate))) || null;
    }
    const aliases = {
      "新建任务": ["新建任务", "New chat"],
      "已安排": ["已安排", "Scheduled"],
      "插件": ["插件", "Plugins"],
      "站点": ["站点", "Sites"],
      "拉取请求": ["拉取请求", "Pull requests", "Pull Requests"],
    }[label] || [label];
    return [...(sidebar.querySelectorAll?.('button, a, [role="button"]') || [])]
      .find((candidate) => aliases.includes(normalizedLabel(candidate))) || null;
  };
  const markPrimaryNavSources = (sidebar, subtree = sidebar) => {
    if (!sidebar || !subtree) return;
    const newTask = findPrimaryNavDestination(sidebar, "新建任务");
    const newTaskHost = newTask?.parentElement || newTask;
    const candidates = [];
    if (subtree.matches?.('button, a, [role="button"]')) candidates.push(subtree);
    candidates.push(...(subtree.querySelectorAll?.('button, a, [role="button"]') || []));
    for (const destination of candidates) {
      const quickChat = ["Quick chat", "快速聊天"].includes(destination.getAttribute?.("aria-label"));
      const nativeLabel = normalizedLabel(destination);
      const label = quickChat ? "聊天" : ({
        "New chat": "新建任务",
        "Scheduled": "已安排",
        "Plugins": "插件",
        "Sites": "站点",
        "Pull requests": "拉取请求",
        "Pull Requests": "拉取请求",
      }[nativeLabel] || nativeLabel);
      if (!["新建任务", "已安排", "插件", "站点", "拉取请求", "聊天"].includes(label)) continue;
      const host = label === "新建任务" || (label === "聊天" && newTaskHost?.contains?.(destination))
        ? newTaskHost : destination;
      if (host?.dataset) host.dataset.ds2007GlobalNavSource = label;
    }
  };

  const cleanupLegacySidebarArtifacts = (sidebar) => {
    document.querySelectorAll?.(".ds2007-pinned-panel, .ds2007-context-menu, .ds2007-recents-empty")
      ?.forEach?.((node) => node.remove?.());
    for (const node of sidebar?.querySelectorAll?.(
      ".ds2007-toolbar-duplicate, .ds2007-project-entry, .ds2007-pinned-source, .ds2007-section-label, [data-qq2007-styled], [data-qq2007-toolbar-duplicate], [data-ds2007-context-bound], [data-ds2007-collapse-bound], [data-ds2007-global-nav-source]",
    ) || []) {
      clearSidebarMarker(node);
    }
    clearSidebarMarker(sidebar);
    for (const group of SIDEBAR_SECTIONS.values()) {
      document.documentElement?.removeAttribute(`data-ds2007-collapse-${group}`);
    }
    try {
      window.localStorage?.removeItem?.("codex-dream-skin.qq2007.pinned-projects");
      window.localStorage?.removeItem?.("codex-dream-skin.qq2007.collapsed-groups");
    } catch {}
  };

  const ensureStyle = (root) => {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = cssText;
      style.dataset.dreamSkinVersion = VERSION;
      (document.head || root).appendChild(style);
    } else if (style.dataset.dreamSkinStyleRevision !== STYLE_REVISION) {
      style.textContent = cssText;
    }
    style.dataset.dreamSkinVersion = VERSION;
    style.dataset.dreamSkinStyleRevision = STYLE_REVISION;
    return style;
  };

  const applyRootState = (root) => {
    metrics.rootPasses += 1;
    ensureStyle(root);
    const shell = resolvedShell();
    setAttribute(root, SHELL_ATTR, shell);
    setStyleProperty(root, "--dream-skin-art", `url("${artUrl}")`);
    if (DECORATION_DATA.assistant) {
      setStyleProperty(root, "--ds1907-assistant-avatar", `url("${DECORATION_DATA.assistant}")`);
    }
    applyTheme(root, shell);
    applyArtMetadata(root);
    setAttribute(root, "data-dream-skin-mode", THEME.mode === "deep" ? "qq2007" : "classic");
    setAttribute(root, "data-ds1907-status", PROFILE.status || "online");
    setAttribute(root, "data-ds2007-agent-layout", AGENT_LAYOUT);
    setAttribute(root, "data-ds2007-pet-motion", PET_MOTION);
    setAttribute(root, "data-ds2007-conversation-preview", CONVERSATION_PREVIEW);
    root.classList.add("codex-dream-skin");
    const chrome = document.getElementById(CHROME_ID);
    if (chrome && chrome.dataset.dreamShell !== shell) {
      chrome.dataset.dreamShell = shell;
      metrics.attributeWrites += 1;
    }
    return shell;
  };

  let frameLayoutTimer = null;
  const cancelFrameLayout = () => {
    if (frameLayoutTimer !== null) clearTimeout(frameLayoutTimer);
    frameLayoutTimer = null;
  };
  const syncFrameLayout = (shellMain, chrome) => {
    metrics.layoutReads += 1;
    const nativeHeader = shellMain?.querySelector?.(":scope > header.app-header-tint");
    const viewportWidth = Number(window.innerWidth) || 1280;
    let safeLeft = 82;
    let safeRight = 12;
    const protectedNodes = nativeHeader?.querySelectorAll?.(
      'button, a, [role="button"], span.min-w-0.truncate',
    ) || [];
    for (const node of protectedNodes) {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const midpoint = rect.left + rect.width / 2;
      if (midpoint < viewportWidth / 2) safeLeft = Math.max(safeLeft, Math.ceil(rect.right) + 8);
      else safeRight = Math.max(safeRight, Math.ceil(viewportWidth - rect.left) + 8);
    }
    setStyleProperty(chrome, "--ds2007-title-safe-left", `${safeLeft}px`);
    setStyleProperty(chrome, "--ds2007-title-safe-right", `${safeRight}px`);
  };
  const scheduleFrameLayout = () => {
    if (frameLayoutTimer !== null) return;
    frameLayoutTimer = setTimeout(() => {
      frameLayoutTimer = null;
      const shellMain = document.querySelector("main.main-surface") || document.querySelector("main");
      const chrome = document.getElementById(CHROME_ID);
      if (shellMain && chrome) syncFrameLayout(shellMain, chrome);
    }, 64);
  };

  const syncRouteState = (shell, { layout = false } = {}) => {
    metrics.routePasses += 1;
    const root = document.documentElement;
    if (!root) return;
    shell ||= root.getAttribute(SHELL_ATTR) || resolvedShell();
    const shellMain = document.querySelector("main.main-surface") || document.querySelector("main");
    const homeIndicator = document.querySelector('[data-testid="home-icon"]');
    const home = homeIndicator?.closest('[role="main"]') ||
      [...document.querySelectorAll('[role="main"]')].find((candidate) =>
        candidate.querySelector('[data-feature="game-source"]') &&
        candidate.querySelector('[class~="group/home-suggestions"]')) || null;
    for (const candidate of document.querySelectorAll('[role="main"].dream-skin-home')) {
      if (candidate !== home) candidate.classList.remove("dream-skin-home");
    }
    if (home) home.classList.add("dream-skin-home");
    const homeUtilityBars = new Set(home
      ? home.querySelectorAll('[class*="_homeUtilityBar_"]')
      : []);
    for (const candidate of document.querySelectorAll(".dream-skin-home-utility")) {
      if (!homeUtilityBars.has(candidate)) candidate.classList.remove("dream-skin-home-utility");
    }
    for (const candidate of homeUtilityBars) candidate.classList.add("dream-skin-home-utility");

    if (!shellMain || !document.body) return;
    shellMain.classList.toggle("dream-skin-home-shell", Boolean(home));
    let chrome = document.getElementById(CHROME_ID);
    if (chrome && chrome.dataset.ds2007Revision !== "24") {
      chrome.remove();
      chrome = null;
      chromeParts = null;
    }
    let created = false;
    if (!chrome || chrome.parentElement !== document.body) {
      chrome?.remove();
      chrome = document.createElement("div");
      chrome.id = CHROME_ID;
      chrome.innerHTML = `
        <header class="ds2007-titlebar"><span class="ds2007-icon ds2007-icon--mascot ds2007-title-icon" aria-hidden="true"></span><b class="ds2007-window-title">Codex 2007</b></header>
        <nav class="ds2007-toolbar" aria-label="Codex 2007 全局工具栏">
          <button data-nav="新建任务"><i class="ds2007-icon ds2007-icon--new-task" aria-hidden="true"></i><span>新建任务</span></button>
          <button data-nav="已安排"><i class="ds2007-icon ds2007-icon--scheduled" aria-hidden="true"></i><span>已安排</span></button>
          <button data-nav="插件"><i class="ds2007-icon ds2007-icon--plugins" aria-hidden="true"></i><span>插件</span></button>
          <button data-nav="站点"><i class="ds2007-icon ds2007-icon--sites" aria-hidden="true"></i><span>站点</span></button>
          <button data-nav="拉取请求"><i class="ds2007-icon ds2007-icon--pull-request" aria-hidden="true"></i><span>拉取请求</span></button>
          <button data-nav="聊天"><i class="ds2007-icon ds2007-icon--chat" aria-hidden="true"></i><span>聊天</span></button>
          <button data-nav="换肤"><i class="ds2007-icon ds2007-icon--skin" aria-hidden="true"></i><span>换肤</span></button>
        </nav>
        <aside class="ds2007-friends" aria-label="Codex 好友">
          <header class="ds2007-right-tabs" role="tablist" aria-label="右侧面板">
            <button class="ds2007-right-tab is-active" data-action="friend-expand" role="tab" aria-selected="true">Codex 好友</button>
            <button class="ds2007-right-tab" data-action="native-panel" role="tab"><span class="ds2007-native-tab-label">环境详情</span></button>
            <span class="ds2007-right-tabs-spacer"></span><button data-action="friend-collapse" aria-label="收起好友栏">—</button><button data-action="friend-close" aria-label="关闭好友栏">×</button>
          </header>
          <div class="ds2007-friends-scroll">
            <section class="ds2007-assistant-card"><div class="ds2007-pet-media"></div><div class="ds2007-friend-profile"><p><i></i><b class="ds2007-friend-name">Codex 江湖传说</b><span class="ds2007-friend-level" aria-label="QQ 等级"></span></p><small><span class="ds2007-friend-presence">在线</span> · <span class="ds2007-friend-presence-detail">正在和你聊天</span><br><span class="ds2007-friend-status">随时可以继续提需求</span></small></div></section>
            <section class="ds2007-chat-card" aria-label="最近 QQ 对话">
              <header><b>最近对话</b><span class="ds2007-chat-presence">● 在线</span></header>
              <div class="ds2007-chat-transcript">
                <p class="is-user"><b>你</b><time>最近</time><span class="ds2007-chat-user-message">还没有最近消息</span></p>
                <p class="is-codex"><b class="ds2007-chat-agent-name">Codex 小企鹅</b><time>最近</time><span class="ds2007-chat-assistant-message">发一条消息开始聊天</span></p>
              </div>
            </section>
            <section class="ds2007-environment-card">
              <header><b>环境信息</b><button data-action="native-panel" aria-label="打开完整环境信息">详细 ›</button></header>
              <dl>
                <div><dt>当前任务</dt><dd class="ds2007-env-task">未选择任务</dd></div>
                <div><dt>运行状态</dt><dd class="ds2007-env-status">● 在线</dd></div>
                <div><dt>任务产物</dt><dd class="ds2007-env-output-count">0 个</dd></div>
                <div><dt>参考来源</dt><dd class="ds2007-env-source-count">0 个</dd></div>
              </dl>
              <div class="ds2007-recent-products"><b>最近产物</b><ol><li class="ds2007-env-output-1">等待本次任务生成</li><li class="ds2007-env-output-2"></li><li class="ds2007-env-output-3"></li></ol></div>
            </section>
            <section class="ds2007-qqshow-card"><header><b>QQ 秀</b><span class="ds2007-qqshow-options" role="group" aria-label="选择 QQ 秀"><button data-action="qq-show" data-qq-show="classic-girl" aria-label="经典女 QQ 秀">女</button><button data-action="qq-show" data-qq-show="classic-boy" aria-label="经典男 QQ 秀">男</button></span></header><div class="ds2007-qqshow-media"></div></section>
          </div>
          <label class="ds2007-friend-search"><span class="ds2007-icon ds2007-icon--search" aria-hidden="true"></span><input value="正在和 Codex 小企鹅聊天" readonly aria-label="当前 QQ 对话"></label>
        </aside>
        <nav class="ds2007-friends-tab" aria-label="右侧面板标签">
          <button data-action="native-panel" aria-label="打开环境信息"><b class="ds2007-native-rail-label">环境</b></button>
          <button data-action="friend-expand" aria-label="展开好友栏"><b>好友</b></button>
        </nav>
        <footer class="ds2007-statusbar"><span class="ds2007-icon ds2007-icon--online" aria-hidden="true"></span><b></b><span class="ds2007-status-level" aria-label="QQ 等级"></span><span class="ds2007-status-current"></span><button class="ds2007-sound-preview" data-sound-preview="completion" type="button" aria-label="试听任务完成声" title="试听任务完成的 QQ 提示音"><i class="ds2007-icon ds2007-icon--sound" aria-hidden="true"></i><span>完成声</span></button><button class="ds2007-sound-preview" data-sound-preview="confirmation" type="button" aria-label="试听等待确认声" title="试听需要人工确认时的 QQ 提示音"><i class="ds2007-icon ds2007-icon--sound" aria-hidden="true"></i><span>确认声</span></button><button class="ds2007-profile-signature" type="button" aria-label="切换 QQ 签名" title="点击更换 QQ 签名"></button><span class="ds2007-security"><i class="ds2007-icon ds2007-icon--security" aria-hidden="true"></i>安全</span></footer>
        <button class="ds2007-native-skin-toggle" data-action="skin-restore" aria-label="切换至 Codex 2007 深度仿制版"><i class="ds2007-icon ds2007-icon--skin" aria-hidden="true"></i><span>换肤</span></button>
        <div class="dream-skin-brand"><span class="dream-skin-portal-mark">◉</span><span><b></b><small></small></span></div>
        <div class="dream-skin-status"><i></i><span></span></div><div class="dream-skin-quote"></div>
        <div class="dream-skin-particles"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="dream-skin-orbit"></div>`;
      document.body.appendChild(chrome);
      chrome.dataset.ds2007Revision = "24";
      created = true;
      chromeParts = null;
    }
    if (!chromeParts || chromeParts.chrome !== chrome) {
      chromeParts = {
        chrome,
        name: chrome.querySelector(".dream-skin-brand b"),
        subtitle: chrome.querySelector(".dream-skin-brand small"),
        status: chrome.querySelector(".dream-skin-status span"),
        quote: chrome.querySelector(".dream-skin-quote"),
        petMedia: chrome.querySelector(".ds2007-pet-media"),
        qqShowMedia: chrome.querySelector(".ds2007-qqshow-media"),
        qqShowControls: [...chrome.querySelectorAll(".ds2007-qqshow-options [data-qq-show]")],
        windowTitle: chrome.querySelector(".ds2007-window-title"),
        statusCurrent: chrome.querySelector(".ds2007-status-current"),
        statusbarName: chrome.querySelector(".ds2007-statusbar b"),
        statusbarLevel: chrome.querySelector(".ds2007-status-level"),
        soundPreviews: [...chrome.querySelectorAll(".ds2007-sound-preview[data-sound-preview]")],
        profileSignature: chrome.querySelector(".ds2007-profile-signature"),
        toolbar: chrome.querySelector(".ds2007-toolbar"),
        nativeTab: chrome.querySelector('.ds2007-right-tab[data-action="native-panel"]'),
        friendTab: chrome.querySelector('.ds2007-right-tab[data-action="friend-expand"]'),
        nativeTabLabel: chrome.querySelector(".ds2007-native-tab-label"),
        nativeRailLabel: chrome.querySelector(".ds2007-native-rail-label"),
        nativeSkinToggle: chrome.querySelector(".ds2007-native-skin-toggle"),
        friendStatus: chrome.querySelector(".ds2007-friend-status"),
        friendPresence: chrome.querySelector(".ds2007-friend-presence"),
        friendPresenceDetail: chrome.querySelector(".ds2007-friend-presence-detail"),
        friendName: chrome.querySelector(".ds2007-friend-name"),
        friendLevel: chrome.querySelector(".ds2007-friend-level"),
        chatPresence: chrome.querySelector(".ds2007-chat-presence"),
        chatUserMessage: chrome.querySelector(".ds2007-chat-user-message"),
        chatAssistantMessage: chrome.querySelector(".ds2007-chat-assistant-message"),
        chatAgentName: chrome.querySelector(".ds2007-chat-agent-name"),
        friendSearchInput: chrome.querySelector(".ds2007-friend-search input"),
        environmentTask: chrome.querySelector(".ds2007-env-task"),
        environmentStatus: chrome.querySelector(".ds2007-env-status"),
        environmentOutputCount: chrome.querySelector(".ds2007-env-output-count"),
        environmentSourceCount: chrome.querySelector(".ds2007-env-source-count"),
        environmentOutputs: [1, 2, 3].map((index) => chrome.querySelector(`.ds2007-env-output-${index}`)),
      };
    }
    setTextContent(chromeParts.name, THEME.name || "Codex Dream Skin");
    setTextContent(chromeParts.subtitle, THEME.brandSubtitle || "CODEX DREAM SKIN");
    setTextContent(chromeParts.status, THEME.statusText || "DREAM SKIN ONLINE");
    setTextContent(chromeParts.quote, THEME.quote || "MAKE SOMETHING WONDERFUL");
    const displayName = nativeProfileName();
    setTextContent(chromeParts.statusbarName, displayName);
    syncQqLevel(chromeParts.statusbarLevel);
    syncQqSignature();
    setTextContent(chromeParts.friendName, "Codex 江湖传说");
    syncQqLevel(chromeParts.friendLevel);
    setTextContent(chromeParts.chatAgentName, PROFILE.nickname || "Codex 小企鹅");
    const agentName = PROFILE.nickname || "Codex 小企鹅";
    const statusLabel = PROFILE.status === "busy" ? "忙碌" : PROFILE.status === "offline" ? "离线" : "在线";
    setTextContent(chromeParts.statusCurrent, `● ${statusLabel}`);
    setTextContent(chromeParts.friendPresence, statusLabel);
    setTextContent(chromeParts.friendPresenceDetail, PROFILE.status === "offline" ? "等待重新上线"
      : PROFILE.status === "busy" ? "正在处理任务" : "正在和你聊天");
    if (chromeParts.friendSearchInput) {
      chromeParts.friendSearchInput.value = PROFILE.status === "offline"
        ? `${agentName} 当前离线` : `正在和 ${agentName} 聊天`;
    }
    chromeParts.chrome.dataset.profileStatus = PROFILE.status || "online";
    readCodexPetSnapshot();
    if (chromeParts.petMedia?.appendChild && DECORATION_DATA.assistant) {
      const current = chromeParts.petMedia.querySelector?.(":scope > img");
      if (!current || current.src !== DECORATION_DATA.assistant) {
        const assistant = document.createElement("img");
        assistant.src = DECORATION_DATA.assistant;
        assistant.alt = "";
        chromeParts.petMedia.replaceChildren?.(assistant);
      }
      chromeParts.petMedia.style.backgroundImage = "";
      chromeParts.petMedia.dataset.petSource = "theme-penguin";
      delete chromeParts.petMedia.dataset.petAssetRef;
      schedulePetMotion();
    }
    syncQqShow();
    const sidebar = document.querySelector("aside.app-shell-left-panel");
    bindInteraction(chromeParts.toolbar, "click", (event) => {
      const trigger = event.target?.closest?.("button[data-nav]");
      if (!trigger) return;
      const nav = trigger.getAttribute("data-nav");
      if (nav === "换肤") {
        setSkinView("native");
        return;
      }
      const destination = findPrimaryNavDestination(
        document.querySelector("aside.app-shell-left-panel"),
        nav,
      );
      destination?.click?.();
    }, "bridgeBound");
    bindNativeSkinRestore(chromeParts.nativeSkinToggle);
    if (sidebar && (created || sidebar.dataset?.qq2007Styled !== "sidebar")) {
      if (created) cleanupLegacySidebarArtifacts(sidebar);
      styleSidebarSubtree(sidebar);
    }
    markPrimaryNavSources(sidebar);
    for (const button of chromeParts.toolbar?.querySelectorAll?.(":scope > button[data-nav]") || []) {
      const label = button.getAttribute?.("data-nav") || "";
      const available = label === "换肤" || Boolean(findPrimaryNavDestination(sidebar, label));
      button.disabled = !available;
      button.setAttribute?.("aria-disabled", available ? "false" : "true");
      button.title = available ? "" : `${label}在当前 Codex 版本中不可用`;
    }
    styleComposerSubtree(document.querySelector(".composer-surface-chrome"));
    normalizeConversationMedia(document.documentElement);
    if (created) {
      for (const message of document.querySelectorAll?.(".ds1907-message") || []) {
        message.classList.remove("ds1907-message");
        message.removeAttribute?.("data-ds1907-time");
      }
    }
    bindNativeRightToggleGuards(root);
    for (const trigger of chrome.querySelectorAll?.(
      '.ds2007-right-tabs [data-action], .ds2007-friends-tab [data-action], .ds2007-environment-card [data-action]',
    ) || []) {
      bindInteraction(trigger, "click", () => {
        const action = trigger.getAttribute?.("data-action");
        const currentNativeRightState = readNativeRightState(shellMain);
        setAttribute(root, "data-ds2007-native-right", currentNativeRightState ? "open" : "closed");
        setAttribute(root, "data-ds2007-native-right-layout", currentNativeRightState?.layout || "none");
        if (action === "native-panel") {
          if (!currentNativeRightState) setNativeRightVisible(true);
          return;
        }
        if (action === "friend-expand" && currentNativeRightState) {
          setNativeRightVisible(false);
        }
        const next = action === "friend-expand" ? "expanded"
          : action === "friend-close" ? "closed" : "collapsed";
        setAttribute(root, "data-ds2007-friends", next);
        writeStoredJson(FRIENDS_KEY, next);
      }, "ds2007FriendBound");
    }
    for (const trigger of chromeParts.qqShowControls || []) {
      bindInteraction(trigger, "click", () => {
        const selection = trigger.getAttribute?.("data-qq-show");
        if (!QQ_SHOW_OPTIONS.some((option) => option.id === selection)) return;
        qqShowSelection = selection;
        syncQqShow({ persist: true });
      }, "ds2007QqShowBound");
      const available = QQ_SHOW_OPTIONS.some((option) => option.id === trigger.getAttribute?.("data-qq-show"));
      trigger.disabled = !available;
      trigger.hidden = !available;
    }
    bindInteraction(chromeParts.profileSignature, "click", () => {
      const current = QQ_SIGNATURE_OPTIONS.indexOf(qqSignature);
      qqSignature = QQ_SIGNATURE_OPTIONS[(current + 1) % QQ_SIGNATURE_OPTIONS.length] || DEFAULT_QQ_SIGNATURE;
      syncQqSignature({ persist: true });
    }, "ds2007SignatureBound");
    for (const trigger of chromeParts.soundPreviews || []) {
      bindInteraction(trigger, "click", async () => {
        const kind = trigger.getAttribute?.("data-sound-preview") === "confirmation"
          ? "confirmation" : "completion";
        const played = await playQqNotification(kind);
        trigger.dataset.soundState = played ? "played" : "blocked";
        trigger.title = played ? "已试听 QQ 提示音" : "浏览器暂未允许声音，请再点一次";
        setTimeout(() => {
          delete trigger.dataset.soundState;
          trigger.title = kind === "confirmation"
            ? "试听需要人工确认时的 QQ 提示音" : "试听任务完成的 QQ 提示音";
        }, 1800);
      }, "ds2007SoundBound");
    }
    const projectControl = home?.querySelector?.('[class~="group/project-selector"] > button');
    const nativeHeaderNode = shellMain.querySelector?.(":scope > header.app-header-tint");
    const nativeTaskTitle = [...(nativeHeaderNode?.querySelectorAll?.(
      '[data-thread-title="true"], span.min-w-0.truncate, ' +
      '[data-testid="app-shell-header-context-menu-surface"] [class*="text-sm"][class*="select-none"]',
    ) || [])]
      .find((candidate) => normalizedLabel(candidate));
    for (const candidate of nativeHeaderNode?.querySelectorAll?.("[data-ds2007-native-title-source]") || []) {
      if (candidate !== nativeTaskTitle) candidate.removeAttribute?.("data-ds2007-native-title-source");
    }
    nativeTaskTitle?.setAttribute?.("data-ds2007-native-title-source", "true");
    const activeTaskTitle = sidebar?.querySelector?.(
      '[data-app-action-sidebar-thread-active="true"] [data-thread-title="true"]',
    ) || document.querySelector?.(
      'aside.app-shell-left-panel [data-app-action-sidebar-thread-active="true"]',
    );
    const taskName = normalizedLabel(nativeTaskTitle) || normalizedLabel(activeTaskTitle);
    const projectControlName = normalizedLabel(projectControl).replace(/^(选择项目|当前项目)[·：:\s]*/, "");
    const nativeProjectButton = [...(shellMain.querySelectorAll?.(":scope > header.app-header-tint button[aria-label]") || [])]
      .find((candidate) => /^(项目|Project)[：:]/i.test(candidate.getAttribute?.("aria-label") || ""));
    const nativeProjectName = (nativeProjectButton?.getAttribute?.("aria-label") || "")
      .replace(/^(项目|Project)[：:\s]*/i, "");
    const contextName = home ? "新建任务" : (taskName
      || nativeProjectName
      || (projectControlName === "选择项目" ? "" : projectControlName)
      || "未选择项目");
    const taskRunning = Boolean(document.querySelector?.(TASK_STOP_SELECTOR));
    const environmentGroups = [...(document.querySelectorAll?.(
      '[data-slot="thread-summary-panel-item-group"]',
    ) || [])];
    const sourceGroup = environmentGroups.find((candidate) =>
      candidate.getAttribute?.("aria-label") === "Sources");
    const outputGroup = environmentGroups.find((candidate) => candidate !== sourceGroup);
    const groupLabels = (group) => [...(group?.querySelectorAll?.(
      '[data-slot="thread-summary-panel-item-label"]',
    ) || [])]
      .map((candidate) => normalizedLabel(candidate))
      .filter((label) => label && !/^(View\s*all|查看全部)$/i.test(label));
    const outputNames = groupLabels(outputGroup);
    const sourceNames = groupLabels(sourceGroup);
    const attachmentCount = document.querySelectorAll?.(
      '[role="button"][aria-label="User attachment"]',
    )?.length || 0;
    syncConversationPreview();
    setTextContent(chromeParts.environmentTask, contextName);
    setTextContent(chromeParts.environmentStatus, PROFILE.status === "offline" ? "● 离线"
      : taskRunning || PROFILE.status === "busy" ? "● 正在处理" : "● 在线待命");
    setTextContent(chromeParts.environmentOutputCount, `${outputNames.length} 个`);
    setTextContent(chromeParts.environmentSourceCount, `${sourceNames.length || attachmentCount} 个`);
    setTextContent(chromeParts.friendStatus, PROFILE.status === "offline" ? "暂时离线，稍后再聊"
      : taskRunning || PROFILE.status === "busy" ? "正在处理当前任务…" : "任务完成，可以继续聊");
    setTextContent(chromeParts.chatPresence, PROFILE.status === "offline" ? "● 离线"
      : taskRunning ? "● 正在输入" : PROFILE.status === "busy" ? "● 忙碌" : "● 在线");
    const recentProducts = outputNames.length ? outputNames.slice(0, 3)
      : [taskRunning ? "正在生成本次任务产物…" : "暂无新产物"];
    chromeParts.environmentOutputs.forEach((node, index) => {
      setTextContent(node, recentProducts[index] || "");
    });
    setTextContent(chromeParts.windowTitle, `Codex 2007 - ${contextName}`);
    const conversationLabelHost = shellMain.querySelector?.(".app-shell-main-content-viewport") || shellMain;
    let conversationLabel = shellMain.querySelector?.(".ds2007-conversation-label");
    if (taskName) {
      if (!conversationLabel) {
        conversationLabel = document.createElement("span");
        conversationLabel.className = "ds2007-conversation-label";
        conversationLabel.setAttribute("aria-hidden", "true");
      }
      if (conversationLabel.parentElement !== conversationLabelHost) {
        conversationLabelHost.appendChild(conversationLabel);
      }
      setTextContent(conversationLabel, taskName);
    } else {
      conversationLabel?.remove?.();
    }
    const nativeRightState = readNativeRightState(shellMain);
    const nativeRightOpen = Boolean(nativeRightState);
    markNativeRightDock(root, nativeRightState);
    chromeParts.nativeTab?.classList?.toggle?.("is-active", nativeRightOpen);
    chromeParts.friendTab?.classList?.toggle?.("is-active", !nativeRightOpen);
    if (chromeParts.nativeTab) setAttribute(chromeParts.nativeTab, "aria-selected", nativeRightOpen ? "true" : "false");
    if (chromeParts.friendTab) setAttribute(chromeParts.friendTab, "aria-selected", nativeRightOpen ? "false" : "true");
    setAttribute(root, "data-ds2007-native-right", nativeRightOpen ? "open" : "closed");
    setAttribute(root, "data-ds2007-native-right-layout", nativeRightState?.layout || "none");
    const activeNativeLabel = nativeRightLabel(nativeRightState?.owner);
    const activeNativeRailLabel = activeNativeLabel === "代码审查" ? "审查"
      : activeNativeLabel === "文件详情" ? "文件" : "环境";
    setAttribute(root, "data-ds2007-native-right-label", activeNativeLabel);
    setTextContent(chromeParts.nativeTabLabel, activeNativeLabel);
    setTextContent(chromeParts.nativeRailLabel, activeNativeRailLabel);
    const nativeRailButton = chromeParts.nativeRailLabel?.closest?.("button");
    if (nativeRailButton) setAttribute(nativeRailButton, "aria-label", `打开${activeNativeLabel}`);
    if (!root.getAttribute("data-ds2007-friends")) {
      const storedFriends = readStoredJson(FRIENDS_KEY, "expanded");
      setAttribute(root, "data-ds2007-friends", ["collapsed", "closed"].includes(storedFriends) ? storedFriends : "expanded");
    }
    const appRoot = shellMain.closest?.("body > *");
    appRoot?.classList?.add("ds2007-app-root");
    if (layout || created) syncFrameLayout(shellMain, chrome);
    chrome.classList.toggle("dream-skin-home-shell", Boolean(home));
    if (chrome.dataset.dreamShell !== shell) {
      chrome.dataset.dreamShell = shell;
      metrics.attributeWrites += 1;
    }
    schedulePetMotion();
  };

  const clearSkinVisualState = () => {
    const root = document.documentElement;
    root?.classList.remove("codex-dream-skin");
    root?.removeAttribute(SHELL_ATTR);
    for (const name of ART_ATTRS) root?.removeAttribute(name);
    root?.style.removeProperty("--dream-skin-art");
    for (const name of THEME_VARIABLES) root?.style.removeProperty(name);
    document.querySelectorAll(".dream-skin-home").forEach((node) => node.classList.remove("dream-skin-home"));
    document.querySelectorAll(".dream-skin-home-shell").forEach((node) => node.classList.remove("dream-skin-home-shell"));
    document.querySelectorAll(".dream-skin-home-utility").forEach((node) => node.classList.remove("dream-skin-home-utility"));
    document.querySelectorAll(".ds2007-app-root").forEach((node) => node.classList.remove("ds2007-app-root"));
    document.querySelectorAll(".ds2007-conversation-label, .ds2007-pinned-panel, .ds2007-context-menu, .ds2007-recents-empty")
      .forEach((node) => node.remove());
    cancelFrameLayout();
    document.querySelectorAll(".ds2007-toolbar-duplicate, .ds2007-project-entry, .ds2007-pinned-source, .ds2007-section-label, [data-qq2007-styled], [data-qq2007-toolbar-duplicate], [data-ds2007-context-bound], [data-ds2007-collapse-bound], [data-ds2007-global-nav-source]")
      .forEach(clearSidebarMarker);
    document.querySelectorAll("[data-qq2007-composer-region], [data-qq2007-composer-control], [data-qq2007-home-layout], [data-qq2007-home-region]")
      .forEach(clearComposerMarker);
    document.querySelectorAll("[data-qq2007-media-ready], [data-qq2007-conversation-media], [data-qq2007-conversation-gallery], [data-qq2007-conversation-gallery-row], [data-qq2007-conversation-count]")
      .forEach((node) => {
        node.removeAttribute("data-qq2007-media-ready");
        node.removeAttribute("data-qq2007-conversation-media");
        node.removeAttribute("data-qq2007-conversation-gallery");
        node.removeAttribute("data-qq2007-conversation-gallery-row");
        node.removeAttribute("data-qq2007-conversation-count");
      });
    document.querySelectorAll("[data-ds2007-native-title-source]")
      .forEach((node) => node.removeAttribute("data-ds2007-native-title-source"));
    for (const group of SIDEBAR_SECTIONS.values()) root?.removeAttribute(`data-ds2007-collapse-${group}`);
  };

  const setSkinView = (view, { persist = true } = {}) => {
    skinView = view === "native" ? "native" : "deep";
    if (persist) writeStoredJson(VIEW_KEY, skinView);
    if (skinView === "native") {
      clearSkinVisualState();
      setAttribute(document.documentElement, "data-ds2007-view", "native");
      return;
    }
    ensure({ root: true, route: true, layout: true });
  };
  const bindNativeSkinRestore = (button = document.getElementById(CHROME_ID)
    ?.querySelector?.(".ds2007-native-skin-toggle")) => {
    bindInteraction(button, "click", () => setSkinView("deep"), "skinRestoreBound");
  };

  const ensure = ({ root: rootPass = true, route = true, layout = true } = {}) => {
    if (window[DISABLED_KEY]) return;
    const root = document.documentElement;
    if (!root) return;
    if (skinView === "native" && document.getElementById(CHROME_ID)) {
      bindNativeSkinRestore();
      setAttribute(root, "data-ds2007-view", "native");
      return;
    }
    metrics.ensureCalls += 1;
    const shell = rootPass ? applyRootState(root) : null;
    if (route) syncRouteState(shell, { layout });
    if (skinView === "native") setSkinView("native", { persist: false });
    else setAttribute(root, "data-ds2007-view", "deep");
  };

  const cleanup = () => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken) return false;
    window[DISABLED_KEY] = true;
    clearSkinVisualState();
    disposeInteractions();
    clearComposerScrollAnchor();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CHROME_ID)?.remove();
    state?.observer?.disconnect();
    state?.rootObserver?.disconnect();
    if (state?.timer) clearInterval(state.timer);
    if (state?.scheduler?.timeout) clearTimeout(state.scheduler.timeout);
    if (state?.scheduler?.frame != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(state.scheduler.frame);
    }
    if (analysisTimer) clearTimeout(analysisTimer);
    disposeNotificationRuntime();
    if (chatPreviewTimer !== null) clearTimeout(chatPreviewTimer);
    chatPreviewTimer = null;
    clearPetMotionTimers();
    confirmationPlayedKeys.clear();
    delete window.__CODEX_DREAM_SKIN_CONFIRMATION_KEYS__;
    if (state?.mediaHandler && state?.mediaQuery) {
      try { state.mediaQuery.removeEventListener("change", state.mediaHandler); } catch {}
    }
    if (state?.artUrl) URL.revokeObjectURL(state.artUrl);
    delete window[STATE_KEY];
    delete window[DISABLED_KEY];
    delete window[ANALYSIS_CACHE_KEY];
    return true;
  };

  const scheduler = { timeout: null, frame: null, root: false, route: false, layout: false };
  const flushScheduledEnsure = () => {
    if (scheduler.frame !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(scheduler.frame);
    }
    if (scheduler.timeout) clearTimeout(scheduler.timeout);
    scheduler.frame = null;
    scheduler.timeout = null;
    const pending = { root: scheduler.root, route: scheduler.route, layout: scheduler.layout };
    scheduler.root = false;
    scheduler.route = false;
    scheduler.layout = false;
    ensure(pending);
  };
  const scheduleEnsure = ({ root = false, route = true, layout = false } = {}) => {
    scheduler.root ||= root;
    scheduler.route ||= route;
    scheduler.layout ||= layout;
    if (scheduler.timeout || scheduler.frame !== null) return;
    if (typeof requestAnimationFrame === "function") {
      scheduler.frame = requestAnimationFrame(flushScheduledEnsure);
      scheduler.timeout = setTimeout(flushScheduledEnsure, 96);
    } else {
      scheduler.timeout = setTimeout(flushScheduledEnsure, 64);
    }
  };
  bindInteraction(document, "transitionend", (event) => {
    const target = event.target;
    if (target?.closest?.(`${NATIVE_RIGHT_PANEL_SELECTOR}, ${NATIVE_RIGHT_SIGNAL_SELECTOR}`) ||
      target?.querySelector?.(NATIVE_RIGHT_PORTAL_SELECTOR)) {
      scheduleEnsure({ route: true, layout: false });
    }
  }, "nativeRightTransitionBound");
  const observer = new MutationObserver((records) => {
    syncCompletionSound();
    syncHumanConfirmationSound();
    if (skinView === "native") return;
    let routeChanged = false;
    let frameChanged = false;
    let conversationChanged = false;
    const routeSelector = `main.main-surface, [role="main"], [data-feature="game-source"], [class~="group/home-suggestions"], .composer-surface-chrome, aside.app-shell-left-panel, header.app-header-tint, ${NATIVE_RIGHT_PANEL_SELECTOR}, ${NATIVE_RIGHT_SIGNAL_SELECTOR}, ${NATIVE_RIGHT_TOGGLE_SELECTOR}`;
    const routeContextSelector = 'main.main-surface > header.app-header-tint, [class~="group/project-selector"], ' +
      'aside.app-shell-left-panel [data-app-action-sidebar-thread-row]';
    for (const record of records) {
      if (record.type === "characterData" && record.target?.parentElement?.closest?.('[class*="_markdownContent_"]')) {
        conversationChanged = true;
      }
      if (record.type === "attributes" && record.target?.closest?.(routeContextSelector)) {
        routeChanged = true;
        frameChanged = true;
      }
      if (record.type === "attributes" && (
        record.target?.matches?.(NATIVE_RIGHT_TOGGLE_SELECTOR) ||
        record.target?.closest?.(NATIVE_RIGHT_SIGNAL_SELECTOR) ||
        record.target?.closest?.(NATIVE_RIGHT_PANEL_SELECTOR)
      )) routeChanged = true;
      if (record.type === "characterData" && record.target?.parentElement?.closest?.(routeContextSelector)) {
        routeChanged = true;
        frameChanged = true;
      }
      for (const node of record.addedNodes || []) {
        if (node?.nodeType !== 1) {
          if (record.target?.closest?.(routeContextSelector)) routeChanged = true;
          continue;
        }
        if (node.id === CHROME_ID || node.id === STYLE_ID || node.closest?.(`#${CHROME_ID}`)) continue;
        if (node.matches?.('[class*="_markdownContent_"], [data-turn-key]') ||
          node.querySelector?.('[class*="_markdownContent_"], [data-turn-key]')) conversationChanged = true;
        if (codexPetSnapshot === null &&
          (node.matches?.(CODEX_PET_SELECTOR) || node.querySelector?.(CODEX_PET_SELECTOR))) {
          codexPetSnapshot = undefined;
          routeChanged = true;
        }
        styleSidebarSubtree(node);
        styleComposerSubtree(node);
        normalizeConversationMedia(node);
        const sidebar = node.matches?.("aside.app-shell-left-panel")
          ? node
          : node.closest?.("aside.app-shell-left-panel") || node.querySelector?.("aside.app-shell-left-panel");
        if (sidebar) markPrimaryNavSources(sidebar, node.contains?.(sidebar) ? sidebar : node);
        if (node.matches?.(routeSelector) || node.querySelector?.(routeSelector)) routeChanged = true;
        if (node.matches?.("header.app-header-tint") || node.closest?.("header.app-header-tint") ||
          node.querySelector?.("header.app-header-tint")) frameChanged = true;
      }
      for (const node of record.removedNodes || []) {
        if (node?.nodeType === 1 && (node.matches?.('[class*="_markdownContent_"], [data-turn-key]') ||
          node.querySelector?.('[class*="_markdownContent_"], [data-turn-key]'))) conversationChanged = true;
        if (node?.nodeType === 1 && (node.matches?.(routeSelector) || node.querySelector?.(routeSelector))) {
          routeChanged = true;
          if (node.matches?.("header.app-header-tint") || node.closest?.("header.app-header-tint") ||
            node.querySelector?.("header.app-header-tint")) frameChanged = true;
        }
      }
      if (record.type === "childList") {
        syncRecentsEmpty(record.target?.closest?.('[data-qq2007-section="tasks"]'));
      }
    }
    if (conversationChanged) scheduleConversationPreview();
    if (routeChanged) scheduleEnsure({ route: true, layout: frameChanged });
  });
  rootObserver = new MutationObserver(() => {
    if (samplingNativeShell || skinView === "native") return;
    scheduleEnsure({ root: true, route: false });
  });

  let mediaQuery = null;
  let mediaHandler = null;
  try {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaHandler = () => scheduleEnsure({ root: true, route: false });
  } catch {}

  window[STATE_KEY] = {
    ensure,
    cleanup,
    observer,
    rootObserver,
    timer: null,
    scheduler,
    mediaQuery,
    mediaHandler,
    disposeInteractions,
    cancelFrameLayout,
    artUrl,
    installToken,
    analysis: artAnalysis,
    artMetadata: ART_METADATA,
    metrics,
    version: VERSION,
    themeId: THEME.id || "custom",
    detectShellMode,
    disposeAuxiliary: () => {
      disposeNotificationRuntime();
      clearComposerScrollAnchor();
      if (chatPreviewTimer !== null) clearTimeout(chatPreviewTimer);
      chatPreviewTimer = null;
      clearPetMotionTimers();
    },
  };
  const firstEnsureStartedAt = now();
  ensure({ layout: !previous || !document.getElementById(CHROME_ID) });
  syncHumanConfirmationSound();
  metrics.firstEnsureMs = Number((now() - firstEnsureStartedAt).toFixed(3));
  bindInteraction(window, "resize", scheduleFrameLayout, "frameResizeBound");
  if (previous?.artUrl && previous.artUrl !== artUrl) URL.revokeObjectURL(previous.artUrl);

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "aria-current", "aria-pressed", "data-state",
      "data-app-action-sidebar-thread-active"],
    characterData: true,
  });
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-appearance", "data-color-mode"],
  });
  if (document.body) {
    rootObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-theme", "data-appearance", "data-color-mode"],
    });
  }
  if (mediaHandler && mediaQuery) {
    mediaQuery.addEventListener("change", mediaHandler);
  }
  const analysisPromise = artAnalysis ? Promise.resolve(null) : analyzeArt();
  window[STATE_KEY].analysisTimer = analysisTimer;
  analysisPromise.then((analysis) => {
    const state = window[STATE_KEY];
    if (!analysis || state?.installToken !== installToken || window[DISABLED_KEY]) return;
    artAnalysis = analysis;
    state.analysis = analysis;
    if (typeof THEME.artKey === "string") {
      analysisCache.set(THEME.artKey, analysis);
      while (analysisCache.size > 8) analysisCache.delete(analysisCache.keys().next().value);
    }
    ensure({ root: true, route: false, layout: false });
  }).catch(() => {});
  return {
    installed: true,
    version: VERSION,
    themeId: THEME.id || "custom",
    shell: resolvedShell(),
    analysis: artAnalysis,
  };
})(__DREAM_SKIN_CSS_JSON__, __DREAM_SKIN_ART_JSON__, __DREAM_SKIN_THEME_JSON__)
