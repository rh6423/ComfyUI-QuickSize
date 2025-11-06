# src/quicksize/__init__.py
# QuickSize core node registry

from .flux_quicksize import (
    NODE_CLASS_MAPPINGS as _FLUX_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _FLUX_NAMES,
    NODE_HELP as _FLUX_HELP,  # <- help text for Flux
)
from .qwen_quicksize import (
    NODE_CLASS_MAPPINGS as _QWEN_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _QWEN_NAMES,
)
from .sd15_quicksize import (
    NODE_CLASS_MAPPINGS as _SD15_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _SD15_NAMES,
)
from .sdxl_quicksize import (
    NODE_CLASS_MAPPINGS as _SDXL_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _SDXL_NAMES,
)
from .wan_quicksize import (
    NODE_CLASS_MAPPINGS as _WAN_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _WAN_NAMES,
)
from .quickcrop_node import (
    NODE_CLASS_MAPPINGS as _QC_NODES,
    NODE_DISPLAY_NAME_MAPPINGS as _QC_NAMES,
)

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
NODE_HELP = {}  # <- aggregate help here

# merge all submodules
NODE_CLASS_MAPPINGS.update(_FLUX_NODES)
NODE_DISPLAY_NAME_MAPPINGS.update(_FLUX_NAMES)
NODE_HELP.update(_FLUX_HELP)  # <- include Flux help

NODE_CLASS_MAPPINGS.update(_QWEN_NODES)
NODE_DISPLAY_NAME_MAPPINGS.update(_QWEN_NAMES)
# (Add Qwen help here later if/when that module exports NODE_HELP)

NODE_CLASS_MAPPINGS.update(_SD15_NODES)
NODE_DISPLAY_NAME_MAPPINGS.update(_SD15_NAMES)
# (Add SD1.5 help here later)

NODE_CLASS_MAPPINGS.update(_SDXL_NODES)
NODE_DISPLAY_NAME_MAPPINGS.update(_SDXL_NAMES)
# (Add SDXL help here later)

NODE_CLASS_MAPPINGS.update(_WAN_NODES)
NODE_DISPLAY_NAME_MAPPINGS.update(_WAN_NAMES)
# (Add WAN help here later)

# QuickCrop
NODE_CLASS_MAPPINGS.update(_QC_NODES)
NODE_DISPLAY_NAME_MAPPINGS.update(_QC_NAMES)
# (QuickCrop help can be added here later when available)
