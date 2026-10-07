import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).parents[2] / "deploy" / "security" / "honeypot-intel-engine.py"
SPEC = importlib.util.spec_from_file_location("honeypot_intel_engine", MODULE_PATH)
ENGINE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ENGINE)


class HoneypotIntelEngineTest(unittest.TestCase):
    def test_classifies_only_allowlisted_threat_families(self):
        self.assertEqual(ENGINE.classify_path("//site/wp-includes/wlwmanifest.xml")[1], "framework")
        self.assertEqual(ENGINE.classify_path("/.env.production")[1], "environment")
        self.assertEqual(ENGINE.classify_path("/.git/config")[1], "repository")
        self.assertEqual(ENGINE.classify_path("/shell.php")[1], "php")
        self.assertEqual(ENGINE.classify_path("/credentials.json")[1], "credentials")
        self.assertIsNone(ENGINE.classify_path("/api/auth/login"))

    def test_rejects_nginx_syntax_and_traversal_injection(self):
        self.assertIsNone(ENGINE.classify_path('/.env";return 200;#'))
        self.assertIsNone(ENGINE.classify_path("/.git/../../api/health"))

    def test_renders_exact_match_444_rules(self):
        state = {"paths": {"/.env.production": {"family": "environment", "count": 2}}}
        rendered = ENGINE.render_config(state)
        self.assertIn('location = "/.env.production" {', rendered)
        self.assertIn("return 444;", rendered)
        self.assertNotIn("regex", rendered.lower())


if __name__ == "__main__":
    unittest.main()
