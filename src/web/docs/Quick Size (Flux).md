# Quick Size (Flux)

**Model:** Flux  
**Purpose:** Pick common Flux-native sizes by aspect, with an SDXL-style **1.5×** toggle.  
**Orientation:**  
- **horizontal** → width ≥ height  
- **vertical** → height ≥ width

---

## 1× resolutions
| Aspect | Size (w × h) |
|:------:|:------------:|
| 1:1    | 1024 × 1024  |
| 2:3    | 832 × 1216   |
| 4:3    | 1152 × 896   |
| 16:9   | 1344 × 768   |
| 21:9   | 1536 × 640   |

## 1.5× resolutions
| Aspect | Size (w × h) |
|:------:|:------------:|
| 1:1    | 1536 × 1536  |
| 2:3    | 1248 × 1824  |
| 4:3    | 1728 × 1344  |
| 16:9   | 2016 × 1152  |
| 21:9   | 2304 × 960   |

---

### Notes
- Sizes are chosen to be multiples of 8 for model compatibility.
- The **1.5×** toggle mirrors the SDXL node’s design language.
- If you change tables in code, update this doc to keep the help panel accurate.

