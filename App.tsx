import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Upload, Camera, Download, Wand2, History, Save, Trash2, X, CheckSquare, Square, ZapOff, Database
} from './components/ui/Icons';
import Toolbar from './components/Toolbar';
import CanvasPreview from './components/CanvasPreview';
import { Adjustments, FilterType, ImageFile, Preset, UserConfig } from './types';
import { DEFAULT_ADJUSTMENTS, FILTERS, MOCK_PRESETS } from './constants';
import { analyzeImageForEnhancement, blobToBase64, detectPrivacyObjects, GeminiQuotaError, removeBackgroundWithAI } from './services/geminiService';
import { processImageOnCanvas, downloadBlob, downloadAsZip } from './services/imageUtils';
import { supabase } from './services/supabase';

export default function App() {
  // --- State ---
  const [images, setImages] = useState<ImageFile[]>([]);
  // viewImageId is the big image on screen
  const [viewImageId, setViewImageId] = useState<string | null>(null);
  // selectedImageIds are the images targeted for edits/batch actions
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");
  
  // Circuit Breaker for API Quota
  const [quotaCooldown, setQuotaCooldown] = useState<number>(0);
  
  const [presets, setPresets] = useState<Preset[]>(MOCK_PRESETS);
  const [showPresets, setShowPresets] = useState(false);
  
  // User Configurations (Named Presets with Overlays)
  const [userConfigs, setUserConfigs] = useState<UserConfig[]>([]);

  // Default Config from LocalStorage
  const [defaultConfig, setDefaultConfig] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Ref to track if the privacy detection loop is currently running
  const isDetectingPrivacyRef = useRef(false);

  // --- Initialization ---
  useEffect(() => {
    // Load saved presets and config
    const savedPresets = localStorage.getItem('lumina_presets');
    const savedConfig = localStorage.getItem('lumina_config');
    const savedUserConfigs = localStorage.getItem('lumina_user_configs');
    
    if (savedPresets) setPresets(JSON.parse(savedPresets));
    if (savedConfig) setDefaultConfig(JSON.parse(savedConfig));
    if (savedUserConfigs) setUserConfigs(JSON.parse(savedUserConfigs));

    // Check Supabase connection (Optional logging)
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) console.log("Supabase: Usuário conectado", session.user.email);
        else console.log("Supabase: Pronto (Anônimo)");
    });
  }, []);

  // --- Derived State ---
  const viewedImage = images.find((img) => img.id === viewImageId) || null;
  // Use the viewed image's adjustments for the toolbar, or defaults if none
  const currentToolbarAdjustments = viewedImage ? viewedImage.adjustments : defaultConfig;
  
  const isQuotaExhausted = Date.now() < quotaCooldown;
  const cooldownRemaining = Math.ceil((quotaCooldown - Date.now()) / 1000);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newImages: ImageFile[] = Array.from(files).map((item: File) => {
        return {
          id: crypto.randomUUID(),
          originalUrl: URL.createObjectURL(item),
          previewUrl: URL.createObjectURL(item),
          name: item.name,
          type: item.type,
          adjustments: { ...defaultConfig }, // Init with saved configuration
        };
      });

      setImages((prev) => [...prev, ...newImages]);
      
      // Auto-select newly added images if none were previously there, or just add them to view
      if (!viewImageId && newImages.length > 0) {
        setViewImageId(newImages[0].id);
        setSelectedImageIds(new Set([newImages[0].id]));
      } else if (newImages.length > 0) {
        // Add new images to selection automatically for convenience? 
        // Let's just select the first new one to show feedback
        setViewImageId(newImages[0].id);
        setSelectedImageIds(new Set([newImages[0].id]));
      }
    }
    if (e.target) e.target.value = '';
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && viewedImage) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            // Apply to viewed image (which propagates to selection via updateAdjustments)
            const newAdj = { 
                ...viewedImage.adjustments, 
                overlayImage: result,
                overlayX: 0.5,
                overlayY: 0.5,
                overlayScale: 0.3,
                overlayOpacity: 1
            };
            updateAdjustments(newAdj);
        };
        reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleRemoveBackground = async () => {
    if (!viewedImage || !viewedImage.adjustments.overlayImage) return;
    if (isQuotaExhausted) {
        setProcessingMsg(`Cota atingida. Aguarde ${cooldownRemaining}s.`);
        setTimeout(() => setProcessingMsg(""), 3000);
        return;
    }

    setIsProcessing(true);
    setProcessingMsg("Removendo fundo (IA)...");

    try {
        const base64Clean = viewedImage.adjustments.overlayImage.split(',')[1];
        const newImageBase64 = await removeBackgroundWithAI(base64Clean);
        const newDataUrl = `data:image/png;base64,${newImageBase64}`;
        
        updateAdjustments({
            ...viewedImage.adjustments,
            overlayImage: newDataUrl
        });
        setProcessingMsg("Fundo removido com sucesso!");
    } catch (e) {
        console.error(e);
        if (e instanceof GeminiQuotaError || (e as any).name === 'GeminiQuotaError') {
             setQuotaCooldown(Date.now() + 60000);
             setProcessingMsg("Cota de IA excedida.");
        } else {
             setProcessingMsg("Falha ao remover fundo.");
        }
    } finally {
        setIsProcessing(false);
        setTimeout(() => setProcessingMsg(""), 2000);
    }
  };

  // --- USER CONFIG HANDLERS ---
  
  const handleSaveUserConfig = (name: string) => {
      if (!viewedImage) return;
      
      const newConfig: UserConfig = {
          id: crypto.randomUUID(),
          name: name,
          createdAt: Date.now(),
          adjustments: { ...viewedImage.adjustments }
      };

      const updatedConfigs = [newConfig, ...userConfigs]; // Add to top
      setUserConfigs(updatedConfigs);
      localStorage.setItem('lumina_user_configs', JSON.stringify(updatedConfigs));
      
      // Also update default config implicitly? Optional. Let's keep it separate for now.
      setProcessingMsg(`Configuração "${name}" salva!`);
      setTimeout(() => setProcessingMsg(""), 2000);
  };

  const handleDeleteUserConfig = (id: string) => {
      const updated = userConfigs.filter(c => c.id !== id);
      setUserConfigs(updated);
      localStorage.setItem('lumina_user_configs', JSON.stringify(updated));
  };

  const handleLoadUserConfig = (config: UserConfig) => {
      // This applies everything: filters, privacy settings, overlay images, watermark text
      updateAdjustments(config.adjustments);
      setProcessingMsg(`Configuração "${config.name}" aplicada!`);
      setTimeout(() => setProcessingMsg(""), 2000);
  };

  // The core update logic for adjustments
  const updateAdjustments = useCallback(async (newAdj: Adjustments) => {
    setImages(prevImages => {
      return prevImages.map(img => {
        if (selectedImageIds.has(img.id)) {
          return { ...img, adjustments: newAdj };
        }
        return img;
      });
    });
  }, [selectedImageIds]);

  // Effect to handle Privacy Detection Side Effect
  useEffect(() => {
    const checkPrivacy = async () => {
      // If a loop is already running, do not start another one.
      if (isDetectingPrivacyRef.current) return;
      
      // If quota is exhausted, do not attempt to run
      if (Date.now() < quotaCooldown) return;

      // Find selected images that have privacy enabled BUT no regions detected yet
      const needsDetection = images.filter(img => 
        selectedImageIds.has(img.id) && 
        img.adjustments.privacyBlur && 
        (!img.privacyRegions) // Check for undefined/null only. Empty [] means "checked, none found".
      );

      if (needsDetection.length === 0) return;

      // Lock the process
      isDetectingPrivacyRef.current = true;

      // Detect for the VIEWED image first for immediate feedback
      const prio = needsDetection.find(img => img.id === viewImageId);
      const queue = prio ? [prio, ...needsDetection.filter(i => i.id !== viewImageId)] : needsDetection;

      console.log(`Iniciando fila de detecção para ${queue.length} imagens...`);

      // Process one by one
      for (const img of queue) {
        // Check quota again inside loop in case it changed
        if (Date.now() < quotaCooldown) break;

        try {
            const res = await fetch(img.originalUrl);
            const blob = await res.blob();
            const base64 = await blobToBase64(blob);
            const boxes = await detectPrivacyObjects(base64);
            
            if (boxes !== null) {
              setImages(prev => prev.map(i => {
                  if (i.id === img.id) {
                      return { ...i, privacyRegions: boxes };
                  }
                  return i;
              }));
            }

            // RATE LIMITING: Wait 4 seconds between requests
            await new Promise(r => setTimeout(r, 4000));

        } catch (e) {
            console.error("Erro no processamento:", e);
            
            // Check if it's our quota error
            if (e instanceof GeminiQuotaError || (e as any).name === 'GeminiQuotaError') {
                const cooldownSecs = 60;
                setQuotaCooldown(Date.now() + (cooldownSecs * 1000));
                setProcessingMsg(`Cota de IA atingida. Pausando por ${cooldownSecs}s...`);
                setTimeout(() => setProcessingMsg(""), 4000);
                break; // Stop the loop immediately
            }
        }
      }

      // Unlock
      isDetectingPrivacyRef.current = false;
    };
    
    // Check periodically or when dependencies change
    const t = setTimeout(checkPrivacy, 1000);
    return () => clearTimeout(t);
  }, [images, selectedImageIds, viewImageId, quotaCooldown]);

  // Auto-decrement cooldown timer for UI updates
  useEffect(() => {
    if (quotaCooldown > 0) {
        const i = setInterval(() => {
            if (Date.now() > quotaCooldown) {
                setQuotaCooldown(0); // Reset
                clearInterval(i);
            } else {
                // Force re-render for timer
                setQuotaCooldown(prev => prev); 
            }
        }, 1000);
        return () => clearInterval(i);
    }
  }, [quotaCooldown]);

  const applyFilter = (type: FilterType) => {
    const filterAdj = FILTERS[type];
    const base = viewedImage ? viewedImage.adjustments : defaultConfig;
    const newAdj = { ...base, ...filterAdj };
    updateAdjustments(newAdj);
  };

  const handleAutoEnhance = async () => {
    if (!viewedImage) return;
    if (isQuotaExhausted) {
        setProcessingMsg(`Aguarde ${cooldownRemaining}s para usar IA novamente.`);
        setTimeout(() => setProcessingMsg(""), 3000);
        return;
    }

    setIsProcessing(true);
    setProcessingMsg("Melhoria IA...");
    try {
      const response = await fetch(viewedImage.originalUrl);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      
      const suggestion = await analyzeImageForEnhancement(base64);
      if (Object.keys(suggestion).length > 0) {
        updateAdjustments({ ...viewedImage.adjustments, ...suggestion });
      }
    } catch (e) {
      console.error(e);
      if (e instanceof GeminiQuotaError || (e as any).name === 'GeminiQuotaError') {
          setQuotaCooldown(Date.now() + 60000);
          setProcessingMsg("Cota atingida. Tente novamente em 60s.");
      } else {
          setProcessingMsg("Falha na análise.");
      }
      setTimeout(() => setProcessingMsg(""), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchDownload = async () => {
    if (images.length === 0) return;
    
    // Determine which images to download
    const targetIds = selectedImageIds.size > 0 ? Array.from(selectedImageIds) : images.map(i => i.id);
    const targets = images.filter(i => targetIds.includes(i.id));

    setIsProcessing(true);
    setProcessingMsg(`Renderizando ${targets.length} fotos...`);
    
    try {
        const processedFiles: { blob: Blob; name: string }[] = [];

        // Generate blobs for all target images
        for (let i = 0; i < targets.length; i++) {
            const img = targets[i];
            setProcessingMsg(`Processando ${i+1}/${targets.length}: ${img.name}`);
            
            const processedBlob = await processImageOnCanvas(
                img.originalUrl, 
                img.adjustments, 
                img.privacyRegions
            );
            
            processedFiles.push({
                blob: processedBlob,
                name: `edited_${img.name}`
            });
        }

        setProcessingMsg("Finalizando download...");

        // If single file, download directly. If multiple, zip them.
        if (processedFiles.length === 1) {
            downloadBlob(processedFiles[0].blob, processedFiles[0].name);
        } else if (processedFiles.length > 1) {
            await downloadAsZip(processedFiles, "lumina_fotos_editadas.zip");
        }

    } catch (e) {
        console.error(e);
        alert("Erro durante o download em lote.");
    } finally {
        setIsProcessing(false);
        setProcessingMsg("");
    }
  };

  const savePreset = () => {
    if (!viewedImage) return;
    const name = prompt("Nome do Modelo:");
    if (name) {
        const newPreset = { id: crypto.randomUUID(), name, adjustments: { ...viewedImage.adjustments } };
        const updatedPresets = [...presets, newPreset];
        setPresets(updatedPresets);
        localStorage.setItem('lumina_presets', JSON.stringify(updatedPresets));
    }
  };

  const clearAllPhotos = () => {
      if (confirm("Remover todas as fotos? Isso não pode ser desfeito.")) {
          images.forEach(i => URL.revokeObjectURL(i.originalUrl));
          setImages([]);
          setViewImageId(null);
          setSelectedImageIds(new Set());
      }
  };

  const toggleSelection = (id: string, multi: boolean) => {
      const newSet = new Set(multi ? selectedImageIds : []);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedImageIds(newSet);
  };

  const selectAll = () => {
      if (selectedImageIds.size === images.length) {
          setSelectedImageIds(new Set());
      } else {
          setSelectedImageIds(new Set(images.map(i => i.id)));
      }
  };

  const handleThumbnailClick = (id: string) => {
      setViewImageId(id);
      if (selectedImageIds.size <= 1 && !selectedImageIds.has(id)) {
          setSelectedImageIds(new Set([id]));
      }
  };

  // --- Render ---

  return (
    <div className="flex h-screen w-full bg-[#0f0f13] text-white font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR - Toolbar */}
      <aside className="w-80 flex flex-col border-r border-white/5 glass-panel z-20 hidden md:flex">
        {/* HEADER BRANDING */}
        <div className="p-5 border-b border-white/5 flex flex-col gap-4 items-center text-center">
            <div className="bg-white p-2 rounded-xl shadow-lg w-full max-w-[180px] flex items-center justify-center">
                <img 
                    src="https://i.postimg.cc/59DCsg1y/LOGO-CONECTA-IMOVEIS-removebg-preview.png" 
                    alt="Conecta Imóveis" 
                    className="w-full h-auto object-contain" 
                />
            </div>
            <div className="flex flex-col">
                <span className="text-xs font-bold text-violet-300 tracking-[0.2em] uppercase text-center">
                    Foto Edition Conecta Imóveis
                </span>
            </div>
            <button onClick={clearAllPhotos} className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 mt-1 transition-colors">
                <Trash2 size={12} /> Limpar Projeto
            </button>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
            <Toolbar 
                adjustments={currentToolbarAdjustments} 
                setAdjustments={updateAdjustments} 
                applyFilter={applyFilter}
                
                userConfigs={userConfigs}
                onSaveUserConfig={handleSaveUserConfig}
                onLoadUserConfig={handleLoadUserConfig}
                onDeleteUserConfig={handleDeleteUserConfig}

                onLogoUpload={handleLogoUpload}
                onRemoveBackground={handleRemoveBackground}
                isRemovingBg={isProcessing && processingMsg.includes('Removendo')}
            />
        </div>

        <div className="border-t border-white/5 bg-black/20">
             <div className="p-4">
                <button 
                    onClick={handleBatchDownload}
                    disabled={images.length === 0 || isProcessing}
                    className="w-full glass-button bg-violet-600/80 hover:bg-violet-500/90 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? 'Processando...' : <><Download size={18} /> Baixar {selectedImageIds.size > 0 ? 'Seleção' : 'Tudo'}</>}
                </button>
             </div>
             
             {/* Supabase Status Indicator */}
             <div className="pb-3 text-center opacity-50 hover:opacity-100 transition-opacity cursor-default">
                  <div className="text-[9px] text-gray-400 flex items-center justify-center gap-1">
                      <Database size={10} className="text-green-500" /> Integração Supabase Ativa
                  </div>
             </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative min-w-0">
        
        {/* Top Header Mobile/Desktop */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/5 glass-panel z-10">
           {/* Mobile Title & Clear */}
           <div className="md:hidden flex items-center gap-3">
             <div className="bg-white p-1.5 rounded-lg h-9 shadow-md">
                 <img 
                    src="https://i.postimg.cc/59DCsg1y/LOGO-CONECTA-IMOVEIS-removebg-preview.png" 
                    alt="Conecta" 
                    className="h-full w-auto object-contain" 
                 />
             </div>
             {images.length > 0 && <button onClick={clearAllPhotos} className="text-red-400 p-1"><Trash2 size={16}/></button>}
           </div>

           <div className="flex items-center gap-2 md:gap-4 ml-auto">
             <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
             />
             <input 
                type="file" 
                capture="environment" 
                accept="image/*" 
                className="hidden" 
                ref={cameraInputRef} 
                onChange={handleFileUpload}
             />
             
             {/* AI Status / Button */}
             <div className="flex items-center gap-2">
                 {isQuotaExhausted && (
                     <div className="flex items-center gap-1 text-amber-500 text-xs bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20" title="IA em pausa para recarregar cota gratuita">
                         <ZapOff size={12} />
                         <span>{cooldownRemaining}s</span>
                     </div>
                 )}
                 <button 
                    onClick={() => handleAutoEnhance()}
                    className={`glass-button p-2 rounded-full hover:text-white hover:bg-violet-500/20 ${isProcessing ? 'text-violet-500 animate-pulse' : isQuotaExhausted ? 'text-gray-600 cursor-not-allowed' : 'text-violet-300'}`}
                    title={isQuotaExhausted ? "IA Pausada (Cota Excedida)" : "Melhoria IA"}
                    disabled={!viewImageId || isProcessing || isQuotaExhausted}
                 >
                    <Wand2 size={20} />
                 </button>
             </div>

             <div className="h-6 w-px bg-white/10 mx-1"></div>

             <button 
                onClick={() => fileInputRef.current?.click()}
                className="glass-button px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm"
             >
                <Upload size={16} /> <span className="hidden sm:inline">Enviar</span>
             </button>
             <button 
                onClick={() => cameraInputRef.current?.click()}
                className="glass-button p-2 rounded-lg"
             >
                <Camera size={18} />
             </button>
           </div>
        </header>

        {/* Canvas Area */}
        <section className="flex-1 relative bg-black/40 overflow-hidden">
            <CanvasPreview 
              image={viewedImage} 
              onOverlayUpdate={(updates) => {
                 if (viewedImage) {
                   const newAdj = { ...viewedImage.adjustments, ...updates };
                   updateAdjustments(newAdj);
                 }
              }}
            />
            
            {/* Presets Button */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-30">
                <button 
                    onClick={() => setShowPresets(!showPresets)}
                    className="glass-button p-2 rounded-lg text-white/80 hover:text-white bg-black/40 backdrop-blur-lg"
                    title="Modelos"
                >
                    <History size={20} />
                </button>
                {showPresets && (
                    <div className="glass-panel p-2 rounded-lg mt-2 w-48 flex flex-col gap-1 absolute top-full left-0 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center px-2 pb-2 mb-2 border-b border-white/10">
                            <span className="text-xs text-gray-400">Modelos</span>
                            <button onClick={savePreset} title="Salvar atual como modelo" className="hover:text-violet-400"><Save size={14}/></button>
                        </div>
                        {presets.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => updateAdjustments(p.adjustments)}
                                className="text-left text-sm px-2 py-1.5 rounded hover:bg-white/10 text-gray-300"
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Info Badge */}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-xs text-white/60 pointer-events-none">
                {selectedImageIds.size} selecionado(s)
            </div>
        </section>

        {/* Bottom Thumbnail Strip */}
        <section className="h-32 glass-panel border-t border-white/5 flex flex-col">
            <div className="h-8 flex items-center px-4 border-b border-white/5 justify-between bg-black/20">
                 <button onClick={selectAll} className="flex items-center gap-2 text-xs text-gray-300 hover:text-white">
                     {selectedImageIds.size === images.length && images.length > 0 ? <CheckSquare size={14} className="text-violet-400"/> : <Square size={14}/>}
                     Selecionar Tudo
                 </button>
                 <span className="text-xs text-gray-500">{images.length} itens</span>
            </div>

            <div className="flex-1 flex items-center overflow-x-auto px-4 gap-3 no-scrollbar pt-2">
                {images.length === 0 && (
                    <div className="w-full text-center text-sm text-gray-500">
                        Envie até 50 fotos para começar a edição em massa
                    </div>
                )}
                {images.map((img) => {
                    const isSelected = selectedImageIds.has(img.id);
                    const isViewed = viewImageId === img.id;
                    
                    return (
                        <div 
                            key={img.id}
                            className={`
                                relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all group
                                ${isViewed ? 'border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'border-transparent opacity-90'}
                                ${isSelected ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-black' : ''}
                            `}
                            onClick={() => handleThumbnailClick(img.id)}
                        >
                            <img src={img.originalUrl} className="w-full h-full object-cover" alt="thumbnail" />
                            
                            {/* Selection Checkbox */}
                            <div 
                                onClick={(e) => { e.stopPropagation(); toggleSelection(img.id, true); }}
                                className="absolute top-1 left-1 z-10 cursor-pointer"
                            >
                                {isSelected 
                                    ? <div className="bg-violet-600 rounded text-white"><CheckSquare size={16}/></div> 
                                    : <div className="bg-black/50 rounded text-white/70 hover:text-white"><Square size={16}/></div>
                                }
                            </div>

                            {/* Privacy Indicator */}
                            {img.adjustments.privacyBlur && (
                                <div className="absolute bottom-1 right-1 text-violet-300 bg-black/60 rounded-full p-0.5">
                                    <div className={`w-2 h-2 rounded-full ${img.privacyRegions ? 'bg-violet-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                                </div>
                            )}

                            {/* Filter Overlay indicator */}
                            {isViewed && (
                                <div className="absolute inset-0 bg-violet-500/10 pointer-events-none"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
      </main>
      
      {/* Overlay Loading State (Only for full blocking actions like Download) */}
      {isProcessing && (processingMsg.includes('Renderizando') || processingMsg.includes('Melhoria IA') || processingMsg.includes('Removendo')) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center flex-col">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-violet-200 font-light tracking-wide animate-pulse">{processingMsg || 'Processando...'}</p>
        </div>
      )}
      
      {/* Non-blocking Toast for Quota/Status messages */}
      {!isProcessing && processingMsg && (
        <div className="fixed bottom-40 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 border border-white/10 backdrop-blur-md px-4 py-2 rounded-lg shadow-xl animate-in slide-in-from-bottom-5 fade-in">
           <p className="text-sm text-white">{processingMsg}</p>
        </div>
      )}
    </div>
  );
}