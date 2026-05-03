import os
import shutil
import sys

source_dir = r"C:\Users\om231\.gemini\antigravity\brain\3831cd82-821f-4696-b040-26bf422f71ba"
target_dir = r"C:\Users\om231\OneDrive\Desktop\Projects\RepoDocs\docs\images"

os.makedirs(target_dir, exist_ok=True)

images = [
    ("media__1777812902711.png", "landing.png"),
    ("media__1777812902719.png", "features.png"),
    ("media__1777812902741.png", "indexing.png"),
    ("media__1777812902765.png", "chat_empty.png"),
    ("media__1777812902811.png", "chat_active.png")
]

print(f"Copying {len(images)} images to docs/images folder...")
success_count = 0

for src, dst in images:
    src_path = os.path.join(source_dir, src)
    dst_path = os.path.join(target_dir, dst)
    
    if os.path.exists(src_path):
        shutil.copy2(src_path, dst_path)
        print(f"✅ Copied {dst}")
        success_count += 1
    else:
        print(f"❌ Could not find {src}")

print(f"\nDone! Successfully copied {success_count} images.")
