import os
import math
from PIL import Image, ImageDraw

def create_app_icon():
    os.makedirs("assets", exist_ok=True)
    size = 512  # Render high-res then downsample for anti-aliasing
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background squircle with gradient
    # Create gradient background
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    
    # Rounded rectangle mask
    radius = 110
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    margin = 24
    mask_draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=255
    )

    # Gradient: Deep indigo -> Vibrant Purple -> Electric Violet
    for y in range(size):
        ratio = y / size
        # Smooth interpolation
        r = int(24 + ratio * (90 - 24))
        g = int(12 + ratio * (25 - 12))
        b = int(58 + ratio * (170 - 58))
        bg_draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Apply mask
    bg.putalpha(mask)
    img.alpha_composite(bg)

    # 2. Add subtle glossy radial glow at top
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_cx, glow_cy = size // 2, margin + 80
    for r in range(160, 0, -5):
        alpha = int(35 * (1 - r / 160))
        glow_draw.ellipse(
            [glow_cx - r * 1.5, glow_cy - r, glow_cx + r * 1.5, glow_cy + r],
            fill=(168, 85, 247, alpha)
        )
    glow.putalpha(mask)
    img.alpha_composite(glow)

    # 3. Outer border with neon gradient
    border_draw = ImageDraw.Draw(img)
    border_draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        outline=(147, 51, 234, 180),
        width=6
    )

    # 4. Draw Sound Wave / AI Voice Frequency Bars in the center
    # 7 bars representing symmetric audio waves
    bars_data = [
        # (x_offset_from_center, height, color_rgb)
        (-140, 70, (56, 189, 248)),    # Sky blue
        (-95,  140, (96, 165, 250)),   # Blue
        (-48,  210, (168, 85, 247)),   # Purple
        (0,    260, (236, 72, 153)),   # Pink / Magenta
        (48,   210, (168, 85, 247)),   # Purple
        (95,   140, (96, 165, 250)),   # Blue
        (140,  70, (56, 189, 248)),    # Sky blue
    ]

    center_x = size // 2
    center_y = size // 2
    bar_width = 24

    wave_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    wave_draw = ImageDraw.Draw(wave_layer)

    # Draw glow behind bars
    for x_off, h, color in bars_data:
        x = center_x + x_off
        y0 = center_y - h // 2
        y1 = center_y + h // 2
        for glow_w in range(bar_width + 20, bar_width, -4):
            alpha = int(40 * (1 - (glow_w - bar_width) / 20))
            wave_draw.rounded_rectangle(
                [x - glow_w // 2, y0 - 8, x + glow_w // 2, y1 + 8],
                radius=glow_w // 2,
                fill=(*color, alpha)
            )

    # Draw solid bars with rounded caps
    for x_off, h, color in bars_data:
        x = center_x + x_off
        y0 = center_y - h // 2
        y1 = center_y + h // 2
        wave_draw.rounded_rectangle(
            [x - bar_width // 2, y0, x + bar_width // 2, y1],
            radius=bar_width // 2,
            fill=(*color, 255)
        )

    # Add a small sparkle / star at top right
    star_x = size - margin - 70
    star_y = margin + 70
    for r in range(25, 0, -3):
        alpha = int(80 * (1 - r / 25))
        wave_draw.ellipse([star_x - r, star_y - r, star_x + r, star_y + r], fill=(255, 255, 255, alpha))
    wave_draw.line([(star_x - 18, star_y), (star_x + 18, star_y)], fill=(255, 255, 255, 230), width=3)
    wave_draw.line([(star_x, star_y - 18), (star_x, star_y + 18)], fill=(255, 255, 255, 230), width=3)

    img.alpha_composite(wave_layer)

    # 5. Downsample to 256x256 with high-quality Lanczos for crisp icon
    icon_img = img.resize((256, 256), Image.Resampling.LANCZOS)
    
    # Save PNG
    icon_img.save("assets/app.png", format="PNG")
    
    # Save multi-size ICO
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    icon_img.save("assets/app.ico", format="ICO", sizes=icon_sizes)
    print("Successfully generated assets/app.ico and assets/app.png")

if __name__ == "__main__":
    create_app_icon()
