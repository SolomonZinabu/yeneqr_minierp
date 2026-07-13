import { redirect } from "next/navigation";

// Root page — middleware handles the redirect, this is just a fallback
export default function RootPage() {
  redirect("/dashboard");
}
