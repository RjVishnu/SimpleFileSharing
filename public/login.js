document.getElementById('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('error');
    error.textContent = '';
    const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: document.getElementById('password').value }),
    });
    if (res.ok) location.href = '/';
    else error.textContent = (await res.json().catch(() => ({}))).error || 'Login failed';
});
