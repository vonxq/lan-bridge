import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

export type Locale = 'zh-CN' | 'en-US';

export const locales: Record<Locale, typeof zhCN> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export const localeNames: Record<Locale, string> = {
  'zh-CN': '中文',
  'en-US': 'English',
};

// 获取用户默认语言
export function getDefaultLocale(): Locale {
  // 检查 localStorage
  const saved = localStorage.getItem('lan-bridge-locale') as Locale;
  if (saved && locales[saved]) {
    return saved;
  }

  // 获取浏览器语言
  const browserLang = navigator.language;
  
  // 匹配语言
  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  }
  
  // 默认英文
  return 'en-US';
}

// 保存语言设置
export function saveLocale(locale: Locale): void {
  localStorage.setItem('lan-bridge-locale', locale);
}

// 深度获取对象属性
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let result: unknown = obj;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path; // 找不到返回原路径
    }
  }
  
  return typeof result === 'string' ? result : path;
}

// 翻译函数
export function createT(locale: Locale) {
  const messages = locales[locale];
  
  return function t(key: string, params?: Record<string, string | number>): string {
    let text = getNestedValue(messages as unknown as Record<string, unknown>, key);
    
    // 替换参数
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
      });
    }
    
    return text;
  };
}

export type TFunction = ReturnType<typeof createT>;
