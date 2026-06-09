import React from 'react';

// Detect URLs (http/https/www) and phone numbers (intl + local YE styles).
// Phone matches: +967..., 00967..., 7XXXXXXXX (9 digits starting with 7), 03/04/05/06 local etc.
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>()"']+[^\s<>()"'.,;:!?])/gi;
const PHONE_RE = /(\+?\d[\d\s\-()]{7,}\d)/g;

const normalizePhone = (raw: string): string | null => {
  const digits = raw.replace(/[^\d+]/g, '');
  const onlyDigits = digits.replace(/\+/g, '');
  if (onlyDigits.length < 8 || onlyDigits.length > 15) return null;
  return digits.startsWith('+') ? digits : digits;
};

interface Token {
  type: 'text' | 'url' | 'phone';
  value: string;
  href?: string;
}

const tokenize = (text: string): Token[] => {
  // First split by URLs, then within text segments split by phone numbers.
  const tokens: Token[] = [];
  let lastIndex = 0;
  const urlMatches = [...text.matchAll(URL_RE)];

  const pushTextWithPhones = (segment: string) => {
    let last = 0;
    for (const m of segment.matchAll(PHONE_RE)) {
      const idx = m.index ?? 0;
      const raw = m[0];
      const normalized = normalizePhone(raw);
      // Skip if contained inside what looks like a date or too short
      if (!normalized) continue;
      if (idx > last) tokens.push({ type: 'text', value: segment.slice(last, idx) });
      tokens.push({ type: 'phone', value: raw, href: `tel:${normalized}` });
      last = idx + raw.length;
    }
    if (last < segment.length) tokens.push({ type: 'text', value: segment.slice(last) });
  };

  for (const m of urlMatches) {
    const idx = m.index ?? 0;
    if (idx > lastIndex) pushTextWithPhones(text.slice(lastIndex, idx));
    const url = m[0];
    const href = url.startsWith('http') ? url : `https://${url}`;
    tokens.push({ type: 'url', value: url, href });
    lastIndex = idx + url.length;
  }
  if (lastIndex < text.length) pushTextWithPhones(text.slice(lastIndex));
  return tokens;
};

interface LinkifyProps {
  text: string;
  className?: string;
}

export const Linkify: React.FC<LinkifyProps> = ({ text, className }) => {
  const tokens = tokenize(text);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.type === 'text') return <React.Fragment key={i}>{tok.value}</React.Fragment>;
        return (
          <a
            key={i}
            href={tok.href}
            target={tok.type === 'url' ? '_blank' : undefined}
            rel={tok.type === 'url' ? 'noopener noreferrer' : undefined}
            onClick={(e) => e.stopPropagation()}
            className={className ?? 'underline underline-offset-2 font-medium break-all hover:opacity-80'}
            dir="ltr"
          >
            {tok.value}
          </a>
        );
      })}
    </>
  );
};
