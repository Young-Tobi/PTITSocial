const { Submission, Room } = require('./models');
const judge = require('./judge');
const engine = require('./engine');
const { withRoomLock } = require('./locks');
const { canImprove, problemId } = require('./rules');
let busy = false;
async function processOne() {
  if (busy) return;
  busy = true;
  try {
    const submission = await Submission.findOneAndUpdate(
      { status: 'queued' },
      { $set: { status: 'judging' } },
      { new: true, sort: { receivedAt: 1 } }
    );
    if (!submission) return;
    try {
      const room = await Room.findById(submission.roomId);
      const problem = room.problems.find((p) => problemId(p) === submission.problemId);
      if (!problem) throw Error('Missing problem snapshot');
      const tests = submission.mode === 'run' ? problem.samples : problem.tests;
      const results = [];
      let compileOutput = '';
      for (let index = 0; index < tests.length; index++) {
        const result = await judge.execute(
          submission.code,
          tests[index],
          problem,
          submission.language || 'cpp'
        );
        results.push({ index: index + 1, ...result });
        if (result.compileOutput) {
          compileOutput = result.compileOutput;
          break;
        }
      }
      submission.passed = results.filter((result) => result.passed).length;
      submission.total = tests.length;
      submission.results = results;
      submission.compileOutput = compileOutput;
      submission.verdict = compileOutput
        ? 'Lỗi biên dịch'
        : submission.passed === tests.length
          ? 'Đúng tất cả test'
          : `${submission.passed}/${tests.length} test đúng`;
      submission.status = 'done';
      submission.judgedAt = new Date();
      await withRoomLock(room._id, async () => {
        const current = await Room.findById(room._id);
        const player = current.players.find((item) => item.userId === submission.userId);
        // Use server receipt time, not time spent waiting in the Judge0 queue.
        const score = player.scores.find((s) => s.problemId === submission.problemId);
        if (
          submission.mode === 'submit' &&
          canImprove(score, submission.passed, submission.receivedAt)
        ) {
          const best = {
            problemId: submission.problemId,
            passed: submission.passed,
            total: tests.length,
            bestAt: submission.receivedAt,
          };
          if (score) Object.assign(score, best);
          else player.scores.push(best);
          await current.save();
        }
        await submission.save();
        await engine.refresh(current);
        engine.publish(current._id);
      });
    } catch (error) {
      submission.status = 'error';
      submission.error = error.isOperational
        ? error.message
        : 'Không chấm được bài. Vui lòng thử lại.';
      await submission.save();
      engine.publish(submission.roomId);
    }
  } catch (error) {
    console.error('Coding worker:', error.message);
  } finally {
    busy = false;
  }
}
async function startWorker() {
  // A crash must not leave a submitted job permanently stuck in 'judging'.
  await Submission.updateMany({ status: 'judging' }, { $set: { status: 'queued' } });
  const timer = setInterval(processOne, 400);
  timer.unref();
}
module.exports = { startWorker };
