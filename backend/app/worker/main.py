import argparse
import asyncio

from app.worker.runner import parse_generation_task_types, run_worker


def main() -> None:
    parser = argparse.ArgumentParser(description="Run AIrchieve background workers.")
    parser.add_argument("--task-source", choices=["generation_task"], default="generation_task")
    parser.add_argument("--types", help="Comma-separated generation task types to consume.")
    args = parser.parse_args()

    task_types = None
    if args.types:
        task_types = parse_generation_task_types(value.strip() for value in args.types.split(",") if value.strip())
    asyncio.run(run_worker(task_types=task_types))


if __name__ == "__main__":
    main()
