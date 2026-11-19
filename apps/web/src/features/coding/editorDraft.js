// Keep the old draft as a C++ fallback, so the upgrade doesn't lose existing work.
export function readDraft(storage, baseKey, language, fallback) {
  try {
    return (
      storage.getItem(`${baseKey}:${language}`) ??
      (language === 'cpp' ? storage.getItem(baseKey) : null) ??
      fallback
    );
  } catch {
    return fallback;
  }
}
export function readLanguage(storage, key) {
  try {
    const value = storage.getItem(key);
    return ['c', 'cpp', 'java', 'python'].includes(value) ? value : 'cpp';
  } catch {
    return 'cpp';
  }
}
