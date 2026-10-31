document.getElementById('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('error');
    error.textContent = '';
    const base = location.pathname.replace(/\/+$/, '');
    const res = await fetch(`${base}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: document.getElementById('password').value }),
    });
    if (res.ok) location.reload();
    else error.textContent = (await res.json().catch(() => ({}))).error || 'Could not unlock';
});
