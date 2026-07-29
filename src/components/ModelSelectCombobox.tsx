'use client';

import React, { useState, useMemo } from 'react';
import { SpecificModel } from '@/lib/db';
import { Search, X, Plus, Edit2, Loader2, Check } from 'lucide-react';

interface ModelSelectComboboxProps {
  models: SpecificModel[];
  selectedModel: string;
  onSelectModel: (modelName: string) => void;
  onModelAdded?: (newModel: SpecificModel) => void;
  tenantId: string;
  label?: string;
  placeholder?: string;
}

export default function ModelSelectCombobox({
  models,
  selectedModel,
  onSelectModel,
  onModelAdded,
  tenantId,
  label = 'דגם הכלי',
  placeholder = 'חפש דגם מתוך המאגר או הקלד דגם חדש...',
}: ModelSelectComboboxProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [newModelInput, setNewModelInput] = useState('');
  const [isSavingNewModel, setIsSavingNewModel] = useState(false);

  const filteredModels = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return models;
    return models.filter(m => m.name.toLowerCase().includes(term));
  }, [models, searchTerm]);

  const exactMatchExists = useMemo(() => {
    const term = (isAddingInline ? newModelInput : searchTerm).trim().toLowerCase();
    return models.some(m => m.name.toLowerCase() === term);
  }, [models, searchTerm, isAddingInline, newModelInput]);

  const handleAddNewModel = async (explicitName?: string) => {
    const nameToSave = (explicitName || (isAddingInline ? newModelInput : searchTerm)).trim();
    if (!nameToSave) return;

    // If it already exists in the list, just select it
    const existing = models.find(m => m.name.toLowerCase() === nameToSave.toLowerCase());
    if (existing) {
      onSelectModel(existing.name);
      setIsOpen(false);
      setIsAddingInline(false);
      setNewModelInput('');
      setSearchTerm('');
      return;
    }

    setIsSavingNewModel(true);
    try {
      const res = await fetch(`/api/${tenantId}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName: nameToSave, deviceType: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת דגם חדש');

      const createdModel: SpecificModel = { name: nameToSave, deviceType: '' };
      if (onModelAdded) {
        onModelAdded(createdModel);
      }
      onSelectModel(nameToSave);
      setIsOpen(false);
      setIsAddingInline(false);
      setNewModelInput('');
      setSearchTerm('');
    } catch (err) {
      // Fallback: select it locally
      onSelectModel(nameToSave);
      setIsOpen(false);
      setIsAddingInline(false);
      setNewModelInput('');
      setSearchTerm('');
    } finally {
      setIsSavingNewModel(false);
    }
  };

  return (
    <div className="space-y-1.5 relative">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-gray-700 flex items-center gap-1">
            <span>{label}</span>
            <span className="text-gray-400 font-normal">(מאגר דגמים)</span>
          </label>
          <button
            type="button"
            onClick={() => {
              setIsAddingInline(true);
              setIsOpen(false);
            }}
            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ הוסף דגם חדש למאגר</span>
          </button>
        </div>
      )}

      {/* Inline New Model Creator Mode */}
      {isAddingInline ? (
        <div className="p-3 bg-purple-50 border-2 border-purple-300 rounded-xl space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-purple-900 flex items-center gap-1">
              <Plus className="w-4 h-4 text-purple-600" />
              הוספת דגם חדש למאגר העסק
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAddingInline(false);
                setNewModelInput('');
              }}
              className="text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="שם הדגם החדש (למשל: Xiaomi Ultra 4)..."
              value={newModelInput}
              onChange={(e) => setNewModelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNewModel();
                }
              }}
              className="flex-1 px-3 py-2 text-xs font-bold rounded-lg border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              autoFocus
            />
            <button
              type="button"
              onClick={() => handleAddNewModel()}
              disabled={isSavingNewModel || !newModelInput.trim()}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-lg disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
            >
              {isSavingNewModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>שמור למאגר</span>
            </button>
          </div>
        </div>
      ) : selectedModel ? (
        <div className="flex items-center justify-between p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl transition-all shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
              🛴
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-gray-900 text-xs block truncate">
                {selectedModel}
              </span>
              <span className="text-[10px] text-purple-700 font-medium block truncate">
                דגם מתוך המאגר המרכזי
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onSelectModel('');
              setSearchTerm('');
              setIsOpen(true);
            }}
            className="px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100/80 rounded-lg border border-purple-200 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
          >
            <Edit2 className="w-3 h-3" />
            <span>שנה דגם</span>
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isOpen && (
            <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-gray-50 animate-in fade-in duration-150">
              {/* Always visible "+ הוסף דגם חדש למאגר" option at top of dropdown */}
              <button
                type="button"
                onClick={() => {
                  if (searchTerm.trim()) {
                    handleAddNewModel(searchTerm.trim());
                  } else {
                    setIsAddingInline(true);
                    setIsOpen(false);
                  }
                }}
                disabled={isSavingNewModel}
                className="w-full p-3 text-right bg-purple-50 hover:bg-purple-100/90 text-purple-900 flex items-center justify-between transition-colors cursor-pointer font-bold text-xs sticky top-0 z-10 border-b border-purple-100"
              >
                <div className="flex items-center gap-2">
                  {isSavingNewModel ? <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> : <Plus className="w-4 h-4 text-purple-600" />}
                  <span>{searchTerm.trim() ? `הוסף את "${searchTerm.trim()}" כדגם חדש למאגר` : '+ הוסף דגם חדש למאגר'}</span>
                </div>
                <span className="text-[10px] bg-purple-600 text-white px-2.5 py-1 rounded-md shadow-2xs font-extrabold flex items-center gap-1">
                  <Plus className="w-3 h-3" /> הוסף למאגר
                </span>
              </button>

              {filteredModels.length === 0 && !searchTerm.trim() ? (
                <div className="p-4 text-center text-xs text-gray-400 font-medium">
                  אין דגמים במאגר. לחץ על &quot;+ הוסף דגם חדש למאגר&quot; למעלה.
                </div>
              ) : filteredModels.length === 0 && searchTerm.trim() ? null : (
                filteredModels.map(m => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => {
                      onSelectModel(m.name);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className="w-full p-2.5 text-right hover:bg-purple-50/40 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs">🛴</span>
                      <strong className="text-xs font-bold text-gray-800 block">
                        {m.name}
                      </strong>
                    </div>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                      בחר דגם
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
