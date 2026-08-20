"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Search lives in the header and submits to its own page rather than filtering
 * in place: results span the whole data room, so they are not a view of the
 * folder you happen to be standing in, and a URL you can share or reload beats
 * state that vanishes on navigation.
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  // Keep the box in step with the URL - going back should restore the query
  // that produced the page being shown.
  useEffect(() => setValue(params.get("q") ?? ""), [params]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const query = value.trim();
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xs">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search files and folders"
        aria-label="Search files and folders"
        className="pl-8"
      />
    </form>
  );
}
