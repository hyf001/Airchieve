from app.model.generation_task import (
    GenerationTaskStatus,
    GenerationTaskType,
)


class TestGenerationTaskType:
    def test_all_task_types(self):
        expected = {"story", "storyboard", "character_image", "image", "audio", "lip_sync", "template_composite", "pdf_export"}
        actual = {t.value for t in GenerationTaskType}
        assert actual == expected

    def test_includes_character_image_in_enum(self):
        assert GenerationTaskType.CHARACTER_IMAGE.value == "character_image"


class TestGenerationTaskStatus:
    def test_all_statuses(self):
        expected = {"queued", "running", "succeeded", "failed", "canceled"}
        actual = {s.value for s in GenerationTaskStatus}
        assert actual == expected


class TestGenerationTaskProperties:
    def _make_task(self, **overrides):
        from app.model.generation_task import GenerationTask

        defaults = {
            "task_type": GenerationTaskType.STORY,
            "owner_type": "creation",
            "owner_id": 1,
            "status": GenerationTaskStatus.QUEUED,
            "progress_percent": 0,
            "retry_count": 0,
            "input_payload": {},
        }
        defaults.update(overrides)
        return GenerationTask(**defaults)

    def test_result_refs_returns_output_payload(self):
        task = self._make_task(output_payload={"url": "s3://x"})
        assert task.result_refs == {"url": "s3://x"}

    def test_result_refs_returns_none_when_no_output(self):
        task = self._make_task()
        assert task.result_refs is None

    def test_retryable_when_failed_and_under_limit(self):
        task = self._make_task(status=GenerationTaskStatus.FAILED, retry_count=0)
        assert task.retryable is True
        task2 = self._make_task(status=GenerationTaskStatus.FAILED, retry_count=2)
        assert task2.retryable is True

    def test_not_retryable_when_failed_and_at_limit(self):
        task = self._make_task(status=GenerationTaskStatus.FAILED, retry_count=3)
        assert task.retryable is False

    def test_not_retryable_when_not_failed(self):
        for status in (GenerationTaskStatus.QUEUED, GenerationTaskStatus.RUNNING, GenerationTaskStatus.SUCCEEDED):
            task = self._make_task(status=status, retry_count=0)
            assert task.retryable is False

    def test_not_retryable_when_over_limit(self):
        task = self._make_task(status=GenerationTaskStatus.FAILED, retry_count=5)
        assert task.retryable is False
