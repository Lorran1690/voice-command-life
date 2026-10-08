import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Início — J.A.R.V.I.S." },
      { name: "description", content: "J.A.R.V.I.S. local." },
      { property: "og:title", content: "Início — J.A.R.V.I.S." },
      { property: "og:description", content: "Acesse seu centro de comando pessoal J.A.R.V.I.S." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeRedirect,
});

function HomeRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({
      to: "/chat/$threadId",
      params: { threadId: "local" },
      replace: true,
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
