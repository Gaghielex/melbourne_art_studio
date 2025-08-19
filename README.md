# Melbourne Art Studio Website

A modern, minimalist, and responsive website for Melbourne Art Studio. This project showcases artistic work with a clean interface, animations, and dark/light mode functionality.

## Features

- **Responsive Design**: Works on mobile, tablet, and desktop devices
- **Dark/Light Mode**: Toggle between dark and light themes with automatic system preference detection
- **Modern UI**: Minimalist design focusing on content and artwork
- **Animations**: Smooth transitions and animations enhance user experience
- **Interactive Gallery**: Dynamic art gallery with load more functionality
- **Contact Form**: User-friendly contact form with validation

## Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Custom styling with transitions and animations
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **JavaScript**: Custom interactions and animations
- **Font Awesome**: Icons
- **Google Fonts**: Typography (Inter & Playfair Display)

## Project Structure

```
my-artist-website/
├── assets/
│   └── images/        # Image assets (placeholder for your art images)
├── css/
│   └── styles.css     # Custom CSS styles
├── js/
│   ├── main.js        # Main JavaScript for interactions
│   └── animations.js  # Animation-specific JavaScript
├── .github/
│   └── copilot-instructions.md
├── index.html         # Main HTML file
└── README.md          # Project documentation
```

## Usage

1. Clone the repository
2. Open `index.html` in your web browser
3. Alternatively, deploy to a web server or hosting service

## Customization

### Changing Colors

The primary color scheme can be modified in the Tailwind config section in `index.html`:

```js
tailwind.config = {
    theme: {
        extend: {
            colors: {
                primary: '#4F46E5',    // Change this for the primary color
                secondary: '#10B981',  // Change this for the secondary color
                dark: '#1F2937',       // Dark mode background
                light: '#F9FAFB'       // Light mode background
            }
        }
    }
}
```

### Adding Content

- **Gallery Images**: Replace the placeholder content in the gallery section with actual images
- **About Section**: Update the text content in the about section
- **Contact Information**: Update the contact details in the contact section

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is open-source and available for personal and commercial use.

## Acknowledgments

- Font Awesome for icons
- Google Fonts for typography
- Tailwind CSS for the utility classes
