// Applies optional branding (name, accent color, logo) from /brand.json.
// Resolves window.brandReady with the brand object so app code can wait for it.
window.brandReady = (async () => {
    let brand = { name: '', color: '', logo: false };
    try {
        brand = await (await fetch('/brand.json')).json();
    } catch { /* branding is optional */ }

    const root = document.documentElement;
    if (/^#[0-9a-f]{6}$/i.test(brand.color)) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(brand.color.slice(i, i + 2), 16));
        const light = (0.299 * r + 0.587 * g + 0.114 * b) > 160;
        root.style.setProperty('--accent', brand.color);
        root.style.setProperty('--accent-text', light ? '#10131c' : '#ffffff');
    }
    if (brand.name) document.title = brand.name;
    for (const el of document.querySelectorAll('[data-brand-name]')) if (brand.name) el.textContent = brand.name;
    if (brand.logo) {
        for (const el of document.querySelectorAll('.logo')) {
            const img = document.createElement('img');
            img.src = '/brand-logo';
            img.alt = '';
            el.replaceChildren(img);
            el.classList.add('has-logo');
        }
    }
    return brand;
})();
