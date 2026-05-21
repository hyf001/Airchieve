class AiProviderError(RuntimeError):
    def __init__(self, message: str, *, error_code: str = "AI_PROVIDER_ERROR") -> None:
        super().__init__(message)
        self.error_code = error_code
