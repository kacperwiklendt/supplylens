"""Build the self-contained offline demo from the production UI and fixtures."""
import base64
import json
from pathlib import Path

root = Path(__file__).resolve().parent
html = (root / 'web/index.html').read_text()
css = (root / 'web/style.css').read_text()
studio_css = (root / 'web/studio.css').read_text()
core = (root / 'web/core.js').read_text()
js = (root / 'web/app.js').read_text()
products = (root / 'web/products.js').read_text()
studio = (root / 'web/studio.js').read_text()
cases = json.dumps(json.loads((root / 'examples/cases.json').read_text())).replace('<', '\\u003c')
image = base64.b64encode((root / 'web/assets/editorial.png').read_bytes()).decode()
css = css.replace("url('/assets/editorial.png')", "url('data:image/png;base64," + image + "')")
html = html.replace('<link rel="stylesheet" href="/style.css">', '<style>' + css + '</style>')
html = html.replace('<link rel="stylesheet" href="/studio.css">', '<style>' + studio_css + '</style>')
for name in ('core', 'products', 'app', 'studio'):
    html = html.replace(f'<script defer src="/{name}.js"></script>', '')
html = html.replace('</body>', '<script>window.SUPPLYLENS_PREVIEW=' + cases + ';\n' + core + '\n' + products + '\n' + js + '\n' + studio + '</script></body>')
(root / 'preview.html').write_text(html)
print('Created preview.html — editable products, comparison, planner, revisions; no model requests.')
