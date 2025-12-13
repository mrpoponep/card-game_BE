-- Bảng lịch sử vòng quay may mắn
-- Created: 2025-12-03

CREATE TABLE IF NOT EXISTS lucky_wheel_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  multiplier INT NOT NULL COMMENT 'Hệ số nhân (số lần quay)',
  cost_gems INT NOT NULL COMMENT 'Số gems đã tiêu',
  prize_amount INT NOT NULL COMMENT 'Giá trị giải thưởng hiển thị (1 lần quay)',
  total_win INT NOT NULL COMMENT 'Tổng tiền thắng (prize_amount x multiplier)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian quay',
  
  FOREIGN KEY (user_id) REFERENCES User(user_id) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm comment cho bảng
ALTER TABLE lucky_wheel_history COMMENT = 'Lưu lịch sử quay vòng may mắn của người chơi';
