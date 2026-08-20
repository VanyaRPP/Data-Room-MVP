"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileTextIcon, FolderIcon, SearchIcon } from "lucide-react";
import { SEARCH_SUGGESTION_LIMIT, type SearchResult } from "@dataroom/shared";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { useSearch } from "@/hooks/use-search";
import { cn } from "@/lib/utils";

/**
 * Search from the header, with matches previewed as you type.
 *
 * Reading a data room usually means going to one document you already know the
 * name of, so the fast path is picking it straight from this list. Submitting
 * goes to the full results page instead, which is a URL worth keeping.
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // One request once the typing pauses, rather than one per keystroke.
  const debounced = useDebounced(value.trim(), 250);
  const suggestions = useSearch(debounced, SEARCH_SUGGESTION_LIMIT);
  const results = suggestions.data?.pages[0]?.items ?? [];

  // Keep the box in step with the URL - going back should restore the query
  // that produced the page being shown.
  useEffect(() => {
    setValue(params.get("q") ?? "");
    setIsOpen(false);
  }, [params]);

  useEffect(() => setHighlighted(0), [debounced]);

  // A click anywhere else dismisses the list, the way a menu would.
  useEffect(() => {
    function onPointerDown(event: PointerEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function open(result: SearchResult): void {
    setIsOpen(false);
    router.push(
      result.node.type === "FOLDER"
        ? `/room/${result.node.id}`
        : `/file/${result.node.id}`,
    );
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;

    const choice = isOpen ? results[highlighted] : undefined;
    if (choice) {
      open(choice);
      return;
    }

    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (results.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setHighlighted((current) => {
        const step = event.key === "ArrowDown" ? 1 : -1;
        return (current + step + results.length) % results.length;
      });
    }
  }

  const showList = isOpen && debounced.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <form onSubmit={submit}>
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          type="search"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search files and folders"
          aria-label="Search files and folders"
          aria-expanded={showList}
          aria-controls="search-suggestions"
          role="combobox"
          autoComplete="off"
          className="pl-8"
        />
      </form>

      {showList && (
        <div
          id="search-suggestions"
          role="listbox"
          className="bg-popover absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border shadow-md"
        >
          {suggestions.isLoading ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">
              Nothing matched
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((result, index) => (
                <li key={result.node.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlighted}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => open(result)}
                    className={cn(
                      "flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-1.5 text-left",
                      index === highlighted && "bg-accent",
                    )}
                  >
                    <span className="flex w-full min-w-0 items-center gap-2 text-sm">
                      {result.node.type === "FOLDER" ? (
                        <FolderIcon className="text-muted-foreground size-4 shrink-0" />
                      ) : (
                        <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                      )}
                      <span className="truncate">{result.node.name}</span>
                    </span>
                    <span className="text-muted-foreground w-full truncate pl-6 text-xs">
                      {result.path.join(" / ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {results.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push(`/search?q=${encodeURIComponent(value.trim())}`);
              }}
              className="text-muted-foreground hover:text-foreground w-full cursor-pointer border-t px-3 py-1.5 text-left text-xs"
            >
              See all results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
