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
                const medium = item.querySelector('p').textContent;
                
                openLightbox(imgSrc, imgAlt, title, medium);
            });
        });
    }
    
    // Initialize lightbox functionality
    function openLightbox(src, alt, title, medium) {
        // Create lightbox container
        const lightbox = document.createElement('div');
        lightbox.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center opacity-0 transition-opacity duration-300';
        lightbox.style.backdropFilter = 'blur(5px)';
        
        // Create lightbox content
        lightbox.innerHTML = `
            <div class="relative max-w-4xl mx-auto p-4 w-full">
                <button class="absolute top-4 right-4 text-white text-3xl hover:text-primary transition-colors z-10">&times;</button>
                <div class="relative">
                    <img src="${src}" alt="${alt}" class="max-h-[80vh] max-w-full mx-auto rounded-lg shadow-2xl">
                    <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-4 rounded-b-lg">
                        <h3 class="text-xl font-bold">${title}</h3>
                        <p class="text-gray-300">${medium}</p>
                    </div>
                </div>
            </div>
        `;
        
        // Add to body
        document.body.appendChild(lightbox);
        document.body.classList.add('overflow-hidden');
        
        // Fade in
        setTimeout(() => {
            lightbox.classList.add('opacity-100');
        }, 10);
        
        // Close on click
        const closeBtn = lightbox.querySelector('button');
        closeBtn.addEventListener('click', () => {
            lightbox.classList.remove('opacity-100');
            setTimeout(() => {
                document.body.removeChild(lightbox);
                document.body.classList.remove('overflow-hidden');
            }, 300);
        });
        
        // Close on escape key
        document.addEventListener('keydown', function escClose(e) {
            if (e.key === 'Escape') {
                closeBtn.click();
                document.removeEventListener('keydown', escClose);
            }
        });
        
        // Close on background click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeBtn.click();
            }
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
