// components/Sidebar.tsx
import React from 'react';
import { ChevronRight, Hash, LayoutGrid } from 'lucide-react';

interface SidebarProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export default function Sidebar({ tags, selectedTag, onSelectTag }: SidebarProps) {
  return (
    <aside className="w-64 hidden md:block border-r border-gray-800 h-[calc(100vh-65px)] overflow-y-auto sticky top-[65px] p-6">
      <div className="mb-6">
        <h3 className="text-[10px] font-bold text-subtext uppercase tracking-[0.2em] mb-4">Discovery</h3>
        <nav className="flex flex-col gap-1.5">
          <button
            onClick={() => onSelectTag(null)}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              selectedTag === null 
                ? "bg-accent text-white shadow-lg shadow-accent/20" 
                : "text-subtext hover:bg-surface hover:text-white"
            }`}
          >
            <LayoutGrid className={`w-4 h-4 ${selectedTag === null ? "text-white" : "text-accent"}`} />
            All Markets
          </button>
        </nav>
      </div>
      
      <div>
        <h3 className="text-[10px] font-bold text-subtext uppercase tracking-[0.2em] mb-4">Tags</h3>
        <nav className="flex flex-col gap-1">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onSelectTag(tag)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                selectedTag === tag 
                  ? "bg-surface text-white border border-gray-700 shadow-inner" 
                  : "text-subtext hover:bg-surface/50 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Hash className={`w-3.5 h-3.5 ${selectedTag === tag ? "text-accent" : "text-gray-600 group-hover:text-accent"}`} />
                <span className="truncate max-w-[120px]">{tag}</span>
              </div>
              {selectedTag === tag && <ChevronRight className="w-3 h-3 text-accent" />}
            </button>
          ))}
        </nav>
      </div>

      {/* Footer Note */}
      <div className="mt-10 p-4 rounded-2xl bg-gradient-to-br from-surface to-transparent border border-gray-800/50">
         <p className="text-[10px] text-subtext leading-relaxed">
           Trade responsible. Demo markets use virtual credits.
         </p>
      </div>
    </aside>
  );
}