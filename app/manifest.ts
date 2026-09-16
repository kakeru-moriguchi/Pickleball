import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pickle Link",
    short_name: "Pickle Link",
    description: "ピックルボール仲間と練習会・大会・イベントを見つけるコミュニティアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#d95763",
    lang: "ja",
  };
}
