import type {Locale} from './i18n/routing';

export function localizedPath(locale: Locale | string, path: `/${string}`) {
  return `/${locale}${path}`;
}
