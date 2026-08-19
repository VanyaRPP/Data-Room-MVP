"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginSchema, type UserDto } from "@dataroom/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiFetch<UserDto>("/auth/login", { method: "POST", body: input }),
    onSuccess: (user) => {
      queryClient.setQueryData(["me"], user);
      router.replace(next ?? "/");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(null);
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    login.mutate(result.data);
  }

  const serverError = login.error instanceof ApiError ? login.error.message : null;
  const errorMessage = fieldError ?? serverError;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={login.isPending}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={login.isPending}
          required
        />
      </div>
      {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
