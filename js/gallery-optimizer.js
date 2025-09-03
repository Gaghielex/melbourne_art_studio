/**
 * Gallery Image Optimizer for Melbourne Art Studio
 * Uses Cloudinary to serve properly sized images from GitHub Pages
 */
document.addEventListener('DOMContentLoaded', function() {
  // Exit if not on a gallery page
  const galleryContainer = document.querySelector('.masonry-grid') || document.querySelector('.masonry-gallery');
  if (!galleryContainer) return;
  
  // Your GitHub Pages URL
  const baseUrl = 'https://gaghielex.github.io/melbourne_art_studio';
  
  // Your Cloudinary cloud name
  const cloudName = 'dggsqryu1';
  
  // Map of problematic images with their direct Cloudinary URLs
  // These are direct URLs to your manually uploaded images in Cloudinary
  const directCloudinaryImages = {
    'assets/images/Digital Illustrations/Celebrations_in_Japan_A3.png': 'https://res.cloudinary.com/dggsqryu1/image/upload/v1693823775/celebrations-japan',
    'assets/images/Digital Illustrations/Digital-koi.png': 'https://res.cloudinary.com/dggsqryu1/image/upload/v1693823775/digital-koi',
    'assets/images/Digital Illustrations/Anime_Mashup.png': 'https://res.cloudinary.com/dggsqryu1/image/upload/v1693823775/anime-mashup'
  };
  
  // Track loading status for better UX
  let totalImages = 0;
  let loadedImages = 0;
  
  // Add loading class to gallery
  galleryContainer.classList.add('loading');
  
  // Process all gallery images
  const galleryImages = galleryContainer.querySelectorAll('img');
  totalImages = galleryImages.length;
  
  galleryImages.forEach(img => {
    // Get the original image path (relative to project root)
    const originalSrc = img.getAttribute('src');
    
    // Skip if already processed
    if (originalSrc.includes('res.cloudinary.com')) return;
    
    // Store original src for fallback
    img.setAttribute('data-original-src', originalSrc);
    
    // Variables for different image sizes
    let smallImage, mediumImage, largeImage;
    
    // Check if this is one of our problematic images that needs direct URLs
    if (directCloudinaryImages[originalSrc]) {
      console.log('Using direct Cloudinary URL for:', originalSrc);
      
      // Use the direct URL from Cloudinary upload
      const directUrl = directCloudinaryImages[originalSrc];
      
      // Create responsive versions with Cloudinary transformations
      smallImage = `${directUrl}/w_400,q_auto,f_auto`;
      mediumImage = `${directUrl}/w_800,q_auto,f_auto`;
      largeImage = `${directUrl}/w_1600,q_auto,f_auto`;
    } else {
      // Standard approach for other images
      // Create the absolute URL to the image on GitHub Pages
      const fullImagePath = originalSrc.startsWith('http') 
        ? originalSrc 
        : `${baseUrl}/${originalSrc}`;
      
      // Create Cloudinary URLs for different sizes
      const cloudinaryBase = `https://res.cloudinary.com/${cloudName}/image/fetch`;
      
      // Create optimized versions with quality and format auto-detection
      smallImage = `${cloudinaryBase}/w_400,q_auto,f_auto/${fullImagePath}`;
      mediumImage = `${cloudinaryBase}/w_800,q_auto,f_auto/${fullImagePath}`;
      largeImage = `${cloudinaryBase}/w_1600,q_auto,f_auto/${fullImagePath}`;
    }
    
    // Update the image with responsive sources
    img.setAttribute('src', smallImage);
    img.setAttribute('srcset', `
      ${smallImage} 400w,
      ${mediumImage} 800w,
      ${largeImage} 1600w
    `);
    img.setAttribute('sizes', '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw');
    
    // Add loading="lazy" attribute
    img.setAttribute('loading', 'lazy');
    
    // Store full-size image path as data attribute for lightbox
    img.dataset.fullImg = largeImage;
    
    // Track image loading
    img.onload = function() {
      loadedImages++;
      // When all images are loaded, remove loading class
      if (loadedImages === totalImages) {
        galleryContainer.classList.remove('loading');
        console.log('All gallery images optimized and loaded!');
      }
    };
    
    // Handle errors
    img.onerror = function() {
      console.warn('Failed to load optimized image:', originalSrc);
      // Fallback to original image
      this.src = originalSrc;
      this.removeAttribute('srcset');
      loadedImages++;
      
      if (loadedImages === totalImages) {
        galleryContainer.classList.remove('loading');
      }
    };
  });
  
  // Update lightbox behavior to use full resolution images
  updateLightboxFunctionality();
});

/**
 * Updates the lightbox functionality to use full-resolution images from Cloudinary
 */
function updateLightboxFunctionality() {
  // Check if we're on a page with a lightbox
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  
  // Get all gallery items
  const galleryItems = document.querySelectorAll('.gallery-item');
  
  // Update click handlers for gallery items
  galleryItems.forEach((item, index) => {
    // Get the image inside the gallery item
    const img = item.querySelector('img');
    if (!img) return;
    
    // Remove existing click event listeners by cloning the element
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);
    
    // Add new click event listener to use full-size image
    newItem.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Get the optimized full-size image URL
      const fullSizeImg = newItem.querySelector('img').dataset.fullImg || 
                          newItem.querySelector('img').getAttribute('src');
      
      // Get the image alt text
      const imgAlt = newItem.querySelector('img').getAttribute('alt') || '';
      
      // Get the lightbox image element
      const lightboxImage = document.getElementById('lightbox-image');
      
      // Set the lightbox image source
      if (lightboxImage) {
        lightboxImage.src = fullSizeImg;
        lightboxImage.alt = imgAlt;
      }
      
      // Show the lightbox
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent scrolling
      
      // Store current index for navigation
      window.currentImageIndex = index;
    });
  });
  
  // Handle lightbox navigation with optimized images
  const lightboxPrev = document.getElementById('lightbox-prev');
  const lightboxNext = document.getElementById('lightbox-next');
  const lightboxImage = document.getElementById('lightbox-image');
  
  if (lightboxPrev && lightboxNext && lightboxImage) {
    // Get all gallery images for navigation
    const allGalleryImages = Array.from(document.querySelectorAll('.gallery-item img'));
    
    // Navigate to previous image
    lightboxPrev.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Calculate new index
      window.currentImageIndex = (window.currentImageIndex - 1 + allGalleryImages.length) % allGalleryImages.length;
      
      // Get the new image source
      const prevImg = allGalleryImages[window.currentImageIndex];
      const prevImgSrc = prevImg.dataset.fullImg || prevImg.src;
      
      // Update lightbox
      lightboxImage.src = prevImgSrc;
      lightboxImage.alt = prevImg.alt || '';
    });
    
    // Navigate to next image
    lightboxNext.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Calculate new index
      window.currentImageIndex = (window.currentImageIndex + 1) % allGalleryImages.length;
      
      // Get the new image source
      const nextImg = allGalleryImages[window.currentImageIndex];
      const nextImgSrc = nextImg.dataset.fullImg || nextImg.src;
      
      // Update lightbox
      lightboxImage.src = nextImgSrc;
      lightboxImage.alt = nextImg.alt || '';
    });
  }
}
