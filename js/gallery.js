/**
 * Gallery and Lightbox functionality for Melbourne Art Studio
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof AOS !== 'undefined') {
        AOS.init({ duration: 800, easing: 'ease-in-out', once: true, mirror: false });
    }
    initLightbox();
});

function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    const lbImage   = document.getElementById('lightbox-image');
    const lbBg      = document.getElementById('lightbox-bg');
    const lbClose   = document.getElementById('lightbox-close');
    const lbPrev    = document.getElementById('lightbox-prev');
    const lbNext    = document.getElementById('lightbox-next');
    const lbCounter = document.getElementById('lightbox-counter');
    const lbTitle   = document.getElementById('lightbox-title');
    const lbMedium  = document.getElementById('lightbox-medium');
    const lbYear    = document.getElementById('lightbox-year');
    const lbDesc    = document.getElementById('lightbox-desc');

    const galleryImages = Array.from(document.querySelectorAll('.gallery-item img'));
    let currentIndex = 0;

    function show(index) {
        const img = galleryImages[index];
        const fullSrc = img.dataset.full || img.src;
        lbImage.src = fullSrc;
        if (lbBg) lbBg.style.backgroundImage = `url("${fullSrc}")`;
        lbImage.alt = img.alt;
        if (lbCounter) lbCounter.textContent = `${index + 1} / ${galleryImages.length}`;
        if (lbTitle)   lbTitle.textContent   = img.dataset.title  || '';
        if (lbMedium)  lbMedium.textContent  = img.dataset.medium || '';
        if (lbYear)    lbYear.textContent     = img.dataset.year   || '';
        if (lbDesc)    lbDesc.textContent     = img.dataset.desc   || '';
        currentIndex = index;
    }

    function open(index) {
        show(index);
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    galleryImages.forEach((img, i) => img.addEventListener('click', () => open(i)));

    if (lbClose) lbClose.addEventListener('click', close);
    // Close when clicking the image area background (not nav buttons or image itself)
    document.getElementById('lightbox-image')?.addEventListener('click', close);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lb-image-wrap')) close();
    });

    if (lbPrev) lbPrev.addEventListener('click', () => show((currentIndex - 1 + galleryImages.length) % galleryImages.length));
    if (lbNext) lbNext.addEventListener('click', () => show((currentIndex + 1) % galleryImages.length));

    // Touch swipe support
    let touchStartX = 0;
    lightbox.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].screenX - touchStartX;
        if (Math.abs(dx) > 50) {
            dx < 0
                ? show((currentIndex + 1) % galleryImages.length)
                : show((currentIndex - 1 + galleryImages.length) % galleryImages.length);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape')     close();
        if (e.key === 'ArrowLeft')  show((currentIndex - 1 + galleryImages.length) % galleryImages.length);
        if (e.key === 'ArrowRight') show((currentIndex + 1) % galleryImages.length);
    });
}

function filterGallery(category) {
    document.querySelectorAll('.gallery-item').forEach(item => {
        const cat = item.dataset.category || '';
        item.style.display = (category === 'all' || cat === category) ? 'block' : 'none';
    });
}
