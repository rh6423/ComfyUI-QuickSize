# __init__.py (repo root)

import os
from .src.quicksize import (
    NODE_CLASS_MAPPINGS as _BASE_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _BASE_NAMES,
)

# Resolve to an absolute path: <this_folder>/src/web
WEB_DIRECTORY = os.path.join(os.path.dirname(__file__), "src", "web")

NODE_CLASS_MAPPINGS = dict(_BASE_NODES)
NODE_DISPLAY_NAME_MAPPINGS = dict(_BASE_NAMES)
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

# Optional: confirm in server logs which path Comfy sees
print("[QuickSize] WEB_DIRECTORY =>", WEB_DIRECTORY)
