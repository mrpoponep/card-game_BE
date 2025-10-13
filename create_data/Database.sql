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
    balance DECIMAL(15,2) DEFAULT 0,
    banned BOOLEAN DEFAULT FALSE,
    elo INT DEFAULT 1000
);

-- ===========================================================
-- 2. Bảng Transactions
-- ===========================================================
CREATE TABLE Transactions (
    tx_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,                        -- Người nhận tiền
    source_id INT,                               -- Người gửi tiền (vd: người thua cược)
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,                                 -- Lý do giao dịch (bao gồm cả thông tin hoàn tác)
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
    min_players INT NOT NULL,
    max_players INT NOT NULL,
    small_blind DECIMAL(10,2),
    max_blind DECIMAL(10,2),
    min_buy_in DECIMAL(10,2),
    max_buy_in DECIMAL(10,2),
    rake DECIMAL(5,2)
);

-- ===========================================================
-- 4. Bảng Game_History
-- ===========================================================
CREATE TABLE Game_History (
    game_id INT AUTO_INCREMENT PRIMARY KEY,
    table_id INT NOT NULL,
    game_type VARCHAR(50),
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    winner INT,
    FOREIGN KEY (table_id) REFERENCES Table_Info(table_id),
    FOREIGN KEY (winner) REFERENCES User(user_id)
);

-- ===========================================================
-- 5. Bảng Banned_Player
-- ===========================================================
CREATE TABLE Banned_Player (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    reported_id INT NOT NULL,
    reason TEXT,
    chat_history TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reported_id) REFERENCES User(user_id)
);

-- ===========================================================
-- 6. Bảng Appeal
-- ===========================================================
CREATE TABLE Appeal (
    appeal_id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    action VARCHAR(100),
    appeal_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES Banned_Player(report_id),
    FOREIGN KEY (appeal_by) REFERENCES User(user_id)
);

-- ===========================================================
-- 7. Index tối ưu
-- ===========================================================
CREATE INDEX idx_user_balance ON User(balance);
CREATE INDEX idx_tx_user ON Transactions(user_id);
CREATE INDEX idx_game_table ON Game_History(table_id);
CREATE INDEX idx_ban_user ON Banned_Player(reported_id);
CREATE INDEX idx_appeal_report ON Appeal(report_id);

-- ===========================================================
-- 8. Triggers để tự động cập nhật số dư
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
-- Stored Procedure để tạo giao dịch hoàn tác
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
-- 9. Dữ liệu mẫu (Demo Data)
-- ===========================================================

-- Người dùng (số dư ban đầu = 0, sẽ được cập nhật qua triggers)
INSERT INTO User (username, password, balance, banned) VALUES
('Alice', 'hashed_password_1', 0, FALSE),
('Bob', 'hashed_password_2', 0, TRUE),
('Charlie', 'hashed_password_3', 0, FALSE);

-- Bàn poker
INSERT INTO Table_Info (min_players, max_players, small_blind, max_blind, min_buy_in, max_buy_in, rake)
VALUES (2, 6, 50, 100, 2000, 10000, 0.05);

-- Lịch sử game
INSERT INTO Game_History (table_id, game_type, winner)
VALUES (1, 'Texas Hold\'em', 1);

-- Giao dịch (Triggers sẽ tự động cập nhật số dư trong bảng User)
INSERT INTO Transactions (user_id, amount, reason, source_id)
VALUES
(1, 5000, 'Initial deposit', null),        -- Alice nhận 5000, balance = 0 + 5000 = 5000
(2, 3000, 'Game winnings', 1),             -- Bob nhận 3000 từ Alice, Alice trừ 3000
(3, 1000, 'Send present', 1);              -- Charlie nhận 10000 từ Alice, Alice trừ 10000

-- Báo cáo người chơi xấu
INSERT INTO Banned_Player (reported_id, reason, chat_history)
VALUES (2, 'Using offensive language in chat', '“You are so bad, noob!”');

-- Đơn khiếu nại (appeal)
INSERT INTO Appeal (report_id, action, appeal_by)
VALUES (1, NULL, 2);

-- ===========================================================
-- 10. Ví dụ test hệ thống giao dịch (có thể uncomment để test)
-- ===========================================================
-- Test 1: Kiểm tra số dư ban đầu
SELECT username, balance FROM User;
-- Kết quả: Alice: -5000, Bob: 3000, Charlie: 10000

-- Test 2: Thử xóa giao dịch (sẽ bị từ chối)
DELETE FROM Transactions WHERE tx_id = 1;
-- Error: "Không được phép xóa giao dịch"

-- Test 3: Thử sửa giao dịch (sẽ bị từ chối)  
UPDATE Transactions SET amount = 6000 WHERE tx_id = 1;
-- Error: "Không được phép sửa giao dịch"

-- Test 4: Hoàn tác giao dịch bằng procedure
CALL ReverseTransaction(3, 'Hoàn tác do lỗi hệ thống');
-- Sẽ tạo giao dịch mới với reason = "REVERSAL of TX#3 - Hoàn tác do lỗi hệ thống"

-- Test 5: Kiểm tra kết quả sau hoàn tác
SELECT u.username, u.balance, 
       COUNT(t.tx_id) as total_transactions,
       SUM(CASE WHEN t.reason LIKE 'REVERSAL of TX#%' THEN 1 ELSE 0 END) as reversal_count
FROM User u 
LEFT JOIN Transactions t ON u.user_id = t.user_id 
GROUP BY u.user_id, u.username, u.balance;

-- Test 6: Xem lịch sử giao dịch chi tiết
SELECT tx_id, user_id, source_id, amount, reason, time
FROM Transactions 
ORDER BY time;

-- Test 7: Thử hoàn tác một giao dịch đã được hoàn tác (sẽ lỗi)
CALL ReverseTransaction(3, 'Test double reversal');
-- Error: "Giao dịch đã được hoàn tác trước đó"