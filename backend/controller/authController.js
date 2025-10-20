import bcrypt from 'bcrypt';
import User from '../model/User.js'; // Import model User

// 🔹 TODO: Hãy tạo thư mục 'Server/public/avatars/'
// và đặt các ảnh (avatar_1.png, avatar_2.png, ...) vào đó.
const AVATAR_LIST = [
  'avatar_1.png',
  'avatar_2.png',
  'avatar_3.png',
  'avatar_4.png',
  'avatar_5.png',
  'avatar_6.png',
  'avatar_7.png',
  'avatar_8.png',
];

const SALT_ROUNDS = 10;

/**
 * @desc Đăng ký tài khoản mới
 * @route POST /api/auth/register
 * @access Public
 */
export const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    // --- Validation cơ bản ---
    if (!username || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp username và password.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password phải có ít nhất 6 ký tự.' });
    }
    if (username.length < 3) {
      return res.status(400).json({ message: 'Username phải có ít nhất 3 ký tự.' });
    }

    // --- Kiểm tra Username tồn tại ---
    // (Sử dụng phương thức static `findByName` bạn đã tạo)
    const existingUser = await User.findByName(username);
    if (existingUser) {
      return res.status(409).json({ message: 'Username này đã tồn tại.' }); // 409 Conflict
    }

    // --- Băm mật khẩu ---
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // --- Chọn avatar ngẫu nhiên ---
    const randomIndex = Math.floor(Math.random() * AVATAR_LIST.length);
    const randomAvatar = AVATAR_LIST[randomIndex];

    // --- Tạo User mới bằng Model ---
    const newUser = new User({
      username: username,
      password: hashedPassword,
      avatar_url: randomAvatar,
      elo: 1000, // Giá trị mặc định từ schema
      balance: 0  // Giá trị mặc định từ schema
    });

    // --- Lưu vào Database ---
    // (Sử dụng phương thức `save` của instance)
    const savedUser = await newUser.save();

    // --- Trả về kết quả (không trả về password) ---
    res.status(201).json({ // 201 Created
      message: 'Đăng ký thành công!',
      user: savedUser.toJSON(), // Sử dụng toJSON đã sửa
    });

  } catch (error) {
    console.error('Lỗi khi đăng ký:', error);
    // Xử lý lỗi từ class User (vd: validate)
    if (error.message.includes('User name must be at least 3 characters long')) {
       return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // --- Validation cơ bản ---
    if (!username || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp username và password.' });
    }

    // --- Tìm user trong DB ---
    const existingUser = await User.findByName(username);
    if (!existingUser) {
      return res.status(401).json({ message: 'Tên đăng nhập không tồn tại.' }); // 401 Unauthorized
    }

    // --- So sánh mật khẩu ---
    // (Lưu ý: existingUser.password là mật khẩu đã băm trong DB)
    const isMatch = await bcrypt.compare(password, existingUser.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu không chính xác.' }); // 401 Unauthorized
    }

    // --- Đăng nhập thành công ---
    // Trả về thông tin user (dùng toJSON() để loại bỏ password)
    res.status(200).json({
      message: 'Đăng nhập thành công!',
      user: existingUser.toJSON(),
    });

  } catch (error) {
    console.error('Lỗi khi đăng nhập:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};
