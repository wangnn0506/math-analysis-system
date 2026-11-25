"""Run browser tests with an isolated PostgreSQL database and upload directory."""
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from uuid import uuid4

import django
from django.core.management import call_command
from django.db import connections
from django.test.runner import DiscoverRunner

ROOT = Path(__file__).resolve().parents[1]


def main():
    sys.path.insert(0, str(ROOT / 'backend'))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()

    database = f'browser_{uuid4().hex}'
    connections['default'].settings_dict['TEST']['NAME'] = database
    runner = DiscoverRunner()
    old_config = runner.setup_databases()
    try:
        call_command('seed_demo')
        with TemporaryDirectory() as temp:
            env = {
                **os.environ,
                'MATH_DB_NAME': database,
                'MATH_MEDIA_ROOT': str(Path(temp) / 'uploads'),
                'MATH_UPLOAD_TEMP_DIR': temp,
                'MATH_E2E_PYTHON': sys.executable,
                'MATH_BACKEND_ORIGIN': 'http://127.0.0.1:8001',
                'DJANGO_DEBUG': '0',
                'OPENAI_API_KEY': '',
                'MATH_AI_MODEL': '',
                'MATH_PUBLIC_BASE_URL': '',
            }
            return subprocess.call(['pnpm', '--dir', 'frontend', 'test:e2e'], cwd=ROOT, env=env)
    finally:
        runner.teardown_databases(old_config)


if __name__ == '__main__':
    sys.exit(main())
