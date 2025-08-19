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
});

// Theme Toggle Functionality
function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // If theme was previously saved, use that theme
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
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
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;
            
            // Basic validation
            if (!name || !email || !message) {
                alert('Please fill out all fields');
                return;
            }
            
            // Simulate form submission
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerText;
            
            submitButton.disabled = true;
            submitButton.innerText = 'Sending...';
            
            // Simulate API call with timeout
            setTimeout(() => {
                alert('Thank you for your message! We will get back to you soon.');
                contactForm.reset();
                submitButton.disabled = false;
                submitButton.innerText = originalText;
            }, 1500);
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

// Gallery Load More Functionality
function initGalleryLoadMore() {
    const loadMoreBtn = document.getElementById('load-more');
    const galleryGrid = document.getElementById('gallery-grid');
    
    if (loadMoreBtn && galleryGrid) {
        // Sample gallery items to load more (in a real site, this would come from an API)
        const moreItems = [
            {
                title: 'Seascape',
                medium: 'Watercolor, 2023',
                image: 'seascape'
            },
            {
                title: 'Geometric Forms',
                medium: 'Digital art, 2024',
                image: 'geometric'
            },
            {
                title: 'Still Life Study',
                medium: 'Acrylic on canvas, 2023',
                image: 'still-life'
            }
        ];
        
        let loadCount = 0;
        
        loadMoreBtn.addEventListener('click', () => {
            // If we've loaded all items, disable the button
            if (loadCount >= 1) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.innerText = 'No More Artworks';
                loadMoreBtn.classList.add('opacity-50', 'cursor-not-allowed');
                return;
            }
            
            // Add new items to the gallery
            moreItems.forEach(item => {
                const galleryItem = document.createElement('div');
                galleryItem.className = 'gallery-item overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow opacity-0';
                galleryItem.innerHTML = `
                    <div class="h-64 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                        <span>${item.image}</span>
                    </div>
                    <div class="p-4">
                        <h3 class="font-bold text-lg">${item.title}</h3>
                        <p class="text-gray-500 dark:text-gray-400">${item.medium}</p>
                    </div>
                `;
                
                galleryGrid.appendChild(galleryItem);
                
                // Animate the new items
                setTimeout(() => {
                    galleryItem.classList.add('animate-fade-in-up');
                }, 100);
            });
            
            loadCount++;
        });
    }
}
