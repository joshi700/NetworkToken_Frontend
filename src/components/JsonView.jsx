import React, { useMemo, useState } from 'react';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Minimal JSON syntax highlighter (keys, strings, numbers, booleans, null)
export const highlightJson = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return escapeHtml(text ?? '').replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-300';
      if (/^"/.test(match)) cls = /:$/.test(match) ? 'text-sky-300' : 'text-emerald-300';
      else if (/true|false/.test(match)) cls = 'text-purple-300';
      else if (/null/.test(match)) cls = 'text-gray-400';
      return `<span class="${cls}">${match}</span>`;
    }
  );
};

export const CopyButton = ({ text, label = 'Copy', className = '' }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 ${className}`}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
};

const JsonView = ({ value, className = '' }) => {
  const html = useMemo(() => highlightJson(value), [value]);
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <div className="relative">
      <CopyButton text={text} className="absolute top-2 right-2 opacity-80 hover:opacity-100" />
      <pre className={`json-view ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

export default JsonView;
