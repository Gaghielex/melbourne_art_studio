#!/usr/bin/env python3
"""Apply SEO/AEO optimisations to all Melbourne Art Studio HTML pages."""

import re

OG_IMAGE = "https://melbourneartstudio.com/assets/images/art_commissions.jpg"

PAGES = {
    "index.html": {
        "url": "https://melbourneartstudio.com/",
        "title": "Custom Art Commissions Melbourne – Melbourne Art Studio",
        "description": (
            "Bespoke art commissions and digital illustrations by Gabriel, "
            "a Melbourne-based artist. Custom portraits, character art, and "
            "creative designs for clients worldwide."
        ),
        "add_description": True,
        "jsonld": """\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": "https://melbourneartstudio.com/#website",
          "url": "https://melbourneartstudio.com/",
          "name": "Melbourne Art Studio",
          "description": "Custom art commissions and digital illustrations by Gabriel, a Melbourne-based artist."
        },
        {
          "@type": ["LocalBusiness", "ProfessionalService"],
          "@id": "https://melbourneartstudio.com/#business",
          "name": "Melbourne Art Studio",
          "description": "Bespoke art commissions, digital illustrations, and traditional artwork by Gabriel.",
          "url": "https://melbourneartstudio.com/",
          "image": "https://melbourneartstudio.com/assets/images/art_commissions.jpg",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Melbourne",
            "addressRegion": "VIC",
            "addressCountry": "AU"
          },
          "priceRange": "$$",
          "sameAs": ["https://www.tokyoartstudio.com"]
        }
      ]
    }
    </script>""",
    },
    "about.html": {
        "url": "https://melbourneartstudio.com/about/",
        "title": "About Me - Melbourne Art Studio",
        "description": (
            "Learn more about Gabriel, a Melbourne-based artist and designer "
            "with over a decade of experience creating unique artworks for clients worldwide."
        ),
        "jsonld": """\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": "https://melbourneartstudio.com/about/#gabriel",
      "name": "Gabriel",
      "jobTitle": "Artist",
      "description": "Melbourne-based artist with ten years of experience in digital and traditional art commissions for clients in Australia and internationally.",
      "url": "https://melbourneartstudio.com/about/",
      "image": "https://melbourneartstudio.com/assets/images/About_me(1).jpeg",
      "worksFor": { "@id": "https://melbourneartstudio.com/#business" }
    }
    </script>""",
    },
    "commissions.html": {
        "url": "https://melbourneartstudio.com/commissions/",
        "title": "Custom Art Commissions - Melbourne Art Studio",
        "description": (
            "Commission custom artwork from Gabriel, a Melbourne-based artist "
            "offering personalised digital and traditional art for individuals and businesses."
        ),
        "jsonld": """\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How long does a commission take?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Most commissions take 2-4 weeks to complete, depending on the complexity and medium. Digital works are typically faster than traditional paintings."
          }
        },
        {
          "@type": "Question",
          "name": "Do you require a deposit?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, a 50% deposit is required to begin work, with the remaining balance due upon completion before delivery."
          }
        },
        {
          "@type": "Question",
          "name": "Can I request revisions?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The commission process includes two or three rounds of revisions to ensure you are completely satisfied with the final artwork."
          }
        },
        {
          "@type": "Question",
          "name": "Do you ship artwork internationally?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Traditional artwork is not shipped internationally. Digital commissions can be sent online to clients worldwide."
          }
        }
      ]
    }
    </script>""",
    },
    "gallery.html": {
        "url": "https://melbourneartstudio.com/gallery/",
        "title": "Art Gallery - Melbourne Art Studio",
        "description": (
            "Explore Gabriel's digital and traditional artwork gallery showcasing "
            "a diverse range of styles and mediums from the Melbourne Art Studio."
        ),
        "jsonld": """\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": "https://melbourneartstudio.com/gallery/",
      "name": "Art Gallery - Melbourne Art Studio",
      "description": "A curated gallery of digital and traditional artworks by Gabriel, Melbourne-based artist.",
      "url": "https://melbourneartstudio.com/gallery/",
      "isPartOf": { "@id": "https://melbourneartstudio.com/#website" }
    }
    </script>""",
    },
    "reviews.html": {
        "url": "https://melbourneartstudio.com/reviews/",
        "title": "Customer Reviews - Melbourne Art Studio",
        "description": (
            "Read testimonials from clients who have experienced Gabriel's artistic expertise "
            "at Melbourne Art Studio. Discover what people are saying about their commissioned artwork."
        ),
        "fix_description": True,
        "jsonld": """\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": "https://melbourneartstudio.com/#business",
      "name": "Melbourne Art Studio",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "5",
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": "26"
      }
    }
    </script>""",
    },
    "international.html": {
        "url": "https://melbourneartstudio.com/international/",
        "title": "International Art Commissions - Melbourne Art Studio",
        "description": (
            "Commission custom digital artwork from Gabriel, a Melbourne-based artist "
            "serving clients worldwide with personalised illustrations and digital paintings."
        ),
        "jsonld": """\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do you handle time zone differences for international commissions?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "I'm flexible with scheduling consultations and progress updates to accommodate your time zone. We can communicate via email, messaging apps, or schedule video calls at mutually convenient times."
          }
        },
        {
          "@type": "Question",
          "name": "What payment methods do you accept internationally?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "I accept PayPal, bank transfers, and other secure international payment methods."
          }
        },
        {
          "@type": "Question",
          "name": "Can I print the digital artwork locally?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. All digital commissions are delivered in high resolution formats suitable for printing. I can provide recommendations for print sizes and materials if needed."
          }
        },
        {
          "@type": "Question",
          "name": "What file formats do you deliver for international digital art commissions?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Final artwork is provided in multiple formats including high-resolution JPEG, PNG, PDF, and layered PSD files where appropriate. Files are delivered via secure cloud transfer services."
          }
        }
      ]
    }
    </script>""",
    },
    "digital-art.html": {
        "url": "https://melbourneartstudio.com/digital-art/",
        "title": "Digital Artwork Gallery - Melbourne Art Studio",
        "description": (
            "Explore Gabriel's digital artwork gallery showcasing a diverse range "
            "of digital illustrations and artwork from the Melbourne Art Studio."
        ),
        "jsonld": """\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": "https://melbourneartstudio.com/digital-art/",
      "name": "Digital Artwork Gallery - Melbourne Art Studio",
      "description": "A gallery of digital illustrations and artwork by Gabriel, Melbourne-based artist.",
      "url": "https://melbourneartstudio.com/digital-art/",
      "isPartOf": { "@id": "https://melbourneartstudio.com/#website" }
    }
    </script>""",
    },
    "traditional-art.html": {
        "url": "https://melbourneartstudio.com/traditional-art/",
        "title": "Traditional Artwork Gallery - Melbourne Art Studio",
        "description": (
            "Explore Gabriel's traditional artwork gallery showcasing a diverse range "
            "of paintings, drawings and traditional artwork from the Melbourne Art Studio."
        ),
        "jsonld": """\
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": "https://melbourneartstudio.com/traditional-art/",
      "name": "Traditional Artwork Gallery - Melbourne Art Studio",
      "description": "A gallery of traditional paintings and drawings by Gabriel, Melbourne-based artist.",
      "url": "https://melbourneartstudio.com/traditional-art/",
      "isPartOf": { "@id": "https://melbourneartstudio.com/#website" }
    }
    </script>""",
    },
}


def seo_block(url, title, description, jsonld):
    return (
        f'    <!-- SEO: Open Graph -->\n'
        f'    <meta property="og:type" content="website">\n'
        f'    <meta property="og:site_name" content="Melbourne Art Studio">\n'
        f'    <meta property="og:title" content="{title}">\n'
        f'    <meta property="og:description" content="{description}">\n'
        f'    <meta property="og:url" content="{url}">\n'
        f'    <meta property="og:image" content="{OG_IMAGE}">\n'
        f'    <!-- SEO: Twitter Card -->\n'
        f'    <meta name="twitter:card" content="summary_large_image">\n'
        f'    <meta name="twitter:title" content="{title}">\n'
        f'    <meta name="twitter:description" content="{description}">\n'
        f'    <meta name="twitter:image" content="{OG_IMAGE}">\n'
        f'    <!-- SEO: Canonical -->\n'
        f'    <link rel="canonical" href="{url}">\n'
        f'    <!-- SEO: Structured Data -->\n'
        f'{jsonld}\n'
        f'</head>'
    )


for filename, data in PAGES.items():
    with open(filename, encoding='utf-8') as f:
        content = f.read()

    url = data['url']
    title = data['title']
    description = data['description']
    jsonld = data['jsonld']

    # index.html: add missing meta description and update title
    if data.get('add_description'):
        content = content.replace(
            '<title>Melbourne Art Studio</title>',
            f'<meta name="description" content="{description}">\n    <title>{title}</title>',
        )

    # reviews.html: fix stale "art coaching services" in description
    if data.get('fix_description'):
        content = re.sub(
            r'(<meta name="description" content=")[^"]*(")',
            f'\\1{description}\\2',
            content,
        )

    # Insert SEO block before </head> (replaces the lone </head> tag)
    block = seo_block(url, title, description, jsonld)
    content = content.replace('</head>', block, 1)

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'Updated {filename}')

print('SEO updates complete.')
