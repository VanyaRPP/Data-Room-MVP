"use client";

import { useState, type FormEvent } from "react";
import { CheckIcon, CopyIcon, LinkIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import {
  SHARE_EXPIRY_CHOICES,
  shareEmailSchema,
  type NodeType,
  type ShareDto,
} from "@dataroom/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateShare,
  useRevokeShare,
  useShares,
} from "@/hooks/use-shares";
import { formatTimeUntil } from "@/lib/format";

/**
 * Anything shareable: a file, a folder, or the room's own root folder - which
 * is how "share the whole data room" is expressed.
 */
export interface ShareTarget {
  id: string;
  name: string;
  type: NodeType;
  /** True for the room root, which reads as a data room rather than a folder. */
  isRoom?: boolean;
}

interface ShareDialogProps {
  node: ShareTarget | null;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ node, onOpenChange }: ShareDialogProps) {
  return (
    <Dialog open={node !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {node && <ShareDialogBody key={node.id} node={node} />}
      </DialogContent>
    </Dialog>
  );
}

function ShareDialogBody({ node }: { node: ShareTarget }) {
  const shares = useShares(node.id);
  const publicShare = shares.data?.find((share) => share.mode === "PUBLIC");
  const restrictedShare = shares.data?.find(
    (share) => share.mode === "RESTRICTED",
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share &ldquo;{node.name}&rdquo;</DialogTitle>
        <DialogDescription>
          Anyone you share with gets read-only access to this {describe(node)}.
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="link">
        <TabsList className="w-full">
          <TabsTrigger value="link">
            <LinkIcon />
            Public link
          </TabsTrigger>
          <TabsTrigger value="people">
            <UsersIcon />
            Specific people
          </TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="pt-3">
          {shares.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <PublicLinkTab nodeId={node.id} share={publicShare} />
          )}
        </TabsContent>

        <TabsContent value="people" className="pt-3">
          {shares.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <SpecificPeopleTab nodeId={node.id} share={restrictedShare} />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function PublicLinkTab({
  nodeId,
  share,
}: {
  nodeId: string;
  share: ShareDto | undefined;
}) {
  const createShare = useCreateShare(nodeId);
  const revokeShare = useRevokeShare(nodeId);
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);

  if (!share) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Create a link and anyone who has it can view this, without signing in.
        </p>
        <ExpiryChoice value={expiresInDays} onChange={setExpiresInDays} />
        <Button
          onClick={() =>
            createShare.mutate({ nodeId, mode: "PUBLIC", expiresInDays })
          }
          disabled={createShare.isPending}
        >
          <LinkIcon />
          {createShare.isPending ? "Creating…" : "Create link"}
        </Button>
        {createShare.error && (
          <p className="text-destructive text-sm">{createShare.error.message}</p>
        )}
      </div>
    );
  }

  const url = shareUrl(share.token);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link. Select and copy it manually.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input readOnly value={url} className="font-mono text-xs" />
        <Button variant="outline" size="icon" onClick={() => void copy()} aria-label="Copy link">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Anyone with this link can view.
          {share.expiresAt && <> Expires {formatTimeUntil(share.expiresAt)}.</>}
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() =>
            revokeShare.mutate(share.id, {
              onSuccess: () => toast.success("Link disabled"),
              onError: (error) => toast.error(error.message),
            })
          }
          disabled={revokeShare.isPending}
        >
          {revokeShare.isPending ? "Disabling…" : "Disable link"}
        </Button>
      </div>
    </div>
  );
}

function SpecificPeopleTab({
  nodeId,
  share,
}: {
  nodeId: string;
  share: ShareDto | undefined;
}) {
  const createShare = useCreateShare(nodeId);
  const revokeShare = useRevokeShare(nodeId);
  const [emails, setEmails] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setValidationError(null);

    // Accept the way people actually paste addresses: commas, spaces, newlines.
    const parsed = emails
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (parsed.length === 0) {
      setValidationError("Enter at least one email address");
      return;
    }

    const invalid = parsed.find(
      (email) => !shareEmailSchema.safeParse(email).success,
    );
    if (invalid) {
      setValidationError(`"${invalid}" is not a valid email address`);
      return;
    }

    createShare.mutate(
      { nodeId, mode: "RESTRICTED", emails: parsed, expiresInDays },
      {
        onSuccess: () => {
          toast.success(
            parsed.length === 1
              ? `Shared with ${parsed[0]}`
              : `Shared with ${parsed.length} people`,
          );
          setEmails("");
        },
      },
    );
  }

  const errorMessage = validationError ?? createShare.error?.message ?? null;
  const grants = share?.grants ?? [];

  return (
    <div className="space-y-4">
      {/* Only while there is no share yet: after that the access is already
          out there, and the way to take it back is Revoke. */}
      {!share && (
        <ExpiryChoice value={expiresInDays} onChange={setExpiresInDays} />
      )}

      <form onSubmit={handleSubmit} className="space-y-2" noValidate>
        <div className="flex items-center gap-2">
          <Input
            value={emails}
            onChange={(event) => setEmails(event.target.value)}
            placeholder="name@company.com"
            disabled={createShare.isPending}
            aria-label="Email addresses"
            aria-invalid={errorMessage !== null}
          />
          <Button type="submit" disabled={createShare.isPending}>
            {createShare.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
        {errorMessage && (
          <p className="text-destructive text-sm">{errorMessage}</p>
        )}
      </form>

      {grants.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No one has been given access yet. People you add can open this after
          signing in - they do not need an account beforehand.
        </p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y rounded-lg border">
            {grants.map((grant) => (
              <li
                key={grant.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="truncate text-sm">{grant.email}</span>
                <Badge variant={grant.claimed ? "secondary" : "outline"}>
                  {grant.claimed ? "Viewer" : "Invited"}
                </Badge>
              </li>
            ))}
          </ul>
          {share && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">
                {grants.length} {grants.length === 1 ? "person has" : "people have"}{" "}
                access.
                {share.expiresAt && <> Expires {formatTimeUntil(share.expiresAt)}.</>}
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  revokeShare.mutate(share.id, {
                    onSuccess: () => toast.success("Access revoked"),
                    onError: (error) => toast.error(error.message),
                  })
                }
                disabled={revokeShare.isPending}
              >
                {revokeShare.isPending ? "Revoking…" : "Revoke access"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * How long a new link should last.
 *
 * All the options are on screen rather than behind a dropdown: there are only
 * four, and an expiry that has to be hunted for is one nobody sets. Shown only
 * while the link is being created, since it is fixed once the token exists -
 * changing it afterwards would silently alter a credential already in
 * circulation, which is what revoking is for.
 */
function ExpiryChoice({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (days: number | null) => void;
}) {
  const options: { days: number | null; label: string }[] = [
    ...SHARE_EXPIRY_CHOICES.map((days) => ({ days, label: `${days} days` })),
    { days: null, label: "No expiry" },
  ];

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Link expires</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Button
            key={option.label}
            type="button"
            size="xs"
            variant={option.days === value ? "default" : "outline"}
            aria-pressed={option.days === value}
            onClick={() => onChange(option.days)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

function describe(node: ShareTarget): string {
  if (node.isRoom) return "data room and everything in it";
  return node.type === "FOLDER" ? "folder and everything inside it" : "file";
}

function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}
