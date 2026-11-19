/* Bản nháp độc lập: dữ liệu trong bộ nhớ, không gọi API, không lưu vào database. */
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  users:
    '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3zM16 4a3 3 0 0 1 0 6M17 13a5 5 0 0 1 4 5v3h-3"/>',
  check: '<path d="M20 12v8H4V4h12M9 10l4 4L22 4"/>',
  code: '<path d="m8 5-7 7 7 7m8-14 7 7-7 7"/>',
  bell: '<path d="M4 18h16l-2-4V9a6 6 0 0 0-12 0v5zM10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  book: '<path d="M3 3h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 5v16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  send: '<path d="m22 2-7 20-4-9L2 9zM11 13 22 2"/>',
  trophy:
    '<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4M12 14v6m-5 1h10"/>',
  message: '<path d="M21 11a9 9 0 0 1-9 9H8l-6 2 2-6a9 9 0 1 1 17-5Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.code}</svg>`;
document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const screens = [
  ['discover', 'Danh sách phòng'],
  ['create', 'Tạo phòng'],
  ['waiting', 'Phòng chờ'],
  ['host', 'Người tổ chức'],
  ['contest', 'Người thi'],
  ['results', 'Kết quả'],
];
const problems = [
  {
    id: 1,
    title: 'Tổng dãy số',
    difficulty: 'Cơ bản',
    topic: 'Mảng · Vòng lặp',
    text: 'Cho một dãy gồm n số nguyên. Hãy tính tổng các phần tử trong dãy.',
    input: 'Dòng đầu chứa số nguyên n. Dòng tiếp theo chứa n số nguyên a₁, a₂, …, aₙ.',
    output: 'In ra một số nguyên là tổng các phần tử trong dãy.',
    constraints: '1 ≤ n ≤ 100 000; |aᵢ| ≤ 10⁹.',
    example: '5\n1 2 3 4 5',
    answer: '15',
  },
  {
    id: 2,
    title: 'Phần tử lớn nhất',
    difficulty: 'Cơ bản',
    topic: 'Mảng · Duyệt tuyến tính',
    text: 'Tìm giá trị lớn nhất trong dãy gồm n số nguyên.',
    input: 'Dòng đầu chứa n. Dòng tiếp theo chứa n số nguyên.',
    output: 'In ra giá trị lớn nhất của dãy.',
    constraints: '1 ≤ n ≤ 100 000; |aᵢ| ≤ 10⁹.',
    example: '5\n1 7 2 9 3',
    answer: '9',
  },
  {
    id: 3,
    title: 'Chuỗi đối xứng',
    difficulty: 'Cơ bản',
    topic: 'Chuỗi · Hai con trỏ',
    text: 'Kiểm tra một chuỗi có đọc giống nhau từ trái sang phải và từ phải sang trái hay không.',
    input: 'Một chuỗi không chứa dấu cách.',
    output: 'In YES nếu chuỗi đối xứng, ngược lại in NO.',
    constraints: '1 ≤ độ dài chuỗi ≤ 100 000; chỉ gồm chữ cái tiếng Anh viết thường.',
    example: 'level',
    answer: 'YES',
  },
  {
    id: 4,
    title: 'Đếm giá trị khác nhau',
    difficulty: 'Trung bình',
    topic: 'Tập hợp · Sắp xếp',
    text: 'Đếm số lượng giá trị khác nhau trong dãy n số nguyên.',
    input: 'Dòng đầu là n. Dòng sau là n số nguyên.',
    output: 'In số giá trị khác nhau.',
    constraints: '1 ≤ n ≤ 100 000; |aᵢ| ≤ 10⁹.',
    example: '6\n1 2 2 3 1 4',
    answer: '4',
  },
  {
    id: 5,
    title: 'Đoạn con có tổng lớn nhất',
    difficulty: 'Trung bình',
    topic: 'Mảng · Quy hoạch động',
    text: 'Tìm tổng lớn nhất của một đoạn con liên tiếp không rỗng trong dãy số nguyên.',
    input: 'Dòng đầu là n. Dòng sau là n số nguyên.',
    output: 'In tổng lớn nhất của một đoạn con.',
    constraints: '1 ≤ n ≤ 100 000; |aᵢ| ≤ 10⁹.',
    example: '8\n-2 -3 4 -1 -2 1 5 -3',
    answer: '7',
  },
];
const starter =
  '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    // Viết lời giải của bạn ở đây\n\n    return 0;\n}\n';
const state = {
  title: 'Luyện thuật toán cùng lớp D23',
  maxPlayers: 8,
  duration: 45,
  visibility: 'public',
  selected: [1, 3, 4],
  libraryTab: 'discover',
  roomSearch: '',
  roomFilter: 'all',
  problemSearch: '',
  difficulty: 'all',
  participantIndex: 0,
  drafts: {},
  attempts: {},
  consoleTab: 'run',
  lobbyRole: 'host',
  created: false,
  createdRoom: null,
  demoCount: 6,
  ownerName: 'Truong Le Duy',
  ended: false,
};
const selectedProblems = () => state.selected.map((id) => problems.find((p) => p.id === id));
const people = [
  ['Minh Anh', 'MA', 'rose'],
  ['Thanh Bình', 'TB', 'blue'],
  ['Ngọc Mai', 'NM', 'green'],
  ['Hoàng Nam', 'HN', ''],
  ['Thu Hà', 'TH', 'rose'],
  ['Đức Anh', 'DA', 'blue'],
];
const avatar = (name, tone = '') => `<span class="avatar ${tone}">${escapeHTML(name)}</span>`;
const badge = (text, tone = '') => `<span class="tag ${tone}">${text}</span>`;
const app = document.querySelector('#app');
let toastTimer;
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.display = 'none'), 3500);
}
function route() {
  return location.hash.slice(1).split('?')[0] || 'discover';
}
function go(view) {
  if (route() === view) render();
  else location.hash = view;
}
function sidebar() {
  return `<aside class="sidebar"><a href="/profile">${avatar('TD')} Truong Le Duy</a><a href="/">${icon('home')} Bảng tin</a><a href="/friends">${icon('users')} Bạn bè</a><a href="/messages">${icon('message')} Tin nhắn</a><a href="/quiz">${icon('check')} Quiz</a><a class="selected" href="#discover">${icon('code')} Thi đấu lập trình</a><div class="side-label">THI ĐẤU CỦA BẠN</div><a href="#discover" data-action="my-rooms">${icon('users')} Phòng tôi tổ chức</a><a href="#results">${icon('trophy')} Kết quả thi đấu</a><div class="side-note">Kết nối bạn bè qua những bài toán và cùng nhau tiến bộ.</div></aside>`;
}
function layout(content) {
  return `<div class="layout">${sidebar()}<main class="main">${content}</main></div>`;
}
function titleBlock(title, subtitle, action = '') {
  return `<div class="page-title"><div><div class="eyebrow">PTITSOCIAL / LẬP TRÌNH</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}
function tabs() {
  return `<div class="tabs"><a href="#discover" data-action="library-tab" data-tab="discover" class="${state.libraryTab === 'discover' ? 'on' : ''}">Khám phá phòng</a><a href="#discover" data-action="library-tab" data-tab="mine" class="${state.libraryTab === 'mine' ? 'on' : ''}">Phòng tôi tổ chức</a><a href="#discover" data-action="library-tab" data-tab="history" class="${state.libraryTab === 'history' ? 'on' : ''}">Lịch sử thi đấu</a></div>`;
}
function roomCard(room) {
  const roomData = escapeHTML(JSON.stringify(room));
  const tone = room.status === 'waiting' ? 'green' : room.status === 'running' ? 'orange' : '';
  const label =
    room.status === 'waiting' ? 'Đang chờ' : room.status === 'running' ? 'Đang thi' : 'Đã kết thúc';
  const canJoin = room.status === 'waiting' && room.count < room.max;
  const action =
    state.libraryTab === 'mine'
      ? room.status === 'running'
        ? 'host'
        : room.status === 'finished'
          ? 'results'
          : 'waiting'
      : room.status === 'finished'
        ? 'results'
        : 'waiting';
  return `<article class="panel room-card"><div class="row between"><span class="row" style="gap:7px">${badge(`<span class="dot"></span>${label}`, tone)}${badge(`${icon(room.private ? 'lock' : 'globe')}${room.private ? 'Riêng tư' : 'Công khai'}`)}</span><span class="muted" style="font-size:11px">${room.status === 'waiting' ? 'Vừa tạo' : 'Hôm nay'}</span></div><div><h2>${escapeHTML(room.title)}</h2><div class="owner">Người tổ chức: ${room.owner}</div></div><div class="room-meta"><span>${icon('book')}${room.problems} đề</span><span>${icon('clock')}${room.minutes} phút</span><span>${icon('users')}${room.count}/${room.max} người</span><span>${icon('code')}C++17</span></div><div class="card-footer"><div class="avatar-group">${avatar('MA', 'rose')}${avatar('TB', 'blue')}${avatar('NM', 'green')}${room.count > 3 ? avatar('+' + (room.count - 3)) : ''}</div><button class="btn ${canJoin ? 'outline' : ''} small" data-action="${action === 'results' ? 'go-results' : state.libraryTab === 'mine' ? 'manage-room' : 'join-public'}" data-view="${action}" data-room="${roomData}" ${!canJoin && state.libraryTab === 'discover' ? 'disabled' : ''}>${state.libraryTab === 'mine' ? 'Quản lý phòng' : room.status === 'finished' ? 'Xem kết quả' : canJoin ? 'Vào phòng' : room.status === 'running' ? 'Đã bắt đầu' : 'Phòng đã đầy'} ${canJoin ? icon('arrow') : ''}</button></div></article>`;
}
function discover() {
  const rooms = [
    {
      title: 'Luyện mảng & chuỗi cùng nhau',
      owner: 'Minh Anh',
      status: 'waiting',
      count: 5,
      max: 8,
      minutes: 45,
      problems: 3,
    },
    {
      title: 'Thử thách thuật toán cuối tuần',
      owner: 'Ngọc Mai',
      status: 'waiting',
      count: 3,
      max: 6,
      minutes: 60,
      problems: 4,
    },
    {
      title: 'Code cùng lớp D23',
      owner: 'Hoàng Nam',
      status: 'running',
      count: 6,
      max: 8,
      minutes: 45,
      problems: 3,
    },
    {
      title: 'Khởi động với C++',
      owner: 'Đức Anh',
      status: 'waiting',
      count: 4,
      max: 4,
      minutes: 30,
      problems: 2,
    },
  ];
  if (state.createdRoom?.visibility === 'public')
    rooms.unshift({
      title: state.createdRoom.title,
      owner: 'Truong Le Duy',
      status: 'waiting',
      count: 0,
      max: state.createdRoom.maxPlayers,
      minutes: state.createdRoom.duration,
      problems: state.createdRoom.selected.length,
      problemIds: state.createdRoom.selected,
    });
  let list =
    state.libraryTab === 'mine'
      ? [
          {
            title: state.title,
            owner: 'Bạn',
            status: 'waiting',
            count: Math.min(6, state.maxPlayers),
            max: state.maxPlayers,
            minutes: state.duration,
            problems: state.selected.length,
            private: state.visibility === 'private',
          },
          {
            title: 'Ôn tập thuật toán tuần 4',
            owner: 'Bạn',
            status: 'running',
            count: 6,
            max: 8,
            minutes: 45,
            problems: 3,
          },
        ]
      : state.libraryTab === 'history'
        ? [
            {
              title: 'Luyện mảng & chuỗi · Tuần 3',
              owner: 'Truong Le Duy',
              status: 'finished',
              count: 6,
              max: 8,
              minutes: 45,
              problems: 3,
            },
          ]
        : rooms;
  list = list.filter(
    (room) =>
      (state.roomFilter === 'all' || room.status === state.roomFilter) &&
      room.title.toLowerCase().includes(state.roomSearch.toLowerCase())
  );
  return layout(
    `${titleBlock('Thi đấu lập trình', 'Tìm một cuộc thi, thử sức với đề hay và kết nối cùng bạn bè.', `<a class="btn red" href="#create">${icon('plus')} Tạo phòng</a>`)}<section class="panel join-panel"><div class="intro"><div class="icon-tile">${icon('lock')}</div><div><h3>Bạn có mã phòng?</h3><p>Nhập mã để tham gia phòng được mời.</p></div></div><form id="join-form"><label class="a11y-label" for="join-code">Mã phòng</label><input id="join-code" placeholder="Nhập mã phòng" maxlength="6" pattern="[0-9]{6}" required><button class="btn red">Tham gia</button></form></section>${tabs()}<div class="toolbar"><label class="a11y-label" for="room-search">Tìm phòng theo tên</label><input id="room-search" placeholder="⌕  Tìm phòng theo tên..." value="${escapeHTML(state.roomSearch)}"><label class="a11y-label" for="room-filter">Trạng thái phòng</label><select id="room-filter"><option value="all">Tất cả trạng thái</option><option value="waiting" ${state.roomFilter === 'waiting' ? 'selected' : ''}>Đang chờ</option><option value="running" ${state.roomFilter === 'running' ? 'selected' : ''}>Đang thi</option></select><span class="count">${list.length} phòng ${state.libraryTab === 'discover' ? 'công khai' : ''}</span></div><div class="room-grid">${list.map(roomCard).join('') || '<div class="empty-state">Không có phòng phù hợp.</div>'}</div><div class="note" style="margin-top:22px">${icon('users')} Người tổ chức điều hành cuộc thi và không chiếm chỗ thi đấu. Bạn chỉ có thể tham gia khi phòng đang chờ và còn chỗ.</div>`
  );
}
function create() {
  const selected = selectedProblems();
  const catalog = problems.filter(
    (p) =>
      (state.difficulty === 'all' || p.difficulty === state.difficulty) &&
      p.title.toLowerCase().includes(state.problemSearch.toLowerCase())
  );
  return layout(
    `<div class="breadcrumbs"><a href="#discover">Thi đấu lập trình</a><span>/</span>Tạo phòng</div>${titleBlock('Tạo phòng thi đấu', 'Bạn là người tổ chức, lựa chọn bộ đề và điều hành cuộc thi.')}<div class="two-col"><div class="stack"><section class="panel"><div class="section-title"><span class="step">1</span><h2>Thông tin phòng</h2></div><div class="fields"><label class="full">Tên phòng <span><input id="room-title" maxlength="100" value="${escapeHTML(state.title)}" placeholder="Ví dụ: Luyện thuật toán cùng lớp D23"></span></label><label>Số người thi tối đa<input id="max-players" type="number" min="2" max="30" value="${state.maxPlayers}"></label><label>Thời lượng (phút)<input id="duration" type="number" min="5" max="180" value="${state.duration}"></label><div class="full"><h3>Quyền truy cập</h3><div class="visibility"><label class="choice ${state.visibility === 'public' ? 'chosen' : ''}"><input type="radio" name="visibility" value="public" ${state.visibility === 'public' ? 'checked' : ''}><span><strong>${icon('globe')} Công khai</strong><small>Hiển thị trong danh sách phòng.</small></span></label><label class="choice ${state.visibility === 'private' ? 'chosen' : ''}"><input type="radio" name="visibility" value="private" ${state.visibility === 'private' ? 'checked' : ''}><span><strong>${icon('lock')} Riêng tư</strong><small>Tham gia bằng mã phòng.</small></span></label></div></div></div><p class="muted" style="font-size:12px;margin:16px 0 0">Số chỗ chỉ tính người thi, không tính người tổ chức.</p></section><section class="panel"><div class="section-title"><span class="step">2</span><h2>Chọn đề từ kho</h2><span class="tag red" style="margin-left:auto">${selected.length} đề đã chọn</span></div><div class="toolbar"><label class="a11y-label" for="problem-search">Tìm đề</label><input id="problem-search" placeholder="⌕  Tìm tên đề..." value="${escapeHTML(state.problemSearch)}"><label class="a11y-label" for="difficulty">Độ khó</label><select id="difficulty"><option value="all">Tất cả độ khó</option><option ${state.difficulty === 'Cơ bản' ? 'selected' : ''}>Cơ bản</option><option ${state.difficulty === 'Trung bình' ? 'selected' : ''}>Trung bình</option></select></div>${catalog.map((p) => `<div class="problem-pick"><input id="pick-${p.id}" type="checkbox" data-problem="${p.id}" ${state.selected.includes(p.id) ? 'checked' : ''}><label for="pick-${p.id}"><strong>${p.title}</strong><small>${badge(p.difficulty, p.difficulty === 'Cơ bản' ? 'green' : 'orange')} ${p.topic}</small></label><button class="btn link small" data-action="preview-problem" data-id="${p.id}">Xem đề</button></div>`).join('') || '<p class="muted">Không có đề phù hợp.</p>'}<p class="muted" style="font-size:12px;margin:17px 0 0">Chọn ít nhất 1 đề. Một đồng hồ chung cho toàn bộ cuộc thi.</p></section></div><aside class="panel summary"><h2>Bộ đề của phòng</h2><p class="muted" style="font-size:12px">Thứ tự dưới đây cũng là thứ tự hiển thị cho người thi.</p>${selected.map((p, i) => `<div class="selected-problem"><span class="letter">${String.fromCharCode(65 + i)}</span><strong>${p.title}</strong><button class="tiny" data-action="move-up" data-id="${p.id}" aria-label="Đưa ${p.title} lên" ${i === 0 ? 'disabled' : ''}>↑</button><button class="tiny" data-action="move-down" data-id="${p.id}" aria-label="Đưa ${p.title} xuống" ${i === selected.length - 1 ? 'disabled' : ''}>↓</button><button class="tiny" data-action="remove-problem" data-id="${p.id}" aria-label="Bỏ ${p.title}">×</button></div>`).join('') || '<p class="muted">Chưa chọn đề nào.</p>'}<dl><dt>Ngôn ngữ</dt><dd>C++17</dd><dt>Điểm mỗi đề</dt><dd>100 điểm</dd><dt>Thời lượng</dt><dd id="summary-duration">${state.duration} phút</dd><dt>Số người tối đa</dt><dd id="summary-capacity">${state.maxPlayers} người</dd></dl><hr class="divider"><div class="total"><span>Tổng điểm tối đa</span><b>${selected.length * 100}</b></div><button class="btn red wide" data-action="create-room">${icon('plus')} Tạo phòng</button><div class="form-error" id="create-error" role="alert"></div><div class="note">Đề chỉ hiển thị cho người thi khi cuộc thi bắt đầu. Bạn có thể xem trước đề trong lúc chuẩn bị.</div></aside></div>`
  );
}
function roomHeading() {
  return `<div class="room-heading"><div>${badge(state.visibility === 'private' ? `${icon('lock')} Riêng tư` : `${icon('globe')} Công khai`)} <span class="tag green"><span class="dot"></span>Đang chờ</span><h1>${escapeHTML(state.title)}</h1><p>Người tổ chức: ${escapeHTML(state.ownerName)}</p></div><div class="code-box"><div><small>MÃ PHÒNG</small><b>686826</b></div><button class="btn link" data-action="copy-code" aria-label="Sao chép mã phòng">${icon('copy')}</button></div></div>`;
}
function waiting() {
  const host = state.lobbyRole === 'host';
  const count = state.created ? 0 : Math.min(state.demoCount, state.maxPlayers);
  const list = people.slice(0, count);
  return layout(
    `<div class="breadcrumbs"><a href="#discover">Thi đấu lập trình</a><span>/</span>Phòng chờ</div>${roomHeading()}<div class="row between wrap" style="margin-bottom:20px"><p class="muted" style="margin:0;font-size:12px">${host ? 'Bạn đang quản lý phòng với vai trò người tổ chức.' : 'Bạn đã tham gia với vai trò người thi.'}</p><button class="btn small" data-action="switch-role">Xem vai trò ${host ? 'người thi' : 'người tổ chức'}</button></div><div class="lobby-cols"><section class="panel"><div class="row between"><h2>Người tham gia</h2>${badge(`${count}/${state.maxPlayers} người thi`)}</div><div class="organizer">${avatar('TD', 'rose')}<div><strong>${escapeHTML(state.ownerName)}</strong><small>Người tổ chức · Không tham gia thi đấu</small></div>${badge('Chủ phòng', 'red')}</div><div class="people">${list.map(([name, initials, tone]) => `<div class="person">${avatar(initials, tone)}<div><strong>${name}</strong><small>Đã vào phòng</small></div><span class="status-dot"></span>${host ? `<button class="tiny" data-action="remove-player" data-name="${name}" aria-label="Mời ${name} rời phòng">×</button>` : ''}</div>`).join('')}${Array.from({ length: Math.min(4, state.maxPlayers - count) }, () => `<div class="person empty">${icon('users')} Chỗ còn trống</div>`).join('')}</div>${state.created ? '<button class="btn soft wide" style="margin-top:18px" data-action="add-demo-players">Thêm người thi minh họa</button>' : ''}<div class="note" style="margin-top:20px">${state.visibility === 'public' ? 'Phòng đang hiển thị trong danh sách công khai. Những người khác có thể vào khi còn chỗ.' : 'Phòng không hiển thị trong danh sách công khai. Gửi mã 686826 cho những người bạn muốn mời.'}</div></section><aside class="panel"><h2>Thông tin cuộc thi</h2><dl class="details"><dt>Số đề</dt><dd>${state.selected.length} đề</dd><dt>Thời lượng</dt><dd>${state.duration} phút</dd><dt>Ngôn ngữ</dt><dd>C++17</dd><dt>Tổng điểm tối đa</dt><dd>${state.selected.length * 100} điểm</dd></dl><hr class="divider">${
      host
        ? `<h3>Bộ đề đã chọn</h3>${selectedProblems()
            .map(
              (p, i) =>
                `<div class="compact-problem"><span class="letter">${String.fromCharCode(65 + i)}</span><div><strong>${p.title}</strong><small>${p.difficulty} · 100 điểm</small></div></div>`
            )
            .join(
              ''
            )}<div class="note">Chỉ bạn thấy bộ đề lúc này. Người thi nhận đề khi bạn bắt đầu cuộc thi.</div><button class="btn red wide" style="margin-top:20px" data-action="start-contest" ${count < 2 ? 'disabled' : ''}>${icon('play')} Bắt đầu cuộc thi</button><p class="muted" style="text-align:center;font-size:11px;margin:10px 0 0">Cần ít nhất 2 người thi để bắt đầu.</p>`
        : `<div class="note">${icon('lock')} Bộ đề sẽ được mở đồng thời cho tất cả khi người tổ chức bắt đầu.</div><div class="wait-banner">${icon('clock')} Đang chờ người tổ chức bắt đầu...</div><button class="btn wide" style="margin-top:20px" data-action="leave-lobby">Rời phòng</button>`
    }</aside></div>`
  );
}
function standings(final = false) {
  const n = state.selected.length;
  const values = final
    ? [
        [100, 100, 100, 75, 50],
        [100, 100, 50, 50, 25],
        [100, 50, 50, 25, 0],
        [100, 50, 25, 0, 0],
        [50, 25, 0, 0, 0],
        [25, 0, 0, 0, 0],
      ]
    : [
        [100, 100, 50, 0, 0],
        [100, 50, 0, 0, 0],
        [100, 25, 0, 0, 0],
        [50, 0, 0, 0, 0],
        [25, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ];
  return `<div class="table-wrap"><table><thead><tr><th>Hạng</th><th>Người thi</th>${selectedProblems()
    .map(
      (p, i) =>
        `<th title="${p.title}">Đề ${String.fromCharCode(65 + i)}<br><small>/ 100</small></th>`
    )
    .join('')}<th>Tổng / ${n * 100}</th><th>Đạt điểm lúc</th></tr></thead><tbody>${people
    .slice(0, Math.min(state.demoCount, state.maxPlayers))
    .map(([name, initials, tone], i) => {
      const scores = values[i].slice(0, n);
      return `<tr ${final && i === 1 ? 'class="you"' : ''}><td>${i === 0 ? '<span style="color:#b68e4d">#1</span>' : '#' + (i + 1)}</td><td><span class="table-name">${avatar(initials, tone)}<strong>${name}</strong></span></td>${scores.map((s) => `<td class="score ${s === 100 ? '' : s ? 'partial' : 'none'}">${s === 100 ? '100 ✓' : s || '—'}</td>`).join('')}<td class="score-total">${scores.reduce((a, b) => a + b, 0)}</td><td class="muted">${['18:42', '20:15', '22:30', '23:08', '24:10', '—'][i]}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;
}
function host() {
  return layout(
    `<div class="breadcrumbs"><a href="#discover">Thi đấu lập trình</a><span>/</span>Quản lý cuộc thi</div><div class="page-title"><div><div class="eyebrow">GÓC NHÌN NGƯỜI TỔ CHỨC</div><h1>${escapeHTML(state.title)}</h1><p>Phòng 686826 · Bạn điều hành cuộc thi và không có tên trong bảng xếp hạng.</p></div><button class="btn outline" data-action="end-contest">Kết thúc sớm</button></div><div class="stats"><div class="panel stat"><small>Thời gian còn lại</small><b style="color:var(--red)">24:36</b><div class="sub">Tổng thời lượng ${state.duration} phút</div></div><div class="panel stat"><small>Người đang thi</small><b>${Math.min(state.demoCount, state.maxPlayers)} <span style="font-size:16px;color:#959daa">/ ${state.maxPlayers}</span></b><div class="sub">Bạn là người tổ chức</div></div><div class="panel stat"><small>Bài đã nộp</small><b>24</b><div class="sub">2 bài đang chấm</div></div><div class="panel stat"><small>Bộ đề</small><b>${state.selected.length} <span style="font-size:16px;color:#959daa">đề</span></b><div class="sub">${state.selected.length * 100} điểm tối đa</div></div></div><div class="host-grid"><section class="panel"><div class="row between"><h2>Bảng điểm trực tiếp</h2>${badge('<span class="dot"></span>Đang thi', 'green')}</div>${standings()}<div class="section-footer"><small>Ưu tiên tổng điểm; bằng điểm xét thời điểm đạt tổng điểm đó.</small><span class="tag">Người tổ chức không được xếp hạng</span></div></section><aside class="stack"><section class="panel"><h2>Bộ đề cuộc thi</h2>${selectedProblems()
      .map(
        (p, i) =>
          `<div class="compact-problem"><span class="letter">${String.fromCharCode(65 + i)}</span><div style="flex:1"><strong>${p.title}</strong><small>100 điểm · ${p.difficulty}</small></div><button class="btn link small" data-action="preview-problem" data-id="${p.id}">Xem</button></div>`
      )
      .join(
        ''
      )}</section><section class="panel"><h2>Hoạt động gần đây</h2><div class="activity"><span></span><div><p><b>Minh Anh</b> đạt 100 điểm đề B.</p><small>Vừa xong · 18:42</small></div></div><div class="activity"><span style="background:#c29650"></span><div><p><b>Thanh Bình</b> đang chấm đề B.</p><small>30 giây trước</small></div></div><div class="activity"><span></span><div><p><b>Ngọc Mai</b> nộp bài đề A.</p><small>1 phút trước</small></div></div><div class="note">Bạn theo dõi điểm và trạng thái bài nộp. Code của người thi được giữ riêng.</div></section></aside></div>`
  );
}
function contest() {
  const list = selectedProblems();
  const index = Math.min(state.participantIndex, list.length - 1);
  state.participantIndex = index;
  const p = list[index];
  if (!p) return layout('<div class="panel">Hãy chọn ít nhất một đề ở trang tạo phòng.</div>');
  const letter = String.fromCharCode(65 + index);
  const attempts = state.attempts[p.id] || [];
  const best = attempts.some((a) => a.type === 'submit') ? 100 : 0;
  const total =
    Object.values(state.attempts).filter((a) => a.some((s) => s.type === 'submit')).length * 100;
  return `<main class="focus"><div class="focus-heading"><div><a href="#discover" class="muted" style="font-size:12px">← Thi đấu lập trình</a><h1 style="margin:10px 0 7px">${escapeHTML(state.title)}</h1><small>Phòng 686826 · Thanh Bình · ${list.length} đề · Một đồng hồ chung</small></div><div class="row"><div class="timer">${icon('clock')}<div><small>THỜI GIAN CÒN LẠI</small>24:36</div></div><button class="btn" data-action="leave-contest">Rời cuộc thi</button></div></div><div class="arena"><aside class="panel problem-sidebar"><h2>Đề bài</h2><div class="problem-nav">${list
    .map((item, i) => {
      const solved = (state.attempts[item.id] || []).some((a) => a.type === 'submit');
      return `<button class="problem-tab ${i === index ? 'active' : ''}" data-action="select-problem" data-index="${i}"><span class="letter">${String.fromCharCode(65 + i)}</span><span><strong>${item.title}</strong><small>${solved ? '✓ 100 / 100 điểm' : 'Chưa nộp · 100 điểm'}</small></span></button>`;
    })
    .join(
      ''
    )}</div><hr class="divider"><div class="side-score"><div class="row between"><small>Tổng điểm của bạn</small><strong>${total}/${list.length * 100}</strong></div><div class="progress"><span style="width:${(total / (list.length * 100)) * 100}%"></span></div><p class="muted" style="font-size:11px;margin:14px 0 0">Mỗi đề giữ kết quả tốt nhất. Chuyển đề vẫn giữ bản nháp.</p><a href="#results" class="btn link small" style="padding-left:0;margin-top:10px">${icon('trophy')} Xem bảng điểm minh họa</a></div></aside><section class="panel problem-detail"><div class="row between">${badge('Đề ' + letter, 'red')}${badge(p.difficulty, p.difficulty === 'Cơ bản' ? 'green' : 'orange')}</div><h2>${p.title}</h2><div class="limits">100 điểm · C++17 · 2 giây · 256 MB</div><p style="margin-top:17px">${p.text}</p><h3>Dữ liệu vào</h3><p>${p.input}</p><h3>Dữ liệu ra</h3><p>${p.output}</p><h3>Ràng buộc</h3><p>${p.constraints}</p><h3>Ví dụ</h3><small>Input</small><pre class="example">${escapeHTML(p.example)}</pre><small>Output</small><pre class="example">${p.answer}</pre></section><section class="panel editor-panel"><div class="editor-top"><strong>${icon('code')} Lời giải · Đề ${letter}</strong><span class="tag">C++17</span><small>Bản nháp riêng từng đề</small></div><div class="editor-body"><div class="line-numbers">1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12</div><label class="a11y-label" for="code-editor">Code cho ${p.title}</label><textarea id="code-editor" class="code-editor" spellcheck="false">${escapeHTML(state.drafts[p.id] ?? starter)}</textarea></div><div class="editor-actions"><span class="muted" style="font-size:11px;margin-right:auto">Điểm tốt nhất: ${best}/100</span><button class="btn" data-action="run-code">${icon('play')} Chạy thử</button><button class="btn red" data-action="submit-code">${icon('send')} Nộp bài</button></div><div class="console-tabs"><button class="${state.consoleTab === 'run' ? 'on' : ''}" data-action="console-tab" data-tab="run">Kết quả chạy thử</button><button class="${state.consoleTab === 'history' ? 'on' : ''}" data-action="console-tab" data-tab="history">Lịch sử nộp đề ${letter}</button></div><div class="console-content">${
    state.consoleTab === 'history'
      ? attempts
          .filter((a) => a.type === 'submit')
          .map(
            (a, i) =>
              `<div class="history-row"><small>Lần ${attempts.filter((a) => a.type === 'submit').length - i}</small><span class="score">100/100 điểm</span><span class="muted">${a.time}</span></div>`
          )
          .join('') || '<p class="muted">Bạn chưa nộp bài cho đề này.</p>'
      : attempts.some((a) => a.type === 'run')
        ? `<div class="verdict"><strong>Ví dụ 1 · Đúng</strong><p style="margin:8px 0 0">Output: <code>${p.answer}</code></p></div><small style="display:block;margin-top:10px">Kết quả minh họa cho bản nháp, chưa thực thi code.</small>`
        : '<p class="muted">Chạy thử với ví dụ của đề trước khi nộp bài.</p><div class="note">Chạy thử không tính điểm. Nộp bài để chấm các test ẩn.</div>'
  }</div></section></div></main>`;
}
function results() {
  return layout(
    `<div class="breadcrumbs"><a href="#discover">Thi đấu lập trình</a><span>/</span>Kết quả</div><div class="results-hero">${icon('trophy')}<h1>Cuộc thi đã kết thúc</h1><p>${escapeHTML(state.title)} · ${state.selected.length} đề · ${state.duration} phút · ${Math.min(state.demoCount, state.maxPlayers)} người thi</p>${badge(state.ended ? 'Người tổ chức kết thúc sớm' : 'Đã chốt bảng điểm')}</div><div class="podium"><div class="panel"><div class="medal">HẠNG 02</div>${avatar('TB', 'blue')}<strong>Thanh Bình</strong><b>${[100, 100, 50, 50, 25].slice(0, state.selected.length).reduce((a, b) => a + b, 0)}</b><small>điểm</small></div><div class="panel winner"><div class="medal">${icon('trophy')} HẠNG 01</div>${avatar('MA', 'rose')}<strong>Minh Anh</strong><b>${[100, 100, 100, 75, 50].slice(0, state.selected.length).reduce((a, b) => a + b, 0)}</b><small>điểm</small></div><div class="panel"><div class="medal">HẠNG 03</div>${avatar('NM', 'green')}<strong>Ngọc Mai</strong><b>${[100, 50, 50, 25, 0].slice(0, state.selected.length).reduce((a, b) => a + b, 0)}</b><small>điểm</small></div></div><div class="results-cols"><section class="panel"><div class="row between"><h2>Bảng điểm cuối cùng</h2>${badge(Math.min(state.demoCount, state.maxPlayers) + ' người thi')}</div>${standings(true)}<p class="muted" style="font-size:11px;margin:17px 0 0">Điểm từng đề = tỷ lệ test đúng × 100. Tổng điểm bằng nhau xét thời điểm đạt tổng điểm đó. Người tổ chức không được xếp hạng.</p></section><aside class="panel"><h2>Bài làm của Thanh Bình</h2><p class="muted" style="font-size:12px">Góc nhìn người thi · Chỉ xem code của chính mình.</p>${selectedProblems()
      .map(
        (p, i) =>
          `<div class="compact-problem"><span class="letter">${String.fromCharCode(65 + i)}</span><div style="flex:1"><strong>${p.title}</strong><small>${[100, 100, 50, 50, 25][i]}/100 điểm</small></div><button class="btn link small" data-action="view-own-code" data-id="${p.id}">Code</button></div>`
      )
      .join(
        ''
      )}<hr class="divider"><div class="note">Người tổ chức xem bảng điểm và kết quả chấm, không có bài làm cá nhân.</div></aside></div><div class="section-footer"><a href="#discover" class="btn">← Danh sách phòng</a><button class="btn red" data-action="replay">${icon('copy')} Tạo cuộc thi mới từ bộ đề này</button></div><div class="review-end">Bản nháp giao diện · Tên người dùng, thời gian và điểm đều là dữ liệu minh họa.</div>`
  );
}
function render() {
  const view = screens.some(([id]) => id === route()) ? route() : 'discover';
  document.querySelector('.preview-nav').innerHTML = screens
    .map(
      ([id, name], i) =>
        `<a href="#${id}" class="${id === view ? 'current' : ''}" ${id === view ? 'aria-current="page"' : ''}>${i + 1}. ${name}</a>`
    )
    .join('');
  const pages = { discover, create, waiting, host, contest, results };
  app.innerHTML = pages[view]();
  document.title = `${screens.find(([id]) => id === view)[1]} · Bản nháp PTITSocial`;
}
function preserveCreate() {
  if (route() !== 'create') return;
  const title = document.querySelector('#room-title');
  if (title) {
    state.title = title.value;
    state.maxPlayers = Number(document.querySelector('#max-players').value);
    state.duration = Number(document.querySelector('#duration').value);
  }
}
function preserveCode() {
  const editor = document.querySelector('#code-editor');
  if (editor) {
    const p = selectedProblems()[state.participantIndex];
    if (p) state.drafts[p.id] = editor.value;
  }
}
function dialog(title, content, confirmLabel, confirm) {
  document.querySelector('dialog')?.remove();
  const d = document.createElement('dialog');
  d.innerHTML = `<h2>${title}</h2>${content}<div class="dialog-actions"><button class="btn" data-close>Đóng</button>${confirmLabel ? `<button class="btn red" data-confirm>${confirmLabel}</button>` : ''}</div>`;
  document.body.append(d);
  d.querySelector('[data-close]').onclick = () => d.close();
  if (confirm)
    d.querySelector('[data-confirm]').onclick = () => {
      d.close();
      confirm();
    };
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  d.showModal();
}
app.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  preserveCreate();
  preserveCode();
  if (action === 'library-tab') {
    event.preventDefault();
    state.libraryTab = el.dataset.tab;
    state.roomFilter = 'all';
    state.roomSearch = '';
    render();
  }
  if (action === 'my-rooms') {
    event.preventDefault();
    state.libraryTab = 'mine';
    go('discover');
  }
  if (action === 'join-public' || action === 'manage-room') {
    const room = JSON.parse(el.dataset.room);
    state.title = room.title;
    state.maxPlayers = room.max;
    state.duration = room.minutes;
    state.visibility = room.private ? 'private' : 'public';
    state.ownerName = room.owner === 'Bạn' ? 'Truong Le Duy' : room.owner;
    state.selected = room.problemIds || problems.slice(0, room.problems).map((p) => p.id);
    state.demoCount = Math.min(room.max, room.count + (action === 'join-public' ? 1 : 0));
    state.participantIndex = 0;
  }
  if (action === 'join-public') {
    state.lobbyRole = 'participant';
    state.created = false;
    go('waiting');
    toast('Đã vào phòng minh họa với vai trò người thi.');
  }
  if (action === 'manage-room') {
    state.lobbyRole = 'host';
    state.created = false;
    go(el.dataset.view);
  }
  if (action === 'go-results') go('results');
  if (action === 'preview-problem') {
    const p = problems.find((p) => p.id === Number(el.dataset.id));
    dialog(
      p.title,
      `<p>${p.text}</p><h3>Dữ liệu vào</h3><p>${p.input}</p><h3>Dữ liệu ra</h3><p>${p.output}</p><h3>Ví dụ</h3><pre class="example">${escapeHTML(p.example)}\n→ ${p.answer}</pre>`
    );
  }
  if (['move-up', 'move-down', 'remove-problem'].includes(action)) {
    const id = Number(el.dataset.id),
      i = state.selected.indexOf(id);
    if (action === 'remove-problem') state.selected.splice(i, 1);
    else {
      const next = i + (action === 'move-up' ? -1 : 1);
      [state.selected[i], state.selected[next]] = [state.selected[next], state.selected[i]];
    }
    render();
  }
  if (action === 'create-room') {
    let error = '';
    if (!state.title.trim()) error = 'Bạn cần nhập tên phòng.';
    else if (!Number.isInteger(state.maxPlayers) || state.maxPlayers < 2 || state.maxPlayers > 30)
      error = 'Số người thi cần từ 2 đến 30.';
    else if (!Number.isInteger(state.duration) || state.duration < 5 || state.duration > 180)
      error = 'Thời lượng cần từ 5 đến 180 phút.';
    else if (!state.selected.length) error = 'Bạn cần chọn ít nhất một đề.';
    if (error) {
      document.querySelector('#create-error').textContent = error;
      return;
    }
    state.created = true;
    state.createdRoom = {
      title: state.title,
      maxPlayers: state.maxPlayers,
      duration: state.duration,
      selected: [...state.selected],
      visibility: state.visibility,
    };
    state.ownerName = 'Truong Le Duy';
    state.demoCount = Math.min(6, state.maxPlayers);
    state.lobbyRole = 'host';
    state.participantIndex = 0;
    go('waiting');
    toast('Đã tạo phòng minh họa. Bạn là người tổ chức.');
  }
  if (action === 'switch-role') {
    state.lobbyRole = state.lobbyRole === 'host' ? 'participant' : 'host';
    render();
  }
  if (action === 'copy-code') {
    navigator.clipboard
      ?.writeText('686826')
      .then(() => toast('Đã sao chép mã phòng 686826.'))
      .catch(() => toast('Mã phòng: 686826'));
  }
  if (action === 'add-demo-players') {
    state.created = false;
    render();
  }
  if (action === 'remove-player') toast(`Minh họa thao tác mời ${el.dataset.name} rời phòng.`);
  if (action === 'start-contest') {
    go('host');
    toast('Đã chuyển sang màn hình điều hành cuộc thi minh họa.');
  }
  if (action === 'leave-lobby')
    dialog(
      'Rời phòng?',
      `<p>Bạn sẽ rời phòng chờ. Nếu phòng vẫn đang chờ và còn chỗ, bạn có thể vào lại.</p>`,
      'Rời phòng',
      () => go('discover')
    );
  if (action === 'end-contest')
    dialog(
      'Kết thúc cuộc thi sớm?',
      `<p>Người thi sẽ không thể nộp thêm bài. Các bài đã được nhận vẫn được chấm trước khi chốt bảng điểm.</p>`,
      'Kết thúc cuộc thi',
      () => {
        state.ended = true;
        go('results');
      }
    );
  if (action === 'leave-contest')
    dialog(
      'Rời cuộc thi?',
      `<p>Điểm đã có vẫn được giữ. Bạn sẽ không thể tiếp tục nộp bài trong lượt thi này.</p>`,
      'Rời cuộc thi',
      () => go('results')
    );
  if (action === 'select-problem') {
    state.participantIndex = Number(el.dataset.index);
    state.consoleTab = 'run';
    render();
  }
  if (action === 'console-tab') {
    state.consoleTab = el.dataset.tab;
    render();
  }
  if (action === 'run-code' || action === 'submit-code') {
    const p = selectedProblems()[state.participantIndex];
    if (!(state.drafts[p.id] || '').trim()) {
      toast('Hãy nhập code trước.');
      return;
    }
    (state.attempts[p.id] ??= []).unshift({
      type: action === 'run-code' ? 'run' : 'submit',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    });
    state.consoleTab = action === 'run-code' ? 'run' : 'history';
    render();
    toast('Kết quả minh họa — bản nháp chưa chạy hay chấm code thật.');
  }
  if (action === 'view-own-code') {
    const p = problems.find((p) => p.id === Number(el.dataset.id));
    dialog(
      'Code của bạn · ' + p.title,
      `<p class="muted">Bài làm minh họa, chỉ người nộp có thể xem.</p><pre class="example">${escapeHTML(state.drafts[p.id] ?? starter)}</pre>`
    );
  }
  if (action === 'replay') {
    state.created = false;
    go('create');
    toast('Bộ đề và cài đặt được giữ để bạn tạo phòng mới.');
  }
});
app.addEventListener('change', (event) => {
  const el = event.target;
  preserveCreate();
  if (el.dataset.problem) {
    const id = Number(el.dataset.problem);
    if (el.checked) state.selected.push(id);
    else state.selected = state.selected.filter((item) => item !== id);
    render();
  }
  if (el.name === 'visibility') {
    state.visibility = el.value;
    render();
  }
  if (el.id === 'difficulty') {
    state.difficulty = el.value;
    render();
  }
  if (el.id === 'room-filter') {
    state.roomFilter = el.value;
    render();
  }
});
app.addEventListener('input', (event) => {
  const el = event.target;
  if (el.id === 'code-editor') {
    preserveCode();
    return;
  }
  if (el.id === 'room-title') state.title = el.value;
  if (el.id === 'duration') {
    state.duration = Number(el.value);
    document.querySelector('#summary-duration').textContent = el.value + ' phút';
  }
  if (el.id === 'max-players') {
    state.maxPlayers = Number(el.value);
    document.querySelector('#summary-capacity').textContent = el.value + ' người';
  }
  if (el.id === 'problem-search' || el.id === 'room-search') {
    preserveCreate();
    const pos = el.selectionStart,
      key = el.id === 'problem-search' ? 'problemSearch' : 'roomSearch';
    state[key] = el.value;
    const id = el.id;
    render();
    const replacement = document.getElementById(id);
    replacement.focus();
    replacement.setSelectionRange(pos, pos);
  }
});
app.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'join-form') {
    const code = document.querySelector('#join-code').value;
    if (code !== '686826') {
      toast('Bản nháp: dùng mã mẫu 686826 để xem phòng chờ.');
      return;
    }
    state.lobbyRole = 'participant';
    state.created = false;
    go('waiting');
  }
});
window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});
render();
