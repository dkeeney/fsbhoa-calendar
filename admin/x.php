function handleFile(file) {
    if (!file || file.type !== 'image/svg+xml') {
        alert('Please drop a valid SVG file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        let content = e.target.result;

        // 1. Minimum cleanup: Remove XML headers only
        content = content.replace(/<\?xml.*\?>/gi, '');
        content = content.replace(/<!DOCTYPE.*?>/gi, '');

        // 2. Remove fixed width/height so the 24px CSS works
        content = content.replace(/<svg[^>]*>/i, (match) => {
            return match.replace(/(width|height)=["'][^"']*["']/gi, '');
        });

        // 3. Save exactly what you edited in Inkscape
        hiddenInput.value = content.trim();
        preview.innerHTML = content.trim();
        preview.style.display = 'block';

        // 4. Preview styling
        const pSvg = preview.querySelector('svg');
        if (pSvg) {
            pSvg.style.height = '60px';
            pSvg.style.width = 'auto';
            pSvg.style.fill = document.querySelector('input[name="cat_color"]').value;
        }
    };
    reader.readAsText(file);
}
