export type Locale = 'en' | 'ko';

type Widen<T> =
  T extends string ? string :
  T extends readonly string[] ? readonly string[] :
  T extends (...args: infer A) => infer R ? (...args: A) => Widen<R> :
  T extends Record<string, unknown> ? { [K in keyof T]: Widen<T[K]> } :
  T;

type RawTranslations = typeof import('./ko').default;

export type Translations = Widen<RawTranslations>;
