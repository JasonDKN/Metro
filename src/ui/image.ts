// ============================================================================
// Browser-only image helpers — file upload support for reward items (e.g.
// Photocards). Kept out of the data layer since it depends on FileReader,
// Image, and canvas, none of which exist outside a browser.
// ============================================================================

/** Reads an image file, downsizes it to fit within `maxDim` on its longest
 * side (preserving aspect ratio) and re-encodes it as JPEG, so a full-size
 * phone photo doesn't blow up localStorage — data: URLs already run ~33%
 * bigger than the raw file, and browser storage quotas are typically only a
 * few MB total. Resolves to a data: URL ready to store directly on a
 * RewardItem's imageDataUrl. */
export function fileToResizedDataUrl(file: File, maxDim = 900, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read that file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't decode that image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas isn't supported here"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
