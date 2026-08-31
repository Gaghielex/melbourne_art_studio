// Main JavaScript for Melbourne Art Studio Website

document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme from local storage or system preference
    initTheme();
    
    // Mobile menu toggle
    initMobileMenu();
    
    // Initialize AOS-like animations
    initAnimations();
    
    // Initialize contact form
    initContactForm();
    
    // Smooth scroll for navigation links
    initSmoothScroll();
    
    // Gallery load more functionality
    initGalleryLoadMore();
    
    // Read More functionality
    initReadMoreButtons();
});

// Theme Toggle Functionality
function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    // Theme is already set by inline script in head, this just sets up the toggle button
    
    // Toggle theme on button click
    themeToggleBtn.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
    });
}

// Mobile Menu Functionality
function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
    
    // Close mobile menu when clicking on a link
    const mobileMenuLinks = mobileMenu.querySelectorAll('a');
    mobileMenuLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
        });
    });
}

// AOS-like Animation Initialization
function initAnimations() {
    // Get all elements with data-aos attribute
    const animatedElements = document.querySelectorAll('[data-aos]');
    
    // Create an intersection observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('aos-animate');
            } else {
                // Uncomment to remove animation when element is not visible
                // entry.target.classList.remove('aos-animate');
            }
        });
    }, {
        threshold: 0.1  // Trigger when at least 10% of the element is visible
    });
    
    // Observe each animated element
    animatedElements.forEach(element => {
        observer.observe(element);
    });
}

// Contact Form Handling
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        // Add loading state to the form submit button
        contactForm.addEventListener('submit', (e) => {
            // Don't prevent default - let the form submit to Formspree
            
            // Update the button state to indicate submission
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalHTML = submitButton.innerHTML;
            
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i><span>Sending...</span>';
            
            // After successful submission, Formspree will redirect back or show their success page
            // Add a timeout to reset the button if submission takes too long
            setTimeout(() => {
                submitButton.disabled = false;
                submitButton.innerHTML = originalHTML;
            }, 10000); // 10 seconds timeout
        });
    }
}

// Smooth Scroll for Navigation Links
function initSmoothScroll() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Account for fixed header
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Gallery Functionality
function initGalleryLoadMore() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const viewGalleryBtn = document.querySelector('.gallery-section button');
    
    if (galleryItems.length > 0) {
        // Add click event to each gallery item for lightbox effect
        galleryItems.forEach(item => {
            item.addEventListener('click', () => {
                const imgSrc = item.querySelector('img').getAttribute('src');
                const imgAlt = item.querySelector('img').getAttribute('alt');
                const title = item.querySelector('h3').textContent;
                const pText = item.querySelector('p').textContent;
                const year = item.dataset.year || '';
                const desc = item.dataset.desc || '';
                const medium = year ? pText.replace(/,\s*\d{4}$/, '').trim() : pText.trim();

                openLightbox(imgSrc, imgAlt, title, medium, year, desc);
            });
        });
    }
    
    // Initialize lightbox functionality
    function openLightbox(src, alt, title, medium, year, desc) {
        const lightbox = document.createElement('div');
        lightbox.style.cssText = 'position:fixed;inset:0;background:#0a0a10;display:flex;flex-direction:column;z-index:1000;opacity:0;transition:opacity 0.25s ease;';
        const isMobile = window.innerWidth <= 768;

        lightbox.innerHTML = `
            <button id="hlb-close" aria-label="Close" style="position:absolute;top:12px;right:16px;width:38px;height:38px;border:1px solid rgba(255,255,255,0.3);border-radius:50%;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;"><i class="fas fa-times"></i></button>
            <div id="hlb-wrap" style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0;">
                <div style="position:absolute;top:0;left:0;right:0;height:${isMobile ? '160px' : '120px'};background:linear-gradient(to bottom,${isMobile ? 'rgba(10,10,16,0.6) 0%,rgba(10,10,16,0.3) 50%' : 'rgba(10,10,16,0.2) 0%'},transparent 100%);z-index:2;pointer-events:none;"></div>
                <div style="position:absolute;bottom:0;left:0;right:0;height:160px;background:linear-gradient(to bottom,transparent 0%,rgba(19,19,28,0.6) 65%,#13131c 100%);z-index:2;pointer-events:none;"></div>
                <div style="position:absolute;inset:-40px;background-image:url('${src}');background-size:cover;background-position:center;filter:blur(${isMobile ? '30px' : '40px'}) brightness(${isMobile ? '0.9' : '0.6'}) saturate(${isMobile ? '1.5' : '1.4'});z-index:0;"></div>
                <img src="${src}" alt="${alt}" style="position:relative;max-width:100%;max-height:calc(100vh - 160px);object-fit:contain;z-index:1;border-radius:2px;box-shadow:0 12px 60px rgba(0,0,0,0.6);">
            </div>
            <div style="flex-shrink:0;overflow-y:auto;padding:22px 28px 32px;background:#13131c;border-top:1px solid rgba(255,255,255,0.07);">
                <div style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.1);border-radius:999px;padding:3px 12px;">${medium}</span>
                    ${year ? `<span style="font-size:12px;color:rgba(255,255,255,0.4);">${year}</span>` : ''}
                </div>
                <h3 style="font-family:'Playfair Display',serif;font-size:clamp(1.4rem,3vw,2rem);color:#fff;font-weight:700;margin:0 0 8px;">${title}</h3>
                ${desc ? `<p style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;margin:0;">${desc}</p>` : ''}
            </div>
        `;

        document.body.appendChild(lightbox);
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // Zoom/pan on desktop
        if (!isMobile) {
            const zoomImg = lightbox.querySelector('img');
            const zoomWrap = lightbox.querySelector('#hlb-wrap');
            let zoomed = false;
            const SCALE = 2;

            zoomImg.style.cursor = 'zoom-in';

            zoomImg.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!zoomed) {
                    zoomImg.style.transition = 'transform 0.2s ease';
                    zoomImg.style.transformOrigin = 'center center';
                    zoomImg.style.transform = `scale(${SCALE})`;
                    zoomImg.style.zIndex = '20';
                    zoomWrap.style.overflow = 'visible';
                    zoomImg.style.cursor = 'grab';
                    zoomed = true;
                } else {
                    zoomImg.style.transition = 'transform 0.2s ease';
                    zoomImg.style.transform = 'scale(1) translate(0px, 0px)';
                    zoomImg.style.zIndex = '1';
                    zoomWrap.style.overflow = 'hidden';
                    zoomImg.style.cursor = 'zoom-in';
                    zoomed = false;
                }
            });

            zoomWrap.addEventListener('mousemove', (e) => {
                if (!zoomed) return;
                const r = zoomWrap.getBoundingClientRect();
                const maxX = Math.max(0, (zoomImg.offsetWidth * SCALE - r.width) / 2);
                const maxY = Math.max(0, (zoomImg.offsetHeight * SCALE - r.height) / 2);
                const relX = (e.clientX - r.left - r.width / 2) / (r.width / 2);
                const relY = (e.clientY - r.top - r.height / 2) / (r.height / 2);
                const panX = Math.max(-maxX, Math.min(maxX, relX * maxX));
                const panY = Math.max(-maxY, Math.min(maxY, relY * maxY));
                zoomImg.style.transition = 'none';
                zoomImg.style.transform = `scale(${SCALE}) translate(${panX / SCALE}px, ${panY / SCALE}px)`;
                zoomImg.style.cursor = 'grabbing';
            });

            zoomWrap.addEventListener('mouseleave', () => {
                if (zoomed) zoomImg.style.cursor = 'grab';
            });
        }

        setTimeout(() => { lightbox.style.opacity = '1'; }, 10);

        function closeLightbox() {
            lightbox.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(lightbox);
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
            }, 250);
        }

        lightbox.querySelector('#hlb-close').addEventListener('click', closeLightbox);
        lightbox.querySelector('#hlb-wrap').addEventListener('click', (e) => {
            if (e.target === lightbox.querySelector('#hlb-wrap')) closeLightbox();
        });

        document.addEventListener('keydown', function escClose(e) {
            if (e.key === 'Escape') { closeLightbox(); document.removeEventListener('keydown', escClose); }
        });
    }
    
    // View Full Gallery button effect
    const fullGalleryBtn = document.querySelector('[href="#"]'); // Update with actual gallery page link
    if (fullGalleryBtn) {
        fullGalleryBtn.addEventListener('mousemove', (e) => {
            const rect = fullGalleryBtn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            fullGalleryBtn.style.setProperty('--x-pos', `${x}px`);
            fullGalleryBtn.style.setProperty('--y-pos', `${y}px`);
        });
    }
}

// Read More Button Functionality
function initReadMoreButtons() {
    const readMoreBtns = document.querySelectorAll('.read-more-btn');
    
    readMoreBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('data-target');
            if (!targetId) return;
            
            const expandableContent = document.getElementById(targetId);
            if (!expandableContent) return;
            
            // Toggle visibility
            const isExpanded = expandableContent.classList.contains('max-h-screen');
            
            if (isExpanded) {
                // Collapse
                expandableContent.classList.remove('max-h-screen');
                expandableContent.classList.add('max-h-0');
                this.innerHTML = 'Read More <i class="fas fa-chevron-down ml-2"></i>';
            } else {
                // Expand
                expandableContent.classList.remove('max-h-0');
                expandableContent.classList.add('max-h-screen');
                this.innerHTML = 'Read Less <i class="fas fa-chevron-up ml-2"></i>';
            }
        });
    });
}
