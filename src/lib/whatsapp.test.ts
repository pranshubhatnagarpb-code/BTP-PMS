import { describe, it, expect } from 'vitest';
import { toWhatsAppNumber, whatsAppShareUrl } from './whatsapp';

describe('toWhatsAppNumber', () => {
  it('normalizes common Indian formats to 91XXXXXXXXXX', () => {
    expect(toWhatsAppNumber('98765 43210')).toBe('919876543210');
    expect(toWhatsAppNumber('+91-98765-43210')).toBe('919876543210');
    expect(toWhatsAppNumber('098765 43210')).toBe('919876543210');
    expect(toWhatsAppNumber('919876543210')).toBe('919876543210');
  });

  it('keeps other international numbers', () => {
    expect(toWhatsAppNumber('+44 7700 900123')).toBe('447700900123');
  });

  it('rejects missing or too-short numbers', () => {
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber('12345')).toBeNull();
  });
});

describe('whatsAppShareUrl', () => {
  it('encodes the message and targets the number', () => {
    expect(whatsAppShareUrl('Hi & bye', '9876543210')).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye');
  });

  it('opens the contact picker without a valid number', () => {
    expect(whatsAppShareUrl('Hi', null)).toBe('https://wa.me/?text=Hi');
  });
});
