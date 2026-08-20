"use client";

import { FilterIcon, XIcon } from "lucide-react";
import type { NodeType } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

const TYPE_LABELS: Record<string, string> = {
  all: "All items",
  FOLDER: "Folders only",
  FILE: "Files only",
};

interface BrowserFiltersProps {
  type: NodeType | undefined;
  onTypeChange: (type: NodeType | undefined) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

/**
 * Narrows what the current folder shows. Distinct from the header's search,
 * which looks across the whole room - this one answers "show me less of what
 * is already in front of me".
 */
export function BrowserFilters({
  type,
  onTypeChange,
  query,
  onQueryChange,
}: BrowserFiltersProps) {
  const isFiltered = type !== undefined || query.length > 0;

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter this folder"
          aria-label="Filter this folder by name"
          className="h-7 w-44 pr-7 text-xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear the filter"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 cursor-pointer -translate-y-1/2"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <FilterIcon />
          {TYPE_LABELS[type ?? "all"]}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-36">
          <DropdownMenuItem onClick={() => onTypeChange(undefined)}>
            All items
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onTypeChange("FOLDER")}>
            Folders only
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onTypeChange("FILE")}>
            Files only
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onTypeChange(undefined);
            onQueryChange("");
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
