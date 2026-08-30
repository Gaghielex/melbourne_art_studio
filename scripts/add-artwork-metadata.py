#!/usr/bin/env python3
"""Add data-title, data-medium, data-year, data-desc to gallery images and replace lightbox HTML."""

import re

# ── Digital Illustrations metadata ──────────────────────────────────────────
DIGITAL = {
    "Stormtrooper-min.png": ("Stormtrooper", "Digital Illustration", "2022",
        "A detailed digital portrait of a Star Wars Stormtrooper, rendered with dramatic lighting and cinematic texture."),
    "Sake and Sashimi.png": ("Sake and Sashimi", "Digital Illustration", "2023",
        "Part of the Japanese food and drink series, celebrating the quiet ritual of sake and fresh sashimi."),
    "Smell_The_Flowers.jpeg": ("Smell The Flowers", "Digital Illustration", "2024",
        "A whimsical digital illustration capturing a moment of stillness and joy among blooming flowers."),
    "Bianca.png": ("Bianca", "Digital Illustration", "2023",
        "A commissioned character portrait with vibrant colours, expressive linework and a warm luminous finish."),
    "Watercolor-cat.jpg": ("Watercolour Cat", "Digital Illustration", "2022",
        "A digital painting of a cat rendered in a loose watercolour style, balancing spontaneity with detail."),
    "Snowboarding.png": ("Snowboarding", "Digital Illustration", "2023",
        "A dynamic snowboarding scene with bold perspective, kinetic energy and a vivid alpine colour palette."),
    "Reject_Humanity.jpg": ("Reject Humanity", "Digital Illustration", "2021",
        "Fan art inspired by the internet's beloved cat memes. First in the Reject Humanity series."),
    "Reject_Bonk.jpg": ("Reject Bonk", "Digital Illustration", "2021",
        "Companion piece to Reject Humanity — delivering bonk energy with maximum enthusiasm."),
    "Quarantined_3.png": ("Quarantined III", "Digital Illustration", "2020",
        "Third in the Quarantine series, exploring introspective moments during lockdown with warmth and humour."),
    "Quarantined_2.png": ("Quarantined II", "Digital Illustration", "2020",
        "Second in the Quarantine series, continuing the exploration of solitude and creativity in isolation."),
    "Quarantined_.png": ("Quarantined", "Digital Illustration", "2020",
        "First in the Quarantine series, born during the 2020 lockdown period as an ode to creative resilience."),
    "Old-portrait.jpg": ("Old Portrait", "Digital Illustration", "2020",
        "An early portrait commission showcasing the development of digital painting and lighting techniques."),
    "No_Horny!_Bonk!.jpg": ("No Horny! Bonk!", "Digital Illustration", "2021",
        "A playful entry in the internet cat meme series, rendered with expressive character and comic timing."),
    "Monstera_2.png": ("Monstera II", "Digital Illustration", "2022",
        "Second in the Monstera botanical series — a lush celebration of indoor plant culture and tropical foliage."),
    "Monstera_1.png": ("Monstera I", "Digital Illustration", "2022",
        "First in the Monstera botanical series, exploring the sculptural beauty of tropical leaves in digital form."),
    "Lianne'S_Portrait-min.png": ("Lianne's Portrait", "Digital Illustration", "2023",
        "A commissioned digital portrait featuring a soft colour palette, delicate shading and refined detail."),
    "Lemon sour and Okonomiyaki.png": ("Lemon Sour & Okonomiyaki", "Digital Illustration", "2023",
        "Part of the Japanese izakaya series — a lively still life of lemon sour and osaka-style okonomiyaki."),
    "Kitties_Illustration-min.png": ("Kitties", "Digital Illustration", "2022",
        "A playful illustration featuring cats in various poses and expressions, brimming with personality."),
    "Join_the_Dark_Side.jpg": ("Join the Dark Side", "Digital Illustration", "2022",
        "Star Wars fan art rendered with dramatic lighting and a persuasive invitation from the dark side."),
    "Island.png": ("Island", "Digital Illustration", "2023",
        "A richly detailed fantasy island scene with layered environments and a vivid jewel-toned colour palette."),
    "Horny_is_Back.jpg": ("Horny is Back", "Digital Illustration", "2021",
        "A fan favourite return to the beloved internet cat meme universe, with extra flair."),
    "Highball and Karage.png": ("Highball & Karaage", "Digital Illustration", "2023",
        "Japanese izakaya at its finest — a cold highball paired with golden, crispy karaage chicken."),
    "Frenchgirls_Portrait2.jpeg": ("French Girls Portrait II", "Digital Illustration", "2021",
        "Second in the French Girls portrait series, featuring detailed linework and a painterly finish."),
    "Frenchgirls_Portrait1.jpeg": ("French Girls Portrait I", "Digital Illustration", "2021",
        "First in the French Girls portrait series, exploring portraiture with a European illustrative sensibility."),
    "French-girl-portrait.jpg": ("French Girl Study", "Digital Illustration", "2020",
        "An early study from the French Girl portrait series, focusing on gesture and expression."),
    "French-girl-portrait(3).jpg": ("French Girl Portrait III", "Digital Illustration", "2021",
        "Third variation from the French Girl portrait series with refined colour and confident line."),
    "French-girl-portrait(2).jpg": ("French Girl Portrait II (Alt)", "Digital Illustration", "2021",
        "Alternative version of the French Girl portrait study with a distinct lighting approach."),
    "Digital-koi.png": ("Digital Koi", "Digital Illustration", "2022",
        "A detailed digital painting of koi fish with fluid movement, vibrant scales and luminous water effects."),
    "Digital-cat.JPG": ("Digital Cat", "Digital Illustration", "2021",
        "A quick digital study of a cat with expressive brushwork and confident, energetic linework."),
    "Day_at_the_beach.png": ("Day at the Beach", "Digital Illustration", "2023",
        "A relaxed beach scene capturing the warmth and colour of an Australian summer day."),
    "Darth vader.jpeg": ("Darth Vader", "Digital Illustration", "2022",
        "A bold fan art portrait of Darth Vader with cinematic lighting and powerful compositional presence."),
    "Commissioned_Portrait2.jpg": ("Commissioned Portrait", "Digital Illustration", "2023",
        "A commissioned character portrait with rich detail, dynamic pose and vibrant digital colour."),
    "Children's_Book_Portrait_-min.png": ("Children's Book Portrait", "Digital Illustration", "2023",
        "A soft and charming portrait crafted in the warm, approachable style of a children's book illustration."),
    "Celebrations_in_Japan_A3.png": ("Celebrations in Japan", "Digital Illustration", "2023",
        "A festive A3 illustration celebrating the colour, culture and joyful energy of Japanese festivals."),
    "Cat_Portrait-min.png": ("Cat Portrait", "Digital Illustration", "2023",
        "A detailed digital portrait of a cat featuring expressive eyes, soft fur texture and painterly depth."),
    "Beer and Takoyaki.png": ("Beer & Takoyaki", "Digital Illustration", "2023",
        "Japanese street food at its best — cold beer alongside freshly made takoyaki balls."),
    "Beer and Ramen.png": ("Beer & Ramen", "Digital Illustration", "2023",
        "A cosy illustration of beer and ramen, capturing the comfort of a Japanese noodle house."),
    "Anime_Mashup.png": ("Anime Mashup", "Digital Illustration", "2023",
        "A celebratory mashup of iconic anime characters and visual references, packed with detail and nostalgia."),
    "Anime_Family.jpg": ("Anime Family", "Digital Illustration", "2023",
        "A commissioned family portrait reimagined in a vibrant anime illustration style."),
    "7_years_of_shenanigans.jpg": ("7 Years of Shenanigans", "Digital Illustration", "2023",
        "A commemorative illustration celebrating seven years of creative adventures and memorable projects."),
}

# ── Traditional Media metadata ───────────────────────────────────────────────
TRADITIONAL = {
    "Acrylic fox.jpg": ("Acrylic Fox", "Acrylics", "2022",
        "A vibrant acrylic painting of a fox with expressive brushwork, warm earthy tones and striking presence."),
    "Acrylics bird.jpg": ("Acrylics Bird", "Acrylics", "2022",
        "A colourful bird study in acrylics featuring bold colour fields and confident, loose brushwork."),
    "Amaterasu.JPG": ("Amaterasu", "Ink", "2021",
        "Inspired by the Japanese sun goddess Amaterasu, rendered in detailed ink work with symbolic energy."),
    "Birds.jpg": ("Birds", "Acrylics", "2022",
        "A composition of birds painted in acrylics with a harmonious palette and fluid, gestural marks."),
    "Breakfast (1).JPG": ("Breakfast I", "Ink & Watercolour", "2022",
        "First in the Breakfast series — a delicate study of morning food captured in ink line and watercolour wash."),
    "Breakfast (2).JPG": ("Breakfast II", "Ink & Watercolour", "2022",
        "Second in the Breakfast series, exploring a different morning spread with refined ink and colour."),
    "Breakfast (3).JPG": ("Breakfast III", "Ink & Watercolour", "2022",
        "Third in the Breakfast series, building on the warmth and intimacy of everyday morning rituals."),
    "Breakfast (4).jpg": ("Breakfast IV", "Ink & Watercolour", "2022",
        "Fourth in the Breakfast series with a fresh composition and soft, layered watercolour tones."),
    "Cacti (1).jpg": ("Cacti I", "Watercolour", "2022",
        "First in the Cacti series — a detailed watercolour study of succulent plants with rich green and earthy tones."),
    "Cacti (2).jpg": ("Cacti II", "Watercolour", "2022",
        "Second in the Cacti series, exploring different species and form with layered watercolour technique."),
    "Cacti (3).jpg": ("Cacti III", "Watercolour", "2022",
        "Third in the Cacti series, completing the triptych with a broader arrangement and varied textures."),
    "Cats and dogs (1).jpg": ("Cats and Dogs I", "Acrylics", "2023",
        "First in the Cats and Dogs portrait series, celebrating the character and charm of beloved pets."),
    "Cats and dogs (2).jpg": ("Cats and Dogs II", "Acrylics", "2023",
        "Second in the Cats and Dogs series, capturing another pair of expressive animal companions."),
    "Cats and dogs (3).jpg": ("Cats and Dogs III", "Acrylics", "2023",
        "Third in the Cats and Dogs series — more personality, more pets, more joy."),
    "Cats and dogs (4).jpg": ("Cats and Dogs IV", "Acrylics", "2023",
        "Fourth entry in the Cats and Dogs portrait series with vibrant colour and animated expressions."),
    "Cats and dogs (5).jpg": ("Cats and Dogs V", "Acrylics", "2023",
        "Fifth in the series, continuing the celebration of animal companions with warmth and detail."),
    "Cats and dogs (6).jpg": ("Cats and Dogs VI", "Acrylics", "2023",
        "Sixth and final entry in the Cats and Dogs acrylic portrait series."),
    "Christmas.jpg": ("Christmas", "Watercolour", "2022",
        "A festive Christmas watercolour illustration with warm, joyful tones and seasonal charm."),
    "Ghibli studio ink (10).jpg": ("Ghibli Ink X", "Ink", "2021",
        "Tenth in the Studio Ghibli fan art ink series, celebrating the magic of Hayao Miyazaki's worlds."),
    "Ghibli studio ink (2).jpg": ("Ghibli Ink II", "Ink", "2021",
        "Second in the Ghibli ink series, rendered with flowing line and detailed cross-hatching."),
    "Ghibli studio ink (3).jpg": ("Ghibli Ink III", "Ink", "2021",
        "Third in the Ghibli ink series, exploring another beloved scene in expressive ink work."),
    "Ghibli studio ink (4).jpg": ("Ghibli Ink IV", "Ink", "2021",
        "Fourth entry in the Studio Ghibli ink series with confident line and atmospheric shading."),
    "Ghibli studio ink (5).jpg": ("Ghibli Ink V", "Ink", "2021",
        "Fifth in the Ghibli series, capturing the whimsy and wonder of a favourite Ghibli moment."),
    "Ghibli studio ink (6).jpg": ("Ghibli Ink VI", "Ink", "2021",
        "Sixth in the series, drawn with the same love for hand-crafted detail and Ghibli storytelling."),
    "Ghibli studio ink (7).jpg": ("Ghibli Ink VII", "Ink", "2021",
        "Seventh entry, continuing the tribute to Studio Ghibli's visual language in ink."),
    "Ghibli studio ink (8).jpg": ("Ghibli Ink VIII", "Ink", "2021",
        "Eighth in the series with refined linework and a strong sense of narrative and place."),
    "Ghibli studio ink (9).jpg": ("Ghibli Ink IX", "Ink", "2021",
        "Ninth in the Ghibli ink series, drawing closer to the final piece with evolving technique."),
    "Japanese food (1).jpg": ("Japanese Food I", "Ink & Watercolour", "2022",
        "First in the Japanese food series — a detailed ink and watercolour study of traditional Japanese cuisine."),
    "Japanese food (2).jpg": ("Japanese Food II", "Ink & Watercolour", "2022",
        "Second in the series, exploring the colours and textures of another Japanese dish."),
    "Japanese food (3).jpg": ("Japanese Food III", "Ink & Watercolour", "2022",
        "Third entry, celebrating the artistry of Japanese plating and food culture."),
    "Japanese food (4).jpg": ("Japanese Food IV", "Ink & Watercolour", "2022",
        "Fourth in the series with rich ink outlines and soft watercolour fills."),
    "Japanese food (5).jpg": ("Japanese Food V", "Ink & Watercolour", "2022",
        "Fifth and final entry in the Japanese food series, a fitting close to a delicious collection."),
    "Japanese house (2).jpg": ("Japanese House II", "Ink & Watercolour", "2022",
        "Second study of traditional Japanese architecture, capturing quiet structure and organic atmosphere."),
    "Japanese House.jpeg": ("Japanese House", "Ink & Watercolour", "2022",
        "A detailed study of traditional Japanese architecture in ink and watercolour, celebrating craft and form."),
    "Kimetsu no yaiba.jpg": ("Kimetsu no Yaiba", "Ink", "2021",
        "Fan art from Demon Slayer rendered in detailed ink work, honouring the series' bold visual style."),
    "Koi fish (1).jpg": ("Koi Fish I", "Ink & Watercolour", "2022",
        "First in the Koi series — graceful koi in ink and watercolour, celebrating Japanese pond culture."),
    "Koi fish (2).jpg": ("Koi Fish II", "Ink & Watercolour", "2022",
        "Second in the Koi series with fluid movement and layered watercolour transparency."),
    "Koi fish (3).jpg": ("Koi Fish III", "Ink & Watercolour", "2022",
        "Third in the Koi series, completing a triptych of flowing colour and aquatic beauty."),
    "Monet Study.jpeg": ("Monet Study", "Acrylics", "2021",
        "A study inspired by Claude Monet's impressionist techniques, exploring light and colour in acrylics."),
    "Nursery.jpg": ("Nursery", "Watercolour", "2022",
        "A gentle nursery scene painted in soft watercolour tones — warm, tender and full of quiet detail."),
    "Oolong.jpg": ("Oolong", "Ink & Watercolour", "2022",
        "A delicate illustration of an oolong tea ceremony, honouring the ritual of slow, mindful brewing."),
    "Photo Jul 08, 06 48 58.jpg": ("Plein Air Study", "Acrylics", "2022",
        "An outdoor plein air painting study, capturing natural light and atmosphere on location."),
    "Princess Mononoke.jpeg": ("Princess Mononoke", "Ink", "2021",
        "Fan art inspired by Studio Ghibli's Princess Mononoke, rendered in expressive detailed ink work."),
    "Small flowers (1).jpg": ("Small Flowers I", "Watercolour", "2022",
        "First in the Small Flowers series — an intimate watercolour study of delicate botanical detail."),
    "Small flowers (2).jpg": ("Small Flowers II", "Watercolour", "2022",
        "Second in the series, building on the gentle rhythm of small floral forms."),
    "Small flowers (3).jpg": ("Small Flowers III", "Watercolour", "2022",
        "Third entry with a fresh arrangement and subtle layering of watercolour washes."),
    "Small flowers (4).jpg": ("Small Flowers IV", "Watercolour", "2022",
        "Fourth in the series, exploring variation in scale and colour temperature."),
    "Small flowers (5).jpg": ("Small Flowers V", "Watercolour", "2023",
        "Fifth in the Small Flowers series with a looser, more expressive brushwork approach."),
    "Small flowers (6).jpg": ("Small Flowers VI", "Watercolour", "2023",
        "Sixth entry, leaning further into organic composition and botanical spontaneity."),
    "Small flowers (7).jpg": ("Small Flowers VII", "Watercolour", "2023",
        "Seventh in the series with refined control and a harmonious, muted palette."),
    "Small flowers (8).jpg": ("Small Flowers VIII", "Watercolour", "2023",
        "Eighth entry, continuing the meditative practice of small-scale botanical watercolour."),
    "Small flowers (9).jpg": ("Small Flowers IX", "Watercolour", "2023",
        "Ninth in the series with rich pigment layering and confident wet-on-wet technique."),
    "Small flowers (10).jpg": ("Small Flowers X", "Watercolour", "2023",
        "Tenth and final entry in the Small Flowers series — a fitting close to a beloved collection."),
    "Sumie (1).JPG": ("Sumie I", "Sumie (Ink Wash)", "2021",
        "First in the Sumie series — traditional Japanese ink wash painting exploring fluid brushwork and negative space."),
    "Sumie (2).JPG": ("Sumie II", "Sumie (Ink Wash)", "2021",
        "Second in the Sumie series, deepening the practice of spontaneous, meditative ink wash technique."),
    "Sumie (3).JPG": ("Sumie III", "Sumie (Ink Wash)", "2021",
        "Third in the Sumie series, capturing the essence of the subject in minimal, expressive strokes."),
    "Summer flowers (1).JPG": ("Summer Flowers I", "Watercolour", "2023",
        "First in the Summer Flowers series — bright, loose watercolour celebrating the abundance of summer blooms."),
    "Summer flowers (2).jpg": ("Summer Flowers II", "Watercolour", "2023",
        "Second in the series with a richer palette and expansive, sunlit floral composition."),
    "Sushi (1).jpg": ("Sushi I", "Ink & Watercolour", "2022",
        "First in the Sushi series — a precise and appetising ink and watercolour study of Japanese nigiri."),
    "Sushi (2).jpg": ("Sushi II", "Ink & Watercolour", "2022",
        "Second in the Sushi series with a broader selection and confident ink outlines."),
    "Sushi (3).jpg": ("Sushi III", "Ink & Watercolour", "2022",
        "Third in the series, exploring the colour and texture of different sushi varieties."),
    "Sushi (4).jpg": ("Sushi IV", "Ink & Watercolour", "2022",
        "Fourth entry in the Sushi series with layered colour and refined detail."),
    "Sushi (5).jpg": ("Sushi V", "Ink & Watercolour", "2022",
        "Fifth and final entry in the Sushi series — a delicious conclusion to a beautifully illustrated collection."),
    "Tanjiro Kimetsu no Yaiba.jpeg": ("Tanjiro", "Ink", "2021",
        "A portrait of Tanjiro from Demon Slayer, rendered in detailed ink work with character and energy."),
    "Toronga Zoo.jpeg": ("Taronga Zoo", "Watercolour", "2022",
        "A watercolour study from a visit to Taronga Zoo in Sydney, capturing animal life and natural atmosphere."),
    "Watercolor flowers.jpg": ("Watercolour Flowers", "Watercolour", "2022",
        "A loose watercolour floral composition with vibrant, blooming colours and expressive, flowing marks."),
}


IMG_CLASS = 'class="w-full h-auto rounded-lg shadow-md"'

def tag_for(fname, meta):
    title, medium, year, desc = meta
    # escape quotes in desc just in case
    desc = desc.replace('"', '&quot;')
    return (
        f'data-title="{title}" '
        f'data-medium="{medium}" '
        f'data-year="{year}" '
        f'data-desc="{desc}" '
        + IMG_CLASS
    )

def process(filepath, meta_dict, folder):
    with open(filepath, encoding='utf-8') as f:
        content = f.read()

    for fname, meta in meta_dict.items():
        # Match the img tag for this file (folder may contain spaces)
        pattern = re.compile(
            r'(src="[^"]*/' + re.escape(folder) + r'/' + re.escape(fname) + r'"[^>]*?)' + re.escape(IMG_CLASS),
            re.DOTALL
        )
        replacement = r'\1' + tag_for(fname, meta)
        new_content, n = pattern.subn(replacement, content)
        if n == 0:
            # already has data attrs or not found — try without the class match
            if fname not in content:
                print(f'  WARN: {fname} not found in {filepath}')
        content = new_content

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {filepath}')


NEW_LIGHTBOX = '''\
    <!-- Lightbox -->
    <div class="lightbox" id="lightbox">
        <button class="lb-close" id="lightbox-close" aria-label="Close"><i class="fas fa-times"></i></button>
        <div class="lb-counter" id="lightbox-counter"></div>
        <div class="lb-image-wrap">
            <img src="" alt="" id="lightbox-image">
        </div>
        <button class="lb-nav lb-prev" id="lightbox-prev" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
        <button class="lb-nav lb-next" id="lightbox-next" aria-label="Next"><i class="fas fa-chevron-right"></i></button>
        <div class="lb-info">
            <div class="lb-info-inner">
                <div class="lb-meta">
                    <span class="lb-medium-tag" id="lightbox-medium"></span>
                    <span class="lb-year" id="lightbox-year"></span>
                </div>
                <h3 class="lb-title" id="lightbox-title"></h3>
                <p class="lb-desc" id="lightbox-desc"></p>
            </div>
        </div>
    </div>'''

OLD_DIGITAL = '''    <!-- Lightbox -->
    <div class="lightbox" id="lightbox">
        <div class="lightbox-content">
            <img src="" alt="Enlarged artwork" id="lightbox-image">
            <div class="lightbox-close" id="lightbox-close">
                <i class="fas fa-times"></i>
            </div>
            <div class="lightbox-prev" id="lightbox-prev">
                <i class="fas fa-chevron-left"></i>
            </div>
            <div class="lightbox-next" id="lightbox-next">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    </div>'''

OLD_TRADITIONAL = '''    <!-- Lightbox -->
    <div id="lightbox" class="lightbox">
        <div class="lightbox-content">
            <img id="lightbox-image" src="" alt="Expanded artwork">
            <span id="lightbox-close" class="lightbox-close">&times;</span>
            <div id="lightbox-prev" class="lightbox-prev">&#10094;</div>
            <div id="lightbox-next" class="lightbox-next">&#10095;</div>
        </div>
    </div>'''


def replace_lightbox(filepath, old):
    with open(filepath, encoding='utf-8') as f:
        content = f.read()
    content = content.replace(old, NEW_LIGHTBOX, 1)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Replaced lightbox in {filepath}')


if __name__ == '__main__':
    import os
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    process(os.path.join(base, 'digital-art.html'), DIGITAL, 'Digital Illustrations')
    process(os.path.join(base, 'traditional-art.html'), TRADITIONAL, 'Traditional Media')

    replace_lightbox(os.path.join(base, 'digital-art.html'), OLD_DIGITAL)
    replace_lightbox(os.path.join(base, 'traditional-art.html'), OLD_TRADITIONAL)

    print('Done.')
