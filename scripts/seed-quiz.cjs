// Optional local fixtures. Uses the existing demo account; never creates or edits accounts.
const base = process.env.API_URL || 'http://localhost:8000';
async function main() {
  if (!process.env.QUIZ_SEED_EMAIL || !process.env.QUIZ_SEED_PASSWORD)
    throw Error('Đặt QUIZ_SEED_EMAIL và QUIZ_SEED_PASSWORD bằng tài khoản đã đăng ký và xác minh.');
  const login = await fetch(base + '/api/v1/users/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.QUIZ_SEED_EMAIL,
      password: process.env.QUIZ_SEED_PASSWORD,
    }),
  });
  const session = await login.json();
  if (!login.ok)
    throw Error(
      'Đăng nhập tài khoản mẫu thất bại. Đặt QUIZ_SEED_EMAIL và QUIZ_SEED_PASSWORD nếu dùng tài khoản khác.'
    );
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${session.data.token}`,
  };
  const existingResponse = await fetch(base + '/api/v1/quiz/quizzes', { headers });
  if (!existingResponse.ok)
    throw Error('Tài khoản cần xác minh email và service Quiz phải đang chạy.');
  const existing = (await existingResponse.json()).data.quizzes;
  const sets = [
    {
      title: 'Ôn tập Cơ sở dữ liệu',
      subject: 'Cơ sở dữ liệu',
      description: 'Đề mẫu: mô hình quan hệ, SQL và khóa. Dùng để thử phòng quiz.',
      questions: [
        [
          'Khóa chính của một bảng có đặc điểm nào?',
          [
            'Được phép trùng',
            'Duy nhất và không NULL',
            'Luôn là chuỗi',
            'Có thể chứa nhiều giá trị NULL',
          ],
          1,
          'Khóa chính xác định duy nhất từng bản ghi và không nhận NULL.',
        ],
        [
          'Lệnh SQL nào dùng để truy vấn dữ liệu?',
          ['INSERT', 'DELETE', 'SELECT', 'UPDATE'],
          2,
          'SELECT lấy dữ liệu; INSERT thêm, UPDATE sửa và DELETE xóa dữ liệu.',
        ],
        [
          'Khóa ngoại dùng để làm gì?',
          [
            'Liên kết dữ liệu giữa các bảng',
            'Mã hóa mật khẩu',
            'Sắp xếp theo tên',
            'Xóa toàn bộ bảng',
          ],
          0,
          'Khóa ngoại tham chiếu khóa của bảng liên quan, hỗ trợ toàn vẹn tham chiếu.',
        ],
        [
          'Mệnh đề nào lọc các nhóm sau GROUP BY?',
          ['ORDER BY', 'WHERE', 'LIMIT', 'HAVING'],
          3,
          'HAVING lọc nhóm sau khi tổng hợp. WHERE lọc bản ghi trước khi nhóm.',
        ],
        [
          'INNER JOIN trả về những bản ghi nào?',
          [
            'Mọi bản ghi bên trái',
            'Chỉ các bản ghi khớp điều kiện ở cả hai bảng',
            'Mọi bản ghi bên phải',
            'Mọi bản ghi của hai bảng',
          ],
          1,
          'INNER JOIN chỉ giữ các cặp bản ghi thỏa điều kiện nối.',
        ],
      ],
    },
    {
      title: 'JavaScript nền tảng',
      subject: 'Lập trình web',
      description: 'Đề mẫu: biến, mảng, Promise và React.',
      questions: [
        [
          'Từ khóa nào khai báo biến có phạm vi khối và có thể gán lại?',
          ['var', 'const', 'let', 'static'],
          2,
          'let có phạm vi khối và cho phép gán lại giá trị.',
        ],
        [
          'Phương thức nào tạo mảng mới bằng cách biến đổi từng phần tử?',
          ['push()', 'map()', 'pop()', 'sort()'],
          1,
          'map() trả về mảng mới chứa kết quả callback cho từng phần tử.',
        ],
        [
          'await thường được dùng để làm gì?',
          [
            'Xóa Promise',
            'Chạy vòng lặp vô hạn',
            'Khai báo component',
            'Chờ Promise hoàn tất trong hàm async',
          ],
          3,
          'await tạm dừng hàm async cho đến khi Promise hoàn tất hoặc bị từ chối.',
        ],
        [
          'React Hook nào quản lý state cục bộ của component?',
          ['useState', 'useEffect', 'useRef', 'useMemo'],
          0,
          'useState lưu state; gọi setter yêu cầu React cập nhật giao diện.',
        ],
        [
          'Toán tử === khác == ở điểm nào?',
          [
            'Luôn chuyển kiểu trước khi so sánh',
            'Chỉ dùng cho số',
            'So sánh nghiêm ngặt, không ép kiểu',
            'Không so sánh được chuỗi',
          ],
          2,
          '=== kiểm tra bằng nhau mà không thực hiện ép kiểu như ==.',
        ],
      ],
    },
  ];
  for (const set of sets) {
    if (existing.some((quiz) => quiz.title === set.title)) {
      console.log('Giữ nguyên đề đã có: ' + set.title);
      continue;
    }
    const response = await fetch(base + '/api/v1/quiz/quizzes', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...set,
        status: 'ready',
        visibility: 'public',
        questions: set.questions.map(([text, options, correctIndex, explanation], index) => ({
          id: `sample-${index + 1}`,
          text,
          options,
          correctIndex,
          explanation,
          timeLimit: 30,
        })),
      }),
    });
    if (!response.ok) throw Error('Không tạo được đề mẫu: ' + set.title);
    console.log('Đã tạo đề công khai: ' + set.title);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
