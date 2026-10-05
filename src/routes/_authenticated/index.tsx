import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  component: HomeRedirect,
});

// Picks the most recent conversation (or creates the first one) and opens it.
function HomeRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data: threads } = await supabase
        .from("threads")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1);
      let threadId = threads?.[0]?.id;
      if (!threadId) {
        const { data } = await supabase
          .from("threads")
          .insert({ user_id: user.id, title: "Nova conversa" })
          .select("id")
          .single();
        threadId = data?.id;
      }
      if (threadId && active) {
        navigate({ to: "/chat/$threadId", params: { threadId }, replace: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
