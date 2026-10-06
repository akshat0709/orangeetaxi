import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/content-page";
export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Orange for Business — Orange Taxi" },
      {
        name: "description",
        content: "Premium electric transport for employees, clients and guests.",
      },
      { property: "og:title", content: "Orange for Business" },
      { property: "og:description", content: "A more comfortable way for your people to travel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ContentPage
      eyebrow="Orange for Business"
      title="Better journeys do better business."
      copy="Plan employee travel, airport transfers and client journeys with consistent service and simpler oversight. For corporate accounts, GST invoicing packages and executive transit tie-ups, reach our business desk directly at business@orange-taxi.com."
    />
  ),
});
