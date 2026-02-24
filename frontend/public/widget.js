/**
 * IRI Chat Widget — embeddable retirement application assistant.
 *
 * Usage (script tag):
 *   <script src="https://host/static/widget.js"
 *     data-product-id="midland-fixed-annuity-001"
 *     data-known-data='{"annuitant_first_name":"Jane"}'
 *     data-theme="light"
 *     data-position="bottom-right">
 *   </script>
 *
 * Usage (JS API):
 *   IRIChat.init({ productId, knownData, apiBase, theme, position, containerId });
 */
(function () {
  "use strict";

  // Prevent double-init
  if (window.IRIChat && window.IRIChat._initialized) return;

  // --------------- CONFIG ---------------
  var DEFAULTS = {
    apiBase: "",
    productId: "",
    knownData: {},
    theme: "light",
    position: "bottom-right",
    containerId: null,
  };

  // --------------- STYLES ---------------
  var CSS = /* css */ `
    :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .iri-fab {
      position: fixed;
      width: 56px; height: 56px;
      border-radius: 50%;
      background: #1a1a2e;
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      z-index: 999999;
      transition: transform 0.2s;
    }
    .iri-fab:hover { transform: scale(1.08); }
    .iri-fab.bottom-right { bottom: 24px; right: 24px; }
    .iri-fab.bottom-left { bottom: 24px; left: 24px; }

    .iri-panel {
      display: none;
      flex-direction: column;
      width: 380px;
      height: 560px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      overflow: hidden;
      z-index: 999999;
    }
    .iri-panel.floating {
      position: fixed;
    }
    .iri-panel.floating.bottom-right { bottom: 92px; right: 24px; }
    .iri-panel.floating.bottom-left { bottom: 92px; left: 24px; }
    .iri-panel.inline {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 12px;
    }
    .iri-panel.open { display: flex; }

    .iri-header {
      background: #1a1a2e;
      color: #fff;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }
    .iri-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .iri-header-title {
      font-size: 15px;
      font-weight: 600;
    }
    .iri-header-phase {
      font-size: 11px;
      background: rgba(255,255,255,0.15);
      padding: 2px 8px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .iri-close-btn {
      background: none;
      border: none;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }

    /* Step progress bar */
    .iri-progress {
      display: none;
      flex-direction: column;
      gap: 4px;
    }
    .iri-progress.visible { display: flex; }
    .iri-progress-bar {
      height: 4px;
      background: rgba(255,255,255,0.2);
      border-radius: 2px;
      overflow: hidden;
    }
    .iri-progress-fill {
      height: 100%;
      background: #4ecdc4;
      border-radius: 2px;
      transition: width 0.4s ease;
    }
    .iri-progress-label {
      font-size: 11px;
      color: rgba(255,255,255,0.7);
    }

    .iri-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f8f9fa;
    }

    .iri-msg {
      max-width: 82%;
      margin-bottom: 12px;
      animation: iriFadeIn 0.2s ease;
    }
    @keyframes iriFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .iri-msg.assistant { margin-right: auto; }
    .iri-msg.user { margin-left: auto; }

    .iri-bubble {
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .iri-msg.assistant .iri-bubble {
      background: #fff;
      color: #333;
      border: 1px solid #e0e0e0;
      border-bottom-left-radius: 4px;
    }
    .iri-msg.user .iri-bubble {
      background: #1a1a2e;
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    .iri-typing {
      display: none;
      padding: 10px 14px;
      margin-bottom: 12px;
      max-width: 82%;
    }
    .iri-typing.active { display: block; }
    .iri-typing-dots {
      display: flex;
      gap: 4px;
    }
    .iri-typing-dot {
      width: 7px; height: 7px;
      background: #bbb;
      border-radius: 50%;
      animation: iriBounce 1.4s infinite ease-in-out;
    }
    .iri-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .iri-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes iriBounce {
      0%, 80%, 100% { transform: scale(0.6); }
      40% { transform: scale(1); }
    }

    .iri-input-area {
      padding: 12px;
      background: #fff;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }
    .iri-input-area input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 20px;
      font-size: 13px;
      outline: none;
      font-family: inherit;
    }
    .iri-input-area input:focus { border-color: #1a1a2e; }
    .iri-input-area input:disabled { background: #f5f5f5; }
    .iri-input-area button {
      padding: 10px 18px;
      background: #1a1a2e;
      color: #fff;
      border: none;
      border-radius: 20px;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
    }
    .iri-input-area button:hover { background: #16213e; }
    .iri-input-area button:disabled { background: #999; cursor: not-allowed; }

    .iri-submit-bar {
      display: none;
      padding: 10px;
      background: #e8f8e8;
      border-top: 1px solid #27ae60;
      text-align: center;
      flex-shrink: 0;
    }
    .iri-submit-bar.active { display: block; }
    .iri-submit-bar button {
      padding: 8px 24px;
      background: #27ae60;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
    }
    .iri-submit-bar button:hover { background: #219a52; }
  `;

  // --------------- MARKDOWN HELPERS ---------------
  function _mdToHtml(text) {
    // Escape HTML first to prevent XSS
    var s = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headings (# … at start of line)
    s = s.replace(/^### (.+)$/gm, "<strong>$1</strong>");
    s = s.replace(/^## (.+)$/gm, "<strong>$1</strong>");
    s = s.replace(/^# (.+)$/gm, "<strong style='font-size:15px'>$1</strong>");

    // Bold and italic
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Inline code
    s = s.replace(/`([^`]+)`/g, "<code style='background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:12px'>$1</code>");

    // Unordered lists: convert consecutive "- " lines into <ul>
    s = s.replace(/(^|\n)(- .+(?:\n- .+)*)/g, function (_, pre, block) {
      var items = block.split("\n").map(function (line) {
        return "<li>" + line.replace(/^- /, "") + "</li>";
      }).join("");
      return pre + "<ul style='margin:4px 0 4px 16px;padding:0'>" + items + "</ul>";
    });

    // Ordered lists: convert consecutive "1. " lines into <ol>
    s = s.replace(/(^|\n)(\d+\. .+(?:\n\d+\. .+)*)/g, function (_, pre, block) {
      var items = block.split("\n").map(function (line) {
        return "<li>" + line.replace(/^\d+\. /, "") + "</li>";
      }).join("");
      return pre + "<ol style='margin:4px 0 4px 16px;padding:0'>" + items + "</ol>";
    });

    // Paragraphs: double newlines
    s = s.replace(/\n\n/g, "<br><br>");
    // Single newlines (that aren't already inside tags)
    s = s.replace(/\n/g, "<br>");

    return s;
  }

  // --------------- WIDGET CLASS ---------------
  function IRIWidget(config) {
    this.config = Object.assign({}, DEFAULTS, config);
    this.sessionId = null;
    this.phase = null;
    this.isOpen = false;
    this.isInline = !!this.config.containerId;
    this._buildDOM();
    if (this.isInline) {
      this._openPanel();
      this._startSession();
    }
  }

  IRIWidget.prototype._buildDOM = function () {
    // Create host element
    this.host = document.createElement("div");
    this.host.id = "iri-chat-widget";
    this.shadow = this.host.attachShadow({ mode: "open" });

    // Styles
    var style = document.createElement("style");
    style.textContent = CSS;
    this.shadow.appendChild(style);

    // FAB (only for floating mode)
    if (!this.isInline) {
      this.fab = document.createElement("button");
      this.fab.className = "iri-fab " + this.config.position;
      this.fab.innerHTML = "&#128172;";
      this.fab.setAttribute("aria-label", "Open chat");
      this.fab.addEventListener("click", this._togglePanel.bind(this));
      this.shadow.appendChild(this.fab);
    }

    // Panel
    this.panel = document.createElement("div");
    this.panel.className = "iri-panel " + (this.isInline ? "inline" : "floating " + this.config.position);

    this.panel.innerHTML =
      '<div class="iri-header">' +
        '<div class="iri-header-row">' +
          '<span class="iri-header-title">Application Assistant</span>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span class="iri-header-phase">--</span>' +
            (this.isInline ? "" : '<button class="iri-close-btn" aria-label="Close">&times;</button>') +
          '</div>' +
        '</div>' +
        '<div class="iri-progress">' +
          '<div class="iri-progress-bar"><div class="iri-progress-fill" style="width:0%"></div></div>' +
          '<span class="iri-progress-label"></span>' +
        '</div>' +
      '</div>' +
      '<div class="iri-messages"></div>' +
      '<div class="iri-typing"><div class="iri-typing-dots">' +
        '<div class="iri-typing-dot"></div><div class="iri-typing-dot"></div><div class="iri-typing-dot"></div>' +
      '</div></div>' +
      '<div class="iri-submit-bar"><button>Submit Application</button></div>' +
      '<div class="iri-input-area">' +
        '<input type="text" placeholder="Type your message..." disabled />' +
        '<button disabled>Send</button>' +
      '</div>';

    this.shadow.appendChild(this.panel);

    // Cache refs
    this.$messages = this.panel.querySelector(".iri-messages");
    this.$typing = this.panel.querySelector(".iri-typing");
    this.$phase = this.panel.querySelector(".iri-header-phase");
    this.$progress = this.panel.querySelector(".iri-progress");
    this.$progressFill = this.panel.querySelector(".iri-progress-fill");
    this.$progressLabel = this.panel.querySelector(".iri-progress-label");
    this.$input = this.panel.querySelector(".iri-input-area input");
    this.$sendBtn = this.panel.querySelector(".iri-input-area button");
    this.$submitBar = this.panel.querySelector(".iri-submit-bar");

    // Event listeners
    var self = this;
    this.$sendBtn.addEventListener("click", function () { self._sendMessage(); });
    this.$input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") self._sendMessage();
    });
    this.$submitBar.querySelector("button").addEventListener("click", function () { self._submit(); });

    var closeBtn = this.panel.querySelector(".iri-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", function () { self._closePanel(); });

    // Mount
    if (this.isInline) {
      var container = document.getElementById(this.config.containerId);
      if (container) {
        container.appendChild(this.host);
      } else {
        document.body.appendChild(this.host);
      }
    } else {
      document.body.appendChild(this.host);
    }
  };

  IRIWidget.prototype._togglePanel = function () {
    if (this.isOpen) {
      this._closePanel();
    } else {
      this._openPanel();
      if (!this.sessionId) this._startSession();
    }
  };

  IRIWidget.prototype._openPanel = function () {
    this.isOpen = true;
    this.panel.classList.add("open");
    if (this.fab) this.fab.innerHTML = "&times;";
  };

  IRIWidget.prototype._closePanel = function () {
    this.isOpen = false;
    this.panel.classList.remove("open");
    if (this.fab) this.fab.innerHTML = "&#128172;";
  };

  IRIWidget.prototype._apiUrl = function (path) {
    var base = this.config.apiBase || "";
    return base + "/api/v1" + path;
  };

  IRIWidget.prototype._startSession = function () {
    var self = this;

    // Fetch schema then create session
    fetch(this._apiUrl("/demo/midland-schema"))
      .then(function (r) { return r.json(); })
      .then(function (questions) {
        var body = {
          questions: questions,
          known_data: self.config.knownData || {},
        };
        if (self.config.productId) body.product_id = self.config.productId;

        return fetch(self._apiUrl("/sessions"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      })
      .then(function (r) {
        if (!r.ok) throw new Error("Failed to create session");
        return r.json();
      })
      .then(function (data) {
        self.sessionId = data.session_id;
        self._setPhase(data.phase);
        self._updateProgress(data);
        self._setInputEnabled(true);
        if (data.greeting) self._addMessage("assistant", data.greeting);
        self._emit("iri:session_created", { session_id: data.session_id });
      })
      .catch(function (err) {
        self._addMessage("assistant", "Sorry, I couldn't start the session. " + err.message);
      });
  };

  IRIWidget.prototype._sendMessage = function () {
    var msg = this.$input.value.trim();
    if (!msg || !this.sessionId) return;

    this.$input.value = "";
    this._addMessage("user", msg);
    this._setTyping(true);
    this._setInputEnabled(false);

    var self = this;
    fetch(this._apiUrl("/sessions/" + this.sessionId + "/message"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    })
      .then(function (r) {
        self._setTyping(false);
        if (!r.ok) throw new Error("Message failed");
        return r.json();
      })
      .then(function (data) {
        self._addMessage("assistant", data.reply);
        var oldPhase = self.phase;
        self._setPhase(data.phase);
        self._updateProgress(data);

        if (oldPhase !== data.phase) {
          self._emit("iri:phase_changed", { phase: data.phase });
        }

        if (data.updated_fields && data.updated_fields.length) {
          self._emit("iri:field_updated", { fields: data.updated_fields });
        }

        if (data.complete || data.phase === "complete") {
          self.$submitBar.classList.add("active");
        }

        self._setInputEnabled(true);
      })
      .catch(function (err) {
        self._setTyping(false);
        self._addMessage("assistant", "Error: " + err.message);
        self._setInputEnabled(true);
      });
  };

  IRIWidget.prototype._submit = function () {
    if (!this.sessionId) return;
    var self = this;
    fetch(this._apiUrl("/sessions/" + this.sessionId + "/submit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        self._addMessage("assistant", "Application " + data.status + "! " + data.field_count + " fields submitted.");
        self._setPhase("submitted");
        self.$submitBar.classList.remove("active");
        self._setInputEnabled(false);
        self._emit("iri:submitted", { status: data.status, field_count: data.field_count });
      })
      .catch(function (err) {
        self._addMessage("assistant", "Submit error: " + err.message);
      });
  };

  IRIWidget.prototype._addMessage = function (role, text) {
    var div = document.createElement("div");
    div.className = "iri-msg " + role;
    var bubble = document.createElement("div");
    bubble.className = "iri-bubble";
    if (role === "assistant") {
      bubble.innerHTML = _mdToHtml(text);
    } else {
      bubble.textContent = text;
    }
    div.appendChild(bubble);
    this.$messages.appendChild(div);
    this.$messages.scrollTop = this.$messages.scrollHeight;
  };

  IRIWidget.prototype._setPhase = function (phase) {
    this.phase = phase;
    var labels = {
      spot_check: "Spot Check",
      collecting: "Collecting",
      reviewing: "Reviewing",
      complete: "Complete",
      submitted: "Submitted",
    };
    this.$phase.textContent = labels[phase] || phase;
  };

  IRIWidget.prototype._updateProgress = function (data) {
    if (data.total_steps && data.current_step_index != null) {
      this.$progress.classList.add("visible");
      var pct = Math.min(100, Math.round((data.current_step_index / data.total_steps) * 100));
      this.$progressFill.style.width = pct + "%";
      var stepName = data.current_step || "Step " + (data.current_step_index + 1);
      this.$progressLabel.textContent = stepName + " (" + (data.current_step_index + 1) + "/" + data.total_steps + ")";
    }
  };

  IRIWidget.prototype._setTyping = function (active) {
    this.$typing.classList.toggle("active", active);
  };

  IRIWidget.prototype._setInputEnabled = function (enabled) {
    this.$input.disabled = !enabled;
    this.$sendBtn.disabled = !enabled;
    if (enabled) this.$input.focus();
  };

  IRIWidget.prototype._emit = function (name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail }));
  };

  // --------------- PUBLIC API ---------------
  window.IRIChat = {
    _initialized: false,
    _instance: null,

    init: function (opts) {
      if (this._instance) return this._instance;
      this._initialized = true;
      this._instance = new IRIWidget(opts || {});
      return this._instance;
    },
  };

  // --------------- AUTO-INIT FROM SCRIPT TAG ---------------
  var scripts = document.getElementsByTagName("script");
  var currentScript = scripts[scripts.length - 1];

  // Check for data attributes
  var productId = currentScript.getAttribute("data-product-id");
  var knownDataRaw = currentScript.getAttribute("data-known-data");
  var theme = currentScript.getAttribute("data-theme");
  var position = currentScript.getAttribute("data-position");
  var containerId = currentScript.getAttribute("data-container");
  var apiBase = currentScript.getAttribute("data-api-base");

  var knownData = {};
  if (knownDataRaw) {
    try { knownData = JSON.parse(knownDataRaw); } catch (e) { /* ignore */ }
  }

  // Infer apiBase from script src if not explicitly set
  if (!apiBase && currentScript.src) {
    try {
      var url = new URL(currentScript.src);
      apiBase = url.origin;
    } catch (e) { /* ignore */ }
  }

  // Auto-init if product-id is set
  if (productId || containerId) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        IRIChat.init({
          productId: productId || "",
          knownData: knownData,
          apiBase: apiBase || "",
          theme: theme || "light",
          position: position || "bottom-right",
          containerId: containerId || null,
        });
      });
    } else {
      IRIChat.init({
        productId: productId || "",
        knownData: knownData,
        apiBase: apiBase || "",
        theme: theme || "light",
        position: position || "bottom-right",
        containerId: containerId || null,
      });
    }
  }
})();
