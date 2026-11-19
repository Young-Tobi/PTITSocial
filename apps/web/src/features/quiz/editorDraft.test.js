import { draftKey, readDraft, writeDraft, clearDraft } from './editorDraft';

beforeEach(() => localStorage.clear());
const quiz = {
  title: 'Đang soạn',
  questions: [{ id: 'q1', text: 'Chưa xong', options: ['', '', '', ''], explanation: '' }],
};
test('draft keys separate users, new quizzes and existing quizzes', () => {
  expect(draftKey('user1')).not.toBe(draftKey('user2'));
  expect(draftKey('user1')).not.toBe(draftKey('user1', 'quiz1'));
  writeDraft(draftKey('user1'), quiz);
  expect(readDraft(draftKey('user1'))).toEqual(quiz);
  expect(readDraft(draftKey('user2'))).toBeNull();
});
test('unfinished questions survive reload and clearing does not affect other drafts', () => {
  writeDraft('one', quiz);
  writeDraft('two', quiz);
  expect(readDraft('one').questions[0].text).toBe('Chưa xong');
  clearDraft('one');
  expect(readDraft('one')).toBeNull();
  expect(readDraft('two')).toEqual(quiz);
});
test('bad local data cannot crash the editor', () => {
  for (const value of [
    'bad json',
    'null',
    '{}',
    JSON.stringify({ ...quiz, questions: [null] }),
    JSON.stringify({ ...quiz, questions: [{ text: 'Missing options' }] }),
  ]) {
    localStorage.setItem('bad', value);
    expect(readDraft('bad')).toBeNull();
  }
});
test('storage write failure is reported to the editor while cleanup failure does not undo server save', () => {
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('Quota');
  });
  expect(() => writeDraft('key', quiz)).toThrow('Quota');
  write.mockRestore();
  const remove = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw Error('Blocked');
  });
  expect(() => clearDraft('key')).not.toThrow();
  remove.mockRestore();
});
