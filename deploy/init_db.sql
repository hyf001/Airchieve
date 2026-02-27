-- ============================================================
-- AIrchieve / Pictora  Database Schema
-- MySQL 8.0+
-- Generated: 2026-02-27
-- ============================================================

CREATE DATABASE IF NOT EXISTS `airchieve`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `airchieve`;

-- ------------------------------------------------------------
-- 1. users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`                      INT           NOT NULL AUTO_INCREMENT,
  `nickname`                VARCHAR(64)   NOT NULL,
  `avatar_url`              VARCHAR(512)  DEFAULT NULL,
  `role`                    ENUM('admin','user')
                                          NOT NULL DEFAULT 'user',
  `status`                  ENUM('active','banned','deleted')
                                          NOT NULL DEFAULT 'active',
  -- cross-domain cache
  `points_balance`          INT           NOT NULL DEFAULT 0,
  `free_creation_remaining` INT           NOT NULL DEFAULT 2,
  -- payment domain cache
  `membership_level`        ENUM('free','lite','pro','max')
                                          NOT NULL DEFAULT 'free',
  `membership_expire_at`    DATETIME      DEFAULT NULL,
  -- timestamps
  `created_at`              TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              DATETIME      DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 2. user_auth
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_auth` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `user_id`         INT           NOT NULL,
  `auth_type`       ENUM('password','sms','wechat_web')
                                  NOT NULL,
  `identifier`      VARCHAR(128)  NOT NULL,
  `credential`      VARCHAR(255)  DEFAULT NULL  COMMENT 'bcrypt hash for password auth',
  `wechat_unionid`  VARCHAR(64)   DEFAULT NULL,
  `is_active`       TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 3. user_points_log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_points_log` (
  `id`               INT           NOT NULL AUTO_INCREMENT,
  `user_id`          INT           NOT NULL,
  `delta`            INT           NOT NULL  COMMENT '正数=收入, 负数=支出',
  `type`             ENUM('recharge','creation_cost','bonus','refund','admin_adjust')
                                   NOT NULL,
  `description`      VARCHAR(256)  DEFAULT NULL,
  `balance_after`    INT           NOT NULL  COMMENT '变更后余额快照',
  `related_order_id` VARCHAR(64)   DEFAULT NULL,
  `created_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 4. recharge_orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `recharge_orders` (
  `id`                     INT          NOT NULL AUTO_INCREMENT,
  `user_id`                INT          NOT NULL,
  `order_no`               VARCHAR(64)  NOT NULL,
  `amount_fen`             INT          NOT NULL  COMMENT '支付金额（分）',
  `points_amount`          INT          NOT NULL  COMMENT '到账积分（1元=7积分）',
  `status`                 ENUM('pending','paid','failed','refunded')
                                        NOT NULL DEFAULT 'pending',
  `wechat_transaction_id`  VARCHAR(64)  DEFAULT NULL,
  `created_at`             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at`                DATETIME     DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 5. subscription_orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscription_orders` (
  `id`                     INT          NOT NULL AUTO_INCREMENT,
  `user_id`                INT          NOT NULL,
  `order_no`               VARCHAR(64)  NOT NULL,
  `level`                  ENUM('lite','pro','max')
                                        NOT NULL  COMMENT '订阅等级',
  `months`                 INT          NOT NULL,
  `amount_fen`             INT          NOT NULL  COMMENT '支付金额（分）',
  `status`                 ENUM('pending','active','expired','cancelled')
                                        NOT NULL DEFAULT 'pending',
  `wechat_transaction_id`  VARCHAR(64)  DEFAULT NULL,
  `start_at`               DATETIME     DEFAULT NULL,
  `expire_at`              DATETIME     DEFAULT NULL,
  `created_at`             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at`                DATETIME     DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 6. templates
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `templates` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(255)  NOT NULL,
  `description`  TEXT          DEFAULT NULL,
  `creator`      VARCHAR(128)  NOT NULL,
  `modifier`     VARCHAR(128)  DEFAULT NULL,
  `instruction`  TEXT          NOT NULL   COMMENT '用户侧指令模板',
  `systemprompt` TEXT          DEFAULT NULL COMMENT '系统提示词',
  `storybook_id` INT           DEFAULT NULL COMMENT '示例绘本引用',
  `is_active`    TINYINT(1)    NOT NULL DEFAULT 1,
  `sort_order`   INT           NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 7. storybooks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `storybooks` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `title`        VARCHAR(255)  NOT NULL,
  `description`  TEXT          DEFAULT NULL,
  `creator`      VARCHAR(128)  NOT NULL,
  `instruction`  TEXT          DEFAULT NULL COMMENT '用户输入/提示词',
  `template_id`  INT           DEFAULT NULL,
  `is_public`    TINYINT(1)    NOT NULL DEFAULT 0,
  `pages`        LONGTEXT      DEFAULT NULL COMMENT '[{text, image_url}, ...]',
  `status`       VARCHAR(32)   NOT NULL DEFAULT 'init'
                               COMMENT 'init|creating|updating|finished|error',
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME      DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
