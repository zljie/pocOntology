import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate UUID
export function generateId(): string {
  return crypto.randomUUID();
}

// PascalCase to camelCase
export function toCamelCase(str: string): string {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
}

// PascalCase validation
export function isPascalCase(str: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(str);
}

// camelCase validation
export function isCamelCase(str: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(str);
}

// Convert to PascalCase
export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .replace(/\s+/g, '');
}

// Format date
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get base type display name
export function getBaseTypeDisplayName(type: string): string {
  const typeMap: Record<string, string> = {
    STRING: '文本',
    INTEGER: '整数',
    DOUBLE: '小数',
    BOOLEAN: '布尔',
    TIMESTAMP: '时间戳',
    STRUCT: '结构体',
  };
  return typeMap[type] || type;
}

// Get cardinality display name
export function getCardinalityDisplayName(cardinality: string): string {
  const cardinalityMap: Record<string, string> = {
    ONE_TO_ONE: '1:1',
    ONE_TO_MANY: '1:N',
    MANY_TO_ONE: 'N:1',
    MANY_TO_MANY: 'M:N',
  };
  return cardinalityMap[cardinality] || cardinality;
}

// Get visibility display name
export function getVisibilityDisplayName(visibility: string): string {
  const visibilityMap: Record<string, string> = {
    PRIVATE: '私有',
    PROJECT: '项目级',
    GLOBAL: '全局',
  };
  return visibilityMap[visibility] || visibility;
}

// Get visibility color
export function getVisibilityColor(visibility: string): string {
  const colorMap: Record<string, string> = {
    PRIVATE: 'text-red-400',
    PROJECT: 'text-yellow-400',
    GLOBAL: 'text-green-400',
  };
  return colorMap[visibility] || 'text-gray-400';
}

// Get visibility badge color
export function getVisibilityBadgeColor(visibility: string): string {
  const colorMap: Record<string, string> = {
    PRIVATE: 'bg-red-500/20 text-red-400 border-red-500/30',
    PROJECT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    GLOBAL: 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  return colorMap[visibility] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

// Local storage helpers
export function saveToLocalStorage<T>(key: string, data: T): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

export function loadFromLocalStorage<T>(key: string): T | null {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }
  return null;
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
