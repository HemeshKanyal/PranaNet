import { redirect } from "next/navigation";

// Temporary until the story site lands (Part C): the dashboard now lives at /live.
export default function Home() {
  redirect("/live");
}
