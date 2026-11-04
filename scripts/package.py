"""Entrega conjunta: frontend na raiz + código do backend, sem segredos locais."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import os
import tempfile
import ast

root = Path(__file__).resolve().parent.parent
# No ZIP extraído o backend já está incluído; no checkout fica ao lado.
backend = Path(os.environ.get('INSIGHT_BACKEND_DIR', str(root / 'backend' if (root / 'backend').is_dir() else root.parent / 'backend')))
if not (backend / 'app/main.py').is_file():
    raise SystemExit('Backend ausente. Defina INSIGHT_BACKEND_DIR para a pasta do backend antes de empacotar.')

entries = {}
def add(path, name):
    if not path.is_file() or path.is_symlink():
        return
    entries[name] = path.read_bytes()

def tree(base, folder, prefix=''):
    for path in sorted((base / folder).rglob('*')):
        relative = path.relative_to(base)
        if any(part.startswith('.') or part in {'__pycache__', 'node_modules', 'venv', '.venv'} for part in relative.parts):
            continue
        if path.suffix in {'.pyc', '.pyo', '.pem', '.key'} or path.name in {'token.json', 'secrets-firebase.json', 'google-drive-credentials.json', 'oauth-credentials.json'}:
            continue
        add(path, prefix + relative.as_posix())

for folder in ['app', 'components', 'lib', 'public', 'tests', 'scripts', 'docs']:
    tree(root, folder)
for name in ['README.md', 'INTEGRANTES.TXT', 'CHECKLIST_ENTREGA.md', '.env.example', '.gitignore', '.vercelignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'eslint.config.mjs', 'postcss.config.mjs', 'generate-icons.js']:
    add(root / name, name)
for folder in ['app', 'models', 'tests', 'docs']:
    tree(backend, folder, 'backend/')
for name in ['requirements.txt', 'requirements-cli.txt', 'Dockerfile', '.dockerignore', '.gitignore', '.env.example', 'cli.py', 'auth_drive.py', 'documentacao.md']:
    add(backend / name, 'backend/' + name)
for path in backend.glob('*.sql'):
    add(path, 'backend/' + path.name)
add(backend / 'readme.md', 'backend/README.md')

required = ['README.md', 'INTEGRANTES.TXT', 'CHECKLIST_ENTREGA.md', '.env.example', 'package.json', 'package-lock.json', 'app/(public)/page.tsx', 'app/(private)/camera/page.tsx', 'app/(private)/layout.tsx', 'backend/app/main.py', 'backend/requirements.txt', 'backend/.env.example', 'backend/README.md', 'backend/models/libras_static_v1.pt']
for name in required:
    if name not in entries:
        raise SystemExit(f'Arquivo obrigatório ausente: {name}')

inventory = '# Inventário do ZIP — caminho e SHA-256\n' + ''.join(f'{hashlib.sha256(data).hexdigest()}  {name}\n' for name, data in sorted(entries.items()))
entries['ARQUIVOS_SHA256.txt'] = inventory.encode()
destination = root / 'entrega' / 'insight-sprint4.zip'
destination.parent.mkdir(exist_ok=True)
# Só substitui o ZIP anterior após validar a nova cópia extraída.
with tempfile.TemporaryDirectory(prefix='insight-entrega-') as temp:
    temp = Path(temp)
    candidate = temp / 'insight-sprint4.zip'
    with ZipFile(candidate, 'w', ZIP_DEFLATED) as archive:
        for name, data in sorted(entries.items()):
            archive.writestr(name, data)
    with ZipFile(candidate) as archive:
        assert archive.testzip() is None
        archive.extractall(temp / 'extraido')
    for name, data in entries.items():
        assert (temp / 'extraido' / name).read_bytes() == data, name
        assert not any(part in {'.git', 'node_modules', '.next', 'venv', '__pycache__'} for part in Path(name).parts), name
        assert not Path(name).name.startswith('.env') or Path(name).name == '.env.example', name
    for path in (temp / 'extraido/backend').rglob('*.py'):
        ast.parse(path.read_text(), filename=str(path))
    package = json.loads(entries['package.json'])
    lock = json.loads(entries['package-lock.json'])['packages']['']
    assert package['dependencies'] == lock['dependencies']
    assert package['devDependencies'] == lock['devDependencies']
    for value in ['professor@insight.com', 'Insight@2026', 'https://frontend-next-topaz-mu.vercel.app/#inicio', 'https://github.com/jovi-insight/frontend-next']:
        assert value in entries['README.md'].decode(), value
    destination.write_bytes(candidate.read_bytes())
print(f'{destination} ({destination.stat().st_size / 1024 / 1024:.1f} MB)')
print(f'{len(entries)} arquivos: frontend, backend, documentação e modelos. Extração, hashes, Python e lockfile validados.')
print('README.md e INTEGRANTES.TXT estão diretamente na raiz do ZIP.')
