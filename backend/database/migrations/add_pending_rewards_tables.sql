-- ============================================================
-- Migration: Modify Reward Tables to Support Pending Rewards
-- Date: 2025-10-20
-- Purpose: Allow NULL claimed_at to represent pending (unclaimed) rewards
-- ============================================================

USE poker_system_test;

-- 1. Sửa bảng elo_milestone_claims để claimed_at có thể NULL
ALTER TABLE elo_milestone_claims 
MODIFY COLUMN claimed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'NULL = chưa nhận, có giá trị = đã nhận';

-- 2. Sửa bảng weekly_reward_claims để claimed_at có thể NULL  
ALTER TABLE weekly_reward_claims
MODIFY COLUMN claimed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'NULL = chưa nhận, có giá trị = đã nhận';

-- 3. Sửa bảng monthly_reward_claims để claimed_at có thể NULL
ALTER TABLE monthly_reward_claims
MODIFY COLUMN claimed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'NULL = chưa nhận, có giá trị = đã nhận';

-- 4. Thêm index để query nhanh các reward chưa nhận
ALTER TABLE elo_milestone_claims 
ADD INDEX idx_elo_pending (user_id, claimed_at);

ALTER TABLE weekly_reward_claims
ADD INDEX idx_weekly_pending (user_id, claimed_at);

ALTER TABLE monthly_reward_claims  
ADD INDEX idx_monthly_pending (user_id, claimed_at);

-- 5. Bảng theo dõi đã phát thưởng tuần/tháng chưa (để tránh phát trùng)
CREATE TABLE IF NOT EXISTS reward_distribution_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    reward_type ENUM('weekly', 'monthly') NOT NULL,
    period_identifier VARCHAR(20) NOT NULL COMMENT 'YYYY-Www hoặc YYYY-MM',
    distributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_users_rewarded INT DEFAULT 0,
    total_gems_distributed INT DEFAULT 0,
    
    UNIQUE KEY unique_type_period (reward_type, period_identifier),
    INDEX idx_distribution_type (reward_type)
);

-- 6. Trigger để tự động tạo ELO milestone reward khi user tăng ELO
DELIMITER $$

DROP TRIGGER IF EXISTS after_user_elo_update$$

CREATE TRIGGER after_user_elo_update
AFTER UPDATE ON User
FOR EACH ROW
BEGIN
    DECLARE current_season_id INT;
    
    -- Chỉ xử lý nếu ELO tăng
    IF NEW.elo > OLD.elo THEN
        -- Lấy season hiện tại
        SELECT season_id INTO current_season_id
        FROM reward_seasons
        WHERE is_active = TRUE
        LIMIT 1;
        
        -- Tạo reward cho các milestone vừa đạt được (OLD.elo < milestone <= NEW.elo)
        INSERT INTO elo_milestone_claims (
            user_id, milestone_id, season_id, 
            gems_received, elo_at_claim, claimed_at
        )
        SELECT 
            NEW.user_id,
            m.milestone_id,
            current_season_id,
            m.gems_reward,
            NEW.elo,
            NULL -- NULL = chưa claim
        FROM elo_milestone_rewards m
        WHERE m.elo_required > OLD.elo 
          AND m.elo_required <= NEW.elo
          AND NOT EXISTS (
              SELECT 1 FROM elo_milestone_claims c
              WHERE c.user_id = NEW.user_id
                AND c.milestone_id = m.milestone_id
                AND c.season_id = current_season_id
          );
    END IF;
END$$

DELIMITER ;

