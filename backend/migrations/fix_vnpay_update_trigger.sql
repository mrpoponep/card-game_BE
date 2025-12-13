-- Migration: Allow UPDATE for VNPay PENDING transactions
-- Date: 2025-12-05
-- Purpose: Cho phép UPDATE transaction khi có flag @TRIGGER_DISABLED

USE poker_system_dev;

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
