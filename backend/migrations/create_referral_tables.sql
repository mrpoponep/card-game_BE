-- Migration: Create Referral/Affiliate System Tables
-- Created: 2024-12-13

USE poker_system_dev;

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
