const { Problem } = require('./models');
const starterCode =
  '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // Viet loi giai cua ban o day\n    return 0;\n}\n';
const catalog = [
  {
    slug: 'sum-array',
    title: 'Tổng dãy số',
    difficulty: 'easy',
    description: 'Cho một dãy gồm n số nguyên. Hãy tính tổng các phần tử trong dãy.',
    inputFormat: 'Dòng đầu chứa n. Dòng tiếp theo chứa n số nguyên.',
    outputFormat: 'In ra tổng các phần tử.',
    constraints: '1 ≤ n ≤ 100000; |a[i]| ≤ 10^9.',
    samples: [{ input: '5\n1 2 3 4 5\n', output: '15\n' }],
    tests: [
      { input: '1\n0\n', output: '0' },
      { input: '4\n-3 1 1 -5\n', output: '-6' },
      { input: '3\n1000000000 1000000000 1000000000\n', output: '3000000000' },
      { input: '5\n1 2 3 4 5\n', output: '15' },
    ],
  },
  {
    slug: 'max-array',
    title: 'Phần tử lớn nhất',
    difficulty: 'easy',
    description: 'Tìm giá trị lớn nhất trong dãy n số nguyên.',
    inputFormat: 'Dòng đầu là n. Dòng sau là n số nguyên.',
    outputFormat: 'In ra giá trị lớn nhất.',
    constraints: '1 ≤ n ≤ 100000; |a[i]| ≤ 10^9.',
    samples: [{ input: '5\n1 7 2 9 3\n', output: '9' }],
    tests: [
      { input: '1\n-9', output: '-9' },
      { input: '3\n-8 -2 -5', output: '-2' },
      { input: '4\n7 7 7 7', output: '7' },
      { input: '5\n1 7 2 9 3', output: '9' },
    ],
  },
  {
    slug: 'palindrome',
    title: 'Chuỗi đối xứng',
    difficulty: 'easy',
    description:
      'Kiểm tra một chuỗi có đọc giống nhau từ trái sang phải và từ phải sang trái hay không.',
    inputFormat: 'Một chuỗi không chứa dấu cách.',
    outputFormat: 'In YES nếu đối xứng, ngược lại in NO.',
    constraints: '1 ≤ độ dài chuỗi ≤ 100000; chỉ chứa chữ cái tiếng Anh viết thường.',
    samples: [{ input: 'level\n', output: 'YES' }],
    tests: [
      { input: 'a', output: 'YES' },
      { input: 'ab', output: 'NO' },
      { input: 'abba', output: 'YES' },
      { input: 'abcda', output: 'NO' },
    ],
  },
  {
    slug: 'distinct',
    title: 'Đếm giá trị khác nhau',
    difficulty: 'medium',
    description: 'Đếm số lượng giá trị khác nhau trong dãy n số nguyên.',
    inputFormat: 'Dòng đầu là n. Dòng sau là n số nguyên.',
    outputFormat: 'In ra số giá trị khác nhau.',
    constraints: '1 ≤ n ≤ 100000; |a[i]| ≤ 10^9.',
    samples: [{ input: '6\n1 2 2 3 1 4', output: '4' }],
    tests: [
      { input: '1\n5', output: '1' },
      { input: '4\n2 2 2 2', output: '1' },
      { input: '5\n-1 0 1 -1 0', output: '3' },
      { input: '6\n1 2 2 3 1 4', output: '4' },
    ],
  },
  {
    slug: 'max-subarray',
    title: 'Đoạn con có tổng lớn nhất',
    difficulty: 'medium',
    description: 'Tìm tổng lớn nhất của một đoạn con liên tiếp, không rỗng, trong dãy n số nguyên.',
    inputFormat: 'Dòng đầu là n. Dòng sau là n số nguyên.',
    outputFormat: 'In ra tổng lớn nhất.',
    constraints: '1 ≤ n ≤ 100000; |a[i]| ≤ 10^9.',
    samples: [{ input: '8\n-2 -3 4 -1 -2 1 5 -3', output: '7' }],
    tests: [
      { input: '3\n-8 -2 -5', output: '-2' },
      { input: '1\n9', output: '9' },
      { input: '3\n1000000000 1000000000 1000000000', output: '3000000000' },
      { input: '8\n-2 -3 4 -1 -2 1 5 -3', output: '7' },
    ],
  },
];
async function seed() {
  for (const problem of catalog)
    await Problem.updateOne(
      { slug: problem.slug },
      { $setOnInsert: { ...problem, starterCode, timeLimit: 2, memoryLimit: 262144 } },
      { upsert: true }
    );
}
module.exports = { seed };
