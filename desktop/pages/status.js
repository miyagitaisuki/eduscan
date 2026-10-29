const params = new URLSearchParams(location.search);
const offline = params.get('state') === 'offline';

document.getElementById('loading').hidden = offline;
document.getElementById('offline').hidden = !offline;
document.getElementById('server').textContent = params.get('server') || '';
document.getElementById('retry').addEventListener('click', () => window.eduscanDesktop.retry());
if (offline) document.getElementById('retry').focus();
