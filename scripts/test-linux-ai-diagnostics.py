import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location("diagnose", Path(__file__).with_name("diagnose-linux-ai.py"))
diagnose = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnose)


class DiagnosticsTest(unittest.TestCase):
    def test_provider_error_retains_status_and_known_parameter_without_private_text(self):
        facts = diagnose.summarize_message("Caused by: com.openai.errors.BadRequestException: 400: "
            "Unsupported parameter: 'reasoning_effort'. Private: test-only-secret, test-only-chat")
        self.assertEqual(facts, ["provider_exception=BadRequestException status=400", "reason=unsupported_parameter parameter=reasoning_effort"])

    def test_authentication_error_never_echoes_key(self):
        self.assertEqual(diagnose.summarize_message("com.openai.errors.AuthenticationException: 401: Incorrect API key provided: test-only-secret"),
            ["provider_exception=AuthenticationException status=401", "reason=invalid_api_key parameter=unknown"])

    def test_unknown_metadata_and_messages_are_never_rendered(self):
        self.assertEqual(diagnose.summarize_message("test-only-private\ncode=test-only-secret param=test-only-secret"), [])
        self.assertEqual(diagnose.summarize_message("com.openai.errors.UnknownPrivateClass: 400: test-only-secret"), [])

    def test_known_stack_location_has_no_exception_message(self):
        self.assertEqual(diagnose.summarize_message("java.lang.NullPointerException: test-only-private\n"
            " at de.forgeflow.ai.ProjectTools$Session.read(ProjectTools.java:97)"),
            ["runtime_exception=NullPointerException", "location=ProjectTools.java:97"])

    def test_new_diagnostic_only_exposes_closed_phase_and_category(self):
        self.assertEqual(diagnose.summarize_message("AI diagnostic phase=final_answer category=provider status=400 code=test-only-secret"),
            ["phase=final_answer category=provider", "status=400"])


if __name__ == "__main__":
    unittest.main()
