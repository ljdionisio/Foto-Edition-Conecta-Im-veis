import { Adjustments, BoundingBox } from '../types';
import JSZip from 'jszip';

export const generateCssFilterString = (adj: Adjustments): string => {
  return `
    brightness(${adj.brightness}%) 
    contrast(${adj.contrast}%) 
    saturate(${adj.saturation}%) 
    blur(${adj.blur}px) 
    sepia(${adj.sepia}%) 
    grayscale(${adj.grayscale}%)
  `.trim();
};

export const processImageOnCanvas = async (
  imageUrl: string,
  adjustments: Adjustments,
  privacyRegions: BoundingBox[] = [],
  quality: number = 0.9
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // 1. Draw Original Image
      ctx.drawImage(img, 0, 0);

      // 2. Apply Privacy Blurring
      if (adjustments.privacyBlur && privacyRegions.length > 0) {
        const blockSize = Math.max(10, Math.floor(canvas.width * 0.02));
        
        privacyRegions.forEach(box => {
           // Ensure integer coordinates for getImageData
           const y = Math.floor((box.ymin / 1000) * canvas.height);
           const x = Math.floor((box.xmin / 1000) * canvas.width);
           const h = Math.floor(((box.ymax - box.ymin) / 1000) * canvas.height);
           const w = Math.floor(((box.xmax - box.xmin) / 1000) * canvas.width);

           // Prevent errors if dimensions are invalid
           if (w <= 0 || h <= 0) return;

           try {
             const regionData = ctx.getImageData(x, y, w, h);
             
             for (let py = 0; py < regionData.height; py += blockSize) {
               for (let px = 0; px < regionData.width; px += blockSize) {
                 const pixelIndex = (py * regionData.width + px) * 4;
                 const r = regionData.data[pixelIndex];
                 const g = regionData.data[pixelIndex + 1];
                 const b = regionData.data[pixelIndex + 2];
                 
                 ctx.fillStyle = `rgb(${r},${g},${b})`;
                 ctx.fillRect(x + px, y + py, blockSize, blockSize);
               }
             }
           } catch (e) {
             console.error("Failed to blur region", e);
           }
        });
      }

      // 3. Global CSS Filters
      const filterCanvas = document.createElement('canvas');
      filterCanvas.width = canvas.width;
      filterCanvas.height = canvas.height;
      const fCtx = filterCanvas.getContext('2d');
      
      if (fCtx) {
          fCtx.filter = generateCssFilterString(adjustments);
          fCtx.drawImage(canvas, 0, 0);
          ctx.clearRect(0,0, canvas.width, canvas.height);
          ctx.drawImage(filterCanvas, 0, 0);
      }

      // 4. Warmth Overlay
      if (adjustments.warmth > 0) {
        ctx.filter = 'none';
        ctx.fillStyle = `rgba(255, 160, 0, ${adjustments.warmth / 500})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 5. Image Overlay (Watermark / Element)
      if (adjustments.overlayImage) {
        ctx.filter = 'none';
        try {
            const overlayImg = new Image();
            overlayImg.src = adjustments.overlayImage;
            await new Promise((res) => { overlayImg.onload = res; overlayImg.onerror = res; });
            
            if (overlayImg.complete) {
                const scale = adjustments.overlayScale || 0.2;
                const aspect = overlayImg.width / overlayImg.height;
                
                // Calculate width relative to main image width
                const drawWidth = canvas.width * scale;
                const drawHeight = drawWidth / aspect;

                // Position (Center point is x/y)
                const posX = (canvas.width * (adjustments.overlayX || 0.5)) - (drawWidth / 2);
                const posY = (canvas.height * (adjustments.overlayY || 0.5)) - (drawHeight / 2);
                
                ctx.globalAlpha = adjustments.overlayOpacity !== undefined ? adjustments.overlayOpacity : 1.0;
                ctx.drawImage(overlayImg, posX, posY, drawWidth, drawHeight);
                ctx.globalAlpha = 1.0; // Reset
            }
        } catch (e) {
            console.error("Error drawing overlay", e);
        }
      }

      // 6. Text Watermark (Legacy)
      if (adjustments.watermark) {
        ctx.filter = 'none';
        const fontSize = Math.max(20, canvas.width * 0.05);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        const padding = canvas.width * 0.02;
        ctx.fillText(adjustments.watermark, canvas.width - padding, canvas.height - padding);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas conversion failed"));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = (e) => reject(e);
    img.src = imageUrl;
  });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadAsZip = async (files: { blob: Blob; name: string }[], zipFilename: string = "imagens_editadas.zip") => {
  const zip = new JSZip();
  
  files.forEach((file) => {
    zip.file(file.name, file.blob);
  });

  const content = await zip.generateAsync({ type: "blob" });
  downloadBlob(content, zipFilename);
};