import { readDraft, readLanguage } from './editorDraft';
beforeEach(() => localStorage.clear());
test('C++ upgrade recovers old draft while each problem/language keeps its own code', () => {
  localStorage.setItem('room:problem-a', 'old cpp');
  expect(readDraft(localStorage, 'room:problem-a', 'cpp', 'starter')).toBe('old cpp');
  expect(readDraft(localStorage, 'room:problem-a', 'python', 'python starter')).toBe(
    'python starter'
  );
  localStorage.setItem('room:problem-a:cpp', 'new cpp');
  localStorage.setItem('room:problem-a:python', 'print(5)');
  expect(readDraft(localStorage, 'room:problem-a', 'cpp', 'starter')).toBe('new cpp');
  expect(readDraft(localStorage, 'room:problem-a', 'python', 'starter')).toBe('print(5)');
  expect(readDraft(localStorage, 'room:problem-b', 'python', 'starter')).toBe('starter');
});
test('language selection validates storage and still opens when browser storage fails', () => {
  localStorage.setItem('language', 'java');
  expect(readLanguage(localStorage, 'language')).toBe('java');
  localStorage.setItem('language', 'bad');
  expect(readLanguage(localStorage, 'language')).toBe('cpp');
  const unavailable = {
    getItem() {
      throw Error('storage unavailable');
    },
  };
  expect(readDraft(unavailable, 'key', 'c', 'starter')).toBe('starter');
  expect(readLanguage(unavailable, 'key')).toBe('cpp');
});
