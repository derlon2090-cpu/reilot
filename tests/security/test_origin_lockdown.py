"""No firewall writes; tests downloader validation and check-before-apply."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

# fcntl is Linux-only; these tests never execute main() or its file lock.
if sys.platform == 'win32':
    sys.modules.setdefault('fcntl', types.ModuleType('fcntl'))
spec = importlib.util.spec_from_file_location('origin_lockdown', Path(__file__).resolve().parents[2] / 'deploy/security/origin-lockdown.py')
origin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(origin)


class OriginValidation(unittest.TestCase):
    def response(self, text):
        context = MagicMock()
        context.__enter__.return_value.read.return_value = text.encode('ascii')
        return context

    def test_rejects_default_route_without_firewall_mutation(self):
        with patch.object(origin.urllib.request, 'urlopen', return_value=self.response('0.0.0.0/0\n' * 5)), patch.object(origin.subprocess, 'run') as run:
            with self.assertRaises(ValueError):
                origin.ranges(4)
            run.assert_not_called()

    def test_rejects_wrong_address_family(self):
        with patch.object(origin.urllib.request, 'urlopen', return_value=self.response('2606:4700::/32\n' * 5)):
            with self.assertRaises(ValueError):
                origin.ranges(4)

    def test_nft_check_failure_prevents_apply(self):
        with patch.object(origin.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'nft')) as run:
            with self.assertRaises(subprocess.CalledProcessError):
                origin.nft('invalid batch')
            self.assertEqual(run.call_count, 1)
            self.assertIn('-c', run.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
