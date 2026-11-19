const AppError = require('@ptitsocial/service-kit/appError');
// IDs refer to the compiler/interpreter versions bundled with Judge0 CE 1.13.1.
const languages = {
  c: { id: 50, label: 'C', compilerOptions: '-std=c11 -O2', timeFactor: 1, processes: 2 },
  cpp: { id: 54, label: 'C++17', compilerOptions: '-std=c++17 -O2', timeFactor: 1, processes: 2 },
  java: {
    id: 62,
    label: 'Java',
    compilerOptions: '-encoding UTF-8',
    timeFactor: 2,
    processes: 32,
    memoryLimit: 2097152,
  },
  python: { id: 71, label: 'Python 3', timeFactor: 3, processes: 2 },
};
function getLanguage(key = 'cpp') {
  if (typeof key !== 'string' || !Object.hasOwn(languages, key))
    throw new AppError('Chọn C, C++, Java hoặc Python.', 400);
  return languages[key];
}
function limitsFor(key, problem) {
  const language = getLanguage(key),
    cpu = Math.min(10, problem.timeLimit * language.timeFactor);
  return {
    cpu_time_limit: cpu,
    wall_time_limit: Math.min(20, cpu * 2 + 1),
    memory_limit: language.memoryLimit || problem.memoryLimit,
    max_processes_and_or_threads: language.processes,
  };
}
module.exports = { languages, getLanguage, limitsFor };
