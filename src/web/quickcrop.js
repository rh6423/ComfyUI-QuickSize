// web/quickcrop.js
// Frontend extension for QuickSize › QuickCrop
// Adds a modal crop editor with draggable guides that syncs with x/y/width/height

app.registerExtension({
  name: "QuickSize.QuickCrop",
  async beforeRegisterNodeDef(nodeType, nodeData, appRef) {
    // ✅ Attach ONLY to our QuickCrop node
    if (nodeData?.name !== "QuickCrop") return;

    // --- Helpers ------------------------------------------------------------
    function addEditButton(node) {
      // Avoid duplicating the button if node is reloaded from a workflow
      const exists = node.widgets?.some((w) => w.name === "__quickcrop_btn");
      if (exists) return;

      const btn = node.addWidget("button", "Edit Crop", null, () => openEditor(node));
      btn.name = "__quickcrop_btn"; // sentinel so we can detect it later
      btn.serialize = false;
    }

    function getWidget(node, name) {
      return node.widgets?.find((w) => w.name === name);
    }

    function getNumeric(node, name, fallback) {
      const w = getWidget(node, name);
      return w ? Number(w.value) : fallback;
    }

    function setNumeric(node, name, value) {
      const w = getWidget(node, name);
      if (w) w.value = Math.round(Number(value));
    }

    // --- Modal Editor -------------------------------------------------------
    async function openEditor(node) {
      // Pull current values from node
      let x = getNumeric(node, "x", 0);
      let y = getNumeric(node, "y", 0);
      let width = getNumeric(node, "width", 512);
      let height = getNumeric(node, "height", 512);

      // Build overlay
      const overlay = document.createElement("div");
      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.65)",
        zIndex: "10000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });

      const panel = document.createElement("div");
      Object.assign(panel.style, {
        background: "#1e1e1e",
        border: "1px solid #444",
        borderRadius: "12px",
        padding: "12px",
        width: "min(92vw, 1100px)",
        height: "min(88vh, 800px)",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: "8px",
        color: "#eee",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
      });

      const header = document.createElement("div");
      header.textContent = "QuickCrop — Interactive Crop";
      header.style.fontWeight = "600";

      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      // Default canvas size — we’ll expand to encompass the crop box so the guides are visible
      canvas.width = Math.min(2048, Math.max(512, x + width));
      canvas.height = Math.min(2048, Math.max(512, y + height));

      const footer = document.createElement("div");
      footer.style.display = "flex";
      footer.style.gap = "8px";
      footer.style.alignItems = "center";
      footer.style.justifyContent = "space-between";

      // Numeric controls
      const fields = document.createElement("div");
      Object.assign(fields.style, {
        display: "grid",
        gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
        gap: "6px",
      });

      function mkField(label, initial) {
        const span = document.createElement("span");
        span.textContent = label;
        span.style.alignSelf = "center";
        const input = document.createElement("input");
        input.type = "number";
        input.value = initial ?? 0;
        Object.assign(input.style, {
          background: "#111",
          color: "#ddd",
          border: "1px solid #333",
          borderRadius: "8px",
          padding: "6px 8px",
        });
        return { span, input };
      }

      const xF = mkField("x", x);
      const yF = mkField("y", y);
      const wF = mkField("width", width);
      const hF = mkField("height", height);
      [xF, yF, wF, hF].forEach(({ span, input }) => fields.append(span, input));

      // Buttons
      const btns = document.createElement("div");
      btns.style.display = "flex";
      btns.style.gap = "8px";

      function mkBtn(label) {
        const b = document.createElement("button");
        b.textContent = label;
        Object.assign(b.style, {
          background: "#2a2a2a",
          color: "#ddd",
          border: "1px solid #444",
          borderRadius: "8px",
          padding: "8px 12px",
          cursor: "pointer",
        });
        return b;
      }

      const applyBtn = mkBtn("Apply");
      const cancelBtn = mkBtn("Cancel");
      const fitBtn = mkBtn("Fit to Canvas");
      btns.append(applyBtn, cancelBtn, fitBtn);

      footer.append(fields, btns);
      panel.append(header, canvas, footer);
      overlay.append(panel);
      document.body.appendChild(overlay);

      // Canvas & drawing
      const ctx = canvas.getContext("2d");

      // Attempt to size canvas more generously if user types larger values
      function growCanvasIfNeeded() {
        const needW = Math.max(canvas.width, x + width, 512);
        const needH = Math.max(canvas.height, y + height, 512);
        const cap = 4096;
        const newW = Math.min(cap, needW);
        const newH = Math.min(cap, needH);
        if (newW !== canvas.width || newH !== canvas.height) {
          canvas.width = newW;
          canvas.height = newH;
        }
      }

      function draw() {
        // Background checker
        ctx.fillStyle = "#0d0d0d";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cell = 16;
        for (let i = 0; i < canvas.width; i += cell) {
          for (let j = 0; j < canvas.height; j += cell) {
            if (((i + j) / cell) % 2 === 0) {
              ctx.fillStyle = "#111";
              ctx.fillRect(i, j, cell, cell);
            }
          }
        }

        // Crop rect fill
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = "#202a44";
        ctx.fillRect(x, y, width, height);
        ctx.restore();

        // Guides
        ctx.strokeStyle = "#5ac8fa";
        ctx.lineWidth = 2;

        // Vertical lines
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + width, 0); ctx.lineTo(x + width, canvas.height); ctx.stroke();

        // Horizontal lines
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y + height); ctx.lineTo(canvas.width, y + height); ctx.stroke();

        // Corner handles
        ctx.fillStyle = "#ffd60a";
        const handles = [
          { cx: x, cy: y },
          { cx: x + width, cy: y },
          { cx: x, cy: y + height },
          { cx: x + width, cy: y + height },
        ];
        for (const h of handles) {
          ctx.beginPath(); ctx.arc(h.cx, h.cy, 5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Guide picking/dragging
      let guide = null; // 'left'|'right'|'top'|'bottom'
      function pickGuide(mx, my) {
        const tol = 6;
        if (Math.abs(mx - x) <= tol) return "left";
        if (Math.abs(mx - (x + width)) <= tol) return "right";
        if (Math.abs(my - y) <= tol) return "top";
        if (Math.abs(my - (y + height)) <= tol) return "bottom";
        return null;
      }

      canvas.addEventListener("mousedown", (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        guide = pickGuide(mx, my);
      });

      window.addEventListener("mousemove", (e) => {
        if (!guide) return;
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;

        if (guide === "left") {
          const nx = Math.max(0, Math.min(mx, x + width - 1));
          width += (x - nx);
          x = nx;
        } else if (guide === "right") {
          const rx = Math.max(x + 1, mx);
          width = rx - x;
        } else if (guide === "top") {
          const ny = Math.max(0, Math.min(my, y + height - 1));
          height += (y - ny);
          y = ny;
        } else if (guide === "bottom") {
          const by = Math.max(y + 1, my);
          height = by - y;
        }

        // Sync numeric fields
        syncFieldsFromState();
        growCanvasIfNeeded();
        draw();
      });

      window.addEventListener("mouseup", () => { guide = null; });

      // Sync helpers
      function syncFieldsFromState() {
        xF.input.value = Math.round(x);
        yF.input.value = Math.round(y);
        wF.input.value = Math.round(width);
        hF.input.value = Math.round(height);
      }

      function syncStateFromFields() {
        x = Math.max(0, parseInt(xF.input.value || "0"));
        y = Math.max(0, parseInt(yF.input.value || "0"));
        width = Math.max(1, parseInt(wF.input.value || "1"));
        height = Math.max(1, parseInt(hF.input.value || "1"));
        growCanvasIfNeeded();
        draw();
      }

      [xF.input, yF.input, wF.input, hF.input].forEach((inp) =>
        inp.addEventListener("input", syncStateFromFields)
      );

      // Buttons wiring
      applyBtn.addEventListener("click", () => {
        setNumeric(node, "x", x);
        setNumeric(node, "y", y);
        setNumeric(node, "width", width);
        setNumeric(node, "height", height);
        document.body.removeChild(overlay);
        app.graph.setDirtyCanvas(true, true);
      });

      cancelBtn.addEventListener("click", () => {
        document.body.removeChild(overlay);
      });

      fitBtn.addEventListener("click", () => {
        x = 0; y = 0; width = canvas.width; height = canvas.height;
        syncFieldsFromState();
        draw();
      });

      // Init
      syncFieldsFromState();
      draw();
    }

    // --- Hook into node lifecycle ------------------------------------------
    const onCreated = nodeType.prototype.onCreated;
    nodeType.prototype.onCreated = function () {
      onCreated?.apply(this, arguments);
      addEditButton(this);
    };

    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (o) {
      onConfigure?.apply(this, arguments);
      addEditButton(this);
    };
  },
});

