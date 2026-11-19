const AppError = require('@ptitsocial/service-kit/appError');
const { languages: profiles, getLanguage, limitsFor } = require('./languages');
let initialized = false;
async function call(path, options = {}) {
  let response;
  try {
    response = await fetch(process.env.JUDGE0_URL + path, {
      ...options,
      headers: {
        'content-type': 'application/json',
        'X-Auth-Token': process.env.JUDGE0_AUTH_TOKEN,
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AppError('Không kết nối được Judge0. Kiểm tra Docker rồi thử lại.', 503);
  }
  if (!response.ok)
    throw new AppError('Judge0 đang bận hoặc chưa sẵn sàng. Vui lòng thử lại.', 503);
  return response.json();
}
async function ready() {
  const languages = await call('/languages');
  for (const profile of Object.values(profiles))
    if (!languages.some((item) => item.id === profile.id))
      throw new AppError(`Judge0 chưa có ${profile.label}.`, 503);
  initialized = true;
  return {
    ready: true,
    languages: Object.entries(profiles).map(([key, p]) => ({
      key,
      label: p.label,
      name: languages.find((item) => item.id === p.id).name,
    })),
  };
}
async function execute(code, test, problem, language = 'cpp') {
  const profile = getLanguage(language);
  if (!initialized) await ready();
  const base64 = (value) => Buffer.from(value, 'utf8').toString('base64');
  const created = await call('/submissions?base64_encoded=true&wait=false', {
    method: 'POST',
    body: JSON.stringify({
      language_id: profile.id,
      // Controlled by this service; never take compiler flags from the browser.
      ...(profile.compilerOptions ? { compiler_options: profile.compilerOptions } : {}),
      source_code: base64(code),
      stdin: base64(test.input),
      expected_output: base64(test.output),
      ...limitsFor(language, problem),
      max_file_size: 64,
      enable_network: false,
      enable_per_process_and_thread_time_limit: true,
      enable_per_process_and_thread_memory_limit: true,
    }),
  });
  for (let tries = 0; tries < 160; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const result = await call(
      `/submissions/${created.token}?base64_encoded=true&fields=status,stdout,stderr,compile_output,time,memory,message`
    );
    if (result.status.id <= 2) continue;
    const decode = (value) =>
      value ? Buffer.from(value, 'base64').toString('utf8').slice(0, 8000) : '';
    if (result.status.id === 13)
      throw new AppError(
        'Judge0 gặp lỗi môi trường chấm. Bài này không được tính điểm; vui lòng thử lại.',
        503
      );
    return {
      passed: result.status.id === 3,
      status: result.status.description,
      time: result.time,
      memory: result.memory,
      output: decode(result.stdout),
      compileOutput: decode(result.compile_output),
      stderr: decode(result.stderr),
    };
  }
  throw new AppError('Chờ chấm quá lâu. Vui lòng thử lại.', 503);
}
module.exports = { ready, execute };
