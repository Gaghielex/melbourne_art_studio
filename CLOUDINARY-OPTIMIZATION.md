# Cloudinary Image Optimization Guide

This document explains how the Cloudinary image optimization is implemented in the Melbourne Art Studio website.

## How It Works

The website uses Cloudinary's fetch API to automatically optimize your images without needing to upload them separately. Here's how it works:

1. **Original Images**: Your original images remain on GitHub Pages
2. **On-the-fly Optimization**: When a user visits your site, Cloudinary fetches, optimizes, and caches your images
3. **Responsive Delivery**: Different sized images are served based on the user's device
4. **Format Optimization**: Images are converted to modern formats (WebP, AVIF) when supported by the browser
5. **Quality Optimization**: Compression is applied intelligently to reduce file size while maintaining visual quality

## Implementation Details

The optimization is handled by the `gallery-optimizer.js` file, which:

1. Identifies all gallery images on the page
2. Transforms image URLs to Cloudinary URLs with optimization parameters
3. Sets up responsive image attributes (srcset and sizes)
4. Maintains lightbox functionality to show full-size images when clicked

## Maintenance

### Adding New Images

No special steps needed! Just add images to your GitHub repository as usual. The `gallery-optimizer.js` script will automatically optimize them when they're displayed on your website.

### Cloudinary Dashboard

You can view statistics about your image usage in your [Cloudinary Dashboard](https://cloudinary.com/console):

- Image transformations used
- Bandwidth consumed
- Storage used (should be minimal since we're using fetch mode)

### Parameters Used

The script creates three versions of each image:

- Small (400px wide): For mobile devices and thumbnails
- Medium (800px wide): For tablets and smaller desktop views
- Large (1600px wide): For full-screen and lightbox views

Additional parameters:

- `q_auto`: Automatic quality compression
- `f_auto`: Automatic format selection (WebP/AVIF when supported)

## Troubleshooting

If images aren't being optimized:

1. Check that your Cloudinary fetch URLs are allowed to access your domain
2. Verify that the script is loaded on the page (check browser console)
3. Look for any JavaScript errors in the console
4. Try opening a direct Cloudinary URL to see if it works

## Free Tier Limits

Cloudinary's free tier includes:

- 25GB of bandwidth/month
- 25 credits/month for transformations
- Unlimited stored transformations

This should be sufficient for most small to medium websites. If you exceed these limits, Cloudinary will notify you about upgrade options.

## Resources

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Cloudinary Transformation Reference](https://cloudinary.com/documentation/image_transformations)
- [Responsive Images Guide](https://cloudinary.com/documentation/responsive_images)
