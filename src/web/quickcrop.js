// web/quickcrop.js
// QuickSize › QuickCrop — Visual crop editor over the actual upstream image (when file-backed).
// Fallback: checkerboard + hint to add Preview Image upstream.

app.registerExtension({
  name: "QuickSize.QuickCrop",
  async beforeRegisterNodeDef(nodeType, nodeData, appRef) {
    if (nodeData?.name !== "QuickCrop") return;

    // ---------- utils ----------
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

    // Try to find a file-backed upstream image node we can fetch via /view?filename=
    // We walk one hop upstream (the image input) and check common node types.
    function resolveUpstreamImageURL(node) {
      // Find the incoming link to the "image" input
      const input = node.inputs?.find((i) => i.name === "image");
      if (!input || input.link == null) return null;

      const link = app.graph.links[input.link];
      if (!link) return null;

      const srcNode = app.graph._nodes_by_id?.[link.origin_id];
      if (!srcNode) return null;

      // Heuristics for common file-backed nodes
      // - Load Image: widget "image" (string path)
      // - Preview Image (and some variants): widget "filename" or "image"
      // - Save Image: last saved filename may be in "filename_prefix" + known pattern, but not guaranteed
      // We check a few common widget names that hold a filename.
      const filenameWidgetNames = ["image", "filename", "file", "filepath"];
      for (const wname of filenameWidgetNames) {
        const w = srcNode.widgets?.find((w) => w.name === wname && typeof w.value === "string" && w.value.length);
        if (w && w.value) {
          // Build ComfyUI's standard view URL
          const url = `/view?filename=${encodeURIComponent(w.value)}`;
          return { url, widthHint: null, heightHint: null };
        }
      }

      // Some preview nodes store a list (array) or object:
      const wAny = srcNode.widgets?.find((w) => Array.isArray(w.value) || (w.value && typeof w.value === "object"));
      if (wAny && wAny.value) {
        // Try common shapes: {image: "path"} or ["path"]
        if (Array.isArray(wAny.value) && wAny.value.length && typeof wAny.value[0] === "string") {
          return { url: `/view?filename=${encodeURIComponent(wAny.value[0])}`, widthHint: null, heightHint: null };
        }
        if (typeof wAny.value === "object" && typeof wAny.value.image === "string") {
          return { url: `/view?filename=${encodeURIComponent(wAny.value.image)}`, widthHint: null, heightHint: null };
        }
      }

      // Give up
      return null;
    }

    // ---------- editor ----------
    function addEditButton(node) {
      const exists = node.widgets?.some((w) => w.name === "__quickcrop_btn");
      if (exists) return;
      const btn = node.addWidget("button", "Edit Crop", null, () => openEditor(node));
      btn.name = "__quickcrop_btn";
      btn.serialize = false;
    }

    async function openEditor(node) {
      let x = getNumeric(node, "x", 0);
      let y = getNumeric(node, "y", 0);
      let width = getNumeric(node, "width", 512);
      let height = getNumeric(node, "height", 512);

      // Overlay
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
        width: "min(92vw, 1200px)",
        height: "min(90vh, 860px)",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: "8px",
        color: "#eee",
        boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
      });

      const header = document.createElement("div");
      header.textContent = "QuickCrop — Visual Editor";
      header.style.fontWeight = "600";

      const canvasWrap = document.createElement("div");
      Object.assign(canvasWrap.style, {
        position: "relative",
        overflow: "auto",
        background: "#0d0d0d",
        borderRadius: "8px",
        border: "1px solid #333",
      });

      const canvas = document.createElement("canvas");
      canvasWrap.appendChild(canvas);

      const footer = document.createElement("div");
      Object.assign(footer.style, {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        justifyContent: "space-between",
      });

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
      const fitBtn = mkBtn("Fit to Image");
      const hint = document.createElement("div");
      Object.assign(hint.style, { color: "#aaa", fontSize: "12px", paddingLeft: "6px" });
      hint.textContent = "";

      const btnsL = document.createElement("div"); btnsL.appendChild(hint);
      const btnsR = document.createElement("div"); Object.assign(btnsR.style, { display: "flex", gap: "8px" });
      btnsR.append(fitBtn, applyBtn, cancelBtn);
      footer.append(fields, btnsL, btnsR);

      panel.append(header, canvasWrap, footer);
      overlay.append(panel);
      document.body.appendChild(overlay);

      // ---------- image load ----------
      const ctx = canvas.getContext("2d");
      let imgBitmap = null;
      let imgW = 0, imgH = 0;

      const resolved = resolveUpstreamImageURL(node);
      if (resolved?.url) {
        try {
          const resp = await fetch(resolved.url, { cache: "no-cache" });
          if (resp.ok) {
            const blob = await resp.blob();
            imgBitmap = await createImageBitmap(blob);
            imgW = imgBitmap.width;
            imgH = imgBitmap.height;
            canvas.width = imgW;
            canvas.height = imgH;
            hint.textContent = "";
          } else {
            fallbackCanvas();
          }
        } catch (e) {
          fallbackCanvas();
        }
      } else {
        fallbackCanvas();
      }

      function fallbackCanvas() {
        // No file-backed upstream — instruct the user
        hint.textContent = "Tip: add a ‘Preview Image’ node directly upstream so QuickCrop can display the real image.";
        // Size canvas generously using current crop box so guides are visible
        canvas.width = Math.max(512, x + width);
        canvas.height = Math.max(512, y + height);
      }

      // ---------- draw & interaction ----------
      function draw() {
        // background
        if (imgBitmap) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);
          // darken outside crop
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(0, 0, canvas.width, y);
          ctx.fillRect(0, y + height, canvas.width, canvas.height - (y + height));
          ctx.fillRect(0, y, x, height);
          ctx.fillRect(x + width, y, canvas.width - (x + width), height);
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
          // lighten crop area to hint
          ctx.save();
          ctx.fillStyle = "rgba(64,80,128,0.65)";
          ctx.fillRect(x, y, width, height);
          ctx.restore();
        }

        // guides
        ctx.strokeStyle = "#5ac8fa";
        ctx.lineWidth = 2;
        // verticals
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + width, 0); ctx.lineTo(x + width, canvas.height); ctx.stroke();
        // horizontals
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y + height); ctx.lineTo(canvas.width, y + height); ctx.stroke();

        // corner handles
        ctx.fillStyle = "#ffd60a";
        const handles = [
          { cx: x, cy: y }, { cx: x + width, cy: y },
          { cx: x, cy: y + height }, { cx: x + width, cy: y + height },
        ];
        for (const h of handles) {
          ctx.beginPath(); ctx.arc(h.cx, h.cy, 5, 0, Math.PI * 2); ctx.fill();
        }
      }

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
          width += (x - nx); x = nx;
        } else if (guide === "right") {
          const rx = Math.max(x + 1, Math.min(mx, canvas.width));
          width = rx - x;
        } else if (guide === "top") {
          const ny = Math.max(0, Math.min(my, y + height - 1));
          height += (y - ny); y = ny;
        } else if (guide === "bottom") {
          const by = Math.max(y + 1, Math.min(my, canvas.height));
          height = by - y;
        }
        syncFieldsFromState();
        draw();
      });

      window.addEventListener("mouseup", () => { guide = null; });

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
        // Clamp to image/canvas bounds
        if (imgBitmap) {
          x = Math.min(x, Math.max(0, canvas.width - 1));
          y = Math.min(y, Math.max(0, canvas.height - 1));
          width = Math.min(width, canvas.width - x);
          height = Math.min(height, canvas.height - y);
        }
        draw();
      }
      [xF.input, yF.input, wF.input, hF.input].forEach(inp => inp.addEventListener("input", syncStateFromFields));

      applyBtn.addEventListener("click", () => {
        setNumeric(node, "x", x);
        setNumeric(node, "y", y);
        setNumeric(node, "width", width);
        setNumeric(node, "height", height);
        document.body.removeChild(overlay);
        app.graph.setDirtyCanvas(true, true);
      });
      cancelBtn.addEventListener("click", () => document.body.removeChild(overlay));
      fitBtn.addEventListener("click", () => {
        x = 0; y = 0; width = canvas.width; height = canvas.height;
        syncFieldsFromState(); draw();
      });

      // init
      // If the crop box is outside the image (e.g., defaults), clamp it.
      if (imgBitmap) {
        x = Math.min(x, Math.max(0, canvas.width - 1));
        y = Math.min(y, Math.max(0, canvas.height - 1));
        width = Math.min(width, Math.max(1, canvas.width - x));
        height = Math.min(height, Math.max(1, canvas.height - y));
      }
      syncFieldsFromState();
      draw();
    }

    // Hook into node lifecycle
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

