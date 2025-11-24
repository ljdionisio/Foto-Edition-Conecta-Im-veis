import React, { useRef, useState, useEffect } from 'react';
import { Adjustments, FilterType, UserConfig } from '../types';
import { DEFAULT_ADJUSTMENTS, FILTERS } from '../constants';
import Slider from './ui/Slider';
import { Layers, Shield, Save, ImageIcon, Wand2, Trash2, Check, X, MoreVertical, History, RotateCcw } from './ui/Icons';

interface ToolbarProps {
  adjustments: Adjustments;
  setAdjustments: (adj: Adjustments) => void;
  applyFilter: (type: FilterType) => void;
  
  // User Config Props
  userConfigs: UserConfig[];
  onSaveUserConfig: (name: string) => void;
  onLoadUserConfig: (config: UserConfig) => void;
  onDeleteUserConfig: (id: string) => void;

  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveBackground: () => void;
  isRemovingBg: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
    adjustments, 
    setAdjustments, 
    applyFilter, 
    userConfigs,
    onSaveUserConfig,
    onLoadUserConfig,
    onDeleteUserConfig,
    onLogoUpload,
    onRemoveBackground,
    isRemovingBg
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);

  // States for Configuration UI
  const [isNamingConfig, setIsNamingConfig] = useState(false);
  const [configName, setConfigName] = useState("");
  const [showConfigList, setShowConfigList] = useState(false);
  const configListRef = useRef<HTMLDivElement>(null);

  const update = (key: keyof Adjustments, value: number | string | boolean | null) => {
    setAdjustments({ ...adjustments, [key]: value });
  };

  const handleSaveClick = () => {
    if (configName.trim()) {
        onSaveUserConfig(configName);
        setConfigName("");
        setIsNamingConfig(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (configListRef.current && !configListRef.current.contains(event.target as Node)) {
        setShowConfigList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-2">
      
      {/* HEADER: Config Management */}
      <div className="flex flex-col gap-2 mb-6 border-b border-white/10 pb-4">
        <h2 className="text-sm font-bold text-violet-300 mb-1">Gerenciar Estilo</h2>
        
        {/* Save & Load Buttons Row */}
        <div className="flex gap-2 relative">
             {/* Save Button / Input Group */}
             {!isNamingConfig ? (
                 <button 
                    onClick={() => setIsNamingConfig(true)}
                    className="flex-1 glass-button text-xs py-2 rounded flex items-center justify-center gap-2 hover:bg-violet-500/20 text-gray-200"
                 >
                    <Save size={14} /> Salvar Atual
                 </button>
             ) : (
                 <div className="flex-1 flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
                    <input 
                        type="text" 
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                        placeholder="Nome do estilo..."
                        className="w-full bg-black/40 border border-white/20 rounded text-xs px-2 py-1.5 focus:border-violet-500 outline-none text-white"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveClick()}
                    />
                    <button onClick={handleSaveClick} className="p-1.5 bg-violet-600 rounded hover:bg-violet-500 text-white"><Check size={12}/></button>
                    <button onClick={() => setIsNamingConfig(false)} className="p-1.5 bg-red-500/20 rounded hover:bg-red-500/40 text-red-200"><X size={12}/></button>
                 </div>
             )}

             {/* Load / List Button */}
             <div className="relative" ref={configListRef}>
                 <button 
                    onClick={() => setShowConfigList(!showConfigList)}
                    className="glass-button px-3 py-2 rounded text-xs flex items-center gap-2 hover:bg-white/10 text-gray-200"
                    title="Minhas Configurações Salvas"
                 >
                    <History size={14} /> Minhas Configs
                 </button>

                 {/* Dropdown List */}
                 {showConfigList && (
                     <div className="absolute top-full right-0 mt-2 w-64 bg-[#1a1c2e] border border-white/10 rounded-lg shadow-2xl backdrop-blur-xl z-50 max-h-60 overflow-y-auto">
                         <div className="p-2 text-[10px] text-gray-400 uppercase font-bold tracking-wider border-b border-white/5">
                            Salvos ({userConfigs.length})
                         </div>
                         {userConfigs.length === 0 ? (
                             <div className="p-4 text-center text-xs text-gray-500">Nenhuma config salva.</div>
                         ) : (
                             <div className="flex flex-col">
                                 {userConfigs.map(config => (
                                     <div key={config.id} className="flex items-center justify-between p-2 hover:bg-white/5 transition-colors group border-b border-white/5 last:border-0">
                                         <button 
                                            onClick={() => { onLoadUserConfig(config); setShowConfigList(false); }}
                                            className="flex-1 text-left"
                                         >
                                             <div className="text-xs font-medium text-gray-200 group-hover:text-violet-300">{config.name}</div>
                                             <div className="text-[10px] text-gray-500">{new Date(config.createdAt).toLocaleDateString()}</div>
                                         </button>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteUserConfig(config.id); }}
                                            className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Excluir"
                                         >
                                             <Trash2 size={12} />
                                         </button>
                                     </div>
                                 ))}
                             </div>
                         )}
                     </div>
                 )}
             </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 text-white/80">
            <Layers size={16} />
            <h3 className="text-sm font-semibold">Filtros</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {Object.values(FilterType).map((filter) => (
            <button
              key={filter}
              onClick={() => applyFilter(filter)}
              className="glass-button text-xs py-2 rounded-lg text-gray-200 hover:text-white"
            >
              {filter}
            </button>
          ))}
        </div>
        
        {/* Reset Button */}
        <button
          onClick={() => setAdjustments(DEFAULT_ADJUSTMENTS)}
          className="w-full py-2 glass-button rounded-lg text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200 hover:border-red-500/30 flex items-center justify-center gap-2 transition-all border border-transparent"
          title="Remove todas as edições e volta ao original"
        >
           <RotateCcw size={14} />
           Restaurar Original
        </button>
      </div>

      <hr className="border-white/10 mb-6" />

      {/* Elements / Watermark Section */}
      <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 text-white/80">
            <ImageIcon size={16} />
            <h3 className="text-sm font-semibold">Elementos</h3>
          </div>
          
          <input 
              type="file" 
              accept="image/*" 
              ref={logoInputRef}
              className="hidden"
              onChange={onLogoUpload}
          />

          {!adjustments.overlayImage ? (
              <button 
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full py-3 glass-button rounded-lg border-dashed border-white/20 text-gray-400 text-xs hover:text-white hover:border-violet-500/50 flex items-center justify-center gap-2"
              >
                  <ImageIcon size={14} /> Adicionar Elemento/Logo
              </button>
          ) : (
              <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                      <div className="w-12 h-12 bg-white/5 rounded border border-white/10 relative overflow-hidden flex items-center justify-center checkerboard-bg">
                           <img src={adjustments.overlayImage} className="max-w-full max-h-full object-contain" alt="overlay" />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                          <button 
                             onClick={onRemoveBackground}
                             disabled={isRemovingBg}
                             className="text-[10px] bg-violet-600/80 hover:bg-violet-500 text-white px-2 py-1 rounded flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                             {isRemovingBg ? <div className="animate-spin w-3 h-3 border-2 border-white/30 border-t-white rounded-full"></div> : <Wand2 size={10} />}
                             Remover Fundo (IA)
                          </button>
                          <button 
                              onClick={() => update('overlayImage', null)}
                              className="text-[10px] bg-red-500/20 hover:bg-red-500/40 text-red-200 px-2 py-1 rounded flex items-center justify-center gap-1"
                          >
                              <Trash2 size={10} /> Remover
                          </button>
                      </div>
                  </div>

                  <Slider
                    label="Tamanho"
                    value={(adjustments.overlayScale || 0.2) * 100}
                    min={5}
                    max={200}
                    step={1}
                    onChange={(v) => update('overlayScale', v / 100)}
                    resetValue={20}
                  />
                  <Slider
                    label="Opacidade"
                    value={(adjustments.overlayOpacity !== undefined ? adjustments.overlayOpacity : 1) * 100}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => update('overlayOpacity', v / 100)}
                    resetValue={100}
                  />
                  <div className="grid grid-cols-2 gap-2">
                       <Slider
                        label="Posição X"
                        value={(adjustments.overlayX || 0.5) * 100}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(v) => update('overlayX', v / 100)}
                        resetValue={50}
                      />
                       <Slider
                        label="Posição Y"
                        value={(adjustments.overlayY || 0.5) * 100}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(v) => update('overlayY', v / 100)}
                        resetValue={50}
                      />
                  </div>
              </div>
          )}
      </div>

      <hr className="border-white/10 mb-6" />

      {/* Adjustments Section */}
      <div className="space-y-1">
        <Slider
          label="Brilho"
          value={adjustments.brightness}
          min={0}
          max={200}
          onChange={(v) => update('brightness', v)}
          resetValue={DEFAULT_ADJUSTMENTS.brightness}
        />
        <Slider
          label="Contraste"
          value={adjustments.contrast}
          min={0}
          max={200}
          onChange={(v) => update('contrast', v)}
          resetValue={DEFAULT_ADJUSTMENTS.contrast}
        />
        <Slider
          label="Saturação"
          value={adjustments.saturation}
          min={0}
          max={200}
          onChange={(v) => update('saturation', v)}
          resetValue={DEFAULT_ADJUSTMENTS.saturation}
        />
        <Slider
          label="Desfoque"
          value={adjustments.blur}
          min={0}
          max={10}
          step={0.1}
          onChange={(v) => update('blur', v)}
          resetValue={DEFAULT_ADJUSTMENTS.blur}
        />
        <Slider
            label="P&B"
            value={adjustments.grayscale}
            min={0}
            max={100}
            onChange={(v) => update('grayscale', v)}
            resetValue={DEFAULT_ADJUSTMENTS.grayscale}
        />
        <Slider
          label="Temperatura"
          value={adjustments.warmth}
          min={0}
          max={100}
          onChange={(v) => update('warmth', v)}
          resetValue={DEFAULT_ADJUSTMENTS.warmth}
        />
      </div>
      
      {/* Privacy Section */}
      <div className="mt-6 mb-6">
         <div className="flex items-center gap-2 mb-3 text-white/80">
            <Shield size={16} />
            <h3 className="text-sm font-semibold">Privacidade</h3>
        </div>
        <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
            <span className="text-xs text-gray-300">Desfocar Rostos/Placas</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={adjustments.privacyBlur} 
                onChange={(e) => update('privacyBlur', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
        </div>
      </div>

      <hr className="border-white/10 my-6" />

      <div className="mb-8">
        <label className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-2 block">Texto Rodapé</label>
        <input 
            type="text" 
            value={adjustments.watermark}
            onChange={(e) => update('watermark', e.target.value)}
            placeholder="© Seu Nome"
            className="w-full bg-black/20 border border-white/10 rounded-md p-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>
    </div>
  );
};

export default Toolbar;