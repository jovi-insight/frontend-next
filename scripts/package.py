"""Empacota somente código, assets e documentação; nunca inclui segredos locais."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
folders = ['app', 'components', 'lib', 'public', 'tests', 'scripts', 'docs']
files = ['README.md', 'INTEGRANTES.TXT', '.env.example', '.gitignore', '.vercelignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'eslint.config.mjs', 'postcss.config.mjs', 'generate-icons.js', 'SoftwareTotalExperienceSprint4.pdf']
paths = [root / name for name in files if (root / name).is_file()]
for name in folders:
    paths.extend(path for path in (root / name).rglob('*') if path.is_file() and not path.is_symlink() and '__pycache__' not in path.parts and not path.name.startswith('.'))
assert (root / 'INTEGRANTES.TXT').is_file()
assert (root / 'README.md').is_file()
destination = root / 'entrega' / 'insight-sprint4.zip'
destination.parent.mkdir(exist_ok=True)
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(set(paths)):
        if path.name.startswith('.env') and path.name != '.env.example':
            continue
        archive.write(path, Path('insight-sprint4') / path.relative_to(root))
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert 'insight-sprint4/INTEGRANTES.TXT' in archive.namelist()
    assert not any('/.env.local' in name or '/node_modules/' in name for name in archive.namelist())
print(f'{destination} ({destination.stat().st_size / 1024 / 1024:.1f} MB)')
