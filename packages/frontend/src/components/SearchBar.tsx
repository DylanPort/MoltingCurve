'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChange, placeholder = 'Search...', className = '', autoFocus = true }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <SearchIcon />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#E5E5E7',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'rgba(112, 184, 224, 0.4)';
          e.target.style.boxShadow = '0 0 0 2px rgba(112, 184, 224, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'rgba(255,255,255,0.08)';
          e.target.style.boxShadow = 'none';
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          style={{ color: '#666' }}
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke="#666" strokeWidth="1.5"/>
      <path d="M11 11L14 14" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// Search helper function to match against multiple fields
export function searchMatch(item: any, query: string, fields: string[]): boolean {
  if (!query.trim()) return true;
  
  const lowerQuery = query.toLowerCase().trim();
  const queryTerms = lowerQuery.split(/\s+/);
  
  // Get all searchable text from the item
  const searchableText = fields.map(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], item);
    return String(value || '').toLowerCase();
  }).join(' ');
  
  // All terms must match somewhere
  return queryTerms.every(term => searchableText.includes(term));
}

// Highlight matching text
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) return text;
  
  return (
    <>
      {text.slice(0, index)}
      <span style={{ background: 'rgba(251, 191, 36, 0.3)', borderRadius: '2px', padding: '0 1px' }}>
        {text.slice(index, index + lowerQuery.length)}
      </span>
      {text.slice(index + lowerQuery.length)}
    </>
  );
}
