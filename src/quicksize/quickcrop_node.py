# src/quicksize/quickcrop_node.py
# QuickSize / QuickCrop node for ComfyUI
from typing import Tuple
import numpy as np

try:
    import torch
except Exception:
    torch = None


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(int(v), hi))


class QuickCrop:
    """
    Interactive crop with draggable guides (frontend) + numeric fields (backend).
    Frontend writes x, y, width, height; backend performs the crop and returns an IMAGE tensor.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE", {}),
                "x": ("INT", {"default": 0, "min": 0, "max": 16384, "step": 1}),
                "y": ("INT", {"default": 0, "min": 0, "max": 16384, "step": 1}),
                "width": ("INT", {"default": 512, "min": 1, "max": 16384, "step": 1}),
                "height": ("INT", {"default": 512, "min": 1, "max": 16384, "step": 1}),
            },
            "optional": {
                "constrain_to_image": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "do_crop"
    CATEGORY = "QuickSize"

    def _ensure_tensor(self, image):
        # ComfyUI IMAGE is float32 torch tensor [B, H, W, C] in [0, 1]
        if torch is None:
            raise RuntimeError("PyTorch not available")
        if isinstance(image, torch.Tensor):
            return image
        if isinstance(image, np.ndarray):
            t = torch.from_numpy(image)
            if t.dtype != torch.float32:
                t = t.float()
            return t
        raise TypeError(f"Unsupported IMAGE type: {type(image)}")

    def _crop_tensor(self, img_t: "torch.Tensor", x: int, y: int, w: int, h: int) -> "torch.Tensor":
        # clamp + slice in [B, H, W, C]
        b, H, W, C = img_t.shape
        x = _clamp(x, 0, W - 1)
        y = _clamp(y, 0, H - 1)
        w = max(1, w)
        h = max(1, h)
        x2 = _clamp(x + w, 1, W)
        y2 = _clamp(y + h, 1, H)
        if x2 <= x:
            x2 = min(W, x + 1)
        if y2 <= y:
            y2 = min(H, y + 1)
        return img_t[:, y:y2, x:x2, :]

    def do_crop(self, image, x: int, y: int, width: int, height: int, constrain_to_image: bool = True):
        img_t = self._ensure_tensor(image)
        b, H, W, C = img_t.shape

        if constrain_to_image:
            x = _clamp(x, 0, max(0, W - 1))
            y = _clamp(y, 0, max(0, H - 1))
            width = _clamp(width, 1, W - x)
            height = _clamp(height, 1, H - y)

        cropped = self._crop_tensor(img_t, x, y, width, height)
        return (cropped,)


# ComfyUI registration for this module
NODE_CLASS_MAPPINGS = {
    "QuickCrop": QuickCrop,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "QuickCrop": "QuickCrop",
}

