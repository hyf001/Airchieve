"""
数据迁移脚本：将 Storybook.pages JSON 拆分到独立的 pages 表

迁移前：
  storybooks 表中 pages 字段存储 JSON 数组，每个元素包含 text, image_url, page_type, storyboard

迁移后：
  pages 表独立存储每个页面，通过 storybook_id + page_index 关联

使用方式：
  cd /path/to/AIrchieve
  python scripts/migrate_pages.py

可选参数：
  --dry-run       只打印迁移计划，不实际执行
  --force         跳过确认提示
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

# 将项目根目录加入 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text as sa_text


async def run_migration(dry_run: bool = False, force: bool = False):
    """执行数据迁移"""
    from app.db.session import engine
    from app.models.page import Page, Base as PageBase

    # ── 阶段 1：确保 pages 表已创建 ──
    print("=" * 60)
    print("阶段 1：创建 pages 表（如不存在）")
    print("=" * 60)

    async with engine.begin() as conn:
        # 只创建 pages 表相关的表结构
        await conn.run_sync(PageBase.metadata.create_all)
        # 检查表是否已存在
        result = await conn.execute(sa_text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='pages'"
        ))
        table_exists = result.fetchone() is not None
        print(f"  pages 表{'已存在' if table_exists else '创建成功'}")

    # ── 阶段 2：扫描现有数据 ──
    print()
    print("=" * 60)
    print("阶段 2：扫描 storybooks 表中的 pages 数据")
    print("=" * 60)

    async with engine.begin() as conn:
        # 统计需要迁移的数据
        result = await conn.execute(sa_text(
            "SELECT COUNT(*) FROM storybooks WHERE pages IS NOT NULL AND pages != '[]'"
        ))
        total_storybooks = result.scalar()

        result = await conn.execute(sa_text(
            "SELECT COUNT(*) FROM storybooks WHERE pages IS NULL OR pages = '[]'"
        ))
        empty_storybooks = result.scalar()

        result = await conn.execute(sa_text(
            "SELECT COUNT(*) FROM pages"
        ))
        existing_pages = result.scalar()

        print(f"  有页面数据的 storybooks: {total_storybooks}")
        print(f"  无页面数据的 storybooks: {empty_storybooks}")
        print(f"  pages 表已有记录: {existing_pages}")

        if total_storybooks == 0:
            print("\n  没有需要迁移的数据，退出。")
            return

        # 查询所有需要迁移的 storybooks
        result = await conn.execute(sa_text(
            "SELECT id, title, pages FROM storybooks "
            "WHERE pages IS NOT NULL AND pages != '[]' "
            "ORDER BY id"
        ))
        storybooks = result.fetchall()

    # 解析并统计
    migration_plan = []
    total_pages = 0
    skipped_storybooks = []
    error_storybooks = []

    for sb_id, sb_title, pages_json in storybooks:
        try:
            pages = json.loads(pages_json)
        except (json.JSONDecodeError, TypeError):
            error_storybooks.append((sb_id, sb_title, "JSON 解析失败"))
            continue

        if not isinstance(pages, list) or len(pages) == 0:
            skipped_storybooks.append((sb_id, sb_title, "空数组或非列表"))
            continue

        page_count = len(pages)
        total_pages += page_count
        migration_plan.append((sb_id, sb_title, pages))

    print(f"\n  计划迁移 {len(migration_plan)} 个绘本，共 {total_pages} 个页面")

    if error_storybooks:
        print(f"\n  ⚠ 解析失败的 storybooks ({len(error_storybooks)}):")
        for sb_id, sb_title, reason in error_storybooks:
            print(f"    id={sb_id} \"{sb_title}\" - {reason}")

    if skipped_storybooks:
        print(f"\n  ⚠ 跳过的 storybooks ({len(skipped_storybooks)}):")
        for sb_id, sb_title, reason in skipped_storybooks:
            print(f"    id={sb_id} \"{sb_title}\" - {reason}")

    # ── 显示迁移计划摘要 ──
    print()
    print("=" * 60)
    print("迁移计划摘要（前 5 个）")
    print("=" * 60)
    for sb_id, sb_title, pages in migration_plan[:5]:
        print(f"  storybook id={sb_id}: \"{sb_title}\" -> {len(pages)} pages")
    if len(migration_plan) > 5:
        print(f"  ... 还有 {len(migration_plan) - 5} 个绘本")

    if dry_run:
        print()
        print("=" * 60)
        print("DRY RUN 模式 - 不执行实际迁移")
        print("=" * 60)
        return

    # ── 阶段 3：确认 ──
    if not force:
        print()
        answer = input("确认执行迁移？(yes/no): ").strip().lower()
        if answer != "yes":
            print("已取消迁移。")
            return

    # ── 阶段 4：执行迁移 ──
    print()
    print("=" * 60)
    print("阶段 3：执行数据迁移")
    print("=" * 60)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    migrated_storybooks = 0
    migrated_pages = 0
    duplicate_skipped = 0

    async with engine.begin() as conn:
        for sb_id, sb_title, pages in migration_plan:
            # 检查该 storybook 是否已有迁移数据
            result = await conn.execute(sa_text(
                "SELECT COUNT(*) FROM pages WHERE storybook_id = :sid"
            ), {"sid": sb_id})
            already_exists = result.scalar()

            if already_exists > 0:
                duplicate_skipped += 1
                print(f"  跳过 id={sb_id}（pages 表已有 {already_exists} 条记录）")
                continue

            # 插入页面记录
            for page_index, page_data in enumerate(pages):
                if not isinstance(page_data, dict):
                    continue

                image_url = page_data.get("image_url", "")
                text = page_data.get("text", "")
                page_type = page_data.get("page_type", "content")
                storyboard = page_data.get("storyboard")

                if not image_url:
                    # 没有 image_url 的页面也要迁移，但记录警告
                    print(f"    ⚠ storybook id={sb_id} page {page_index}: 无 image_url")

                await conn.execute(sa_text(
                    """INSERT INTO pages
                       (storybook_id, page_index, image_url, text, page_type, storyboard, created_at, updated_at)
                       VALUES
                       (:storybook_id, :page_index, :image_url, :text, :page_type, :storyboard, :now, :now)
                    """
                ), {
                    "storybook_id": sb_id,
                    "page_index": page_index,
                    "image_url": image_url,
                    "text": text,
                    "page_type": page_type,
                    "storyboard": json.dumps(storyboard, ensure_ascii=False) if storyboard else None,
                    "now": now,
                })

            migrated_pages += len(pages)
            migrated_storybooks += 1

            if migrated_storybooks % 10 == 0:
                print(f"  已迁移 {migrated_storybooks}/{len(migration_plan)} 个绘本...")

    # ── 阶段 5：验证 ──
    print()
    print("=" * 60)
    print("阶段 4：验证迁移结果")
    print("=" * 60)

    async with engine.begin() as conn:
        result = await conn.execute(sa_text("SELECT COUNT(*) FROM pages"))
        final_page_count = result.scalar()

        result = await conn.execute(sa_text(
            "SELECT COUNT(DISTINCT storybook_id) FROM pages"
        ))
        final_storybook_count = result.scalar()

        # 抽样验证：对比 JSON 数据和 pages 表数据
        print(f"  pages 表总记录数: {final_page_count}")
        print(f"  已迁移的 storybooks: {final_storybook_count}")

        # 验证几个样本
        print("\n  抽样验证（前 3 个）:")
        for sb_id, sb_title, pages in migration_plan[:3]:
            result = await conn.execute(sa_text(
                "SELECT COUNT(*) FROM pages WHERE storybook_id = :sid"
            ), {"sid": sb_id})
            db_page_count = result.scalar()
            json_page_count = len(pages)
            status = "✓" if db_page_count == json_page_count else "✗ 不匹配！"
            print(f"    storybook id={sb_id}: JSON {json_page_count} pages, DB {db_page_count} pages {status}")

    # ── 迁移报告 ──
    print()
    print("=" * 60)
    print("迁移完成！")
    print("=" * 60)
    print(f"  迁移绘本数: {migrated_storybooks}")
    print(f"  迁移页面数: {migrated_pages}")
    print(f"  跳过（已有数据）: {duplicate_skipped}")
    print(f"  解析失败: {len(error_storybooks)}")
    print(f"  pages 表总记录: {final_page_count}")
    print()
    print("  注意：storybooks.pages 字段已保留，可用于回滚验证。")
    print("  确认新接口稳定后，可删除该字段。")


def main():
    parser = argparse.ArgumentParser(description="将 Storybook.pages JSON 迁移到 pages 表")
    parser.add_argument("--dry-run", action="store_true", help="只打印迁移计划，不实际执行")
    parser.add_argument("--force", action="store_true", help="跳过确认提示")
    args = parser.parse_args()

    import asyncio
    asyncio.run(run_migration(dry_run=args.dry_run, force=args.force))


if __name__ == "__main__":
    main()
