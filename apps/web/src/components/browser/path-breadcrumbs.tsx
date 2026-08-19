"use client";

import { Fragment } from "react";
import type { BreadcrumbDto } from "@dataroom/shared";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Beyond this many levels the middle collapses. Keeping the root and the last
 * two entries preserves the two things people navigate by: where the path
 * starts and where they are now.
 */
const MAX_VISIBLE = 4;

interface PathBreadcrumbsProps {
  items: BreadcrumbDto[] | undefined;
  isLoading: boolean;
  onNavigate: (nodeId: string) => void;
}

export function PathBreadcrumbs({
  items,
  isLoading,
  onNavigate,
}: PathBreadcrumbsProps) {
  if (isLoading || !items || items.length === 0) {
    return <Skeleton className="h-5 w-48" />;
  }

  const current = items[items.length - 1];
  const collapsed = items.length > MAX_VISIBLE;
  const leading = items[0];
  const hidden = collapsed ? items.slice(1, -2) : [];
  const trailing = collapsed ? items.slice(-2, -1) : items.slice(0, -1);

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {collapsed && leading && (
          <>
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbLink
                render={
                  <button
                    type="button"
                    onClick={() => onNavigate(leading.id)}
                    className="max-w-32 cursor-pointer truncate"
                  />
                }
              >
                {leading.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Show hidden folders"
                      className="hover:text-foreground cursor-pointer"
                    />
                  }
                >
                  <BreadcrumbEllipsis />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-auto">
                  {hidden.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                    >
                      {item.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        {trailing.map((item) => (
          <Fragment key={item.id}>
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbLink
                render={
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className="max-w-40 cursor-pointer truncate"
                  />
                }
              >
                {item.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}

        {current && (
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="max-w-64 truncate">
              {current.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
