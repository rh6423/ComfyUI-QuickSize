# ComfyUI-QuickSize/__init__.py

from .src.quicksize import (
    NODE_CLASS_MAPPINGS as _NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _NAMES,
)

# Point to your actual web folder:
WEB_DIRECTORY = "./src/web"

NODE_CLASS_MAPPINGS = dict(_NODES)
NODE_DISPLAY_NAME_MAPPINGS = dict(_NAMES)

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
