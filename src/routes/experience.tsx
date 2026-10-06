import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/content-page";
export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "The Orange Experience — Orange Taxi" },
      {
        name: "description",
        content: "Discover the thoughtful details behind every Orange Taxi journey.",
      },
      { property: "og:title", content: "The Orange Experience" },
      {
        property: "og:description",
        content: "A prepared car, professional welcome and a smooth electric ride.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ContentPage
      eyebrow="The Orange experience"
      title="Made to feel effortless."
      copy="A clean, pre-cooled cabin. A professional welcome. Water waiting for you. A quiet electric journey. Orange brings these details together so everyday travel feels genuinely considered."
      action="book"
    />
  ),
});
