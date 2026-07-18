import { redirect } from "next/navigation";

// The dashboard lives on the home page (`/`), which renders the
// Dashboard component for signed-in users. This route only exists to
// keep old bookmarks working.
export default function DashboardPage() {
  redirect("/");
}
