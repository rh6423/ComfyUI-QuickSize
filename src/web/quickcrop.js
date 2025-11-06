// ComfyUI-QuickSize/src/web/quickcrop.js
// Robust binding for the QuickCrop visual editor button.
// No imports; uses global `app` exposed by ComfyUI.

(function () {
  const EXT_NAME = "QuickSize.QuickCrop";
  const BTN_SENTINEL = "__quickcrop_btn";

  function log(...args) {
    console.log(`[${EXT_NAME}]`, ...args);
  }

  function isQuickCropDef(nodeData) {
    // Match by either identifier Comfy might provide
    return nodeData?.name === "QuickCrop" || nodeData?.comfyClass === "QuickCrop";
  }

  function ensureButton(node) {
    try {
      if (!node?.addWidget) return;
      if (node.widgets && node.widgets.find(w => w.name === BTN_SENTINEL)) return;
      const btn = node.addWidget("button", "Edit Crop", null, () => {
        window.dispatchEvent(new CustomEvent(`${EXT_NAME}.open`, { detail: { node } }));
      });
      btn.name = BTN_SENTINEL; // sentinel to avoid duplicates
      btn.serialize = false;
      log("Button injected on node instance:", node?.title || node?.type || node);
    } catch (e) {
      console.error(`[${EXT_NAME}] failed to add button`, e);
    }
  }

  // Minimal modal to prove the hook works; replace with your full editor later
  function openDebugModal(node) {
    const dlg = document.createElement("dialog");
    dlg.style.padding = "0";
    dlg.style.border = "none";
    dlg.innerHTML = `
      <div style="padding:16px; background: var(--comfy-menu-bg); color: var(--input-text); min-width: 420px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <b>QuickCrop — Visual Editor</b>
          <button id="qc-close">Close</button>
        </div>
        <div style="opacity:.8; font-size: 13px; margin-bottom: 8px;">
          Debug modal is opening (JS is bound). Replace with full editor when confirmed.
        </div>
        <div style="border:1px solid var(--border-color); padding:8px;">
          Node: <code>${node?.title || node?.type}</code>
        </div>
      </div>`;
    dlg.querySelector("#qc-close").onclick = () => { dlg.close(); dlg.remove(); };
    document.body.appendChild(dlg);
    dlg.showModal();
  }

  window.addEventListener(`${EXT_NAME}.open`, (ev) => {
    const node = ev.detail?.node;
    if (!node) return;
    // TODO: swap this with the real editor call once the button shows up.
    openDebugModal(node);
  });

  app.registerExtension({
    name: `${EXT_NAME}.Binder`,
    setup() {
      log("JS loaded, waiting for node defs…");
    },
    beforeRegisterNodeDef(nodeType, nodeData) {
      if (!isQuickCropDef(nodeData)) return;

      log("Binding (beforeRegisterNodeDef) to:", nodeData?.name || nodeData?.comfyClass);

      // Hook 1: creation
      const oldCreated = nodeType.prototype.onCreated || nodeType.prototype.onNodeCreated;
      nodeType.prototype.onCreated = function () {
        oldCreated?.apply(this, arguments);
        ensureButton(this);
      };

      // Hook 2: config (nodes loaded from workflow)
      const oldConfigure = nodeType.prototype.onConfigure;
      nodeType.prototype.onConfigure = function () {
        oldConfigure?.apply(this, arguments);
        ensureButton(this);
      };

      // Hook 3: (older builds) also patch onNodeCreated if present
      if (nodeType.prototype.onNodeCreated && nodeType.prototype.onNodeCreated !== nodeType.prototype.onCreated) {
        const oldNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
          oldNodeCreated?.apply(this, arguments);
          ensureButton(this);
        };
      }
    },
    afterRegisterNodeDef(nodeType, nodeData) {
      // Some builds prefer after*; bind again just in case
      if (!isQuickCropDef(nodeData)) return;
      log("Confirmed def (afterRegisterNodeDef):", nodeData?.name || nodeData?.comfyClass);
    },
  });
})();
