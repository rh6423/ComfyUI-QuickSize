# src/quicksize/__init__.py

from .quicksize_node import (
    NODE_CLASS_MAPPINGS as _QS_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _QS_NAMES,
)
from .quickcrop_node import (
    NODE_CLASS_MAPPINGS as _QC_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _QC_NAMES,
)

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# existing QuickSize nodes
NODE_CLASS_MAPPINGS.update(_QS_NODES)
NODE_DISPLAY_NAME_MAPPINGS.update(_QS_NAMES)

# new QuickCrop node
NODE_CLASS_MAPPINGS.update(_QC_NODES)
NODE_DISPLAY_NAME_MAPPINGS.update(_QC_NAMES)

