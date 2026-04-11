import { redirect } from "next/navigation";

/** Root URL — send users to the live office (avoids blank `/`). */
export default function HomePage() {
  redirect("/office/stream");
}
