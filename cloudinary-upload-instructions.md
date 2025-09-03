# Manually Upload Large Images to Cloudinary

To fix the loading issue with the three problematic large images, follow these steps to upload them to Cloudinary manually:

1. **Log in to your Cloudinary account** at [https://cloudinary.com/console](https://cloudinary.com/console)

2. **Upload each of the following images** from your local folder:
   - `assets/images/Digital Illustrations/Celebrations_in_Japan_A3.png`
   - `assets/images/Digital Illustrations/Digital-koi.png`
   - `assets/images/Digital Illustrations/Anime_Mashup.png`

3. **When uploading, set these specific public IDs**:
   - For `Celebrations_in_Japan_A3.png` → use public ID: `celebrations-japan`
   - For `Digital-koi.png` → use public ID: `digital-koi`
   - For `Anime_Mashup.png` → use public ID: `anime-mashup`

4. **After uploading**, make a note of the version number in the URLs of your uploaded images. The current code uses `v1693823775` but your uploads will have different version numbers.

5. **Update the version numbers** in `js/gallery-optimizer.js` if they differ from what's in the code.

## Verifying Your Uploads

After uploading, you can verify the images are working by checking these URLs (replace `v1693823775` with your actual version number):

```
https://res.cloudinary.com/dggsqryu1/image/upload/v1693823775/celebrations-japan/w_400,q_auto,f_auto
https://res.cloudinary.com/dggsqryu1/image/upload/v1693823775/digital-koi/w_400,q_auto,f_auto
https://res.cloudinary.com/dggsqryu1/image/upload/v1693823775/anime-mashup/w_400,q_auto,f_auto
```

## Why This Solution Works

The GitHub Pages hosting has a 10MB file size limit. These three images are large but under 10MB, which means they should work but might be slow to load. By uploading them directly to Cloudinary:

1. We bypass GitHub's limitations
2. We enable Cloudinary's automatic optimization
3. We ensure responsive image delivery for all devices

Once these images are uploaded to Cloudinary with the correct public IDs, they should appear properly on your site.
