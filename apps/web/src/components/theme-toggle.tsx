"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The server has no idea which theme will apply, so the icon can only be
  // decided once the client knows. Until then a same-sized placeholder holds
  // the space rather than letting the header jump.
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="size-7" aria-hidden />;

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
