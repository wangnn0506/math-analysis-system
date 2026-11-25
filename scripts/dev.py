"""Start only this project's local services; Ctrl+C stops the owned web processes."""
from pathlib import Path
import subprocess, socket, os, signal, sys
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
NODE=Path(os.environ.get('MATH_NODE','/Users/wangnn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'))
PG=ROOT/'local/postgres/native/bin/pg_ctl'
def occupied(port):
    with socket.socket() as s:return s.connect_ex(('127.0.0.1',port))==0
if occupied(8000) or occupied(5173):
    sys.exit('本地 Web 端口已占用。如本项目已启动，请打开 http://127.0.0.1:5173/；否则先关闭占用端口的程序。')
if not occupied(55432):
    subprocess.run([str(PG),'-D',str(ROOT/'local/pgdata'),'-l',str(ROOT/'local/postgres.log'),'-o',f'-h 127.0.0.1 -p 55432 -k {ROOT}/local','start'],check=True)
env={**os.environ,'PATH':str(NODE.parent)+os.pathsep+os.environ.get('PATH','')}
processes=[]
def stop(*_):
    for p in processes:
        if p.poll() is None:p.terminate()
    for p in processes:
        try:p.wait(timeout=8)
        except subprocess.TimeoutExpired:p.kill();p.wait()
    sys.exit(0)
signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)
try:
    processes.append(subprocess.Popen([str(ROOT/'.venv/bin/python'),'backend/manage.py','runserver','127.0.0.1:8000','--noreload'],env=env))
    processes.append(subprocess.Popen([str(NODE),'node_modules/vite/bin/vite.js','--host','127.0.0.1'],cwd=ROOT/'frontend',env=env))
    print('打开 http://127.0.0.1:5173/ 。按 Ctrl+C 关闭网页服务；数据库与数据会保留。',flush=True)
    while True:
        import time
        if any(p.poll() is not None for p in processes):stop()
        time.sleep(1)
finally:
    for p in processes:
        if p.poll() is None:p.terminate()
