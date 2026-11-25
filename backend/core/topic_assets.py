from mimetypes import guess_type
from pathlib import Path
import re

from django.conf import settings
from django.http import FileResponse, Http404
from django.views.decorators.gzip import gzip_page
from django.views.decorators.http import require_safe

KATEX = settings.BASE_DIR / 'frontend/node_modules/katex/dist'
FILES = {
    'katex.min.css': KATEX / 'katex.min.css',
    'katex.min.js': KATEX / 'katex.min.js',
    'auto-render.min.js': KATEX / 'contrib/auto-render.min.js',
    'render-math.js': Path(__file__).parent / 'static/core/render-math.js',
}
FONT = re.compile(r'fonts/KaTeX_[A-Za-z0-9-]+\.(?:woff2?|ttf)')


@require_safe
@gzip_page
def topic_asset(request, asset):
    file = FILES.get(asset)
    if file is None and FONT.fullmatch(asset):
        file = KATEX / asset
    if file is None or not file.is_file():
        raise Http404
    response = FileResponse(file.open('rb'), content_type=guess_type(file.name)[0] or 'application/octet-stream')
    response['Cache-Control'] = 'public, max-age=3600'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
