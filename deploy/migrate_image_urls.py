#!/usr/bin/env python3
"""
迁移脚本：将数据库中绘本页面的 OSS 直接 URL 更新为后端代理 URL

原格式: https://{bucket}.{endpoint}/{key}
新格式: /api/v1/oss/{key}

用法：
  # 预览模式（只打印，不修改）
  python deploy/migrate_image_urls.py

  # 实际执行更新
  python deploy/migrate_image_urls.py --apply

  # 指定 .env 文件路径（生产环境）
  python deploy/migrate_image_urls.py --apply --env /opt/airchieve/.env
"""
import argparse
import json
import os
import sys


# ──────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────

def load_env(env_path: str) -> dict[str, str]:
    """手动解析 .env 文件（不依赖 python-dotenv）"""
    env: dict[str, str] = {}
    if not os.path.exists(env_path):
        return env
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip()
    return env


def to_sync_url(async_url: str) -> str:
    """将异步数据库 URL 转为同步驱动（供脚本直接使用）"""
    return (
        async_url
        .replace("sqlite+aiosqlite:///", "sqlite:///")
        .replace("mysql+aiomysql://", "mysql+pymysql://")
        .replace("postgresql+asyncpg://", "postgresql://")
    )


def extract_key(url: str, bucket_name: str, endpoint: str, base_url: str) -> str | None:
    """
    从 OSS URL 提取 object_key。
    - 已是代理 URL（/api/...）→ 跳过返回 None
    - 匹配 base_url 自定义域名 → 提取 key
    - 匹配标准 OSS URL          → 提取 key
    """
    if not url:
        return None
    if url.startswith("/api/") or url.startswith("data:"):
        return None  # 已迁移或 base64，跳过

    if base_url:
        prefix = base_url.rstrip("/") + "/"
        if url.startswith(prefix):
            return url[len(prefix):]

    standard_prefix = f"https://{bucket_name}.{endpoint}/"
    if url.startswith(standard_prefix):
        return url[len(standard_prefix):]

    return None


# ──────────────────────────────────────────
# 主逻辑
# ──────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="迁移绘本图片 URL 为后端代理 URL")
    parser.add_argument("--apply", action="store_true",
                        help="实际执行更新（默认为预览模式，不修改数据库）")
    parser.add_argument("--env", default=".env",
                        help=".env 文件路径（默认: .env）")
    args = parser.parse_args()

    # ── 读取配置 ──────────────────────────
    env = load_env(args.env)
    db_url = env.get("DATABASE_URL", "")
    if not db_url:
        print(f"❌ 未在 {args.env} 中找到 DATABASE_URL")
        sys.exit(1)

    bucket_name = env.get("OSS_BUCKET_NAME", "")
    endpoint    = env.get("OSS_ENDPOINT", "")
    base_url    = env.get("OSS_BASE_URL", "")

    if not bucket_name or not endpoint:
        print("❌ 未找到 OSS_BUCKET_NAME 或 OSS_ENDPOINT，请检查 .env")
        sys.exit(1)

    api_prefix = "/api/v1/oss"

    # ── 连接数据库 ────────────────────────
    try:
        import sqlalchemy as sa
    except ImportError:
        print("❌ 请先安装 sqlalchemy：pip install sqlalchemy")
        sys.exit(1)

    sync_url = to_sync_url(db_url)

    # MySQL 需要 pymysql
    if "mysql" in sync_url:
        try:
            import pymysql  # noqa: F401
        except ImportError:
            print("❌ MySQL 需要安装 pymysql：pip install pymysql")
            sys.exit(1)

    try:
        engine = sa.create_engine(sync_url)
        with engine.connect() as conn:
            conn.execute(sa.text("SELECT 1"))
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        sys.exit(1)

    # ── 打印摘要 ──────────────────────────
    mode_label = "🔴 实际执行" if args.apply else "🟡 预览模式（--apply 才会写入）"
    print(f"\n{'═'*62}")
    print(f"  绘本图片 URL 迁移脚本")
    print(f"  模式  : {mode_label}")
    print(f"  OSS   : {bucket_name}.{endpoint}")
    print(f"  新前缀: {api_prefix}/")
    print(f"{'═'*62}\n")

    # ── 遍历并处理 ───────────────────────
    with engine.begin() as conn:
        rows = conn.execute(
            sa.text("SELECT id, title, pages FROM storybooks WHERE pages IS NOT NULL")
        ).fetchall()

        total_books = 0
        total_pages = 0

        for row in rows:
            sb_id, title, pages_raw = row
            try:
                pages = json.loads(pages_raw) if isinstance(pages_raw, str) else (pages_raw or [])
            except Exception:
                continue
            if not isinstance(pages, list) or not pages:
                continue

            new_pages = []
            book_changed = False

            for page in pages:
                url = page.get("image_url", "")
                key = extract_key(url, bucket_name, endpoint, base_url)
                if key:
                    new_url = f"{api_prefix}/{key}"
                    print(f"  绘本 #{sb_id} 《{(title or '')[:28]}》")
                    print(f"    旧: {url}")
                    print(f"    新: {new_url}")
                    new_pages.append({**page, "image_url": new_url})
                    book_changed = True
                    total_pages += 1
                else:
                    new_pages.append(page)

            if book_changed:
                total_books += 1
                if args.apply:
                    conn.execute(
                        sa.text("UPDATE storybooks SET pages = :pages WHERE id = :id"),
                        {"pages": json.dumps(new_pages, ensure_ascii=False), "id": sb_id},
                    )

        # engine.begin() 在退出 with 块时自动 commit（apply 模式）
        # 预览模式不会写入任何内容

    # ── 结果汇总 ──────────────────────────
    print()
    if args.apply:
        print(f"✅ 迁移完成！更新了 {total_books} 个绘本，共 {total_pages} 个图片 URL")
    else:
        print(f"📋 预览完成：将更新 {total_books} 个绘本，共 {total_pages} 个图片 URL")
        print(f"   执行实际更新：python deploy/migrate_image_urls.py --apply\n")


if __name__ == "__main__":
    main()
