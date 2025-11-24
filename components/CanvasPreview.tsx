import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Adjustments, ImageFile } from '../types';
import { generateCssFilterString } from '../services/imageUtils';

interface CanvasPreviewProps {
  image: ImageFile | null;
  onOverlayUpdate: (updates: Partial<Adjustments>) => void;
}

const CanvasPreview: React.FC<CanvasPreviewProps> = ({ image, onOverlayUpdate }) => {
  
  const adjustments = image ? image.adjustments : null;
  const filterStyle = useMemo(() => adjustments ? generateCssFilterString(adjustments) : '', [adjustments]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [interactionMode, setInteractionMode] = useState<'none' | 'move' | 'resize'>('none');
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startVal, setStartVal] = useState({ scale: 0.2, x: 0.5, y: 0.5 }); // Stores initial scale or pos

  // --- Handlers for Move ---
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling if needed
    setInteractionMode('move');
  };

  // --- Handlers for Resize ---
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Store initial mouse Y to calculate delta
    let clientY;
    if ('touches' in e) {
        clientY = e.touches[0].clientY;
    } else {
        clientY = (e as MouseEvent).clientY;
    }

    setStartPos({ x: 0, y: clientY });
    setStartVal({ 
        scale: adjustments?.overlayScale || 0.2, 
        x: 0, 
        y: 0 
    });
    setInteractionMode('resize');
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (interactionMode === 'none' || !containerRef.current || !adjustments) return;
        
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as MouseEvent).clientX;
            clientY = (e as MouseEvent).clientY;
        }

        if (interactionMode === 'move') {
            // Calculate relative position within the container
            let x = (clientX - rect.left) / rect.width;
            let y = (clientY - rect.top) / rect.height;

            // Clamp to 0-1
            x = Math.max(0, Math.min(1, x));
            y = Math.max(0, Math.min(1, y));

            onOverlayUpdate({ overlayX: x, overlayY: y });
        } 
        else if (interactionMode === 'resize') {
            // Calculate delta Y from start
            const deltaY = clientY - startPos.y;
            // Sensitivity factor: moving 200px = +1.0 scale roughly
            const scaleChange = -(deltaY / 200); 
            
            // New scale = initial scale + change
            // Note: dragging UP (negative delta) should INCREASE size usually for corner handles if we emulate "pulling out", 
            // but standard slider logic is Up/Right = increase. 
            // Let's implement: Drag DOWN/RIGHT = Increase Size.
            const directionCorrectedScaleChange = (deltaY / 300); // 300px drag = 100% scale change
            
            let newScale = startVal.scale + directionCorrectedScaleChange;
            newScale = Math.max(0.05, Math.min(2.0, newScale)); // Clamp between 5% and 200%

            onOverlayUpdate({ overlayScale: newScale });
        }
    };

    const handleEnd = () => setInteractionMode('none');

    if (interactionMode !== 'none') {
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleEnd);
    }

    return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
    };
  }, [interactionMode, adjustments, onOverlayUpdate, startPos, startVal]);


  if (!image || !adjustments) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white/30">
        <p className="text-lg font-light">Nenhuma imagem selecionada</p>
        <p className="text-sm">Selecione ou envie uma imagem para começar</p>
      </div>
    );
  }

  // Helper to check if privacy scan is "done" (array exists) but empty
  const isPrivacyScanClean = adjustments.privacyBlur && image.privacyRegions && image.privacyRegions.length === 0;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4">
      <div className="relative max-w-full max-h-full shadow-2xl overflow-hidden rounded-sm transition-all duration-300 group">
        
        {/* Container for Image + Overlays */}
        <div ref={containerRef} className="relative inline-block">
          {/* Main Image with CSS Filters */}
          <img
            src={image.originalUrl}
            alt="Preview"
            className="max-w-full max-h-[70vh] object-contain transition-all duration-100 ease-out block"
            style={{ filter: filterStyle }}
            draggable={false}
          />

          {/* Privacy Blur Overlays */}
          {adjustments.privacyBlur && image.privacyRegions && image.privacyRegions.map((box, idx) => (
             <div 
               key={idx}
               className="absolute bg-white/10 backdrop-blur-lg shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/20"
               style={{
                 top: `${box.ymin / 10}%`,
                 left: `${box.xmin / 10}%`,
                 height: `${(box.ymax - box.ymin) / 10}%`,
                 width: `${(box.xmax - box.xmin) / 10}%`,
                 zIndex: 10
               }}
             >
                {/* Optional icon inside blur to indicate protection */}
                <div className="w-full h-full flex items-center justify-center opacity-30">
                    <svg width="30%" height="30%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
             </div>
          ))}

          {/* Loading state indicator if blur is on */}
          {adjustments.privacyBlur && (!image.privacyRegions) && (
             <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full text-xs text-violet-300 z-50 border border-violet-500/30 shadow-lg">
               <span className="animate-spin w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full"></span>
               Analisando rostos e placas...
             </div>
          )}

          {/* "Clean" state indicator - Gives user certainty that scan ran but found nothing */}
          {isPrivacyScanClean && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-green-500/20 backdrop-blur-md px-3 py-1.5 rounded-full text-xs text-green-200 z-50 border border-green-500/30 animate-in fade-in zoom-in duration-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Varredura: Seguro (Nenhum dado detectado)
              </div>
          )}

          {/* Warmth Overlay */}
          {adjustments.warmth > 0 && (
             <div 
               className="absolute inset-0 pointer-events-none mix-blend-overlay bg-orange-500"
               style={{ opacity: adjustments.warmth / 500 }}
             />
          )}

          {/* Draggable Element / Watermark Overlay */}
          {adjustments.overlayImage && (
              <div 
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 group/overlay ${interactionMode !== 'none' ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                    left: `${(adjustments.overlayX || 0.5) * 100}%`,
                    top: `${(adjustments.overlayY || 0.5) * 100}%`,
                    width: `${(adjustments.overlayScale || 0.2) * 100}%`, // Width relative to container
                    opacity: adjustments.overlayOpacity,
                    zIndex: 20
                }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                  {/* The Image */}
                  <img 
                    src={adjustments.overlayImage} 
                    alt="overlay" 
                    className="w-full h-auto pointer-events-none drop-shadow-lg select-none"
                    draggable={false}
                  />
                  
                  {/* Bounding Box (Visible on hover or drag) */}
                  <div className={`absolute inset-0 border-2 border-white/40 rounded transition-opacity ${interactionMode !== 'none' ? 'opacity-100' : 'opacity-0 group-hover/overlay:opacity-100'}`}></div>

                  {/* Resize Handle (Bottom Right) */}
                  <div 
                    className={`absolute -bottom-1 -right-1 w-4 h-4 bg-violet-500 border-2 border-white rounded-full cursor-nwse-resize shadow-lg z-30 transition-opacity ${interactionMode !== 'none' ? 'opacity-100 scale-125' : 'opacity-0 group-hover/overlay:opacity-100'}`}
                    onMouseDown={handleResizeStart}
                    onTouchStart={handleResizeStart}
                  ></div>
              </div>
          )}
          
          {/* Text Watermark Overlay Preview (Legacy) */}
          {adjustments.watermark && (
              <div className="absolute bottom-4 right-4 text-white/70 font-bold text-xl pointer-events-none drop-shadow-md">
                  {adjustments.watermark}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CanvasPreview;