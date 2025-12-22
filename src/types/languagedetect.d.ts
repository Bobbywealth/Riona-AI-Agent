declare module 'languagedetect' {
  class LanguageDetect {
    constructor();
    setLanguageType(type: 'iso2' | 'iso3'): void;
    detect(text: string, limit?: number): Array<[string, number]>;
  }
  export = LanguageDetect;
}






