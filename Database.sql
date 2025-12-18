-- Xóa database nếu đã tồn tại
DROP DATABASE IF EXISTS poker_system_test;

-- Tạo database
CREATE DATABASE poker_system_test;
USE poker_system_test;

-- ===========================================================
-- 1. Bảng User
-- ===========================================================
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role ENUM('Player', 'Admin') DEFAULT 'Player',
    balance DECIMAL(15,2) DEFAULT 0,
    banned BOOLEAN DEFAULT FALSE,
    violation_count INT NOT NULL DEFAULT 0,
    elo INT DEFAULT 1000,
    avatar_url VARCHAR(255) DEFAULT NULL,
    gems INT DEFAULT 0 COMMENT 'Kim cương - dùng để quay vòng quay hoặc đổi xu'
);

-- ===========================================================
-- 2. Bảng Transactions
-- ===========================================================
CREATE TABLE Transactions (
                              tx_id INT AUTO_INCREMENT PRIMARY KEY,
                              user_id INT NOT NULL,                        -- Người nhận tiền
                              source_id INT,                               -- Người gửi tiền (vd: người thua cược)
                              amount DECIMAL(15,2) NOT NULL,
                              reason TEXT,
                              source VARCHAR(100),                         -- Nguồn (vd: 'bank', 'game', 'crypto', ...)
                              time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                              FOREIGN KEY (user_id) REFERENCES User(user_id)
                                  ON DELETE CASCADE ON UPDATE CASCADE,
                              FOREIGN KEY (source_id) REFERENCES User(user_id)
                                  ON DELETE SET NULL ON UPDATE CASCADE
);

-- ===========================================================
-- 3. Bảng Table_Info 
-- ===========================================================
CREATE TABLE Table_Info (
                            table_id INT AUTO_INCREMENT PRIMARY KEY,
                            room_code CHAR(4) NOT NULL UNIQUE,      -- 🔹 Mã phòng gồm 4 số, không trùng nhau
                            min_players INT NOT NULL,
                            max_players INT NOT NULL,
                            small_blind DECIMAL(10,2),
                            max_blind DECIMAL(10,2),
                            min_buy_in DECIMAL(10,2),
                            max_buy_in DECIMAL(10,2),
                            rake DECIMAL(5,2),
                            is_private BOOLEAN DEFAULT FALSE,
                            status ENUM('waiting', 'playing') DEFAULT 'waiting',
                            created_by INT,
                            FOREIGN KEY (created_by) REFERENCES User(user_id)
                                ON DELETE SET NULL ON UPDATE CASCADE
);

-- ===========================================================
-- 4. Bảng Game_History
-- ===========================================================
CREATE TABLE Game_History (
                              game_id INT AUTO_INCREMENT PRIMARY KEY,
                              table_id INT NOT NULL,
                              time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                              result TEXT,
                              elo_change TEXT,
);

-- ===========================================================
-- 5. Bảng Report
-- ===========================================================
CREATE TABLE Report (
                        report_id INT AUTO_INCREMENT PRIMARY KEY,
                        reporter_id INT NOT NULL,
                        reported_id INT NOT NULL,
                        type VARCHAR(50) NOT NULL,
                        reason TEXT NOT NULL,
                        chat_history TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (reporter_id) REFERENCES User(user_id)
                            ON DELETE CASCADE ON UPDATE CASCADE,
                        FOREIGN KEY (reported_id) REFERENCES User(user_id)
                            ON DELETE CASCADE ON UPDATE CASCADE
);

-- ===========================================================
-- 6. Bảng Banned_Player
-- ===========================================================
CREATE TABLE Banned_Player (
                               ban_id INT AUTO_INCREMENT PRIMARY KEY,
                               report_id INT,
                               reported_id INT NOT NULL,
                               reason TEXT,
                               chat_history TEXT,
                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                               FOREIGN KEY (report_id) REFERENCES Report(report_id)
                                   ON DELETE SET NULL ON UPDATE CASCADE,
                               FOREIGN KEY (reported_id) REFERENCES User(user_id)
                                   ON DELETE CASCADE ON UPDATE CASCADE
);

-- ===========================================================
-- 7. Bảng Appeal
-- ===========================================================
CREATE TABLE Appeal (
                        appeal_id INT AUTO_INCREMENT PRIMARY KEY,
                        report_id INT,
                        ban_id INT NOT NULL,
                        action VARCHAR(100),
                        appeal_by INT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (report_id) REFERENCES Report(report_id)
                            ON DELETE SET NULL ON UPDATE CASCADE,
                        FOREIGN KEY (ban_id) REFERENCES Banned_Player(ban_id)
                            ON DELETE CASCADE ON UPDATE CASCADE,
                        FOREIGN KEY (appeal_by) REFERENCES User(user_id)
                            ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_user_balance ON User(balance);
CREATE INDEX idx_user_gems ON User(gems);
CREATE INDEX idx_user_elo ON User(elo);
CREATE INDEX idx_tx_user ON Transactions(user_id);
CREATE INDEX idx_game_table ON Game_History(table_id);
CREATE INDEX idx_report_reporter ON Report(reporter_id);
CREATE INDEX idx_report_reported ON Report(reported_id);
CREATE INDEX idx_ban_user ON Banned_Player(reported_id);
CREATE INDEX idx_ban_report ON Banned_Player(report_id);
CREATE INDEX idx_appeal_report ON Appeal(report_id);
CREATE INDEX idx_appeal_ban ON Appeal(ban_id);

-- ===========================================================
-- 7. Bảng refresh_tokens cho xác thực an toàn
-- ===========================================================
CREATE TABLE refresh_tokens (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                user_id INT NOT NULL,
                                session_id VARCHAR(128) DEFAULT NULL,
                                token_hash VARCHAR(255) NOT NULL,
                                issued_at DATETIME NOT NULL,
                                expires_at DATETIME NOT NULL,
                                revoked_at DATETIME DEFAULT NULL,
                                replaced_by VARCHAR(255) DEFAULT NULL,
                                device_info VARCHAR(255) DEFAULT NULL,
                                CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
                                INDEX idx_token_hash (token_hash)
);
-- ===========================================================
-- 8. Bảng password_reset_tokens để lưu trữ token đặt lại mật khẩu
-- ===========================================================
CREATE TABLE password_reset_tokens (
                                       id INT AUTO_INCREMENT PRIMARY KEY,
                                       user_id INT NOT NULL,
                                       token_hash VARCHAR(255) NOT NULL,
                                       expires_at DATETIME NOT NULL,
                                       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                       used_at DATETIME NULL,
                                       INDEX idx_token_hash (token_hash),
                                       INDEX idx_user_id (user_id),
                                       INDEX idx_expires_at (expires_at),
                                       FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- ===========================================================
-- 9. Bảng email_verification_tokens để xác thực email khi đăng ký
-- ===========================================================
CREATE TABLE email_verification_tokens (
                                           id INT AUTO_INCREMENT PRIMARY KEY,
                                           user_id INT NOT NULL,
                                           email VARCHAR(255) NOT NULL,
                                           token_hash VARCHAR(255) NOT NULL,
                                           expires_at DATETIME NOT NULL,
                                           created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                           verified_at DATETIME NULL,
                                           INDEX idx_token_hash (token_hash),
                                           INDEX idx_user_id (user_id),
                                           INDEX idx_expires_at (expires_at),
                                           FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- ==========================================================
-- 10. Bảng daily_rewards để quản lý phần thưởng hằng ngày
-- ===========================================================
-- Migration: Thêm bảng daily_rewards để quản lý phần thưởng hằng ngày
-- Created: 2025-10-19
-- Updated: Logic thay đổi từ "ngày trong tháng" sang "số ngày đã đăng nhập trong tháng"

-- Bảng lưu lịch sử nhận thưởng hằng ngày
CREATE TABLE daily_rewards (
                               id INT AUTO_INCREMENT PRIMARY KEY,
                               user_id INT NOT NULL,
                               login_day_count INT NOT NULL COMMENT 'Ngày đăng nhập thứ mấy trong tháng (1-31)',
                               month INT NOT NULL COMMENT 'Tháng (1-12)',
                               year INT NOT NULL COMMENT 'Năm',
                               reward_amount INT NOT NULL COMMENT 'Số xu nhận được',
                               claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian nhận thưởng',

                               FOREIGN KEY (user_id) REFERENCES User(user_id)
                                   ON DELETE CASCADE ON UPDATE CASCADE,

    -- Index để query nhanh
                               INDEX idx_user_month (user_id, year, month),
                               INDEX idx_claimed_at (claimed_at)
);

-- Bảng cấu hình phần thưởng theo số ngày đăng nhập
CREATE TABLE daily_reward_config (
                                     login_day_count INT PRIMARY KEY COMMENT 'Ngày đăng nhập thứ mấy (1-31)',
                                     reward_amount INT NOT NULL COMMENT 'Số xu thưởng',
                                     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Thêm dữ liệu mẫu cho 31 ngày đăng nhập (phần thưởng tăng dần, x10 so với trước)
INSERT INTO daily_reward_config (login_day_count, reward_amount) VALUES
                                                                     (1, 1000),   -- Ngày đầu tiên đăng nhập trong tháng
                                                                     (2, 1200),
                                                                     (3, 1500),
                                                                     (4, 1300),
                                                                     (5, 1800),   -- Ngày 5: Bonus
                                                                     (6, 1600),
                                                                     (7, 2000),   -- Tuần 1 kết thúc
                                                                     (8, 1700),
                                                                     (9, 1900),
                                                                     (10, 2200),  -- Ngày 10: Milestone
                                                                     (11, 2000),
                                                                     (12, 2300),
                                                                     (13, 2100),
                                                                     (14, 2500),  -- 2 tuần
                                                                     (15, 2800),  -- Giữa tháng - Bonus lớn
                                                                     (16, 2600),
                                                                     (17, 2900),
                                                                     (18, 2700),
                                                                     (19, 3000),
                                                                     (20, 3200),  -- Ngày 20: Milestone
                                                                     (21, 3100),
                                                                     (22, 3400),
                                                                     (23, 3300),
                                                                     (24, 3600),
                                                                     (25, 3800),  -- Ngày 25: Bonus
                                                                     (26, 3700),
                                                                     (27, 4000),
                                                                     (28, 4200),
                                                                     (29, 4500),
                                                                     (30, 4800),  -- Ngày 30
                                                                     (31, 5000);  -- Đăng nhập đủ 31 ngày - Reward lớn nhất

-- ===========================================================
-- 11. Triggers để tự động cập nhật số dư
-- ===========================================================

DELIMITER $$

-- Trigger khi INSERT transaction mới
CREATE TRIGGER tr_transaction_insert
    AFTER INSERT ON Transactions
    FOR EACH ROW
BEGIN
    -- Cập nhật số dư người nhận tiền (user_id)
    UPDATE User
    SET balance = balance + NEW.amount
    WHERE user_id = NEW.user_id;

    -- Nếu có người gửi tiền (source_id), trừ tiền từ tài khoản của họ
    IF NEW.source_id IS NOT NULL THEN
    UPDATE User
    SET balance = balance - NEW.amount
    WHERE user_id = NEW.source_id;
END IF;
END$$

-- Trigger ngăn chặn DELETE transaction (bảo vệ tính toàn vẹn)
CREATE TRIGGER tr_prevent_transaction_delete
    BEFORE DELETE ON Transactions
    FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Không được phép xóa giao dịch. Hãy tạo giao dịch hoàn tác thay vì xóa.';
END$$

    -- Trigger ngăn chặn UPDATE transaction (bảo vệ tính toàn vẹn)
    CREATE TRIGGER tr_prevent_transaction_update
        BEFORE UPDATE ON Transactions
        FOR EACH ROW
    BEGIN
        SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Không được phép sửa giao dịch. Hãy tạo giao dịch hoàn tác thay vì sửa đổi.';
END$$

        -- Trigger kiểm tra số dư không âm
        CREATE TRIGGER tr_user_balance_check
            BEFORE UPDATE ON User
            FOR EACH ROW
        BEGIN
            IF NEW.balance < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Số dư không thể âm. Giao dịch bị từ chối.';
        END IF;
        END$$

        -- ===========================================================
-- 12. Stored Procedure để tạo giao dịch hoàn tác
-- ===========================================================

        -- Procedure để hoàn tác một giao dịch
        CREATE PROCEDURE ReverseTransaction(
            IN original_tx_id INT,
            IN reversal_reason TEXT
        )
        BEGIN
    DECLARE original_user_id INT;
    DECLARE original_source_id INT;
    DECLARE original_amount DECIMAL(15,2);
    DECLARE original_reason TEXT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Bắt đầu transaction
    START TRANSACTION;

    -- Lấy thông tin giao dịch gốc
    SELECT user_id, source_id, amount, reason
    INTO original_user_id, original_source_id, original_amount, original_reason
    FROM Transactions
    WHERE tx_id = original_tx_id;

    -- Kiểm tra giao dịch có tồn tại
    IF original_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Giao dịch không tồn tại.';
END IF;

-- Kiểm tra đã được hoàn tác chưa (dựa vào reason)
IF EXISTS (
        SELECT 1 FROM Transactions
        WHERE reason LIKE CONCAT('REVERSAL of TX#', original_tx_id, '%')
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Giao dịch đã được hoàn tác trước đó.';
END IF;

    -- Tạo giao dịch hoàn tác (đảo ngược user_id và source_id)
INSERT INTO Transactions (
    user_id,
    source_id,
    amount,
    reason
) VALUES (
             original_source_id,    -- Người gửi gốc trở thành người nhận
             original_user_id,      -- Người nhận gốc trở thành người gửi
             original_amount,       -- Cùng số tiền
             CONCAT('REVERSAL of TX#', original_tx_id, ' - ', reversal_reason)  -- Đánh dấu hoàn tác trong reason
         );

COMMIT;

-- Trả về ID của giao dịch hoàn tác
SELECT LAST_INSERT_ID() as reversal_tx_id;
END$$

DELIMITER ;

-- ===========================================================
-- 13. Hệ thống Gems (Kim cương/Vé) - Phần thưởng đặc biệt
-- ===========================================================

-- 13.1. Bảng cấu hình phần thưởng theo ELO milestone
CREATE TABLE elo_milestone_rewards (
                                       milestone_id INT AUTO_INCREMENT PRIMARY KEY,
                                       elo_required INT NOT NULL UNIQUE COMMENT 'Mức ELO cần đạt',
                                       gems_reward INT NOT NULL COMMENT 'Số gems thưởng',
                                       description VARCHAR(255) COMMENT 'Mô tả mốc thưởng',
                                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dữ liệu: Phần thưởng theo mốc ELO
INSERT INTO elo_milestone_rewards (elo_required, gems_reward, description) VALUES
                                                                               (1200, 50, 'Đạt 1200 ELO - Người chơi Bronze'),
                                                                               (1400, 100, 'Đạt 1400 ELO - Người chơi Silver'),
                                                                               (1600, 200, 'Đạt 1600 ELO - Người chơi Gold'),
                                                                               (1800, 350, 'Đạt 1800 ELO - Người chơi Platinum'),
                                                                               (2000, 500, 'Đạt 2000 ELO - Người chơi Diamond'),
                                                                               (2200, 750, 'Đạt 2200 ELO - Người chơi Master'),
                                                                               (2500, 1000, 'Đạt 2500 ELO - Người chơi Grandmaster');

-- 13.2. Bảng quản lý mùa (Season) cho phần thưởng ELO
CREATE TABLE reward_seasons (
                                season_id INT AUTO_INCREMENT PRIMARY KEY,
                                season_name VARCHAR(100) NOT NULL COMMENT 'Tên mùa (VD: Season 1, Mùa Xuân 2025)',
                                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                end_date TIMESTAMP NULL COMMENT 'NULL = mùa đang active',
                                is_active BOOLEAN DEFAULT TRUE COMMENT 'Chỉ có 1 mùa active tại 1 thời điểm',
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                INDEX idx_active_season (is_active, end_date)
);

-- Tạo mùa đầu tiên
INSERT INTO reward_seasons (season_name, is_active) VALUES ('Season 1', TRUE);

-- 13.3. Bảng lịch sử nhận thưởng ELO
CREATE TABLE elo_milestone_claims (
                                      claim_id INT AUTO_INCREMENT PRIMARY KEY,
                                      user_id INT NOT NULL,
                                      milestone_id INT NOT NULL,
                                      season_id INT NOT NULL COMMENT 'Mùa nhận thưởng',
                                      claimed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'NULL = chưa nhận, có giá trị = đã nhận',
                                      gems_received INT NOT NULL,
                                      elo_at_claim INT NOT NULL COMMENT 'ELO tại thời điểm nhận thưởng',
                                      FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
                                      FOREIGN KEY (milestone_id) REFERENCES elo_milestone_rewards(milestone_id) ON DELETE CASCADE,
                                      FOREIGN KEY (season_id) REFERENCES reward_seasons(season_id) ON DELETE CASCADE,
                                      UNIQUE KEY unique_user_milestone_season (user_id, milestone_id, season_id),
                                      INDEX idx_elo_claims_user (user_id),
                                      INDEX idx_elo_claims_season (season_id),
                                      INDEX idx_elo_pending (user_id, claimed_at)
);

-- 13.4. Bảng cấu hình phần thưởng hàng tuần (Thứ 2)
CREATE TABLE weekly_reward_config (
                                      config_id INT AUTO_INCREMENT PRIMARY KEY,
                                      elo_min INT NOT NULL COMMENT 'ELO tối thiểu',
                                      elo_max INT COMMENT 'ELO tối đa (NULL = không giới hạn)',
                                      gems_reward INT NOT NULL COMMENT 'Số gems thưởng',
                                      tier_name VARCHAR(50) COMMENT 'Tên hạng (Bronze, Silver, ...)',
                                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dữ liệu: Phần thưởng hàng tuần
INSERT INTO weekly_reward_config (elo_min, elo_max, gems_reward, tier_name) VALUES
                                                                                (0, 1199, 50, 'Newbie'),
                                                                                (1200, 1399, 100, 'Bronze'),
                                                                                (1400, 1599, 175, 'Silver'),
                                                                                (1600, 1799, 250, 'Gold'),
                                                                                (1800, 1999, 375, 'Platinum'),
                                                                                (2000, 2199, 500, 'Diamond'),
                                                                                (2200, 2499, 750, 'Master'),
                                                                                (2500, NULL, 1000, 'Grandmaster');

-- 13.5. Bảng lịch sử nhận thưởng hàng tuần
CREATE TABLE weekly_reward_claims (
                                      claim_id INT AUTO_INCREMENT PRIMARY KEY,
                                      user_id INT NOT NULL,
                                      week_start_date DATE NOT NULL COMMENT 'Ngày thứ 2 đầu tuần',
                                      gems_received INT NOT NULL,
                                      elo_at_claim INT NOT NULL,
                                      tier_name VARCHAR(50) COMMENT 'Tên hạng tại thời điểm phát thưởng',
                                      claimed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'NULL = chưa nhận, có giá trị = đã nhận',
                                      FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
                                      UNIQUE KEY unique_user_week (user_id, week_start_date),
                                      INDEX idx_weekly_claims_user (user_id),
                                      INDEX idx_weekly_claims_date (week_start_date),
                                      INDEX idx_weekly_pending (user_id, claimed_at)
);

-- 13.6. Bảng cấu hình phần thưởng hàng tháng (Top 100)
CREATE TABLE monthly_reward_config (
                                       config_id INT AUTO_INCREMENT PRIMARY KEY,
                                       rank_min INT NOT NULL COMMENT 'Hạng tối thiểu (vd: 1)',
                                       rank_max INT NOT NULL COMMENT 'Hạng tối đa (vd: 10)',
                                       gems_reward INT NOT NULL COMMENT 'Số gems thưởng',
                                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dữ liệu: Phần thưởng hàng tháng
INSERT INTO monthly_reward_config (rank_min, rank_max, gems_reward) VALUES
                                                                        (1, 1, 10000),
                                                                        (2, 2, 7000),
                                                                        (3, 3, 5000),
                                                                        (4, 10, 3000),
                                                                        (11, 30, 2000),
                                                                        (31, 50, 1500),
                                                                        (51, 100, 1000);

-- 13.7. Bảng lịch sử nhận thưởng hàng tháng
CREATE TABLE monthly_reward_claims (
                                       claim_id INT AUTO_INCREMENT PRIMARY KEY,
                                       user_id INT NOT NULL,
                                       month_year VARCHAR(7) NOT NULL COMMENT 'Tháng-năm (YYYY-MM)',
                                       rank_at_claim INT NOT NULL COMMENT 'Hạng tại thời điểm phát thưởng',
                                       elo_at_claim INT NOT NULL,
                                       gems_received INT NOT NULL,
                                       claimed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'NULL = chưa nhận, có giá trị = đã nhận',
                                       FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
                                       UNIQUE KEY unique_user_month (user_id, month_year),
                                       INDEX idx_monthly_claims_user (user_id),
                                       INDEX idx_monthly_claims_month (month_year),
                                       INDEX idx_monthly_pending (user_id, claimed_at)
);

-- 13.8. Bảng log phát thưởng (Reward Distribution Log)
CREATE TABLE reward_distribution_log (
                                         id INT AUTO_INCREMENT PRIMARY KEY,
                                         reward_type ENUM('weekly', 'monthly') NOT NULL,
                                         period_identifier VARCHAR(10) NOT NULL COMMENT 'YYYY-WW cho weekly, YYYY-MM cho monthly',
                                         executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                         total_users_rewarded INT DEFAULT 0,
                                         total_gems_distributed INT DEFAULT 0,
                                         error_message TEXT,
                                         INDEX idx_dist_type_period (reward_type, period_identifier)
);

-- 13.9. Trigger kiểm tra gems không âm
DELIMITER $$

CREATE TRIGGER tr_user_gems_check
    BEFORE UPDATE ON User
    FOR EACH ROW
BEGIN
    IF NEW.gems < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Số gems không thể âm. Giao dịch bị từ chối.';
END IF;
END$$

DELIMITER ;

-- 13.10. Trigger tự động tạo ELO milestone reward khi ELO tăng
DELIMITER $$

CREATE TRIGGER after_user_elo_update
    AFTER UPDATE ON User
    FOR EACH ROW
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_milestone_id INT;
    DECLARE v_elo_required INT;
    DECLARE v_reward_gems INT;
    DECLARE v_season_id INT;

    -- Cursor để lấy tất cả milestones từ bảng elo_milestone_rewards
    DECLARE milestone_cursor CURSOR FOR
    SELECT milestone_id, elo_required, gems_reward
    FROM elo_milestone_rewards
    ORDER BY elo_required ASC;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Chỉ xử lý khi ELO tăng
    IF NEW.elo > OLD.elo THEN
        -- Lấy season hiện tại
    SELECT season_id INTO v_season_id
    FROM reward_seasons
    WHERE is_active = TRUE
        LIMIT 1;

    -- Nếu có season active, xử lý milestones
    IF v_season_id IS NOT NULL THEN

        OPEN milestone_cursor;

        read_loop: LOOP
            FETCH milestone_cursor INTO v_milestone_id, v_elo_required, v_reward_gems;

            IF done THEN
                LEAVE read_loop;
END IF;

-- Kiểm tra xem user có vượt qua mốc này không
IF NEW.elo >= v_elo_required AND OLD.elo < v_elo_required THEN
                -- Tạo phần thưởng pending (chỉ tạo nếu chưa tồn tại)
                INSERT IGNORE INTO elo_milestone_claims
                    (user_id, milestone_id, season_id, claimed_at, gems_received, elo_at_claim)
                VALUES
                    (NEW.user_id, v_milestone_id, v_season_id, NULL, v_reward_gems, NEW.elo);
END IF;
END LOOP;

CLOSE milestone_cursor;
END IF; -- Đóng IF v_season_id IS NOT NULL
END IF; -- Đóng IF NEW.elo > OLD.elo
END$$

DELIMITER ;



-- ===========================================================
-- 1. Bảng Referral_Links - Lưu trữ các link giới thiệu
-- ===========================================================
CREATE TABLE IF NOT EXISTS Referral_Links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ref_code VARCHAR(32) NOT NULL UNIQUE,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    total_clicks INT DEFAULT 0,
    total_activations INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES User(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_ref_code (ref_code),
    INDEX idx_user_id (user_id),
    INDEX idx_active (is_active)
);

-- ===========================================================
-- 2. Bảng Referral_Clicks - Theo dõi mỗi lượt click
-- ===========================================================
CREATE TABLE IF NOT EXISTS Referral_Clicks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ref_code VARCHAR(32) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    clicked_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    converted TINYINT(1) DEFAULT 0,
    INDEX idx_ref_code (ref_code),
    INDEX idx_device_id (device_id),
    INDEX idx_clicked_at (clicked_at)
);

-- ===========================================================
-- 3. Bảng Referral_Activations - Người dùng đăng ký thành công
-- ===========================================================
CREATE TABLE IF NOT EXISTS Referral_Activations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referrer_id INT NOT NULL,
    referee_id INT NOT NULL UNIQUE,
    ref_code VARCHAR(32) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    reward_amount DECIMAL(15,2) NOT NULL,
    status ENUM('pending','completed','failed','fraud') DEFAULT 'pending',
    activated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (referrer_id) REFERENCES User(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (ref_code) REFERENCES Referral_Links(ref_code)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_referrer (referrer_id),
    INDEX idx_referee (referee_id),
    INDEX idx_status (status),
    INDEX idx_activated_at (activated_at)
);
-- Migration: Allow UPDATE for VNPay PENDING transactions
-- Date: 2025-12-05
-- Purpose: Cho phép UPDATE transaction khi có flag @TRIGGER_DISABLED


-- DROP trigger cũ
DROP TRIGGER IF EXISTS tr_prevent_transaction_update;

-- Tạo trigger mới với điều kiện BYPASS
DELIMITER $$

CREATE TRIGGER tr_prevent_transaction_update
    BEFORE UPDATE ON Transactions
    FOR EACH ROW
BEGIN
    -- CHO PHÉP UPDATE khi có flag @TRIGGER_DISABLED = 1
    IF @TRIGGER_DISABLED IS NULL OR @TRIGGER_DISABLED != 1 THEN
        -- Chặn UPDATE cho tất cả các transaction khác
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Không được phép sửa giao dịch. Hãy tạo giao dịch hoàn tác thay vì sửa đổi.';
    END IF;
END$$

DELIMITER ;

-- ===========================================================
-- 14. Dữ liệu mẫu (Demo Data)
-- ===========================================================

-- Người dùng (số dư ban đầu = 0, sẽ được cập nhật qua triggers)
INSERT INTO User (username, password, email, balance, banned) VALUES
                                                                  ('Alice', '$2b$10$3KMtvlgM0myja.xDV2GXeemzV1wXC8yJamj95E9MNRf7h35uCZJfK', 'bttshirayukihime@gmail.com', 0, FALSE),
                                                                  ('Bob', '$2b$10$3KMtvlgM0myja.xDV2GXeemzV1wXC8yJamj95E9MNRf7h35uCZJfK', 'bob@example.com', 0, TRUE),
                                                                  ('Charlie', '$2b$10$3KMtvlgM0myja.xDV2GXeemzV1wXC8yJamj95E9MNRf7h35uCZJfK', 'charlie@example.com', 0, FALSE);

-- Bàn poker
INSERT INTO Table_Info (
    room_code, min_players, max_players, small_blind, max_blind,
    min_buy_in, max_buy_in, rake, is_private, status, created_by
)
VALUES
    ('1234', 2, 6, 2.5, 5.0, 2000, 10000, 0.05, TRUE, 'waiting', 1);

ALTER TABLE Report
ADD COLUMN ai_analysis TEXT DEFAULT NULL COMMENT 'Kết quả phân tích từ AI',
ADD COLUMN ai_verdict ENUM('pending', 'violation_detected', 'clean', 'error') DEFAULT 'pending' COMMENT 'Đánh giá của AI';

-- Giao dịch (Triggers sẽ tự động cập nhật số dư trong bảng User)
INSERT INTO Transactions (user_id, amount, reason, source_id, source)
VALUES
(1, 5000, 'Initial deposit', null, 'bank'),        -- Alice nhận 5000, balance = 0 + 5000 = 5000
(2, 3000, 'Game winnings', 1, 'game'),             -- Bob nhận 3000 từ Alice, Alice trừ 3000
(3, 1000, 'Send present', 1, 'gift');              -- Charlie nhận 1000 từ Alice, Alice trừ 1000

INSERT INTO Transactions (user_id, source_id, amount, reason, source)
VALUES (1, 2, 1000, 'Won from Bob', 'game');  -- Alice nhận 1000 từ Bob, Bob trừ 1000


-- Báo cáo người chơi xấu
INSERT INTO Report (reporter_id, reported_id, type, reason)
VALUES
(1, 2, 'offensive_language', 'Using offensive language in chat'),
(3, 2, 'cheating', 'Suspected of cheating in game');

INSERT INTO Banned_Player (report_id, reported_id, reason, chat_history)
VALUES (1, 2, 'Using offensive language in chat', '"You are so bad, noob!"');

-- Đơn khiếu nại (appeal)
INSERT INTO Appeal (report_id, ban_id, action, appeal_by)
VALUES (1, 1, 'Reviewed: Account temporarily suspended', 2);

-- ===========================================================
-- 10. Ví dụ test hệ thống giao dịch (có thể uncomment để test)
-- ===========================================================
-- -- Test 1: Kiểm tra số dư ban đầu
-- SELECT username, balance FROM User;
-- -- Kết quả: Alice: -5000, Bob: 3000, Charlie: 10000

-- -- Test 2: Thử xóa giao dịch (sẽ bị từ chối)
-- DELETE FROM Transactions WHERE tx_id = 1;
-- -- Error: "Không được phép xóa giao dịch"

-- -- Test 3: Thử sửa giao dịch (sẽ bị từ chối)  
-- UPDATE Transactions SET amount = 6000 WHERE tx_id = 1;
-- -- Error: "Không được phép sửa giao dịch"

-- -- Test 4: Hoàn tác giao dịch bằng procedure
-- CALL ReverseTransaction(3, 'Hoàn tác do lỗi hệ thống');
-- -- Sẽ tạo giao dịch mới với reason = "REVERSAL of TX#3 - Hoàn tác do lỗi hệ thống"

-- -- Test 5: Kiểm tra kết quả sau hoàn tác
-- SELECT u.username, u.balance, 
--        COUNT(t.tx_id) as total_transactions,
--        SUM(CASE WHEN t.reason LIKE 'REVERSAL of TX#%' THEN 1 ELSE 0 END) as reversal_count
-- FROM User u 
-- LEFT JOIN Transactions t ON u.user_id = t.user_id 
-- GROUP BY u.user_id, u.username, u.balance;

-- -- Test 6: Xem lịch sử giao dịch chi tiết
-- SELECT tx_id, user_id, source_id, amount, reason, time
-- FROM Transactions 
-- ORDER BY time;

-- -- Test 7: Thử hoàn tác một giao dịch đã được hoàn tác (sẽ lỗi)
-- CALL ReverseTransaction(3, 'Test double reversal');
-- -- Error: "Giao dịch đã được hoàn tác trước đó"
