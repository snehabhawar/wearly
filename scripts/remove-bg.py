"""Remove the background from garment photos (called by scripts/prepare-photos.ts).

Usage: python scripts/remove-bg.py <model> <input> <output.png> [<input> <output.png> ...]

Loads the rembg model once, then writes one transparent PNG per input. Phone photos
are turned upright from their EXIF orientation first.
"""

import sys

from PIL import Image, ImageOps
from rembg import new_session, remove


def main() -> None:
    model, *paths = sys.argv[1:]
    if not paths or len(paths) % 2:
        sys.exit("usage: remove-bg.py <model> <input> <output.png> [...]")

    session = new_session(model)
    for src, dst in zip(paths[::2], paths[1::2]):
        image = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        cutout = remove(image, session=session)
        assert isinstance(cutout, Image.Image)  # a PIL image in gives a PIL image out
        cutout.save(dst)
        print(f"  cut out {src}", flush=True)


if __name__ == "__main__":
    main()
