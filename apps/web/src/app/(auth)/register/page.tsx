import { Suspense } from "react";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create account — Data Room" };

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
