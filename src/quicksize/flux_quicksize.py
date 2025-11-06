# flux_quicksize.py
# ComfyUI Custom Node: Quick Size (Flux)
# Outputs two INTs: width, height

def _snap8(x: int) -> int:
    # Comfy/SD models are happiest with multiples of 8 (often 64). Keep it simple.
    return max(1, int(x // 8) * 8)

class QuickSizeFluxNode:
    """
    Quick Size (Flux)
    - 'preset' shows ratios only (e.g., '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '21:9')
    - '1.5x' toggle selects the larger tier (matches SDXL node design language)
    - Orientation:
        * horizontal -> width := larger, height := smaller
        * vertical   -> height := larger, width := smaller
    """

    # Offered aspect presets (ratios only in the UI)
    ASPECT_KEYS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "21:9"]

    # --- IMPORTANT ---
    # If you want *your exact previous sizes*, paste them into RES_1X and RES_15X below.
    # I seeded these with safe, common ~1.0MP sizes (multiples of 64 where practical).
    # These are UNORIENTED (w,h) before the orientation swap.

    # ≈ 1.0 MP tier
    RES_1X = {
        "1:1":  (1024, 1024),   # 1.05 MP
        "3:2":  (1216,  832),   # 1.01 MP (approx 3:2)
        "2:3":  ( 832, 1216),   # 1.01 MP
        "4:3":  (1152,  864),   # 0.99 MP (close; std 1024x768 is 0.79)
        "3:4":  ( 864, 1152),   # 0.99 MP
        "16:9": (1344,  768),   # 1.03 MP (1280x720 is 0.92)
        "21:9": (1472,  640),   # 0.94 MP (close; wides)
    }

    # ≈ 1.5 MP tier (scaled ≈ sqrt(1.5) from the above, then snapped to /8)
    # If your old Flux node had explicit 1.5 MP entries, paste them here to match exactly.
    RES_15X = {
        "1:1":  (1152, 1152),   # 1.33 MP (conservative; feel free to paste your own)
        "3:2":  (1408,  928),   # ~1.31 MP
        "2:3":  ( 928, 1408),   # ~1.31 MP
        "4:3":  (1344, 1008),   # ~1.36 MP
        "3:4":  (1008, 1344),   # ~1.36 MP
        "16:9": (1536,  864),   # 1.33 MP
        "21:9": (1696,  736),   # 1.25 MP
    }

    # --- Former 2.0 MP tier (REQUESTED: comment out existing 2.0MP sizes) ---
    # If your old file exposed a "2.0" table, keep it here commented out.
    # RES_2X = {
    #     "1:1":  (1440, 1440),   # 2.07 MP
    #     "3:2":  (1664, 1104),   # ~1.84 MP
    #     "2:3":  (1104, 1664),   # ~1.84 MP
    #     "4:3":  (1600, 1200),   # 1.92 MP
    #     "3:4":  (1200, 1600),   # 1.92 MP
    #     "16:9": (1792, 1008),   # 1.81 MP
    #     "21:9": (1952,  848),   # 1.65 MP
    # }

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "preset": (cls.ASPECT_KEYS, {"default": "1:1"}),
                # matches SDXL node: a simple toggle for the larger tier
                "1.5x": ("BOOLEAN", {"default": False}),
                "orientation": (["horizontal", "vertical"], {"default": "horizontal"}),
            }
        }

    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("width", "height")
    FUNCTION = "choose"
    CATEGORY = "QuickSize"

    def choose(self, preset: str, **kwargs):
        orientation = kwargs.get("orientation", "horizontal")
        is_15x = kwargs.get("1.5x", False)

        table = self.RES_15X if is_15x else self.RES_1X
        aspect = preset if preset in table else "1:1"

        w, h = table[aspect]

        # Normalize & snap, keep integers
        w = _snap8(int(w))
        h = _snap8(int(h))

        # Enforce orientation swap
        larger, smaller = (w, h) if w >= h else (h, w)
        if orientation == "horizontal":
            width, height = larger, smaller
        else:
            width, height = smaller, larger

        return (int(width), int(height))


# ---- ComfyUI registration ----
NODE_CLASS_MAPPINGS = {
    "QuickSizeFluxNode": QuickSizeFluxNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "QuickSizeFluxNode": "Quick Size (Flux)",
}
