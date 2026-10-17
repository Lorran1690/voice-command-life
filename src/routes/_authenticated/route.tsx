import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";

import { getLocalUser } from "@/lib/local-mode";
import { ElysiaBootIntro } from "@/components/jarvis/elysia-boot-intro";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [showBootIntro, setShowBootIntro] = useState(false);

  useEffect(() => {
    if (getLocalUser()) {
      setChecked(true);
      try {
        if (!window.sessionStorage.getItem("elysia:boot-intro:v1")) setShowBootIntro(true);
      } catch {
        setShowBootIntro(true);
      }
    } else {
      navigate({ to: "/auth", replace: true });
    }
  }, [navigate]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Outlet />
      {showBootIntro && (
        <ElysiaBootIntro
          onFinished={() => {
            try {
              window.sessionStorage.setItem("elysia:boot-intro:v1", "seen");
            } catch {
              // A blocked storage API must never stop startup.
            }
            setShowBootIntro(false);
          }}
        />
      )}
    </>
  );
}
