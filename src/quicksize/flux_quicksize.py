# flux_quicksize.py
# ComfyUI Custom Node: Quick Size (Flux)
# Outputs two INTs: width, height

class QuickSizeFluxNode:
    """
    Quick Size (Flux)
    - 'preset' shows ratios only (e.g., '4:3', '16:9')
    - '1.5x' toggle scales up to larger dimensions (matches SDXL layout)
    - Orientation:
        * horizontal -> width := larger, height := smaller
        * vertical   -> height := larger, width := smaller
    """

    ASPECT_KEYS = ["1:1", "2:3", "4:3", "16:9", "21:9"]

    # Base resolutions
    RES_1X = {
        "1:1":  (1024, 1024),
        "2:3":  (832, 1216),
        "4:3":  (1152, 896),
        "16:9": (1344, 768),
        "21:9": (1536, 640),
    }

    # 1.5x tier
    RES_15X = {
        "1:1":  (1536, 1536),
        "2:3":  (1248, 1824),
        "4:3":  (1728, 1344),
        "16:9": (2016, 1152),
        "21:9": (2304, 960),
    }

    # Commented out 2.0 tier for reference
    # RES_2X = {
    #     "1:1":  (1408, 1408),
    #     "2:3":  (1728, 1152),
    #     "4:3":  (1664, 1216),
    #     "16:9": (1920, 1088),
    #     "21:9": (2176, 960),
    # }

    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("width", "height")
    FUNCTION = "get_size"
    CATEGORY = "image/utils"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "preset": (cls.ASPECT_KEYS, {"default": "1:1"}),
                "orientation": (["horizontal", "vertical"], {"default": "horizontal"}),
                "1.5x": ("BOOLEAN", {"default": False}),  # now placed last, like SDXL
            }
        }

    def get_size(self, preset: str, orientation: str, **kwargs):
        is_15x = kwargs.get("1.5x", False)
        table = self.RES_15X if is_15x else self.RES_1X
        aspect = preset if preset in table else "1:1"

        w, h = table[aspect]
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
