"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registerSchema, type UserDto } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const next = searchParams.get("next");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: (input: { email: string; password: string; name: string }) =>
      apiFetch<UserDto>("/auth/register", { method: "POST", body: input }),
    onSuccess: (user) => {
      queryClient.setQueryData(["me"], user);
      router.replace(next ?? "/");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(null);
    const result = registerSchema.safeParse({ email, password, name });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    register.mutate(result.data);
  }

  const serverError = register.error instanceof ApiError ? register.error.message : null;
  const errorMessage = fieldError ?? serverError;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={register.isPending}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={register.isPending}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={register.isPending}
          required
        />
        <p className="text-muted-foreground text-xs">At least 8 characters.</p>
      </div>
      {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
      <Button type="submit" className="w-full" disabled={register.isPending}>
        {register.isPending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
