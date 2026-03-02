#!/usr/bin/env python3
"""
Remove text from images using OCR detection + inpainting.
Usage: python remove_text.py <input_image> [output_image]
"""

import sys
import os
import numpy as np

def check_dependencies():
    missing = []
    try:
        import cv2
    except ImportError:
        missing.append("opencv-python")
    try:
        import easyocr
    except ImportError:
        missing.append("easyocr")
    try:
        from PIL import Image
    except ImportError:
        missing.append("Pillow")
    if missing:
        print(f"Missing dependencies. Install with:")
        print(f"  pip install {' '.join(missing)}")
        sys.exit(1)

check_dependencies()

import cv2
import easyocr
from PIL import Image


def remove_text(input_path: str, output_path: str):
    print(f"Loading image: {input_path}")
    img = cv2.imread(input_path)
    if img is None:
        print(f"Error: Cannot read image at {input_path}")
        sys.exit(1)

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w = img.shape[:2]

    # Step 1: Detect text regions with EasyOCR
    print("Detecting text regions (this may take a moment)...")
    reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)
    results = reader.readtext(img_rgb)

    if not results:
        print("No text detected in image.")
        return

    print(f"Detected {len(results)} text region(s):")
    for bbox, text, conf in results:
        print(f"  '{text}' (confidence: {conf:.2f})")

    # Step 2: Build a mask covering all text bounding boxes
    mask = np.zeros((h, w), dtype=np.uint8)
    padding = 6  # pixels of extra padding around each text box

    for bbox, text, conf in results:
        if conf < 0.3:
            continue
        pts = np.array(bbox, dtype=np.int32)
        x_min = max(0, pts[:, 0].min() - padding)
        y_min = max(0, pts[:, 1].min() - padding)
        x_max = min(w, pts[:, 0].max() + padding)
        y_max = min(h, pts[:, 1].max() + padding)
        mask[y_min:y_max, x_min:x_max] = 255

    # Step 3: Inpaint the masked regions
    print("Inpainting text regions...")
    result = cv2.inpaint(img, mask, inpaintRadius=7, flags=cv2.INPAINT_TELEA)

    cv2.imwrite(output_path, result)
    print(f"Saved cleaned image to: {output_path}")


def main():
    if len(sys.argv) < 2:
        input_path = "/Users/huyufei/Documents/hyf/code/github/AIrchieve/page_6.png"
    else:
        input_path = sys.argv[1]

    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
    else:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_cleaned{ext}"

    remove_text(input_path, output_path)


if __name__ == "__main__":
    main()
