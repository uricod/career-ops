import type { Metadata } from "next";
import { LoginForm } from "@/components/community/login-form";
export const metadata: Metadata = { title: "Sign in — Career Ops Community" };
export default function LoginPage() {
  return <LoginForm />;
}
