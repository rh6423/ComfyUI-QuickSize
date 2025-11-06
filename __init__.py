# __init__.py  (repo root)
# ComfyUI-QuickSize — Node registration aggregator

from .src.quicksize import (
    NODE_CLASS_MAPPINGS as _BASE_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _BASE_NAMES,
)

WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
NODE_CLASS_MAPPINGS.update(_BASE_NODES)
NODE_DISPLAY_NAME_MAPPINGS.update(_BASE_NAMES)

# If you export __all__, include WEB_DIRECTORY so Comfy detects it:
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

