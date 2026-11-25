from pathlib import Path
import os
BASE_DIR=Path(__file__).resolve().parents[2]
SECRET_KEY=os.environ.get('DJANGO_SECRET_KEY') or (BASE_DIR/'local/secret.key').read_text().strip()
DEBUG=os.environ.get('DJANGO_DEBUG','1')=='1'
ALLOWED_HOSTS=['127.0.0.1','localhost','testserver']
INSTALLED_APPS=['django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','rest_framework','core']
MIDDLEWARE=['django.middleware.security.SecurityMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware']
ROOT_URLCONF='config.urls'
DATABASES={'default':{'ENGINE':'django.db.backends.postgresql','NAME':os.environ.get('MATH_DB_NAME','math_ai'),'USER':'math_ai','PASSWORD':os.environ.get('MATH_DB_PASSWORD') or (BASE_DIR/'local/db.password').read_text().strip(),'HOST':'127.0.0.1','PORT':'55432'}}
REST_FRAMEWORK={'DEFAULT_AUTHENTICATION_CLASSES':['rest_framework.authentication.SessionAuthentication'],'DEFAULT_PERMISSION_CLASSES':['rest_framework.permissions.IsAuthenticated']}
USE_TZ=True
TIME_ZONE='Asia/Shanghai'
DEFAULT_AUTO_FIELD='django.db.models.BigAutoField'
SESSION_COOKIE_HTTPONLY=True
CSRF_TRUSTED_ORIGINS=['http://127.0.0.1:5173','http://localhost:5173']
MEDIA_ROOT=Path(os.environ.get('MATH_MEDIA_ROOT', BASE_DIR/'local/uploads'))
DATA_UPLOAD_MAX_MEMORY_SIZE=12*1024*1024
FILE_UPLOAD_MAX_MEMORY_SIZE=10*1024*1024
FILE_UPLOAD_TEMP_DIR=os.environ.get('MATH_UPLOAD_TEMP_DIR', str(BASE_DIR/'local'))

TEMPLATES = [
    {'BACKEND': 'django.template.backends.django.DjangoTemplates', 'APP_DIRS': True},
]

PUBLIC_BASE_URL = os.environ.get('MATH_PUBLIC_BASE_URL', '').rstrip('/')
