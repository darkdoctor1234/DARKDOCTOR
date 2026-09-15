import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Darkdoctor",
    short_name: "Darkdoctor",
    description: "Medical College Reviews",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0D1117",
    theme_color: "#0D1117",
    orientation: "portrait-primary",
    categories: ["medical", "education"],
    icons: [
      {
        // brand-icon.png is 512×512 — meets Chrome's ≥192px install requirement
        src: "/brand-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
