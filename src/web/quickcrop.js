// ComfyUI-QuickSize/src/web/quickcrop.js
// QuickSize › QuickCrop: visual crop editor with draggable guides + numeric sync.
// Works on builds where extensions must import the App.

// --- required imports for current ComfyUI builds ---
import { app } from "/scripts/app.js";       // core app / extension API
import { api } from "/scripts/api.js";       // for future use if you add custom routes

(function () {
  const EXT = "QuickSize.QuickCrop";
  const BTN_SENTINEL = "__quickcrop_btn";

  // ---------- utils ----------
  const log = (...a) => console.log(`[${EXT}]`, ...a);
  const err = (...a) => console.error(`[${EXT}]`, ...a);

  function isQuickCropDef(nodeData) {
    // Match both fields (some builds use name, some comfyClass)
    return nodeData?.name === "QuickCrop" || nodeData?.comfyClass === "QuickCrop";
  }

  function getWidget(node, name) {
    return node.widgets?.find?.((w) => w.name === name);
  }
  function getNumeric(node, name, fallback) {
    const w = getWidget(node, name);
    return Number.isFinite(+w?.value) ? +w.value : fallback;
  }
  function setNumeric(node, name, v) {
    const w = getWidget(node, name);
    if (w) w.value = Math.round(Number(v));
  }

  // Try to resolve a file-backed upstream image to draw underneath the guides.
  async function resolveImageURL(node) {
    const input = node.inputs?.find?.((i) => i.name === "image");
    if (!input || input.link == null) return null;

    const link = node.graph.links?.[input.link];
    if (!link) return null;

    const srcNode = node.graph.getNodeById?.(link.origin_id);
    if (!srcNode) return null;

    // common filename-bearing widget names
    const candidates = ["image", "filename", "file", "filepath"];
    for (const nm of candidates) {
      const w = srcNode.widgets?.find?.((w) => w.name === nm && typeof w.value === "string" && w.value.length);
      if (w?.value) return `/view?filename=${encodeURIComponent(w.value)}&type=input`;
    }

    // Sometimes a widget holds an object/array
    const anyW = srcNode.widgets?.find?.((w) => Array.isArray(w.value) || (w.value && typeof w.value === "object"));
    if (anyW?.value) {
      if (Array.isArray(anyW.value) && anyW.value.length && typeof anyW.value[0] === "string") {
        return `/view?filename=${encodeURIComponent(anyW.value[0])}&type=input`;
      }
      if (typeof anyW.value === "object" && typeof anyW.value.image === "string") {
        return `/view?filename=${encodeURIComponent(anyW.value.image)}&type=input`;
      }
    }
    return null;
  }

  // ---------- UI core ----------
  function ensureButton(node) {
  try {
    if (!node?.addWidget) return;
    if (node.widgets?.find?.((w) => w.name === BTN_SENTINEL)) return;

    // Create the visible button
    const btn = node.addWidget("button", "Visual editor", null, () => {
      openEditor(node);
    });

    // Keep an internal sentinel name so it won't duplicate
    btn.name = BTN_SENTINEL;      // internal unique ID
    btn.label = "Visual editor";  // visible label
    btn.serialize = false;

    log("Injected Visual editor button.");
  } catch (e) {
    err("Failed to add button:", e);
  }
}

  async function openEditor(node) {
    // current numeric values
    let x = getNumeric(node, "x", 0);
    let y = getNumeric(node, "y", 0);
    let w = getNumeric(node, "width", 512);
    let h = getNumeric(node, "height", 512);

    // build dialog
    const dlg = document.createElement("dialog");
    dlg.style.padding = "0";
    dlg.style.border = "none";
    dlg.innerHTML = `
      <div style="padding:14px; background: var(--comfy-menu-bg); color: var(--input-text); min-width: 720px; max-width: 92vw;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px;">
          <b>QuickCrop — Visual Editor</b>
          <div style="display:flex; gap:8px;">
            <button id="qc-fit">Fit to Image</button>
            <button id="qc-apply">Apply</button>
            <button id="qc-cancel">Cancel</button>
          </div>
        </div>
        <div id="qc-hint" style="display:none; opacity:.8; font-size:12px; margin-bottom:6px;">
          No file-backed upstream image detected. Add a “Preview Image” or “Load Image” before QuickCrop to see the bitmap.
        </div>
        <div style="position:relative; border:1px solid var(--border-color); border-radius:8px; overflow:auto; max-height:70vh;">
          <canvas id="qc-canvas" style="display:block; max-width:100%"></canvas>
        </div>
        <div style="display:grid; grid-template-columns:repeat(8,1fr); gap:8px; margin-top:10px;">
          <label style="display:flex; gap:6px; align-items:center;">X <input id="qc-x" type="number" style="width:100%"></label>
          <label style="display:flex; gap:6px; align-items:center;">Y <input id="qc-y" type="number" style="width:100%"></label>
          <label style="display:flex; gap:6px; align-items:center;">Width <input id="qc-w" type="number" min="1" style="width:100%"></label>
          <label style="display:flex; gap:6px; align-items:center;">Height <input id="qc-h" type="number" min="1" style="width:100%"></label>
        </div>
      </div>
    `;
    document.body.appendChild(dlg);

    const canvas = dlg.querySelector("#qc-canvas");
    const hint = dlg.querySelector("#qc-hint");
    const xi = dlg.querySelector("#qc-x");
    const yi = dlg.querySelector("#qc-y");
    const wi = dlg.querySelector("#qc-w");
    const hi = dlg.querySelector("#qc-h");
    const btnApply = dlg.querySelector("#qc-apply");
    const btnCancel = dlg.querySelector("#qc-cancel");
    const btnFit = dlg.querySelector("#qc-fit");

    const ctx = canvas.getContext("2d");
    const state = { img: null, scale: 1, x, y, w, h };

    xi.value = x; yi.value = y; wi.value = w; hi.value = h;

    // load upstream image if available
    let imgURL = await resolveImageURL(node);
    if (!imgURL) hint.style.display = "block";

    const img = new Image();
    img.onload = () => {
      const maxW = 1400;
      const ratio = img.width > maxW ? maxW / img.width : 1;
      const cw = Math.max(64, Math.round(img.width * ratio));
      const ch = Math.max(64, Math.round(img.height * ratio));
      canvas.width = cw; canvas.height = ch;
      state.img = img;
      state.scale = cw / img.width;

      // clamp crop to image
      state.x = Math.min(Math.max(0, state.x), img.width - 1);
      state.y = Math.min(Math.max(0, state.y), img.height - 1);
      state.w = Math.min(Math.max(1, state.w), img.width - state.x);
      state.h = Math.min(Math.max(1, state.h), img.height - state.y);

      xi.value = state.x; yi.value = state.y; wi.value = state.w; hi.value = state.h;
      draw();
    };
    img.onerror = () => { hint.style.display = "block"; draw(); };
    img.src = imgURL || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

    function draw() {
      // background
      if (state.img) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(state.img, 0, 0, canvas.width, canvas.height);

        // darken outside crop
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        const sx = state.scale, sy = state.scale;
        const L = state.x * sx, R = (state.x + state.w) * sx;
        const T = state.y * sy, B = (state.y + state.h) * sy;
        ctx.fillRect(0, 0, canvas.width, T);
        ctx.fillRect(0, B, canvas.width, canvas.height - B);
        ctx.fillRect(0, T, L, state.h * sy);
        ctx.fillRect(R, T, canvas.width - R, state.h * sy);
        ctx.restore();
      } else {
        // checkerboard fallback
        ctx.fillStyle = "#0d0d0d";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cell = 16;
        for (let i = 0; i < canvas.width; i += cell) {
          for (let j = 0; j < canvas.height; j += cell) {
            if (((i + j) / cell) % 2 === 0) {
              ctx.fillStyle = "#111"; ctx.fillRect(i, j, cell, cell);
            }
          }
        }
        ctx.save();
        ctx.fillStyle = "rgba(64,80,128,0.65)";
        ctx.fillRect(state.x, state.y, state.w, state.h);
        ctx.restore();
      }

      // guides
      ctx.strokeStyle = "#66ccff";
      ctx.lineWidth = 2;
      const sx = state.scale, sy = state.scale;
      const L = state.x * sx, R = (state.x + state.w) * sx;
      const T = state.y * sy, B = (state.y + state.h) * sy;

      // verticals
      ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(R, 0); ctx.lineTo(R, canvas.height); ctx.stroke();
      // horizontals
      ctx.beginPath(); ctx.moveTo(0, T); ctx.lineTo(canvas.width, T); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, B); ctx.lineTo(canvas.width, B); ctx.stroke();

      // handles
      ctx.fillStyle = "#ffd60a";
      const handles = [{x:L,y:T},{x:R,y:T},{x:L,y:B},{x:R,y:B}];
      for (const h of handles) { ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, Math.PI*2); ctx.fill(); }
    }

    // pick handles/bars
    let drag = null; // 'move'|'left'|'right'|'top'|'bottom'
    canvas.onmousedown = (e) => {
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) / state.scale;
      const py = (e.clientY - r.top) / state.scale;
      drag = pick(px, py);
      canvas.style.cursor = drag ? (drag === "move" ? "grabbing" : "col-resize") : "default";
      canvas._dragOffset = { dx: px - state.x, dy: py - state.y };
    };
    window.onmouseup = () => { drag = null; canvas.style.cursor = "default"; };
    canvas.onmousemove = (e) => {
      const r = canvas.getBoundingClientRect();
      const pxS = (e.clientX - r.left);
      const pyS = (e.clientY - r.top);
      if (!drag) {
        const hover = pick(pxS / state.scale, pyS / state.scale);
        canvas.style.cursor = hover ? (hover === "move" ? "move" : "col-resize") : "default";
        return;
      }
      const px = pxS / state.scale;
      const py = pyS / state.scale;
      const maxW = state.img?.width ?? Math.max(state.x + state.w + 1, 1024);
      const maxH = state.img?.height ?? Math.max(state.y + state.h + 1, 1024);

      if (drag === "move") {
        let nx = Math.round(px - canvas._dragOffset.dx);
        let ny = Math.round(py - canvas._dragOffset.dy);
        nx = Math.max(0, Math.min(nx, maxW - state.w));
        ny = Math.max(0, Math.min(ny, maxH - state.h));
        state.x = nx; state.y = ny;
      } else if (drag === "left") {
        const nx = Math.max(0, Math.min(px, state.x + state.w - 1));
        state.w = Math.round(state.w + (state.x - nx));
        state.x = Math.round(nx);
      } else if (drag === "right") {
        const rx = Math.max(state.x + 1, Math.min(px, maxW));
        state.w = Math.round(rx - state.x);
      } else if (drag === "top") {
        const ny = Math.max(0, Math.min(py, state.y + state.h - 1));
        state.h = Math.round(state.h + (state.y - ny));
        state.y = Math.round(ny);
      } else if (drag === "bottom") {
        const by = Math.max(state.y + 1, Math.min(py, maxH));
        state.h = Math.round(by - state.y);
      }

      // sync fields
      xi.value = state.x; yi.value = state.y; wi.value = state.w; hi.value = state.h;
      draw();
    };

    function pick(px, py) {
      const tol = 6;
      const L = state.x, R = state.x + state.w, T = state.y, B = state.y + state.h;
      if (Math.abs(px - L) < tol) return "left";
      if (Math.abs(px - R) < tol) return "right";
      if (Math.abs(py - T) < tol) return "top";
      if (Math.abs(py - B) < tol) return "bottom";
      if (px > L && px < R && py > T && py < B) return "move";
      return null;
    }

    // numeric inputs
    [ [xi,"x"], [yi,"y"], [wi,"w"], [hi,"h"] ].forEach(([el,key]) => {
      el.oninput = () => {
        const v = Math.max(0, Math.round(+el.value || 0));
        state[key] = v;
        // Clamp to image bounds if we have them
        if (state.img) {
          state.x = Math.min(state.x, Math.max(0, state.img.width - 1));
          state.y = Math.min(state.y, Math.max(0, state.img.height - 1));
          state.w = Math.min(state.w, Math.max(1, state.img.width - state.x));
          state.h = Math.min(state.h, Math.max(1, state.img.height - state.y));
          xi.value = state.x; yi.value = state.y; wi.value = state.w; hi.value = state.h;
        }
        draw();
      };
    });

    // buttons
    btnApply.onclick = () => {
      setNumeric(node, "x", state.x);
      setNumeric(node, "y", state.y);
      setNumeric(node, "width", state.w);
      setNumeric(node, "height", state.h);
      dlg.close(); dlg.remove();
      app.graph.setDirtyCanvas(true, true);
    };
    btnCancel.onclick = () => { dlg.close(); dlg.remove(); };
    btnFit.onclick = () => {
      if (state.img) {
        state.x = 0; state.y = 0; state.w = state.img.width; state.h = state.img.height;
        xi.value = state.x; yi.value = state.y; wi.value = state.w; hi.value = state.h;
      } else {
        state.x = 0; state.y = 0; state.w = canvas.width; state.h = canvas.height;
        xi.value = state.x; yi.value = state.y; wi.value = state.w; hi.value = state.h;
      }
      draw();
    };

    dlg.showModal();
  }

  // ---------- bind to node definition ----------
  app.registerExtension({
    name: `${EXT}.Binder`,
    setup() { log("Loaded."); },
    beforeRegisterNodeDef(nodeType, nodeData) {
      if (!isQuickCropDef(nodeData)) return;
      log("Binding to:", nodeData?.name || nodeData?.comfyClass);

      const oldCreated = nodeType.prototype.onCreated || nodeType.prototype.onNodeCreated;
      nodeType.prototype.onCreated = function () {
        oldCreated?.apply(this, arguments);
        ensureButton(this);
      };

      const oldConfigure = nodeType.prototype.onConfigure;
      nodeType.prototype.onConfigure = function () {
        oldConfigure?.apply(this, arguments);
        ensureButton(this);
      };

      // For older builds that still use onNodeCreated distinctly:
      if (nodeType.prototype.onNodeCreated && nodeType.prototype.onNodeCreated !== nodeType.prototype.onCreated) {
        const oldNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
          oldNodeCreated?.apply(this, arguments);
          ensureButton(this);
        };
      }
    },
    afterRegisterNodeDef(nodeType, nodeData) {
      if (isQuickCropDef(nodeData)) log("Definition confirmed:", nodeData?.name || nodeData?.comfyClass);
    },
  });
})();
// --- QuickSize per-node HELP hook (title-bar "?" button) ---------------------
// --- QuickSize per-node HELP hook (title-bar "?" button) ---------------------
// Uses both: immediate patch of registered nodes + hook for future registrations.
// (No new imports here.)

(function () {
  const EXT_NAME = "QuickSize.Help";
  const HELPABLE = new Set([
    "QuickSizeFluxNode",
    "QuickCropNode",
    // add others: "QuickSizeSDXLNode", "QuickSizeSD15Node", "QuickSizeWANNode", "QuickSizeQwenNode"
  ]);

  const log = (...a) => console.log(`[${EXT_NAME}]`, ...a);
  const warn = (...a) => console.warn(`[${EXT_NAME}]`, ...a);

  function docUrlFor(nodeKey) {
    return `/extensions/ComfyUI-QuickSize/docs/${encodeURIComponent(nodeKey)}.md`;
  }

  // Title-height helper
  function getTitleHeight() {
    const LG = window.LiteGraph;
    return (LG && LG.NODE_TITLE_HEIGHT) ? LG.NODE_TITLE_HEIGHT : 24;
  }

  function patchNodeType(nodeKey, nodeType) {
    if (!HELPABLE.has(nodeKey) || !nodeType || nodeType.__qs_help_patched) return;
    nodeType.__qs_help_patched = true;

    const url = docUrlFor(nodeKey);

    // Context menu item
    const prevMenu = nodeType.prototype.getExtraMenuOptions;
    nodeType.prototype.getExtraMenuOptions = function (_, options) {
      prevMenu?.call(this, _, options);
      options.push({ content: "Help…", callback: () => openHelp(url, this) });
    };

    // Draw "?" in title bar
    const prevDraw = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
  prevDraw?.call(this, ctx);

  const th = getTitleHeight();
  const r = 7;            // smaller radius
  const pad = 6;          // right padding
  const x = this.size[0] - (r + pad);
  const y = Math.floor(th / 2) + 1; // vertically center in title

  // --- ensure it's drawn BEFORE connectors (z-index-ish trick) ---
  ctx.save();
  ctx.globalCompositeOperation = "source-over"; // force on top
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#3aa0ff";
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", x, y + 0.3);
  ctx.restore();

  // hitbox: only the title bar area
  this.__qs_help_hit = { x: x - r - 2, y: 0, w: r * 2 + pad + 4, h: th, url };
};


    // Click handler in title band
    const prevMouseDown = nodeType.prototype.onMouseDown;
    nodeType.prototype.onMouseDown = function (e, pos, gc) {
      const hit = this.__qs_help_hit;
      if (hit) {
        const [px, py] = pos;
        if (px >= hit.x && px <= hit.x + hit.w && py >= hit.y && py <= hit.h) {
          openHelp(hit.url, this);
          return true;
        }
      }
      return prevMouseDown ? prevMouseDown.call(this, e, pos, gc) : false;
    };

    log(`patched ${nodeKey}`);
  }

  // Prefer built-in Docs pane; fallback to opening MD
  function openHelp(url, node) {
    try {
      if (app?.ui?.showNodeHelp && node) {
        const gc = app.canvas;
        if (gc && !node.selected) gc.selectNode(node, false);
        app.ui.showNodeHelp();
      } else {
        window.open(url, "_blank");
      }
    } catch {
      window.open(url, "_blank");
    }
  }

  // 1) Patch anything already registered
  function patchExisting() {
    const LG = window.LiteGraph;
    if (!LG || !LG.registered_node_types) {
      warn("LiteGraph not ready yet; will patch after setup.");
      return;
    }
    for (const [key, nt] of Object.entries(LG.registered_node_types)) {
      // keys look like "category/QuickSizeFluxNode" or "QuickSizeFluxNode"
      const nodeKey = key.split("/").pop();
      patchNodeType(nodeKey, nt);
    }
  }

  // 2) Hook future registrations via Comfy’s extension API
  app.registerExtension({
    name: EXT_NAME,
    setup() {
      log("loaded; patching existing types…");
      patchExisting();
    },
    // This will run for nodes registered after our extension loads
    afterRegisterNodeDef(nodeType, nodeData) {
      const nodeKey = nodeData?.name || nodeData?.comfyClass;
      if (nodeKey) patchNodeType(nodeKey, nodeType);
    },
  });

  // 3) Also attempt a delayed patch in case LiteGraph was late to init
  setTimeout(patchExisting, 0);
})();

