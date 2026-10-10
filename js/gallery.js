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
    const total = galleryImages.length;
    const wrap = lightbox.querySelector('.lb-image-wrap');
    let currentIndex = 0;
    let animating = false;
    let savedScrollY = 0;
    let lastDragAt = 0;

    const wrapIndex = (i) => (i + total) % total;

    // Show the cached thumbnail straight away, then swap in the full-size file
    // once it has downloaded, so navigating never flashes an empty frame.
    function show(index) {
        const img = galleryImages[index];
        const fullSrc = img.dataset.full || img.src;
        lbImage.src = img.currentSrc || img.src;
        if (fullSrc !== lbImage.src) {
            const full = new Image();
            full.onload = () => {
                if (currentIndex === index) lbImage.src = fullSrc;
            };
            full.src = fullSrc;
        }
        if (lbBg) lbBg.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
        lbImage.alt = img.alt;
        if (lbCounter) lbCounter.textContent = `${index + 1} / ${total}`;
        if (lbTitle)   lbTitle.textContent   = img.dataset.title  || '';
        if (lbMedium)  lbMedium.textContent  = img.dataset.medium || '';
        if (lbYear)    lbYear.textContent     = img.dataset.year   || '';
        if (lbDesc)    lbDesc.textContent     = img.dataset.desc   || '';
        currentIndex = index;
        // Warm the neighbours so the next swipe is instant.
        [wrapIndex(index + 1), wrapIndex(index - 1)].forEach((i) => {
            const n = new Image();
            n.src = galleryImages[i].dataset.full || galleryImages[i].src;
        });
    }

    // Freeze the page behind the lightbox. overflow:hidden alone doesn't stop
    // touch scrolling on iOS, so the body is pinned in place and restored after.
    function lockScroll() {
        savedScrollY = window.scrollY;
        const gap = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${savedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    }

    function unlockScroll() {
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.paddingRight = '';
        window.scrollTo({ top: savedScrollY, left: 0, behavior: 'instant' });
    }

    function open(index) {
        lbImage.style.transition = 'none';
        lbImage.style.transform = '';
        lbImage.style.opacity = '';
        show(index);
        lockScroll();
        lightbox.classList.add('active');
    }

    function close() {
        if (!lightbox.classList.contains('active')) return;
        lightbox.classList.remove('active');
        unlockScroll();
    }

    // Slide the current image off, swap in the neighbour, slide it in.
    // `from` is the current drag offset in px (0 for button/keyboard nav).
    function go(step, from = 0) {
        if (animating || total < 2) return;
        animating = true;
        const w = window.innerWidth;
        lbImage.style.transition = 'transform 0.2s ease-in, opacity 0.2s ease-in';
        lbImage.style.transform = `translateX(${-step * w * 0.5}px)`;
        lbImage.style.opacity = '0';
        setTimeout(() => {
            show(wrapIndex(currentIndex + step));
            lbImage.style.transition = 'none';
            lbImage.style.transform = `translateX(${step * w * 0.3}px)`;
            void lbImage.offsetWidth;
            lbImage.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease-out';
            lbImage.style.transform = '';
            lbImage.style.opacity = '1';
            setTimeout(() => { animating = false; }, 300);
        }, 200);
    }

    galleryImages.forEach((img, i) => img.addEventListener('click', () => open(i)));

    if (lbClose) lbClose.addEventListener('click', close);
    lbImage.addEventListener('click', () => {
        if (Date.now() - lastDragAt > 350) close();
    });
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lb-image-wrap')) close();
    });

    if (lbPrev) lbPrev.addEventListener('click', () => go(-1));
    if (lbNext) lbNext.addEventListener('click', () => go(1));

    // Swipe: the image follows the finger; release past a threshold (or with a
    // quick flick) to change artwork, otherwise it springs back. Vertical
    // movement never scrolls anything, and the info panel keeps its own scroll.
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let dx = 0;
    let axis = null;
    let tracking = false;

    wrap.addEventListener('touchstart', (e) => {
        if (animating || e.touches.length !== 1) { tracking = false; return; }
        tracking = true;
        axis = null;
        dx = 0;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startT = Date.now();
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
        if (!tracking) return;
        const mx = e.touches[0].clientX - startX;
        const my = e.touches[0].clientY - startY;
        if (!axis && Math.max(Math.abs(mx), Math.abs(my)) > 8) axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
        if (axis !== 'x') return;
        e.preventDefault();
        dx = mx;
        lbImage.style.transition = 'none';
        lbImage.style.transform = `translateX(${dx}px)`;
        lbImage.style.opacity = String(1 - Math.min(Math.abs(dx) / (window.innerWidth * 1.2), 0.5));
    }, { passive: false });

    const endSwipe = () => {
        if (!tracking) return;
        tracking = false;
        if (axis !== 'x') return;
        lastDragAt = Date.now();
        const velocity = Math.abs(dx) / Math.max(Date.now() - startT, 1);
        if (Math.abs(dx) > window.innerWidth * 0.18 || (velocity > 0.5 && Math.abs(dx) > 30)) {
            go(dx < 0 ? 1 : -1, dx);
        } else {
            lbImage.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease-out';
            lbImage.style.transform = '';
            lbImage.style.opacity = '1';
        }
    };
    wrap.addEventListener('touchend', endSwipe);
    wrap.addEventListener('touchcancel', endSwipe);

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape')     close();
        if (e.key === 'ArrowLeft')  go(-1);
        if (e.key === 'ArrowRight') go(1);
    });
}

function filterGallery(category) {
    document.querySelectorAll('.gallery-item').forEach(item => {
        const cat = item.dataset.category || '';
        item.style.display = (category === 'all' || cat === category) ? 'block' : 'none';
    });
}
