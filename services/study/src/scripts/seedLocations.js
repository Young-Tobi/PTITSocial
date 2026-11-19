require('dotenv').config();
const mongoose = require('mongoose');
const Location = require('../models/studyLocationModel');

const samples = [
  {
    name: 'Thư viện học tập mẫu',
    address: 'Dữ liệu minh họa — khu vực Hà Đông, Hà Nội',
    coordinates: { type: 'Point', coordinates: [105.7874, 20.9806] },
    description: 'Địa điểm mẫu phục vụ demo. Thông tin chưa được xác minh ngoài thực tế.',
    type: 'library',
    quietLevel: 5,
    wifi: true,
    powerOutlets: true,
    suitableFor: ['individual', 'group'],
    isSample: true,
    verified: false,
  },
  {
    name: 'Không gian tự học mẫu',
    address: 'Dữ liệu minh họa — khu vực Thanh Xuân, Hà Nội',
    coordinates: { type: 'Point', coordinates: [105.8019, 21.0033] },
    description: 'Không gian tự học mẫu với bàn cá nhân và ổ cắm. Chưa được xác minh.',
    type: 'self-study',
    quietLevel: 4,
    wifi: true,
    powerOutlets: true,
    suitableFor: ['individual'],
    isSample: true,
    verified: false,
  },
  {
    name: 'Cà phê học nhóm mẫu',
    address: 'Dữ liệu minh họa — khu vực Cầu Giấy, Hà Nội',
    coordinates: { type: 'Point', coordinates: [105.7906, 21.0365] },
    description: 'Quán cà phê giả lập để kiểm thử bộ lọc và Meetup. Chưa được xác minh.',
    type: 'cafe',
    quietLevel: 3,
    wifi: true,
    powerOutlets: false,
    suitableFor: ['group'],
    isSample: true,
    verified: false,
  },
  {
    name: 'Phòng học nhóm mẫu',
    address: 'Dữ liệu minh họa — khu vực Hai Bà Trưng, Hà Nội',
    coordinates: { type: 'Point', coordinates: [105.8471, 21.0068] },
    description: 'Phòng học nhóm minh họa, không phải dữ liệu sức chứa thời gian thực.',
    type: 'group-space',
    quietLevel: 4,
    wifi: false,
    powerOutlets: true,
    suitableFor: ['group'],
    isSample: true,
    verified: false,
  },
  {
    name: 'Thư viện Quốc gia Việt Nam',
    address: '31 Tràng Thi, Hoàn Kiếm, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.8491, 21.0251] },
    description: 'Không gian đọc và tra cứu. Hãy kiểm tra giờ mở cửa và điều kiện sử dụng trước khi đến.',
    type: 'library', quietLevel: 5, wifi: true, powerOutlets: true,
    suitableFor: ['individual'], isSample: true, verified: false,
  },
  {
    name: 'Thư viện Hà Nội',
    address: '47 Bà Triệu, Hoàn Kiếm, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.8497, 21.0193] },
    description: 'Điểm đọc sách công cộng ở khu vực trung tâm. Thông tin tiện ích cần được xác minh.',
    type: 'library', quietLevel: 5, wifi: true, powerOutlets: false,
    suitableFor: ['individual'], isSample: true, verified: false,
  },
  {
    name: 'Thư viện Tạ Quang Bửu',
    address: 'Đại học Bách khoa Hà Nội, Hai Bà Trưng · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.8432, 21.0058] },
    description: 'Không gian học thuật tại khuôn viên đại học; cần kiểm tra quyền vào thư viện.',
    type: 'library', quietLevel: 5, wifi: true, powerOutlets: true,
    suitableFor: ['individual', 'group'], isSample: true, verified: false,
  },
  {
    name: 'Khu tự học Đại học Kinh tế Quốc dân',
    address: '207 Giải Phóng, Hai Bà Trưng, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.8426, 20.9991] },
    description: 'Điểm học trong khuôn viên trường, phù hợp học cá nhân và trao đổi nhóm.',
    type: 'self-study', quietLevel: 4, wifi: true, powerOutlets: true,
    suitableFor: ['individual', 'group'], isSample: true, verified: false,
  },
  {
    name: 'Khu tự học Đại học Thủy Lợi',
    address: '175 Tây Sơn, Đống Đa, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.8244, 21.0072] },
    description: 'Khu vực học tập trong khuôn viên; cần xác minh quyền tiếp cận đối với khách ngoài trường.',
    type: 'self-study', quietLevel: 4, wifi: true, powerOutlets: true,
    suitableFor: ['individual'], isSample: true, verified: false,
  },
  {
    name: 'Khu học tập Đại học Ngoại thương',
    address: '91 Chùa Láng, Đống Đa, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.8054, 21.0235] },
    description: 'Không gian học trong khuôn viên đại học, vị trí tham khảo cho chức năng Meetup.',
    type: 'self-study', quietLevel: 4, wifi: true, powerOutlets: true,
    suitableFor: ['individual', 'group'], isSample: true, verified: false,
  },
  {
    name: 'Trung tâm học liệu ĐHQGHN',
    address: '144 Xuân Thủy, Cầu Giấy, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.7829, 21.0374] },
    description: 'Không gian học liệu trong khuôn viên; vui lòng kiểm tra điều kiện sử dụng.',
    type: 'library', quietLevel: 5, wifi: true, powerOutlets: true,
    suitableFor: ['individual', 'group'], isSample: true, verified: false,
  },
  {
    name: 'Khu tự học Đại học Sư phạm Hà Nội',
    address: '136 Xuân Thủy, Cầu Giấy, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.7835, 21.0379] },
    description: 'Điểm học tập trong trường, thuận tiện cho sinh viên khu vực Cầu Giấy.',
    type: 'self-study', quietLevel: 4, wifi: true, powerOutlets: true,
    suitableFor: ['individual'], isSample: true, verified: false,
  },
  {
    name: 'Không gian học PTIT Hà Đông',
    address: 'Km 10 Nguyễn Trãi, Hà Đông, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.7875, 20.9808] },
    description: 'Điểm học tại khuôn viên Học viện Công nghệ Bưu chính Viễn thông.',
    type: 'self-study', quietLevel: 4, wifi: true, powerOutlets: true,
    suitableFor: ['individual', 'group'], isSample: true, verified: false,
  },
  {
    name: 'Khu tự học Đại học Hà Nội',
    address: 'Km 9 Nguyễn Trãi, Nam Từ Liêm, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.7959, 20.9888] },
    description: 'Không gian học trong khuôn viên trường, vị trí và tiện ích mang tính tham khảo.',
    type: 'self-study', quietLevel: 4, wifi: true, powerOutlets: true,
    suitableFor: ['individual', 'group'], isSample: true, verified: false,
  },
  {
    name: 'Không gian học Đại học Kiến trúc Hà Nội',
    address: 'Nguyễn Trãi, Hà Đông, Hà Nội · dữ liệu tham khảo',
    coordinates: { type: 'Point', coordinates: [105.7954, 20.9814] },
    description: 'Điểm học tập tham khảo gần trục Nguyễn Trãi, cần kiểm tra quyền vào trường.',
    type: 'group-space', quietLevel: 3, wifi: true, powerOutlets: true,
    suitableFor: ['group'], isSample: true, verified: false,
  },
  {
    name: 'Phòng đọc khu đô thị Mỹ Đình',
    address: 'Khu vực Mỹ Đình, Nam Từ Liêm, Hà Nội · dữ liệu minh họa',
    coordinates: { type: 'Point', coordinates: [105.7734, 21.0288] },
    description: 'Điểm học minh họa giúp kiểm thử tìm kiếm quanh khu vực phía tây Hà Nội.',
    type: 'library', quietLevel: 4, wifi: true, powerOutlets: true,
    suitableFor: ['individual'], isSample: true, verified: false,
  },
  {
    name: 'Cà phê học bài Hồ Tây',
    address: 'Khu vực Quảng An, Tây Hồ, Hà Nội · dữ liệu minh họa',
    coordinates: { type: 'Point', coordinates: [105.8248, 21.0676] },
    description: 'Địa điểm minh họa cho học cá nhân và gặp nhóm ở khu vực Hồ Tây.',
    type: 'cafe', quietLevel: 3, wifi: true, powerOutlets: true,
    suitableFor: ['individual', 'group'], isSample: true, verified: false,
  },
  {
    name: 'Không gian học Long Biên',
    address: 'Khu vực Ngọc Lâm, Long Biên, Hà Nội · dữ liệu minh họa',
    coordinates: { type: 'Point', coordinates: [105.8765, 21.0442] },
    description: 'Điểm học minh họa giúp Meetup trả kết quả ở phía đông thành phố.',
    type: 'self-study', quietLevel: 4, wifi: true, powerOutlets: true,
    suitableFor: ['individual', 'group'], isSample: true, verified: false,
  },
];

async function seed() {
  await mongoose.connect(process.env.DATABASE);
  for (const item of samples)
    await Location.updateOne({ name: item.name, isSample: true }, { $set: item }, { upsert: true });
  console.log(`Seeded ${samples.length} clearly marked sample study locations.`);
  await mongoose.disconnect();
}
seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
