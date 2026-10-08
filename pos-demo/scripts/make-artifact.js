// Wraps the artifact build into one HTML page for the hosted demo link.
import fs from 'node:fs';

const js = fs.readFileSync('dist-artifact/app.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('dist-artifact/app.css', 'utf8');

const html = `<title>Cafe Adullam x Amoa POS</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
fs.writeFileSync('dist-artifact/tasa-pos.html', html);
console.log('wrote dist-artifact/tasa-pos.html', Math.round(html.length / 1024), 'KB');
